require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Database setup (same as server.js)
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "database.sqlite"),
  logging: console.log,
});

// User model definition (same as server.js)
const User = sequelize.define("User", {
  googleId: { type: DataTypes.STRING, unique: true },
  displayName: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  profilePicture: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isOfficial: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  subscriptionStatus: {
    type: DataTypes.STRING,
    defaultValue: "free",
    allowNull: false,
  },
  subscriptionTier: {
    type: DataTypes.STRING,
    defaultValue: "free",
    allowNull: false,
  },
  subscriptionEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

async function recoverCustomerWithSubscription() {
  try {
    console.log("🔄 Starting customer recovery with subscription...");

    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Use the customer ID with the active subscription
    const stripeCustomerId = "cus_SPmub2JFMkOyPV";
    console.log(`🔍 Recovering customer: ${stripeCustomerId}`);

    // Get the customer from Stripe
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    console.log(`✅ Found customer in Stripe:`);
    console.log(`   - ID: ${customer.id}`);
    console.log(`   - Email: ${customer.email}`);
    console.log(`   - Name: ${customer.name || "N/A"}`);
    console.log(`   - Created: ${new Date(customer.created * 1000)}`);

    // Get their subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
    });

    console.log(`📊 Found ${subscriptions.data.length} subscription(s)`);

    let activeSubscription = null;
    for (const sub of subscriptions.data) {
      console.log(
        `   - Subscription ${sub.id}: ${sub.status} (created: ${new Date(
          sub.created * 1000
        )})`
      );
      if (sub.status === "active") {
        activeSubscription = sub;
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email: customer.email },
    });

    if (existingUser) {
      console.log(`👤 User already exists with ID: ${existingUser.id}`);

      // Update existing user with correct Stripe data
      let updateData = {
        stripeCustomerId: customer.id,
        subscriptionStatus: "free",
        subscriptionTier: "free",
        subscriptionEndsAt: null,
      };

      if (activeSubscription) {
        updateData.subscriptionStatus = activeSubscription.status;
        updateData.subscriptionTier =
          activeSubscription.items.data[0].price.nickname || "pro";
        updateData.subscriptionEndsAt = new Date(
          activeSubscription.current_period_end * 1000
        );

        console.log(`💰 Active subscription found:`);
        console.log(`   - Status: ${activeSubscription.status}`);
        console.log(`   - Tier: ${updateData.subscriptionTier}`);
        console.log(`   - Ends: ${updateData.subscriptionEndsAt}`);
      }

      await existingUser.update(updateData);
      console.log(`✅ Updated existing user with subscription data`);
    } else {
      // Create new user
      let userData = {
        email: customer.email,
        displayName: customer.name || customer.email.split("@")[0],
        googleId: `stripe_recovered_${customer.id}`, // Temporary Google ID
        stripeCustomerId: customer.id,
        subscriptionStatus: "free",
        subscriptionTier: "free",
        subscriptionEndsAt: null,
      };

      if (activeSubscription) {
        userData.subscriptionStatus = activeSubscription.status;
        userData.subscriptionTier =
          activeSubscription.items.data[0].price.nickname || "pro";
        userData.subscriptionEndsAt = new Date(
          activeSubscription.current_period_end * 1000
        );

        console.log(`💰 Active subscription found:`);
        console.log(`   - Status: ${activeSubscription.status}`);
        console.log(`   - Tier: ${userData.subscriptionTier}`);
        console.log(`   - Ends: ${userData.subscriptionEndsAt}`);
      }

      const user = await User.create(userData);
      console.log(`✅ Created new user with ID: ${user.id}`);
    }

    console.log("\n🎉 Customer recovery completed!");
    console.log(
      "⚠️  IMPORTANT: This user will need to sign in with Google to link their account properly."
    );
    console.log(
      "   When they sign in, the googleId will be updated to their actual Google ID."
    );
  } catch (error) {
    console.error("❌ Recovery failed:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the recovery
if (require.main === module) {
  recoverCustomerWithSubscription()
    .then(() => {
      console.log("✅ Customer recovery completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Customer recovery failed:", error);
      process.exit(1);
    });
}

module.exports = { recoverCustomerWithSubscription };
