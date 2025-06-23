# Credit System Testing Guide

This guide provides comprehensive testing procedures for the Phase 0 Credit System implementation.

## Overview

Our testing strategy includes:

- **Automated Unit Tests**: Comprehensive test suite covering all components
- **Manual API Tests**: Real server endpoint testing
- **Security Testing**: Validation of security measures and rate limiting
- **Performance Testing**: Race condition and concurrency testing
- **Integration Testing**: End-to-end workflow validation

## Prerequisites

1. **Install Test Dependencies**:

   ```bash
   cd ai-chat-api
   npm install
   ```

2. **Environment Setup**:

   ```bash
   # Copy your existing .env file or create test environment
   cp .env .env.test

   # Ensure these variables are set:
   JWT_SECRET=your-jwt-secret-here
   NODE_ENV=development
   ```

3. **Database Preparation**:
   - The automated tests use an in-memory SQLite database
   - Manual tests use your existing development database
   - Backup your database before running tests if needed

## 1. Automated Test Suite

### Run All Tests

```bash
npm test
```

### Run Credit System Tests Only

```bash
npm run test:credit
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Watch Mode (for development)

```bash
npm run test:watch
```

### Test Categories

#### 1.1 Database Schema Tests

- ✅ Verifies all credit system tables are created
- ✅ Tests database constraints and validations
- ✅ Validates foreign key relationships
- ✅ Checks index creation

#### 1.2 Credit Service Tests

- ✅ Credit balance checking
- ✅ Atomic credit deductions
- ✅ Audit log creation
- ✅ Insufficient funds handling
- ✅ Error handling for invalid inputs

#### 1.3 Race Condition Tests

- ✅ Concurrent credit deduction safety
- ✅ Database transaction isolation
- ✅ Balance consistency under load

#### 1.4 Token Extractor Tests

- ✅ OpenAI token usage extraction
- ✅ Anthropic token usage extraction
- ✅ Google AI token usage extraction
- ✅ Fallback estimation for missing data
- ✅ Token usage validation

#### 1.5 Token Usage Recording

- ✅ Cost calculation accuracy
- ✅ Model pricing retrieval
- ✅ Database record creation
- ✅ Multi-provider support

#### 1.6 Compensation System

- ✅ Compensation record creation
- ✅ Pending compensation processing
- ✅ Balance restoration accuracy

#### 1.7 Usage Statistics

- ✅ Statistics aggregation
- ✅ Date range filtering
- ✅ Performance metrics

#### 1.8 Error Handling

- ✅ Invalid user ID handling
- ✅ Non-existent user handling
- ✅ Excessive amount validation

## 2. Manual API Testing

### Start Your Server

```bash
npm run dev
```

### Run Manual Tests

```bash
npm run test:manual
```

### Manual Test Coverage

#### 2.1 Authentication Testing

- ✅ Requests without token (should be rejected)
- ✅ Requests with invalid token (should be rejected)
- ✅ Requests with valid token (should succeed)

#### 2.2 API Endpoint Testing

- ✅ `GET /api/credit/balance` - Credit balance retrieval
- ✅ `GET /api/credit/usage` - Usage statistics
- ✅ Rate limiting validation
- ✅ Input validation testing

#### 2.3 Security Header Testing

- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `X-Credit-Operation-Time` (performance tracking)
- ✅ `X-Request-ID` (request tracking)

#### 2.4 Rate Limiting Testing

- ✅ General rate limit: 100 requests/minute
- ✅ Credit operation rate limit: 30 requests/minute
- ✅ Sensitive operation rate limit: 10 requests/5 minutes

## 3. Database Verification

### Check Table Creation

```sql
-- Connect to your SQLite database
sqlite3 ai-chat-api/database.sqlite

-- List all tables
.tables

-- Expected tables:
-- Users, Characters, Conversations, Messages
-- TokenUsages, CreditCompensations, CreditAuditLogs
-- CreditRefreshHistories, ModelPricings, TokenUsageArchives
```

### Verify User Credit Initialization

```sql
-- Check that existing users have credits
SELECT id, email, creditBalance, subscriptionTier, lastCreditRefresh
FROM Users
LIMIT 5;
```

### Check Index Creation

```sql
-- Verify performance indexes exist
.schema TokenUsages
.schema CreditAuditLogs
```

## 4. Message Flow Integration Testing

### Test Credit System in Live Message Flow

```bash
node test/credit-integration-test.js
```

This test verifies the complete credit system integration in actual message processing:

#### What It Tests:

- ✅ Pre-flight credit checks before AI requests
- ✅ Actual token usage extraction from AI responses
- ✅ Credit deduction based on real usage
- ✅ Token usage recording in database
- ✅ Error handling and compensation
- ✅ Both regular and streaming endpoints

#### Expected Server Log Output:

```
Credits deducted: 0.0234 for user 7, message abc-123-def
Credits deducted (streaming): 0.0156 for user 7, message def-456-ghi
Credit estimation failed: Model pricing not found
Credit processing failed: Insufficient credits
```

#### What to Verify:

1. **Before sending a message**: Check credit balance
2. **During message processing**: Look for credit estimation logs
3. **After AI response**: Look for actual token usage and credit deduction
4. **In database**: Verify TokenUsage and CreditAuditLog records are created

#### Troubleshooting:

- **No credit logs**: Check if model pricing is initialized
- **"Credit estimation failed"**: Run `node test/manual-credit-test.js` to initialize pricing
- **"Insufficient credits"**: Add credits to test user or use Pro user

## 5. Security Testing

### 4.1 Input Validation

Test malicious inputs:

```bash
# SQL injection attempts (should be blocked)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/credit/usage?limit=1'; DROP TABLE Users; --"

