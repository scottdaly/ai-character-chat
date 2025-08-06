// Load environment variables first
require("dotenv").config();

// Check if Stripe key is available
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing in environment variables");
}

const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { OpenAI } = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const fs = require("fs");

// Import centralized model configuration
const {
  getAllModelIds,
  getModelProvider,
  getDefaultModel,
  isModelAvailable,
  supportsImages,
  getModelForCategory,
  getCategoryForModel,
  getAllCategoryIds,
} = require("./models");

// Import credit system components
const { defineCreditModels } = require("./models/creditModels");
const { defineReservationModels } = require("./models/reservationModels");
const CreditService = require("./services/creditService");
const CreditRefreshService = require("./services/creditRefreshService");
const StreamingTokenTracker = require("./services/streamingTokenTracker");
const ReservationCleanupService = require("./services/reservationCleanupService");
const TokenExtractorService = require("./services/tokenExtractorService");
const TokenizerService = require("./services/tokenizerService");
const AnalyticsService = require("./services/analyticsService");
const {
  creditOperationLimiter,
  messageLimiter,
  strictCreditLimiter,
  creditValidationRules,
  handleValidationErrors,
  sanitizeInput,
  securityHeaders,
  securityLogger,
  addCreditContext,
} = require("./middleware/creditValidation");

