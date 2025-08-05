# Credit Refresh System Deployment Guide

## Overview
The monthly credit refresh system automatically replenishes user credits every 30 days based on their subscription tier.

## Deployment Steps

### 1. Update Environment Variables
Add these to your production `.env` file:

```bash
# Credit Refresh Configuration
CREDIT_REFRESH_ENABLED=true
CREDIT_REFRESH_INTERVAL_HOURS=1
CREDIT_REFRESH_BATCH_SIZE=100
CREDIT_REFRESH_DRY_RUN=false
CREDITS_FREE_TIER=1000
CREDITS_PRO_TIER=20000
```

### 2. Deploy Code Changes
Deploy the following updated/new files:
- `server.js` - Updated with new User fields and API endpoints
- `services/creditRefreshService.js` - New service
- `models/creditModels.js` - Existing (ensure latest version)

### 3. Run Database Migration
Execute the migration to add new columns and initialize refresh dates:

```bash
node migrations/initialize-credit-refresh.js
```

This will:
- Add new columns: `creditRefreshHold`, `creditRefreshDay`, `customCreditAmount`
- Set initial `lastCreditRefresh` dates for existing users (staggered across 30 days)

### 4. Verify Installation
Test the system is working:

```bash
# Check service status (add to your monitoring)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://yourapi.com/api/admin/credits/refresh-stats

# Manually refresh a specific user (dry run)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}' \
  https://yourapi.com/api/admin/users/USER_ID/refresh-credits
```

### 5. Monitor Initial Run
The service will:
- Start automatically when the server starts
- Check for eligible users every hour
- Process users in batches of 100
- Log all refresh activities

## API Endpoints

### Admin Endpoints
- `POST /api/admin/users/:userId/refresh-credits` - Manual refresh
- `POST /api/admin/credits/bulk-refresh` - Bulk refresh
- `GET /api/admin/users/:userId/refresh-history` - View history
- `PUT /api/admin/users/:userId/refresh-settings` - Configure settings
- `GET /api/admin/credits/refresh-stats` - View statistics

### User Endpoints
- `GET /api/user/credits/next-refresh` - Next refresh info
- `GET /api/user/credits/refresh-history` - Personal history

## Monitoring

### Key Metrics to Watch
1. **Refresh Success Rate** - Should be >99%
2. **Processing Time** - Should complete within 5 minutes for 10k users
3. **Error Rate** - Check logs for failed refreshes
4. **Database Performance** - Monitor transaction times

### Log Entries
Look for these in your logs:
- `[CreditRefresh] Starting batch refresh...`
- `[CreditRefresh] Successfully refreshed X credits for user Y`
- `[CreditRefresh] Batch refresh completed`
- `[CreditRefresh] Error refreshing credits`

## Troubleshooting

### Issue: Users not getting refreshed
1. Check `lastCreditRefresh` date in database
2. Verify `creditRefreshHold` is false
3. Ensure 30 days have passed since last refresh
4. Check service is running: look for startup log

### Issue: Service not starting
1. Check `CREDIT_REFRESH_ENABLED` is not set to `false`
2. Verify all required models are loaded
3. Check for startup errors in logs

### Issue: Too many refreshes at once
1. Reduce `CREDIT_REFRESH_BATCH_SIZE`
2. Increase `CREDIT_REFRESH_INTERVAL_HOURS`
3. Monitor database load

## Rollback Plan

If issues occur:

1. **Disable Service**:
```bash
CREDIT_REFRESH_ENABLED=false
```

2. **Restore Credits** (if needed):
```sql
-- View recent refreshes
SELECT * FROM CreditRefreshHistories 
WHERE createdAt > datetime('now', '-1 day')
ORDER BY createdAt DESC;

-- Restore previous balance for a user
UPDATE Users 
SET creditBalance = (
  SELECT oldBalance FROM CreditRefreshHistories 
  WHERE userId = 'USER_ID' 
  ORDER BY createdAt DESC 
  LIMIT 1
)
WHERE id = 'USER_ID';
```

3. **Fix Issues** and re-enable when ready

## Production Checklist

- [ ] Environment variables configured
- [ ] Code deployed
- [ ] Migration script run
- [ ] Test refresh on single user
- [ ] Monitor first batch run
- [ ] Set up alerts for failures
- [ ] Document refresh schedule for support team
- [ ] Update user documentation about refresh timing

## Support Information

When users ask about credit refresh:
- Credits refresh every 30 days from last refresh
- Free tier: 1,000 credits
- Pro tier: 20,000 credits
- Check next refresh: `/api/user/credits/next-refresh`
- Refresh is automatic, no action needed

## Notes

- The system uses a 30-day cycle, not calendar months
- Initial deployment staggers users across 30 days to avoid bulk processing
- Refreshes happen hourly as users become eligible
- Failed refreshes are retried in the next hourly check
- All refreshes are logged in `CreditRefreshHistories` and `CreditAuditLogs` tables