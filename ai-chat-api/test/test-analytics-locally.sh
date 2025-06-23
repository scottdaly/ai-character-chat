#!/bin/bash

# Analytics API Testing Script
# Make sure the server is running on port 3000

API_BASE="http://localhost:3000/api"

echo "==================================="
echo "Admin Analytics API Testing Script"
echo "==================================="
echo ""

# Step 1: Set your test credentials
read -p "Enter admin email: " ADMIN_EMAIL
read -sp "Enter admin password: " ADMIN_PASSWORD
echo ""

# Step 2: Login and get token
echo -e "\n1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST $API_BASE/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo $LOGIN_RESPONSE | jq '.' 2>/dev/null || echo $LOGIN_RESPONSE
  exit 1
fi

echo "✅ Login successful"

# Step 3: Test System Analytics
echo -e "\n2. Testing System Analytics..."
echo "Command: GET $API_BASE/admin/analytics/system"
curl -s $API_BASE/admin/analytics/system \
  -H "Authorization: Bearer $TOKEN" | jq '.' || echo "Failed to get system analytics"

# Step 4: Test All Users Analytics
echo -e "\n3. Testing All Users Analytics (page 1, limit 5)..."
echo "Command: GET $API_BASE/admin/analytics/users?page=1&limit=5"
curl -s "$API_BASE/admin/analytics/users?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.' || echo "Failed to get users analytics"

# Step 5: Get a user ID for specific user test
echo -e "\n4. Getting a specific user's analytics..."
USER_ID=$(curl -s "$API_BASE/admin/analytics/users?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].userId' 2>/dev/null)

if [ "$USER_ID" != "null" ] && [ ! -z "$USER_ID" ]; then
  echo "Testing with user ID: $USER_ID"
  curl -s "$API_BASE/admin/analytics/user/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" | jq '.' || echo "Failed to get user analytics"
else
  echo "No users found with usage data"
fi

# Step 6: Test Export (JSON)
echo -e "\n5. Testing JSON Export..."
echo "Command: GET $API_BASE/admin/analytics/export?format=json"
curl -s "$API_BASE/admin/analytics/export?format=json&startDate=2024-01-01" \
  -H "Authorization: Bearer $TOKEN" | jq '.recordCount' || echo "Failed to export JSON"

# Step 7: Test Export (CSV)
echo -e "\n6. Testing CSV Export..."
echo "Command: GET $API_BASE/admin/analytics/export?format=csv"
curl -s "$API_BASE/admin/analytics/export?format=csv&startDate=2024-01-01" \
  -H "Authorization: Bearer $TOKEN" \
  -o usage-export-test.csv

if [ -f "usage-export-test.csv" ]; then
  echo "✅ CSV exported successfully to usage-export-test.csv"
  echo "First 5 lines of CSV:"
  head -5 usage-export-test.csv
else
  echo "❌ CSV export failed"
fi

echo -e "\n==================================="
echo "Testing complete!"
echo "==================================="