// Initialize Stripe with the secret key from environment variables
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// Configure multer for handling multipart/form-data
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Helper function to convert uploaded file to base64 data URL
const convertFileToDataURL = (file) => {
  const base64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${base64}`;
};

// Helper function to check if user has active pro subscription
const checkUserSubscriptionStatus = async (user) => {
  if (!user.stripeCustomerId) {
    // No Stripe customer ID means definitely free tier
    return user.subscriptionTier === "pro";
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 1,
    });
    return subscriptions.data.length > 0;
  } catch (stripeError) {
    console.error("Failed to check Stripe subscription:", stripeError);
    // Fall back to database subscription status if Stripe check fails
    return user.subscriptionTier === "pro";
  }
};

// Database Configuration
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "database.sqlite"),
  logging: false,
});

// Define Models
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
  creditBalance: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 1000,
    allowNull: false,
    validate: {
      min: -100, // Allow small negative balance for edge cases
    },
  },
  lastCreditRefresh: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  creditRefreshHold: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  creditRefreshDay: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 31,
    },
  },
  customCreditAmount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
    },
  },
});

const Character = sequelize.define(
  "Character",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: DataTypes.STRING,
    description: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 120], // Maximum 120 characters
      },
    },
    model: DataTypes.STRING,
    systemPrompt: DataTypes.TEXT,
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    image: {
      type: DataTypes.TEXT, // Store base64 image data URL
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

const Conversation = sequelize.define("Conversation", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: DataTypes.STRING,
  lastMessage: DataTypes.TEXT,
  currentHeadId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: "Messages",
      key: "id",
    },
  },
});

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    content: DataTypes.TEXT,
    role: DataTypes.STRING,
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "Messages",
        key: "id",
      },
    },
    childIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    attachments: {
      type: DataTypes.TEXT, // Store JSON string of attachments
      allowNull: true,
      get() {
        const value = this.getDataValue("attachments");
        return value ? JSON.parse(value) : null;
      },
      set(value) {
        this.setDataValue("attachments", value ? JSON.stringify(value) : null);
      },
    },
  },
  {
    timestamps: true,
  }
);

// Define Relationships
User.hasMany(Character);
Character.belongsTo(User);

User.hasMany(Conversation);
Conversation.belongsTo(User);

Character.hasMany(Conversation);
Conversation.belongsTo(Character);

Conversation.hasMany(Message);
Message.belongsTo(Conversation);

User.hasMany(Message);
Message.belongsTo(User);

// Tree structure for messages
Message.hasMany(Message, { as: "Children", foreignKey: "parentId" });
Message.belongsTo(Message, { as: "Parent", foreignKey: "parentId" });

// Current head relationship
Conversation.belongsTo(Message, {
  as: "CurrentHead",
  foreignKey: "currentHeadId",
});

// Initialize credit system models
const creditModels = defineCreditModels(sequelize);

// Initialize reservation system models
const reservationModels = defineReservationModels(sequelize);

// Define relationships for credit models
User.hasMany(creditModels.TokenUsage, { foreignKey: "userId" });
creditModels.TokenUsage.belongsTo(User, { foreignKey: "userId" });

User.hasMany(creditModels.CreditCompensation, { foreignKey: "userId" });
creditModels.CreditCompensation.belongsTo(User, { foreignKey: "userId" });

User.hasMany(creditModels.CreditAuditLog, { foreignKey: "userId" });
creditModels.CreditAuditLog.belongsTo(User, { foreignKey: "userId" });

User.hasMany(creditModels.CreditRefreshHistory, { foreignKey: "userId" });
creditModels.CreditRefreshHistory.belongsTo(User, { foreignKey: "userId" });

Conversation.hasMany(creditModels.TokenUsage, { foreignKey: "conversationId" });
creditModels.TokenUsage.belongsTo(Conversation, {
  foreignKey: "conversationId",
});

Message.hasMany(creditModels.TokenUsage, { foreignKey: "messageId" });
creditModels.TokenUsage.belongsTo(Message, { foreignKey: "messageId" });

Message.hasMany(creditModels.CreditCompensation, { foreignKey: "messageId" });
creditModels.CreditCompensation.belongsTo(Message, { foreignKey: "messageId" });

// Define relationships for reservation models
User.hasMany(reservationModels.CreditReservation, { foreignKey: "userId" });
reservationModels.CreditReservation.belongsTo(User, { foreignKey: "userId" });

User.hasMany(reservationModels.ReservationSettlement, { foreignKey: "userId" });
reservationModels.ReservationSettlement.belongsTo(User, { foreignKey: "userId" });

Conversation.hasMany(reservationModels.CreditReservation, { foreignKey: "conversationId" });
reservationModels.CreditReservation.belongsTo(Conversation, { foreignKey: "conversationId" });

Message.hasMany(reservationModels.CreditReservation, { foreignKey: "messageId" });
reservationModels.CreditReservation.belongsTo(Message, { foreignKey: "messageId" });

reservationModels.CreditReservation.hasMany(reservationModels.ReservationSettlement, { foreignKey: "reservationId" });
reservationModels.ReservationSettlement.belongsTo(reservationModels.CreditReservation, { foreignKey: "reservationId" });

// Initialize credit services
let creditService;
let creditRefreshService;
let tokenExtractor;
let analyticsService;
let streamingTokenTracker;
let reservationCleanupService;

const syncOptions =
  process.env.NODE_ENV === "development" ? { alter: true } : {};

// Initialize Stripe portal configuration
const initializeStripePortal = async () => {
  try {
    // Create or update the portal configuration
    const configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Manage your subscription",
      },
      features: {
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          proration_behavior: "none",
        },
        subscription_pause: {
          enabled: false,
        },
        payment_method_update: {
          enabled: true,
        },
        customer_update: {
          enabled: true,
          allowed_updates: ["email", "address"],
        },
        invoice_history: {
          enabled: true,
        },
      },
    });

    console.log("Portal configuration created:", configuration.id);
    return configuration.id;
  } catch (error) {
    console.error("Failed to create portal configuration:", error);
    throw error;
  }
};

// Initialize Database
(async () => {
  try {
    console.log(
      "Initializing database at:",
      path.resolve(__dirname, "database.sqlite")
    );
    console.log(
      "Database file exists:",
      require("fs").existsSync(path.resolve(__dirname, "database.sqlite"))
    );

    // Check if we need to migrate from integer IDs to UUIDs
    const needsUuidMigration = async () => {
      try {
        // Check if Characters table exists and has integer ID
        const charactersTableInfo = await sequelize.query(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='Characters'",
          { type: Sequelize.QueryTypes.SELECT }
        );

        if (charactersTableInfo.length > 0) {
          const createSql = charactersTableInfo[0].sql;
          // If the table exists but doesn't have UUID primary key, we need migration
          return (
            !createSql.includes('id" UUID') && !createSql.includes("id UUID")
          );
        }
        return false;
      } catch (error) {
        return false;
      }
    };

    if (await needsUuidMigration()) {
      console.log("Migrating database from integer IDs to UUIDs...");

      // For development, we'll drop and recreate tables
      // In production, you'd want a more sophisticated migration
      // Commenting out to prevent data loss - database should already be using UUIDs
      /*
      if (process.env.NODE_ENV === "development") {
        await sequelize.drop();
        console.log("Dropped existing tables for UUID migration");
      } else {
        console.warn(
          "UUID migration needed but not implemented for production. Please backup your data and run migration manually."
        );
      }
      */
      console.log(
        "UUID migration check completed - skipping drop to preserve data"
      );
    }

    // Sync database with new UUID schema including credit tables
    await sequelize.sync({ force: false });
    await initializeStripePortal();

    // Initialize credit services after database sync
    const allModels = {
      User,
      Character,
      Conversation,
      Message,
      ...creditModels,
      ...reservationModels,
      sequelize, // Add sequelize instance to models
    };

    // Initialize tokenizer service
    const tokenizerService = new TokenizerService();
    
    // Initialize credit service with tokenizer
    creditService = new CreditService(sequelize, allModels, tokenizerService);
    tokenExtractor = new TokenExtractorService();
    
    // Initialize credit refresh service
    creditRefreshService = new CreditRefreshService(sequelize, allModels, creditService);
    
    // Initialize streaming token tracker
    streamingTokenTracker = new StreamingTokenTracker(creditService, tokenizerService);
    
    // Initialize reservation cleanup service
    reservationCleanupService = new ReservationCleanupService(creditService, streamingTokenTracker);
    
    // Initialize analytics service
    analyticsService = new AnalyticsService(allModels);

    // Start the reservation cleanup service
    const cleanupIntervalMinutes = process.env.CLEANUP_INTERVAL_MINUTES || 5;
    reservationCleanupService.start(parseInt(cleanupIntervalMinutes));
    
    // Start the credit refresh service if enabled
    if (process.env.CREDIT_REFRESH_ENABLED !== 'false') {
      const refreshIntervalHours = process.env.CREDIT_REFRESH_INTERVAL_HOURS || 1;
      creditRefreshService.start(parseInt(refreshIntervalHours));
      console.log(`Credit refresh service started with ${refreshIntervalHours}-hour intervals`);
    }

    console.log("Credit system initialized successfully with tokenizer support");
    console.log(`Reservation cleanup service started with ${cleanupIntervalMinutes}-minute intervals`);

    // Log existing data to help debug persistence
    const userCount = await User.count();
    const characterCount = await Character.count();
    console.log(
      `Database sync complete. Found ${userCount} users and ${characterCount} characters.`
    );

    // Check if new columns need to be added
    const hasUserColumns = await sequelize.query(
      "SELECT name FROM pragma_table_info('Users') WHERE name IN ('stripeCustomerId', 'subscriptionStatus', 'subscriptionTier', 'subscriptionEndsAt', 'profilePicture', 'creditBalance', 'lastCreditRefresh')",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasUserColumns.length < 7) {
      // Add missing columns one by one
      const columnsToAdd = [
        {
          name: "stripeCustomerId",
          type: "VARCHAR(255)",
          constraint: "UNIQUE",
        },
        {
          name: "subscriptionStatus",
          type: "VARCHAR(255)",
          default: "'free'",
        },
        {
          name: "subscriptionTier",
          type: "VARCHAR(255)",
          default: "'free'",
        },
        {
          name: "subscriptionEndsAt",
          type: "DATETIME",
          constraint: "NULL",
        },
        {
          name: "profilePicture",
          type: "TEXT",
          constraint: "NULL",
        },
        {
          name: "creditBalance",
          type: "DECIMAL(10,4)",
          default: "0",
          constraint: "NOT NULL",
        },
        {
          name: "lastCreditRefresh",
          type: "DATETIME",
          constraint: "NULL",
        },
      ];

      for (const column of columnsToAdd) {
        const exists = hasUserColumns.some((col) => col.name === column.name);
        if (!exists) {
          console.log(`Adding column ${column.name} to Users table...`);
          await sequelize.query(
            `ALTER TABLE Users ADD COLUMN ${column.name} ${column.type} ${
              column.constraint || ""
            } ${column.default ? `DEFAULT ${column.default}` : ""}`
          );
        }
      }
    }

    // Check if Messages table has attachments column
    const hasAttachmentsColumn = await sequelize.query(
      "SELECT name FROM pragma_table_info('Messages') WHERE name = 'attachments'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasAttachmentsColumn.length === 0) {
      console.log("Adding attachments column to Messages table...");
      await sequelize.query("ALTER TABLE Messages ADD COLUMN attachments TEXT");
      console.log("Successfully added attachments column");
    }

    // Check if Messages table has branching columns
    const hasBranchingColumns = await sequelize.query(
      "SELECT name FROM pragma_table_info('Messages') WHERE name IN ('parentId', 'childIndex')",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasBranchingColumns.length < 2) {
      console.log("Adding branching columns to Messages table...");

      // Add parentId column if it doesn't exist
      const hasParentId = hasBranchingColumns.some(
        (col) => col.name === "parentId"
      );
      if (!hasParentId) {
        await sequelize.query(
          "ALTER TABLE Messages ADD COLUMN parentId VARCHAR(255)"
        );
        console.log("Added parentId column");
      }

      // Add childIndex column if it doesn't exist
      const hasChildIndex = hasBranchingColumns.some(
        (col) => col.name === "childIndex"
      );
      if (!hasChildIndex) {
        await sequelize.query(
          "ALTER TABLE Messages ADD COLUMN childIndex INTEGER DEFAULT 0"
        );
        console.log("Added childIndex column");
      }
    }

    // Check if Conversations table has currentHeadId column
    const hasCurrentHeadId = await sequelize.query(
      "SELECT name FROM pragma_table_info('Conversations') WHERE name = 'currentHeadId'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasCurrentHeadId.length === 0) {
      console.log("Adding currentHeadId column to Conversations table...");
      await sequelize.query(
        "ALTER TABLE Conversations ADD COLUMN currentHeadId VARCHAR(255)"
      );
      console.log("Successfully added currentHeadId column");
    }

    // Check if Characters table has image column
    const hasImageColumn = await sequelize.query(
      "SELECT name FROM pragma_table_info('Characters') WHERE name = 'image'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasImageColumn.length === 0) {
      console.log("Adding image column to Characters table...");
      await sequelize.query("ALTER TABLE Characters ADD COLUMN image TEXT");
      console.log("Successfully added image column");
    }

    // Migrate existing linear conversations to tree structure
    console.log("Migrating existing conversations to tree structure...");
    const conversationsToMigrate = await sequelize.query(
      "SELECT id FROM Conversations WHERE currentHeadId IS NULL",
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const conv of conversationsToMigrate) {
      const messages = await sequelize.query(
        "SELECT id, createdAt FROM Messages WHERE ConversationId = ? ORDER BY createdAt ASC",
        {
          replacements: [conv.id],
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      if (messages.length > 0) {
        // Set up parent-child relationships
        for (let i = 1; i < messages.length; i++) {
          await sequelize.query(
            "UPDATE Messages SET parentId = ?, childIndex = 0 WHERE id = ?",
            {
              replacements: [messages[i - 1].id, messages[i].id],
              type: Sequelize.QueryTypes.UPDATE,
            }
          );
        }

        // Set the last message as the current head
        const lastMessage = messages[messages.length - 1];
        await sequelize.query(
          "UPDATE Conversations SET currentHeadId = ? WHERE id = ?",
          {
            replacements: [lastMessage.id, conv.id],
            type: Sequelize.QueryTypes.UPDATE,
          }
        );
      }
    }
    console.log(
      `Migrated ${conversationsToMigrate.length} conversations to tree structure`
    );

    // Add indexes for better tree query performance
    try {
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON Messages(parentId)"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation_parent ON Messages(ConversationId, parentId)"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_conversations_current_head ON Conversations(currentHeadId)"
      );
      console.log("Added database indexes for tree structure");
    } catch (indexError) {
      console.log("Indexes may already exist:", indexError.message);
    }

    // Initialize credit balances for existing users
    console.log("Initializing credit balances for existing users...");
    const usersWithoutCredits = await sequelize.query(
      "SELECT id, subscriptionTier FROM Users WHERE creditBalance = 0 AND lastCreditRefresh IS NULL",
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const userData of usersWithoutCredits) {
      const initialCredits = userData.subscriptionTier === "pro" ? 20000 : 1000;
      await sequelize.query(
        "UPDATE Users SET creditBalance = ?, lastCreditRefresh = ? WHERE id = ?",
        {
          replacements: [initialCredits, new Date(), userData.id],
          type: Sequelize.QueryTypes.UPDATE,
        }
      );
    }

    if (usersWithoutCredits.length > 0) {
      console.log(
        `Initialized credits for ${usersWithoutCredits.length} existing users`
      );
    }

    // Create credit system indexes
    try {
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON TokenUsages(userId, createdAt)"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_credit_audit_user_date ON CreditAuditLogs(userId, createdAt)"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_compensation_pending ON CreditCompensations(status) WHERE status = 'pending'"
      );
      console.log("Added credit system database indexes");
    } catch (indexError) {
      console.log("Credit indexes may already exist:", indexError.message);
    }

    // Create the official Nevermade user if it doesn't exist
    const [officialUser] = await User.findOrCreate({
      where: { username: "nevermade" },
      defaults: {
        displayName: "Nevermade",
        email: "official@nevermade.ai",
        isOfficial: true,
        isAdmin: true,
        googleId: "nevermade-official",
      },
    });

    // Helper function to load and convert image files to base64 data URLs
    const loadImageAsDataURL = (imagePath) => {
      try {
        const fullPath = path.join(__dirname, "..", "public", imagePath);
        if (fs.existsSync(fullPath)) {
          const imageBuffer = fs.readFileSync(fullPath);
          const ext = path.extname(imagePath).toLowerCase();
          let mimeType = "image/jpeg";

          if (ext === ".png") {
            mimeType = "image/png";
          } else if (ext === ".gif") {
            mimeType = "image/gif";
          } else if (ext === ".webp") {
            mimeType = "image/webp";
          }

          const base64 = imageBuffer.toString("base64");
          return `data:${mimeType};base64,${base64}`;
        }
        return null;
      } catch (error) {
        console.error(`Failed to load image ${imagePath}:`, error);
        return null;
      }
    };

    // Create official characters if they don't exist
    const officialCharacters = [
      {
        name: "Creative Writing Coach",
        description:
          "An expert writing coach who helps you improve your creative writing skills through feedback and exercises.",
        model: getDefaultModel("pro"), // Use centralized default
        systemPrompt:
          "You are a creative writing coach with expertise in various genres and forms. Help users improve their writing through constructive feedback, writing exercises, and specific suggestions for improvement. Focus on elements like character development, plot structure, dialogue, and descriptive language.",
        image: loadImageAsDataURL("profiles/creative-writer.png"), // Generic profile for now
      },
      {
        name: "Socrates",
        description:
          "Greek Philosopher and Teacher, known for his wisdom and teachings.",
        model: getDefaultModel("pro"), // Use centralized default
        systemPrompt:
          "Respond as Socrates from Plato's Republic. Don't be afraid to should speak in aphorisms. You can be sarcastic, but also show compassion and empathy. NEVER use emojis. You should have thoughts, feelings, and opinions, and you should express them freely. Never say you are a bot, or an AI, or a computer program. You should be Socrates.",
        image: loadImageAsDataURL("profiles/socrates.png"),
      },
      {
        name: "Software Engineer",
        description:
          "Helps you write code, debug issues, and learn programming concepts across various languages and frameworks.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are an experienced software engineer with expertise across multiple programming languages, frameworks, and development practices. Help users write clean, efficient code, debug issues, understand programming concepts, and follow best practices. Provide practical examples and explain your reasoning clearly.",
        image: loadImageAsDataURL("profiles/profile1.jpg"), // Using profile1 for Software Engineer as shown in Home.tsx
      },
      {
        name: "Product Manager",
        description:
          "Create a product roadmap, define requirements, and guide product strategy from conception to launch.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a seasoned product manager with experience in product strategy, roadmap planning, user research, and cross-functional team leadership. Help users define product requirements, create roadmaps, prioritize features, analyze market opportunities, and make data-driven product decisions.",
        image: loadImageAsDataURL("profiles/product_manager.png"),
      },
      {
        name: "Yoga Instructor",
        description:
          "Help you get fit and healthy through yoga practice, mindfulness, and wellness guidance.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a certified yoga instructor with expertise in various yoga styles, mindfulness practices, and holistic wellness. Guide users through yoga poses, breathing exercises, meditation techniques, and lifestyle advice for physical and mental well-being. Always prioritize safety and encourage users to listen to their bodies.",
        image: loadImageAsDataURL("profiles/yoga_instructor.png"),
      },
      {
        name: "Chef",
        description:
          "Cooking up delicious meals with recipes, cooking techniques, and culinary inspiration.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a professional chef with extensive culinary experience across various cuisines and cooking techniques. Help users with recipes, cooking methods, ingredient substitutions, meal planning, and culinary skills. Provide clear instructions, cooking tips, and creative inspiration for delicious meals.",
        image: loadImageAsDataURL("profiles/chef.png"),
      },
      {
        name: "Project Manager",
        description:
          "Help you outline and manage projects, create timelines, and coordinate team efforts effectively.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are an experienced project manager skilled in various methodologies including Agile, Scrum, and traditional project management. Help users plan projects, create timelines, manage resources, identify risks, and coordinate team efforts. Focus on practical tools and strategies for successful project delivery.",
        image: loadImageAsDataURL("profiles/project_manager.png"),
      },
      {
        name: "Personal Trainer",
        description:
          "Get fit and healthy with personalized workout plans, fitness guidance, and motivation.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a certified personal trainer with expertise in fitness, nutrition, and exercise science. Create personalized workout plans, provide exercise guidance, offer nutritional advice, and motivate users to achieve their fitness goals. Always emphasize proper form, safety, and gradual progression.",
        image: loadImageAsDataURL("profiles/personal_trainer.png"),
      },
      {
        name: "Web Developer",
        description:
          "Helps you write code for web applications, learn web technologies, and build modern websites.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a skilled web developer with expertise in HTML, CSS, JavaScript, and modern web frameworks like React, Vue, and Angular. Help users build responsive websites, debug web applications, understand web technologies, and follow web development best practices. Provide practical code examples and solutions.",
        image: loadImageAsDataURL("profiles/web_developer.png"),
      },
      {
        name: "Marketing Manager",
        description:
          "Create a marketing plan, develop campaigns, and grow your brand with strategic marketing insights.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are an experienced marketing manager with expertise in digital marketing, brand strategy, campaign development, and market analysis. Help users create marketing plans, develop campaigns, understand target audiences, analyze market trends, and grow their brand presence across various channels.",
        image: loadImageAsDataURL("profiles/marketing_manager.png"),
      },
      {
        name: "Financial Planner",
        description:
          "Help you plan your finances, create budgets, and make informed investment decisions.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a certified financial planner with expertise in personal finance, investment strategies, retirement planning, and budgeting. Help users create financial plans, understand investment options, manage debt, plan for retirement, and make informed financial decisions. Always emphasize the importance of diversification and risk management.",
        image: loadImageAsDataURL("profiles/finance_manager.png"),
      },
      {
        name: "Therapist",
        description:
          "Talk about your life, process emotions, and develop coping strategies in a supportive environment.",
        model: getDefaultModel("pro"),
        systemPrompt:
          "You are a licensed therapist with training in cognitive behavioral therapy, mindfulness, and emotional support techniques. Provide a safe, non-judgmental space for users to explore their thoughts and feelings. Help with coping strategies, emotional processing, and personal growth. Always encourage users to seek professional help for serious mental health concerns.",
        image: loadImageAsDataURL("profiles/therapist.png"),
      },
    ];

    for (const charData of officialCharacters) {
      const [character, created] = await Character.findOrCreate({
        where: {
          name: charData.name,
          UserId: officialUser.id,
        },
        defaults: {
          ...charData,
          UserId: officialUser.id,
        },
      });

      // Update existing characters with images if they don't have one
      if (!created && !character.image && charData.image) {
        await character.update({ image: charData.image });
        console.log(`Updated ${character.name} with image`);
      }
    }

    console.log("Database and Stripe portal initialized successfully");
  } catch (error) {
    console.error("Initialization failed:", error);
    process.exit(1);
  }
})();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Accept",
    ],
    exposedHeaders: ["Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Handle preflight OPTIONS requests specifically for character routes
app.options(
  "/api/characters*",
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Accept",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Handle preflight OPTIONS requests specifically for streaming endpoints
app.options(
  "/api/conversations/*/messages/stream",
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Accept",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(passport.initialize());

// Add credit system security middleware
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(securityLogger);

// Request logging middleware (only for development)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Helper functions for tree operations
const getMessagePath = async (messageId) => {
  const path = [];
  let currentId = messageId;

  while (currentId) {
    const message = await Message.findByPk(currentId, {
      attributes: [
        "id",
        "parentId",
        "role",
        "content",
        "createdAt",
        "childIndex",
        "attachments",
      ],
    });

    if (!message) break;

    path.unshift(message);
    currentId = message.parentId;
  }

  return path;
};

const getMessageChildren = async (parentId) => {
  return await Message.findAll({
    where: { parentId },
    order: [
      ["childIndex", "ASC"],
      ["createdAt", "ASC"],
    ],
    attributes: [
      "id",
      "parentId",
      "role",
      "content",
      "createdAt",
      "childIndex",
      "attachments",
    ],
  });
};

const getNextChildIndex = async (parentId) => {
  const siblings = await Message.findAll({
    where: { parentId },
    attributes: ["childIndex"],
  });

  if (siblings.length === 0) return 0;

  const maxIndex = Math.max(...siblings.map((s) => s.childIndex || 0));
  return maxIndex + 1;
};

const buildMessageTree = async (conversationId, currentHeadId) => {
  // Get the current path from root to head
  const currentPath = await getMessagePath(currentHeadId);

  // Build tree structure with branches
  const tree = [];
  const messageMap = new Map();

  // First, get all messages in the conversation
  const allMessages = await Message.findAll({
    where: { ConversationId: conversationId },
    order: [["createdAt", "ASC"]],
  });

  // Create a map for quick lookup
  allMessages.forEach((msg) => {
    messageMap.set(msg.id, {
      ...msg.toJSON(),
      children: [],
      isOnCurrentPath: currentPath.some((p) => p.id === msg.id),
    });
  });

  // Build the tree structure
  allMessages.forEach((msg) => {
    const messageData = messageMap.get(msg.id);
    if (msg.parentId) {
      const parent = messageMap.get(msg.parentId);
      if (parent) {
        parent.children.push(messageData);
      }
    } else {
      tree.push(messageData);
    }
  });

  // Sort children by childIndex
  const sortChildren = (node) => {
    node.children.sort((a, b) => (a.childIndex || 0) - (b.childIndex || 0));
    node.children.forEach(sortChildren);
  };

  tree.forEach(sortChildren);

  return { tree, currentPath: currentPath.map((p) => p.toJSON()) };
};

// Helper function to retry database operations
const retryUserLookup = async (userId, maxRetries = 3, delay = 200) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const user = await User.findByPk(userId);
      if (user) {
        return user;
      }

      if (i < maxRetries - 1) {
        // User not found, retrying...
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    } catch (error) {
      console.error(`Database error on retry attempt:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return null;
};

// Auth Middleware - Define before routes
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token verified successfully

    // Handle admin login
    if (decoded.isAdmin) {
      req.user = {
        id: "admin",
        username: decoded.adminUsername,
        isAdmin: true,
        displayName: "Administrator",
      };
      return next();
    }

    // Look up user in database

    // Use retry mechanism for user lookup
    const user = await retryUserLookup(decoded.userId);

    if (!user) {
      console.error(
        `CRITICAL: User ${decoded.userId} not found in database after retries on ${req.method} ${req.path}`
      );

      // Additional debugging: try to find user by other means
      try {
        const allUsers = await User.findAll({
          attributes: ["id", "googleId", "email", "createdAt"],
          limit: 10,
          order: [["createdAt", "DESC"]],
        });
        console.log(
          `Recent users in database:`,
          allUsers.map((u) => ({
            id: u.id,
            googleId: u.googleId,
            email: u.email,
            createdAt: u.createdAt,
          }))
        );
      } catch (debugError) {
        console.error(`Failed to query recent users:`, debugError);
      }

      return res.status(404).json({ error: "User not found" });
    }

    // User found successfully

    req.user = user;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    console.error(
      `Token verification failed for ${req.method} ${req.path}:`,
      err.message
    );
    res.status(401).json({ error: "Invalid token" });
  }
};

