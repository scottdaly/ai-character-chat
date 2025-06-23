# Token Usage & Credit System Implementation Plan

## Overview

This document outlines the implementation of a token usage tracking and credit-based billing system for the AI Character Chat application. The system will track token consumption across different AI providers and convert usage into credits based on real-time model pricing.

## Current State Analysis

### Existing Infrastructure

- Multi-provider AI integration (OpenAI, Anthropic, Google AI)
- Subscription tiers (Free, Pro)
- Message storage with conversation trees
- Stripe integration for billing

### Limitations

- No token usage tracking
- Binary access control (limited characters vs unlimited)
- No usage-based billing granularity

## Token Tracking Requirements

### 1. Provider-Specific Token Counting

#### OpenAI

```javascript
// Response includes usage data
{
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 75,
    "total_tokens": 225
  }
}
```

#### Anthropic (Claude)

```javascript
// Response includes usage data
{
  "usage": {
    "input_tokens": 150,
    "output_tokens": 75
  }
}
```

#### Google AI

```javascript
// Response includes usage metadata
{
  "usageMetadata": {
    "promptTokenCount": 150,
    "candidatesTokenCount": 75,
    "totalTokenCount": 225
  }
}
```

### 2. Token Tracking Database Schema

```sql
-- New table for tracking token usage
CREATE TABLE TokenUsage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES Users(id),
  conversationId UUID NOT NULL REFERENCES Conversations(id),
  messageId UUID NOT NULL REFERENCES Messages(id),
  modelProvider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google'
  modelName VARCHAR(100) NOT NULL,    -- 'gpt-4', 'claude-3-sonnet', etc.
  inputTokens INTEGER NOT NULL,
  outputTokens INTEGER NOT NULL,
  totalTokens INTEGER NOT NULL,
  inputCostUsd DECIMAL(10, 8) NOT NULL,  -- Cost in USD for input tokens
  outputCostUsd DECIMAL(10, 8) NOT NULL, -- Cost in USD for output tokens
  totalCostUsd DECIMAL(10, 8) NOT NULL,  -- Total cost in USD
  creditsUsed DECIMAL(10, 4) NOT NULL,   -- Credits deducted
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Critical constraints for data integrity
  CONSTRAINT chk_positive_tokens CHECK (inputTokens >= 0 AND outputTokens >= 0 AND totalTokens >= 0),
  CONSTRAINT chk_cost_consistency CHECK (totalCostUsd = inputCostUsd + outputCostUsd),
  CONSTRAINT chk_credits_positive CHECK (creditsUsed >= 0),
  CONSTRAINT unq_message_tracking UNIQUE (messageId, modelProvider),

  -- Foreign key constraints with proper cascading
  CONSTRAINT fk_token_usage_user FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_token_usage_conversation FOREIGN KEY (conversationId) REFERENCES Conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_token_usage_message FOREIGN KEY (messageId) REFERENCES Messages(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_token_usage_user_date_cost ON TokenUsage(userId, createdAt, totalCostUsd);
CREATE INDEX idx_token_usage_model_performance ON TokenUsage(modelProvider, modelName, createdAt);
CREATE INDEX idx_token_usage_recent ON TokenUsage(createdAt)
  WHERE createdAt > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- User credit balance tracking with constraints
ALTER TABLE Users ADD COLUMN creditBalance DECIMAL(10, 4) DEFAULT 0.0;
ALTER TABLE Users ADD COLUMN totalCreditsUsed DECIMAL(10, 4) DEFAULT 0.0;
ALTER TABLE Users ADD COLUMN lastCreditRefresh TIMESTAMP;
ALTER TABLE Users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';

-- Credit balance constraint (allow small negative balance for edge cases)
ALTER TABLE Users ADD CONSTRAINT chk_credit_balance_not_negative
  CHECK (creditBalance >= -100);

-- Performance indexes for users
CREATE INDEX idx_users_credit_balance ON Users(creditBalance) WHERE creditBalance < 1000;
CREATE INDEX idx_users_subscription_tier ON Users(subscriptionTier, lastCreditRefresh);

-- Credit compensation tracking table
CREATE TABLE CreditCompensations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES Users(id),
  messageId UUID NOT NULL REFERENCES Messages(id),
  creditsToRefund DECIMAL(10, 4) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processedAt TIMESTAMP NULL,

  INDEX idx_compensation_pending (status, createdAt) WHERE status = 'pending'
);

-- Credit operation audit trail
CREATE TABLE CreditAuditLog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES Users(id),
  operation VARCHAR(50) NOT NULL, -- 'deduct', 'refund', 'refresh', 'purchase'
  creditsAmount DECIMAL(10, 4) NOT NULL,
  balanceBefore DECIMAL(10, 4) NOT NULL,
  balanceAfter DECIMAL(10, 4) NOT NULL,
  relatedEntityType VARCHAR(50), -- 'message', 'conversation', 'purchase'
  relatedEntityId UUID,
  reason TEXT,
  metadata JSONB,
  ipAddress INET,
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_credit_audit_user_date (userId, createdAt),
  INDEX idx_credit_audit_operation (operation, createdAt)
);

-- Credit refresh history tracking
CREATE TABLE CreditRefreshHistory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES Users(id),
  oldBalance DECIMAL(10, 4) NOT NULL,
  creditsAdded DECIMAL(10, 4) NOT NULL,
  newBalance DECIMAL(10, 4) NOT NULL,
  refreshType VARCHAR(50) NOT NULL, -- 'initial', 'monthly', 'subscription_renewal'
  refreshDate TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_refresh_history_user_date (userId, refreshDate)
);

-- Dynamic model pricing table
CREATE TABLE ModelPricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modelName VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  inputPricePer1k DECIMAL(10, 8) NOT NULL,
  outputPricePer1k DECIMAL(10, 8) NOT NULL,
  effectiveDate TIMESTAMP NOT NULL,
  deprecatedDate TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_model_pricing_lookup (modelName, provider, effectiveDate),
  INDEX idx_model_pricing_active (effectiveDate, deprecatedDate)
);

-- Insert initial pricing data
INSERT INTO ModelPricing (modelName, provider, inputPricePer1k, outputPricePer1k, effectiveDate) VALUES
  ('gpt-4', 'openai', 0.03, 0.06, CURRENT_TIMESTAMP),
  ('gpt-4-turbo', 'openai', 0.01, 0.03, CURRENT_TIMESTAMP),
  ('gpt-3.5-turbo', 'openai', 0.001, 0.002, CURRENT_TIMESTAMP),
  ('claude-3-sonnet-20240229', 'anthropic', 0.003, 0.015, CURRENT_TIMESTAMP),
  ('claude-3-haiku-20240307', 'anthropic', 0.00025, 0.00125, CURRENT_TIMESTAMP),
  ('gemini-pro', 'google', 0.00025, 0.0005, CURRENT_TIMESTAMP),
  ('gemini-1.5-pro', 'google', 0.00125, 0.00375, CURRENT_TIMESTAMP);

-- Token usage archive table for data retention
CREATE TABLE TokenUsageArchive (
  LIKE TokenUsage INCLUDING ALL
);
```

