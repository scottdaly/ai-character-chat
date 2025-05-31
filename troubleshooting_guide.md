# Troubleshooting Guide: "User not found" Error in Production

## Problem Description

Users are encountering "User not found" errors during the username setup process after signing in with Google OAuth for the first time. This only happens in production, not locally.

## Root Cause Analysis

The issue appears to be a race condition between:

1. User creation in the Google OAuth callback
2. JWT token generation with the user ID
3. Token verification when accessing `/api/setup-username`

In production environments, database writes may have higher latency, causing the user lookup to fail even though the user was just created.

## Changes Made

### 1. Enhanced Server Logging

Added comprehensive debugging to track the authentication flow:

- `[PASSPORT_DEBUG]`: Tracks Google OAuth user creation/lookup
- `[AUTH_DEBUG]`: Tracks authentication callback and user verification
- `[TOKEN_DEBUG]`: Tracks JWT token verification and user lookup
- `[RETRY_DEBUG]`: Tracks retry attempts for failed user lookups

### 2. Database Consistency Improvements

- Added verification that newly created users exist in the database before proceeding
- Added small delay (100ms) after user creation to ensure database consistency
- Added retry mechanism with exponential backoff for user lookups

### 3. Frontend Resilience

Enhanced the `SetupUsername` component with:

- Automatic retry logic for "User not found" errors (up to 3 attempts)
- Progressive delay between retries (1s, 2s, 4s)
- User-friendly retry messages
- Graceful fallback to re-authentication if retries fail

### 4. Error Handling

- Added specific error codes for different failure modes
- Added error display on the Home page for authentication failures
- Added user guidance for recovery steps

## Deployment Steps

1. **Deploy Backend Changes**:

   ```bash
   # Deploy the updated server.js with enhanced logging and retry logic
   ```

2. **Deploy Frontend Changes**:

   ```bash
   # Deploy updated SetupUsername.tsx and Home.tsx components
   ```

3. **Monitor Logs**:
   ```bash
   # Watch for the new debug messages in production logs
   tail -f production.log | grep -E "\[AUTH_DEBUG\]|\[TOKEN_DEBUG\]|\[PASSPORT_DEBUG\]|\[RETRY_DEBUG\]"
   ```

## What to Look For in Logs

### Normal Flow (Success):

```
[PASSPORT_DEBUG] Authenticating user with Google ID: 123456789
[PASSPORT_DEBUG] User created: {userId: "uuid", googleId: "123456789", created: true}
[PASSPORT_DEBUG] New user created, verifying database consistency...
[PASSPORT_DEBUG] New user verified in database successfully
[AUTH_DEBUG] User authenticated: {userId: "uuid", hasUsername: false}
[AUTH_DEBUG] User verified in database: {dbUserId: "uuid"}
[AUTH_DEBUG] Redirecting to username setup: /setup-username?token=...
[TOKEN_DEBUG] Token verified: {userId: "uuid", route: "/api/setup-username"}
[TOKEN_DEBUG] Looking up user uuid in database...
[TOKEN_DEBUG] User found successfully: {userId: "uuid", hasUsername: false}
```

### Race Condition (Will Retry):

```
[PASSPORT_DEBUG] User created: {userId: "uuid", created: true}
[AUTH_DEBUG] User verified in database: {dbUserId: "uuid"}
[TOKEN_DEBUG] Looking up user uuid in database...
[RETRY_DEBUG] User not found on attempt 1, retrying in 200ms...
[RETRY_DEBUG] User found on attempt 2
[TOKEN_DEBUG] User found successfully: {userId: "uuid"}
```

### Critical Failure:

```
[PASSPORT_DEBUG] CRITICAL: Newly created user uuid not found after creation!
[AUTH_DEBUG] CRITICAL: User uuid not found in database immediately after authentication!
[TOKEN_DEBUG] CRITICAL: User uuid not found in database after retries!
```

## User Experience

### Before Changes:

- User gets hard "User not found" error
- No recovery mechanism
- User has to restart authentication flow manually

### After Changes:

- User sees "Authentication still processing... Retrying (1/3)" message
- Automatic retry attempts with visual feedback
- If all retries fail, clear error message with automatic redirect to retry authentication
- Error notifications on Home page if authentication callback fails

## Testing in Production

1. **Create a new Google account** (or use one that hasn't been used with your app)
2. **Try to sign up** and monitor the logs
3. **Look for the debug messages** to understand the flow
4. **Note timing** between user creation and token verification

## Potential Findings

Based on the logs, you might discover:

1. **Database Latency**: Long delays between user creation and availability
2. **Transaction Issues**: Users created but not committed before lookup
3. **Memory vs Disk**: SQLite behaving differently in production vs development
4. **Connection Pooling**: Database connection issues in production environment

## Next Steps

If the retry mechanism doesn't resolve the issue, the logs will help identify:

- Whether it's a database consistency problem
- If there are infrastructure-specific issues
- Whether the SQLite database needs optimization for production
- If migration to a different database (PostgreSQL) is needed

## Rollback Plan

If these changes cause issues:

1. Remove the debug logging (it's verbose)
2. Keep the retry mechanisms (they're harmless)
3. Revert to original error handling if needed

The retry logic is defensive and won't cause additional problems even if the root cause isn't fixed.