# XSS attempts (should be sanitized)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/credit/usage?startDate=<script>alert('xss')</script>"
```

### 4.2 Rate Limiting

```bash
# Test rate limiting with rapid requests
for i in {1..15}; do
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    "http://localhost:5000/api/credit/balance" &
done
wait
```

### 4.3 Authentication Bypass

```bash
# Should return 401 Unauthorized
curl "http://localhost:5000/api/credit/balance"

# Should return 401 Unauthorized
curl -H "Authorization: Bearer invalid-token" \
  "http://localhost:5000/api/credit/balance"
```

## 5. Performance Testing

### 5.1 Concurrent Operations

The automated test suite includes race condition testing, but you can also test manually:

```javascript
// Create multiple concurrent credit operations
const promises = [];
for (let i = 0; i < 10; i++) {
  promises.push(
    fetch("/api/credit/balance", {
      headers: { Authorization: "Bearer YOUR_TOKEN" },
    })
  );
}
Promise.all(promises).then((results) => {
  console.log("All requests completed");
});
```

### 5.2 Database Performance

Monitor query performance:

```sql
-- Enable query timing
.timer on

-- Test complex queries
SELECT u.email, SUM(tu.creditsUsed) as totalCredits
FROM Users u
LEFT JOIN TokenUsages tu ON u.id = tu.userId
GROUP BY u.id
LIMIT 10;
```

## 6. Integration Testing

### 6.1 End-to-End Credit Flow

1. **Check initial balance**: User should have credits
2. **Send a message**: Credits should be deducted
3. **Check balance again**: Should reflect deduction
4. **Verify audit log**: Should contain deduction record
5. **Check usage stats**: Should show the operation

### 6.2 Error Recovery Testing

1. **Simulate AI service failure**: Should create compensation
2. **Process compensations**: Should restore credits
3. **Verify balance**: Should reflect compensation

## 7. Monitoring and Logs

### 7.1 Check Server Logs

```bash
# Look for credit system initialization
grep "Credit system initialized" server_logs.log

# Check for security events
grep "SECURITY" server_logs.log

# Monitor credit operations
grep "CREDIT_OPERATION" server_logs.log
```

### 7.2 Database Monitoring

```sql
-- Check recent credit operations
SELECT * FROM CreditAuditLogs
ORDER BY createdAt DESC
LIMIT 10;

-- Monitor token usage
SELECT modelProvider, COUNT(*) as requests, SUM(creditsUsed) as totalCredits
FROM TokenUsages
GROUP BY modelProvider;
```

## 8. Test Results Interpretation

### ✅ Success Indicators

- All automated tests pass
- Manual tests show expected security responses
- Database tables created with proper constraints
- Rate limiting functions correctly
- Security headers present
- Audit logs created for all operations

### ❌ Failure Indicators

- Test failures in race condition tests
- Unauthorized requests succeed
- Missing security headers
- Rate limiting not working
- Database constraint violations allowed
- Missing audit trail

### ⚠️ Warning Signs

- Slow query performance
- High memory usage during tests
- Inconsistent test results
- Security warnings in logs

## 9. Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check database file permissions
ls -la database.sqlite

# Verify environment variables
echo $NODE_ENV
```

#### Authentication Failures

```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Check token generation in manual test
```

#### Rate Limiting Not Working

- Verify express-rate-limit is installed
- Check middleware order in server.js
- Ensure rate limiting middleware is applied to correct routes

#### Test Timeouts

- Increase timeout in test configuration
- Check for database locks
- Verify server is running for manual tests

## 10. Next Steps After Testing

1. **Review Test Results**: Address any failures or warnings
2. **Performance Optimization**: Based on performance test results
3. **Security Hardening**: Based on security test findings
4. **Documentation Updates**: Update API documentation
5. **Monitoring Setup**: Implement production monitoring
6. **Phase 1 Implementation**: Proceed with message endpoint integration

## Test Commands Summary

```bash
# Install dependencies
npm install

# Run all automated tests
npm test

# Run credit system tests only
npm run test:credit

# Run manual API tests (server must be running)
npm run test:manual

# Run tests with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# Start server for manual testing
npm run dev
```

Remember to backup your database before running tests and ensure your environment variables are properly configured!
