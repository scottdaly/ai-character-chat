require("dotenv").config();
const { sendWelcomeEmail, sendReceiptEmail } = require("./email-service");

async function testEmails() {
  console.log("🧪 Testing email service...");

  // Check if email service is configured
  if (!process.env.EMAIL_SERVICE) {
    console.log("❌ No EMAIL_SERVICE configured in .env file");
    console.log(
      "📝 Please see email-config-example.txt for setup instructions"
    );
    return;
  }

  console.log(`✅ Email service configured: ${process.env.EMAIL_SERVICE}`);

  // Test data
  const testEmail = process.env.TEST_EMAIL || "your-email@example.com";
  const testName = "Test User";

  console.log(`📧 Sending test emails to: ${testEmail}`);

  try {
    // Test welcome email
    console.log("\n1️⃣ Testing welcome email...");
    const welcomeResult = await sendWelcomeEmail(testEmail, testName, {
      tier: "pro",
      amount: 10,
      endDate: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toLocaleDateString(),
    });

    if (welcomeResult.success) {
      console.log("✅ Welcome email sent successfully!");
      console.log(`   Message ID: ${welcomeResult.messageId}`);
    } else {
      console.log("❌ Welcome email failed:");
      console.log(`   Reason: ${welcomeResult.reason || welcomeResult.error}`);
    }

    // Test receipt email
    console.log("\n2️⃣ Testing receipt email...");
    const receiptResult = await sendReceiptEmail(testEmail, testName, {
      amount: "10.00",
      subscriptionId: "sub_test_12345",
      invoiceUrl: "https://invoice.stripe.com/test",
    });

    if (receiptResult.success) {
      console.log("✅ Receipt email sent successfully!");
      console.log(`   Message ID: ${receiptResult.messageId}`);
    } else {
      console.log("❌ Receipt email failed:");
      console.log(`   Reason: ${receiptResult.reason || receiptResult.error}`);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }

  console.log("\n🎉 Email test completed!");
  console.log("\nNext steps:");
  console.log("1. Check your email inbox for the test emails");
  console.log("2. If you didn't receive them, check your spam folder");
  console.log("3. Verify your email service configuration in .env");
  console.log("4. For production, consider using SendGrid or similar service");
}

// Allow running with custom test email
if (process.argv[2]) {
  process.env.TEST_EMAIL = process.argv[2];
  console.log(`Using custom test email: ${process.argv[2]}`);
}

testEmails();
