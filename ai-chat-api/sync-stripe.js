require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Database setup (same as server.js)
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "database.sqlite"),
  logging: console.log, // Enable logging for this sync
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

async function syncWithStripe() {
  try {
    console.log("🔄 Starting Stripe sync...");

    // Initialize database connection
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Get all Stripe customers with active subscriptions
    console.log("📋 Fetching Stripe customers...");

    let hasMore = true;
    let startingAfter = undefined;
    let totalCustomers = 0;
    let updatedUsers = 0;

    while (hasMore) {
      const customers = await stripe.customers.list({
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.subscriptions"],
      });

      for (const customer of customers.data) {
        totalCustomers++;

        if (!customer.email) {
          console.log(`⚠️  Customer ${customer.id} has no email, skipping...`);
          continue;
        }

        // Find user by email
        const user = await User.findOne({ where: { email: customer.email } });

        if (!user) {
          console.log(
            `⚠️  No user found for email: ${customer.email} (Stripe ID: ${customer.id})`
          );
          continue;
        }

        // Check if user already has correct Stripe customer ID
        if (user.stripeCustomerId === customer.id) {
          console.log(`✅ User ${user.email} already has correct Stripe ID`);
          continue;
        }

        // Get active subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: "active",
          limit: 1,
        });

        let subscriptionData = {
          stripeCustomerId: customer.id,
          subscriptionStatus: "free",
          subscriptionTier: "free",
          subscriptionEndsAt: null,
        };

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          subscriptionData = {
            stripeCustomerId: customer.id,
            subscriptionStatus: subscription.status,
            subscriptionTier:
              subscription.items.data[0].price.nickname || "pro",
            subscriptionEndsAt: new Date(
              subscription.current_period_end * 1000
            ),
          };

          console.log(`💰 Found active subscription for ${user.email}:`);
          console.log(`   - Status: ${subscription.status}`);
          console.log(`   - Tier: ${subscriptionData.subscriptionTier}`);
          console.log(`   - Ends: ${subscriptionData.subscriptionEndsAt}`);
        }

        // Update user with Stripe data
        await user.update(subscriptionData);
        updatedUsers++;

        console.log(
          `✅ Updated user: ${user.email} -> Stripe ID: ${customer.id}`
        );
      }

      hasMore = customers.has_more;
      if (hasMore) {
        startingAfter = customers.data[customers.data.length - 1].id;
      }
    }

    console.log("\n🎉 Sync completed!");
    console.log(`📊 Statistics:`);
    console.log(`   - Total Stripe customers processed: ${totalCustomers}`);
    console.log(`   - Users updated: ${updatedUsers}`);

    // Show current subscription summary
    const proUsers = await User.count({
      where: { subscriptionStatus: "active" },
    });
    const freeUsers = await User.count({
      where: { subscriptionStatus: "free" },
    });

    console.log(`\n📈 Current user subscription status:`);
    console.log(`   - Pro users: ${proUsers}`);
    console.log(`   - Free users: ${freeUsers}`);
  } catch (error) {
    console.error("❌ Sync failed:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the sync
if (require.main === module) {
  syncWithStripe()
    .then(() => {
      console.log("✅ Stripe sync completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Stripe sync failed:", error);
      process.exit(1);
    });
}

module.exports = { syncWithStripe };