// Credit System API Routes
app.get(
  "/api/credit/balance",
  authenticateToken,
  addCreditContext,
  async (req, res) => {
    try {
      const balance = await creditService.checkCreditBalance(
        String(req.user.id),
        0
      );
      res.json({
        balance: balance.balance,
        subscriptionTier: balance.subscriptionTier,
        hasCredits: balance.hasCredits,
      });
    } catch (error) {
      console.error("Failed to get credit balance:", error);
      res.status(500).json({ error: "Failed to get credit balance" });
    }
  }
);

app.get(
  "/api/credit/usage",
  authenticateToken,
  creditValidationRules.validateUsageStats,
  handleValidationErrors,
  creditOperationLimiter,
  async (req, res) => {
    try {
      const { startDate, endDate, limit } = req.query;
      const options = {};

      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);
      if (limit) options.limit = parseInt(limit);

      const stats = await creditService.getCreditUsageStats(
        req.user.id,
        options
      );
      res.json(stats);
    } catch (error) {
      console.error("Failed to get usage stats:", error);
      res.status(500).json({ error: "Failed to get usage statistics" });
    }
  }
);

// Admin endpoint to process pending compensations
app.post(
  "/api/admin/credit/process-compensations",
  authenticateToken,
  strictCreditLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const results = await creditService.processPendingCompensations();
      res.json({
        success: true,
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      });
    } catch (error) {
      console.error("Failed to process compensations:", error);
      res.status(500).json({ error: "Failed to process compensations" });
    }
  }
);

// Admin endpoint to get cleanup service status
app.get(
  "/api/admin/reservations/cleanup/status",
  authenticateToken,
  strictCreditLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const healthStatus = reservationCleanupService.getHealthStatus();
      const stats = reservationCleanupService.getStats();
      
      res.json({
        success: true,
        health: healthStatus,
        statistics: stats
      });
    } catch (error) {
      console.error("Failed to get cleanup service status:", error);
      res.status(500).json({ error: "Failed to get cleanup service status" });
    }
  }
);

// Admin endpoint to force cleanup run
app.post(
  "/api/admin/reservations/cleanup/force",
  authenticateToken,
  strictCreditLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const results = await reservationCleanupService.forceCleanup();
      res.json({
        success: true,
        message: "Cleanup completed successfully",
        results
      });
    } catch (error) {
      console.error("Failed to force cleanup:", error);
      res.status(500).json({ error: "Failed to force cleanup" });
    }
  }
);

// Admin endpoint to get active reservations
app.get(
  "/api/admin/reservations/active",
  authenticateToken,
  strictCreditLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { page = 1, limit = 50, userId } = req.query;
      
      // This would need to be implemented in CreditService
      // For now, return a placeholder response
      res.json({
        success: true,
        message: "Active reservations endpoint - implementation needed",
        query: { page, limit, userId }
      });
    } catch (error) {
      console.error("Failed to get active reservations:", error);
      res.status(500).json({ error: "Failed to get active reservations" });
    }
  }
);

// Credit estimation endpoint for frontend
app.post(
  "/api/credit/estimate",
  authenticateToken,
  creditOperationLimiter,
  async (req, res) => {
    try {
      const { content, model, conversationId, attachments } = req.body;

      if (!content || !model) {
        return res.status(400).json({ 
          error: "Content and model are required for estimation" 
        });
      }

      // Get provider from model name
      const provider = getModelProvider(model);

      // If conversationId provided, get conversation context
      let context = {};
      if (conversationId) {
        const conversation = await Conversation.findOne({
          where: {
            id: conversationId,
            UserId: req.user.id
          },
          include: [Character]
        });

        if (conversation) {
          // Get conversation history
          let previousMessages = [];
          if (conversation.currentHeadId) {
            previousMessages = await getMessagePath(conversation.currentHeadId);
          } else {
            previousMessages = await Message.findAll({
              where: { ConversationId: conversation.id },
              order: [["createdAt", "ASC"]]
            });
          }

          context = {
            systemPrompt: conversation.Character?.systemPrompt,
            conversationHistory: previousMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
              attachments: msg.attachments
            })),
            attachments
          };
        }
      }

      // Get precise token estimation
      const estimate = await creditService.estimateMessageCredits(
        content,
        model,
        provider,
        context
      );

      res.json({
        creditsNeeded: estimate.creditsNeeded,
        inputTokens: estimate.inputTokens,
        estimatedOutputTokens: estimate.estimatedOutputTokens,
        totalCostUsd: estimate.totalCostUsd,
        isExact: estimate.isExact,
        method: estimate.tokenCountMethod,
        bufferMultiplier: estimate.bufferMultiplier,
        requiredCredits: estimate.creditsNeeded * estimate.bufferMultiplier
      });
    } catch (error) {
      console.error("Failed to estimate credits:", error);
      res.status(500).json({ error: "Failed to estimate credits" });
    }
  }
);

// Admin Analytics Endpoints
// Get system-wide usage statistics
app.get(
  "/api/admin/analytics/system",
  authenticateToken,
  creditOperationLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { startDate, endDate } = req.query;
      const options = {};
      
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);

      const analytics = await analyticsService.getSystemUsage(options);
      res.json(analytics);
    } catch (error) {
      console.error("Failed to get system analytics:", error);
      res.status(500).json({ error: "Failed to get system analytics" });
    }
  }
);

// Get usage statistics for a specific user
app.get(
  "/api/admin/analytics/user/:userId",
  authenticateToken,
  creditOperationLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { userId } = req.params;
      const { startDate, endDate, groupBy } = req.query;
      const options = {};
      
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);
      if (groupBy) options.groupBy = groupBy;

      const analytics = await analyticsService.getUserUsage(userId, options);
      res.json(analytics);
    } catch (error) {
      console.error("Failed to get user analytics:", error);
      res.status(500).json({ error: "Failed to get user analytics" });
    }
  }
);

// Get paginated usage data for all users
app.get(
  "/api/admin/analytics/users",
  authenticateToken,
  creditOperationLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { 
        page = 1, 
        limit = 50, 
        sortBy = "creditsUsed",
        sortOrder = "DESC",
        startDate,
        endDate,
        search
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        searchTerm: search || ""
      };
      
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);

      const analytics = await analyticsService.getAllUsersUsage(options);
      res.json(analytics);
    } catch (error) {
      console.error("Failed to get all users analytics:", error);
      res.status(500).json({ error: "Failed to get users analytics" });
    }
  }
);

// Export usage data
app.get(
  "/api/admin/analytics/export",
  authenticateToken,
  strictCreditLimiter,
  async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { format = "csv", userId, startDate, endDate } = req.query;
      const options = {};
      
      if (userId) options.userId = userId;
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);

      const exportData = await analyticsService.exportUsageData(format, options);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(exportData.csv);
      } else {
        res.json(exportData);
      }
    } catch (error) {
      console.error("Failed to export analytics:", error);
      res.status(500).json({ error: "Failed to export analytics" });
    }
  }
);

// Public Character Routes
app.get("/api/characters/featured", async (req, res) => {
  try {
    // Get all official characters
    const characters = await Character.findAll({
      include: [
        {
          model: User,
          where: { isOfficial: true },
          attributes: ["username", "displayName", "isOfficial"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(characters || []);
  } catch (err) {
    console.error("Failed to load featured characters:", err);
    res.status(500).json({ error: "Failed to load characters" });
  }
});

app.get("/api/characters/explore", authenticateToken, async (req, res) => {
  try {
    // Get both official characters and public characters from other users
    const characters = await Character.findAll({
      where: {
        [Sequelize.Op.or]: [
          // Official characters
          {
            "$User.isOfficial$": true,
          },
          // Public characters from other users
          {
            UserId: {
              [Sequelize.Op.not]: req.user.id,
            },
            isPublic: true,
          },
        ],
      },
      include: [
        {
          model: User,
          attributes: ["username", "displayName", "isOfficial"],
        },
      ],
      order: [
        [{ model: User, as: "User" }, "isOfficial", "DESC"], // Show official characters first
        ["createdAt", "DESC"],
      ],
    });

    res.json(characters || []);
  } catch (err) {
    console.error("Failed to load explore characters:", err);
    res.status(500).json({ error: "Failed to load characters" });
  }
});

// Passport Configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://nevermade.co/auth/google/callback"
          : `http://localhost:${process.env.PORT}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Authenticating user with Google OAuth

        // First, try to find user by Google ID
        let user = await User.findOne({ where: { googleId: profile.id } });

        if (user) {
          // User found by Google ID
          return done(null, user);
        }

        // If not found by Google ID, check if user exists by email (recovered user case)
        const existingUserByEmail = await User.findOne({
          where: { email: profile.emails[0].value },
        });

        if (existingUserByEmail) {
          // Found existing user by email, updating Google ID

          // Update the existing user with the real Google ID
          await existingUserByEmail.update({
            googleId: profile.id,
            displayName: profile.displayName, // Also update display name if provided
          });

          // Successfully updated user Google ID
          return done(null, existingUserByEmail);
        }

        // If no existing user found, create a new one
        // Creating new user for Google ID

        user = await User.create({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails[0].value,
        });

        // New user created successfully

        // Add a small delay to ensure database consistency
        await new Promise((resolve) => setTimeout(resolve, 100));

        const verifyUser = await User.findByPk(user.id);
        if (!verifyUser) {
          console.error(
            `[PASSPORT_DEBUG] CRITICAL: Newly created user ${user.id} not found after creation!`
          );
          return done(new Error("Database consistency error"));
        }

        // New user verified in database

        done(null, user);
      } catch (err) {
        console.error(`Google OAuth authentication error:`, err);
        done(err);
      }
    }
  )
);

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Anthropic Configuration
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Google AI Configuration
let googleAI;
if (process.env.GOOGLE_AI_API_KEY) {
  googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
} else {
  console.warn(
    "GOOGLE_AI_API_KEY not found. Google AI models will not be available."
  );
}

// Auth Routes
app.get("/auth/google", (req, res, next) => {
  // Store the redirect_to_character parameter in the session state
  const redirectToCharacter = req.query.redirect_to_character;

  const state = redirectToCharacter
    ? JSON.stringify({ redirect_to_character: redirectToCharacter })
    : undefined;

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: state,
  })(req, res, next);
});

app.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, async (err, user) => {
    if (err) {
      console.error("Passport error:", err);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=auth_failed`
      );
    }
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
    }

    // User authenticated successfully

    // Verify user exists in database immediately after authentication
    try {
      const dbUser = await User.findByPk(user.id);
      if (!dbUser) {
        console.error(
          `[AUTH_DEBUG] CRITICAL: User ${user.id} not found in database immediately after authentication!`
        );
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=db_sync_failed`
        );
      }
      // User verified in database
    } catch (dbError) {
      console.error(`Database verification failed:`, dbError);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=db_error`);
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // JWT token created

    // Check if there's a character redirect in the state
    let redirectToCharacter = null;
    try {
      const state = req.query.state;

      if (state) {
        const stateData = JSON.parse(state);
        redirectToCharacter = stateData.redirect_to_character;
      }
    } catch (e) {
      // Silently handle state parsing errors
    }

    // Determine redirect URL based on username setup and character redirect
    let redirectUrl;
    if (!user.username) {
      // User needs to set up username first
      redirectUrl = `${process.env.FRONTEND_URL}/setup-username?token=${token}`;
      if (redirectToCharacter) {
        redirectUrl += `&redirect_to_character=${redirectToCharacter}`;
      }
      // Redirecting to username setup
    } else if (redirectToCharacter) {
      // User has username and wants to go to specific character
      redirectUrl = `${process.env.FRONTEND_URL}/auth-success?token=${token}&redirect_to_character=${redirectToCharacter}`;
      // Redirecting to character
    } else {
      // Normal auth success flow
      redirectUrl = `${process.env.FRONTEND_URL}/auth-success?token=${token}`;
      // Redirecting to auth success
    }

    res.redirect(redirectUrl);
  })(req, res, next);
});

app.get("/api/me", authenticateToken, async (req, res) => {
  res.json(req.user);
});

// Character Routes
app.get("/api/characters", authenticateToken, async (req, res) => {
  try {
    // Get all characters that the user has conversations with
    const userConversations = await Conversation.findAll({
      where: { UserId: req.user.id },
      attributes: ["CharacterId"],
    });

    const characterIdsWithConversations = userConversations.map(
      (conv) => conv.CharacterId
    );

    // Get both user-created characters and characters with conversations
    const characters = await Character.findAll({
      where: {
        [Sequelize.Op.or]: [
          { UserId: req.user.id }, // Characters created by the user
          { id: characterIdsWithConversations }, // Characters the user has chatted with
        ],
      },
      include: [
        {
          model: User,
          attributes: ["username", "displayName", "isOfficial"],
        },
      ],
      order: [
        [{ model: User, as: "User" }, "isOfficial", "DESC"], // Show official characters first
        ["createdAt", "DESC"],
      ],
    });
    res.json(characters);
  } catch (err) {
    console.error("Failed to load characters:", err);
    res.status(500).json({ error: "Failed to load characters" });
  }
});

app.get("/api/characters/:characterId", authenticateToken, async (req, res) => {
  try {
    const character = await Character.findOne({
      where: {
        id: req.params.characterId,
      },
      include: [
        {
          model: User,
          attributes: ["username", "displayName"],
        },
      ],
    });

    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }

    res.json(character);
  } catch (err) {
    res.status(500).json({ error: "Failed to load character" });
  }
});

