/**
 * Tokenization Error Handler
 * Provides robust error handling and fallback strategies for token counting
 */

class TokenizationErrorHandler {
  constructor() {
    this.fallbackStrategies = new Map();
    this.errorMetrics = new Map();
    this.initializeFallbackStrategies();
  }

  /**
   * Initialize fallback strategies for different error types
   * @private
   */
  initializeFallbackStrategies() {
    // API rate limit errors
    this.fallbackStrategies.set('rate_limit', {
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      fallbackMethod: 'enhanced_estimation'
    });

    // Network/timeout errors
    this.fallbackStrategies.set('network_error', {
      shouldRetry: true,
      maxRetries: 2,
      retryDelay: 500,
      fallbackMethod: 'enhanced_estimation'
    });

    // Authentication errors
    this.fallbackStrategies.set('auth_error', {
      shouldRetry: false,
      maxRetries: 0,
      retryDelay: 0,
      fallbackMethod: 'enhanced_estimation'
    });

    // Model not found errors
    this.fallbackStrategies.set('model_error', {
      shouldRetry: false,
      maxRetries: 0,
      retryDelay: 0,
      fallbackMethod: 'provider_default'
    });

    // Quota exceeded errors
    this.fallbackStrategies.set('quota_error', {
      shouldRetry: false,
      maxRetries: 0,
      retryDelay: 0,
      fallbackMethod: 'enhanced_estimation'
    });
  }

  /**
   * Classify error type for appropriate handling
   * @param {Error} error - The error to classify
   * @returns {string} Error classification
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;

    // Rate limiting
    if (statusCode === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }

    // Authentication
    if (statusCode === 401 || statusCode === 403 || message.includes('unauthorized') || message.includes('api key')) {
      return 'auth_error';
    }

    // Model errors
    if (statusCode === 400 || message.includes('model') || message.includes('not found')) {
      return 'model_error';
    }

    // Quota errors
    if (statusCode === 402 || message.includes('quota') || message.includes('billing') || message.includes('insufficient')) {
      return 'quota_error';
    }

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('enotfound') || message.includes('econnreset')) {
      return 'network_error';
    }

    // Default to network error for unknown issues
    return 'network_error';
  }

  /**
   * Handle tokenization error with appropriate fallback strategy
   * @param {Error} error - The error that occurred
   * @param {Object} context - Context information for fallback
   * @param {Function} retryFn - Function to retry the operation
   * @returns {Promise<Object>} Fallback token count or retry result
   */
  async handleError(error, context, retryFn) {
    const errorType = this.classifyError(error);
    const strategy = this.fallbackStrategies.get(errorType);
    
    // Record error metrics
    this.recordErrorMetric(errorType, context.provider, context.model);

    console.warn(`Tokenization error (${errorType}) for ${context.provider}/${context.model}:`, error.message);

    // Try retry if strategy allows
    if (strategy.shouldRetry && context.retryCount < strategy.maxRetries) {
      try {
        console.log(`Retrying tokenization (attempt ${context.retryCount + 1}/${strategy.maxRetries})`);
        
        // Wait before retry
        if (strategy.retryDelay > 0) {
          await this.delay(strategy.retryDelay * Math.pow(2, context.retryCount)); // Exponential backoff
        }

        return await retryFn({ ...context, retryCount: (context.retryCount || 0) + 1 });
      } catch (retryError) {
        console.warn(`Retry failed:`, retryError.message);
        // Continue to fallback strategy
      }
    }

    // Apply fallback strategy
    return await this.applyFallbackStrategy(strategy.fallbackMethod, context, error);
  }

  /**
   * Apply specific fallback strategy
   * @param {string} strategyType - Type of fallback strategy
   * @param {Object} context - Context for estimation
   * @param {Error} originalError - The original error
   * @returns {Promise<Object>} Fallback token count
   */
  async applyFallbackStrategy(strategyType, context, originalError) {
    switch (strategyType) {
      case 'enhanced_estimation':
        return this.enhancedEstimationFallback(context);
      
      case 'provider_default':
        return this.providerDefaultFallback(context);
      
      case 'simple_estimation':
        return this.simpleEstimationFallback(context);
      
      default:
        console.warn(`Unknown fallback strategy: ${strategyType}, using simple estimation`);
        return this.simpleEstimationFallback(context);
    }
  }

