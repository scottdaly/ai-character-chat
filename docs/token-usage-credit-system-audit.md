# Token Usage & Credit System - Security & Robustness Audit

## Executive Summary

This audit identifies critical vulnerabilities, edge cases, and implementation risks in the proposed token usage and credit system. Several high-priority issues require immediate attention before implementation.

## Critical Security Vulnerabilities

### 🔴 HIGH PRIORITY: Race Conditions in Credit Deduction

**Issue**: Multiple concurrent requests can cause double-spending or negative balances.

```javascript
// VULNERABLE CODE
static async deductCredits(userId, creditsUsed) {
  const user = await User.findByPk(userId);
  if (user.creditBalance < creditsUsed) {
    throw new Error("Insufficient credits");
  }

  await user.update({
    creditBalance: user.creditBalance - creditsUsed,  // RACE CONDITION
    totalCreditsUsed: user.totalCreditsUsed + creditsUsed,
  });
}
```

**Fix**: Implement atomic operations with database-level constraints:

```javascript
// SECURE IMPLEMENTATION
static async deductCredits(userId, creditsUsed) {
  const transaction = await sequelize.transaction();

  try {
    // Use atomic decrement with validation
    const [updatedRows] = await User.update({
      creditBalance: sequelize.literal(`creditBalance - ${creditsUsed}`),
      totalCreditsUsed: sequelize.literal(`totalCreditsUsed + ${creditsUsed}`)
    }, {
      where: {
        id: userId,
        creditBalance: { [Op.gte]: creditsUsed }  // Ensure sufficient balance
      },
      transaction
    });

    if (updatedRows === 0) {
      throw new Error("Insufficient credits");
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### 🔴 HIGH PRIORITY: Token Tracking Failures Leave Credits Charged

**Issue**: If token tracking fails after credit deduction, users lose credits without getting service.

**Fix**: Implement compensation tracking and retry mechanisms:

```javascript
// Add compensation tracking table
CREATE TABLE CreditCompensations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES Users(id),
  messageId UUID NOT NULL REFERENCES Messages(id),
  creditsToRefund DECIMAL(10, 4) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processedAt TIMESTAMP NULL
);

// Implement compensation logic
class CreditCompensationService {
  static async recordFailedTransaction(userId, messageId, creditsUsed, reason) {
    await CreditCompensations.create({
      userId,
      messageId,
      creditsToRefund: creditsUsed,
      reason
    });

    // Immediate refund for critical failures
    if (reason.includes('ai_service_failure')) {
      await this.processRefund(userId, creditsUsed);
    }
  }

  static async processRefund(userId, credits) {
    await User.increment('creditBalance', {
      by: credits,
      where: { id: userId }
    });
  }
}
```

### 🔴 HIGH PRIORITY: Missing Input Validation & Injection Risks

**Issue**: API endpoints lack proper validation, allowing potential abuse.

**Fix**: Implement comprehensive validation:

```javascript
// Add validation middleware
const validateCreditPurchase = (req, res, next) => {
  const { creditAmount } = req.body;

  // Validate credit amount
  if (!creditAmount || typeof creditAmount !== "number") {
    return res.status(400).json({ error: "Invalid credit amount" });
  }

  if (creditAmount < 100 || creditAmount > 1000000) {
    return res.status(400).json({
      error: "Credit amount must be between 100 and 1,000,000",
    });
  }

  if (creditAmount % 1 !== 0) {
    return res
      .status(400)
      .json({ error: "Credit amount must be a whole number" });
  }

  next();
};

// Rate limiting for credit operations
const creditRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 credit operations per windowMs
  message: "Too many credit operations, please try again later",
});
```

## Database Design Issues

### 🟡 MEDIUM PRIORITY: Missing Database Constraints

**Issue**: Database schema lacks critical constraints to prevent data corruption.

**Fix**: Add comprehensive constraints:

```sql
-- Add critical constraints
ALTER TABLE TokenUsage ADD CONSTRAINT chk_positive_tokens
  CHECK (inputTokens >= 0 AND outputTokens >= 0 AND totalTokens >= 0);

ALTER TABLE TokenUsage ADD CONSTRAINT chk_cost_consistency
  CHECK (totalCostUsd = inputCostUsd + outputCostUsd);

ALTER TABLE TokenUsage ADD CONSTRAINT chk_credits_positive
  CHECK (creditsUsed >= 0);

ALTER TABLE Users ADD CONSTRAINT chk_credit_balance_not_negative
  CHECK (creditBalance >= -100); -- Allow small negative balance for edge cases

-- Add unique constraint to prevent duplicate tracking
ALTER TABLE TokenUsage ADD CONSTRAINT unq_message_tracking
  UNIQUE (messageId, modelProvider);

-- Add foreign key constraints with proper cascading
ALTER TABLE TokenUsage ADD CONSTRAINT fk_token_usage_user
  FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE;

ALTER TABLE TokenUsage ADD CONSTRAINT fk_token_usage_conversation
  FOREIGN KEY (conversationId) REFERENCES Conversations(id) ON DELETE CASCADE;

