const { Sequelize } = require("sequelize");
const path = require("path");

async function makeUserAdmin(email) {
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
      isAdmin: Sequelize.BOOLEAN,
    }, {
      tableName: "Users"
    });

    // Find and update user
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.error(`User with email "${email}" not found`);
      console.log("\nAvailable users:");
      const users = await User.findAll({ attributes: ["email", "isAdmin"] });
      users.forEach(u => console.log(`  - ${u.email} (admin: ${u.isAdmin})`));
      return;
    }

    // Update to admin
    await user.update({ isAdmin: true });
    console.log(`✓ Successfully made ${email} an admin`);

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await sequelize.close();
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.log("Usage: node makeUserAdmin.js <email>");
  console.log("Example: node makeUserAdmin.js test@example.com");
  process.exit(1);
}

makeUserAdmin(email);