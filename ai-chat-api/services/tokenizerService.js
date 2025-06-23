const { encoding_for_model, get_encoding } = require("tiktoken");
const ImageTokenCalculator = require("./imageTokenCalculator");
const TokenizationErrorHandler = require("./tokenizationErrorHandler");

// Add fetch polyfill for Node.js if needed
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  fetch = require('node-fetch');
} else {
  fetch = globalThis.fetch;
}

class TokenizerService {
  constructor() {
    this.tokenizers = new Map();
    this.defaultEncoding = null;
    this.imageCalculator = new ImageTokenCalculator();
    this.errorHandler = new TokenizationErrorHandler();
    this.initializeTokenizers();
  }

  initializeTokenizers() {
    try {
      // Initialize default encoding for fallback
      this.defaultEncoding = get_encoding("cl100k_base");

      // OpenAI tokenizers - using the appropriate encoding for each model
      const gpt4Encoding = encoding_for_model("gpt-4");
      const gpt35Encoding = encoding_for_model("gpt-3.5-turbo");

      // GPT-4 models
      this.tokenizers.set("gpt-4", gpt4Encoding);
      this.tokenizers.set("gpt-4o", gpt4Encoding);
      this.tokenizers.set("gpt-4o-mini", gpt35Encoding);
      this.tokenizers.set("gpt-4-turbo", gpt4Encoding);
      this.tokenizers.set("gpt-3.5-turbo", gpt35Encoding);
      
      // New models - using cl100k_base encoding
      this.tokenizers.set("gpt-4o-mini-2024-07-18", gpt35Encoding);
      this.tokenizers.set("gpt-4.1-2025-04-14", gpt4Encoding);
      this.tokenizers.set("o4-mini-2025-04-16", gpt4Encoding);
      this.tokenizers.set("chatgpt-4o-latest", gpt4Encoding);
      this.tokenizers.set("gpt-4o-2024-08-06", gpt4Encoding);

      // For Anthropic and Google, we'll use estimation for now
      // until their official tokenizers are available
      console.log("TokenizerService initialized with tiktoken for OpenAI models");
    } catch (error) {
      console.error("Failed to initialize tokenizers:", error);
      // Continue without tokenizers, will fall back to estimation
    }
  }

  /**
   * Count tokens for a message with robust error handling
   * @param {string} content - Message content
   * @param {string} model - Model name
   * @param {Object} options - Additional options (system prompt, history, attachments)
   * @returns {Object} Token counts
   */
  async countTokens(content, model, options = {}) {
    const provider = this.getProvider(model);
    const context = {
      content,
      model,
      provider,
      options,
      retryCount: 0
    };

    const attemptTokenCount = async (ctx) => {
      switch (ctx.provider) {
        case "openai":
          return this.countOpenAITokens(ctx.content, ctx.model, ctx.options);
        case "anthropic":
          return await this.countAnthropicTokens(ctx.content, ctx.model, ctx.options);
        case "google":
          return await this.countGoogleTokens(ctx.content, ctx.model, ctx.options);
        default:
          return this.estimateTokens(ctx.content, ctx.options);
      }
    };

    try {
      return await attemptTokenCount(context);
    } catch (error) {
      console.warn(`Primary token counting failed for ${model}:`, error.message);
      
      // Use error handler for sophisticated fallback
      return await this.errorHandler.handleError(error, context, attemptTokenCount);
    }
  }

  countOpenAITokens(content, model, options) {
    const encoder = this.tokenizers.get(model) || this.defaultEncoding;
    if (!encoder) {
      return this.estimateTokens(content, options);
    }

    let totalTokens = 0;

    // OpenAI message format overhead
    const messageOverhead = 4; // tokens per message
    const replyOverhead = 3; // tokens for reply priming

    // Count system prompt tokens
    if (options.systemPrompt) {
      totalTokens += encoder.encode(options.systemPrompt).length;
      totalTokens += messageOverhead;
    }

    // Count conversation history
    if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
      for (const msg of options.conversationHistory) {
        if (msg.content) {
          // Handle text content
          if (typeof msg.content === "string") {
            totalTokens += encoder.encode(msg.content).length;
          } else if (Array.isArray(msg.content)) {
            // Handle multimodal content (text + images)
            for (const part of msg.content) {
              if (part.type === "text" && part.text) {
                totalTokens += encoder.encode(part.text).length;
              } else if (part.type === "image_url") {
                // OpenAI charges ~85 tokens base + additional based on size
                // Using conservative estimate
                totalTokens += 85;
              }
            }
          }
          totalTokens += messageOverhead;
        }

        // Handle attachments in the old format using enhanced calculator
        if (msg.attachments && msg.attachments.length > 0) {
          totalTokens += this.imageCalculator.calculateMultipleImageTokens(
            msg.attachments,
            "openai",
            model
          );
        }
      }
    }

