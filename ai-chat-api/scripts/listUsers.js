const { Sequelize } = require("sequelize");
const path = require("path");

async function listUsers() {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.join(__dirname, "..", "database.sqlite"),
    logging: false,
  });

  try {
    // Define minimal User model
    const User = sequelize.define("User", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: Sequelize.STRING,
      username: Sequelize.STRING,
      isAdmin: Sequelize.BOOLEAN,
      createdAt: Sequelize.DATE
    }, {
      tableName: "Users"
    });

    // Get all users
    const users = await User.findAll({
      attributes: ["id", "email", "username", "isAdmin", "createdAt"],
      order: [["createdAt", "DESC"]]
    });

    console.log("\n=== All Users in Database ===\n");
    
    if (users.length === 0) {
      console.log("No users found in database.");
      return;
    }

    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Username: ${user.username || 'N/A'}`);
      console.log(`   Admin: ${user.isAdmin ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log(`   ID: ${user.id}`);
      console.log("");
    });

    console.log(`Total users: ${users.length}`);
    console.log(`Admins: ${users.filter(u => u.isAdmin).length}`);
    console.log("\nTo make a user admin, run:");
    console.log("node scripts/makeUserAdmin.js <email>");

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await sequelize.close();
  }
}

listUsers();