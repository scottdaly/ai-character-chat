# Monthly Credit Refresh System Implementation Plan

## Overview
Implement a robust monthly credit refresh system that automatically replenishes user credits based on their subscription tier.

## Current State Analysis

### Existing Infrastructure
- **Database Fields:**
  - `User.creditBalance` - Current credit balance
  - `User.lastCreditRefresh` - Last refresh timestamp
  - `User.subscriptionTier` - User's subscription level (free/pro)
  - `User.subscriptionStatus` - Active subscription status
  
- **Database Tables:**
  - `CreditRefreshHistory` - Table exists but unused
  - Contains fields for tracking refresh events

### Credit Allocation by Tier
- **Free Tier:** 1,000 credits/month
- **Pro Tier:** 20,000 credits/month (based on initial credit logic found)

## Implementation Architecture

### 1. Credit Refresh Service (`/services/creditRefreshService.js`)

```javascript
class CreditRefreshService {
  constructor(models, creditService) {
    this.models = models;
    this.creditService = creditService;
    this.isRunning = false;
    this.refreshInterval = null;
  }

  // Core refresh logic
  async refreshUserCredits(userId, options = {}) {
    // Atomic transaction for credit refresh
    // Check eligibility
    // Calculate credits based on tier
    // Update balance
    // Log to CreditRefreshHistory
    // Create audit log entry
  }

  // Batch refresh for all eligible users
  async refreshAllEligibleUsers() {
    // Query users needing refresh
    // Process in batches to avoid overload
    // Handle errors gracefully
    // Send notifications if configured
  }

  // Check if user is eligible for refresh
  async isEligibleForRefresh(user) {
    // Check lastCreditRefresh date
    // Verify subscription status
    // Check for any holds/flags
  }

  // Start scheduled refresh job
  start(intervalHours = 1) {
    // Run every hour to catch users as they become eligible
    // Prevents large batch processing at midnight
  }

  // Stop scheduled refresh job
  stop() {
    // Clean shutdown of interval
  }
}
```

### 2. Refresh Eligibility Rules

#### Timing Logic
- **Refresh Cycle:** 30 days from last refresh (not calendar month)
- **Grace Period:** Allow refresh up to 31 days to handle edge cases
- **Minimum Interval:** Prevent refresh within 29 days (abuse prevention)

#### Eligibility Criteria
```javascript
const isEligible = (user) => {
  const now = new Date();
  const lastRefresh = user.lastCreditRefresh || user.createdAt;
  const daysSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60 * 24);
  
  return (
    daysSinceRefresh >= 30 &&
    user.subscriptionStatus === 'active' &&
    !user.creditRefreshHold // Admin flag to pause refreshes
  );
};
```

### 3. Database Schema Updates

#### Add to User Model
```javascript
creditRefreshHold: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
  allowNull: false
},
creditRefreshDay: {
  type: DataTypes.INTEGER, // 1-31, day of month for refresh
  allowNull: true
},
customCreditAmount: {
  type: DataTypes.INTEGER, // Override default tier amounts
  allowNull: true
}
```

#### CreditRefreshHistory Schema
```javascript
{
  id: UUID,
  userId: UUID,
  refreshType: ENUM('scheduled', 'manual', 'subscription_change', 'compensation'),
  creditsBefore: DECIMAL,
  creditsAfter: DECIMAL,
  creditsAdded: DECIMAL,
  subscriptionTier: STRING,
  metadata: JSON, // Additional context
  createdAt: TIMESTAMP
}
```

### 4. API Endpoints

#### Admin Endpoints
```javascript
// Manual refresh for specific user
POST /api/admin/users/:userId/refresh-credits
{
  amount: number (optional),
  reason: string
}

// Bulk refresh
POST /api/admin/credits/bulk-refresh
{
  userIds: array (optional, all if not provided),
  dryRun: boolean
}

// Get refresh history
GET /api/admin/users/:userId/refresh-history

// Configure refresh settings
PUT /api/admin/users/:userId/refresh-settings
{
  creditRefreshHold: boolean,
  creditRefreshDay: number,
  customCreditAmount: number
}
```

#### User Endpoints
```javascript
// Check refresh eligibility
GET /api/user/credits/next-refresh
Response: {
  nextRefreshDate: ISO8601,
  daysRemaining: number,
  creditsToReceive: number
}

// Get own refresh history
GET /api/user/credits/refresh-history
```

### 5. Notification System

#### Email Notifications
- Credit refresh completed
- Upcoming refresh reminder (3 days before)
- Failed refresh notification (subscription issues)

#### In-App Notifications
- Toast notification on successful refresh
- Dashboard banner showing days until refresh

### 6. Monitoring & Logging

#### Metrics to Track
- Total refreshes per day
- Failed refresh attempts
- Average credits distributed
- Users with refresh holds
- Refresh processing time

