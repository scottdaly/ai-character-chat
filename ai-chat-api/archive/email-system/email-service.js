const nodemailer = require("nodemailer");

// Email configuration
const createTransporter = () => {
  // You can use different email services:
  // 1. Gmail (for testing)
  // 2. SendGrid (recommended for production)
  // 3. Mailgun
  // 4. AWS SES

  if (process.env.EMAIL_SERVICE === "gmail") {
    return nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
      },
    });
  } else if (process.env.EMAIL_SERVICE === "sendgrid") {
    return nodemailer.createTransporter({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else if (process.env.EMAIL_SERVICE === "smtp") {
    // Generic SMTP (like for custom mail servers)
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return null;
};

// Email templates
const createWelcomeEmail = (customerName, subscriptionDetails) => {
  const { tier, amount, endDate } = subscriptionDetails;

  return {
    subject: "🎉 Welcome to Nevermade Pro!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .feature-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .feature-item { padding: 10px 0; border-bottom: 1px solid #eee; }
          .feature-item:last-child { border-bottom: none; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Nevermade Pro!</h1>
            <p>Thank you for upgrading your account</p>
          </div>
          
          <div class="content">
            <h2>Hi ${customerName}! 👋</h2>
            
            <p>Thank you for subscribing to Nevermade Pro! Your subscription is now active and you have access to all premium features.</p>
            
            <div class="feature-list">
              <h3>What's included in your Pro subscription:</h3>
              <div class="feature-item">✨ Unlimited conversations with all AI characters</div>
              <div class="feature-item">🤖 Access to advanced AI models (Claude, GPT-4, Gemini)</div>
              <div class="feature-item">🎨 Create unlimited custom characters</div>
              <div class="feature-item">📱 Priority customer support</div>
              <div class="feature-item">🚀 Early access to new features</div>
            </div>
            
            <p><strong>Subscription Details:</strong></p>
            <ul>
              <li>Plan: ${tier} ($${amount}/month)</li>
              <li>Next billing date: ${endDate}</li>
            </ul>
            
            <p>Ready to start chatting? Click below to explore your new features:</p>
            
            <a href="${process.env.FRONTEND_URL}" class="button">Start Chatting →</a>
            
            <p>If you have any questions or need help, feel free to reach out to our support team.</p>
            
            <p>Welcome to the Nevermade family! 🎊</p>
            
            <p>Best regards,<br>
            The Nevermade Team</p>
          </div>
          
          <div class="footer">
            <p>You received this email because you subscribed to Nevermade Pro.</p>
            <p>Questions? Reply to this email or visit our support center.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to Nevermade Pro!
      
      Hi ${customerName}!
      
      Thank you for subscribing to Nevermade Pro! Your subscription is now active.
      
      What's included:
      - Unlimited conversations with all AI characters
      - Access to advanced AI models (Claude, GPT-4, Gemini)
      - Create unlimited custom characters
      - Priority customer support
      - Early access to new features
      
      Subscription Details:
      - Plan: ${tier} ($${amount}/month)
      - Next billing date: ${endDate}
      
      Start chatting at: ${process.env.FRONTEND_URL}
      
      Welcome to the Nevermade family!
      
      Best regards,
      The Nevermade Team
    `,
  };
};

// Main email sending functions
const sendWelcomeEmail = async (
  customerEmail,
  customerName,
  subscriptionDetails
) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log("⚠️  No email service configured. Skipping welcome email.");
      return { success: false, reason: "No email service configured" };
    }

    const emailContent = createWelcomeEmail(customerName, subscriptionDetails);

    const mailOptions = {
      from: process.env.FROM_EMAIL || "noreply@nevermade.co",
      to: customerEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${customerEmail}`);

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Failed to send welcome email:", error);
    return { success: false, error: error.message };
  }
};

const sendReceiptEmail = async (
  customerEmail,
  customerName,
  receiptDetails
) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log("⚠️  No email service configured. Skipping receipt email.");
      return { success: false, reason: "No email service configured" };
    }

    const { amount, subscriptionId, invoiceUrl } = receiptDetails;

    const mailOptions = {
      from: process.env.FROM_EMAIL || "noreply@nevermade.co",
      to: customerEmail,
      subject: `Receipt for your Nevermade Pro subscription - $${amount}`,
      html: `
        <h2>Receipt for your Nevermade Pro subscription</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for your payment! Here are the details:</p>
        <ul>
          <li>Amount: $${amount}</li>
          <li>Subscription ID: ${subscriptionId}</li>
          <li>Date: ${new Date().toLocaleDateString()}</li>
        </ul>
        ${
          invoiceUrl
            ? `<p><a href="${invoiceUrl}">View detailed invoice</a></p>`
            : ""
        }
        <p>Thank you for being a Nevermade Pro subscriber!</p>
        <p>Best regards,<br>The Nevermade Team</p>
      `,
      text: `
        Receipt for your Nevermade Pro subscription
        
        Hi ${customerName},
        
        Thank you for your payment! Here are the details:
        - Amount: $${amount}
        - Subscription ID: ${subscriptionId}
        - Date: ${new Date().toLocaleDateString()}
        
        ${invoiceUrl ? `View detailed invoice: ${invoiceUrl}` : ""}
        
        Thank you for being a Nevermade Pro subscriber!
        
        Best regards,
        The Nevermade Team
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Receipt email sent to ${customerEmail}`);

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Failed to send receipt email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendReceiptEmail,
};
