const axios = require("axios");
const jwt = require("jsonwebtoken");

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-here";

// Test user data
const TEST_USER = {
  id: "test-user-id-12345",
  email: "test@example.com",
  username: "testuser",
  subscriptionTier: "free",
};

class CreditSystemTester {
  constructor() {
    this.token = null;
    this.axios = axios.create({
      baseURL: SERVER_URL,
      timeout: 10000,
    });
  }

  // Generate test JWT token
  generateTestToken() {
    this.token = jwt.sign({ userId: TEST_USER.id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    this.axios.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${this.token}`;
    console.log("✅ Generated test token");
  }

  // Helper method for making requests
  async makeRequest(method, url, data = null) {
    try {
      const response = await this.axios({
        method,
        url,
        data,
      });
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500,
      };
    }
  }

  // Test 1: Check credit balance endpoint
  async testCreditBalance() {
    console.log("\n🧪 Testing Credit Balance Endpoint");
    console.log("📡 GET /api/credit/balance");

    const result = await this.makeRequest("GET", "/api/credit/balance");

    if (result.success) {
      console.log("✅ Credit balance retrieved successfully:");
      console.log(`   Balance: ${result.data.balance}`);
      console.log(`   Subscription: ${result.data.subscriptionTier}`);
      console.log(`   Has Credits: ${result.data.hasCredits}`);
    } else {
      console.log("❌ Credit balance test failed:");
      console.log(`   Status: ${result.status}`);
      console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
    }

    return result;
  }

  // Test 2: Check usage statistics endpoint
  async testUsageStats() {
    console.log("\n🧪 Testing Usage Statistics Endpoint");
    console.log("📡 GET /api/credit/usage");

    const result = await this.makeRequest("GET", "/api/credit/usage?limit=10");

    if (result.success) {
      console.log("✅ Usage statistics retrieved successfully:");
      console.log(`   Current Balance: ${result.data.currentBalance}`);
      console.log(`   Total Tokens: ${result.data.totalTokens}`);
      console.log(`   Total Cost: $${result.data.totalCostUsd}`);
      console.log(`   Total Requests: ${result.data.totalRequests}`);
      console.log(`   Recent Usage Records: ${result.data.recentUsage.length}`);
    } else {
      console.log("❌ Usage statistics test failed:");
      console.log(`   Status: ${result.status}`);
      console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
    }

    return result;
  }

  // Test 3: Test rate limiting
  async testRateLimiting() {
    console.log("\n🧪 Testing Rate Limiting");
    console.log("📡 Making rapid requests to test rate limiter");

    const requests = [];
    const startTime = Date.now();

    // Make 15 rapid requests (should hit rate limit)
    for (let i = 0; i < 15; i++) {
      requests.push(this.makeRequest("GET", "/api/credit/balance"));
    }

    const results = await Promise.all(requests);
    const endTime = Date.now();

    const successful = results.filter((r) => r.success).length;
    const rateLimited = results.filter((r) => r.status === 429).length;

    console.log(`✅ Rate limiting test completed in ${endTime - startTime}ms:`);
    console.log(`   Successful requests: ${successful}`);
    console.log(`   Rate limited requests: ${rateLimited}`);

    if (rateLimited > 0) {
      console.log("✅ Rate limiting is working correctly");
    } else {
      console.log("⚠️  Rate limiting may not be configured properly");
    }

    return { successful, rateLimited };
  }

  // Test 4: Test input validation
  async testInputValidation() {
    console.log("\n🧪 Testing Input Validation");

    const tests = [
      {
        name: "Invalid date format in usage stats",
        request: () =>
          this.makeRequest("GET", "/api/credit/usage?startDate=invalid-date"),
      },
      {
        name: "Excessive limit in usage stats",
        request: () =>
          this.makeRequest("GET", "/api/credit/usage?limit=999999"),
      },
      {
        name: "SQL injection attempt in query",
        request: () =>
          this.makeRequest(
            "GET",
            "/api/credit/usage?limit=1'; DROP TABLE Users; --"
          ),
      },
    ];

    for (const test of tests) {
      console.log(`\n   Testing: ${test.name}`);
      const result = await test.request();

      if (result.success) {
        console.log(
          "❌ Validation test failed - request should have been rejected"
        );
      } else if (result.status === 400) {
        console.log("✅ Input validation working - request properly rejected");
      } else {
        console.log(`⚠️  Unexpected response: ${result.status}`);
      }
    }
  }

  // Test 5: Test security headers
  async testSecurityHeaders() {
    console.log("\n🧪 Testing Security Headers");

    try {
      const response = await axios.get(`${SERVER_URL}/api/credit/balance`, {
        headers: { Authorization: `Bearer ${this.token}` },
        validateStatus: () => true, // Don't throw on any status
      });

      const headers = response.headers;
      const securityHeaders = [
        "x-content-type-options",
        "x-frame-options",
        "x-xss-protection",
        "referrer-policy",
        "x-credit-operation-time",
        "x-request-id",
      ];

      console.log("Security headers check:");
      securityHeaders.forEach((header) => {
        if (headers[header]) {
          console.log(`   ✅ ${header}: ${headers[header]}`);
        } else {
          console.log(`   ❌ ${header}: Missing`);
        }
      });
    } catch (error) {
      console.log("❌ Security headers test failed:", error.message);
    }
  }

  // Test 6: Test authentication
  async testAuthentication() {
    console.log("\n🧪 Testing Authentication");

    // Remove authorization header
    delete this.axios.defaults.headers.common["Authorization"];

    console.log("   Testing request without authentication...");
    const result = await this.makeRequest("GET", "/api/credit/balance");

    if (result.status === 401) {
      console.log(
        "✅ Authentication properly required - unauthorized request rejected"
      );
    } else {
      console.log(
        "❌ Authentication test failed - unauthorized request was allowed"
      );
    }

    // Restore authorization header
    this.axios.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${this.token}`;

    // Test with invalid token
    console.log("   Testing request with invalid token...");
    this.axios.defaults.headers.common["Authorization"] =
      "Bearer invalid-token";

    const invalidResult = await this.makeRequest("GET", "/api/credit/balance");

    if (invalidResult.status === 401) {
      console.log("✅ Invalid token properly rejected");
    } else {
      console.log("❌ Invalid token test failed - should have been rejected");
    }

    // Restore valid token
    this.axios.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${this.token}`;
  }

  // Run all tests
  async runAllTests() {
    console.log("🚀 Starting Credit System Manual Tests");
    console.log(`📍 Server URL: ${SERVER_URL}`);
    console.log("=".repeat(60));

    try {
      // Generate test token
      this.generateTestToken();

      // Run all tests
      await this.testAuthentication();
      await this.testCreditBalance();
      await this.testUsageStats();
      await this.testInputValidation();
      await this.testSecurityHeaders();
      await this.testRateLimiting();

      console.log("\n" + "=".repeat(60));
      console.log("🎉 All manual tests completed!");
      console.log("\n💡 Next steps:");
      console.log("   1. Review test results above");
      console.log("   2. Check server logs for security events");
      console.log("   3. Verify database tables were created");
      console.log("   4. Run automated test suite: npm test");
    } catch (error) {
      console.error("\n❌ Test suite failed:", error.message);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new CreditSystemTester();
  tester.runAllTests().catch(console.error);
}

module.exports = CreditSystemTester;