    // Count current message
    if (content) {
      totalTokens += encoder.encode(content).length;
      totalTokens += messageOverhead;
    }

    // Add attachment tokens for current message using enhanced calculator
    if (options.attachments && options.attachments.length > 0) {
      totalTokens += this.imageCalculator.calculateMultipleImageTokens(
        options.attachments,
        "openai",
        model
      );
    }

    // Add reply overhead
    totalTokens += replyOverhead;

    // Estimate output tokens based on input
    // This is a rough estimate - actual output will vary
    let estimatedOutputTokens = Math.min(
      Math.round(totalTokens * 0.75), // Assume output is 75% of input
      1024 // Cap at model's max_tokens default
    );

    return {
      inputTokens: totalTokens,
      estimatedOutputTokens,
      isExact: true,
      method: "tiktoken"
    };
  }

  async countAnthropicTokens(content, model, options) {
    try {
      // Try official Anthropic token counting API first
      const officialCount = await this.getAnthropicOfficialTokenCount(content, model, options);
      if (officialCount) {
        return officialCount;
      }
    } catch (error) {
      console.warn('Anthropic official token counting failed, using enhanced estimation:', error.message);
    }

    // Enhanced character-based estimation with model-specific calibration
    const modelConfig = this.getAnthropicModelConfig(model);
    
    let totalChars = 0;
    let adjustedChars = 0;

    // Count system prompt
    if (options.systemPrompt) {
      const systemChars = options.systemPrompt.length;
      totalChars += systemChars;
      adjustedChars += this.adjustForComplexity(options.systemPrompt, modelConfig);
    }

    // Count conversation history
    if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
      for (const msg of options.conversationHistory) {
        if (msg.content) {
          if (typeof msg.content === "string") {
            totalChars += msg.content.length;
            adjustedChars += this.adjustForComplexity(msg.content, modelConfig);
          } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "text" && part.text) {
                totalChars += part.text.length;
                adjustedChars += this.adjustForComplexity(part.text, modelConfig);
              }
            }
          }
        }
      }
    }

    // Count current message
    if (content) {
      totalChars += content.length;
      adjustedChars += this.adjustForComplexity(content, modelConfig);
    }

    // Use adjusted character count for more accurate estimation
    const baseTokens = Math.ceil(adjustedChars / modelConfig.charsPerToken) + modelConfig.overhead;

    // Calculate image tokens using enhanced calculator
    let imageTokens = 0;
    if (options.attachments && options.attachments.length > 0) {
      imageTokens += this.imageCalculator.calculateMultipleImageTokens(
        options.attachments, 
        "anthropic", 
        model
      );
    }

    // Also check history for images
    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        if (msg.attachments && msg.attachments.length > 0) {
          imageTokens += this.imageCalculator.calculateMultipleImageTokens(
            msg.attachments,
            "anthropic",
            model
          );
        }
      }
    }

    const inputTokens = baseTokens + imageTokens;
    const estimatedOutputTokens = Math.min(
      Math.round(inputTokens * modelConfig.outputRatio),
      this.getMaxOutputTokens(model)
    );

    return {
      inputTokens,
      estimatedOutputTokens,
      isExact: false,
      method: "enhanced-anthropic-estimation",
      modelConfig: modelConfig.name,
      breakdown: {
        textTokens: baseTokens,
        imageTokens,
        totalChars,
        adjustedChars
      }
    };
  }

  async countGoogleTokens(content, model, options) {
    try {
      // Try official Google AI token counting first
      const officialCount = await this.getGoogleOfficialTokenCount(content, model, options);
      if (officialCount) {
        return officialCount;
      }
    } catch (error) {
      console.warn('Google AI official token counting failed, using enhanced estimation:', error.message);
    }

    // Enhanced estimation with model-specific calibration
    const modelConfig = this.getGoogleModelConfig(model);
    
    let totalChars = 0;
    let adjustedChars = 0;

    // Count system instruction
    if (options.systemPrompt) {
      totalChars += options.systemPrompt.length;
      adjustedChars += this.adjustForComplexity(options.systemPrompt, modelConfig);
    }

    // Count conversation history
    if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
      for (const msg of options.conversationHistory) {
        if (msg.content) {
          if (typeof msg.content === "string") {
            totalChars += msg.content.length;
            adjustedChars += this.adjustForComplexity(msg.content, modelConfig);
          } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "text" && part.text) {
                totalChars += part.text.length;
                adjustedChars += this.adjustForComplexity(part.text, modelConfig);
              }
            }
          }
        }
      }
    }

    // Count current message
    if (content) {
      totalChars += content.length;
      adjustedChars += this.adjustForComplexity(content, modelConfig);
    }

    const baseTokens = Math.ceil(adjustedChars / modelConfig.charsPerToken) + modelConfig.overhead;

    // Calculate image tokens using enhanced calculator
    let imageTokens = 0;
    if (options.attachments && options.attachments.length > 0) {
      imageTokens += this.imageCalculator.calculateMultipleImageTokens(
        options.attachments,
        "google", 
        model
      );
    }

    // Also check history for images
    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        if (msg.attachments && msg.attachments.length > 0) {
          imageTokens += this.imageCalculator.calculateMultipleImageTokens(
            msg.attachments,
            "google",
            model
          );
        }
      }
    }

    const inputTokens = baseTokens + imageTokens;
    const estimatedOutputTokens = Math.min(
      Math.round(inputTokens * modelConfig.outputRatio),
      this.getMaxOutputTokens(model)
    );

    return {
      inputTokens,
      estimatedOutputTokens,
      isExact: false,
      method: "enhanced-google-estimation",
      modelConfig: modelConfig.name,
      breakdown: {
        textTokens: baseTokens,
        imageTokens,
        totalChars,
        adjustedChars
      }
    };
  }

  estimateTokens(content, options) {
    // Fallback estimation using simple character count
    const CHARS_PER_TOKEN = 4; // Conservative estimate

    let totalChars = content ? content.length : 0;

    if (options.systemPrompt) {
      totalChars += options.systemPrompt.length;
    }

    if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
      for (const msg of options.conversationHistory) {
        if (msg.content) {
          if (typeof msg.content === "string") {
            totalChars += msg.content.length;
          } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "text" && part.text) {
                totalChars += part.text.length;
              }
            }
          }
        }
      }
    }

    const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
    const attachmentTokens = (options.attachments?.length || 0) * 85;

    return {
      inputTokens: estimatedTokens + attachmentTokens,
      estimatedOutputTokens: Math.min(estimatedTokens * 0.5, 1000),
      isExact: false,
      method: "fallback-estimation"
    };
  }

  estimateImageTokens(attachment) {
    // Legacy method - use ImageTokenCalculator for new implementations
    const width = attachment.width || 512;
    const height = attachment.height || 512;
    return Math.ceil((width * height) / 750);
  }

  /**
   * Get Anthropic official token count using their API
   * @private
   */
  async getAnthropicOfficialTokenCount(content, model, options) {
    // Only try if we have an API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return null;
    }

    try {
      // Build messages array for Anthropic API
      const messages = [];
      
      // Add conversation history
      if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
        for (const msg of options.conversationHistory) {
          if (msg.content) {
            messages.push({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: typeof msg.content === 'string' ? msg.content : msg.content
            });
          }
        }
      }

      // Add current message
      if (content) {
        messages.push({
          role: 'user',
          content: content
        });
      }

      // Make API request to count tokens
      const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          system: options.systemPrompt || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        inputTokens: data.input_tokens || 0,
        estimatedOutputTokens: Math.min(
          Math.round((data.input_tokens || 0) * 0.75),
          this.getMaxOutputTokens(model)
        ),
        isExact: true,
        method: "anthropic-official-api"
      };

    } catch (error) {
      // Don't throw - fall back to estimation
      console.warn('Anthropic official token counting failed:', error.message);
      return null;
    }
  }

  /**
   * Get model-specific configuration for Anthropic models
   * @private
   */
  getAnthropicModelConfig(model) {
    const configs = {
      "claude-opus-4-20250514": {
        name: "Claude 4 Opus",
        charsPerToken: 3.2,
        overhead: 12,
        outputRatio: 0.8
      },
      "claude-sonnet-4-20250514": {
        name: "Claude 4 Sonnet", 
        charsPerToken: 3.3,
        overhead: 10,
        outputRatio: 0.75
      },
      "claude-3-7-sonnet-latest": {
        name: "Claude 3.7 Sonnet",
        charsPerToken: 3.4,
        overhead: 8,
        outputRatio: 0.75
      },
      "claude-3-5-haiku-latest": {
        name: "Claude 3.5 Haiku",
        charsPerToken: 3.6,
        overhead: 6,
        outputRatio: 0.7
      },
      "claude-3-5-sonnet-20241022": {
        name: "Claude 3.5 Sonnet (Legacy)",
        charsPerToken: 3.5,
        overhead: 8,
        outputRatio: 0.75
      },
      "claude-3-5-haiku-20241022": {
        name: "Claude 3.5 Haiku (Legacy)",
        charsPerToken: 3.6,
        overhead: 6,
        outputRatio: 0.7
      }
    };

    return configs[model] || {
      name: "Claude (Unknown)",
      charsPerToken: 3.5,
      overhead: 8,
      outputRatio: 0.75
    };
  }

  /**
   * Adjust character count for content complexity
   * @private
   */
  adjustForComplexity(text, modelConfig) {
    let adjustedLength = text.length;
    
    // Code blocks are tokenized differently (usually more tokens)
    const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
    codeBlocks.forEach(block => {
      adjustedLength += block.length * 0.15; // Code uses ~15% more tokens
    });
    
    // Inline code
    const inlineCode = text.match(/`[^`]+`/g) || [];
    adjustedLength += inlineCode.length * 2; // Inline code adds overhead
    
    // Markdown syntax adds tokens
    const markdownElements = text.match(/[*_`#\[\]()]/g) || [];
    adjustedLength += markdownElements.length * 0.3;
    
    // URLs typically use more tokens than their character count
    const urls = text.match(/(https?:\/\/[^\s]+)/g) || [];
    urls.forEach(url => {
      adjustedLength += url.length * 0.2; // URLs use ~20% more tokens
    });
    
    // Unicode characters often take more tokens
    const unicodeChars = text.match(/[^\x00-\x7F]/g) || [];
    adjustedLength += unicodeChars.length * 0.3;
    
    // JSON/structured data
    if (text.includes('{') && text.includes('}')) {
      const jsonBlocks = text.match(/\{[\s\S]*?\}/g) || [];
      jsonBlocks.forEach(block => {
        adjustedLength += block.length * 0.1; // JSON uses slightly more tokens
      });
    }
    
    return adjustedLength;
  }

  /**
   * Get maximum output tokens for a model
   * @private
   */
  getMaxOutputTokens(model) {
    const limits = {
      "claude-opus-4-20250514": 4096,
      "claude-sonnet-4-20250514": 4096,
      "claude-3-7-sonnet-latest": 4096,
      "claude-3-5-haiku-latest": 4096,
      "gpt-4o-mini-2024-07-18": 16384,
      "gpt-4.1-2025-04-14": 4096,
      "o4-mini-2025-04-16": 65536,
      "chatgpt-4o-latest": 4096,
      "gemini-2.5-pro-preview-05-06": 8192,
      "gemini-2.5-flash-preview-05-20": 8192,
      "gemini-2.0-flash": 8192,
      "gemini-2.0-flash-lite": 8192
    };

    return limits[model] || 4096;
  }

  getProvider(model) {
    if (!model) return "unknown";
    
    const modelLower = model.toLowerCase();
    if (modelLower.includes("gpt")) return "openai";
    if (modelLower.includes("claude")) return "anthropic";
    if (modelLower.includes("gemini")) return "google";
    return "unknown";
  }

  /**
   * Get Google AI official token count using their SDK
   * @private
   */
  async getGoogleOfficialTokenCount(content, model, options) {
    // Only try if we have an API key
    if (!process.env.GOOGLE_AI_API_KEY) {
      return null;
    }

    try {
      // Import Google AI SDK dynamically
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      
      // Get the model
      const geminiModel = genAI.getGenerativeModel({ model: model });
      
      // Build content array for Google AI
      const contents = [];
      
      // Add conversation history
      if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
        for (const msg of options.conversationHistory) {
          if (msg.content) {
            contents.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            });
          }
        }
      }

      // Add current message
      if (content) {
        contents.push({
          role: 'user',
          parts: [{ text: content }]
        });
      }

      // Count tokens
      const result = await geminiModel.countTokens({ contents });
      
      return {
        inputTokens: result.totalTokens || 0,
        estimatedOutputTokens: Math.min(
          Math.round((result.totalTokens || 0) * 0.75),
          this.getMaxOutputTokens(model)
        ),
        isExact: true,
        method: "google-official-sdk"
      };

    } catch (error) {
      // Don't throw - fall back to estimation
      console.warn('Google AI official token counting failed:', error.message);
      return null;
    }
  }

  /**
   * Get model-specific configuration for Google models
   * @private
   */
  getGoogleModelConfig(model) {
    const configs = {
      "gemini-2.5-pro-preview-05-06": {
        name: "Gemini 2.5 Pro",
        charsPerToken: 3.8,
        overhead: 15,
        outputRatio: 0.8
      },
      "gemini-2.5-flash-preview-05-20": {
        name: "Gemini 2.5 Flash",
        charsPerToken: 4.0,
        overhead: 12,
        outputRatio: 0.75
      },
      "gemini-2.0-flash": {
        name: "Gemini 2.0 Flash",
        charsPerToken: 4.2,
        overhead: 10,
        outputRatio: 0.7
      },
      "gemini-2.0-flash-lite": {
        name: "Gemini 2.0 Flash Lite",
        charsPerToken: 4.3,
        overhead: 8,
        outputRatio: 0.65
      },
      "gemini-1.5-pro": {
        name: "Gemini 1.5 Pro (Legacy)",
        charsPerToken: 4.0,
        overhead: 12,
        outputRatio: 0.75
      },
      "gemini-1.5-flash": {
        name: "Gemini 1.5 Flash (Legacy)",
        charsPerToken: 4.2,
        overhead: 10,
        outputRatio: 0.7
      }
    };

    return configs[model] || {
      name: "Gemini (Unknown)",
      charsPerToken: 4.0,
      overhead: 10,
      outputRatio: 0.75
    };
  }

  /**
   * Get error metrics for monitoring
   * @returns {Object} Error metrics summary
   */
  getErrorMetrics() {
    return this.errorHandler.getErrorMetrics();
  }

  /**
   * Clean up old error metrics (call periodically)
   */
  cleanupOldMetrics() {
    this.errorHandler.cleanupOldMetrics();
  }

  /**
   * Get service health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const metrics = this.getErrorMetrics();
    const tikTokenStatus = this.defaultEncoding ? 'active' : 'unavailable';
    
    return {
      tikTokenStatus,
      totalTokenizers: this.tokenizers.size,
      totalErrors: metrics.totalErrors,
      recentErrors: metrics.recentErrors.length,
      errorsByProvider: metrics.errorsByProvider,
      lastMetricsCleanup: new Date()
    };
  }

  /**
   * Clean up tokenizer resources
   */
  cleanup() {
    // Free tokenizer encodings to prevent memory leaks
    try {
      for (const encoder of this.tokenizers.values()) {
        if (encoder && encoder.free && typeof encoder.free === 'function') {
          try {
            encoder.free();
          } catch (e) {
            // Ignore cleanup errors - tiktoken sometimes throws when already freed
          }
        }
      }
      if (this.defaultEncoding && this.defaultEncoding.free && typeof this.defaultEncoding.free === 'function') {
        try {
          this.defaultEncoding.free();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.warn('Error during tokenizer cleanup:', error.message);
    }
    this.tokenizers.clear();
    
    // Clean up error metrics
    this.cleanupOldMetrics();
  }
}

module.exports = TokenizerService;