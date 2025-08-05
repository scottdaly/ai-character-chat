const { Op } = require('sequelize');

class CreditRefreshService {
  constructor(sequelize, models, creditService) {
    this.sequelize = sequelize;
    this.models = models;
    this.creditService = creditService;
    this.User = models.User;
    this.CreditRefreshHistory = models.CreditRefreshHistory;
    this.CreditAuditLog = models.CreditAuditLog;
    
    this.isRunning = false;
    this.refreshInterval = null;
    
    // Configuration
    this.config = {
      batchSize: parseInt(process.env.CREDIT_REFRESH_BATCH_SIZE || '100'),
      refreshIntervalDays: 30,
      gracePeriodDays: 1,
      minimumIntervalDays: 29,
      creditAmounts: {
        free: parseInt(process.env.CREDITS_FREE_TIER || '1000'),
        pro: parseInt(process.env.CREDITS_PRO_TIER || '20000'),
      },
      dryRun: process.env.CREDIT_REFRESH_DRY_RUN === 'true',
    };
  }

  /**
   * Check if a user is eligible for credit refresh
   * @param {Object} user - User object
   * @returns {Object} Eligibility status and reason
   */
  isEligibleForRefresh(user) {
    const now = new Date();
    const lastRefresh = user.lastCreditRefresh || user.createdAt;
    
    if (!lastRefresh) {
      return { eligible: false, reason: 'No refresh date found' };
    }

    const daysSinceRefresh = (now - new Date(lastRefresh)) / (1000 * 60 * 60 * 24);
    
    // Check if user has refresh hold
    if (user.creditRefreshHold) {
      return { eligible: false, reason: 'Refresh hold active', daysSinceRefresh };
    }

    // Check minimum interval (prevent abuse)
    if (daysSinceRefresh < this.config.minimumIntervalDays) {
      return { 
        eligible: false, 
        reason: 'Too soon since last refresh', 
        daysSinceRefresh,
        daysUntilEligible: this.config.refreshIntervalDays - daysSinceRefresh 
      };
    }

    // Check if refresh is due (30 days + grace period)
    if (daysSinceRefresh >= this.config.refreshIntervalDays) {
      return { 
        eligible: true, 
        reason: 'Refresh due', 
        daysSinceRefresh,
        creditsToAdd: this.getCreditAmount(user)
      };
    }

    return { 
      eligible: false, 
      reason: 'Not yet due for refresh', 
      daysSinceRefresh,
      daysUntilEligible: this.config.refreshIntervalDays - daysSinceRefresh 
    };
  }

  /**
   * Get credit amount based on user's subscription tier
   * @param {Object} user - User object
   * @returns {number} Credits to add
   */
  getCreditAmount(user) {
    // Check for custom credit amount override
    if (user.customCreditAmount && user.customCreditAmount > 0) {
      return user.customCreditAmount;
    }

    // Return based on subscription tier
    const tier = user.subscriptionTier || 'free';
    return this.config.creditAmounts[tier] || this.config.creditAmounts.free;
  }

  /**
   * Refresh credits for a single user
   * @param {string} userId - User ID
   * @param {Object} options - Refresh options
   * @returns {Promise<Object>} Refresh result
   */
  async refreshUserCredits(userId, options = {}) {
    const {
      amount = null,
      reason = 'scheduled',
      force = false,
      metadata = {}
    } = options;

    const Transaction = this.sequelize.Transaction || require('sequelize').Transaction;
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    try {
      // Get user with lock
      const user = await this.User.findByPk(userId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!user) {
        await transaction.rollback();
        return { success: false, error: 'User not found' };
      }

      // Check eligibility unless forced
      if (!force) {
        const eligibility = this.isEligibleForRefresh(user);
        if (!eligibility.eligible) {
          await transaction.rollback();
          return { 
            success: false, 
            error: eligibility.reason,
            details: eligibility 
          };
        }
      }

      // Determine credit amount
      const creditsToAdd = amount || this.getCreditAmount(user);
      const currentBalance = parseFloat(user.creditBalance) || 0;
      const newBalance = currentBalance + creditsToAdd;

      // Update user balance
      await user.update({
        creditBalance: newBalance,
        lastCreditRefresh: new Date()
      }, { transaction });

      // Create refresh history record
      // Map reason to valid refreshType enum values
      let refreshType = 'manual'; // default
      if (reason === 'scheduled' || reason === 'monthly') {
        refreshType = 'monthly';
      } else if (reason === 'initial') {
        refreshType = 'initial';
      } else if (reason === 'subscription_renewal') {
        refreshType = 'subscription_renewal';
      }

      await this.CreditRefreshHistory.create({
        userId: user.id,
        refreshType: refreshType,
        oldBalance: currentBalance,
        newBalance: newBalance,
        creditsAdded: creditsToAdd,
        refreshDate: new Date()
      }, { transaction });

      // Create audit log
      await this.CreditAuditLog.create({
        userId: user.id,
        operation: 'refresh',
        creditsAmount: creditsToAdd,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        relatedEntityType: 'subscription',
        reason: `Monthly credit refresh (${reason})`,
        metadata: {
          refreshType: reason,
          subscriptionTier: user.subscriptionTier,
          ...metadata
        }
      }, { transaction });

      // Commit transaction
      await transaction.commit();

      console.log(`[CreditRefresh] Successfully refreshed ${creditsToAdd} credits for user ${userId}`);

      return {
        success: true,
        userId: user.id,
        email: user.email,
        creditsAdded: creditsToAdd,
        newBalance,
        oldBalance: currentBalance,
        subscriptionTier: user.subscriptionTier
      };

    } catch (error) {
      await transaction.rollback();
      console.error(`[CreditRefresh] Error refreshing credits for user ${userId}:`, error);
      return { 
        success: false, 
        error: error.message,
        userId 
      };
    }
  }