## Credit Calculation System

### 1. Dynamic Model Pricing Configuration

```javascript
// services/pricingService.js - Dynamic pricing with database lookup
class PricingService {
  static async getCurrentPricing(modelName, provider) {
    const pricing = await ModelPricing.findOne({
      where: {
        modelName,
        provider,
        effectiveDate: { [Op.lte]: new Date() },
        [Op.or]: [
          { deprecatedDate: null },
          { deprecatedDate: { [Op.gt]: new Date() } },
        ],
      },
      order: [["effectiveDate", "DESC"]],
    });

    if (!pricing) {
      throw new Error(
        `Pricing not found for model: ${modelName} (${provider})`
      );
    }

    return {
      input: pricing.inputPricePer1k,
      output: pricing.outputPricePer1k,
    };
  }

  static async updateModelPricing(
    modelName,
    provider,
    inputPrice,
    outputPrice
  ) {
    // Deprecate current pricing
    await ModelPricing.update(
      { deprecatedDate: new Date() },
      {
        where: {
          modelName,
          provider,
          deprecatedDate: null,
        },
      }
    );

    // Create new pricing entry
    await ModelPricing.create({
      modelName,
      provider,
      inputPricePer1k: inputPrice,
      outputPricePer1k: outputPrice,
      effectiveDate: new Date(),
    });
  }
}

// Credit conversion rate: 1 credit = $0.001
const CREDIT_TO_USD_RATE = 0.001;

async function calculateCreditsFromTokens(
  modelName,
  provider,
  inputTokens,
  outputTokens
) {
  const pricing = await PricingService.getCurrentPricing(modelName, provider);

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    inputCostUsd: inputCost,
    outputCostUsd: outputCost,
    totalCostUsd: totalCost,
    creditsUsed: totalCost / CREDIT_TO_USD_RATE,
  };
}
```

### 2. Secure Token Tracking Service

