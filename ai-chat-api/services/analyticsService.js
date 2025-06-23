const { Op } = require("sequelize");

class AnalyticsService {
  constructor(models) {
    this.models = models;
  }

  /**
   * Get usage statistics for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} User usage statistics
   */
  async getUserUsage(userId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days
      endDate = new Date(),
      groupBy = "day"
    } = options;

    try {
      // Get total usage
      const totalUsage = await this.models.TokenUsage.findOne({
        where: {
          userId,
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("inputTokens")), "totalInputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("outputTokens")), "totalOutputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "totalCreditsUsed"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("totalCostUsd")), "totalCostUsd"]
        ],
        raw: true
      });

      // Get usage by model
      const usageByModel = await this.models.TokenUsage.findAll({
        where: {
          userId,
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          "modelName",
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("inputTokens")), "inputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("outputTokens")), "outputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "creditsUsed"]
        ],
        group: ["modelName"],
        raw: true
      });

      // Get usage over time
      const timeGrouping = this.getTimeGrouping(groupBy);
      const usageOverTime = await this.models.TokenUsage.findAll({
        where: {
          userId,
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          [this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt")), "date"],
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "creditsUsed"]
        ],
        group: [this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt"))],
        order: [[this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt")), "ASC"]],
        raw: true
      });

      // Get current user with credit balance
      const user = await this.models.User.findOne({
        where: { id: userId },
        attributes: ["creditBalance"],
        raw: true
      });

      // Get recent credit transactions (if available)
      // Note: CreditTransaction might not exist, so we'll provide empty array
      const recentTransactions = [];

      return {
        userId,
        period: {
          startDate,
          endDate
        },
        summary: {
          totalRequests: parseInt(totalUsage?.requestCount || 0),
          totalInputTokens: parseInt(totalUsage?.totalInputTokens || 0),
          totalOutputTokens: parseInt(totalUsage?.totalOutputTokens || 0),
          totalCreditsUsed: parseFloat(totalUsage?.totalCreditsUsed || 0),
          totalCostUsd: parseFloat(totalUsage?.totalCostUsd || 0),
          currentBalance: parseFloat(user?.creditBalance || 0)
        },
        usageByModel,
        usageOverTime,
        recentTransactions
      };
    } catch (error) {
      console.error("Error getting user usage:", error);
      throw error;
    }
  }

  /**
   * Get system-wide usage statistics (admin only)
   * @param {Object} options - Query options
   * @returns {Object} System usage statistics
   */
  async getSystemUsage(options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 100
    } = options;

    try {
      // Get total system usage
      const totalUsage = await this.models.TokenUsage.findOne({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("COUNT", this.models.sequelize.fn("DISTINCT", this.models.sequelize.col("userId"))), "activeUsers"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("inputTokens")), "totalInputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("outputTokens")), "totalOutputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "totalCreditsUsed"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("totalCostUsd")), "totalRevenue"]
        ],
        raw: true
      });

      // Get top users by usage
      const topUsers = await this.models.TokenUsage.findAll({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          "userId",
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "creditsUsed"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("totalCostUsd")), "totalCostUsd"]
        ],
        group: ["userId"],
        order: [[this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "DESC"]],
        limit: 10,
        raw: true
      });

      // Enhance top users with user details
      const userIds = topUsers.map(u => u.userId);
      const users = await this.models.User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ["id", "email", "username", "subscriptionTier"],
        raw: true
      });
      const userMap = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      const enhancedTopUsers = topUsers.map(usage => ({
        ...usage,
        userDetails: userMap[usage.userId] || { email: "Unknown" }
      }));

      // Get usage by model
      const usageByModel = await this.models.TokenUsage.findAll({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          "modelName",
          "modelProvider",
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("inputTokens")), "inputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("outputTokens")), "outputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "creditsUsed"]
        ],
        group: ["modelName", "modelProvider"],
        order: [[this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "DESC"]],
        raw: true
      });

      // Get daily usage trend
      const dailyUsage = await this.models.TokenUsage.findAll({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          [this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt")), "date"],
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requests"],
          [this.models.sequelize.fn("COUNT", this.models.sequelize.fn("DISTINCT", this.models.sequelize.col("userId"))), "activeUsers"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "creditsUsed"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("totalCostUsd")), "revenue"]
        ],
        group: [this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt"))],
        order: [[this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt")), "ASC"]],
        raw: true
      });

      // Get compensation metrics
      const compensationMetrics = await this.models.CreditCompensation.findOne({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "totalCompensations"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsToRefund")), "totalCreditsRefunded"],
          [this.models.sequelize.fn("COUNT", this.models.sequelize.literal("CASE WHEN status = 'processed' THEN 1 END")), "processedCount"],
          [this.models.sequelize.fn("COUNT", this.models.sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")), "pendingCount"]
        ],
        raw: true
      });

      return {
        period: {
          startDate,
          endDate
        },
        summary: {
          totalRequests: parseInt(totalUsage?.requestCount || 0),
          activeUsers: parseInt(totalUsage?.activeUsers || 0),
          totalInputTokens: parseInt(totalUsage?.totalInputTokens || 0),
          totalOutputTokens: parseInt(totalUsage?.totalOutputTokens || 0),
          totalCreditsUsed: parseFloat(totalUsage?.totalCreditsUsed || 0),
          totalRevenue: parseFloat(totalUsage?.totalRevenue || 0),
          averageCreditsPerRequest: totalUsage?.requestCount > 0 
            ? (parseFloat(totalUsage?.totalCreditsUsed || 0) / parseInt(totalUsage?.requestCount || 1)).toFixed(2)
            : 0
        },
        topUsers: enhancedTopUsers,
        usageByModel,
        dailyUsage,
        compensationMetrics: {
          total: parseInt(compensationMetrics?.totalCompensations || 0),
          creditsRefunded: parseFloat(compensationMetrics?.totalCreditsRefunded || 0),
          processed: parseInt(compensationMetrics?.processedCount || 0),
          pending: parseInt(compensationMetrics?.pendingCount || 0)
        }
      };
    } catch (error) {
      console.error("Error getting system usage:", error);
      throw error;
    }
  }

  /**
   * Get detailed usage for all users (paginated)
   * @param {Object} options - Query options
   * @returns {Object} Paginated user usage data
   */
  async getAllUsersUsage(options = {}) {
    const {
      page = 1,
      limit = 50,
      sortBy = "creditsUsed",
      sortOrder = "DESC",
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      searchTerm = ""
    } = options;

    const offset = (page - 1) * limit;

    try {
      // Build user search condition
      const userSearchCondition = searchTerm ? {
        [Op.or]: [
          { email: { [Op.like]: `%${searchTerm}%` } },
          { username: { [Op.like]: `%${searchTerm}%` } }
        ]
      } : {};

      // Get ALL users matching search criteria with pagination
      const { count: totalCount, rows: allUsers } = await this.models.User.findAndCountAll({
        where: userSearchCondition,
        attributes: ["id", "email", "username", "subscriptionTier", "createdAt", "creditBalance"],
        limit,
        offset,
        order: [["createdAt", "DESC"]], // Default order by creation date
        raw: true
      });

      const userIds = allUsers.map(u => u.id);

      // Get usage data for these users (if any)
      const usageData = await this.models.TokenUsage.findAll({
        where: {
          userId: { [Op.in]: userIds },
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          "userId",
          [this.models.sequelize.fn("COUNT", this.models.sequelize.col("id")), "requestCount"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("inputTokens")), "inputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("outputTokens")), "outputTokens"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("creditsUsed")), "creditsUsed"],
          [this.models.sequelize.fn("SUM", this.models.sequelize.col("totalCostUsd")), "totalCostUsd"],
          [this.models.sequelize.fn("MAX", this.models.sequelize.col("createdAt")), "lastActivity"]
        ],
        group: ["userId"],
        raw: true
      });

      // Create usage lookup map
      const usageMap = usageData.reduce((acc, usage) => {
        acc[usage.userId] = usage;
        return acc;
      }, {});

      // Combine all users with their usage data (if exists)
      const enhancedUsageData = allUsers.map(user => ({
        userId: user.id,
        user: {
          email: user.email,
          username: user.username,
          subscriptionTier: user.subscriptionTier,
          createdAt: user.createdAt
        },
        usage: usageMap[user.id] ? {
          requestCount: parseInt(usageMap[user.id].requestCount || 0),
          inputTokens: parseInt(usageMap[user.id].inputTokens || 0),
          outputTokens: parseInt(usageMap[user.id].outputTokens || 0),
          creditsUsed: parseFloat(usageMap[user.id].creditsUsed || 0),
          totalCostUsd: parseFloat(usageMap[user.id].totalCostUsd || 0),
          lastActivity: usageMap[user.id].lastActivity
        } : {
          requestCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          creditsUsed: 0,
          totalCostUsd: 0,
          lastActivity: null
        },
        creditBalance: {
          current: parseFloat(user.creditBalance || 0),
          lifetime: usageMap[user.id] ? parseFloat(usageMap[user.id].creditsUsed || 0) : 0
        }
      }));

      // Sort results based on sortBy parameter
      if (sortBy !== "createdAt") {
        enhancedUsageData.sort((a, b) => {
          let aValue, bValue;
          
          if (sortBy === "requestCount" || sortBy === "creditsUsed" || sortBy === "inputTokens" || sortBy === "outputTokens" || sortBy === "totalCostUsd") {
            aValue = a.usage[sortBy];
            bValue = b.usage[sortBy];
          } else if (sortBy === "creditBalance") {
            aValue = a.creditBalance.current;
            bValue = b.creditBalance.current;
          } else {
            aValue = 0;
            bValue = 0;
          }
          
          return sortOrder === "DESC" ? bValue - aValue : aValue - bValue;
        });
      }

      return {
        data: enhancedUsageData,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        filters: {
          startDate,
          endDate,
          searchTerm,
          sortBy,
          sortOrder
        }
      };
    } catch (error) {
      console.error("Error getting all users usage:", error);
      throw error;
    }
  }

  /**
   * Export usage data in various formats
   * @param {string} format - Export format (csv, json)
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  async exportUsageData(format = "csv", options = {}) {
    const {
      userId = null,
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = options;

    try {
      // Build query conditions
      const whereConditions = {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      };
      if (userId) {
        whereConditions.userId = userId;
      }

      // Get raw usage data
      const usageData = await this.models.TokenUsage.findAll({
        where: whereConditions,
        order: [["createdAt", "DESC"]],
        raw: true
      });
      
      // Get user details separately
      const userIds = [...new Set(usageData.map(d => d.userId))];
      const users = await this.models.User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ["id", "email", "username"],
        raw: true
      });
      const userMap = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
      
      // Enhance usage data with user info
      const enhancedUsageData = usageData.map(record => ({
        ...record,
        userEmail: userMap[record.userId]?.email || "Unknown",
        username: userMap[record.userId]?.username || "Unknown"
      }));

      if (format === "json") {
        return {
          exportDate: new Date(),
          period: { startDate, endDate },
          recordCount: enhancedUsageData.length,
          data: enhancedUsageData
        };
      } else if (format === "csv") {
        // Convert to CSV format
        const headers = [
          "Date",
          "User Email",
          "Conversation ID",
          "Model",
          "Provider",
          "Input Tokens",
          "Output Tokens",
          "Credits Used",
          "Credits Paid",
          "Token Method",
          "Success"
        ];

        const rows = enhancedUsageData.map(record => [
          record.createdAt,
          record.userEmail,
          record.conversationId,
          record.modelName,
          record.modelProvider,
          record.inputTokens,
          record.outputTokens,
          record.creditsUsed,
          record.totalCostUsd,
          record.tokenCountMethod || "unknown",
          record.success !== false ? "Yes" : "No"
        ]);

        return {
          headers,
          rows,
          csv: this.convertToCSV(headers, rows)
        };
      }
    } catch (error) {
      console.error("Error exporting usage data:", error);
      throw error;
    }
  }

  /**
   * Helper function to convert data to CSV format
   */
  convertToCSV(headers, rows) {
    const csvHeaders = headers.join(",");
    const csvRows = rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell || "");
        if (cellStr.includes(",") || cellStr.includes('"')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(",")
    );
    return [csvHeaders, ...csvRows].join("\n");
  }

  /**
   * Helper function to determine time grouping
   */
  getTimeGrouping(groupBy) {
    switch (groupBy) {
      case "hour":
        return this.models.sequelize.fn("DATETIME", 
          this.models.sequelize.fn("STRFTIME", "%Y-%m-%d %H:00:00", 
            this.models.sequelize.col("createdAt")));
      case "day":
      default:
        return this.models.sequelize.fn("DATE", this.models.sequelize.col("createdAt"));
      case "week":
        return this.models.sequelize.fn("DATE", 
          this.models.sequelize.fn("STRFTIME", "%Y-%W", 
            this.models.sequelize.col("createdAt")));
      case "month":
        return this.models.sequelize.fn("DATE", 
          this.models.sequelize.fn("STRFTIME", "%Y-%m-01", 
            this.models.sequelize.col("createdAt")));
    }
  }
}

module.exports = AnalyticsService;