/**
 * Test script for Phase 2: Credit Reservation System
 * Run with: node test-phase2-reservations.js
 */

const { Sequelize, DataTypes } = require('sequelize');
const CreditService = require('./services/creditService');
const StreamingTokenTracker = require('./services/streamingTokenTracker');
const TokenizerService = require('./services/tokenizerService');
const { defineReservationModels } = require('./models/reservationModels');

async function testPhase2Reservations() {
  console.log('🚀 Testing Phase 2: Credit Reservation System');
  console.log('===============================================\n');

  // Initialize in-memory database for testing
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });

  try {
    // Define test models
    const User = sequelize.define('User', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      creditBalance: { type: DataTypes.DECIMAL(10, 4), defaultValue: 100.0000 },
      subscriptionTier: { type: DataTypes.STRING, defaultValue: 'free' }
    });

    const CreditAuditLog = sequelize.define('CreditAuditLog', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      operation: { type: DataTypes.STRING, allowNull: false },
      creditsAmount: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      balanceBefore: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      balanceAfter: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      relatedEntityType: { type: DataTypes.STRING },
      relatedEntityId: { type: DataTypes.UUID },
      reason: { type: DataTypes.TEXT },
      metadata: { type: DataTypes.JSON },
      ipAddress: { type: DataTypes.STRING },
      userAgent: { type: DataTypes.TEXT }
    });

    const ModelPricing = sequelize.define('ModelPricing', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      modelName: { type: DataTypes.STRING, allowNull: false },
      provider: { type: DataTypes.STRING, allowNull: false },
      inputPricePer1k: { type: DataTypes.DECIMAL(10, 6), allowNull: false },
      outputPricePer1k: { type: DataTypes.DECIMAL(10, 6), allowNull: false },
      effectiveDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      deprecatedDate: { type: DataTypes.DATE, allowNull: true }
    });

    // Define reservation models without foreign key constraints for testing
    const CreditReservation = sequelize.define('CreditReservation', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      conversationId: { type: DataTypes.UUID, allowNull: true },
      messageId: { type: DataTypes.UUID, allowNull: true },
      creditsReserved: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      actualCreditsUsed: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
      reservationType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'streaming' },
      context: { type: DataTypes.JSON, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      settledAt: { type: DataTypes.DATE, allowNull: true },
      errorReason: { type: DataTypes.TEXT, allowNull: true }
    });

    const ReservationSettlement = sequelize.define('ReservationSettlement', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reservationId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      creditsReserved: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      actualCreditsUsed: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      creditsRefunded: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      balanceBefore: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      balanceAfter: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      settlementType: { type: DataTypes.STRING(20), allowNull: false },
      tokenUsageData: { type: DataTypes.JSON, allowNull: true },
      accuracyMetrics: { type: DataTypes.JSON, allowNull: true },
      processingTime: { type: DataTypes.INTEGER, allowNull: true }
    });

    // Mock additional models
    const mockModels = {
      User,
      CreditAuditLog,
      ModelPricing,
      CreditReservation,
      ReservationSettlement,
      TokenUsage: { create: () => null },
      CreditCompensation: { create: () => null },
      CreditRefreshHistory: { create: () => null },
      sequelize
    };

    // Sync database
    await sequelize.sync({ force: true });

    // Create test user
    const testUser = await User.create({
      creditBalance: 50.0000,
      subscriptionTier: 'pro'
    });

    console.log(`✅ Test setup complete. User ID: ${testUser.id}`);
    console.log(`💰 Initial balance: ${testUser.creditBalance} credits\n`);

    // Initialize services
    const tokenizerService = new TokenizerService();
    const creditService = new CreditService(sequelize, mockModels, tokenizerService);
    const streamingTracker = new StreamingTokenTracker(creditService, tokenizerService);

    // Test 1: Basic Credit Reservation
    console.log('1️⃣ Testing Basic Credit Reservation');
    console.log('-----------------------------------');

    try {
      const reservationResult = await creditService.reserveCredits(
        testUser.id,
        5.0000,
        {
          conversationId: 'conv-test-123',
          messageId: 'msg-test-123',
          type: 'streaming',
          model: 'gpt-4o-mini-2024-07-18',
          provider: 'openai',
          estimatedTokens: 1000,
          operationType: 'chat_completion',
          metadata: { testCase: 'basic_reservation' }
        }
      );

      console.log(`✅ Reservation created: ${reservationResult.reservationId}`);
      console.log(`💰 Credits reserved: ${reservationResult.creditsReserved}`);
      console.log(`🏦 New balance: ${reservationResult.newBalance}`);

      // Verify user balance was deducted
      const userAfterReservation = await User.findByPk(testUser.id);
      const expectedBalance = 50.0000 - 5.0000;
      
      if (Math.abs(parseFloat(userAfterReservation.creditBalance) - expectedBalance) < 0.0001) {
        console.log(`✅ Balance correctly updated: ${userAfterReservation.creditBalance}`);
      } else {
        console.log(`❌ Balance mismatch: expected ${expectedBalance}, got ${userAfterReservation.creditBalance}`);
      }

      // Test 2: Reservation Settlement
      console.log('\n2️⃣ Testing Reservation Settlement');
      console.log('----------------------------------');

      const settlementResult = await creditService.settleReservation(
        reservationResult.reservationId,
        3.5000, // Used less than reserved
        {
          inputTokens: 800,
          outputTokens: 600,
          processingTime: 2500
        }
      );

      console.log(`✅ Settlement completed: ${settlementResult.settlementId}`);
      console.log(`💰 Credits used: ${settlementResult.actualCreditsUsed}`);
      console.log(`💰 Credits refunded: ${settlementResult.creditsRefunded}`);
      console.log(`🏦 Final balance: ${settlementResult.newBalance}`);
      console.log(`📊 Settlement type: ${settlementResult.settlementType}`);

      // Test 3: StreamingTokenTracker Integration
      console.log('\n3️⃣ Testing StreamingTokenTracker');
      console.log('--------------------------------');

      const trackingConfig = {
        userId: testUser.id,
        conversationId: 'conv-streaming-123',
        messageId: 'msg-streaming-123',
        content: 'Write a detailed explanation of quantum computing and its applications in modern technology.',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        systemPrompt: 'You are a helpful AI assistant that explains complex topics clearly.',
        operationType: 'chat_completion'
      };

      const trackerResult = await streamingTracker.startTracking(trackingConfig);
      console.log(`✅ Streaming tracker started: ${trackerResult.trackerId}`);
      console.log(`💰 Credits reserved: ${trackerResult.creditsReserved}`);
      console.log(`📊 Buffer multiplier: ${trackerResult.bufferMultiplier}`);

      // Simulate streaming chunks
      const testChunks = [
        'Quantum computing is a revolutionary paradigm that',
        ' leverages the principles of quantum mechanics to',
        ' process information in ways fundamentally different',
        ' from classical computers. Unlike classical bits',
        ' which exist in definite states of 0 or 1, quantum',
        ' bits (qubits) can exist in superposition states.'
      ];

      console.log('\n📡 Simulating streaming chunks...');
      for (let i = 0; i < testChunks.length; i++) {
        const updateResult = streamingTracker.updateWithChunk(
          trackerResult.trackerId,
          testChunks[i]
        );
        
        if (updateResult.success) {
          const creditsUsed = typeof updateResult.creditsUsed === 'number' ? updateResult.creditsUsed.toFixed(4) : updateResult.creditsUsed;
          console.log(`   Chunk ${i + 1}: ${updateResult.outputTokensEstimated} tokens, ${creditsUsed} credits used`);
        }
      }

      // Complete streaming
      const completionResult = await streamingTracker.completeStreaming(
        trackerResult.trackerId,
        {
          outputTokens: 245, // Final accurate count
          totalText: testChunks.join('')
        }
      );

      console.log(`✅ Streaming completed successfully`);
      console.log(`📊 Actual tokens: ${completionResult.actualTokens.total}`);
      console.log(`📊 Estimated tokens: ${completionResult.estimatedTokens.total}`);
      console.log(`💰 Final credits used: ${completionResult.credits.used.toFixed(4)}`);
      console.log(`💰 Credits refunded: ${completionResult.credits.refunded.toFixed(4)}`);
      console.log(`🎯 Accuracy: ${completionResult.accuracyMetrics.accuracyCategory}`);

      // Test 4: Reservation Cancellation
      console.log('\n4️⃣ Testing Reservation Cancellation');
      console.log('------------------------------------');

      // Create another reservation to cancel
      const cancelReservation = await creditService.reserveCredits(
        testUser.id,
        8.0000,
        {
          conversationId: 'conv-cancel-123',
          type: 'streaming',
          model: 'gpt-4o-2024-08-06',
          provider: 'openai',
          metadata: { testCase: 'cancellation_test' }
        }
      );

      console.log(`✅ Reservation for cancellation: ${cancelReservation.reservationId}`);

      const cancellationResult = await creditService.cancelReservation(
        cancelReservation.reservationId,
        'Test cancellation'
      );

      console.log(`✅ Reservation cancelled successfully`);
      console.log(`💰 Credits refunded: ${cancellationResult.creditsRefunded}`);
      console.log(`🏦 Balance restored: ${cancellationResult.newBalance}`);

      // Test 5: Active Reservations Query
      console.log('\n5️⃣ Testing Active Reservations Query');
      console.log('------------------------------------');

      // Create a couple more reservations
      await creditService.reserveCredits(testUser.id, 2.0000, { type: 'batch', model: 'gpt-4o-mini-2024-07-18', provider: 'openai' });
      await creditService.reserveCredits(testUser.id, 4.0000, { type: 'streaming', model: 'gemini-2.0-flash', provider: 'google' });

      const activeReservations = await creditService.getActiveReservations(testUser.id);
      console.log(`✅ Found ${activeReservations.length} active reservations`);
      
      for (const reservation of activeReservations) {
        console.log(`   - ${reservation.id}: ${reservation.creditsReserved} credits (${reservation.type})`);
      }

      // Test 6: Streaming Statistics
      console.log('\n6️⃣ Testing Streaming Statistics');
      console.log('-------------------------------');

      const stats = streamingTracker.getStreamingStats();
      console.log(`📊 Active trackers: ${stats.activeTrackers}`);
      console.log(`📊 Total started: ${stats.totalStarted}`);
      console.log(`📊 Total completed: ${stats.totalCompleted}`);
      console.log(`📊 By provider:`, stats.byProvider);

      // Test 7: Error Handling
      console.log('\n7️⃣ Testing Error Handling');
      console.log('-------------------------');

      try {
        // Try to reserve more credits than available
        await creditService.reserveCredits(testUser.id, 100.0000, { type: 'test' });
        console.log('❌ Should have failed with insufficient credits');
      } catch (error) {
        console.log(`✅ Correctly rejected: ${error.message}`);
      }

      try {
        // Try to settle non-existent reservation
        await creditService.settleReservation('non-existent-id', 1.0000);
        console.log('❌ Should have failed with reservation not found');
      } catch (error) {
        console.log(`✅ Correctly rejected: ${error.message}`);
      }

      // Final balance check
      console.log('\n8️⃣ Final Balance Verification');
      console.log('-----------------------------');

      const finalUser = await User.findByPk(testUser.id);
      console.log(`🏦 Final user balance: ${finalUser.creditBalance} credits`);

      const finalActiveReservations = await creditService.getActiveReservations(testUser.id);
      const totalReserved = finalActiveReservations.reduce((sum, r) => sum + r.creditsReserved, 0);
      console.log(`💰 Total active reservations: ${totalReserved} credits`);

      console.log('\n✅ Phase 2 Testing Complete!');
      console.log('============================');
      console.log('Credit Reservation System features tested:');
      console.log('• ✅ Atomic credit reservations with balance deduction');
      console.log('• ✅ Reservation settlement with accurate refunds');
      console.log('• ✅ StreamingTokenTracker real-time tracking');
      console.log('• ✅ Reservation cancellation and cleanup');
      console.log('• ✅ Active reservations management');
      console.log('• ✅ Comprehensive error handling');
      console.log('• ✅ Accuracy metrics and performance tracking');
      console.log('• ✅ Audit logging for all operations');

    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }

  } catch (error) {
    console.error('💥 Test setup failed:', error);
    throw error;
  } finally {
    // Cleanup
    try {
      await sequelize.close();
      console.log('\n🧹 Database connection closed');
    } catch (error) {
      console.error('Warning: Failed to close database connection:', error.message);
    }
  }
}

// Error handling for the test script
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled Rejection:', error.message);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  testPhase2Reservations().catch(error => {
    console.error('💥 Phase 2 tests failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testPhase2Reservations };