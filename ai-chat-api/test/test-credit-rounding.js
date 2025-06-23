#!/usr/bin/env node

/**
 * Test script for credit rounding implementation
 * Tests various scenarios to ensure credits are properly rounded
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const { Sequelize } = require("sequelize");
const { defineCreditModels } = require("../models/creditModels");
const { defineReservationModels } = require("../models/reservationModels");
const CreditService = require("../services/creditService");
const TokenizerService = require("../services/tokenizerService");

// Database connection
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: ":memory:", // Use in-memory database for testing
  logging: false,
});

// Test data
const testScenarios = [
  { 
    name: "Tiny usage (should charge 1 credit)",
    actualCredits: 0.0001,
    expectedCharged: 1
  },
  {
    name: "Small usage (should charge 1 credit)", 
    actualCredits: 0.2607,
    expectedCharged: 1
  },
  {
    name: "Near whole number (should charge 2 credits)",
    actualCredits: 1.0001,
    expectedCharged: 2
  },
  {
    name: "Exact whole number (should charge 3 credits)",
    actualCredits: 3.0,
    expectedCharged: 3
  },
  {
    name: "Large fractional (should charge 46 credits)",
    actualCredits: 45.789,
    expectedCharged: 46
  }
];

async function runTests() {
  console.log("🧪 Testing Credit Rounding Implementation\n");

  try {
    // Initialize database
    console.log("Setting up test database...");
    
    // Define base User model
    const User = sequelize.define("User", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      creditBalance: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: 1000,
      },
    });

    // Define other required models
    const Conversation = sequelize.define("Conversation", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
    });

    const Message = sequelize.define("Message", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
    });

    // Define credit models
    const creditModels = defineCreditModels(sequelize);
    const reservationModels = defineReservationModels(sequelize);
    
    // Combine all models
    const models = {
      User,
      Conversation,
      Message,
      ...creditModels,
      ...reservationModels,
    };

    // Sync database
    await sequelize.sync({ force: true });
    
    // Initialize services
    const creditService = new CreditService(sequelize, models);
    
    console.log("✅ Test database ready\n");
    
    // Test 1: Credit calculation methods
    console.log("📊 Test 1: Credit Calculation Methods");
    console.log("=====================================");
    
    for (const scenario of testScenarios) {
      const charged = creditService.calculateUserChargeableCredits(scenario.actualCredits);
      const status = charged === scenario.expectedCharged ? "✅" : "❌";
      console.log(`${status} ${scenario.name}`);
      console.log(`   Actual: ${scenario.actualCredits} → Charged: ${charged} (expected: ${scenario.expectedCharged})`);
    }
    
    // Test 2: Token usage recording
    console.log("\n📝 Test 2: Token Usage Recording");
    console.log("=================================");
    
    // Create test user
    const testUser = await User.create({
      creditBalance: 1000,
    });
    
    // Test token usage recording with different amounts
    const usageTests = [
      { input: 10, output: 100, expectedCreditsUsed: 0.00165, expectedCharged: 1 },
      { input: 1000, output: 2000, expectedCreditsUsed: 0.165, expectedCharged: 1 },
      { input: 5000, output: 10000, expectedCreditsUsed: 0.825, expectedCharged: 1 },
      { input: 10000, output: 50000, expectedCreditsUsed: 3.3, expectedCharged: 4 },
    ];
    
    for (const test of usageTests) {
      const usage = await creditService.recordTokenUsage({
        userId: testUser.id,
        conversationId: "test-conv-123",
        messageId: `test-msg-${Date.now()}`,
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        inputTokens: test.input,
        outputTokens: test.output,
      });
      
      const status = usage.creditsCharged === test.expectedCharged ? "✅" : "❌";
      console.log(`${status} ${test.input}/${test.output} tokens`);
      console.log(`   Credits used: ${usage.creditsUsed.toFixed(4)} → Charged: ${usage.creditsCharged}`);
      console.log(`   Expected charged: ${test.expectedCharged}`);
    }
    
    // Test 3: Reservation and settlement
    console.log("\n💳 Test 3: Reservation & Settlement");
    console.log("===================================");
    
    // Test credit estimation
    const estimation = await creditService.estimateMessageCredits(
      "Hello, world!",
      "gpt-4o-mini",
      "openai",
      { systemPrompt: "You are a helpful assistant." }
    );
    
    console.log("Credit estimation:");
    console.log(`  Estimated needed: ${estimation.creditsNeeded.toFixed(4)}`);
    console.log(`  Credits to charge: ${estimation.creditsToCharge}`);
    
    // Test reservation with rounded amount
    const reservation = await creditService.reserveCredits(
      testUser.id,
      estimation.creditsToCharge, // Should be whole number
      {
        conversationId: "test-conv-456",
        messageId: "test-msg-456",
        model: "gpt-4o-mini",
        provider: "openai",
      }
    );
    
    console.log("\nReservation created:");
    console.log(`  Reserved: ${reservation.creditsReserved} credits`);
    console.log(`  User balance: ${reservation.previousBalance} → ${reservation.newBalance}`);
    
    // Test settlement with fractional usage
    const actualUsage = 0.4567; // Fractional usage
    const chargeableAmount = creditService.calculateUserChargeableCredits(actualUsage);
    
    const settlement = await creditService.settleReservation(
      reservation.reservationId,
      chargeableAmount, // Should be 1
      {
        inputTokens: 50,
        outputTokens: 200,
      }
    );
    
    console.log("\nSettlement completed:");
    console.log(`  Reserved: ${settlement.creditsReserved}`);
    console.log(`  Actual usage: ${actualUsage.toFixed(4)}`);
    console.log(`  Charged: ${chargeableAmount}`);
    console.log(`  Refunded: ${settlement.creditsRefunded}`);
    console.log(`  Final balance: ${settlement.newBalance}`);
    
    // Verify final state
    const finalUser = await User.findByPk(testUser.id);
    const expectedBalance = 1000 - chargeableAmount; // Should be 999
    const balanceCorrect = Math.abs(finalUser.creditBalance - expectedBalance) < 0.0001;
    
    console.log(`\n${balanceCorrect ? "✅" : "❌"} Final balance check:`);
    console.log(`  Expected: ${expectedBalance}`);
    console.log(`  Actual: ${finalUser.creditBalance}`);
    
    // Test 4: Database validation
    console.log("\n🔍 Test 4: Database Validation");
    console.log("==============================");
    
    // Try to create TokenUsage with mismatched creditsCharged
    try {
      await creditModels.TokenUsage.create({
        userId: testUser.id,
        conversationId: "test-conv",
        messageId: "test-msg",
        modelProvider: "openai",
        modelName: "gpt-4",
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        inputCostUsd: 0.001,
        outputCostUsd: 0.006,
        totalCostUsd: 0.007,
        creditsUsed: 7.0,
        creditsCharged: 6, // Wrong! Should be 7
      });
      console.log("❌ Validation failed - allowed incorrect creditsCharged");
    } catch (error) {
      console.log("✅ Validation caught incorrect creditsCharged");
      console.log(`   Error: ${error.message}`);
    }
    
    console.log("\n✨ All tests completed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the tests
runTests();