const { Sequelize } = require("sequelize");
const path = require("path");

async function listUsers() {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.resolve(__dirname, "database.sqlite"),
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const users = await sequelize.query(
      "SELECT id, email, username, creditBalance, subscriptionTier FROM Users ORDER BY createdAt DESC",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`\nFound ${users.length} users:`);
    console.log("=====================================");
    
    for (const user of users) {
      console.log(`Email: ${user.email}`);
      console.log(`Username: ${user.username || "(no username)"}`);
      console.log(`Credits: ${user.creditBalance}`);
      console.log(`Tier: ${user.subscriptionTier}`);
      console.log("-------------------------------------");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
}

listUsers();