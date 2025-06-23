const axios = require("axios");

const API_BASE = "http://localhost:3000/api";

// Test user credentials (you'll need to update these)
const ADMIN_EMAIL = "admin@example.com"; // Update with your admin email
const ADMIN_PASSWORD = "admin123"; // Update with your admin password

async function login(email, password) {
  try {
    const response = await axios.post(`${API_BASE}/login`, {
      email,
      password
    });
    return response.data.token;
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
}

async function testAnalyticsEndpoints(token) {
  const headers = { Authorization: `Bearer ${token}` };

  console.log("\n=== Testing Analytics Endpoints ===\n");

  // Test 1: System-wide analytics
  console.log("1. Testing system-wide analytics...");
  try {
    const response = await axios.get(`${API_BASE}/admin/analytics/system`, {
      headers,
      params: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    });
    
    console.log("✓ System analytics retrieved successfully");
    console.log("  Summary:", {
      totalRequests: response.data.summary.totalRequests,
      activeUsers: response.data.summary.activeUsers,
      totalCreditsUsed: response.data.summary.totalCreditsUsed,
      totalRevenue: response.data.summary.totalRevenue
    });
    console.log("  Top users:", response.data.topUsers.length);
    console.log("  Models used:", response.data.usageByModel.length);
  } catch (error) {
    console.error("✗ Failed to get system analytics:", error.response?.data || error.message);
  }

  // Test 2: All users analytics (paginated)
  console.log("\n2. Testing all users analytics...");
  try {
    const response = await axios.get(`${API_BASE}/admin/analytics/users`, {
      headers,
      params: {
        page: 1,
        limit: 10,
        sortBy: "creditsUsed",
        sortOrder: "DESC"
      }
    });
    
    console.log("✓ Users analytics retrieved successfully");
    console.log("  Total users:", response.data.pagination.total);
    console.log("  Current page:", response.data.pagination.page);
    console.log("  Users on page:", response.data.data.length);
    
    if (response.data.data.length > 0) {
      console.log("\n  Top user:");
      const topUser = response.data.data[0];
      console.log("    Email:", topUser.user.email);
      console.log("    Credits used:", topUser.usage.creditsUsed);
      console.log("    Requests:", topUser.usage.requestCount);
      console.log("    Current balance:", topUser.creditBalance.current);
    }
  } catch (error) {
    console.error("✗ Failed to get users analytics:", error.response?.data || error.message);
  }

  // Test 3: Specific user analytics (if we have users)
  console.log("\n3. Testing specific user analytics...");
  try {
    // First get a user ID from the users list
    const usersResponse = await axios.get(`${API_BASE}/admin/analytics/users`, {
      headers,
      params: { limit: 1 }
    });
    
    if (usersResponse.data.data.length > 0) {
      const userId = usersResponse.data.data[0].userId;
      
      const response = await axios.get(`${API_BASE}/admin/analytics/user/${userId}`, {
        headers,
        params: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          groupBy: "day"
        }
      });
      
      console.log("✓ User analytics retrieved successfully");
      console.log("  User ID:", response.data.userId);
      console.log("  Total requests:", response.data.summary.totalRequests);
      console.log("  Total credits used:", response.data.summary.totalCreditsUsed);
      console.log("  Current balance:", response.data.summary.currentBalance);
      console.log("  Usage by model:", response.data.usageByModel.length, "models");
      console.log("  Daily usage data points:", response.data.usageOverTime.length);
    } else {
      console.log("  No users found to test with");
    }
  } catch (error) {
    console.error("✗ Failed to get user analytics:", error.response?.data || error.message);
  }

  // Test 4: Export functionality
  console.log("\n4. Testing export functionality...");
  try {
    // Test JSON export
    const jsonResponse = await axios.get(`${API_BASE}/admin/analytics/export`, {
      headers,
      params: {
        format: "json",
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    });
    
    console.log("✓ JSON export successful");
    console.log("  Records exported:", jsonResponse.data.recordCount);
    
    // Test CSV export
    const csvResponse = await axios.get(`${API_BASE}/admin/analytics/export`, {
      headers,
      params: {
        format: "csv",
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    });
    
    console.log("✓ CSV export successful");
    console.log("  CSV content type:", csvResponse.headers['content-type']);
    console.log("  CSV size:", csvResponse.data.length, "bytes");
  } catch (error) {
    console.error("✗ Failed to export analytics:", error.response?.data || error.message);
  }

  // Test 5: Error handling - non-admin access
  console.log("\n5. Testing access control...");
  try {
    // Try to access without admin privileges (using invalid token)
    await axios.get(`${API_BASE}/admin/analytics/system`, {
      headers: { Authorization: "Bearer invalid-token" }
    });
    console.error("✗ Access control failed - endpoint accessible without valid token");
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("✓ Access control working - unauthorized access blocked");
    } else {
      console.error("✗ Unexpected error:", error.response?.data || error.message);
    }
  }
}

async function main() {
  console.log("Analytics API Test Suite");
  console.log("========================");
  
  try {
    // Login as admin
    console.log("\nLogging in as admin...");
    const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("✓ Login successful");

    // Run analytics tests
    await testAnalyticsEndpoints(token);

    console.log("\n========================");
    console.log("Analytics tests complete!");
  } catch (error) {
    console.error("\nFatal error:", error.message);
    console.error("\nNote: Make sure to update ADMIN_EMAIL and ADMIN_PASSWORD with valid admin credentials");
  }
}

// Run the tests
main().catch(console.error);