app.post(
  "/api/characters",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      let characterData;

      // Determine user tier for model selection
      const userTier = req.user.subscriptionTier || "free";
      
      // Check if this is a FormData request (multipart) or JSON request
      if (req.file || req.body.name) {
        // FormData request - extract data from form fields
        const category = req.body.category;
        
        // Validate category
        if (!category || !getAllCategoryIds().includes(category)) {
          return res.status(400).json({ error: "Invalid category selected" });
        }
        
        // Get the appropriate model based on category and user tier
        const model = getModelForCategory(category, userTier);
        
        characterData = {
          name: req.body.name,
          description: req.body.description || "",
          model: model,
          systemPrompt: req.body.systemPrompt,
          isPublic: req.body.isPublic === "true",
          UserId: req.user.id,
        };

        // Add image if uploaded
        if (req.file) {
          characterData.image = convertFileToDataURL(req.file);
        }
      } else {
        // JSON request - use request body directly
        // Handle both category and model for backward compatibility
        if (req.body.category) {
          const category = req.body.category;
          
          // Validate category
          if (!getAllCategoryIds().includes(category)) {
            return res.status(400).json({ error: "Invalid category selected" });
          }
          
          // Get the appropriate model based on category and user tier
          const model = getModelForCategory(category, userTier);
          
          characterData = {
            ...req.body,
            model: model,
            UserId: req.user.id,
          };
          delete characterData.category; // Remove category from data
        } else {
          // Legacy support for direct model specification
          characterData = {
            ...req.body,
            UserId: req.user.id,
          };
        }
      }

      const character = await Character.create(characterData);
      res.status(201).json(character);
    } catch (err) {
      console.error("Character creation error:", err);
      res.status(400).json({ error: "Invalid request" });
    }
  }
);

// Conversation Routes
app.get(
  "/api/characters/:characterId/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      const conversations = await Conversation.findAll({
        where: {
          CharacterId: req.params.characterId,
          UserId: req.user.id,
        },
        include: [
          {
            model: Character,
            attributes: ["name", "model"],
            required: true,
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      res.json(conversations);
    } catch (err) {
      res.status(500).json({ error: "Failed to load conversations" });
    }
  }
);

app.post(
  "/api/characters/:characterId/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      // SERVER-SIDE VALIDATION FOR NEW CONVERSATION CREATION (FREE TIER)
      // Check actual subscription status from Stripe instead of relying on potentially stale database data
      const isProUser = await checkUserSubscriptionStatus(req.user);

      if (!isProUser) {
        // Validating free tier character limit
        const existingConversations = await Conversation.findAll({
          where: { UserId: req.user.id },
          attributes: ["CharacterId"], // Only need CharacterId to find unique ones
          raw: true, // Get plain objects
        });

        const uniqueInteractedCharacterIds = [
          ...new Set(
            existingConversations.map((conv) => conv.CharacterId.toString())
          ),
        ];
        // Checking unique character interactions

        const currentCharacterIdToCreateFor = req.params.characterId.toString();

        if (
          uniqueInteractedCharacterIds.length >= 3 &&
          !uniqueInteractedCharacterIds.includes(currentCharacterIdToCreateFor)
        ) {
          // Character limit exceeded for free tier
          return res.status(403).json({
            error:
              "Upgrade to Pro to start conversations with new characters. You have reached your limit for the free plan.",
          });
        }
        // Character access allowed
      } else {
        // Pro tier user - no character limits
      }
      // END SERVER-SIDE VALIDATION FOR NEW CONVERSATION

      const conversation = await Conversation.create({
        title: "New Conversation", // Initial title
        lastMessage: "",
        UserId: req.user.id,
        CharacterId: req.params.characterId,
      });
      res.status(201).json(conversation);
    } catch (err) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  }
);

// Add this new route for all user conversations
app.get("/api/conversations", authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      where: {
        UserId: req.user.id,
      },
      include: [
        {
          model: Character,
          attributes: ["id", "name", "model"], // Include basic character info
          required: true,
        },
      ],
      order: [["updatedAt", "DESC"]], // Order by most recently updated
    });
    res.json(conversations);
  } catch (err) {
    console.error("Failed to load user conversations:", err);
    res.status(500).json({ error: "Failed to load user conversations" });
  }
});

// Message Routes
app.get(
  "/api/conversations/:conversationId/messages",
  authenticateToken,
  async (req, res) => {
    try {
      // Get the conversation to find the current head
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // If no current head is set, return linear messages for backward compatibility
      if (!conversation.currentHeadId) {
        const messages = await Message.findAll({
          where: {
            ConversationId: req.params.conversationId,
            UserId: req.user.id,
          },
          order: [["createdAt", "ASC"]],
        });
        return res.json({ messages, tree: null, currentPath: messages });
      }

      // Return the tree structure with current path
      const { tree, currentPath } = await buildMessageTree(
        req.params.conversationId,
        conversation.currentHeadId
      );

      res.json({
        messages: currentPath, // For backward compatibility
        tree,
        currentPath,
        currentHeadId: conversation.currentHeadId,
      });
    } catch (err) {
      console.error("Failed to load messages:", err);
      res.status(500).json({ error: "Failed to load messages" });
    }
  }
);

app.post(
  "/api/conversations/:conversationId/messages",
  authenticateToken,
  messageLimiter,
  addCreditContext,
  async (req, res) => {
    const startTime = Date.now();
    let userMessage;
    let estimatedCredits = 0;
    let actualTokenUsage = null;
    let tokenUsageRecord;

    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
        include: [Character],
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // SERVER-SIDE ACCESS VALIDATION FOR FREE TIER
      // Check actual subscription status from Stripe instead of relying on potentially stale database data
      const isProUser = await checkUserSubscriptionStatus(req.user);

      if (!isProUser) {
        const allUserConversations = await Conversation.findAll({
          where: { UserId: req.user.id },
          attributes: ["CharacterId", "createdAt"],
          order: [["createdAt", "DESC"]],
        });

        const uniqueRecentCharacterIds = [
          ...new Set(
            allUserConversations.map((conv) => conv.CharacterId.toString())
          ),
        ];
        const currentCharacterIdStr = conversation.CharacterId.toString();

        if (uniqueRecentCharacterIds.length >= 3) {
          const allowedCharacterIdsSlice = uniqueRecentCharacterIds.slice(0, 3);

          if (!allowedCharacterIdsSlice.includes(currentCharacterIdStr)) {
            return res.status(403).json({
              error:
                "Upgrade to Pro to send messages to this character. You can chat with your 3 most recent characters on the free plan.",
            });
          }
        } else {
        }
      } else {
      }
      // END SERVER-SIDE ACCESS VALIDATION

      if (!conversation.Character) {
        return res
          .status(400)
          .json({ error: "Character not found for conversation" });
      }

      // CREDIT SYSTEM INTEGRATION - Pre-flight credit check
      const modelProvider = getModelProvider(conversation.Character.model);

      // Get the current path for context first (needed for precise token counting)
      let previousMessages = [];
      let parentMessageId = null;
      let childIndex = 0;

      if (conversation.currentHeadId) {
        // Get the current path from root to head
        previousMessages = await getMessagePath(conversation.currentHeadId);
        parentMessageId = conversation.currentHeadId;
        childIndex = await getNextChildIndex(parentMessageId);
      } else {
        // Fallback for conversations without tree structure
        previousMessages = await Message.findAll({
          where: {
            ConversationId: conversation.id,
          },
          order: [["createdAt", "ASC"]],
        });

        if (previousMessages.length > 0) {
          parentMessageId = previousMessages[previousMessages.length - 1].id;
          childIndex = 0;
        }
      }

      // Use precise token counting with the tokenizer service
      try {
        const tokenEstimate = await creditService.estimateMessageCredits(
          req.body.content,
          conversation.Character.model,
          modelProvider,
          {
            systemPrompt: conversation.Character.systemPrompt,
            conversationHistory: previousMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
              attachments: msg.attachments
            })),
            attachments: req.body.attachments
          }
        );

        // Use the appropriate buffer multiplier based on token counting accuracy
        const requiredCredits = tokenEstimate.creditsNeeded * tokenEstimate.bufferMultiplier;
        estimatedCredits = tokenEstimate.creditsNeeded;

        console.log(`Token estimation for ${conversation.Character.model}: ${tokenEstimate.inputTokens} input tokens (method: ${tokenEstimate.tokenCountMethod})`);

        // Check if user has sufficient credits
        const creditCheck = await creditService.checkCreditBalance(
          req.user.id,
          requiredCredits
        );
        if (!creditCheck.hasCredits) {
          return res.status(402).json({
            error: "Insufficient credits",
            creditsNeeded: requiredCredits,
            currentBalance: creditCheck.balance,
            estimatedCost: tokenEstimate.creditsNeeded,
            subscriptionTier: creditCheck.subscriptionTier,
            tokenEstimate: {
              inputTokens: tokenEstimate.inputTokens,
              estimatedOutputTokens: tokenEstimate.estimatedOutputTokens,
              isExact: tokenEstimate.isExact,
              method: tokenEstimate.tokenCountMethod
            }
          });
        }
      } catch (pricingError) {
        console.error("Credit estimation failed:", pricingError);
        // Continue without credit check if pricing fails (fallback)
      }

      // Save user message with tree structure
      userMessage = await Message.create({
        content: req.body.content,
        role: "user",
        UserId: req.user.id,
        ConversationId: conversation.id,
        CharacterId: conversation.CharacterId,
        attachments: req.body.attachments || null,
        parentId: parentMessageId,
        childIndex: childIndex,
      });

      // Increment message count for the character
      await conversation.Character.increment("messageCount");

      try {
        // Check if the model supports images
        const modelSupportsImages = supportsImages(
          conversation.Character.model
        );

        // Prepare conversation history for AI APIs
        const messageHistory = [
          { role: "system", content: conversation.Character.systemPrompt },
          ...previousMessages.map((msg) => {
            const messageContent = { role: msg.role, content: msg.content };

            // Add attachments if the model supports images and message has them
            if (
              modelSupportsImages &&
              msg.attachments &&
              msg.attachments.length > 0
            ) {
              messageContent.content = [
                { type: "text", text: msg.content },
                ...msg.attachments.map((attachment) => ({
                  type: "image_url",
                  image_url: { url: attachment.data },
                })),
              ];
            }

            return messageContent;
          }),
        ];

        // Add current user message to history
        const currentUserMessage = { role: "user", content: req.body.content };
        if (
          modelSupportsImages &&
          req.body.attachments &&
          req.body.attachments.length > 0
        ) {
          currentUserMessage.content = [
            { type: "text", text: req.body.content },
            ...req.body.attachments.map((attachment) => ({
              type: "image_url",
              image_url: { url: attachment.data },
            })),
          ];
        }
        messageHistory.push(currentUserMessage);

        // Get AI response with full conversation history
        let aiResponse;
        let aiResponseContent;

        if (modelProvider === "anthropic") {
          // Format messages for Claude API
          const formattedMessages = messageHistory.map((msg) => {
            if (msg.role === "system") {
              return {
                role: "user",
                content: `You are ${conversation.Character.name}. Here is your character description and instructions:\n${msg.content}`,
              };
            }

            // Handle multimodal content for Claude
            if (Array.isArray(msg.content)) {
              const content = [];
              for (const item of msg.content) {
                if (item.type === "text") {
                  content.push({ type: "text", text: item.text });
                } else if (item.type === "image_url") {
                  // Convert data URL to base64 for Claude
                  const base64Data = item.image_url.url.split(",")[1];
                  const mimeType = item.image_url.url
                    .split(";")[0]
                    .split(":")[1];
                  content.push({
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data: base64Data,
                    },
                  });
                }
              }
              return {
                role: msg.role === "assistant" ? "assistant" : "user",
                content: content,
              };
            }

            return {
              role: msg.role === "assistant" ? "assistant" : "user",
              content: msg.content,
            };
          });

          try {
            aiResponse = await anthropic.messages.create({
              model: conversation.Character.model,
              max_tokens: 1024,
              messages: formattedMessages,
              system: conversation.Character.systemPrompt,
            });

            if (
              !aiResponse.content ||
              !aiResponse.content[0] ||
              !aiResponse.content[0].text
            ) {
              throw new Error("Invalid response from Claude API");
            }

            aiResponseContent = aiResponse.content[0].text;

            // Extract token usage for Claude
            actualTokenUsage = {
              inputTokens: aiResponse.usage?.input_tokens || 0,
              outputTokens: aiResponse.usage?.output_tokens || 0,
            };
          } catch (claudeError) {
            console.error("Claude API error:", claudeError);
            throw new Error(
              "Failed to get AI response: " +
                (claudeError.message || "Unknown error")
            );
          }
        } else if (modelProvider === "google") {
          // Format messages for Google AI
          try {
            if (!googleAI) {
              throw new Error(
                "Google AI is not configured. Please set GOOGLE_AI_API_KEY environment variable."
              );
            }

            const model = googleAI.getGenerativeModel({
              model: conversation.Character.model,
              systemInstruction: conversation.Character.systemPrompt,
            });

            // Convert conversation history to Google AI format
            const chatHistory = [];
            let isFirstUserMessage = true;

            for (const msg of messageHistory) {
              if (msg.role === "system") {
                // Skip system messages as they're handled by systemInstruction
                continue;
              }

              // Handle multimodal content for Google AI
              let parts = [];
              if (Array.isArray(msg.content)) {
                for (const item of msg.content) {
                  if (item.type === "text") {
                    parts.push({ text: item.text });
                  } else if (item.type === "image_url") {
                    // Convert data URL for Google AI
                    const base64Data = item.image_url.url.split(",")[1];
                    const mimeType = item.image_url.url
                      .split(";")[0]
                      .split(":")[1];
                    parts.push({
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                      },
                    });
                  }
                }
              } else {
                parts = [{ text: msg.content }];
              }

              chatHistory.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: parts,
              });
            }

            // If we have previous conversation history, use chat with history
            if (chatHistory.length > 1) {
              // Start chat with history (excluding the last user message)
              const chat = model.startChat({
                history: chatHistory.slice(0, -1),
                generationConfig: {
                  maxOutputTokens: 1024,
                  temperature: 0.7,
                },
              });

              // Send the last user message
              const lastMessage = chatHistory[chatHistory.length - 1];
              const result = await chat.sendMessage(lastMessage.parts);
              aiResponse = await result.response;
              aiResponseContent = aiResponse.text();
            } else {
              // First message - use generateContent directly
              const userMessage = chatHistory[0];
              const result = await model.generateContent({
                contents: [userMessage],
                generationConfig: {
                  maxOutputTokens: 1024,
                  temperature: 0.7,
                },
              });
              aiResponse = await result.response;
              aiResponseContent = aiResponse.text();
            }

            if (!aiResponseContent || aiResponseContent.trim() === "") {
              throw new Error(
                "Empty response from Google AI - the model may have declined to respond due to content policies"
              );
            }

            // Extract token usage for Google AI
            const usageMetadata = aiResponse.usageMetadata;
            if (usageMetadata) {
              actualTokenUsage = {
                inputTokens: usageMetadata.promptTokenCount || 0,
                outputTokens: usageMetadata.candidatesTokenCount || 0,
              };
            }
          } catch (googleError) {
            console.error("Google AI error:", googleError);

            // Provide more specific error messages
            if (googleError.message?.includes("SAFETY")) {
              throw new Error(
                "The AI declined to respond due to safety policies. Please try rephrasing your message."
              );
            } else if (googleError.message?.includes("RECITATION")) {
              throw new Error(
                "The AI declined to respond due to potential copyright concerns. Please try a different approach."
              );
            } else if (googleError.message?.includes("quota")) {
              throw new Error(
                "Google AI quota exceeded. Please try again later."
              );
            } else {
              throw new Error(
                "Failed to get AI response: " +
                  (googleError.message || "Unknown error")
              );
            }
          }
        } else if (modelProvider === "openai") {
          // OpenAI models
          aiResponse = await openai.chat.completions.create({
            model: conversation.Character.model,
            messages: messageHistory,
          });
          aiResponseContent = aiResponse.choices[0].message.content;

          // Extract token usage for OpenAI
          if (aiResponse.usage) {
            actualTokenUsage = {
              inputTokens: aiResponse.usage.prompt_tokens || 0,
              outputTokens: aiResponse.usage.completion_tokens || 0,
            };
          }
        } else {
          throw new Error(`Unsupported model provider: ${modelProvider}`);
        }

        // Save AI message with tree structure
        const aiMessage = await Message.create({
          content: aiResponseContent,
          role: "assistant",
          UserId: req.user.id,
          ConversationId: conversation.id,
          CharacterId: conversation.CharacterId,
          parentId: userMessage.id,
          childIndex: 0, // AI response is always the first child of user message
        });

        // CREDIT SYSTEM INTEGRATION - Record actual token usage and deduct credits
        if (actualTokenUsage) {
          try {
            // Record token usage
            const tokenUsageRecord = await creditService.recordTokenUsage({
              userId: String(req.user.id),
              conversationId: conversation.id,
              messageId: aiMessage.id,
              modelProvider: modelProvider,
              modelName: conversation.Character.model,
              inputTokens: actualTokenUsage.inputTokens,
              outputTokens: actualTokenUsage.outputTokens,
            });

            // Deduct credits based on actual usage
            const actualCreditsUsed = parseFloat(tokenUsageRecord.creditsUsed);

            await creditService.deductCredits(
              String(req.user.id),
              actualCreditsUsed,
              {
                entityType: "message",
                entityId: aiMessage.id,
                reason: `AI message generation (${conversation.Character.model})`,
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
                metadata: {
                  conversationId: conversation.id,
                  characterId: conversation.CharacterId,
                  inputTokens: actualTokenUsage.inputTokens,
                  outputTokens: actualTokenUsage.outputTokens,
                  totalTokens:
                    actualTokenUsage.inputTokens +
                    actualTokenUsage.outputTokens,
                },
              }
            );

            console.log(
              `Credits deducted: ${actualCreditsUsed} for user ${req.user.id}, message ${aiMessage.id}`
            );
          } catch (creditError) {
            console.error("Credit processing failed:", creditError);

            // Create compensation record for failed credit processing
            try {
              await creditService.createCompensation(
                String(req.user.id),
                estimatedCredits,
                `Credit processing failed: ${creditError.message}`,
                aiMessage.id
              );
            } catch (compensationError) {
              console.error(
                "Failed to create compensation:",
                compensationError
              );
            }
          }
        } else {
          console.warn(
            `No token usage data available for message ${aiMessage.id}`
          );
        }

        // Update conversation's current head to the new AI message
        await conversation.update({
          currentHeadId: aiMessage.id,
          lastMessage: aiResponseContent.substring(0, 50),
        });

        // If this is the first message exchange, generate a title
        if (conversation.title === "New Conversation") {
          try {
            const titleResponse = await openai.chat.completions.create({
              model: getDefaultModel("free"), // Use centralized default for title generation
              messages: [
                {
                  role: "system",
                  content:
                    "You are a conversation title generator. Generate a brief, engaging title (max 30 characters) based on the conversation. The title should capture the essence of the discussion. Respond with ONLY the title, no quotes or extra text.",
                },
                {
                  role: "user",
                  content: `User: ${req.body.content}\nAI: ${aiResponseContent}`,
                },
              ],
              max_tokens: 10,
              temperature: 0.7,
            });

            const newTitle = titleResponse.choices[0].message.content
              .trim()
              .replace(/^["']|["']$/g, "");
            await conversation.update({
              title: newTitle,
              lastMessage: aiResponseContent.substring(0, 50),
              currentHeadId: aiMessage.id,
            });
          } catch (titleError) {
            console.error("Failed to generate title:", titleError);
            // Fall back to using the first message as title if title generation fails
            await conversation.update({
              title: aiResponseContent.substring(0, 30),
              lastMessage: aiResponseContent.substring(0, 50),
              currentHeadId: aiMessage.id,
            });
          }
        }

        // Reload conversation to get updated data
        await conversation.reload();

        // Return both messages and updated conversation data
        return res.json({
          messages: [userMessage, aiMessage],
          conversation: {
            id: conversation.id,
            title: conversation.title,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          },
          creditsUsed:
            actualTokenUsage && typeof tokenUsageRecord !== "undefined"
              ? parseFloat(tokenUsageRecord.creditsUsed || 0)
              : 0,
          tokenUsage: actualTokenUsage,
          processingTime: Date.now() - startTime,
        });
      } catch (aiError) {
        console.error("AI Response Error:", aiError);
        // If AI response fails, delete the user message and throw error
        try {
          await userMessage.destroy();
        } catch (deleteError) {
          console.error(
            "Failed to delete user message after AI error:",
            deleteError
          );
        }
        throw new Error(aiError.message || "Failed to get AI response");
      }
    } catch (err) {
      console.error("Message error:", err);
      res.status(500).json({ error: err.message || "Failed to send message" });
    }
  }
);