```javascript
// services/tokenTracker.js
class TokenTracker {
  static async trackUsage(
    userId,
    conversationId,
    messageId,
    modelProvider,
    modelName,
    usage,
    ipAddress,
    userAgent
  ) {
    const transaction = await sequelize.transaction();

    try {
      const tokenData = this.extractTokenData(modelProvider, usage);
      const costData = await calculateCreditsFromTokens(
        modelName,
        modelProvider,
        tokenData.inputTokens,
        tokenData.outputTokens
      );

      // Record usage
      const tokenUsage = await TokenUsage.create(
        {
          userId,
          conversationId,
          messageId,
          modelProvider,
          modelName,
          inputTokens: tokenData.inputTokens,
          outputTokens: tokenData.outputTokens,
          totalTokens: tokenData.inputTokens + tokenData.outputTokens,
          ...costData,
        },
        { transaction }
      );

      // Deduct credits with audit trail
      await this.deductCreditsSecure(userId, costData.creditsUsed, {
        relatedEntityType: "message",
        relatedEntityId: messageId,
        reason: `AI message generation (${modelName})`,
        ipAddress,
        userAgent,
        transaction,
      });

      await transaction.commit();
      return tokenUsage;
    } catch (error) {
      await transaction.rollback();

      // Record compensation for failed transaction
      await CreditCompensationService.recordFailedTransaction(
        userId,
        messageId,
        0, // No credits were actually deducted due to rollback
        `Token tracking failed: ${error.message}`
      );

      throw error;
    }
  }

  static extractTokenData(provider, usage) {
    switch (provider) {
      case "openai":
        return {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
        };
      case "anthropic":
        return {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
        };
      case "google":
        return {
          inputTokens: usage.promptTokenCount || 0,
          outputTokens: usage.candidatesTokenCount || 0,
        };
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // SECURE credit deduction with atomic operations
  static async deductCreditsSecure(userId, creditsUsed, auditData) {
    const { transaction, ...auditInfo } = auditData;

    // Get current balance for audit
    const user = await User.findByPk(userId, { transaction });
    const balanceBefore = user.creditBalance;

    // Atomic credit deduction with validation
    const [updatedRows] = await User.update(
      {
        creditBalance: sequelize.literal(`creditBalance - ${creditsUsed}`),
        totalCreditsUsed: sequelize.literal(
          `totalCreditsUsed + ${creditsUsed}`
        ),
      },
      {
        where: {
          id: userId,
          creditBalance: { [Op.gte]: creditsUsed }, // Ensure sufficient balance
        },
        transaction,
      }
    );

    if (updatedRows === 0) {
      throw new Error("Insufficient credits");
    }

    // Create audit log entry
    await CreditAuditLog.create(
      {
        userId,
        operation: "deduct",
        creditsAmount: creditsUsed,
        balanceBefore,
        balanceAfter: balanceBefore - creditsUsed,
        ...auditInfo,
      },
      { transaction }
    );
  }

  static async checkSufficientCredits(userId, estimatedCredits) {
    const user = await User.findByPk(userId);
    return user.creditBalance >= estimatedCredits;
  }

  // Estimate credits for pre-validation
  static async estimateCredits(
    content,
    modelName,
    provider,
    hasAttachments = false
  ) {
    // Simple token estimation (approximate)
    const estimatedInputTokens =
      Math.ceil(content.length / 4) + (hasAttachments ? 1000 : 0);
    const estimatedOutputTokens = Math.min(estimatedInputTokens * 0.5, 1000); // Conservative estimate

    const costData = await calculateCreditsFromTokens(
      modelName,
      provider,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    return costData.creditsUsed;
  }
}

// Credit compensation service for handling failures
class CreditCompensationService {
  static async recordFailedTransaction(userId, messageId, creditsUsed, reason) {
    await CreditCompensations.create({
      userId,
      messageId,
      creditsToRefund: creditsUsed,
      reason,
    });

    // Immediate refund for critical failures
    if (
      reason.includes("ai_service_failure") ||
      reason.includes("system_error")
    ) {
      await this.processRefund(userId, creditsUsed, reason);
    }
  }

  static async processRefund(userId, credits, reason) {
    if (credits <= 0) return;

    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId, { transaction });
      const balanceBefore = user.creditBalance;

      await user.update(
        {
          creditBalance: user.creditBalance + credits,
        },
        { transaction }
      );

      // Create audit log
      await CreditAuditLog.create(
        {
          userId,
          operation: "refund",
          creditsAmount: credits,
          balanceBefore,
          balanceAfter: balanceBefore + credits,
          relatedEntityType: "compensation",
          reason,
        },
        { transaction }
      );

      await transaction.commit();
      console.log(`Refunded ${credits} credits to user ${userId}: ${reason}`);
    } catch (error) {
      await transaction.rollback();
      console.error(`Failed to process refund for user ${userId}:`, error);
      throw error;
    }
  }

  // Process pending compensations (run via cron job)
  static async processPendingCompensations() {
    const pendingCompensations = await CreditCompensations.findAll({
      where: { status: "pending" },
      limit: 100,
    });

    for (const compensation of pendingCompensations) {
      try {
        await this.processRefund(
          compensation.userId,
          compensation.creditsToRefund,
          compensation.reason
        );

        await compensation.update({
          status: "processed",
          processedAt: new Date(),
        });
      } catch (error) {
        console.error(
          `Failed to process compensation ${compensation.id}:`,
          error
        );
        await compensation.update({ status: "failed" });
      }
    }
  }
}
```

## Subscription Tier Credit Allocations

### 1. Tier Definitions