  /**
   * Refresh credits for all eligible users
   * @returns {Promise<Object>} Batch refresh results
   */
  async refreshAllEligibleUsers() {
    console.log('[CreditRefresh] Starting batch refresh for all eligible users...');
    
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      refreshed: []
    };

    try {
      // Calculate eligibility date (30 days ago)
      const eligibilityDate = new Date();
      eligibilityDate.setDate(eligibilityDate.getDate() - this.config.refreshIntervalDays);

      // Find all potentially eligible users
      const users = await this.User.findAll({
        where: {
          [Op.or]: [
            { lastCreditRefresh: { [Op.lte]: eligibilityDate } },
            { lastCreditRefresh: null }
          ],
          creditRefreshHold: { [Op.ne]: true }
        },
        limit: this.config.batchSize
      });

      results.total = users.length;
      console.log(`[CreditRefresh] Found ${users.length} potentially eligible users`);

      // Process each user
      for (const user of users) {
        // Double-check eligibility
        const eligibility = this.isEligibleForRefresh(user);
        
        if (!eligibility.eligible) {
          results.skipped++;
          console.log(`[CreditRefresh] Skipping user ${user.id}: ${eligibility.reason}`);
          continue;
        }

        // Perform refresh
        if (this.config.dryRun) {
          console.log(`[CreditRefresh] DRY RUN: Would refresh ${eligibility.creditsToAdd} credits for user ${user.id}`);
          results.successful++;
        } else {
          const refreshResult = await this.refreshUserCredits(user.id, {
            reason: 'scheduled',
            metadata: { batchRun: true }
          });

          if (refreshResult.success) {
            results.successful++;
            results.refreshed.push({
              userId: user.id,
              email: user.email,
              creditsAdded: refreshResult.creditsAdded
            });
          } else {
            results.failed++;
            results.errors.push({
              userId: user.id,
              error: refreshResult.error
            });
          }
        }

        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[CreditRefresh] Batch refresh completed:`, {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped
      });

      return results;

    } catch (error) {
      console.error('[CreditRefresh] Batch refresh error:', error);
      results.errors.push({ general: error.message });
      return results;
    }
  }

  /**
   * Get next refresh date for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Next refresh information
   */
  async getNextRefreshInfo(userId) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        return { error: 'User not found' };
      }

      const eligibility = this.isEligibleForRefresh(user);
      const lastRefresh = user.lastCreditRefresh || user.createdAt;
      const nextRefreshDate = new Date(lastRefresh);
      nextRefreshDate.setDate(nextRefreshDate.getDate() + this.config.refreshIntervalDays);

      return {
        nextRefreshDate: nextRefreshDate.toISOString(),
        daysRemaining: Math.max(0, Math.ceil(eligibility.daysUntilEligible || 0)),
        creditsToReceive: this.getCreditAmount(user),
        currentBalance: user.creditBalance,
        subscriptionTier: user.subscriptionTier,
        isEligible: eligibility.eligible,
        refreshHold: user.creditRefreshHold || false
      };

    } catch (error) {
      console.error(`[CreditRefresh] Error getting refresh info for user ${userId}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Start the scheduled refresh service
   * @param {number} intervalHours - Check interval in hours
   */
  start(intervalHours = 1) {
    if (this.isRunning) {
      console.log('[CreditRefresh] Service is already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`[CreditRefresh] Starting refresh service with ${intervalHours} hour interval`);
    
    // Run initial check
    this.refreshAllEligibleUsers();

    // Set up periodic check
    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshAllEligibleUsers();
      } catch (error) {
        console.error('[CreditRefresh] Scheduled refresh failed:', error);
      }
    }, intervalMs);

    this.isRunning = true;
    console.log('[CreditRefresh] Service started successfully');
  }

  /**
   * Stop the scheduled refresh service
   */
  stop() {
    if (!this.isRunning) {
      console.log('[CreditRefresh] Service is not running');
      return;
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.isRunning = false;
    console.log('[CreditRefresh] Service stopped');
  }

  /**
   * Get refresh statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Refresh statistics
   */
  async getRefreshStatistics(options = {}) {
    const { startDate, endDate } = options;
    
    try {
      const whereClause = {};
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt[Op.gte] = startDate;
        if (endDate) whereClause.createdAt[Op.lte] = endDate;
      }

      const refreshHistory = await this.CreditRefreshHistory.findAll({
        where: whereClause,
        attributes: [
          'refreshType',
          [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count'],
          [this.sequelize.fn('SUM', this.sequelize.col('creditsAdded')), 'totalCredits'],
          [this.sequelize.fn('AVG', this.sequelize.col('creditsAdded')), 'avgCredits']
        ],
        group: ['refreshType']
      });

      const totalUsers = await this.User.count();
      const eligibleUsers = await this.User.count({
        where: {
          lastCreditRefresh: {
            [Op.lte]: new Date(Date.now() - this.config.refreshIntervalDays * 24 * 60 * 60 * 1000)
          },
          creditRefreshHold: { [Op.ne]: true }
        }
      });

      return {
        refreshHistory,
        totalUsers,
        eligibleUsers,
        nextBatchSize: Math.min(eligibleUsers, this.config.batchSize)
      };

    } catch (error) {
      console.error('[CreditRefresh] Error getting statistics:', error);
      return { error: error.message };
    }
  }
}

module.exports = CreditRefreshService;