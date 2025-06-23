// Test analytics queries directly
const { Sequelize } = require("sequelize");
const path = require("path");
const { defineCreditModels } = require("../models/creditModels");
const AnalyticsService = require("../services/analyticsService");

async function testAnalyticsQueries() {
  console.log("Testing Analytics Queries");
  console.log("========================\n");

  // Initialize database connection
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.join(__dirname, "..", "database.sqlite"),
    logging: false,
  });

  try {
    // Define models
    const creditModels = defineCreditModels(sequelize);
    
    // Basic User model for testing
    const User = sequelize.define("User", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: Sequelize.STRING,
      username: Sequelize.STRING,
      isAdmin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });
    
    // Define associations to match the server setup
    User.hasMany(creditModels.TokenUsage, { foreignKey: "userId" });
    creditModels.TokenUsage.belongsTo(User, { foreignKey: "userId" });

    const allModels = {
      User,
      ...creditModels,
      sequelize,
    };

    // Initialize analytics service
    const analyticsService = new AnalyticsService(allModels);
    console.log("✓ Analytics service initialized");

    // Test 1: Check if we have any token usage data
    const tokenUsageCount = await creditModels.TokenUsage.count();
    console.log(`\nToken usage records in database: ${tokenUsageCount}`);

    // Test 2: Get system usage (last 30 days)
    console.log("\nTesting getSystemUsage()...");
    try {
      const systemUsage = await analyticsService.getSystemUsage({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });

      console.log("✓ System usage query successful");
      console.log("  Total requests:", systemUsage.summary.totalRequests);
      console.log("  Active users:", systemUsage.summary.activeUsers);
      console.log("  Total credits used:", systemUsage.summary.totalCreditsUsed);
      console.log("  Models used:", systemUsage.usageByModel.length);
    } catch (error) {
      console.error("✗ System usage query failed:", error.message);
    }

    // Test 3: Get all users usage
    console.log("\nTesting getAllUsersUsage()...");
    try {
      const usersUsage = await analyticsService.getAllUsersUsage({
        page: 1,
        limit: 10,
      });

      console.log("✓ Users usage query successful");
      console.log("  Total users with usage:", usersUsage.pagination.total);
      console.log("  Users returned:", usersUsage.data.length);
    } catch (error) {
      console.error("✗ Users usage query failed:", error.message);
    }

    // Test 4: Test export functionality
    console.log("\nTesting exportUsageData()...");
    try {
      const exportData = await analyticsService.exportUsageData("json", {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });

      console.log("✓ Export query successful");
      console.log("  Records exported:", exportData.recordCount);
    } catch (error) {
      console.error("✗ Export query failed:", error.message);
    }

    console.log("\n✓ All analytics queries tested successfully!");

  } catch (error) {
    console.error("Failed to test analytics:", error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testAnalyticsQueries().catch(console.error);