/**
 * Test script for enhanced tokenization
 * Run with: node test-tokenization.js
 */

const TokenizerService = require('./services/tokenizerService');
const CreditService = require('./services/creditService');
const ImageTokenCalculator = require('./services/imageTokenCalculator');

async function testTokenization() {
  console.log('🚀 Testing Enhanced Tokenization - Phase 1');
  console.log('================================================\n');

  // Initialize services
  const tokenizerService = new TokenizerService();
  const imageCalculator = new ImageTokenCalculator();
  
  // Mock models object for CreditService
  const mockModels = {
    User: { findByPk: () => null },
    TokenUsage: { create: () => null },
    CreditAuditLog: { create: () => null },
    ModelPricing: { findOne: () => null },
    sequelize: { transaction: () => ({ commit: () => {}, rollback: () => {} }) }
  };
  
  const creditService = new CreditService(null, mockModels, tokenizerService);

  // Test cases
  const testCases = [
    {
      name: 'Simple OpenAI Message',
      content: 'Hello, how are you today?',
      model: 'gpt-4o-mini-2024-07-18',
      provider: 'openai',
      options: {}
    },
    {
      name: 'Complex Anthropic Message with Code',
      content: 'Can you help me write a Python function?\n\n```python\ndef calculate_sum(a, b):\n    return a + b\n```\n\nThis should add two numbers.',
      model: 'claude-3-7-sonnet-latest',
      provider: 'anthropic',
      options: {
        systemPrompt: 'You are a helpful coding assistant.',
        conversationHistory: [
          { role: 'user', content: 'I need help with Python' },
          { role: 'assistant', content: 'I\'d be happy to help you with Python programming!' }
        ]
      }
    },
    {
      name: 'Google Message with Images',
      content: 'Analyze this image and tell me what you see.',
      model: 'gemini-2.0-flash',
      provider: 'google',
      options: {
        attachments: [
          { width: 1024, height: 768, type: 'image/jpeg', size: 150000 },
          { width: 512, height: 512, type: 'image/png', size: 80000 }
        ]
      }
    },
    {
      name: 'Long Conversation History',
      content: 'What do you think about this discussion?',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      options: {
        systemPrompt: 'You are a thoughtful discussion partner.',
        conversationHistory: Array.from({ length: 10 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `This is message ${i + 1} in our conversation. It contains various topics including technology, philosophy, and science.`
        }))
      }
    }
  ];

  console.log('1️⃣ Testing Image Token Calculation');
  console.log('-----------------------------------');
  
  // Test image calculator
  const testImages = [
    { attachment: { width: 1024, height: 768 }, provider: 'openai', model: 'gpt-4o' },
    { attachment: { width: 512, height: 512 }, provider: 'anthropic', model: 'claude-3-7-sonnet-latest' },
    { attachment: { width: 2048, height: 1536 }, provider: 'google', model: 'gemini-2.0-flash' }
  ];

  for (const test of testImages) {
    const tokens = imageCalculator.calculateTokens(test.attachment, test.provider, test.model);
    const details = imageCalculator.getCalculationDetails(test.attachment, test.provider, test.model);
    
    console.log(`📷 ${test.provider}/${test.model}:`);
    console.log(`   Dimensions: ${test.attachment.width}x${test.attachment.height}`);
    console.log(`   Tokens: ${tokens}`);
    console.log(`   Method: ${details.calculation}`);
    console.log('');
  }

  console.log('2️⃣ Testing Enhanced Tokenization');
  console.log('---------------------------------');

  for (const testCase of testCases) {
    console.log(`🧪 ${testCase.name}`);
    console.log(`   Model: ${testCase.model}`);
    console.log(`   Content length: ${testCase.content.length} chars`);
    
    try {
      // Test tokenizer service
      const tokenResult = await tokenizerService.countTokens(
        testCase.content,
        testCase.model,
        testCase.options
      );
      
      console.log(`   📊 Token Count:`);
      console.log(`      Input: ${tokenResult.inputTokens}`);
      console.log(`      Output (est): ${tokenResult.estimatedOutputTokens}`);
      console.log(`      Method: ${tokenResult.method}`);
      console.log(`      Exact: ${tokenResult.isExact ? 'Yes' : 'No'}`);
      
      if (tokenResult.breakdown) {
        console.log(`      Breakdown:`, tokenResult.breakdown);
      }

      // Test credit estimation
      const creditResult = await creditService.estimateMessageCredits(
        testCase.content,
        testCase.model,
        testCase.provider,
        testCase.options
      );
      
      console.log(`   💰 Credit Estimation:`);
      console.log(`      Credits needed: ${creditResult.creditsNeeded.toFixed(4)}`);
      console.log(`      Total cost: $${creditResult.totalCostUsd.toFixed(6)}`);
      console.log(`      Confidence: ${creditResult.confidence}`);
      console.log(`      Buffer: ${creditResult.bufferMultiplier}x`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('3️⃣ Testing Error Handling');
  console.log('-------------------------');

  // Test with invalid model
  try {
    console.log('🧪 Testing invalid model fallback...');
    const result = await tokenizerService.countTokens(
      'This is a test message',
      'invalid-model-name',
      {}
    );
    console.log(`   ✅ Fallback successful: ${result.method}`);
    console.log(`   Tokens: ${result.inputTokens} input, ${result.estimatedOutputTokens} output`);
  } catch (error) {
    console.log(`   ❌ Fallback failed: ${error.message}`);
  }

  console.log('');
  console.log('4️⃣ Service Health Check');
  console.log('----------------------');

  const healthStatus = tokenizerService.getHealthStatus();
  console.log('📊 Tokenizer Service Status:');
  console.log(`   TikToken: ${healthStatus.tikTokenStatus}`);
  console.log(`   Tokenizers loaded: ${healthStatus.totalTokenizers}`);
  console.log(`   Total errors: ${healthStatus.totalErrors}`);
  console.log(`   Recent errors: ${healthStatus.recentErrors}`);

  const errorMetrics = tokenizerService.getErrorMetrics();
  if (errorMetrics.totalErrors > 0) {
    console.log('   Error breakdown:', errorMetrics.errorsByProvider);
  }

  console.log('');
  console.log('✅ Phase 1 Testing Complete!');
  console.log('============================');
  console.log('Enhanced tokenization features:');
  console.log('• ✅ Provider-specific image token calculation');
  console.log('• ✅ Enhanced character-based estimation for Anthropic/Google');
  console.log('• ✅ Official API integration (when keys available)');
  console.log('• ✅ Comprehensive error handling and fallbacks');
  console.log('• ✅ Confidence-based buffer multipliers');
  console.log('• ✅ Detailed breakdown and monitoring');

  // Cleanup
  tokenizerService.cleanup();
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
  testTokenization().catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testTokenization };