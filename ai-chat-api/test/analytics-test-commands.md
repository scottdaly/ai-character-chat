# Admin Analytics API - Local Testing Guide

## Prerequisites

1. **Make sure the server is running:**
   ```bash
   cd ai-chat-api
   npm start
   ```

2. **Make a user admin (if you haven't already):**
   ```bash
   # First, check existing users
   node scripts/makeUserAdmin.js
   
   # Then make a specific user admin
   node scripts/makeUserAdmin.js your-email@example.com
   ```

## Manual Testing Steps

### 1. Login as Admin

```bash
# Replace with your actual email and password
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}' \
  | jq '.'
```

Save the token from the response. You'll need it for all following requests.

### 2. Test System Analytics

```bash
# Replace YOUR_TOKEN with the actual token
curl http://localhost:3000/api/admin/analytics/system \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'
```

Expected response:
- Total requests, active users, credits used
- Top users by usage
- Usage breakdown by model
- Daily usage trends

### 3. Test All Users Analytics

```bash
# Get first page of users
curl "http://localhost:3000/api/admin/analytics/users?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'

# Search for specific user
curl "http://localhost:3000/api/admin/analytics/users?search=test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'

# Sort by different fields
curl "http://localhost:3000/api/admin/analytics/users?sortBy=requestCount&sortOrder=DESC" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'
```

### 4. Test Specific User Analytics

```bash
# First get a user ID from the users list, then:
curl "http://localhost:3000/api/admin/analytics/user/USER_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'

# With date range
curl "http://localhost:3000/api/admin/analytics/user/USER_ID_HERE?startDate=2025-06-01&endDate=2025-06-30" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'
```

### 5. Test Export Functionality

```bash
# Export as JSON
curl "http://localhost:3000/api/admin/analytics/export?format=json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'

# Export as CSV (saves to file)
curl "http://localhost:3000/api/admin/analytics/export?format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o usage-export.csv

# Export with filters
curl "http://localhost:3000/api/admin/analytics/export?format=csv&startDate=2025-06-01&endDate=2025-06-30" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o filtered-export.csv

# Export specific user's data
curl "http://localhost:3000/api/admin/analytics/export?format=json&userId=USER_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.'
```

## Using the Automated Test Script

```bash
cd ai-chat-api/test
./test-analytics-locally.sh
```

This will prompt for your admin credentials and run through all the tests automatically.

## Viewing Results

### For JSON responses:
- Use `jq` for pretty printing (as shown above)
- Or save to file: `curl ... > output.json`

### For CSV exports:
- Open in Excel, Google Sheets, or any spreadsheet app
- Use command line: `cat usage-export.csv | column -t -s,`

## Troubleshooting

1. **401 Unauthorized**: Token is invalid or missing
2. **403 Forbidden**: User is not an admin
3. **Empty results**: No usage data yet - create some messages first
4. **Server errors**: Check server logs with `tail -f /tmp/server.log`

## Generate Test Data

To create some test usage data:
1. Login to the frontend as a regular user
2. Create conversations with different AI models
3. Send several messages
4. The usage will appear in analytics