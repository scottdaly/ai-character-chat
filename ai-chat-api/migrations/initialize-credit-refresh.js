#!/usr/bin/env node

/**
 * Migration script to initialize credit refresh dates for existing users
 * This staggers the refresh dates to avoid bulk processing
 */

require("dotenv").config();
const { Sequelize } = require("sequelize");
const path = require("path");

async function initializeCreditRefresh() {
  // Initialize Sequelize with SQLite database
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.resolve(__dirname, "..", "database.sqlite"),
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    // First, add the new columns if they don't exist
    console.log("Checking for new columns...");
    
    const tableInfo = await sequelize.query(
      "PRAGMA table_info(Users)",
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    const columnNames = tableInfo.map(col => col.name);
    
    // Add new columns if they don't exist
    if (!columnNames.includes('creditRefreshHold')) {
      console.log("Adding creditRefreshHold column...");
      await sequelize.query(
        "ALTER TABLE Users ADD COLUMN creditRefreshHold BOOLEAN DEFAULT 0 NOT NULL"
      );
    }
    
    if (!columnNames.includes('creditRefreshDay')) {
      console.log("Adding creditRefreshDay column...");
      await sequelize.query(
        "ALTER TABLE Users ADD COLUMN creditRefreshDay INTEGER"
      );
    }
    
    if (!columnNames.includes('customCreditAmount')) {
      console.log("Adding customCreditAmount column...");
      await sequelize.query(
        "ALTER TABLE Users ADD COLUMN customCreditAmount INTEGER"
      );
    }

    // Get all users who don't have a lastCreditRefresh date set
    const users = await sequelize.query(
      "SELECT id, email, username, createdAt, lastCreditRefresh FROM Users WHERE lastCreditRefresh IS NULL",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) {
      console.log("All users already have lastCreditRefresh dates set");
      return;
    }

    console.log(`Found ${users.length} users without lastCreditRefresh dates`);

    // Stagger the refresh dates across 30 days
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // Use user ID to determine stagger offset (0-29 days ago)
      const idHash = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const daysAgo = idHash % 30;
      
      // Set lastCreditRefresh to a staggered date in the past
      const refreshDate = new Date();
      refreshDate.setDate(refreshDate.getDate() - daysAgo);
      
      await sequelize.query(
        "UPDATE Users SET lastCreditRefresh = :refreshDate WHERE id = :userId",
        {
          replacements: {
            userId: user.id,
            refreshDate: refreshDate.toISOString()
          },
          type: Sequelize.QueryTypes.UPDATE
        }
      );
      
      console.log(`Set refresh date for ${user.email || user.username} to ${daysAgo} days ago`);
    }

    console.log("\nMigration completed successfully!");
    console.log("Users will be eligible for refresh at different times over the next 30 days");

    // Show distribution of refresh dates
    const distribution = await sequelize.query(
      `SELECT 
        DATE(lastCreditRefresh) as refreshDate, 
        COUNT(*) as userCount 
      FROM Users 
      WHERE lastCreditRefresh IS NOT NULL 
      GROUP BY DATE(lastCreditRefresh) 
      ORDER BY refreshDate`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log("\nRefresh date distribution:");
    distribution.forEach(row => {
      console.log(`  ${row.refreshDate}: ${row.userCount} users`);
    });

  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
initializeCreditRefresh();