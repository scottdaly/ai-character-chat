#!/usr/bin/env node

/**
 * Migration script to backfill creditsCharged field in TokenUsage table
 * This adds the creditsCharged field and sets it to ceiling of creditsUsed
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const { Sequelize, DataTypes } = require("sequelize");

// Database connection
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: process.env.DATABASE_PATH || "./database.sqlite",
  logging: false,
});

async function backfillCreditsCharged() {
  try {
    console.log("Starting creditsCharged backfill migration...");

    // First, check if the column already exists
    const tableInfo = await sequelize.query(
      "PRAGMA table_info(TokenUsages);",
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    const columnExists = tableInfo.some(col => col.name === "creditsCharged");
    
    if (!columnExists) {
      console.log("Adding creditsCharged column to TokenUsages table...");
      
      // Add the column with a default value
      await sequelize.query(`
        ALTER TABLE TokenUsages 
        ADD COLUMN creditsCharged INTEGER DEFAULT 1 NOT NULL
      `);
      
      console.log("Column added successfully.");
    } else {
      console.log("creditsCharged column already exists.");
    }

    // Now backfill the values
    console.log("Backfilling creditsCharged values...");
    
    // Get all records that need updating
    const records = await sequelize.query(
      `SELECT id, creditsUsed, creditsCharged 
       FROM TokenUsages 
       WHERE creditsCharged != CAST(creditsUsed + 0.999999 AS INTEGER)`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    console.log(`Found ${records.length} records to update.`);
    
    if (records.length > 0) {
      // Update in batches of 100
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        // Build update query for this batch
        const updates = batch.map(record => {
          const chargedValue = Math.ceil(parseFloat(record.creditsUsed));
          return `UPDATE TokenUsages SET creditsCharged = ${chargedValue} WHERE id = '${record.id}'`;
        });
        
        // Execute all updates in a transaction
        const transaction = await sequelize.transaction();
        try {
          for (const update of updates) {
            await sequelize.query(update, { transaction });
          }
          await transaction.commit();
          console.log(`Updated batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)}`);
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }
    }
    
    // Verify the update
    const verifyResult = await sequelize.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN creditsCharged = CAST(creditsUsed + 0.999999 AS INTEGER) THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN creditsCharged != CAST(creditsUsed + 0.999999 AS INTEGER) THEN 1 ELSE 0 END) as incorrect
       FROM TokenUsages`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    console.log("\nMigration complete!");
    console.log(`Total records: ${verifyResult[0].total}`);
    console.log(`Correctly updated: ${verifyResult[0].correct}`);
    console.log(`Failed updates: ${verifyResult[0].incorrect}`);
    
    // Show some examples
    const examples = await sequelize.query(
      `SELECT creditsUsed, creditsCharged 
       FROM TokenUsages 
       LIMIT 10`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    console.log("\nExample records:");
    console.log("creditsUsed -> creditsCharged");
    examples.forEach(ex => {
      console.log(`${ex.creditsUsed} -> ${ex.creditsCharged}`);
    });
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
backfillCreditsCharged();