  /**
   * Enhanced estimation fallback using provider-specific heuristics
   * @private
   */
  async enhancedEstimationFallback(context) {
    const { content, model, provider, options = {} } = context;
    
    // Use provider-specific estimation
    let estimatedTokens;
    
    switch (provider) {
      case 'openai':
        estimatedTokens = this.estimateOpenAITokens(content, model, options);
        break;
      case 'anthropic':
        estimatedTokens = this.estimateAnthropicTokens(content, model, options);
        break;
      case 'google':
        estimatedTokens = this.estimateGoogleTokens(content, model, options);
        break;
      default:
        estimatedTokens = this.estimateGenericTokens(content, model, options);
    }

    return {
      inputTokens: estimatedTokens.input,
      estimatedOutputTokens: estimatedTokens.output,
      isExact: false,
      method: `enhanced-fallback-${provider}`,
      confidence: 'medium',
      errorRecovery: true
    };
  }

  /**
   * Provider default fallback for unknown models
   * @private
   */
  async providerDefaultFallback(context) {
    const { content, provider, options = {} } = context;
    
    // Use conservative defaults for unknown models
    const charCount = this.calculateCharacterCount(content, options);
    
    const providerDefaults = {
      openai: { charsPerToken: 4, outputRatio: 0.75 },
      anthropic: { charsPerToken: 3.5, outputRatio: 0.75 },
      google: { charsPerToken: 4, outputRatio: 0.7 },
    };

    const defaults = providerDefaults[provider] || { charsPerToken: 4, outputRatio: 0.75 };
    const inputTokens = Math.ceil(charCount / defaults.charsPerToken) + 10; // Add overhead
    
    return {
      inputTokens,
      estimatedOutputTokens: Math.round(inputTokens * defaults.outputRatio),
      isExact: false,
      method: `provider-default-${provider}`,
      confidence: 'low',
      errorRecovery: true
    };
  }

  /**
   * Simple estimation fallback
   * @private
   */
  async simpleEstimationFallback(context) {
    const { content, options = {} } = context;
    
    const charCount = this.calculateCharacterCount(content, options);
    const inputTokens = Math.ceil(charCount / 4) + 20; // Conservative with overhead
    
    return {
      inputTokens,
      estimatedOutputTokens: Math.round(inputTokens * 0.5), // Conservative output estimate
      isExact: false,
      method: 'simple-fallback',
      confidence: 'low',
      errorRecovery: true
    };
  }

  /**
   * Estimate OpenAI tokens using tiktoken patterns
   * @private
   */
  estimateOpenAITokens(content, model, options) {
    const charCount = this.calculateCharacterCount(content, options);
    
    // Different models have different tokenization patterns
    let charsPerToken = 4; // Default
    
    if (model.includes('gpt-4') || model.includes('o4')) {
      charsPerToken = 3.8; // GPT-4 is slightly more efficient
    } else if (model.includes('gpt-3.5')) {
      charsPerToken = 4.2; // GPT-3.5 is less efficient
    }

    const baseTokens = Math.ceil(charCount / charsPerToken);
    const overhead = 10; // Message formatting overhead
    
    return {
      input: baseTokens + overhead,
      output: Math.round(baseTokens * 0.75)
    };
  }

  /**
   * Estimate Anthropic tokens using Claude patterns
   * @private
   */
  estimateAnthropicTokens(content, model, options) {
    const charCount = this.calculateCharacterCount(content, options);
    
    // Claude-specific patterns
    let charsPerToken = 3.5;
    
    if (model.includes('opus') || model.includes('claude-4')) {
      charsPerToken = 3.2; // More sophisticated tokenization
    } else if (model.includes('haiku')) {
      charsPerToken = 3.6; // Simpler tokenization
    }

    const baseTokens = Math.ceil(charCount / charsPerToken);
    const overhead = 8;
    
    return {
      input: baseTokens + overhead,
      output: Math.round(baseTokens * 0.75)
    };
  }