ALTER TABLE TokenUsage ADD CONSTRAINT fk_token_usage_message
  FOREIGN KEY (messageId) REFERENCES Messages(id) ON DELETE CASCADE;
```

### 🟡 MEDIUM PRIORITY: Insufficient Indexing for Performance

**Issue**: Missing indexes will cause performance degradation at scale.

**Fix**: Add comprehensive indexing strategy:

```sql
-- Performance indexes
CREATE INDEX idx_token_usage_user_date_cost ON TokenUsage(userId, createdAt, totalCostUsd);
CREATE INDEX idx_token_usage_model_performance ON TokenUsage(modelProvider, modelName, createdAt);
CREATE INDEX idx_users_credit_balance ON Users(creditBalance) WHERE creditBalance < 1000;
CREATE INDEX idx_users_subscription_tier ON Users(subscriptionTier, lastCreditRefresh);

-- Partial indexes for common queries
CREATE INDEX idx_token_usage_recent ON TokenUsage(createdAt)
  WHERE createdAt > CURRENT_TIMESTAMP - INTERVAL '30 days';

CREATE INDEX idx_compensation_pending ON CreditCompensations(status, createdAt)
  WHERE status = 'pending';
```

## Business Logic Edge Cases

### 🟡 MEDIUM PRIORITY: Credit Refresh Logic Flaws

**Issue**: Credit refresh timing can be exploited or fail edge cases.

**Problems**:

1. Timezone issues with monthly refresh
2. Subscription anniversary calculations are imprecise
3. No handling for paused/cancelled subscriptions

**Fix**: Implement robust refresh logic:

```javascript
class CreditRefreshService {
  static async refreshUserCredits(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: StripeSubscription }], // Add subscription model
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
        // Record the refresh event
        await CreditRefreshHistory.create(
          {
            userId,
            oldBalance: user.creditBalance,
            creditsAdded: shouldRefresh.creditsToAdd,
            newBalance: user.creditBalance + shouldRefresh.creditsToAdd,
            refreshType: shouldRefresh.type,
            refreshDate: now,
          },
          { transaction }
        );

        // Update user balance
        await user.update(
          {
            creditBalance: user.creditBalance + shouldRefresh.creditsToAdd,
            lastCreditRefresh: now,
          },
          { transaction }
        );

        await transaction.commit();

        console.log(
          `Refreshed ${shouldRefresh.creditsToAdd} credits for user ${userId}`
        );
      } catch (error) {
        await transaction.rollback();
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
      }
    }

    return { refresh: false };
  }
}
```

### 🟡 MEDIUM PRIORITY: Model Pricing Updates

**Issue**: No mechanism to handle pricing changes without code deployment.

**Fix**: Implement dynamic pricing with versioning:

```sql
-- Model pricing table for dynamic updates
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
  ('claude-3-sonnet-20240229', 'anthropic', 0.003, 0.015, CURRENT_TIMESTAMP);
```

## API Security & Performance Issues

### 🟡 MEDIUM PRIORITY: Missing Rate Limiting & Abuse Prevention

**Issue**: Credit-related endpoints can be abused for reconnaissance or DoS attacks.

**Fix**: Implement comprehensive rate limiting:

```javascript
// Different rate limits for different operations
const balanceCheckLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Allow 30 balance checks per minute
  keyGenerator: (req) => req.user.id,
});

const usageHistoryLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Allow 10 usage history requests per 5 minutes
  keyGenerator: (req) => req.user.id,
});

const creditPurchaseLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Allow 5 purchase attempts per hour
  keyGenerator: (req) => req.user.id,
  onLimitReached: (req, res) => {
    console.log(`Credit purchase rate limit exceeded for user ${req.user.id}`);
  },
});
```

### 🟡 MEDIUM PRIORITY: Streaming Endpoint Credit Deduction

**Issue**: Streaming endpoints need special handling for credit deduction timing.

**Fix**: Implement streaming-aware credit management:

```javascript
// Modify streaming endpoint to handle credits properly
app.post('/api/conversations/:conversationId/messages/stream',
  authenticateToken,
  async (req, res) => {

    let userMessage;
    let creditsReserved = 0;
    let actualCreditsUsed = 0;

    try {
      // Reserve estimated credits
      const estimatedCredits = await estimateCreditsForMessage(req.body.content, modelName);
      creditsReserved = estimatedCredits * 1.2; // Reserve 20% buffer

      await CreditReservationService.reserveCredits(req.user.id, creditsReserved);

      // Save user message
      userMessage = await Message.create({...});

      // Stream AI response
      let totalTokensUsed = 0;
      for await (const chunk of aiStream) {
        // Send chunk to client
        sendSSE({ type: 'delta', content: chunk.content });
        totalTokensUsed += chunk.tokens || 0;
      }

      // Calculate actual credits used
      actualCreditsUsed = calculateCreditsFromTokens(modelName, inputTokens, outputTokens).creditsUsed;

      // Settle the reservation
      await CreditReservationService.settleReservation(
        req.user.id,
        creditsReserved,
        actualCreditsUsed
      );

      // Track usage
      await TokenTracker.trackUsage(/* parameters */);

    } catch (error) {
      // Refund reserved credits on error
      if (creditsReserved > 0) {
        await CreditReservationService.refundReservation(req.user.id, creditsReserved);
      }

      // Clean up user message if created
      if (userMessage) {
        await userMessage.destroy();
      }

      throw error;
    }
  });