```javascript
const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    monthlyCredits: 1000, // ~$1.00 worth of usage
    creditRefreshDay: 1, // Refresh on 1st of month
    features: {
      characterLimit: 3,
      conversationLimit: null,
      prioritySupport: false,
    },
  },
  pro: {
    name: "Pro",
    monthlyCredits: 20000, // ~$20.00 worth of usage
    creditRefreshDay: null, // Refresh on subscription anniversary
    features: {
      characterLimit: null,
      conversationLimit: null,
      prioritySupport: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    monthlyCredits: 100000, // ~$100.00 worth of usage
    creditRefreshDay: null,
    features: {
      characterLimit: null,
      conversationLimit: null,
      prioritySupport: true,
      customModels: true,
    },
  },
};
```

### 2. Robust Credit Refresh System

```javascript
// services/creditRefresh.js
class CreditRefreshService {
  static async refreshUserCredits(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: StripeSubscription }], // Include subscription data
    });

    const tierConfig = SUBSCRIPTION_TIERS[user.subscriptionTier];
    if (!tierConfig) return;

    const now = new Date();
    const shouldRefresh = await this.shouldRefreshCredits(
      user,
      tierConfig,
      now
    );

    if (shouldRefresh.refresh) {
      const transaction = await sequelize.transaction();

      try {
        const balanceBefore = user.creditBalance;
        const newBalance = user.creditBalance + shouldRefresh.creditsToAdd;

        // Record the refresh event
        await CreditRefreshHistory.create(
          {
            userId,
            oldBalance: balanceBefore,
            creditsAdded: shouldRefresh.creditsToAdd,
            newBalance,
            refreshType: shouldRefresh.type,
            refreshDate: now,
          },
          { transaction }
        );

        // Update user balance
        await user.update(
          {
            creditBalance: newBalance,
            lastCreditRefresh: now,
          },
          { transaction }
        );

        // Create audit log
        await CreditAuditLog.create(
          {
            userId,
            operation: "refresh",
            creditsAmount: shouldRefresh.creditsToAdd,
            balanceBefore,
            balanceAfter: newBalance,
            relatedEntityType: "subscription",
            reason: `Credit refresh: ${shouldRefresh.type}`,
          },
          { transaction }
        );

        await transaction.commit();

        console.log(
          `Refreshed ${shouldRefresh.creditsToAdd} credits for user ${userId} (${shouldRefresh.type})`
        );
      } catch (error) {
        await transaction.rollback();
        console.error(`Failed to refresh credits for user ${userId}:`, error);
        throw error;
      }
    }
  }

  static async shouldRefreshCredits(user, tierConfig, now) {
    // Handle first-time users
    if (!user.lastCreditRefresh) {
      return {
        refresh: true,
        creditsToAdd: tierConfig.monthlyCredits,
        type: "initial",
      };
    }

    const lastRefresh = new Date(user.lastCreditRefresh);

    if (tierConfig.creditRefreshDay) {
      // Free tier - monthly refresh on specific day with timezone handling
      const userTimezone = user.timezone || "UTC";
      const nowInUserTz = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone })
      );
      const lastRefreshInUserTz = new Date(
        lastRefresh.toLocaleString("en-US", { timeZone: userTimezone })
      );

      const isNewMonth =
        nowInUserTz.getMonth() !== lastRefreshInUserTz.getMonth() ||
        nowInUserTz.getFullYear() !== lastRefreshInUserTz.getFullYear();

      if (isNewMonth && nowInUserTz.getDate() >= tierConfig.creditRefreshDay) {
        return {
          refresh: true,
          creditsToAdd: tierConfig.monthlyCredits,
          type: "monthly",
        };
      }
    } else {
      // Pro/Enterprise - subscription anniversary with Stripe sync
      const subscription = user.StripeSubscription;
      if (subscription && subscription.status === "active") {
        const currentPeriodStart = new Date(
          subscription.currentPeriodStart * 1000
        );
        const lastRefreshDate = new Date(lastRefresh);

        // Refresh if we've crossed into a new billing period
        if (currentPeriodStart > lastRefreshDate) {
          return {
            refresh: true,
            creditsToAdd: tierConfig.monthlyCredits,
            type: "subscription_renewal",
          };
        }
      } else {
        // Fallback for users without active Stripe subscription
        const daysSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60 * 24);
        if (daysSinceRefresh >= 30) {
          return {
            refresh: true,
            creditsToAdd: tierConfig.monthlyCredits,
            type: "fallback_monthly",
          };
        }
      }
    }

    return { refresh: false };
  }

  // Batch refresh for all users (run via cron job)
  static async batchRefreshCredits() {
    const usersToRefresh = await User.findAll({
      where: {
        [Op.or]: [
          { lastCreditRefresh: null },
          {
            lastCreditRefresh: {
              [Op.lt]: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
            },
          }, // 25 days ago
        ],
      },
      limit: 1000,
    });

    let refreshCount = 0;
    for (const user of usersToRefresh) {
      try {
        await this.refreshUserCredits(user.id);
        refreshCount++;
      } catch (error) {
        console.error(`Failed to refresh credits for user ${user.id}:`, error);
      }
    }

    console.log(`Batch refresh completed: ${refreshCount} users refreshed`);
    return refreshCount;
  }
}
```

