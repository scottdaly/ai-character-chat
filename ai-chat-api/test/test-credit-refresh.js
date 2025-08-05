#!/usr/bin/env node

/**
 * Test script for credit refresh system
 */

require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");

// Import credit system components
const { defineCreditModels } = require("../models/creditModels");
const { defineReservationModels } = require("../models/reservationModels");
const CreditService = require("../services/creditService");
const CreditRefreshService = require("../services/creditRefreshService");
const TokenizerService = require("../services/tokenizerService");

async function testCreditRefresh() {
  console.log("=== Credit Refresh System Test ===\n");

  // Initialize test database
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: ":memory:",
    logging: false,
  });

  try {
    // Define models
    const User = sequelize.define("User", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: DataTypes.STRING,
      username: DataTypes.STRING,
      creditBalance: {
        type: DataTypes.DECIMAL(10, 4),
        defaultValue: 1000,
      },
      lastCreditRefresh: DataTypes.DATE,
      subscriptionTier: {
        type: DataTypes.STRING,
        defaultValue: "free",
      },
      creditRefreshHold: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      customCreditAmount: DataTypes.INTEGER,
    });

    // Define credit models
    const creditModels = defineCreditModels(sequelize);
    const reservationModels = defineReservationModels(sequelize);

    // Combine all models
    const allModels = {
      User,
      ...creditModels,
      ...reservationModels,
      sequelize,
    };

    // Sync database
    await sequelize.sync({ force: true });
    console.log("✓ Test database initialized");

    // Initialize services
    const tokenizerService = new TokenizerService();
    const creditService = new CreditService(sequelize, allModels, tokenizerService);
    const creditRefreshService = new CreditRefreshService(sequelize, allModels, creditService);
    console.log("✓ Services initialized");

    // Test 1: Create test users
    console.log("\n--- Test 1: Creating test users ---");
    
    const user1 = await User.create({
      email: "user1@test.com",
      username: "user1",
      creditBalance: 100,
      subscriptionTier: "free",
      lastCreditRefresh: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
    });
    console.log("✓ Created user1 (eligible for refresh)");

    const user2 = await User.create({
      email: "user2@test.com",
      username: "user2",
      creditBalance: 500,
      subscriptionTier: "pro",
      lastCreditRefresh: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    });
    console.log("✓ Created user2 (not eligible yet)");

    const user3 = await User.create({
      email: "user3@test.com",
      username: "user3",
      creditBalance: 0,
      subscriptionTier: "free",
      creditRefreshHold: true,
      lastCreditRefresh: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    });
    console.log("✓ Created user3 (eligible but on hold)");

    // Test 2: Check eligibility
    console.log("\n--- Test 2: Checking eligibility ---");
    
    const eligibility1 = creditRefreshService.isEligibleForRefresh(user1);
    console.log(`User1: ${eligibility1.eligible ? "✓ Eligible" : "✗ Not eligible"} - ${eligibility1.reason}`);
    
    const eligibility2 = creditRefreshService.isEligibleForRefresh(user2);
    console.log(`User2: ${eligibility2.eligible ? "✓ Eligible" : "✗ Not eligible"} - ${eligibility2.reason} (${Math.round(eligibility2.daysUntilEligible)} days until eligible)`);
    
    const eligibility3 = creditRefreshService.isEligibleForRefresh(user3);
    console.log(`User3: ${eligibility3.eligible ? "✓ Eligible" : "✗ Not eligible"} - ${eligibility3.reason}`);

    // Test 3: Manual refresh
    console.log("\n--- Test 3: Manual refresh for single user ---");
    
    const refreshResult = await creditRefreshService.refreshUserCredits(user1.id, {
      reason: "test_manual",
      force: false,
    });
    
    if (refreshResult.success) {
      console.log(`✓ Refreshed ${refreshResult.creditsAdded} credits for user1`);
      console.log(`  Old balance: ${refreshResult.oldBalance}`);
      console.log(`  New balance: ${refreshResult.newBalance}`);
    } else {
      console.log(`✗ Failed to refresh: ${refreshResult.error}`);
    }

    // Test 4: Check refresh history
    console.log("\n--- Test 4: Checking refresh history ---");
    
    const history = await creditModels.CreditRefreshHistory.findAll({
      where: { userId: user1.id },
    });
    
    console.log(`✓ Found ${history.length} refresh record(s)`);
    history.forEach(record => {
      console.log(`  - ${record.refreshType}: +${record.creditsAdded} credits`);
    });

    // Test 5: Batch refresh
    console.log("\n--- Test 5: Batch refresh all eligible users ---");
    
    // Reset user1's refresh date to make them eligible again
    await user1.update({
      lastCreditRefresh: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    
    const batchResults = await creditRefreshService.refreshAllEligibleUsers();
    console.log(`✓ Batch refresh completed:`);
    console.log(`  Total checked: ${batchResults.total}`);
    console.log(`  Successful: ${batchResults.successful}`);
    console.log(`  Failed: ${batchResults.failed}`);
    console.log(`  Skipped: ${batchResults.skipped}`);

    // Test 6: Get next refresh info
    console.log("\n--- Test 6: Getting next refresh info ---");
    
    const nextRefresh = await creditRefreshService.getNextRefreshInfo(user2.id);
    console.log(`User2 next refresh:`);
    console.log(`  Date: ${new Date(nextRefresh.nextRefreshDate).toLocaleDateString()}`);
    console.log(`  Days remaining: ${nextRefresh.daysRemaining}`);
    console.log(`  Credits to receive: ${nextRefresh.creditsToReceive}`);
    console.log(`  Current balance: ${nextRefresh.currentBalance}`);

    // Test 7: Custom credit amount
    console.log("\n--- Test 7: Custom credit amount ---");
    
    await user2.update({ customCreditAmount: 5000 });
    const customCredits = creditRefreshService.getCreditAmount(user2);
    console.log(`✓ User2 with custom amount will receive: ${customCredits} credits`);

    // Test 8: Statistics
    console.log("\n--- Test 8: Refresh statistics ---");
    
    const stats = await creditRefreshService.getRefreshStatistics();
    console.log(`✓ Statistics:`);
    console.log(`  Total users: ${stats.totalUsers}`);
    console.log(`  Eligible users: ${stats.eligibleUsers}`);
    console.log(`  Next batch size: ${stats.nextBatchSize}`);

    console.log("\n=== All tests completed successfully! ===");

  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the tests
testCreditRefresh();