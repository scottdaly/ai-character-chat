require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function configureStripeOnlyEmails() {
  try {
    console.log("📧 Configuring Stripe-only email solution...");

    // Check current email settings
    console.log("\n🔍 Current Stripe email settings:");

    // Get account settings
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Account: ${account.business_profile?.name || "Not set"}`);
    console.log(`📧 Support email: ${account.support_email || "Not set"}`);

    if (account.business_profile?.support_email) {
      console.log(
        `📞 Support email: ${account.business_profile.support_email}`
      );
    }

    console.log("\n💡 What Stripe automatically sends:");
    console.log("  ✅ Receipt emails for successful payments");
    console.log("  ✅ Invoice emails (PDF attached)");
    console.log("  ✅ Payment failure notifications");
    console.log("  ✅ Subscription renewal reminders");
    console.log("  ✅ Subscription cancellation confirmations");

    console.log("\n⚙️  To customize Stripe emails:");
    console.log("  1. Go to Stripe Dashboard → Settings → Emails");
    console.log("  2. Enable 'Send email receipts to customers'");
    console.log("  3. Customize email templates with your branding");
    console.log("  4. Set your business info in Settings → Business Settings");

    console.log("\n📋 Recommended Stripe email settings:");
    console.log("  • Enable receipt emails: ✅");
    console.log("  • Enable invoice emails: ✅");
    console.log("  • Add your logo and brand colors");
    console.log("  • Set custom footer text");
    console.log("  • Configure support contact info");

    console.log("\n🎯 This gives you:");
    console.log("  ✅ Professional emails");
    console.log("  ✅ Zero maintenance");
    console.log("  ✅ Reliable delivery");
    console.log("  ✅ Automatic translations");
    console.log("  ✅ Mobile-optimized");

    console.log("\n❌ Limitations:");
    console.log("  • No custom welcome emails");
    console.log("  • Limited template customization");
    console.log("  • No marketing emails");
    console.log("  • Stripe branding (though customizable)");

    console.log("\n🔧 Next steps for Stripe-only setup:");
    console.log("  1. Remove custom email code from webhook");
    console.log("  2. Ensure checkout sessions have receipt_email enabled");
    console.log("  3. Configure Stripe Dashboard email settings");
    console.log("  4. Test with a small payment");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

configureStripeOnlyEmails();
