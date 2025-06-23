class TokenExtractorService {
  constructor() {
    this.supportedProviders = ["openai", "anthropic", "google"];
  }

  /**
   * Extract token usage from AI provider response
   * @param {Object} response - AI provider response
   * @param {string} provider - Provider name
   * @param {string} modelName - Model name
   * @returns {Object} Token usage data
   */
  extractTokenUsage(response, provider, modelName) {
    if (!response) {
      throw new Error("Response is required");
    }

    if (!this.supportedProviders.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    try {
      switch (provider) {
        case "openai":
          return this.extractOpenAIUsage(response, modelName);
        case "anthropic":
          return this.extractAnthropicUsage(response, modelName);
        case "google":
          return this.extractGoogleUsage(response, modelName);
        default:
          throw new Error(`No extractor implemented for provider: ${provider}`);
      }
    } catch (error) {
      // Log the error but don't throw - we'll use estimated usage instead
      console.error(`Failed to extract token usage for ${provider}:`, error);
      return this.estimateTokenUsage(response, provider, modelName);
    }
  }

  /**
   * Extract OpenAI token usage
   * @private
   */
  extractOpenAIUsage(response, modelName) {
    // For streaming responses, usage might be in different places
    let usage = null;

    // Try different locations where usage might be
    if (response.usage) {
      usage = response.usage;
    } else if (response.choices?.[0]?.usage) {
      usage = response.choices[0].usage;
    } else if (response.x_groq?.usage) {
      // Handle Groq responses (if using OpenAI-compatible API)
      usage = response.x_groq.usage;
    }

    if (!usage) {
      throw new Error("No usage data found in OpenAI response");
    }

    // Validate usage data
    if (
      typeof usage.prompt_tokens !== "number" ||
      typeof usage.completion_tokens !== "number"
    ) {
      throw new Error("Invalid usage data structure from OpenAI");
    }

    return {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens:
        usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
    };
  }

  /**
   * Extract Anthropic token usage
   * @private
   */
  extractAnthropicUsage(response, modelName) {
    let usage = null;

    // Check direct usage property
    if (response.usage) {
      usage = response.usage;
    } else if (response.message?.usage) {
      usage = response.message.usage;
    } else if (response.content?.[0]?.usage) {
      usage = response.content[0].usage;
    }

    if (!usage) {
      throw new Error("No usage data found in Anthropic response");
    }

    // Validate Anthropic usage structure
    if (
      typeof usage.input_tokens !== "number" ||
      typeof usage.output_tokens !== "number"
    ) {
      throw new Error("Invalid usage data structure from Anthropic");
    }

    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }

  /**
   * Extract Google AI token usage
   * @private
   */
  extractGoogleUsage(response, modelName) {
    let usage = null;

    // Check various locations where usage might be
    if (response.usageMetadata) {
      usage = response.usageMetadata;
    } else if (response.response?.usageMetadata) {
      usage = response.response.usageMetadata;
    } else if (response.candidates?.[0]?.usageMetadata) {
      usage = response.candidates[0].usageMetadata;
    }

    if (!usage) {
      throw new Error("No usage data found in Google AI response");
    }

    // Validate Google usage structure
    if (
      typeof usage.promptTokenCount !== "number" ||
      typeof usage.candidatesTokenCount !== "number"
    ) {
      throw new Error("Invalid usage data structure from Google AI");
    }

    return {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens:
        usage.totalTokenCount ||
        usage.promptTokenCount + usage.candidatesTokenCount,
    };
  }

  /**
   * Estimate token usage when extraction fails
   * @private
   */
  estimateTokenUsage(response, provider, modelName) {
    console.warn(
      `Estimating token usage for ${provider}/${modelName} due to extraction failure`
    );

    // Try to extract content to estimate tokens
    let content = "";

    try {
      switch (provider) {
        case "openai":
          content = response.choices?.[0]?.message?.content || "";
          break;
        case "anthropic":
          content =
            response.content?.[0]?.text || response.message?.content || "";
          break;
        case "google":
          content =
            response.candidates?.[0]?.content?.parts?.[0]?.text ||
            response.response?.text?.() ||
            "";
          break;
      }
    } catch (error) {
      console.error("Failed to extract content for estimation:", error);
    }

    // Rough estimation: ~4 characters per token (very approximate)
    const estimatedOutputTokens = Math.ceil(content.length / 4);
    const estimatedInputTokens = Math.ceil(estimatedOutputTokens * 0.5); // Assume input is roughly half of output

    return {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: estimatedInputTokens + estimatedOutputTokens,
      isEstimated: true, // Flag to indicate this is an estimate
    };
  }

  /**
   * Extract token usage from streaming response chunks
   * @param {Array} chunks - Array of streaming chunks
   * @param {string} provider - Provider name
   * @param {string} modelName - Model name
   * @returns {Object} Token usage data
   */
  extractStreamingUsage(chunks, provider, modelName) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error("Invalid chunks array");
    }

    try {
      switch (provider) {
        case "openai":
          return this.extractOpenAIStreamingUsage(chunks, modelName);
        case "anthropic":
          return this.extractAnthropicStreamingUsage(chunks, modelName);
        case "google":
          return this.extractGoogleStreamingUsage(chunks, modelName);
        default:
          throw new Error(
            `Streaming extraction not implemented for provider: ${provider}`
          );
      }
    } catch (error) {
      console.error(
        `Failed to extract streaming usage for ${provider}:`,
        error
      );

      // Estimate based on streamed content
      const content = this.reconstructContentFromChunks(chunks, provider);
      return this.estimateTokenUsageFromContent(content, provider, modelName);
    }
  }

  /**
   * Extract OpenAI streaming usage
   * @private
   */
  extractOpenAIStreamingUsage(chunks, modelName) {
    // Look for usage data in the final chunk
    const lastChunk = chunks[chunks.length - 1];

    if (lastChunk?.usage) {
      return this.extractOpenAIUsage(lastChunk, modelName);
    }

    // Look through all chunks for usage data
    for (let i = chunks.length - 1; i >= 0; i--) {
      if (chunks[i]?.usage) {
        return this.extractOpenAIUsage(chunks[i], modelName);
      }
    }

    throw new Error("No usage data found in OpenAI streaming chunks");
  }

  /**
   * Extract Anthropic streaming usage
   * @private
   */
  extractAnthropicStreamingUsage(chunks, modelName) {
    // Look for usage data in message_stop event
    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i];
      if (chunk?.type === "message_stop" && chunk?.usage) {
        return this.extractAnthropicUsage(chunk, modelName);
      }
    }

    throw new Error("No usage data found in Anthropic streaming chunks");
  }

  /**
   * Extract Google AI streaming usage
   * @private
   */
  extractGoogleStreamingUsage(chunks, modelName) {
    // Look for usage data in the final chunk
    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i];
      if (chunk?.usageMetadata) {
        return this.extractGoogleUsage(chunk, modelName);
      }
    }

    throw new Error("No usage data found in Google AI streaming chunks");
  }

  /**
   * Reconstruct content from streaming chunks
   * @private
   */
  reconstructContentFromChunks(chunks, provider) {
    let content = "";

    try {
      switch (provider) {
        case "openai":
          content = chunks
            .map((chunk) => chunk.choices?.[0]?.delta?.content || "")
            .join("");
          break;
        case "anthropic":
          content = chunks
            .filter((chunk) => chunk.type === "content_block_delta")
            .map((chunk) => chunk.delta?.text || "")
            .join("");
          break;
        case "google":
          content = chunks
            .map(
              (chunk) => chunk.candidates?.[0]?.content?.parts?.[0]?.text || ""
            )
            .join("");
          break;
      }
    } catch (error) {
      console.error("Failed to reconstruct content from chunks:", error);
    }

    return content;
  }

  /**
   * Estimate token usage from content
   * @private
   */
  estimateTokenUsageFromContent(content, provider, modelName) {
    // More sophisticated estimation could be added here
    const estimatedOutputTokens = Math.ceil(content.length / 4);
    const estimatedInputTokens = Math.ceil(estimatedOutputTokens * 0.7); // Assume some context

    return {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: estimatedInputTokens + estimatedOutputTokens,
      isEstimated: true,
      estimationMethod: "content_length",
    };
  }

  /**
   * Validate extracted token usage data
   * @param {Object} usage - Token usage data
   * @returns {Object} Validated usage data
   */
  validateUsage(usage) {
    if (!usage || typeof usage !== "object") {
      throw new Error("Invalid usage data");
    }

    const { inputTokens, outputTokens, totalTokens } = usage;

    // Validate token counts are numbers and non-negative
    if (
      typeof inputTokens !== "number" ||
      typeof outputTokens !== "number" ||
      inputTokens < 0 ||
      outputTokens < 0
    ) {
      throw new Error("Invalid token counts");
    }

    // Validate total tokens if provided
    if (totalTokens !== undefined) {
      if (typeof totalTokens !== "number" || totalTokens < 0) {
        throw new Error("Invalid total token count");
      }

      // Check if total matches input + output (with small tolerance for rounding)
      const expectedTotal = inputTokens + outputTokens;
      if (Math.abs(totalTokens - expectedTotal) > 1) {
        console.warn(
          `Token count mismatch: total=${totalTokens}, expected=${expectedTotal}`
        );
      }
    }

    // Apply safety limits
    const MAX_TOKENS = 1000000; // 1M token safety limit
    if (inputTokens > MAX_TOKENS || outputTokens > MAX_TOKENS) {
      throw new Error("Token count exceeds safety limit");
    }

    return {
      inputTokens: Math.round(inputTokens),
      outputTokens: Math.round(outputTokens),
      totalTokens: Math.round(totalTokens || inputTokens + outputTokens),
      isEstimated: usage.isEstimated || false,
      estimationMethod: usage.estimationMethod,
    };
  }
}

module.exports = TokenExtractorService;
