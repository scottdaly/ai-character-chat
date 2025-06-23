const { expect } = require("chai");
const request = require("supertest");
const { Sequelize, DataTypes, Transaction } = require("sequelize");
const jwt = require("jsonwebtoken");

// Import our credit system components
const { defineCreditModels } = require("../models/creditModels");
const CreditService = require("../services/creditService");
const TokenExtractorService = require("../services/tokenExtractorService");

describe("Credit System - Phase 0 Tests", function () {
  let sequelize;
  let models;
  let creditService;
  let tokenExtractor;
  let testUser;

  // Setup test database
  before(async function () {
    this.timeout(10000);

    // Create in-memory SQLite database for testing
    sequelize = new Sequelize({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
      define: {
        timestamps: true,
      },
    });

    // Define User model (simplified for testing)
    const User = sequelize.define("User", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
      },
      subscriptionTier: {
        type: DataTypes.STRING,
        defaultValue: "free",
      },
      creditBalance: {
        type: DataTypes.DECIMAL(10, 4),
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: -100, // Allow small negative balance for edge cases
        },
      },
      lastCreditRefresh: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });

    // Define other required models
    const Character = sequelize.define("Character", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: DataTypes.STRING,
    });

    const Conversation = sequelize.define("Conversation", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: DataTypes.STRING,
    });

    const Message = sequelize.define("Message", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      content: DataTypes.TEXT,
      role: DataTypes.STRING,
    });

    // Initialize credit models
    const creditModels = defineCreditModels(sequelize);

    // Set up relationships
    User.hasMany(creditModels.TokenUsage, { foreignKey: "userId" });
    creditModels.TokenUsage.belongsTo(User, { foreignKey: "userId" });

    User.hasMany(creditModels.CreditAuditLog, { foreignKey: "userId" });
    creditModels.CreditAuditLog.belongsTo(User, { foreignKey: "userId" });

    User.hasMany(creditModels.CreditCompensation, { foreignKey: "userId" });
    creditModels.CreditCompensation.belongsTo(User, { foreignKey: "userId" });

    Conversation.hasMany(creditModels.TokenUsage, {
      foreignKey: "conversationId",
    });
    creditModels.TokenUsage.belongsTo(Conversation, {
      foreignKey: "conversationId",
    });

    Message.hasMany(creditModels.TokenUsage, { foreignKey: "messageId" });
    creditModels.TokenUsage.belongsTo(Message, { foreignKey: "messageId" });

    Message.hasMany(creditModels.CreditCompensation, {
      foreignKey: "messageId",
    });
    creditModels.CreditCompensation.belongsTo(Message, {
      foreignKey: "messageId",
    });

    models = {
      User,
      Character,
      Conversation,
      Message,
      ...creditModels,
    };

    // Sync database
    await sequelize.sync({ force: true });

    // Initialize services
    creditService = new CreditService(sequelize, models);
    tokenExtractor = new TokenExtractorService();

    // Create test user
    testUser = await User.create({
      email: "test@example.com",
      subscriptionTier: "free",
      creditBalance: 1000,
    });

    console.log("Test setup complete");
  });

  after(async function () {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe("1. Database Schema and Constraints", function () {
    it("should create all credit system tables", async function () {
      const tables = await sequelize.getQueryInterface().showAllTables();

      expect(tables).to.include("TokenUsages");
      expect(tables).to.include("CreditCompensations");
      expect(tables).to.include("CreditAuditLogs");
      expect(tables).to.include("CreditRefreshHistories");
      expect(tables).to.include("ModelPricings");
      // Note: TokenUsageArchives table may not be created in test environment
    });

    it("should enforce credit balance constraints", async function () {
      try {
        await models.User.create({
          email: "invalid@example.com",
          creditBalance: -200, // Below minimum allowed
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error.name).to.equal("SequelizeValidationError");
      }
    });

    it("should enforce token usage constraints", async function () {
      const conversation = await models.Conversation.create({ title: "Test" });
      const message = await models.Message.create({
        content: "Test",
        role: "user",
        ConversationId: conversation.id,
      });

      try {
        await models.TokenUsage.create({
          userId: testUser.id,
          conversationId: conversation.id,
          messageId: message.id,
          modelProvider: "openai",
          modelName: "gpt-4o",
          inputTokens: -5, // Invalid negative value
          outputTokens: 10,
          totalTokens: 5,
          inputCostUsd: 0.001,
          outputCostUsd: 0.002,
          totalCostUsd: 0.003,
          creditsUsed: 3,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error.name).to.equal("SequelizeValidationError");
      }
    });
  });

  describe("2. Credit Service - Basic Operations", function () {
    beforeEach(async function () {
      // Reset test user balance
      await testUser.update({ creditBalance: 1000 });
    });

    it("should check credit balance correctly", async function () {
      const result = await creditService.checkCreditBalance(testUser.id, 500);

      expect(result.hasCredits).to.be.true;
      expect(result.balance).to.equal(1000);
      expect(result.required).to.equal(500);
      expect(result.subscriptionTier).to.equal("free");
    });

    it("should detect insufficient credits", async function () {
      const result = await creditService.checkCreditBalance(testUser.id, 1500);

      expect(result.hasCredits).to.be.false;
      expect(result.balance).to.equal(1000);
      expect(result.reason).to.equal("Insufficient credits");
    });

    it("should deduct credits atomically", async function () {
      const result = await creditService.deductCredits(testUser.id, 250, {
        entityType: "message",
        entityId: "test-message-id",
        reason: "Test deduction",
      });

      expect(result.success).to.be.true;
      expect(result.previousBalance).to.equal(1000);
      expect(result.newBalance).to.equal(750);
      expect(result.creditsDeducted).to.equal(250);

      // Verify user balance was updated
      await testUser.reload();
      expect(parseFloat(testUser.creditBalance)).to.equal(750);
    });

    it("should create audit log for credit deduction", async function () {
      await creditService.deductCredits(testUser.id, 100, {
        entityType: "message",
        entityId: "audit-test-id",
        reason: "Audit test",
      });

      const auditLog = await models.CreditAuditLog.findOne({
        where: {
          userId: testUser.id,
          operation: "deduct",
          creditsAmount: 100,
        },
      });

      expect(auditLog).to.not.be.null;
      expect(auditLog.balanceBefore).to.equal(1000);
      expect(auditLog.balanceAfter).to.equal(900);
      expect(auditLog.relatedEntityType).to.equal("message");
      expect(auditLog.reason).to.equal("Audit test");
    });

    it("should reject deduction with insufficient funds", async function () {
      try {
        await creditService.deductCredits(testUser.id, 1500, {
          reason: "Should fail",
        });
        expect.fail("Should have thrown insufficient credits error");
      } catch (error) {
        expect(error.message).to.include("Insufficient credits");
      }

      // Verify balance unchanged
      await testUser.reload();
      expect(parseFloat(testUser.creditBalance)).to.equal(1000);
    });
  });

  describe("3. Race Condition Protection", function () {
    it("should handle concurrent credit deductions safely", async function () {
      this.timeout(5000);

      // Reset balance to exactly 1000
      await testUser.update({ creditBalance: 1000 });

      // Create multiple concurrent deduction requests
      const deductionPromises = [];
      for (let i = 0; i < 10; i++) {
        deductionPromises.push(
          creditService
            .deductCredits(testUser.id, 150, {
              reason: `Concurrent test ${i}`,
            })
            .catch((error) => ({ error: error.message }))
        );
      }

      const results = await Promise.all(deductionPromises);

      // Count successful and failed operations
      const successful = results.filter((r) => r.success === true);
      const failed = results.filter((r) => r.error);

      // Should have exactly 6 successful (6 * 150 = 900) and 4 failed
      // since we only have 1000 credits
      expect(successful.length).to.be.at.most(6);
      expect(failed.length).to.be.at.least(4);

      // Verify final balance is correct
      await testUser.reload();
      const finalBalance = parseFloat(testUser.creditBalance);
      const expectedBalance = 1000 - successful.length * 150;
      expect(finalBalance).to.equal(expectedBalance);
    });
  });

  describe("4. Token Extractor Service", function () {
    it("should extract OpenAI token usage correctly", function () {
      const mockResponse = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const result = tokenExtractor.extractTokenUsage(
        mockResponse,
        "openai",
        "gpt-4o"
      );

      expect(result.inputTokens).to.equal(100);
      expect(result.outputTokens).to.equal(50);
      expect(result.totalTokens).to.equal(150);
    });

    it("should extract Anthropic token usage correctly", function () {
      const mockResponse = {
        usage: {
          input_tokens: 120,
          output_tokens: 80,
        },
      };

      const result = tokenExtractor.extractTokenUsage(
        mockResponse,
        "anthropic",
        "claude-3-5-sonnet-20241022"
      );

      expect(result.inputTokens).to.equal(120);
      expect(result.outputTokens).to.equal(80);
      expect(result.totalTokens).to.equal(200);
    });

    it("should extract Google AI token usage correctly", function () {
      const mockResponse = {
        usageMetadata: {
          promptTokenCount: 90,
          candidatesTokenCount: 60,
          totalTokenCount: 150,
        },
      };

      const result = tokenExtractor.extractTokenUsage(
        mockResponse,
        "google",
        "gemini-1.5-pro-002"
      );

      expect(result.inputTokens).to.equal(90);
      expect(result.outputTokens).to.equal(60);
      expect(result.totalTokens).to.equal(150);
    });

    it("should handle missing usage data with estimation", function () {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                "This is a test response that should be estimated for token usage.",
            },
          },
        ],
      };

      const result = tokenExtractor.extractTokenUsage(
        mockResponse,
        "openai",
        "gpt-4o"
      );

      expect(result.inputTokens).to.be.a("number");
      expect(result.outputTokens).to.be.a("number");
      expect(result.totalTokens).to.be.a("number");
      expect(result.isEstimated).to.be.true;
    });

    it("should validate token usage data", function () {
      const validUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const result = tokenExtractor.validateUsage(validUsage);

      expect(result.inputTokens).to.equal(100);
      expect(result.outputTokens).to.equal(50);
      expect(result.totalTokens).to.equal(150);
    });

    it("should reject invalid token usage data", function () {
      const invalidUsage = {
        inputTokens: -10, // Invalid negative
        outputTokens: 50,
      };

      expect(() => {
        tokenExtractor.validateUsage(invalidUsage);
      }).to.throw("Invalid token counts");
    });
  });

  describe("5. Token Usage Recording", function () {
    it("should record token usage with cost calculation", async function () {
      const conversation = await models.Conversation.create({
        title: "Test Conversation",
      });
      const message = await models.Message.create({
        content: "Test message",
        role: "user",
        ConversationId: conversation.id,
      });

      const usageData = {
        userId: testUser.id,
        conversationId: conversation.id,
        messageId: message.id,
        modelProvider: "openai",
        modelName: "gpt-4o",
        inputTokens: 100,
        outputTokens: 50,
      };

      const result = await creditService.recordTokenUsage(usageData);

      expect(result.inputTokens).to.equal(100);
      expect(result.outputTokens).to.equal(50);
      expect(result.totalTokens).to.equal(150);
      expect(parseFloat(result.inputCostUsd)).to.be.above(0);
      expect(parseFloat(result.outputCostUsd)).to.be.above(0);
      expect(parseFloat(result.creditsUsed)).to.be.above(0);
    });

    it("should get model pricing correctly", async function () {
      const pricing = await creditService.getModelPricing("gpt-4o", "openai");

      expect(pricing.inputPricePer1k).to.be.a("number");
      expect(pricing.outputPricePer1k).to.be.a("number");
      expect(pricing.inputPricePer1k).to.be.above(0);
      expect(pricing.outputPricePer1k).to.be.above(0);
    });
  });

  describe("6. Compensation System", function () {
    it("should create compensation record", async function () {
      const message = await models.Message.create({
        content: "Test message",
        role: "user",
      });

      const compensation = await creditService.createCompensation(
        testUser.id,
        50,
        "Test compensation for failed operation",
        message.id
      );

      expect(compensation.userId).to.equal(testUser.id);
      expect(parseFloat(compensation.creditsToRefund)).to.equal(50);
      expect(compensation.reason).to.equal(
        "Test compensation for failed operation"
      );
      expect(compensation.status).to.equal("pending");
    });

    it("should process pending compensations", async function () {
      // Create a compensation
      await creditService.createCompensation(
        testUser.id,
        25,
        "Processing test compensation"
      );

      const initialBalance = parseFloat(testUser.creditBalance);

      // Process compensations
      const results = await creditService.processPendingCompensations();

      expect(results.length).to.be.at.least(1);
      expect(results[0].success).to.be.true;
      expect(results[0].creditsRefunded).to.equal(25);

      // Verify balance increased
      await testUser.reload();
      const newBalance = parseFloat(testUser.creditBalance);
      expect(newBalance).to.equal(initialBalance + 25);
    });
  });

  describe("7. Usage Statistics", function () {
    it("should get credit usage statistics", async function () {
      // Create some test usage records first
      const conversation = await models.Conversation.create({
        title: "Stats Test",
      });
      const message = await models.Message.create({
        content: "Stats test message",
        role: "user",
        ConversationId: conversation.id,
      });

      await creditService.recordTokenUsage({
        userId: testUser.id,
        conversationId: conversation.id,
        messageId: message.id,
        modelProvider: "openai",
        modelName: "gpt-4o",
        inputTokens: 200,
        outputTokens: 100,
      });

      const stats = await creditService.getCreditUsageStats(testUser.id);

      expect(stats.currentBalance).to.be.a("number");
      expect(stats.subscriptionTier).to.equal("free");
      expect(stats.totalTokens).to.be.a("number");
      expect(stats.totalCostUsd).to.be.a("number");
      expect(stats.totalCreditsUsed).to.be.a("number");
      expect(stats.totalRequests).to.be.a("number");
      expect(stats.recentUsage).to.be.an("array");
    });
  });

  describe("8. Error Handling", function () {
    it("should handle invalid user ID gracefully", async function () {
      try {
        await creditService.deductCredits("invalid-uuid", 100);
        expect.fail("Should have thrown error for invalid user ID");
      } catch (error) {
        expect(error.message).to.include("Invalid user ID");
      }
    });

    it("should handle non-existent user gracefully", async function () {
      const fakeUuid = "12345678-1234-1234-1234-123456789012";

      try {
        await creditService.deductCredits(fakeUuid, 100);
        expect.fail("Should have thrown error for non-existent user");
      } catch (error) {
        expect(error.message).to.include("User not found");
      }
    });

    it("should handle excessive credit deduction amounts", async function () {
      try {
        await creditService.deductCredits(testUser.id, 2000); // Exceeds safety limit
        expect.fail("Should have thrown error for excessive amount");
      } catch (error) {
        expect(error.message).to.include("safety limit");
      }
    });
  });
});

// Export for potential use in integration tests
module.exports = {
  CreditService,
  TokenExtractorService,
};
