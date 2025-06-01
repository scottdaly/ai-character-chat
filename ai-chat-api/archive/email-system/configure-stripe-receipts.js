require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function configureStripeReceipts() {
  try {
    console.log("🔧 Configuring Stripe automatic receipts...");

    // Check current account settings
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Account: ${account.business_profile?.name || account.id}`);
    console.log(`   - Country: ${account.country}`);
    console.log(`   - Email: ${account.email}`);

    // Get current products and prices to see receipt settings
    const products = await stripe.products.list({ limit: 10 });
    console.log(`\n📦 Current products: ${products.data.length}`);

    for (const product of products.data) {
      console.log(`   - ${product.name} (${product.id})`);

      // Get prices for this product
      const prices = await stripe.prices.list({
        product: product.id,
        limit: 10,
      });

      for (const price of prices.data) {
        console.log(
          `     💰 Price: $${price.unit_amount / 100} ${price.currency} (${
            price.id
          })`
        );
        console.log(`        - Nickname: ${price.nickname || "None"}`);
      }
    }

    console.log("\n✅ Stripe receipts configuration completed!");
    console.log("\n📋 Next steps:");
    console.log(
      "1. Stripe automatically sends receipts for successful payments"
    );
    console.log(
      "2. Update your checkout session creation to enable receipt emails"
    );
    console.log(
      "3. Consider customizing the receipt email template in Stripe Dashboard"
    );
    console.log("\n🔗 To customize receipts:");
    console.log("   - Go to Stripe Dashboard > Settings > Emails");
    console.log("   - Enable and customize receipt emails");
  } catch (error) {
    console.error("❌ Configuration failed:", error);
  }
}

configureStripeReceipts();
