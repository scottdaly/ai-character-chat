const { Op } = require("sequelize");
const crypto = require("crypto");

class CreditService {
  constructor(sequelize, models, tokenizerService = null) {
    this.sequelize = sequelize;
    this.models = models;
    this.User = models.User;
    this.TokenUsage = models.TokenUsage;
    this.CreditCompensation = models.CreditCompensation;
    this.CreditAuditLog = models.CreditAuditLog;
    this.CreditRefreshHistory = models.CreditRefreshHistory;
    this.ModelPricing = models.ModelPricing;
    this.CreditReservation = models.CreditReservation;
    this.ReservationSettlement = models.ReservationSettlement;
    this.tokenizerService = tokenizerService;
  }

  /**
   * Atomically deduct credits with race condition protection
   * @param {string} userId - User ID
   * @param {number} creditsToDeduct - Amount to deduct
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Result with success status and new balance
   */
  async deductCredits(userId, creditsToDeduct, context = {}) {
    // Use SERIALIZABLE isolation level for maximum safety
    const Transaction =
      this.sequelize.Transaction || require("sequelize").Transaction;
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      // Input validation
      if (!userId || typeof userId !== "string") {
        throw new Error("Invalid user ID");
      }

      if (!creditsToDeduct || creditsToDeduct <= 0) {
        throw new Error("Invalid credit amount");
      }

      if (creditsToDeduct > 1000) {
        throw new Error("Credit deduction amount exceeds safety limit");
      }

      // Lock user record for atomic update
      const user = await this.User.findByPk(userId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const currentBalance = parseFloat(user.creditBalance || 0);

      // Check if user has sufficient credits
      if (currentBalance < creditsToDeduct) {
        throw new Error(
          `Insufficient credits. Current: ${currentBalance}, Required: ${creditsToDeduct}`
        );
      }

      const newBalance = currentBalance - creditsToDeduct;

      // Update user balance
      await user.update({ creditBalance: newBalance }, { transaction });

      // Create audit log
      await this.CreditAuditLog.create(
        {
          userId,
          operation: "deduct",
          creditsAmount: creditsToDeduct,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          relatedEntityType: context.entityType || "message",
          relatedEntityId: context.entityId,
          reason: context.reason || "AI model usage",
          metadata: {
            ...context.metadata,
            deductionId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        { transaction }
      );

      await transaction.commit();

      return {
        success: true,
        previousBalance: currentBalance,
        newBalance,
        creditsDeducted: creditsToDeduct,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Check if user has sufficient credits (read-only operation)
   * @param {string} userId - User ID
   * @param {number} requiredCredits - Credits needed
   * @returns {Promise<Object>} Check result
   */
  async checkCreditBalance(userId, requiredCredits) {
    try {
      const user = await this.User.findByPk(userId, {
        attributes: ["creditBalance", "subscriptionTier"],
      });

      if (!user) {
        return { hasCredits: false, balance: 0, reason: "User not found" };
      }

      const balance = parseFloat(user.creditBalance || 0);
      const hasCredits = balance >= requiredCredits;

      return {
        hasCredits,
        balance,
        required: requiredCredits,
        subscriptionTier: user.subscriptionTier,
        reason: hasCredits ? null : "Insufficient credits",
      };
    } catch (error) {
      throw new Error(`Failed to check credit balance: ${error.message}`);
    }
  }

  /**
   * Record token usage and calculate cost
   * @param {Object} usageData - Token usage data
   * @returns {Promise<Object>} Recorded usage
   */
  async recordTokenUsage(usageData) {
    console.log(`[TOKEN USAGE DEBUG] Recording token usage:`, JSON.stringify(usageData));
    const transaction = await this.sequelize.transaction();

    try {
      // Validate required fields
      const required = [
        "userId",
        "conversationId",
        "messageId",
        "modelProvider",
        "modelName",
        "inputTokens",
        "outputTokens",
      ];

      for (const field of required) {
        if (!usageData[field] && usageData[field] !== 0) {
          console.error(`[TOKEN USAGE DEBUG] Missing required field: ${field}, value: ${usageData[field]}`);
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Calculate costs using model pricing
      const pricing = await this.getModelPricing(
        usageData.modelName,
        usageData.modelProvider
      );

      const inputCostUsd =
        (usageData.inputTokens / 1000) * pricing.inputPricePer1k;
      const outputCostUsd =
        (usageData.outputTokens / 1000) * pricing.outputPricePer1k;
      const totalCostUsd = inputCostUsd + outputCostUsd;
      const creditsUsed = totalCostUsd / 0.001; // $0.001 per credit
      const creditsCharged = this.calculateUserChargeableCredits(creditsUsed);

      // Record token usage
      const tokenUsage = await this.TokenUsage.create(
        {
          userId: usageData.userId,
          conversationId: usageData.conversationId,
          messageId: usageData.messageId,
          modelProvider: usageData.modelProvider,
          modelName: usageData.modelName,
          inputTokens: usageData.inputTokens,
          outputTokens: usageData.outputTokens,
          totalTokens: usageData.inputTokens + usageData.outputTokens,
          inputCostUsd,
          outputCostUsd,
          totalCostUsd,
          creditsUsed,
          creditsCharged,
        },
        { transaction }
      );

      await transaction.commit();
      return tokenUsage;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get current model pricing
   * @param {string} modelName - Model name
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} Pricing information
   */
  async getModelPricing(modelName, provider) {
    try {
      // Try to get current pricing from database
      const pricing = await this.ModelPricing.findOne({
        where: {
          modelName,
          provider,
          effectiveDate: {
            [Op.lte]: new Date(),
          },
          [Op.or]: [
            { deprecatedDate: null },
            { deprecatedDate: { [Op.gt]: new Date() } },
          ],
        },
        order: [["effectiveDate", "DESC"]],
      });

      if (pricing) {
        return pricing;
      }

      // Fallback to default pricing if not found in database
      return this.getDefaultModelPricing(modelName, provider);
    } catch (error) {
      console.error("Failed to get model pricing:", error);
      return this.getDefaultModelPricing(modelName, provider);
    }
  }

  /**
   * Get default model pricing (fallback)
   * @private
   */
  getDefaultModelPricing(modelName, provider) {
    const defaultPricing = {
      openai: {
        "gpt-4o": { input: 0.0025, output: 0.01 },
        "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
        "gpt-4-turbo": { input: 0.01, output: 0.03 },
        "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
      },
      anthropic: {
        "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
        "claude-3-5-haiku-20241022": { input: 0.0008, output: 0.004 },
        "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
      },
      google: {
        "gemini-1.5-pro-002": { input: 0.00125, output: 0.005 },
        "gemini-1.5-flash-002": { input: 0.000075, output: 0.0003 },
      },
    };

    const providerPricing = defaultPricing[provider];
    if (!providerPricing) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const modelPricing = providerPricing[modelName];
    if (!modelPricing) {
      // Use a generic default for unknown models
      console.warn(`Unknown model ${modelName}, using default pricing`);
      return {
        inputPricePer1k: 0.001,
        outputPricePer1k: 0.003,
      };
    }

    return {
      inputPricePer1k: modelPricing.input,
      outputPricePer1k: modelPricing.output,
    };
  }

  /**
   * Create compensation record for failed operations
   * @param {string} userId - User ID
   * @param {number} creditsToRefund - Credits to refund
   * @param {string} reason - Reason for compensation
   * @param {string} messageId - Related message ID
   * @returns {Promise<Object>} Compensation record
   */
  async createCompensation(userId, creditsToRefund, reason, messageId = null) {
    try {
      const compensation = await this.CreditCompensation.create({
        userId,
        messageId,
        creditsToRefund,
        reason,
        status: "pending",
      });

      return compensation;
    } catch (error) {
      throw new Error(`Failed to create compensation: ${error.message}`);
    }
  }

  /**
   * Process pending compensations
   * @returns {Promise<Array>} Processed compensations
   */
  async processPendingCompensations() {
    const transaction = await this.sequelize.transaction();

    try {
      // Get pending compensations
      const pendingCompensations = await this.CreditCompensation.findAll({
        where: { status: "pending" },
        limit: 100, // Process in batches
        transaction,
      });

      const results = [];

      for (const compensation of pendingCompensations) {
        try {
          // Lock user record
          const user = await this.User.findByPk(compensation.userId, {
            lock: transaction.LOCK.UPDATE,
            transaction,
          });

          if (!user) {
            await compensation.update(
              { status: "failed", processedAt: new Date() },
              { transaction }
            );
            continue;
          }

          const currentBalance = parseFloat(user.creditBalance || 0);
          const newBalance =
            currentBalance + parseFloat(compensation.creditsToRefund);

          // Update user balance
          await user.update({ creditBalance: newBalance }, { transaction });

          // Create audit log
          await this.CreditAuditLog.create(
            {
              userId: compensation.userId,
              operation: "refund",
              creditsAmount: compensation.creditsToRefund,
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              relatedEntityType: "compensation",
              relatedEntityId: compensation.id,
              reason: `Compensation: ${compensation.reason}`,
              metadata: {
                compensationId: compensation.id,
                originalMessageId: compensation.messageId,
              },
            },
            { transaction }
          );

          // Mark compensation as processed
          await compensation.update(
            { status: "processed", processedAt: new Date() },
            { transaction }
          );

          results.push({
            compensationId: compensation.id,
            userId: compensation.userId,
            creditsRefunded: compensation.creditsToRefund,
            success: true,
          });
        } catch (error) {
          console.error(
            `Failed to process compensation ${compensation.id}:`,
            error
          );
          await compensation.update(
            { status: "failed", processedAt: new Date() },
            { transaction }
          );

          results.push({
            compensationId: compensation.id,
            userId: compensation.userId,
            error: error.message,
            success: false,
          });
        }
      }

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get user's credit usage statistics
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Usage statistics
   */
  async getCreditUsageStats(userId, options = {}) {
    try {
      const { startDate, endDate, limit = 100 } = options;

      const whereClause = { userId };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt[Op.gte] = startDate;
        if (endDate) whereClause.createdAt[Op.lte] = endDate;
      }

      // Get recent token usage
      const recentUsage = await this.TokenUsage.findAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        limit,
        attributes: [
          "id",
          "modelProvider",
          "modelName",
          "totalTokens",
          "totalCostUsd",
          "creditsUsed",
          "createdAt",
        ],
      });

      // Get aggregated stats
      const stats = await this.TokenUsage.findOne({
        where: whereClause,
        attributes: [
          [
            this.sequelize.fn("SUM", this.sequelize.col("totalTokens")),
            "totalTokens",
          ],
          [
            this.sequelize.fn("SUM", this.sequelize.col("totalCostUsd")),
            "totalCostUsd",
          ],
          [
            this.sequelize.fn("SUM", this.sequelize.col("creditsUsed")),
            "totalCreditsUsed",
          ],
          [
            this.sequelize.fn("COUNT", this.sequelize.col("id")),
            "totalRequests",
          ],
        ],
        raw: true,
      });

      // Get current balance
      const user = await this.User.findByPk(userId, {
        attributes: ["creditBalance", "subscriptionTier"],
      });

      return {
        currentBalance: parseFloat(user?.creditBalance || 0),
        subscriptionTier: user?.subscriptionTier || "free",
        totalTokens: parseInt(stats?.totalTokens || 0),
        totalCostUsd: parseFloat(stats?.totalCostUsd || 0),
        totalCreditsUsed: parseFloat(stats?.totalCreditsUsed || 0),
        totalRequests: parseInt(stats?.totalRequests || 0),
        recentUsage: recentUsage.map((usage) => ({
          id: usage.id,
          provider: usage.modelProvider,
          model: usage.modelName,
          tokens: usage.totalTokens,
          costUsd: parseFloat(usage.totalCostUsd),
          creditsUsed: parseFloat(usage.creditsUsed),
          createdAt: usage.createdAt,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
  }

  /**
   * Estimate credits needed for a message using precise token counting
   * @param {string} content - Message content
   * @param {string} model - Model name
   * @param {string} provider - Provider name
   * @param {Object} context - Additional context (systemPrompt, conversationHistory, attachments)
   * @returns {Promise<Object>} Credit estimation with token counts
   */
  async estimateMessageCredits(content, model, provider, context = {}) {
    try {
      // Use enhanced tokenizer service with better accuracy
      let tokenCount;
      
      if (this.tokenizerService) {
        try {
          tokenCount = await this.tokenizerService.countTokens(
            content,
            model,
            {
              systemPrompt: context.systemPrompt,
              conversationHistory: context.conversationHistory,
              attachments: context.attachments
            }
          );
          
          // Log detailed breakdown for debugging
          if (process.env.NODE_ENV === 'development' && tokenCount.breakdown) {
            console.log(`Token estimation for ${model}:`, {
              method: tokenCount.method,
              breakdown: tokenCount.breakdown,
              confidence: tokenCount.isExact ? 'High (official API)' : 'Medium (estimation)'
            });
          }
        } catch (tokenError) {
          console.warn('Enhanced tokenization failed, falling back to simple estimation:', tokenError.message);
          tokenCount = null;
        }
      }
      
      if (!tokenCount) {
        // Fallback to simple estimation
        const totalChars = (content?.length || 0) + 
                          (context.systemPrompt?.length || 0) +
                          (context.conversationHistory?.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) || 0);
        const estimatedTokens = Math.ceil(totalChars / 4);
        const attachmentTokens = (context.attachments?.length || 0) * 85;
        
        tokenCount = {
          inputTokens: estimatedTokens + attachmentTokens,
          estimatedOutputTokens: Math.min(estimatedTokens * 0.5, 1000),
          isExact: false,
          method: 'simple-estimation'
        };
      }

      // Get pricing
      const pricing = await this.getModelPricing(model, provider);

      // Calculate costs
      const inputCost = (tokenCount.inputTokens / 1000) * pricing.inputPricePer1k;
      const outputCost = (tokenCount.estimatedOutputTokens / 1000) * pricing.outputPricePer1k;
      const totalCost = inputCost + outputCost;
      const creditsNeeded = totalCost / 0.001; // $0.001 per credit
      const creditsToCharge = this.calculateUserChargeableCredits(creditsNeeded);

      return {
        inputTokens: tokenCount.inputTokens,
        estimatedOutputTokens: tokenCount.estimatedOutputTokens,
        inputCostUsd: inputCost,
        outputCostUsd: outputCost,
        totalCostUsd: totalCost,
        creditsNeeded,
        creditsToCharge,
        isExact: tokenCount.isExact,
        tokenCountMethod: tokenCount.method,
        confidence: this.getConfidenceLevel(tokenCount),
        bufferMultiplier: this.calculateBufferMultiplier(tokenCount, provider)
      };
    } catch (error) {
      console.error('Failed to estimate message credits:', error);
      
      // Return a conservative estimate on error
      const fallbackTokens = Math.ceil((content?.length || 0) / 4) + 500; // Add buffer
      const fallbackCost = (fallbackTokens * 2 / 1000) * 0.01; // Assume $0.01 per 1k tokens average
      
      return {
        inputTokens: fallbackTokens,
        estimatedOutputTokens: fallbackTokens,
        inputCostUsd: fallbackCost / 2,
        outputCostUsd: fallbackCost / 2,
        totalCostUsd: fallbackCost,
        creditsNeeded: fallbackCost / 0.001,
        isExact: false,
        tokenCountMethod: 'fallback',
        bufferMultiplier: 1.5 // Higher buffer for fallback
      };
    }
  }

  /**
   * Get confidence level for token count estimation
   * @private
   */
  getConfidenceLevel(tokenCount) {
    if (tokenCount.isExact) {
      return 'high'; // Official API
    }
    
    if (tokenCount.method?.includes('enhanced')) {
      return 'medium'; // Enhanced estimation with complexity adjustment
    }
    
    if (tokenCount.method?.includes('tiktoken')) {
      return 'high'; // OpenAI tiktoken is very accurate
    }
    
    return 'low'; // Fallback estimation
  }

  /**
   * Calculate user-chargeable credits (rounded up to whole number)
   * @param {number} actualCredits - Actual credits calculated (decimal)
   * @returns {number} Credits to charge user (whole number)
   */
  calculateUserChargeableCredits(actualCredits) {
    return Math.ceil(actualCredits);
  }

  /**
   * Convert token usage to credits with both actual and chargeable amounts
   * @param {Object} tokenUsage - Token usage object with inputTokens and outputTokens
   * @param {Object} pricing - Model pricing object
   * @returns {Object} Credit amounts (actual and chargeable)
   */
  calculateCreditsFromUsage(tokenUsage, pricing) {
    const inputCost = (tokenUsage.inputTokens / 1000) * pricing.inputPricePer1k;
    const outputCost = (tokenUsage.outputTokens / 1000) * pricing.outputPricePer1k;
    const totalCost = inputCost + outputCost;
    const actualCredits = totalCost / 0.001; // $0.001 per credit
    const chargeableCredits = this.calculateUserChargeableCredits(actualCredits);
    
    return {
      actualCredits,
      chargeableCredits,
      inputCost,
      outputCost,
      totalCost
    };
  }

  /**
   * Calculate buffer multiplier based on estimation confidence and provider
   * @private
   */
  calculateBufferMultiplier(tokenCount, provider) {
    let baseBuffer = 1.0;
    
    // Base buffer by confidence level
    if (tokenCount.isExact) {
      baseBuffer = 1.05; // 5% for official APIs
    } else if (tokenCount.method?.includes('enhanced')) {
      baseBuffer = 1.15; // 15% for enhanced estimation
    } else if (tokenCount.method?.includes('tiktoken')) {
      baseBuffer = 1.08; // 8% for tiktoken (very accurate)
    } else {
      baseBuffer = 1.25; // 25% for fallback estimation
    }
    
    // Provider-specific adjustments
    switch (provider) {
      case 'anthropic':
        // Claude output can be variable
        baseBuffer *= 1.1;
        break;
      case 'google':
        // Gemini is fairly consistent
        baseBuffer *= 1.0;
        break;
      case 'openai':
        // GPT models are well-calibrated
        baseBuffer *= 0.95;
        break;
    }
    
    // Additional buffer for image-heavy conversations
    if (tokenCount.breakdown?.imageTokens > 0) {
      const imageRatio = tokenCount.breakdown.imageTokens / tokenCount.inputTokens;
      if (imageRatio > 0.3) {
        baseBuffer *= 1.1; // 10% extra for image-heavy content
      }
    }
    
    return Math.round(baseBuffer * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Reserve credits for streaming operations with atomic transaction
   * @param {string} userId - User ID
   * @param {number} creditsToReserve - Amount to reserve
   * @param {Object} context - Reservation context
   * @returns {Promise<Object>} Reservation result
   */
  async reserveCredits(userId, creditsToReserve, context = {}) {
    const Transaction = this.sequelize.Transaction || require("sequelize").Transaction;
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      // Validate inputs
      if (!userId || typeof userId !== "string") {
        throw new Error("Invalid user ID");
      }

      if (!creditsToReserve || creditsToReserve <= 0) {
        throw new Error("Invalid credit amount");
      }

      if (creditsToReserve > 1000) {
        throw new Error("Credit reservation amount exceeds safety limit");
      }

      // Lock user record for atomic update
      const user = await this.User.findByPk(userId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const currentBalance = parseFloat(user.creditBalance || 0);

      // Check if user has sufficient credits
      if (currentBalance < creditsToReserve) {
        throw new Error(
          `Insufficient credits for reservation. Current: ${currentBalance}, Required: ${creditsToReserve}`
        );
      }

      // Calculate expiration (default 15 minutes for streaming)
      const expirationMinutes = context.expirationMinutes || 15;
      const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

      // Deduct credits from balance (temporarily)
      const newBalance = currentBalance - creditsToReserve;
      await user.update({ creditBalance: newBalance }, { transaction });

      // Create reservation record
      const reservation = await this.CreditReservation.create(
        {
          userId,
          conversationId: context.conversationId,
          messageId: context.messageId,
          creditsReserved: creditsToReserve,
          status: "active",
          reservationType: context.type || "streaming",
          context: {
            model: context.model,
            provider: context.provider,
            estimatedTokens: context.estimatedTokens,
            operationType: context.operationType,
            metadata: context.metadata || {}
          },
          expiresAt,
        },
        { transaction }
      );

      // Create audit log for reservation
      await this.CreditAuditLog.create(
        {
          userId,
          operation: "reserve",
          creditsAmount: creditsToReserve,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          relatedEntityType: "reservation",
          relatedEntityId: reservation.id,
          reason: `Credit reservation for ${context.type || 'streaming'}`,
          metadata: {
            reservationId: reservation.id,
            expiresAt: expiresAt.toISOString(),
            context: context
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        { transaction }
      );

      await transaction.commit();

      return {
        success: true,
        reservationId: reservation.id,
        creditsReserved: creditsToReserve,
        previousBalance: currentBalance,
        newBalance,
        expiresAt,
        reservationType: reservation.reservationType
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Settle a credit reservation with actual usage
   * @param {string} reservationId - Reservation ID
   * @param {number} actualCreditsUsed - Actual credits consumed
   * @param {Object} usageData - Usage data for settlement
   * @returns {Promise<Object>} Settlement result
   */
  async settleReservation(reservationId, actualCreditsUsed, usageData = {}) {
    const Transaction = this.sequelize.Transaction || require("sequelize").Transaction;
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      // Find and lock the reservation
      const reservation = await this.CreditReservation.findByPk(reservationId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!reservation) {
        throw new Error("Reservation not found");
      }

      if (reservation.status !== "active") {
        throw new Error(`Cannot settle reservation with status: ${reservation.status}`);
      }

      // Validate actual usage
      if (actualCreditsUsed < 0) {
        throw new Error("Actual credits used cannot be negative");
      }

      if (actualCreditsUsed > reservation.creditsReserved * 2) {
        console.warn(`Actual usage (${actualCreditsUsed}) significantly exceeds reservation (${reservation.creditsReserved})`);
      }

      // Lock user record
      const user = await this.User.findByPk(reservation.userId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const currentBalance = parseFloat(user.creditBalance || 0);
      const creditsToRefund = Math.max(0, reservation.creditsReserved - actualCreditsUsed);
      
      // Handle case where actual usage exceeds reservation
      let finalBalance;
      if (actualCreditsUsed > reservation.creditsReserved) {
        // Need to deduct additional credits
        const additionalCreditsNeeded = actualCreditsUsed - reservation.creditsReserved;
        finalBalance = currentBalance - additionalCreditsNeeded;
        console.log(`[SETTLEMENT DEBUG] Usage exceeded reservation by ${additionalCreditsNeeded} credits`);
      } else {
        // Normal case - refund unused credits
        finalBalance = currentBalance + creditsToRefund;
      }
      
      const newBalance = finalBalance;

      console.log(`[SETTLEMENT DEBUG] Reservation ${reservationId}:`);
      console.log(`[SETTLEMENT DEBUG] - Reserved: ${reservation.creditsReserved}`);
      console.log(`[SETTLEMENT DEBUG] - Actual used: ${actualCreditsUsed}`);
      console.log(`[SETTLEMENT DEBUG] - To refund: ${creditsToRefund}`);
      console.log(`[SETTLEMENT DEBUG] - Current balance: ${currentBalance}`);
      console.log(`[SETTLEMENT DEBUG] - New balance: ${newBalance}`);

      // Update user balance with refund
      await user.update({ creditBalance: newBalance }, { transaction });

      // Update reservation status
      await reservation.update(
        {
          status: "settled",
          actualCreditsUsed,
          settledAt: new Date(),
        },
        { transaction }
      );

      // Create settlement record
      const settlement = await this.ReservationSettlement.create(
        {
          reservationId: reservation.id,
          userId: reservation.userId,
          creditsReserved: parseFloat(reservation.creditsReserved),
          actualCreditsUsed: parseFloat(actualCreditsUsed),
          creditsRefunded: parseFloat(creditsToRefund),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          settlementType: actualCreditsUsed > reservation.creditsReserved ? "exceeded" : "completed",
          tokenUsageData: {
            inputTokens: usageData.inputTokens || 0,
            outputTokens: usageData.outputTokens || 0,
            totalTokens: (usageData.inputTokens || 0) + (usageData.outputTokens || 0),
            estimatedVsActual: {
              estimated: reservation.context?.estimatedTokens || 0,
              actual: (usageData.inputTokens || 0) + (usageData.outputTokens || 0)
            }
          },
          accuracyMetrics: this.calculateAccuracyMetrics(reservation, usageData),
          processingTime: usageData.processingTime,
        },
        { transaction }
      );

      // Create audit log for settlement
      let auditOperation, auditCreditsAmount, auditReason;
      
      if (actualCreditsUsed > reservation.creditsReserved) {
        // Usage exceeded reservation - we're deducting additional credits
        auditOperation = "deduct";
        auditCreditsAmount = actualCreditsUsed - reservation.creditsReserved;
        auditReason = `Reservation settlement - additional credits needed (usage exceeded reservation)`;
      } else {
        // Normal case - we're refunding unused credits
        auditOperation = "settle";
        auditCreditsAmount = creditsToRefund;
        auditReason = `Reservation settlement - refund unused credits`;
      }
      
      await this.CreditAuditLog.create(
        {
          userId: reservation.userId,
          operation: auditOperation,
          creditsAmount: auditCreditsAmount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          relatedEntityType: "reservation",
          relatedEntityId: reservation.id,
          reason: auditReason,
          metadata: {
            reservationId: reservation.id,
            settlementId: settlement.id,
            actualCreditsUsed,
            creditsRefunded: creditsToRefund,
            creditsReserved: reservation.creditsReserved,
            exceeded: actualCreditsUsed > reservation.creditsReserved,
            usageData
          },
        },
        { transaction }
      );

      await transaction.commit();

      return {
        success: true,
        reservationId: reservation.id,
        settlementId: settlement.id,
        creditsReserved: reservation.creditsReserved,
        actualCreditsUsed,
        creditsRefunded: creditsToRefund,
        previousBalance: currentBalance,
        newBalance,
        settlementType: settlement.settlementType,
        accuracyMetrics: settlement.accuracyMetrics
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Cancel an active reservation and refund all credits
   * @param {string} reservationId - Reservation ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelReservation(reservationId, reason = "Operation cancelled") {
    const Transaction = this.sequelize.Transaction || require("sequelize").Transaction;
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      // Find and lock the reservation
      const reservation = await this.CreditReservation.findByPk(reservationId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!reservation) {
        throw new Error("Reservation not found");
      }

      if (reservation.status !== "active") {
        throw new Error(`Cannot cancel reservation with status: ${reservation.status}`);
      }

      // Lock user record
      const user = await this.User.findByPk(reservation.userId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const currentBalance = parseFloat(user.creditBalance || 0);
      const newBalance = currentBalance + reservation.creditsReserved;

      // Refund all reserved credits
      await user.update({ creditBalance: newBalance }, { transaction });

      // Update reservation status
      await reservation.update(
        {
          status: "cancelled",
          errorReason: reason,
          settledAt: new Date(),
        },
        { transaction }
      );

      // Create audit log for cancellation
      await this.CreditAuditLog.create(
        {
          userId: reservation.userId,
          operation: "cancel",
          creditsAmount: reservation.creditsReserved,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          relatedEntityType: "reservation",
          relatedEntityId: reservation.id,
          reason: `Reservation cancelled: ${reason}`,
          metadata: {
            reservationId: reservation.id,
            creditsRefunded: reservation.creditsReserved,
            originalExpiresAt: reservation.expiresAt
          },
        },
        { transaction }
      );

      await transaction.commit();

      return {
        success: true,
        reservationId: reservation.id,
        creditsRefunded: reservation.creditsReserved,
        previousBalance: currentBalance,
        newBalance,
        reason
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get active reservations for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Active reservations
   */
  async getActiveReservations(userId, options = {}) {
    try {
      const whereClause = {
        userId,
        status: "active",
      };

      if (options.reservationType) {
        whereClause.reservationType = options.reservationType;
      }

      const reservations = await this.CreditReservation.findAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        limit: options.limit || 50,
        attributes: [
          "id",
          "creditsReserved",
          "reservationType",
          "context",
          "expiresAt",
          "createdAt",
        ],
      });

      return reservations.map(reservation => ({
        id: reservation.id,
        creditsReserved: parseFloat(reservation.creditsReserved),
        type: reservation.reservationType,
        context: reservation.context,
        expiresAt: reservation.expiresAt,
        createdAt: reservation.createdAt,
        isExpired: new Date() > reservation.expiresAt
      }));
    } catch (error) {
      throw new Error(`Failed to get active reservations: ${error.message}`);
    }
  }

  /**
   * Clean up expired reservations (to be called periodically)
   * @param {number} batchSize - Number of reservations to process
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredReservations(batchSize = 100) {
    const transaction = await this.sequelize.transaction();

    try {
      // Find expired active reservations
      const expiredReservations = await this.CreditReservation.findAll({
        where: {
          status: "active",
          expiresAt: {
            [Op.lt]: new Date(),
          },
        },
        limit: batchSize,
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      const results = {
        processed: 0,
        totalRefunded: 0,
        errors: []
      };

      for (const reservation of expiredReservations) {
        try {
          // Lock user record
          const user = await this.User.findByPk(reservation.userId, {
            lock: transaction.LOCK.UPDATE,
            transaction,
          });

          if (!user) {
            results.errors.push(`User not found for reservation ${reservation.id}`);
            continue;
          }

          const currentBalance = parseFloat(user.creditBalance || 0);
          const newBalance = currentBalance + reservation.creditsReserved;

          // Refund credits
          await user.update({ creditBalance: newBalance }, { transaction });

          // Update reservation status
          await reservation.update(
            {
              status: "expired",
              errorReason: "Reservation expired - credits refunded",
              settledAt: new Date(),
            },
            { transaction }
          );

          // Create audit log
          await this.CreditAuditLog.create(
            {
              userId: reservation.userId,
              operation: "expire_reservation",
              creditsAmount: reservation.creditsReserved,
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              relatedEntityType: "reservation",
              relatedEntityId: reservation.id,
              reason: "Expired reservation cleanup - credits refunded",
              metadata: {
                reservationId: reservation.id,
                expiredAt: new Date(),
                originalExpiresAt: reservation.expiresAt
              },
            },
            { transaction }
          );

          results.processed++;
          results.totalRefunded += reservation.creditsReserved;
        } catch (error) {
          results.errors.push(`Failed to process reservation ${reservation.id}: ${error.message}`);
        }
      }

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Calculate accuracy metrics for reservation settlement
   * @private
   */
  calculateAccuracyMetrics(reservation, usageData) {
    const estimatedTokens = reservation.context?.estimatedTokens || 0;
    const actualTokens = (usageData.inputTokens || 0) + (usageData.outputTokens || 0);
    
    if (estimatedTokens === 0) {
      return { accuracy: 'unknown', reason: 'no_estimation_data' };
    }

    const accuracy = actualTokens / estimatedTokens;
    const percentageError = Math.abs((actualTokens - estimatedTokens) / estimatedTokens) * 100;

    return {
      estimatedTokens,
      actualTokens,
      accuracy: Math.round(accuracy * 10000) / 10000, // 4 decimal places
      percentageError: Math.round(percentageError * 100) / 100, // 2 decimal places
      accuracyCategory: this.categorizeAccuracy(accuracy),
      estimationMethod: reservation.context?.tokenCountMethod || 'unknown'
    };
  }

  /**
   * Categorize estimation accuracy
   * @private
   */
  categorizeAccuracy(accuracy) {
    if (accuracy >= 0.9 && accuracy <= 1.1) return 'excellent';
    if (accuracy >= 0.8 && accuracy <= 1.2) return 'good';
    if (accuracy >= 0.7 && accuracy <= 1.3) return 'fair';
    return 'poor';
  }

  /**
   * Enhanced model pricing with caching and error handling
   * @override
   */
  async getModelPricing(modelName, provider) {
    try {
      // Try parent method first
      const pricing = await super.getModelPricing ? super.getModelPricing(modelName, provider) : null;
      if (pricing) {
        return pricing;
      }
    } catch (error) {
      console.warn('Database pricing lookup failed, using fallback:', error.message);
    }

    // Enhanced fallback with updated pricing
    return this.getEnhancedDefaultPricing(modelName, provider);
  }

  /**
   * Get enhanced default pricing with latest model prices
   * @private
   */
  getEnhancedDefaultPricing(modelName, provider) {
    const defaultPricing = {
      openai: {
        "gpt-4o-mini-2024-07-18": { input: 0.00015, output: 0.0006 },
        "gpt-4.1-2025-04-14": { input: 0.01, output: 0.03 },
        "o4-mini-2025-04-16": { input: 0.003, output: 0.012 },
        "chatgpt-4o-latest": { input: 0.0025, output: 0.01 },
        "gpt-4o-2024-08-06": { input: 0.0025, output: 0.01 },
        "gpt-4o": { input: 0.0025, output: 0.01 },
        "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
        "gpt-4-turbo": { input: 0.01, output: 0.03 },
        "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
      },
      anthropic: {
        "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
        "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
        "claude-3-7-sonnet-latest": { input: 0.003, output: 0.015 },
        "claude-3-5-haiku-latest": { input: 0.0008, output: 0.004 },
        "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
        "claude-3-5-haiku-20241022": { input: 0.0008, output: 0.004 },
        "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
      },
      google: {
        "gemini-2.5-pro-preview-05-06": { input: 0.00125, output: 0.005 },
        "gemini-2.5-flash-preview-05-20": { input: 0.000075, output: 0.0003 },
        "gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
        "gemini-2.0-flash-lite": { input: 0.000075, output: 0.0003 },
        "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
        "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
        "gemini-1.0-pro": { input: 0.0005, output: 0.0015 },
      },
    };

    const providerPricing = defaultPricing[provider];
    if (!providerPricing) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const modelPricing = providerPricing[modelName];
    if (!modelPricing) {
      console.warn(`Unknown model ${modelName} for ${provider}, using conservative default`);
      return {
        inputPricePer1k: 0.002, // Conservative default
        outputPricePer1k: 0.006,
      };
    }

    return {
      inputPricePer1k: modelPricing.input,
      outputPricePer1k: modelPricing.output,
    };
  }
}

module.exports = CreditService;