  /**
   * Estimate Google tokens using Gemini patterns
   * @private
   */
  estimateGoogleTokens(content, model, options) {
    const charCount = this.calculateCharacterCount(content, options);
    
    let charsPerToken = 4;
    
    if (model.includes('pro')) {
      charsPerToken = 3.8; // Pro models are more efficient
    } else if (model.includes('flash') || model.includes('lite')) {
      charsPerToken = 4.2; // Flash models are less precise
    }

    const baseTokens = Math.ceil(charCount / charsPerToken);
    const overhead = 12;
    
    return {
      input: baseTokens + overhead,
      output: Math.round(baseTokens * 0.7)
    };
  }

  /**
   * Generic token estimation for unknown providers
   * @private
   */
  estimateGenericTokens(content, model, options) {
    const charCount = this.calculateCharacterCount(content, options);
    const baseTokens = Math.ceil(charCount / 4); // Conservative
    
    return {
      input: baseTokens + 15, // Extra overhead for unknown
      output: Math.round(baseTokens * 0.6) // Conservative output
    };
  }

  /**
   * Calculate total character count including system prompt and history
   * @private
   */
  calculateCharacterCount(content, options) {
    let totalChars = content?.length || 0;
    
    if (options.systemPrompt) {
      totalChars += options.systemPrompt.length;
    }
    
    if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
      for (const msg of options.conversationHistory) {
        if (msg.content) {
          if (typeof msg.content === 'string') {
            totalChars += msg.content.length;
          } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === 'text' && part.text) {
                totalChars += part.text.length;
              }
            }
          }
        }
      }
    }
    
    // Add estimated character count for attachments
    if (options.attachments && options.attachments.length > 0) {
      totalChars += options.attachments.length * 100; // Rough estimate for alt text
    }
    
    return totalChars;
  }

  /**
   * Record error metrics for monitoring
   * @private
   */
  recordErrorMetric(errorType, provider, model) {
    const key = `${provider}:${model}:${errorType}`;
    const current = this.errorMetrics.get(key) || { count: 0, lastSeen: null };
    
    this.errorMetrics.set(key, {
      count: current.count + 1,
      lastSeen: new Date(),
      provider,
      model,
      errorType
    });
  }

  /**
   * Get error metrics for monitoring
   * @returns {Object} Error metrics summary
   */
  getErrorMetrics() {
    const summary = {
      totalErrors: 0,
      errorsByType: {},
      errorsByProvider: {},
      recentErrors: []
    };

    for (const [key, metric] of this.errorMetrics.entries()) {
      summary.totalErrors += metric.count;
      
      summary.errorsByType[metric.errorType] = 
        (summary.errorsByType[metric.errorType] || 0) + metric.count;
      
      summary.errorsByProvider[metric.provider] = 
        (summary.errorsByProvider[metric.provider] || 0) + metric.count;
      
      // Recent errors (last 24 hours)
      const hoursSinceError = (Date.now() - metric.lastSeen.getTime()) / (1000 * 60 * 60);
      if (hoursSinceError < 24) {
        summary.recentErrors.push({
          key,
          count: metric.count,
          lastSeen: metric.lastSeen,
          provider: metric.provider,
          model: metric.model,
          errorType: metric.errorType
        });
      }
    }

    return summary;
  }

  /**
   * Clear old error metrics (keep only last 7 days)
   */
  cleanupOldMetrics() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    for (const [key, metric] of this.errorMetrics.entries()) {
      if (metric.lastSeen < sevenDaysAgo) {
        this.errorMetrics.delete(key);
      }
    }
  }

  /**
   * Delay utility for retry logic
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TokenizationErrorHandler;