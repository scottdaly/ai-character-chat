require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");

async function fixUserCredits() {
  // Initialize Sequelize with SQLite database
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.resolve(__dirname, "database.sqlite"),
    logging: false,
  });

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log("Connected to database");

    // Find user with email jacobwdaly@gmail.com
    const result = await sequelize.query(
      "SELECT id, email, username, creditBalance FROM Users WHERE email = :email",
      {
        replacements: { email: "jacobwdaly@gmail.com" },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (result.length === 0) {
      console.log("User not found");
      return;
    }

    const user = result[0];
    console.log("Found user:", {
      id: user.id,
      email: user.email,
      username: user.username,
      currentBalance: user.creditBalance,
    });

    // Update the user's credit balance to 1000
    await sequelize.query(
      'UPDATE Users SET creditBalance = 1000, lastCreditRefresh = :refreshDate WHERE id = :userId',
      {
        replacements: {
          userId: user.id,
          refreshDate: new Date(),
        },
        type: Sequelize.QueryTypes.UPDATE,
      }
    );

    console.log("Successfully updated user's credit balance to 1000");

    // Verify the update
    const verifyResult = await sequelize.query(
      'SELECT creditBalance FROM Users WHERE id = :userId',
      {
        replacements: { userId: user.id },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    console.log("Verified new balance:", verifyResult[0].creditBalance);

    // Also check for any other users with 0 credits and fix them
    const zeroBalanceUsers = await sequelize.query(
      'SELECT id, email, username, creditBalance FROM Users WHERE creditBalance = 0',
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (zeroBalanceUsers.length > 0) {
      console.log(`\nFound ${zeroBalanceUsers.length} users with 0 credits:`);
      for (const user of zeroBalanceUsers) {
        console.log(`- ${user.email} (${user.username || "no username"})`);
        
        // Update each user to have 1000 credits
        await sequelize.query(
          'UPDATE Users SET creditBalance = 1000, lastCreditRefresh = :refreshDate WHERE id = :userId',
          {
            replacements: {
              userId: user.id,
              refreshDate: new Date(),
            },
            type: Sequelize.QueryTypes.UPDATE,
          }
        );
      }
      console.log("Updated all users with 0 credits to have 1000 credits");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
}

// Run the fix
fixUserCredits();