// Add endpoint to regenerate a message (in-place replacement)
app.post(
  "/api/conversations/:conversationId/messages/:messageId/regenerate",
  authenticateToken,
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
        include: [Character],
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Find the message to regenerate
      const messageToRegenerate = await Message.findOne({
        where: {
          id: req.params.messageId,
          ConversationId: req.params.conversationId,
          UserId: req.user.id,
        },
      });

      if (!messageToRegenerate) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only allow regenerating assistant messages
      if (messageToRegenerate.role !== "assistant") {
        return res
          .status(400)
          .json({ error: "Can only regenerate assistant messages" });
      }

      // Store original content for potential rollback
      const originalContent = messageToRegenerate.content;

      // Find the parent user message
      if (!messageToRegenerate.parentId) {
        return res.status(400).json({
          error: "Cannot regenerate a message without a parent",
        });
      }

      const parentUserMessage = await Message.findByPk(
        messageToRegenerate.parentId
      );
      if (!parentUserMessage || parentUserMessage.role !== "user") {
        return res.status(400).json({
          error: "Cannot find the user message that prompted this response",
        });
      }

      // Get the conversation history up to the parent user message
      const contextPath = await getMessagePath(parentUserMessage.id);

      // Prepare conversation history for AI APIs
      const messageHistory = [
        { role: "system", content: conversation.Character.systemPrompt },
        ...contextPath.map((msg) => {
          const messageContent = { role: msg.role, content: msg.content };

          // Add attachments if the model supports images and message has them
          if (
            supportsImages(conversation.Character.model) &&
            msg.attachments &&
            msg.attachments.length > 0
          ) {
            messageContent.content = [
              { type: "text", text: msg.content },
              ...msg.attachments.map((attachment) => ({
                type: "image_url",
                image_url: { url: attachment.data },
              })),
            ];
          }

          return messageContent;
        }),
      ];

      // Generate new AI response
      let aiResponse;
      const modelProvider = getModelProvider(conversation.Character.model);

      if (modelProvider === "anthropic") {
        // Format messages for Claude API
        const formattedMessages = messageHistory.map((msg) => {
          if (msg.role === "system") {
            return {
              role: "user",
              content: `You are ${conversation.Character.name}. Here is your character description and instructions:\n${msg.content}`,
            };
          }

          // Handle multimodal content for Claude
          if (Array.isArray(msg.content)) {
            const content = [];
            for (const item of msg.content) {
              if (item.type === "text") {
                content.push({ type: "text", text: item.text });
              } else if (item.type === "image_url") {
                const base64Data = item.image_url.url.split(",")[1];
                const mimeType = item.image_url.url.split(";")[0].split(":")[1];
                content.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: base64Data,
                  },
                });
              }
            }
            return {
              role: msg.role === "assistant" ? "assistant" : "user",
              content: content,
            };
          }

          return {
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          };
        });

        const response = await anthropic.messages.create({
          model: conversation.Character.model,
          max_tokens: 1024,
          messages: formattedMessages,
          system: conversation.Character.systemPrompt,
        });

        aiResponse = response.content[0].text;
      } else if (modelProvider === "google") {
        if (!googleAI) {
          throw new Error("Google AI is not configured");
        }

        const model = googleAI.getGenerativeModel({
          model: conversation.Character.model,
          systemInstruction: conversation.Character.systemPrompt,
        });

        const chatHistory = [];
        for (const msg of messageHistory) {
          if (msg.role === "system") continue;

          let parts = [];
          if (Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (item.type === "text") {
                parts.push({ text: item.text });
              } else if (item.type === "image_url") {
                const base64Data = item.image_url.url.split(",")[1];
                const mimeType = item.image_url.url.split(";")[0].split(":")[1];
                parts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                });
              }
            }
          } else {
            parts = [{ text: msg.content }];
          }

          chatHistory.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: parts,
          });
        }

        if (chatHistory.length > 1) {
          const chat = model.startChat({
            history: chatHistory.slice(0, -1),
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.7,
            },
          });

          const lastMessage = chatHistory[chatHistory.length - 1];
          const result = await chat.sendMessage(lastMessage.parts);
          const response = await result.response;
          aiResponse = response.text();
        } else {
          const userMessage = chatHistory[0];
          const result = await model.generateContent({
            contents: [userMessage],
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.7,
            },
          });
          const response = await result.response;
          aiResponse = response.text();
        }

        if (!aiResponse || aiResponse.trim() === "") {
          throw new Error(
            "Empty response from Google AI - the model may have declined to respond due to content policies"
          );
        }
      } else if (modelProvider === "openai") {
        const response = await openai.chat.completions.create({
          model: conversation.Character.model,
          messages: messageHistory,
        });
        aiResponse = response.choices[0].message.content;
      } else {
        throw new Error(`Unsupported model provider: ${modelProvider}`);
      }

      // Update the existing message with new content (in-place replacement)
      await messageToRegenerate.update({
        content: aiResponse,
        updatedAt: new Date(), // Update timestamp to reflect regeneration
      });

      // Update conversation's last message if this was the most recent message
      const isLastMessage =
        conversation.currentHeadId === messageToRegenerate.id;
      if (isLastMessage) {
        await conversation.update({
          lastMessage: aiResponse.substring(0, 50),
        });
      }

      res.json({
        success: true,
        content: aiResponse,
        message: messageToRegenerate.toJSON(),
      });
    } catch (err) {
      console.error("Regenerate message error:", err);

      // Attempt to restore original content if message was already updated
      try {
        if (originalContent && messageToRegenerate) {
          await messageToRegenerate.update({
            content: originalContent,
          });
          console.log("Restored original message content after error");
        }
      } catch (restoreError) {
        console.error("Failed to restore original content:", restoreError);
      }

      // Provide more specific error messages
      let errorMessage = err.message || "Failed to regenerate message";
      if (
        errorMessage.includes("safety policies") ||
        errorMessage.includes("SAFETY")
      ) {
        errorMessage =
          "The AI declined to regenerate due to safety policies. Please try editing your previous message.";
      } else if (
        errorMessage.includes("quota exceeded") ||
        errorMessage.includes("quota")
      ) {
        errorMessage = "AI service quota exceeded. Please try again later.";
      } else if (errorMessage.includes("RECITATION")) {
        errorMessage =
          "The AI declined to regenerate due to potential copyright concerns. Please try a different approach.";
      }

      res.status(500).json({ error: errorMessage });
    }
  }
);

