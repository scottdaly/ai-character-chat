const TokenizerService = require("../services/tokenizerService");

async function testTokenizer() {
  console.log("Testing TokenizerService...\n");

  const tokenizerService = new TokenizerService();

  // Test messages
  const testCases = [
    {
      name: "Simple message",
      content: "Hello, how are you today?",
      model: "gpt-4",
      options: {}
    },
    {
      name: "Message with system prompt",
      content: "What is the capital of France?",
      model: "gpt-4o",
      options: {
        systemPrompt: "You are a helpful geography teacher. Answer questions concisely."
      }
    },
    {
      name: "Message with conversation history",
      content: "What about Spain?",
      model: "gpt-3.5-turbo",
      options: {
        systemPrompt: "You are a helpful geography teacher.",
        conversationHistory: [
          { role: "user", content: "What is the capital of France?" },
          { role: "assistant", content: "The capital of France is Paris." }
        ]
      }
    },
    {
      name: "Claude model (estimation)",
      content: "Explain quantum computing in simple terms.",
      model: "claude-3-5-sonnet-20241022",
      options: {}
    },
    {
      name: "Gemini model (estimation)",
      content: "Write a haiku about programming.",
      model: "gemini-1.5-pro-002",
      options: {}
    },
    {
      name: "Message with attachments",
      content: "What's in this image?",
      model: "gpt-4o",
      options: {
        attachments: [
          { type: "image", data: "base64_image_data_here" }
        ]
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n--- ${testCase.name} ---`);
    console.log(`Model: ${testCase.model}`);
    console.log(`Content: "${testCase.content}"`);
    
    try {
      const result = await tokenizerService.countTokens(
        testCase.content,
        testCase.model,
        testCase.options
      );

      console.log(`Input tokens: ${result.inputTokens}`);
      console.log(`Estimated output tokens: ${result.estimatedOutputTokens}`);
      console.log(`Method: ${result.method}`);
      console.log(`Is exact: ${result.isExact}`);

      // Calculate estimated cost (using example pricing)
      const inputCost = (result.inputTokens / 1000) * 0.01; // $0.01 per 1k tokens
      const outputCost = (result.estimatedOutputTokens / 1000) * 0.03; // $0.03 per 1k tokens
      const totalCost = inputCost + outputCost;
      const credits = totalCost / 0.001; // $0.001 per credit

      console.log(`Estimated cost: $${totalCost.toFixed(6)}`);
      console.log(`Credits needed: ${credits.toFixed(2)}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }

  // Cleanup
  tokenizerService.cleanup();
  console.log("\n\nTokenizer test complete!");
}

// Run the test
testTokenizer().catch(console.error);