## API Modifications

### 1. Enhanced Pre-Message Validation with Security

```javascript
// Input validation middleware
const validateMessageRequest = (req, res, next) => {
  const { content, attachments } = req.body;

  // Validate content
  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "Message content is required" });
  }

  if (content.length > 10000) {
    return res
      .status(400)
      .json({ error: "Message content too long (max 10,000 characters)" });
  }

  // Validate attachments
  if (attachments && !Array.isArray(attachments)) {
    return res.status(400).json({ error: "Attachments must be an array" });
  }

  if (attachments && attachments.length > 5) {
    return res.status(400).json({ error: "Maximum 5 attachments allowed" });
  }

  next();
};

// Rate limiting for message creation
const messageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Allow 20 messages per minute per user
  keyGenerator: (req) => req.user.id,
  message: "Too many messages, please slow down",
});

// Modify message creation endpoint with enhanced security
app.post(
  "/api/conversations/:conversationId/messages",
  authenticateToken,
  messageRateLimit,
  validateMessageRequest,
  async (req, res) => {
    const startTime = Date.now();
    let userMessage;
    let estimatedCredits = 0;

    try {
      // ... existing validation ...

      // Refresh user credits if needed
      await CreditRefreshService.refreshUserCredits(req.user.id);

      // Get updated user data
      const user = await User.findByPk(req.user.id);

      // Estimate token usage before processing
      const modelProvider = getModelProvider(conversation.Character.model);
      estimatedCredits = await TokenTracker.estimateCredits(
        req.body.content,
        conversation.Character.model,
        modelProvider,
        req.body.attachments && req.body.attachments.length > 0
      );

      // Check if user has sufficient credits with buffer
      const requiredCredits = estimatedCredits * 1.2; // 20% buffer
      if (user.creditBalance < requiredCredits) {
        return res.status(402).json({
          error: "Insufficient credits",
          creditsNeeded: requiredCredits,
          currentBalance: user.creditBalance,
          estimatedCost: estimatedCredits,
        });
      }

      // ... continue with message processing ...

      // Create user message first
      userMessage = await Message.create({
        content: req.body.content,
        role: "user",
        UserId: req.user.id,
        ConversationId: conversation.id,
        CharacterId: conversation.CharacterId,
        attachments: req.body.attachments || null,
        parentId: parentMessageId,
        childIndex: childIndex,
      });

      // Get AI response with error handling
      let aiResponse;
      try {
        aiResponse = await getAIResponse(
          messageHistory,
          conversation.Character.model
        );
      } catch (aiError) {
        // Clean up user message on AI failure
        await userMessage.destroy();

        // Record compensation if credits would have been deducted
        await CreditCompensationService.recordFailedTransaction(
          req.user.id,
          userMessage.id,
          estimatedCredits,
          `AI service failure: ${aiError.message}`
        );

        throw new Error(`AI service unavailable: ${aiError.message}`);
      }

      // Create AI message
      const aiMessage = await Message.create({
        content: aiResponse.content,
        role: "assistant",
        UserId: req.user.id,
        ConversationId: conversation.id,
        CharacterId: conversation.CharacterId,
        parentId: userMessage.id,
        childIndex: 0,
      });

      // Track actual usage with comprehensive error handling
      try {
        await TokenTracker.trackUsage(
          req.user.id,
          conversation.id,
          aiMessage.id,
          modelProvider,
          conversation.Character.model,
          aiResponse.usage, // Provider-specific usage data
          req.ip,
          req.get("User-Agent")
        );
      } catch (trackingError) {
        console.error("Token tracking failed:", trackingError);

        // Record compensation for tracking failure
        await CreditCompensationService.recordFailedTransaction(
          req.user.id,
          aiMessage.id,
          estimatedCredits,
          `Token tracking failed: ${trackingError.message}`
        );
      }

      // Update conversation metadata
      await conversation.update({
        currentHeadId: aiMessage.id,
        lastMessage: aiResponse.content.substring(0, 50),
      });

      // Generate title if needed
      if (conversation.title === "New Conversation") {
        try {
          const titleResponse = await generateConversationTitle(
            req.body.content,
            aiResponse.content
          );
          await conversation.update({ title: titleResponse });
        } catch (titleError) {
          console.error("Title generation failed:", titleError);
          // Non-critical error, continue without title update
        }
      }

      // Log performance metrics
      const processingTime = Date.now() - startTime;
      console.log(
        `Message processed in ${processingTime}ms for user ${req.user.id}`
      );

      // Return success response
      res.json({
        messages: [userMessage, aiMessage],
        conversation: {
          id: conversation.id,
          title: conversation.title,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        },
        creditsUsed: estimatedCredits, // Will be updated with actual usage later
        processingTime,
      });
    } catch (err) {
      console.error("Message creation error:", err);

      // Clean up on error
      if (userMessage) {
        try {
          await userMessage.destroy();
        } catch (cleanupError) {
          console.error("Failed to cleanup user message:", cleanupError);
        }
      }

      res.status(500).json({
        error: err.message || "Failed to send message",
        requestId: req.id, // For debugging
      });
    }
  }
);
```