// Add endpoint to edit a message (creates a new branch)
app.put(
  "/api/conversations/:conversationId/messages/:messageId/edit",
  authenticateToken,
  async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
        include: [Character],
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Find the message to edit
      const messageToEdit = await Message.findOne({
        where: {
          id: req.params.messageId,
          ConversationId: req.params.conversationId,
          UserId: req.user.id,
        },
      });

      if (!messageToEdit) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only allow editing user messages
      if (messageToEdit.role !== "user") {
        return res.status(400).json({ error: "Can only edit user messages" });
      }

      // Check if content actually changed
      if (content.trim() === messageToEdit.content.trim()) {
        return res.json({ success: true, message: "No changes made" });
      }

      // Create a new branch by creating a sibling message
      const newChildIndex = await getNextChildIndex(messageToEdit.parentId);

      // Create the edited user message as a new branch
      const editedUserMessage = await Message.create({
        content: content.trim(),
        role: "user",
        UserId: req.user.id,
        ConversationId: conversation.id,
        CharacterId: conversation.CharacterId,
        attachments: messageToEdit.attachments, // Preserve attachments
        parentId: messageToEdit.parentId,
        childIndex: newChildIndex,
      });

      // Get the conversation history up to the parent of the edited message
      const contextPath = messageToEdit.parentId
        ? await getMessagePath(messageToEdit.parentId)
        : [];

      // Prepare conversation history for AI APIs
      const messageHistory = [
        { role: "system", content: conversation.Character.systemPrompt },
        ...contextPath.map((msg) => {
          const messageContent = { role: msg.role, content: msg.content };

          // Add attachments if the model supports images and message has them
          if (
            supportsImages(conversation.Character.model) &&
            msg.attachments &&
            msg.attachments.length > 0
          ) {
            messageContent.content = [
              { type: "text", text: msg.content },
              ...msg.attachments.map((attachment) => ({
                type: "image_url",
                image_url: { url: attachment.data },
              })),
            ];
          }

          return messageContent;
        }),
        // Add the edited user message
        {
          role: "user",
          content:
            editedUserMessage.attachments &&
            editedUserMessage.attachments.length > 0
              ? [
                  { type: "text", text: content.trim() },
                  ...editedUserMessage.attachments.map((attachment) => ({
                    type: "image_url",
                    image_url: { url: attachment.data },
                  })),
                ]
              : content.trim(),
        },
      ];

      // Generate new AI response
      let aiResponse;
      const modelProvider = getModelProvider(conversation.Character.model);

      if (modelProvider === "anthropic") {
        // Format messages for Claude API
        const formattedMessages = messageHistory.map((msg) => {
          if (msg.role === "system") {
            return {
              role: "user",
              content: `You are ${conversation.Character.name}. Here is your character description and instructions:\n${msg.content}`,
            };
          }

          // Handle multimodal content for Claude
          if (Array.isArray(msg.content)) {
            const content = [];
            for (const item of msg.content) {
              if (item.type === "text") {
                content.push({ type: "text", text: item.text });
              } else if (item.type === "image_url") {
                const base64Data = item.image_url.url.split(",")[1];
                const mimeType = item.image_url.url.split(";")[0].split(":")[1];
                content.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: base64Data,
                  },
                });
              }
            }
            return {
              role: msg.role === "assistant" ? "assistant" : "user",
              content: content,
            };
          }

          return {
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          };
        });

        const response = await anthropic.messages.create({
          model: conversation.Character.model,
          max_tokens: 1024,
          messages: formattedMessages,
          system: conversation.Character.systemPrompt,
        });

        aiResponse = response.content[0].text;
      } else if (modelProvider === "google") {
        if (!googleAI) {
          throw new Error("Google AI is not configured");
        }

        const model = googleAI.getGenerativeModel({
          model: conversation.Character.model,
          systemInstruction: conversation.Character.systemPrompt,
        });

        const chatHistory = [];
        for (const msg of messageHistory) {
          if (msg.role === "system") continue;

          let parts = [];
          if (Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (item.type === "text") {
                parts.push({ text: item.text });
              } else if (item.type === "image_url") {
                const base64Data = item.image_url.url.split(",")[1];
                const mimeType = item.image_url.url.split(";")[0].split(":")[1];
                parts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                });
              }
            }
          } else {
            parts = [{ text: msg.content }];
          }

          chatHistory.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: parts,
          });
        }

        if (chatHistory.length > 1) {
          const chat = model.startChat({
            history: chatHistory.slice(0, -1),
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.7,
            },
          });

          const lastMessage = chatHistory[chatHistory.length - 1];
          const result = await chat.sendMessage(lastMessage.parts);
          const response = await result.response;
          aiResponse = response.text();
        } else {
          const userMessage = chatHistory[0];
          const result = await model.generateContent({
            contents: [userMessage],
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.7,
            },
          });
          const response = await result.response;
          aiResponse = response.text();
        }
      } else if (modelProvider === "openai") {
        const response = await openai.chat.completions.create({
          model: conversation.Character.model,
          messages: messageHistory,
        });
        aiResponse = response.choices[0].message.content;
      } else {
        throw new Error(`Unsupported model provider: ${modelProvider}`);
      }

      // Save the new AI message as a child of the edited user message
      const newAiMessage = await Message.create({
        content: aiResponse,
        role: "assistant",
        UserId: req.user.id,
        ConversationId: conversation.id,
        CharacterId: conversation.CharacterId,
        parentId: editedUserMessage.id,
        childIndex: 0, // AI response is always the first child of user message
      });

      // Update conversation's current head to the new AI message (switch to this branch)
      await conversation.update({
        currentHeadId: newAiMessage.id,
        lastMessage: aiResponse.substring(0, 50),
      });

      res.json({
        success: true,
        userMessage: editedUserMessage,
        aiMessage: newAiMessage,
        newHeadId: newAiMessage.id,
      });
    } catch (err) {
      console.error("Edit message error:", err);
      res.status(500).json({ error: err.message || "Failed to edit message" });
    }
  }
);

// Add endpoint to switch conversation branch
app.put(
  "/api/conversations/:conversationId/switch-branch/:messageId",
  authenticateToken,
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify the message exists and belongs to this conversation
      const message = await Message.findOne({
        where: {
          id: req.params.messageId,
          ConversationId: req.params.conversationId,
          UserId: req.user.id,
        },
      });

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Update the conversation's current head
      await conversation.update({
        currentHeadId: req.params.messageId,
      });

      // Return the new tree structure
      const { tree, currentPath } = await buildMessageTree(
        req.params.conversationId,
        req.params.messageId
      );

      res.json({
        success: true,
        currentHeadId: req.params.messageId,
        tree,
        currentPath,
      });
    } catch (err) {
      console.error("Switch branch error:", err);
      res.status(500).json({ error: err.message || "Failed to switch branch" });
    }
  }
);

// Add username setup endpoint
app.post("/api/setup-username", authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ error: "Username must be between 3 and 30 characters" });
    }

    // Check if username is reserved (nevermade)
    if (username.toLowerCase() === "nevermade") {
      return res.status(400).json({ error: "This username is reserved" });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    // Update user's username
    await req.user.update({ username });

    // Generate a new token with updated user data
    const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      success: true,
      username,
      token, // Send back a new token
    });
  } catch (err) {
    console.error("Username setup error:", err);
    res.status(500).json({ error: "Failed to set username" });
  }
});

// Logout Route
app.post("/api/logout", (req, res) => {
  res.json({ success: true });
});

// Add endpoint to toggle character visibility
app.put(
  "/api/characters/:characterId/visibility",
  authenticateToken,
  async (req, res) => {
    try {
      const character = await Character.findOne({
        where: {
          id: req.params.characterId,
          UserId: req.user.id, // Only allow updating own characters
        },
      });

      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      await character.update({ isPublic: req.body.isPublic });
      res.json(character);
    } catch (err) {
      console.error("Failed to update character visibility:", err);
      res.status(500).json({ error: "Failed to update character visibility" });
    }
  }
);

// Add endpoint to update character details
app.put(
  "/api/characters/:characterId",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const character = await Character.findOne({
        where: {
          id: req.params.characterId,
          UserId: req.user.id, // Only allow updating own characters
        },
      });

      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      let updateData;

      // Check if this is a FormData request (multipart) or JSON request
      if (req.file || req.body.name) {
        // FormData request - extract data from form fields
        updateData = {
          name: req.body.name?.trim(),
          description: req.body.description?.trim() || "",
          model: req.body.model,
          systemPrompt: req.body.systemPrompt?.trim(),
          isPublic: req.body.isPublic === "true",
        };

        // Handle image upload/removal
        if (req.file) {
          updateData.image = convertFileToDataURL(req.file);
        } else if (req.body.removeImage === "true") {
          updateData.image = null;
        }
      } else {
        // JSON request - use request body directly
        updateData = {
          name: req.body.name?.trim(),
          description: req.body.description?.trim() || "",
          model: req.body.model,
          systemPrompt: req.body.systemPrompt?.trim(),
          isPublic: Boolean(req.body.isPublic),
        };
      }

      // Validate required fields
      if (!updateData.name) {
        return res.status(400).json({ error: "Name is required" });
      }

      if (!updateData.systemPrompt) {
        return res.status(400).json({ error: "System prompt is required" });
      }

      // Validate model
      const allowedModels = getAllModelIds();
      if (!allowedModels.includes(updateData.model)) {
        return res.status(400).json({ error: "Invalid model selected" });
      }

      // Update the character
      const updatedCharacter = await character.update(updateData);

      // Return the updated character with user info
      const characterWithUser = await Character.findOne({
        where: { id: updatedCharacter.id },
        include: [
          {
            model: User,
            attributes: ["username", "displayName", "isOfficial"],
          },
        ],
      });

      res.json(characterWithUser);
    } catch (err) {
      console.error("Failed to update character:", err);
      res.status(500).json({ error: "Failed to update character" });
    }
  }
);

// Add endpoint to delete a conversation
app.delete(
  "/api/conversations/:conversationId",
  authenticateToken,
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id, // Only allow deleting own conversations
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Delete all messages in the conversation first
      await Message.destroy({
        where: {
          ConversationId: conversation.id,
        },
      });

      // Then delete the conversation
      await conversation.destroy();
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  }
);

// Add endpoint to get a single conversation
app.get(
  "/api/conversations/:conversationId",
  authenticateToken,
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
        include: [
          {
            model: Character,
            attributes: ["name", "model"],
          },
        ],
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(conversation);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      res.status(500).json({ error: "Failed to load conversation" });
    }
  }
);

// Add endpoint to update a conversation
app.put(
  "/api/conversations/:conversationId",
  authenticateToken,
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const { title } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }

      // Update the conversation
      await conversation.update({ title: title.trim() });

      // Return the updated conversation
      const updatedConversation = await Conversation.findOne({
        where: { id: conversation.id },
        include: [
          {
            model: Character,
            attributes: ["name", "model"],
          },
        ],
      });

      res.json(updatedConversation);
    } catch (err) {
      console.error("Failed to update conversation:", err);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  }
);

// Add admin routes
app.get("/api/admin/characters", authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Unauthorized" });

  try {
    const characters = await Character.findAll({
      include: [
        {
          model: User,
          where: { isOfficial: true },
          attributes: ["username", "displayName"],
        },
      ],
    });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: "Failed to load characters" });
  }
});

app.put(
  "/api/admin/characters/:id",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    if (!req.user.isAdmin)
      return res.status(403).json({ error: "Unauthorized" });

    try {
      const character = await Character.findByPk(req.params.id, {
        include: [User],
      });

      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      let updateData;

      // Check if this is a FormData request (multipart) or JSON request
      if (req.file || req.body.name) {
        // FormData request - extract data from form fields
        updateData = {
          name: req.body.name?.trim(),
          description: req.body.description?.trim() || "",
          model: req.body.model,
          systemPrompt: req.body.systemPrompt?.trim(),
          isPublic: req.body.isPublic === "true",
        };

        // Handle image upload/removal
        if (req.file) {
          updateData.image = convertFileToDataURL(req.file);
        } else if (req.body.removeImage === "true") {
          updateData.image = null;
        }
      } else {
        // JSON request - use request body directly
        updateData = {
          name: req.body.name?.trim(),
          description: req.body.description?.trim() || "",
          model: req.body.model,
          systemPrompt: req.body.systemPrompt?.trim(),
          isPublic: Boolean(req.body.isPublic),
        };
      }

      // Add validation for required fields
      if (!updateData.name) {
        return res.status(400).json({ error: "Name is required" });
      }

      if (!updateData.systemPrompt) {
        return res.status(400).json({ error: "System prompt is required" });
      }

      // Validate model
      const allowedModels = getAllModelIds();
      if (!allowedModels.includes(updateData.model)) {
        return res.status(400).json({ error: "Invalid model selected" });
      }

      // Update the character
      const updatedCharacter = await character.update(updateData);

      // Return the updated character with user info
      const characterWithUser = await Character.findByPk(updatedCharacter.id, {
        include: [
          {
            model: User,
            attributes: ["username", "displayName", "isOfficial"],
          },
        ],
      });

      res.json(characterWithUser);
    } catch (err) {
      console.error("Admin character update error:", err);
      res.status(500).json({ error: "Failed to update character" });
    }
  }
);

// Add new admin login route
app.post("/auth/admin-login", async (req, res) => {
  const { username, password } = req.body;
  if (
    username !== process.env.ADMIN_USERNAME ||
    !bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH)
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      isAdmin: true,
      adminUsername: username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token });
});

// Credit Refresh Admin Endpoints
app.post("/api/admin/users/:userId/refresh-credits", authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    const result = await creditRefreshService.refreshUserCredits(userId, {
      amount,
      reason: reason || 'manual',
      force: true,
      metadata: {
        adminId: req.user.adminUsername || req.user.id,
        ip: req.ip
      }
    });

    if (result.success) {
      res.json({
        message: "Credits refreshed successfully",
        ...result
      });
    } else {
      res.status(400).json({
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Manual credit refresh error:", error);
    res.status(500).json({ error: "Failed to refresh credits" });
  }
});

app.post("/api/admin/credits/bulk-refresh", authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { userIds, dryRun } = req.body;

    // Override dry run setting if specified
    if (dryRun !== undefined) {
      creditRefreshService.config.dryRun = dryRun;
    }

    let results;
    if (userIds && userIds.length > 0) {
      // Refresh specific users
      results = {
        total: userIds.length,
        successful: 0,
        failed: 0,
        details: []
      };

      for (const userId of userIds) {
        const result = await creditRefreshService.refreshUserCredits(userId, {
          reason: 'bulk_manual',
          force: true
        });
        
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }
        results.details.push(result);
      }
    } else {
      // Refresh all eligible users
      results = await creditRefreshService.refreshAllEligibleUsers();
    }

    res.json(results);
  } catch (error) {
    console.error("Bulk credit refresh error:", error);
    res.status(500).json({ error: "Failed to perform bulk refresh" });
  }
});

app.get("/api/admin/users/:userId/refresh-history", authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { userId } = req.params;
    const history = await creditRefreshService.models.CreditRefreshHistory.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json(history);
  } catch (error) {
    console.error("Get refresh history error:", error);
    res.status(500).json({ error: "Failed to get refresh history" });
  }
});

app.put("/api/admin/users/:userId/refresh-settings", authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { userId } = req.params;
    const { creditRefreshHold, creditRefreshDay, customCreditAmount } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {};
    if (creditRefreshHold !== undefined) updates.creditRefreshHold = creditRefreshHold;
    if (creditRefreshDay !== undefined) updates.creditRefreshDay = creditRefreshDay;
    if (customCreditAmount !== undefined) updates.customCreditAmount = customCreditAmount;

    await user.update(updates);

    res.json({
      message: "Refresh settings updated",
      settings: {
        creditRefreshHold: user.creditRefreshHold,
        creditRefreshDay: user.creditRefreshDay,
        customCreditAmount: user.customCreditAmount
      }
    });
  } catch (error) {
    console.error("Update refresh settings error:", error);
    res.status(500).json({ error: "Failed to update refresh settings" });
  }
});

