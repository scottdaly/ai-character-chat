require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function checkStripeDetails() {
  try {
    console.log(
      "🔍 Checking all Stripe customers and their subscriptions...\n"
    );

    // Get all customers
    const customers = await stripe.customers.list({
      limit: 100,
    });

    for (const customer of customers.data) {
      console.log(`👤 Customer: ${customer.email || "No email"}`);
      console.log(`   - ID: ${customer.id}`);
      console.log(`   - Name: ${customer.name || "N/A"}`);
      console.log(`   - Created: ${new Date(customer.created * 1000)}`);

      // Get ALL subscriptions (including canceled, past_due, etc.)
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 100,
      });

      console.log(`   - Total subscriptions: ${allSubscriptions.data.length}`);

      for (const sub of allSubscriptions.data) {
        console.log(`     📋 Subscription ${sub.id}:`);
        console.log(`        - Status: ${sub.status}`);
        console.log(`        - Created: ${new Date(sub.created * 1000)}`);
        console.log(
          `        - Current period: ${new Date(
            sub.current_period_start * 1000
          )} to ${new Date(sub.current_period_end * 1000)}`
        );

        if (sub.items.data.length > 0) {
          const price = sub.items.data[0].price;
          console.log(
            `        - Price: ${price.nickname || price.id} ($${
              price.unit_amount / 100
            })`
          );
        }

        if (sub.canceled_at) {
          console.log(
            `        - Canceled: ${new Date(sub.canceled_at * 1000)}`
          );
        }

        if (sub.ended_at) {
          console.log(`        - Ended: ${new Date(sub.ended_at * 1000)}`);
        }
      }

      // Get payment methods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: "card",
      });

      if (paymentMethods.data.length > 0) {
        console.log(`   - Payment methods: ${paymentMethods.data.length}`);
        for (const pm of paymentMethods.data) {
          if (pm.card) {
            console.log(
              `     💳 Card: **** **** **** ${pm.card.last4} (${pm.card.brand})`
            );
          }
        }
      }

      // Get recent charges
      const charges = await stripe.charges.list({
        customer: customer.id,
        limit: 5,
      });

      if (charges.data.length > 0) {
        console.log(`   - Recent charges: ${charges.data.length}`);
        for (const charge of charges.data) {
          console.log(
            `     💰 Charge ${charge.id}: $${charge.amount / 100} - ${
              charge.status
            } (${new Date(charge.created * 1000)})`
          );
          if (charge.description) {
            console.log(`        Description: ${charge.description}`);
          }
        }
      }

      console.log("");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkStripeDetails();