### 2. New Credit Management Endpoints

```javascript
// Get user credit balance and usage
app.get("/api/credits/balance", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const tierConfig = SUBSCRIPTION_TIERS[user.subscriptionTier];

    res.json({
      balance: user.creditBalance,
      totalUsed: user.totalCreditsUsed,
      monthlyAllowance: tierConfig.monthlyCredits,
      lastRefresh: user.lastCreditRefresh,
      tier: user.subscriptionTier,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch credit balance" });
  }
});

// Get detailed usage history
app.get("/api/credits/usage", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;

    const whereClause = { userId: req.user.id };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const usage = await TokenUsage.findAll({
      where: whereClause,
      include: [
        { model: Conversation, attributes: ["title"] },
        { model: Message, attributes: ["content"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });

    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch usage history" });
  }
});

// Purchase additional credits
app.post("/api/credits/purchase", authenticateToken, async (req, res) => {
  try {
    const { creditAmount } = req.body;
    const costUsd = creditAmount * CREDIT_TO_USD_RATE;

    // Create Stripe checkout session for credit purchase
    const session = await stripe.checkout.sessions.create({
      customer: req.user.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${creditAmount} AI Credits`,
              description: "Additional credits for AI character chat",
            },
            unit_amount: Math.round(costUsd * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/credits?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/credits?canceled=true`,
      metadata: {
        userId: req.user.id,
        creditAmount: creditAmount.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: "Failed to create purchase session" });
  }
});
```

## Implementation Phases (Revised with Security Focus)

### Phase 0: Critical Security Foundation (Week 1)

**MUST BE COMPLETED BEFORE ANY OTHER DEVELOPMENT**

- [ ] **Database Schema with Security Constraints**

  - [ ] TokenUsage table with integrity constraints
  - [ ] CreditCompensations table for failure recovery
  - [ ] CreditAuditLog for comprehensive audit trail
  - [ ] Performance indexes and foreign key constraints
  - [ ] Database migration scripts with rollback capability

- [ ] **Atomic Credit Operations**

  - [ ] Secure deductCreditsSecure() with database-level validation
  - [ ] Transaction-based credit operations
  - [ ] Race condition prevention mechanisms
  - [ ] Credit balance constraints with negative balance allowance

- [ ] **Input Validation & Rate Limiting**

  - [ ] Comprehensive request validation middleware
  - [ ] Rate limiting for all credit-related endpoints
  - [ ] Input sanitization and length restrictions
  - [ ] Attack vector prevention (injection, overflow)

- [ ] **Error Handling & Compensation**
  - [ ] CreditCompensationService implementation
  - [ ] Automatic refund mechanisms for failures
  - [ ] Comprehensive error logging and alerting
  - [ ] Rollback procedures for failed transactions

### Phase 1: Enhanced Foundation (Week 2-3)

- [ ] **Dynamic Model Pricing System**

  - [ ] ModelPricing table implementation
  - [ ] PricingService with versioning support
  - [ ] Automated pricing update mechanisms
  - [ ] Historical pricing tracking

- [ ] **Robust Credit Refresh Logic**

  - [ ] Timezone-aware refresh calculations
  - [ ] Stripe subscription synchronization
  - [ ] CreditRefreshHistory tracking
  - [ ] Batch refresh processing with cron jobs

- [ ] **Secure Token Tracking**
  - [ ] Enhanced TokenTracker with compensation
  - [ ] Provider-specific token extraction with error handling
  - [ ] Estimation algorithms for pre-validation
  - [ ] Retry mechanisms for tracking failures

### Phase 2: Core Integration (Week 4-5)

- [ ] **Enhanced API Security**

  - [ ] Secure message creation endpoint
  - [ ] Streaming endpoint credit management
  - [ ] Credit reservation system for long operations
  - [ ] Performance monitoring and metrics

- [ ] **Credit Management APIs**

  - [ ] Balance checking with rate limiting
  - [ ] Usage history with pagination
  - [ ] Credit purchase system integration
  - [ ] Admin credit adjustment capabilities

- [ ] **Monitoring & Alerting**
  - [ ] Real-time credit operation monitoring
  - [ ] Fraud detection algorithms
  - [ ] System health alerting
  - [ ] Performance degradation alerts

### Phase 3: Advanced Features (Week 6-7)

- [ ] **Frontend Integration**

  - [ ] Credit balance display components
  - [ ] Usage history visualization
  - [ ] Low credit warnings and notifications
  - [ ] Credit purchase interface

- [ ] **Analytics & Reporting**

  - [ ] Admin analytics dashboard
  - [ ] Usage pattern analysis
  - [ ] Cost optimization recommendations
  - [ ] Revenue tracking and reporting

- [ ] **Data Management**
  - [ ] Automated data archival system
  - [ ] Data retention policy implementation
  - [ ] Backup and recovery procedures
  - [ ] GDPR compliance features

### Phase 4: Testing & Quality Assurance (Week 8-9)

- [ ] **Comprehensive Testing Suite**

  - [ ] Race condition stress testing
  - [ ] Concurrent operation testing
  - [ ] Failure scenario testing
  - [ ] Performance testing under load

- [ ] **Edge Case Validation**

  - [ ] Timezone boundary testing
  - [ ] AI service failure simulation
  - [ ] Malformed response handling
  - [ ] Network interruption recovery

- [ ] **Security Penetration Testing**
  - [ ] Credit manipulation attempts
  - [ ] Rate limiting bypass attempts
  - [ ] Input validation testing
  - [ ] Authorization boundary testing

### Phase 5: Production Rollout (Week 10-11)

- [ ] **Migration Strategy**

  - [ ] Existing user credit initialization
  - [ ] Data migration scripts with validation
  - [ ] Rollback procedures for failed migration
  - [ ] Zero-downtime deployment strategy

- [ ] **Gradual Rollout**

  - [ ] Beta user group testing
  - [ ] Phased percentage rollout
  - [ ] Real-time monitoring during rollout
  - [ ] Immediate rollback capabilities

- [ ] **Documentation & Support**
  - [ ] User education materials
  - [ ] API documentation updates
  - [ ] Support team training
  - [ ] Troubleshooting runbooks

### Phase 6: Optimization & Enhancement (Week 12+)

- [ ] **Performance Optimization**

  - [ ] Database query optimization
  - [ ] Caching strategies implementation
  - [ ] Load balancing considerations
  - [ ] Scaling preparation

- [ ] **Advanced Features**
  - [ ] Credit pooling for team accounts
  - [ ] Usage-based tier recommendations
  - [ ] Predictive credit modeling
  - [ ] Smart model selection based on cost

## Critical Success Criteria

### Security Requirements (Non-Negotiable)

- ✅ Zero tolerance for race conditions in credit operations
- ✅ 100% audit trail coverage for all credit transactions
- ✅ Automatic compensation for system failures
- ✅ Comprehensive input validation on all endpoints

### Performance Requirements

- ✅ Credit operations complete within 100ms
- ✅ Database queries optimized with proper indexing
- ✅ 99.9% uptime for credit-related services
- ✅ Graceful degradation under high load

### Business Requirements

- ✅ Real-time credit balance accuracy
- ✅ Transparent cost calculation for users
- ✅ Flexible pricing model support
- ✅ Comprehensive usage analytics

## Monitoring & Analytics (Enhanced)

### Critical Real-Time Metrics

#### Financial Metrics

- **Credit Operation Success Rate**: >99.5% target
- **Average Credit Cost per Message**: Tracked by model and tier
- **Revenue per User**: Monthly recurring and credit purchases
- **Credit Purchase Conversion Rate**: Free to paid tier transitions
- **Refund Rate**: Compensation claims as % of total transactions

#### Performance Metrics

- **Credit Operation Latency**: <100ms target for all operations
- **Database Query Performance**: Index effectiveness monitoring
- **AI Service Response Times**: Provider-specific tracking
- **Token Tracking Accuracy**: Estimated vs actual variance

#### Security Metrics

- **Failed Credit Deduction Attempts**: Race condition indicators
- **Rate Limiting Triggers**: Abuse detection patterns
- **Unauthorized Access Attempts**: Credit manipulation attempts
- **Data Integrity Violations**: Constraint violation tracking

### Enhanced Alert System

#### Critical Alerts (Immediate Response Required)

```javascript
const CriticalAlerts = {
  // Financial Security
  unusualCreditDepletion: {
    condition: "user_credits_depleted > 90% in < 1 hour",
    action: "freeze_account_and_notify_fraud_team",
    urgency: "critical",
  },

  negativeBalanceViolation: {
    condition: "credit_balance < -100",
    action: "immediate_investigation_and_correction",
    urgency: "critical",
  },

  // System Health
  creditOperationFailureSpike: {
    condition: "failed_operations > 5% over 5 minutes",
    action: "escalate_to_engineering_immediately",
    urgency: "critical",
  },

  databaseConstraintViolations: {
    condition: "constraint_violations > 0",
    action: "immediate_data_integrity_check",
    urgency: "critical",
  },

  // Business Impact
  totalCreditOperationsDown: {
    condition: "no_successful_operations for 2 minutes",
    action: "activate_incident_response",
    urgency: "critical",
  },
};
```

#### Warning Alerts (Monitor and Investigate)

```javascript
const WarningAlerts = {
  // Performance Degradation
  slowCreditOperations: {
    condition: "avg_operation_time > 200ms over 10 minutes",
    action: "investigate_database_performance",
    urgency: "high",
  },

  // Usage Patterns
  unusualModelCosts: {
    condition: "model_costs_variance > 25% from 7-day average",
    action: "verify_pricing_accuracy",
    urgency: "medium",
  },

  // Capacity Planning
  highCreditUsageGrowth: {
    condition: "daily_usage_growth > 50% for 3 days",
    action: "capacity_planning_review",
    urgency: "medium",
  },
};
```

### Advanced Admin Dashboard Features

#### Real-Time Operations Center

- **Live Credit Transaction Stream**: Real-time credit operations feed
- **System Health Indicators**: Database, API, and AI service status
- **Geographic Usage Patterns**: Credit usage by region/timezone
- **Fraud Detection Dashboard**: Suspicious activity monitoring

#### Financial Analytics

- **Revenue Attribution**: Credit sales vs subscription revenue
- **Cost Analysis**: AI provider costs vs user payments
- **Profitability by User Segment**: Tier-based profit margins
- **Pricing Optimization Recommendations**: Dynamic pricing suggestions

#### Operational Intelligence

- **Credit Refresh Monitoring**: Batch job success/failure tracking
- **Model Performance Comparison**: Cost-effectiveness by AI provider
- **User Journey Analytics**: Credit usage patterns and conversion
- **Capacity Planning Dashboard**: Resource utilization forecasting

### Data Retention & Archival Strategy

```javascript
// Automated data lifecycle management
const DataRetentionPolicies = {
  tokenUsage: {
    active: "24 months",
    archive: "7 years",
    purge: "never", // Keep for tax/compliance
  },

  creditAuditLog: {
    active: "12 months",
    archive: "indefinite",
    purge: "never", // Critical for audit trails
  },

  creditCompensations: {
    active: "6 months",
    archive: "5 years",
    purge: "after_legal_retention_period",
  },

  performanceMetrics: {
    detailed: "30 days",
    aggregated: "2 years",
    summary: "indefinite",
  },
};

// Implementation
class DataArchivalService {
  static async executeRetentionPolicy() {
    const policies = DataRetentionPolicies;

    for (const [table, policy] of Object.entries(policies)) {
      await this.archiveOldData(table, policy);
    }
  }

  static async archiveOldData(tableName, policy) {
    const cutoffDate = this.calculateCutoffDate(policy.active);

    // Move to archive table
    await sequelize.query(
      `
      INSERT INTO ${tableName}Archive 
      SELECT * FROM ${tableName} 
      WHERE createdAt < :cutoffDate
    `,
      { replacements: { cutoffDate } }
    );

    // Remove from active table
    await sequelize.query(
      `
      DELETE FROM ${tableName} 
      WHERE createdAt < :cutoffDate
    `,
      { replacements: { cutoffDate } }
    );

    console.log(`Archived ${tableName} records older than ${cutoffDate}`);
  }
}
```

### Performance Monitoring Implementation

```javascript
// Credit operation performance tracking
class CreditOperationMonitor {
  static async trackOperation(
    operationType,
    userId,
    startTime,
    success,
    metadata = {}
  ) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Real-time metrics
    await this.recordMetric("credit_operation_duration", duration, {
      operation: operationType,
      success,
      userId,
      ...metadata,
    });

    // Alert if operation too slow
    if (duration > 1000) {
      // 1 second threshold
      await this.triggerAlert("slow_credit_operation", {
        duration,
        operation: operationType,
        userId,
        threshold: 1000,
      });
    }

    // Update success rate metrics
    await this.updateSuccessRate(operationType, success);
  }

  static async updateSuccessRate(operationType, success) {
    const key = `success_rate_${operationType}`;
    const rate = await this.calculateRollingSuccessRate(operationType, "1h");

    if (rate < 0.995) {
      // 99.5% threshold
      await this.triggerAlert("low_success_rate", {
        operation: operationType,
        rate,
        threshold: 0.995,
      });
    }
  }
}
```

## Risk Mitigation

### Token Tracking Failures

- Fallback to estimated token counts
- Retry mechanisms for failed tracking
- Manual adjustment capabilities

### Credit System Issues

- Negative balance handling
- Refund processes for incorrect charges
- Emergency credit allocation system

### Pricing Changes

- Automated pricing updates
- Gradual price change rollouts
- User notification system

## Future Enhancements

### Advanced Features

- Credit pooling for team accounts
- Custom model pricing for enterprise
- Dynamic pricing based on demand
- Credit rewards system

### Optimization

- Predictive credit usage modeling
- Smart model selection based on cost
- Bulk credit purchase discounts
- Usage-based tier recommendations

---

This system provides granular control over AI usage costs while maintaining a user-friendly credit-based interface. The phased implementation allows for gradual rollout and continuous improvement based on real usage data.