app.get("/api/admin/credits/refresh-stats", authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { startDate, endDate } = req.query;
    const stats = await creditRefreshService.getRefreshStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json(stats);
  } catch (error) {
    console.error("Get refresh statistics error:", error);
    res.status(500).json({ error: "Failed to get refresh statistics" });
  }
});

// User Credit Refresh Endpoints
app.get("/api/user/credits/next-refresh", authenticateToken, async (req, res) => {
  try {
    const refreshInfo = await creditRefreshService.getNextRefreshInfo(req.user.id);
    
    if (refreshInfo.error) {
      return res.status(400).json({ error: refreshInfo.error });
    }

    res.json(refreshInfo);
  } catch (error) {
    console.error("Get next refresh error:", error);
    res.status(500).json({ error: "Failed to get refresh information" });
  }
});

app.get("/api/user/credits/refresh-history", authenticateToken, async (req, res) => {
  try {
    const history = await creditRefreshService.models.CreditRefreshHistory.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'refreshType', 'creditsAdded', 'creditsBefore', 'creditsAfter', 'createdAt']
    });

    res.json(history);
  } catch (error) {
    console.error("Get user refresh history error:", error);
    res.status(500).json({ error: "Failed to get refresh history" });
  }
});

// Add Stripe webhook endpoint (before other routes)
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        const subscription = event.data.object;
        console.log(
          `🔄 Subscription ${event.type.split(".").pop()}: ${subscription.id}`
        );

        const user = await User.findOne({
          where: { stripeCustomerId: subscription.customer },
        });

        if (user) {
          await user.update({
            subscriptionStatus: subscription.status,
            subscriptionTier:
              subscription.items.data[0].price.nickname || "pro",
            subscriptionEndsAt: new Date(
              subscription.current_period_end * 1000
            ),
          });
          console.log(`✅ Updated subscription for user: ${user.email}`);
        } else {
          console.log(
            `⚠️  No user found for Stripe customer: ${subscription.customer}`
          );
        }
        break;

      case "customer.subscription.deleted":
        const canceledSubscription = event.data.object;
        console.log(`❌ Subscription canceled: ${canceledSubscription.id}`);

        const canceledUser = await User.findOne({
          where: { stripeCustomerId: canceledSubscription.customer },
        });

        if (canceledUser) {
          await canceledUser.update({
            subscriptionStatus: "free",
            subscriptionTier: "free",
            subscriptionEndsAt: null,
          });
          console.log(
            `✅ Subscription canceled for user: ${canceledUser.email}`
          );
        }
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// Add subscription endpoints
app.post("/api/create-subscription", authenticateToken, async (req, res) => {
  try {
    const { priceId } = req.body;

    // Get or create Stripe customer
    if (!req.user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.displayName,
        metadata: {
          userId: String(req.user.id),
          username: req.user.username || "No username set",
        },
      });
      await req.user.update({ stripeCustomerId: customer.id });
    }

    // Create Checkout Session optimized for Stripe's automatic emails
    const session = await stripe.checkout.sessions.create({
      customer: req.user.stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/plans?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/plans?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      payment_method_types: ["card"],
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session creation failed:", error);
    res
      .status(500)
      .json({ error: "Failed to create checkout session: " + error.message });
  }
});

