const axios = require("axios");
const jwt = require("jsonwebtoken");

// Test configuration
const API_BASE = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret";

// Create a test JWT token
const createTestToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
};

// Helper function to make authenticated requests
const authenticatedRequest = (token, method, endpoint, data = null) => {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (data) {
    config.data = data;
  }

  return axios(config);
};

// Test credit system integration
async function testCreditIntegration() {
  console.log("🧪 Testing Credit System Integration...\n");

  try {
    // You'll need to replace this with a real user ID from your database
    const testUserId = "7"; // Replace with actual user ID
    const token = createTestToken(testUserId);

    console.log("1. Testing credit balance endpoint...");
    try {
      const balanceResponse = await authenticatedRequest(
        token,
        "GET",
        "/api/credit/balance"
      );
      console.log("✅ Credit balance:", balanceResponse.data);
    } catch (error) {
      console.log(
        "❌ Credit balance failed:",
        error.response?.data || error.message
      );
    }

    console.log("\n2. Testing credit usage stats...");
    try {
      const usageResponse = await authenticatedRequest(
        token,
        "GET",
        "/api/credit/usage?limit=5"
      );
      console.log("✅ Credit usage stats:", usageResponse.data);
    } catch (error) {
      console.log(
        "❌ Credit usage stats failed:",
        error.response?.data || error.message
      );
    }

    console.log("\n3. Testing message creation with credit tracking...");

    // You'll need to replace these with actual IDs from your database
    const testCharacterId = "24bee45b-1ae9-43ca-a620-189b98cacf0a"; // Replace with actual character ID

    try {
      // First create a conversation
      console.log("   Creating test conversation...");
      const conversationResponse = await authenticatedRequest(
        token,
        "POST",
        `/api/characters/${testCharacterId}/conversations`
      );
      const conversationId = conversationResponse.data.id;
      console.log("   ✅ Conversation created:", conversationId);

      // Then send a message to trigger credit usage
      console.log("   Sending test message...");
      const messageResponse = await authenticatedRequest(
        token,
        "POST",
        `/api/conversations/${conversationId}/messages`,
        {
          content: "Hello! This is a test message to check credit tracking.",
          attachments: [],
        }
      );

      console.log("✅ Message sent successfully!");
      console.log(
        "   Credits used:",
        messageResponse.data.creditsUsed || "Not tracked"
      );
      console.log(
        "   Token usage:",
        messageResponse.data.tokenUsage || "Not tracked"
      );
      console.log(
        "   Processing time:",
        messageResponse.data.processingTime || "Not tracked"
      );

      // Check credit balance after message
      console.log("\n4. Checking credit balance after message...");
      const newBalanceResponse = await authenticatedRequest(
        token,
        "GET",
        "/api/credit/balance"
      );
      console.log("✅ Updated credit balance:", newBalanceResponse.data);

      // Check recent usage
      console.log("\n5. Checking recent credit usage...");
      const recentUsageResponse = await authenticatedRequest(
        token,
        "GET",
        "/api/credit/usage?limit=1"
      );
      console.log("✅ Recent usage:", recentUsageResponse.data);
    } catch (error) {
      console.log(
        "❌ Message creation failed:",
        error.response?.data || error.message
      );
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Test streaming endpoint with credit tracking
async function testStreamingWithCredits() {
  console.log("\n🌊 Testing Streaming Endpoint Credit Integration...\n");

  try {
    const testUserId = "7"; // Replace with actual user ID
    const token = createTestToken(testUserId);
    const testCharacterId = "24bee45b-1ae9-43ca-a620-189b98cacf0a"; // Replace with actual character ID

    // Create a conversation first
    const conversationResponse = await authenticatedRequest(
      token,
      "POST",
      `/api/characters/${testCharacterId}/conversations`
    );
    const conversationId = conversationResponse.data.id;

    console.log("Testing streaming endpoint...");
    console.log(
      "Note: This test requires manual verification of server logs for credit tracking."
    );

    // Test streaming endpoint
    const streamResponse = await authenticatedRequest(
      token,
      "POST",
      `/api/conversations/${conversationId}/messages/stream`,
      {
        content: "Hello! This is a streaming test message.",
        attachments: [],
      }
    );

    console.log("✅ Streaming request initiated");
    console.log("Check server logs for credit deduction messages like:");
    console.log(
      "   'Credits deducted (streaming): X.XXXX for user 7, message ...'"
    );
  } catch (error) {
    console.log(
      "❌ Streaming test failed:",
      error.response?.data || error.message
    );
  }
}

// Run tests
async function runTests() {
  console.log("🚀 Credit System Integration Tests\n");
  console.log("Make sure your server is running on http://localhost:5000\n");

  await testCreditIntegration();
  await testStreamingWithCredits();

  console.log("\n✨ Tests completed!");
  console.log("\nWhat to look for in server logs:");
  console.log("1. 'Credits deducted: X.XXXX for user Y, message Z'");
  console.log(
    "2. 'Credits deducted (streaming): X.XXXX for user Y, message Z'"
  );
  console.log("3. Token usage data being recorded");
  console.log("4. Credit balance checks before message processing");
  console.log("\nIf you see these logs, the credit system is working! 🎉");
}

// Handle command line execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCreditIntegration,
  testStreamingWithCredits,
  runTests,
};