#### Audit Logging
```javascript
await creditService.createAuditLog({
  userId,
  operation: 'MONTHLY_REFRESH',
  creditsAmount: creditsToAdd,
  balanceBefore: currentBalance,
  balanceAfter: newBalance,
  metadata: {
    refreshType: 'scheduled',
    subscriptionTier: user.subscriptionTier,
    daysSinceLastRefresh
  }
});
```

### 7. Error Handling & Recovery

#### Failure Scenarios
1. **Database Transaction Failure**
   - Automatic rollback
   - Retry with exponential backoff
   - Alert admin after 3 failures

2. **Partial Batch Failure**
   - Continue processing other users
   - Log failed users for manual review
   - Send daily summary of failures

3. **Service Crash During Refresh**
   - Use database locks to prevent double refresh
   - Resume from last processed user
   - Idempotent refresh operations

### 8. Implementation Phases

#### Phase 1: Core Infrastructure (Week 1)
- [ ] Create CreditRefreshService class
- [ ] Implement single user refresh logic
- [ ] Add database schema updates
- [ ] Create audit logging

#### Phase 2: Batch Processing (Week 1)
- [ ] Implement batch refresh logic
- [ ] Add eligibility checking
- [ ] Create refresh history tracking
- [ ] Add error handling and retries

#### Phase 3: Scheduling System (Week 2)
- [ ] Set up hourly check interval
- [ ] Implement staggered processing
- [ ] Add service start/stop controls
- [ ] Create health check endpoint

#### Phase 4: Admin Tools (Week 2)
- [ ] Build admin API endpoints
- [ ] Create admin dashboard UI
- [ ] Add manual refresh capabilities
- [ ] Implement refresh holds

#### Phase 5: User Features (Week 3)
- [ ] Add user API endpoints
- [ ] Update frontend to show refresh info
- [ ] Implement countdown timer
- [ ] Add refresh history view

#### Phase 6: Notifications (Week 3)
- [ ] Email notification templates
- [ ] In-app notification system
- [ ] Notification preferences
- [ ] Test notification delivery

#### Phase 7: Monitoring & Testing (Week 4)
- [ ] Add monitoring metrics
- [ ] Create automated tests
- [ ] Load testing for batch processing
- [ ] Documentation updates

### 9. Configuration

#### Environment Variables
```bash
# Credit Refresh Configuration
CREDIT_REFRESH_ENABLED=true
CREDIT_REFRESH_INTERVAL_HOURS=1
CREDIT_REFRESH_BATCH_SIZE=100
CREDIT_REFRESH_DRY_RUN=false

# Credit Amounts by Tier
CREDITS_FREE_TIER=1000
CREDITS_PRO_TIER=20000

# Notification Settings
CREDIT_REFRESH_NOTIFY_EMAIL=true
CREDIT_REFRESH_NOTIFY_APP=true
CREDIT_REFRESH_REMINDER_DAYS=3
```

### 10. Testing Strategy

#### Unit Tests
- Eligibility calculation logic
- Credit amount determination
- Date arithmetic for refresh cycles
- Transaction rollback scenarios

#### Integration Tests
- Full refresh cycle for single user
- Batch processing with mixed eligibility
- API endpoint functionality
- Database transaction integrity

#### Performance Tests
- Batch processing 10,000+ users
- Concurrent refresh requests
- Database query optimization
- Service recovery after crash

### 11. Migration Strategy

#### For Existing Users
1. Calculate initial `lastCreditRefresh` based on:
   - Account creation date
   - Last manual credit addition
   - Subscription start date

2. Stagger initial refreshes to avoid bulk processing:
   ```javascript
   const staggerDays = userId.charCodeAt(0) % 30;
   const lastCreditRefresh = new Date();
   lastCreditRefresh.setDate(lastCreditRefresh.getDate() - staggerDays);
   ```

3. Run in dry-run mode first to verify calculations

### 12. Security Considerations

- **Rate Limiting:** Prevent refresh spam/abuse
- **Audit Trail:** Complete history of all refresh operations
- **Admin Controls:** Ability to pause/hold refreshes
- **Validation:** Strict checking of refresh eligibility
- **Idempotency:** Prevent double refreshes

### 13. Future Enhancements

- **Tiered Refresh Rates:** Different refresh cycles by tier
- **Rollover Credits:** Allow unused credits to carry over (with limits)
- **Bonus Credits:** Special events, referrals, achievements
- **Credit Expiration:** Optional expiration of unused credits
- **Subscription Sync:** Align refresh with billing cycle
- **Credit Packages:** One-time credit purchases between refreshes

## Success Metrics

- **Reliability:** 99.9% successful refresh rate
- **Performance:** Process 10,000 users in < 5 minutes
- **User Satisfaction:** Clear communication of refresh status
- **Admin Control:** Full visibility and control over refresh system
- **Scalability:** Handle 100,000+ users without degradation

## Rollback Plan

If issues arise:
1. Disable refresh service via environment variable
2. Restore previous credit balances from audit logs
3. Notify affected users
4. Fix issues and re-run with compensation