```

## Data Integrity & Backup Concerns

### 🟡 MEDIUM PRIORITY: No Audit Trail for Credit Operations

**Issue**: Lack of comprehensive audit trail makes debugging and compliance difficult.

**Fix**: Implement detailed audit logging:

```sql
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
```

### 🟡 MEDIUM PRIORITY: Token Usage Data Retention

**Issue**: No data retention policy for token usage records.

**Fix**: Implement data lifecycle management:

```javascript
// Automated data archival service
class TokenUsageArchivalService {
  static async archiveOldRecords() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 24); // Keep 24 months

    // Move old records to archive table
    await sequelize.query(
      `
      INSERT INTO TokenUsageArchive 
      SELECT * FROM TokenUsage 
      WHERE createdAt < :cutoffDate
    `,
      {
        replacements: { cutoffDate },
        type: QueryTypes.INSERT,
      }
    );

    // Delete archived records from main table
    await TokenUsage.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
      },
    });

    console.log(`Archived token usage records older than ${cutoffDate}`);
  }

  // Run monthly via cron job
  static scheduleArchival() {
    cron.schedule("0 2 1 * *", this.archiveOldRecords); // 2 AM on 1st of each month
  }
}
```

## Testing & Quality Assurance Gaps

### 🟡 MEDIUM PRIORITY: Insufficient Test Coverage Plan

**Issue**: No comprehensive testing strategy for edge cases.

**Required Tests**:

```javascript
// Critical test scenarios
describe("Credit System Edge Cases", () => {
  test("Concurrent credit deductions", async () => {
    // Test 100 simultaneous credit deductions
    const promises = Array(100)
      .fill()
      .map(() => TokenTracker.deductCredits(userId, 1));

    await expect(Promise.allSettled(promises)).resolves.toBeDefined();
    // Verify final balance is correct
  });

  test("AI service failure during streaming", async () => {
    // Mock AI service to fail mid-stream
    // Verify credits are properly refunded
  });

  test("Token tracking with malformed AI responses", async () => {
    // Test various malformed usage responses
    // Verify fallback mechanisms work
  });

  test("Credit refresh across timezone boundaries", async () => {
    // Test refresh logic with different timezones
    // Verify no double-refreshes or missed refreshes
  });
});
```

## Monitoring & Alerting Enhancements

### 🟡 MEDIUM PRIORITY: Missing Critical Alerts

**Required Alerts**:

```javascript
// Critical monitoring alerts
const CriticalAlerts = {
  // Financial alerts
  unusualCreditUsage: {
    condition: "user_credits_used > avg_daily_usage * 10",
    action: "notify_fraud_team",
    urgency: "high",
  },

  negativeBalances: {
    condition: "credit_balance < -50",
    action: "suspend_user_and_notify",
    urgency: "critical",
  },

  // System health alerts
  tokenTrackingFailureRate: {
    condition: "tracking_failures > 5% over 15 minutes",
    action: "notify_engineering",
    urgency: "high",
  },

  creditRefreshFailures: {
    condition: "refresh_failures > 0",
    action: "immediate_notification",
    urgency: "critical",
  },

  // Business alerts
  unusualModelCosts: {
    condition: "model_cost_variance > 20% from historical",
    action: "notify_finance_team",
    urgency: "medium",
  },
};
```

## Recommended Implementation Priority

### Phase 0: Critical Security Fixes (BEFORE ANY IMPLEMENTATION)

1. ✅ Fix race conditions in credit deduction
2. ✅ Implement compensation system for failed transactions
3. ✅ Add comprehensive input validation
4. ✅ Add database constraints and indexes

### Phase 1: Enhanced Foundation (Week 1-2)

1. ✅ Implement robust credit refresh logic
2. ✅ Add dynamic model pricing system
3. ✅ Create comprehensive audit logging
4. ✅ Implement credit reservation system for streaming

### Phase 2: Monitoring & Quality (Week 3-4)

1. ✅ Deploy comprehensive monitoring and alerting
2. ✅ Implement automated testing for edge cases
3. ✅ Add rate limiting and abuse prevention
4. ✅ Create data archival strategy

## Conclusion

The current plan has solid fundamentals but requires significant security and robustness improvements before production deployment. The identified issues range from critical security vulnerabilities to operational concerns that could impact system reliability and user trust.

**Recommendation**: Address all HIGH PRIORITY issues before beginning implementation, and incorporate MEDIUM PRIORITY fixes into the implementation phases.
