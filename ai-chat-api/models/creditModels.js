const { DataTypes, Op } = require("sequelize");

// Credit system models with security constraints
function defineCreditModels(sequelize) {
  // Token Usage tracking with comprehensive constraints
  const TokenUsage = sequelize.define(
    "TokenUsage",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Conversations",
          key: "id",
        },
      },
      messageId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Messages",
          key: "id",
        },
      },
      modelProvider: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: [["openai", "anthropic", "google"]],
        },
      },
      modelName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      inputTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      outputTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      totalTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      inputCostUsd: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      outputCostUsd: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      totalCostUsd: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      creditsUsed: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      creditsCharged: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
        },
        comment: "Actual credits charged to user (rounded up from creditsUsed)",
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_token_usage_user_date_cost",
          fields: ["userId", "createdAt", "totalCostUsd"],
        },
        {
          name: "idx_token_usage_model_performance",
          fields: ["modelProvider", "modelName", "createdAt"],
        },
        {
          name: "idx_token_usage_recent",
          fields: ["createdAt"],
          // Removed WHERE clause with datetime() as it's non-deterministic
          // This index will now cover all records, which is still useful for performance
        },
        {
          name: "unq_message_tracking",
          unique: true,
          fields: ["messageId", "modelProvider"],
        },
      ],
      validate: {
        // Custom validation to ensure cost consistency
        costConsistency() {
          if (
            Math.abs(
              this.totalCostUsd - (this.inputCostUsd + this.outputCostUsd)
            ) > 0.00000001
          ) {
            throw new Error(
              "Total cost must equal input cost plus output cost"
            );
          }
        },
        // Validate token consistency
        tokenConsistency() {
          if (this.totalTokens !== this.inputTokens + this.outputTokens) {
            throw new Error(
              "Total tokens must equal input tokens plus output tokens"
            );
          }
        },
        // Validate creditsCharged is ceiling of creditsUsed
        creditChargeConsistency() {
          const expectedCharge = Math.ceil(this.creditsUsed);
          if (this.creditsCharged !== expectedCharge) {
            throw new Error(
              `Credits charged must be ceiling of credits used. Expected: ${expectedCharge}, Got: ${this.creditsCharged}`
            );
          }
        },
      },
    }
  );

  // Credit compensation tracking for failed transactions
  const CreditCompensation = sequelize.define(
    "CreditCompensation",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      messageId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Messages",
          key: "id",
        },
      },
      creditsToRefund: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "processed", "failed"]],
        },
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_compensation_pending",
          fields: ["status", "createdAt"],
          where: {
            status: "pending",
          },
        },
        {
          name: "idx_compensation_user_date",
          fields: ["userId", "createdAt"],
        },
      ],
    }
  );

  // Comprehensive audit log for all credit operations
  const CreditAuditLog = sequelize.define(
    "CreditAuditLog",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      operation: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: [["deduct", "refund", "refresh", "purchase", "adjustment", "reserve", "settle", "cancel"]],
        },
      },
      creditsAmount: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      balanceBefore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      relatedEntityType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
          isIn: [
            [
              "message",
              "conversation",
              "purchase",
              "subscription",
              "compensation",
              "reservation",
              "settlement",
            ],
          ],
        },
      },
      relatedEntityId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_credit_audit_user_date",
          fields: ["userId", "createdAt"],
        },
        {
          name: "idx_credit_audit_operation",
          fields: ["operation", "createdAt"],
        },
        {
          name: "idx_credit_audit_entity",
          fields: ["relatedEntityType", "relatedEntityId"],
        },
      ],
      validate: {
        // Validate balance calculation
        balanceCalculation() {
          let expectedBalance;
          
          // Handle different operation types
          if (this.operation === "deduct" || this.operation === "reserve") {
            // Both deduct and reserve operations reduce the balance
            expectedBalance = this.balanceBefore - this.creditsAmount;
          } else if (this.operation === "cancel") {
            // For cancellations, credits are added back to balance
            expectedBalance = this.balanceBefore + this.creditsAmount;
          } else {
            // For refund, refresh, purchase, adjustment, settle
            expectedBalance = this.balanceBefore + this.creditsAmount;
          }

          if (Math.abs(this.balanceAfter - expectedBalance) > 0.0001) {
            throw new Error("Balance calculation mismatch in audit log");
          }
        },
      },
    }
  );

  // Credit refresh history tracking
  const CreditRefreshHistory = sequelize.define(
    "CreditRefreshHistory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      oldBalance: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: -1000, // Allow some negative balance for edge cases
        },
      },
      creditsAdded: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      newBalance: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      refreshType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: [
            [
              "initial",
              "monthly",
              "subscription_renewal",
              "fallback_monthly",
              "manual",
            ],
          ],
        },
      },
      refreshDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_refresh_history_user_date",
          fields: ["userId", "refreshDate"],
        },
        {
          name: "idx_refresh_history_type",
          fields: ["refreshType", "refreshDate"],
        },
      ],
      validate: {
        // Validate refresh calculation
        refreshCalculation() {
          if (
            Math.abs(this.newBalance - (this.oldBalance + this.creditsAdded)) >
            0.0001
          ) {
            throw new Error("Credit refresh calculation mismatch");
          }
        },
      },
    }
  );

  // Dynamic model pricing with versioning
  const ModelPricing = sequelize.define(
    "ModelPricing",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      modelName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: [["openai", "anthropic", "google"]],
        },
      },
      inputPricePer1k: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      outputPricePer1k: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      effectiveDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      deprecatedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_model_pricing_lookup",
          fields: ["modelName", "provider", "effectiveDate"],
        },
        {
          name: "idx_model_pricing_active",
          fields: ["effectiveDate", "deprecatedDate"],
        },
      ],
      validate: {
        // Ensure effective date is before deprecated date
        dateConsistency() {
          if (
            this.deprecatedDate &&
            this.effectiveDate >= this.deprecatedDate
          ) {
            throw new Error("Effective date must be before deprecated date");
          }
        },
      },
    }
  );

  // Token usage archive table (same structure as TokenUsage)
  const TokenUsageArchive = sequelize.define(
    "TokenUsageArchive",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      userId: DataTypes.UUID,
      conversationId: DataTypes.UUID,
      messageId: DataTypes.UUID,
      modelProvider: DataTypes.STRING(50),
      modelName: DataTypes.STRING(100),
      inputTokens: DataTypes.INTEGER,
      outputTokens: DataTypes.INTEGER,
      totalTokens: DataTypes.INTEGER,
      inputCostUsd: DataTypes.DECIMAL(10, 8),
      outputCostUsd: DataTypes.DECIMAL(10, 8),
      totalCostUsd: DataTypes.DECIMAL(10, 8),
      creditsUsed: DataTypes.DECIMAL(10, 4),
      archivedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
      tableName: "TokenUsageArchive",
    }
  );

  return {
    TokenUsage,
    CreditCompensation,
    CreditAuditLog,
    CreditRefreshHistory,
    ModelPricing,
    TokenUsageArchive,
  };
}

module.exports = { defineCreditModels };
