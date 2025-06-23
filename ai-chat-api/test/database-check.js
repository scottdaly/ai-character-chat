const { Sequelize } = require("sequelize");
const path = require("path");

async function checkDatabase() {
  console.log("🔍 Checking Credit System Database Setup");
  console.log("=".repeat(50));

  try {
    // Connect to the database
    const sequelize = new Sequelize({
      dialect: "sqlite",
      storage: path.resolve(__dirname, "../database.sqlite"),
      logging: false,
    });

    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection successful");

    // Check if database file exists
    const fs = require("fs");
    const dbPath = path.resolve(__dirname, "../database.sqlite");
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(
        `✅ Database file exists (${Math.round(stats.size / 1024)}KB)`
      );
    } else {
      console.log("❌ Database file not found");
      return;
    }

    // List all tables
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log("\n📋 Database Tables:");
    tables.forEach((table) => {
      const isCreditTable = [
        "TokenUsages",
        "CreditCompensations",
        "CreditAuditLogs",
        "CreditRefreshHistories",
        "ModelPricings",
      ].includes(table);

      console.log(`   ${isCreditTable ? "🆕" : "📄"} ${table}`);
    });

    // Check credit system tables specifically
    const creditTables = [
      "TokenUsages",
      "CreditCompensations",
      "CreditAuditLogs",
      "CreditRefreshHistories",
      "ModelPricings",
    ];

    console.log("\n🔧 Credit System Tables Status:");
    for (const tableName of creditTables) {
      if (tables.includes(tableName)) {
        try {
          const [results] = await sequelize.query(
            `SELECT COUNT(*) as count FROM ${tableName}`
          );
          console.log(`   ✅ ${tableName}: ${results[0].count} records`);
        } catch (error) {
          console.log(`   ⚠️  ${tableName}: Table exists but query failed`);
        }
      } else {
        console.log(`   ❌ ${tableName}: Missing`);
      }
    }

    // Check Users table for credit columns
    console.log("\n👥 User Credit Columns:");
    try {
      const [userColumns] = await sequelize.query("PRAGMA table_info(Users)");
      const creditColumns = ["creditBalance", "lastCreditRefresh"];

      creditColumns.forEach((column) => {
        const columnExists = userColumns.some((col) => col.name === column);
        console.log(`   ${columnExists ? "✅" : "❌"} ${column}`);
      });

      // Check if users have credits initialized
      const [userCreditStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as totalUsers,
          COUNT(CASE WHEN creditBalance > 0 THEN 1 END) as usersWithCredits,
          AVG(creditBalance) as avgBalance,
          MAX(creditBalance) as maxBalance
        FROM Users
      `);

      if (userCreditStats[0]) {
        const stats = userCreditStats[0];
        console.log(`\n💰 User Credit Statistics:`);
        console.log(`   Total Users: ${stats.totalUsers}`);
        console.log(`   Users with Credits: ${stats.usersWithCredits}`);
        console.log(
          `   Average Balance: ${parseFloat(stats.avgBalance || 0).toFixed(2)}`
        );
        console.log(
          `   Maximum Balance: ${parseFloat(stats.maxBalance || 0).toFixed(2)}`
        );
      }
    } catch (error) {
      console.log("   ❌ Could not check user credit columns:", error.message);
    }

    // Check indexes
    console.log("\n📊 Database Indexes:");
    try {
      const [indexes] = await sequelize.query(`
        SELECT name, tbl_name 
        FROM sqlite_master 
        WHERE type = 'index' 
        AND name LIKE 'idx_%'
        ORDER BY tbl_name, name
      `);

      if (indexes.length > 0) {
        indexes.forEach((index) => {
          console.log(`   ✅ ${index.name} (${index.tbl_name})`);
        });
      } else {
        console.log("   ⚠️  No custom indexes found");
      }
    } catch (error) {
      console.log("   ❌ Could not check indexes:", error.message);
    }

    await sequelize.close();

    console.log("\n" + "=".repeat(50));
    console.log("🎯 Database Check Complete!");

    // Provide recommendations
    const missingTables = creditTables.filter(
      (table) => !tables.includes(table)
    );
    if (missingTables.length > 0) {
      console.log("\n⚠️  Issues Found:");
      console.log(`   Missing tables: ${missingTables.join(", ")}`);
      console.log("   💡 Restart the server to trigger table creation");
    } else {
      console.log("\n✅ All credit system tables are present!");
      console.log("   💡 You can now test the credit system endpoints");
    }
  } catch (error) {
    console.error("❌ Database check failed:", error.message);
    console.log("\n💡 Troubleshooting:");
    console.log("   1. Make sure the server has been started at least once");
    console.log("   2. Check that the database file has proper permissions");
    console.log(
      "   3. Verify the server.js file includes credit system initialization"
    );
  }
}

// Run the check
if (require.main === module) {
  checkDatabase().catch(console.error);
}

module.exports = checkDatabase;