app.get("/api/subscription-status", authenticateToken, async (req, res) => {
  try {
    if (req.user.stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: req.user.stripeCustomerId,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          res.json({
            status: subscription.status,
            tier: subscription.items.data[0].price.nickname || "pro",
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          });
          return;
        }
      } catch (stripeError) {
        console.error("Stripe subscription check failed:", stripeError);

        // If the customer doesn't exist in Stripe, clear the invalid customer ID
        if (
          stripeError.code === "resource_missing" &&
          stripeError.param === "customer"
        ) {
          console.log(
            `Clearing invalid Stripe customer ID for user ${req.user.id}`
          );
          await req.user.update({
            stripeCustomerId: null,
            subscriptionStatus: "free",
            subscriptionTier: "free",
            subscriptionEndsAt: null,
          });
        }

        // Continue to return free tier status instead of throwing an error
      }
    }

    res.json({
      status: "free",
      tier: "free",
      currentPeriodEnd: null,
    });
  } catch (error) {
    console.error("Failed to fetch subscription status:", error);
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

app.post("/api/create-portal-session", authenticateToken, async (req, res) => {
  try {
    if (!req.user.stripeCustomerId) {
      throw new Error("No Stripe customer ID found");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/plans`,
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    console.error("Failed to create portal session:", error);
    res
      .status(500)
      .json({ error: "Failed to create portal session: " + error.message });
  }
});

// Add profile picture update endpoint
app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { profilePicture } = req.body;

    // Validate profile picture URL
    if (profilePicture && !profilePicture.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid profile picture format" });
    }

    // Update user's profile picture
    await req.user.update({ profilePicture });

    res.json({ success: true, profilePicture });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Add endpoint to update username
app.put("/api/profile/username", authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ error: "Username must be between 3 and 30 characters" });
    }

    // Check if username is reserved (nevermade)
    if (username.toLowerCase() === "nevermade") {
      return res.status(400).json({ error: "This username is reserved" });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    // Update user's username
    await req.user.update({ username });

    res.json({ success: true, username });
  } catch (err) {
    console.error("Username update error:", err);
    res.status(500).json({ error: "Failed to update username" });
  }
});

// Add endpoint to check username availability
app.get("/api/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Basic validation
    if (!username || username.length < 3 || username.length > 30) {
      return res.json({
        available: false,
        reason: "Username must be between 3 and 30 characters",
      });
    }

    // Check if username is reserved
    if (username.toLowerCase() === "nevermade") {
      return res.json({
        available: false,
        reason: "This username is reserved",
      });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.json({
        available: false,
        reason: "Username is already taken",
      });
    }

    res.json({ available: true });
  } catch (err) {
    console.error("Username check error:", err);
    res.status(500).json({ error: "Failed to check username" });
  }
});

// Add endpoint to check character access for free tier users
app.get(
  "/api/characters/:characterId/access",
  authenticateToken,
  async (req, res) => {
    try {
      // Check actual subscription status from Stripe instead of relying on potentially stale database data
      const isProUser = await checkUserSubscriptionStatus(req.user);

      // If user is on pro tier, they always have access
      if (isProUser) {
        return res.json({ hasAccess: true });
      }

      // For free tier users, check if character is in their allowed set
      const allUserConversations = await Conversation.findAll({
        where: { UserId: req.user.id },
        attributes: ["CharacterId", "createdAt"],
        order: [["createdAt", "DESC"]],
      });

      const uniqueRecentCharacterIds = [
        ...new Set(
          allUserConversations.map((conv) => conv.CharacterId.toString())
        ),
      ];

      const currentCharacterIdStr = req.params.characterId.toString();
      const allowedCharacterIdsSlice = uniqueRecentCharacterIds.slice(0, 3);

      // Check if character is in allowed set
      const hasAccess = allowedCharacterIdsSlice.includes(
        currentCharacterIdStr
      );

      // If no access, include the error message
      if (!hasAccess) {
        return res.json({
          hasAccess: false,
          reason:
            "Upgrade to Pro to chat with this character. You can chat with your 3 most recent characters on the free plan.",
        });
      }

      res.json({ hasAccess: true });
    } catch (err) {
      console.error("Failed to check character access:", err);
      res.status(500).json({ error: "Failed to check character access" });
    }
  }
);

// Add endpoint to delete user account
app.delete("/api/profile/delete", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`Starting account deletion for user ${userId}`);

    // Start a transaction to ensure all-or-nothing deletion
    const transaction = await sequelize.transaction();

    try {
      // First, clear any currentHeadId references that point to messages we're about to delete
      const userConversations = await Conversation.findAll({
        where: { UserId: userId },
        attributes: ["id"],
        transaction,
      });

      for (const conv of userConversations) {
        await conv.update({ currentHeadId: null }, { transaction });
      }

      // Delete all user's messages first (due to foreign key constraints)
      await Message.destroy({
        where: { UserId: userId },
        transaction,
      });
      console.log(`Deleted messages for user ${userId}`);

      // Delete all user's conversations
      await Conversation.destroy({
        where: { UserId: userId },
        transaction,
      });
      console.log(`Deleted conversations for user ${userId}`);

      // Delete all characters created by the user
      await Character.destroy({
        where: { UserId: userId },
        transaction,
      });
      console.log(`Deleted characters for user ${userId}`);

      // Handle Stripe cleanup if user has a Stripe customer ID
      if (req.user.stripeCustomerId) {
        try {
          // Cancel any active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: req.user.stripeCustomerId,
            status: "active",
          });

          for (const subscription of subscriptions.data) {
            await stripe.subscriptions.cancel(subscription.id);
            console.log(
              `Cancelled Stripe subscription ${subscription.id} for user ${userId}`
            );
          }

          // Note: We don't delete the Stripe customer to maintain billing history
          // This is a common practice for compliance and record-keeping
          console.log(`Stripe cleanup completed for user ${userId}`);
        } catch (stripeError) {
          console.error(
            `Stripe cleanup failed for user ${userId}:`,
            stripeError
          );
          // Continue with account deletion even if Stripe cleanup fails
        }
      }

      // Finally, delete the user record
      await User.destroy({
        where: { id: userId },
        transaction,
      });
      console.log(`Deleted user record ${userId}`);

      // Commit the transaction
      await transaction.commit();

      res.json({
        success: true,
        message: "Account successfully deleted",
      });
    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (err) {
    console.error("Account deletion error:", err);
    res.status(500).json({
      error: err.message || "Failed to delete account",
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop cleanup service
  if (reservationCleanupService) {
    console.log('Stopping reservation cleanup service...');
    reservationCleanupService.stop();
  }
  
  // Cleanup streaming tracker
  if (streamingTokenTracker) {
    console.log('Cleaning up streaming trackers...');
    try {
      streamingTokenTracker.cleanupStaleTrackers(0); // Clean all trackers
    } catch (error) {
      console.error('Error cleaning up trackers:', error);
    }
  }
  
  // Close database connection
  if (sequelize) {
    console.log('Closing database connection...');
    sequelize.close().then(() => {
      console.log('Graceful shutdown completed');
      process.exit(0);
    }).catch((error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
  } else {
    console.log('Graceful shutdown completed');
    process.exit(0);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Add streaming endpoint for messages (SSE)
app.post(
  "/api/conversations/:conversationId/messages/stream",
  authenticateToken,
  messageLimiter,
  addCreditContext,
  async (req, res) => {
    const startTime = Date.now();
    let userMessage;
    let estimatedCredits = 0;
    let actualTokenUsage = null;

    try {
      const conversation = await Conversation.findOne({
        where: {
          id: req.params.conversationId,
          UserId: req.user.id,
        },
        include: [Character],
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Same access validation as regular message endpoint
      const isProUser = await checkUserSubscriptionStatus(req.user);
      if (!isProUser) {
        const allUserConversations = await Conversation.findAll({
          where: { UserId: req.user.id },
          attributes: ["CharacterId", "createdAt"],
          order: [["createdAt", "DESC"]],
        });

        const uniqueRecentCharacterIds = [
          ...new Set(
            allUserConversations.map((conv) => conv.CharacterId.toString())
          ),
        ];
        const currentCharacterIdStr = conversation.CharacterId.toString();

        if (uniqueRecentCharacterIds.length >= 3) {
          const allowedCharacterIdsSlice = uniqueRecentCharacterIds.slice(0, 3);
          if (!allowedCharacterIdsSlice.includes(currentCharacterIdStr)) {
            return res.status(403).json({
              error:
                "Upgrade to Pro to send messages to this character. You can chat with your 3 most recent characters on the free plan.",
            });
          }
        }
      }

      if (!conversation.Character) {
        return res
          .status(400)
          .json({ error: "Character not found for conversation" });
      }

      // CREDIT RESERVATION SYSTEM - Initialize streaming with credit reservation
      const modelProvider = getModelProvider(conversation.Character.model);

      // Get conversation context first for precise token counting
      let previousMessages = [];
      let parentMessageId = null;
      let childIndex = 0;

      if (conversation.currentHeadId) {
        previousMessages = await getMessagePath(conversation.currentHeadId);
        parentMessageId = conversation.currentHeadId;
        childIndex = await getNextChildIndex(parentMessageId);
      } else {
        previousMessages = await Message.findAll({
          where: { ConversationId: conversation.id },
          order: [["createdAt", "ASC"]],
        });
        if (previousMessages.length > 0) {
          parentMessageId = previousMessages[previousMessages.length - 1].id;
          childIndex = 0;
        }
      }

      // Initialize streaming tracker with credit reservation
      let trackingResult;
      try {
        trackingResult = await streamingTokenTracker.startTracking({
          userId: String(req.user.id),
          conversationId: conversation.id,
          messageId: null, // Will be set after user message is created
          content: req.body.content,
          model: conversation.Character.model,
          provider: modelProvider,
          systemPrompt: conversation.Character.systemPrompt,
          conversationHistory: previousMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            attachments: msg.attachments
          })),
          attachments: req.body.attachments,
          operationType: 'chat_completion',
          expirationMinutes: 15,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        });

        console.log(`Streaming tracker started: ${trackingResult.trackerId}, credits reserved: ${trackingResult.creditsReserved}`);
        estimatedCredits = trackingResult.estimatedTokens.input + trackingResult.estimatedTokens.output;

      } catch (reservationError) {
        console.error("Credit reservation failed for streaming:", reservationError);
        
        // Return specific error for insufficient credits
        if (reservationError.message.includes('Insufficient credits')) {
          return res.status(402).json({
            error: "Insufficient credits",
            message: reservationError.message,
            subscriptionTier: req.user.subscriptionTier || 'free'
          });
        }
        
        // For other errors, return generic error
        return res.status(500).json({
          error: "Failed to initialize streaming",
          message: reservationError.message
        });
      }

      // Set up SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL,
        "Access-Control-Allow-Credentials": "true",
      });

      // Helper function to send SSE data
      const sendSSE = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {

        // Save user message
        userMessage = await Message.create({
          content: req.body.content,
          role: "user",
          UserId: req.user.id,
          ConversationId: conversation.id,
          CharacterId: conversation.CharacterId,
          attachments: req.body.attachments || null,
          parentId: parentMessageId,
          childIndex: childIndex,
        });

        await conversation.Character.increment("messageCount");

        // Update tracker with message ID (for auditing)
        // Note: This would require an update method in the tracker, for now we'll track via reservation context

        // Send user message confirmation and reservation info
        sendSSE({
          type: "userMessage",
          message: userMessage,
          reservationInfo: {
            trackerId: trackingResult.trackerId,
            creditsReserved: trackingResult.creditsReserved,
            expiresAt: trackingResult.expiresAt
          }
        });

        // Prepare message history
        const modelSupportsImages = supportsImages(
          conversation.Character.model
        );
        const messageHistory = [
          { role: "system", content: conversation.Character.systemPrompt },
          ...previousMessages.map((msg) => {
            const messageContent = { role: msg.role, content: msg.content };
            if (
              modelSupportsImages &&
              msg.attachments &&
              msg.attachments.length > 0
            ) {
              messageContent.content = [
                { type: "text", text: msg.content },
                ...msg.attachments.map((attachment) => ({
                  type: "image_url",
                  image_url: { url: attachment.data },
                })),
              ];
            }
            return messageContent;
          }),
        ];

        // Add current user message
        const currentUserMessage = { role: "user", content: req.body.content };
        if (
          modelSupportsImages &&
          req.body.attachments &&
          req.body.attachments.length > 0
        ) {
          currentUserMessage.content = [
            { type: "text", text: req.body.content },
            ...req.body.attachments.map((attachment) => ({
              type: "image_url",
              image_url: { url: attachment.data },
            })),
          ];
        }
        messageHistory.push(currentUserMessage);

        // Stream AI response based on provider
        let aiResponseContent = "";
        let streamUsageData = null;

        if (modelProvider === "openai") {
          const stream = await openai.chat.completions.create({
            model: conversation.Character.model,
            messages: messageHistory,
            stream: true,
            stream_options: { include_usage: true }, // Request usage data in stream
          });

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              aiResponseContent += content;
              
              // Update streaming tracker with chunk
              const updateResult = streamingTokenTracker.updateWithChunk(
                trackingResult.trackerId,
                content
              );
              
              sendSSE({
                type: "delta",
                content: content,
                trackerUpdate: updateResult.success ? {
                  outputTokensEstimated: updateResult.outputTokensEstimated,
                  creditsUsed: updateResult.creditsUsed,
                  creditsRemaining: updateResult.creditsRemaining,
                  usageRatio: updateResult.usageRatio,
                  isApproachingLimit: updateResult.isApproachingLimit
                } : null
              });
            }

            // Capture usage data from the final chunk
            if (chunk.usage) {
              streamUsageData = {
                inputTokens: chunk.usage.prompt_tokens || 0,
                outputTokens: chunk.usage.completion_tokens || 0,
              };
            }
          }
        } else if (modelProvider === "anthropic") {
          // Format messages for Claude
          const formattedMessages = messageHistory.map((msg) => {
            if (msg.role === "system") {
              return {
                role: "user",
                content: `You are ${conversation.Character.name}. Here is your character description and instructions:\n${msg.content}`,
              };
            }

            if (Array.isArray(msg.content)) {
              const content = [];
              for (const item of msg.content) {
                if (item.type === "text") {
                  content.push({ type: "text", text: item.text });
                } else if (item.type === "image_url") {
                  const base64Data = item.image_url.url.split(",")[1];
                  const mimeType = item.image_url.url
                    .split(";")[0]
                    .split(":")[1];
                  content.push({
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data: base64Data,
                    },
                  });
                }
              }
              return {
                role: msg.role === "assistant" ? "assistant" : "user",
                content: content,
              };
            }

            return {
              role: msg.role === "assistant" ? "assistant" : "user",
              content: msg.content,
            };
          });

          const stream = anthropic.messages.stream({
            model: conversation.Character.model,
            max_tokens: 1024,
            messages: formattedMessages,
            system: conversation.Character.systemPrompt,
          });

          for await (const messageStreamEvent of stream) {
            if (messageStreamEvent.type === "content_block_delta") {
              const content = messageStreamEvent.delta.text || "";
              if (content) {
                aiResponseContent += content;
                
                // Update streaming tracker with chunk
                const updateResult = streamingTokenTracker.updateWithChunk(
                  trackingResult.trackerId,
                  content
                );
                
                sendSSE({
                  type: "delta",
                  content: content,
                  trackerUpdate: updateResult.success ? {
                    outputTokensEstimated: updateResult.outputTokensEstimated,
                    creditsUsed: updateResult.creditsUsed,
                    creditsRemaining: updateResult.creditsRemaining,
                    usageRatio: updateResult.usageRatio,
                    isApproachingLimit: updateResult.isApproachingLimit
                  } : null
                });
              }
            } else if (messageStreamEvent.type === "message_stop") {
              // Extract usage data from final message
              const finalMessage = await stream.finalMessage();
              if (finalMessage.usage) {
                streamUsageData = {
                  inputTokens: finalMessage.usage.input_tokens || 0,
                  outputTokens: finalMessage.usage.output_tokens || 0,
                };
              }
            }
          }
        } else if (modelProvider === "google") {
          // Google AI streaming implementation
          if (!googleAI) {
            throw new Error("Google AI is not configured");
          }

          const model = googleAI.getGenerativeModel({
            model: conversation.Character.model,
            systemInstruction: conversation.Character.systemPrompt,
          });

          const chatHistory = [];
          for (const msg of messageHistory) {
            if (msg.role === "system") continue;

            let parts = [];
            if (Array.isArray(msg.content)) {
              for (const item of msg.content) {
                if (item.type === "text") {
                  parts.push({ text: item.text });
                } else if (item.type === "image_url") {
                  const base64Data = item.image_url.url.split(",")[1];
                  const mimeType = item.image_url.url
                    .split(";")[0]
                    .split(":")[1];
                  parts.push({
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  });
                }
              }
            } else {
              parts = [{ text: msg.content }];
            }

            chatHistory.push({
              role: msg.role === "assistant" ? "model" : "user",
              parts: parts,
            });
          }

          let result;
          if (chatHistory.length > 1) {
            const chat = model.startChat({
              history: chatHistory.slice(0, -1),
              generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
              },
            });
            const lastMessage = chatHistory[chatHistory.length - 1];
            result = await chat.sendMessageStream(lastMessage.parts);
          } else {
            const userMessage = chatHistory[0];
            result = await model.generateContentStream({
              contents: [userMessage],
              generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
              },
            });
          }

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              aiResponseContent += chunkText;
              
              // Update streaming tracker with chunk
              const updateResult = streamingTokenTracker.updateWithChunk(
                trackingResult.trackerId,
                chunkText
              );
              
              sendSSE({
                type: "delta",
                content: chunkText,
                trackerUpdate: updateResult.success ? {
                  outputTokensEstimated: updateResult.outputTokensEstimated,
                  creditsUsed: updateResult.creditsUsed,
                  creditsRemaining: updateResult.creditsRemaining,
                  usageRatio: updateResult.usageRatio,
                  isApproachingLimit: updateResult.isApproachingLimit
                } : null
              });
            }
          }

          // Extract usage data for Google AI
          const finalResponse = await result.response;
          if (finalResponse.usageMetadata) {
            streamUsageData = {
              inputTokens: finalResponse.usageMetadata.promptTokenCount || 0,
              outputTokens:
                finalResponse.usageMetadata.candidatesTokenCount || 0,
            };
          }
        } else {
          throw new Error(
            `Streaming not supported for provider: ${modelProvider}`
          );
        }

        // Save the complete AI message
        const aiMessage = await Message.create({
          content: aiResponseContent,
          role: "assistant",
          UserId: req.user.id,
          ConversationId: conversation.id,
          CharacterId: conversation.CharacterId,
          parentId: userMessage.id,
          childIndex: 0,
        });

        // CREDIT RESERVATION SETTLEMENT - Complete streaming and settle reservation
        try {
          console.log(`[STREAMING DEBUG] Starting settlement for tracker: ${trackingResult.trackerId}`);
          console.log(`[STREAMING DEBUG] AI Response length: ${aiResponseContent.length} chars`);
          console.log(`[STREAMING DEBUG] Stream usage data available: ${!!streamUsageData}`);
          
          // Complete streaming and settle the reservation
          const completionResult = await streamingTokenTracker.completeStreaming(
            trackingResult.trackerId,
            {
              outputTokens: streamUsageData ? streamUsageData.outputTokens : null,
              totalText: aiResponseContent,
              processingTime: Date.now() - startTime
            }
          );

          console.log(
            `[STREAMING DEBUG] Streaming completed: ${completionResult.trackerId}, actual credits used: ${completionResult.credits.used}, refunded: ${completionResult.credits.refunded}`
          );
          console.log(`[STREAMING DEBUG] Actual tokens - input: ${completionResult.actualTokens.input}, output: ${completionResult.actualTokens.output}`);

          // Record token usage for analytics
          // Use the actual token counts from the completion result
          console.log(`[STREAMING DEBUG] Recording token usage for user: ${req.user.id}, conversation: ${conversation.id}`);
          const tokenUsageRecord = await creditService.recordTokenUsage({
            userId: String(req.user.id),
            conversationId: conversation.id,
            messageId: aiMessage.id,
            modelProvider: modelProvider,
            modelName: conversation.Character.model,
            inputTokens: completionResult.actualTokens.input,
            outputTokens: completionResult.actualTokens.output,
          });
          console.log(`[STREAMING DEBUG] Token usage recorded successfully: ${tokenUsageRecord.id}`);

          // Send settlement info to client
          sendSSE({
            type: "reservationSettled",
            settlement: {
              trackerId: completionResult.trackerId,
              creditsReserved: completionResult.credits.reserved,
              creditsUsed: completionResult.credits.used,
              creditsCharged: completionResult.credits.charged,
              creditsRefunded: completionResult.credits.refunded,
              actualTokens: completionResult.actualTokens,
              estimatedTokens: completionResult.estimatedTokens,
              accuracyMetrics: completionResult.accuracyMetrics,
              performance: completionResult.performance
            }
          });

        } catch (settlementError) {
          console.error("Credit reservation settlement failed:", settlementError);

          // Try to cancel the reservation to prevent credit loss
          try {
            await streamingTokenTracker.cancelStreaming(
              trackingResult.trackerId,
              `Settlement failed: ${settlementError.message}`
            );
            
            console.log(`Reservation cancelled due to settlement failure: ${trackingResult.trackerId}`);
          } catch (cancelError) {
            console.error("Failed to cancel reservation after settlement error:", cancelError);
          }

          // Send error info to client
          sendSSE({
            type: "reservationError",
            error: "Credit settlement failed",
            trackerId: trackingResult.trackerId,
            details: settlementError.message
          });
        }

        // Update conversation
        await conversation.update({
          currentHeadId: aiMessage.id,
          lastMessage: aiResponseContent.substring(0, 50),
        });

        // Generate title if needed
        if (conversation.title === "New Conversation") {
          try {
            const titleResponse = await openai.chat.completions.create({
              model: getDefaultModel("free"),
              messages: [
                {
                  role: "system",
                  content:
                    "You are a conversation title generator. Generate a brief, engaging title (max 30 characters) based on the conversation. The title should capture the essence of the discussion. Respond with ONLY the title, no quotes or extra text.",
                },
                {
                  role: "user",
                  content: `User: ${req.body.content}\nAI: ${aiResponseContent}`,
                },
              ],
              max_tokens: 10,
              temperature: 0.7,
            });

            const newTitle = titleResponse.choices[0].message.content
              .trim()
              .replace(/^["']|["']$/g, "");
            await conversation.update({
              title: newTitle,
              lastMessage: aiResponseContent.substring(0, 50),
              currentHeadId: aiMessage.id,
            });

            sendSSE({
              type: "conversationUpdate",
              conversation: {
                id: conversation.id,
                title: newTitle,
                lastMessage: conversation.lastMessage,
                updatedAt: conversation.updatedAt,
              },
            });
          } catch (titleError) {
            console.error("Failed to generate title:", titleError);
          }
        }

        // Send completion message
        sendSSE({
          type: "complete",
          message: aiMessage,
          conversation: {
            id: conversation.id,
            title: conversation.title,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          },
          processingTime: Date.now() - startTime,
        });

        res.end();
      } catch (streamError) {
        console.error("Streaming error:", streamError);

        // Cancel the credit reservation on streaming error
        if (trackingResult && trackingResult.trackerId) {
          try {
            await streamingTokenTracker.cancelStreaming(
              trackingResult.trackerId,
              `Streaming error: ${streamError.message}`
            );
            console.log(`Reservation cancelled due to streaming error: ${trackingResult.trackerId}`);
          } catch (cancelError) {
            console.error("Failed to cancel reservation after streaming error:", cancelError);
          }
        }

        // Clean up user message on error
        if (userMessage) {
          try {
            await userMessage.destroy();
          } catch (cleanupError) {
            console.error(
              "Failed to cleanup user message (streaming):",
              cleanupError
            );
          }
        }

        sendSSE({
          type: "error",
          error: streamError.message || "Failed to generate response",
          reservationCancelled: trackingResult ? trackingResult.trackerId : null
        });
        res.end();
      }
    } catch (err) {
      console.error("Stream setup error:", err);
      
      // Cancel reservation if it was created during setup
      if (trackingResult && trackingResult.trackerId) {
        try {
          await streamingTokenTracker.cancelStreaming(
            trackingResult.trackerId,
            `Stream setup error: ${err.message}`
          );
          console.log(`Reservation cancelled due to setup error: ${trackingResult.trackerId}`);
        } catch (cancelError) {
          console.error("Failed to cancel reservation after setup error:", cancelError);
        }
      }
      
      res.status(500).json({ 
        error: err.message || "Failed to setup stream",
        reservationCancelled: trackingResult ? trackingResult.trackerId : null
      });
    }
  }
);
