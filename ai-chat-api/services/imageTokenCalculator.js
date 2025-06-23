/**
 * Enhanced Image Token Calculator
 * Provides provider-specific image token calculations for accurate cost estimation
 */

class ImageTokenCalculator {
  constructor() {
    this.supportedProviders = ["openai", "anthropic", "google"];
    
    // Image size defaults for when dimensions are unknown
    this.defaultDimensions = {
      width: 512,
      height: 512
    };
  }

  /**
   * Calculate tokens for an image attachment
   * @param {Object} attachment - Image attachment object
   * @param {string} provider - AI provider name
   * @param {string} model - Model name
   * @returns {number} Token count for the image
   */
  calculateTokens(attachment, provider, model) {
    if (!attachment) {
      return 0;
    }

    if (!this.supportedProviders.includes(provider)) {
      console.warn(`Unsupported provider for image tokens: ${provider}`);
      return this.getDefaultImageTokens();
    }

    try {
      switch (provider) {
        case "openai":
          return this.calculateOpenAIImageTokens(attachment, model);
        case "anthropic":
          return this.calculateAnthropicImageTokens(attachment, model);
        case "google":
          return this.calculateGoogleImageTokens(attachment, model);
        default:
          return this.getDefaultImageTokens();
      }
    } catch (error) {
      console.error(`Error calculating image tokens for ${provider}:`, error);
      return this.getDefaultImageTokens();
    }
  }

  /**
   * Calculate OpenAI image tokens using their official formula
   * Based on: https://platform.openai.com/docs/guides/vision
   * @private
   */
  calculateOpenAIImageTokens(attachment, model) {
    const { width, height } = this.getImageDimensions(attachment);
    
    // Base cost for any image
    let tokens = 85;
    
    // Different models may have different processing
    if (model.includes('gpt-4o') || model.includes('gpt-4.1')) {
      // High-detail processing for GPT-4o and GPT-4.1
      tokens += this.calculateOpenAIHighDetailTokens(width, height);
    } else if (model.includes('gpt-4')) {
      // Standard GPT-4 processing
      tokens += this.calculateOpenAIHighDetailTokens(width, height);
    } else {
      // Lower detail for other models
      tokens += this.calculateOpenAILowDetailTokens(width, height);
    }
    
    return Math.round(tokens);
  }

  /**
   * Calculate high-detail tokens for OpenAI (standard mode)
   * @private
   */
  calculateOpenAIHighDetailTokens(width, height) {
    // OpenAI resizes image to fit within 2048x2048, maintaining aspect ratio
    const maxDimension = 2048;
    const scale = Math.min(maxDimension / width, maxDimension / height, 1);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);
    
    // Then scales the shortest side to 768px
    const minDimension = 768;
    const finalScale = Math.max(minDimension / scaledWidth, minDimension / scaledHeight);
    const finalWidth = Math.round(scaledWidth * finalScale);
    const finalHeight = Math.round(scaledHeight * finalScale);
    
    // Divide into 512x512 tiles
    const tileSize = 512;
    const tilesH = Math.ceil(finalWidth / tileSize);
    const tilesV = Math.ceil(finalHeight / tileSize);
    
    // Each tile costs 170 tokens
    return tilesH * tilesV * 170;
  }

  /**
   * Calculate low-detail tokens for OpenAI
   * @private
   */
  calculateOpenAILowDetailTokens(width, height) {
    // Low detail mode always uses fixed cost regardless of size
    return 65; // Additional tokens on top of base 85
  }

  /**
   * Calculate Anthropic (Claude) image tokens
   * Based on: (width × height) / 750
   * @private
   */
  calculateAnthropicImageTokens(attachment, model) {
    const { width, height } = this.getImageDimensions(attachment);
    
    // Claude's formula: (width × height) / 750
    let tokens = Math.ceil((width * height) / 750);
    
    // Model-specific adjustments
    if (model.includes('claude-opus') || model.includes('claude-4')) {
      // Opus processes images more thoroughly
      tokens = Math.ceil(tokens * 1.1);
    } else if (model.includes('haiku')) {
      // Haiku is more efficient
      tokens = Math.ceil(tokens * 0.9);
    }
    
    return Math.max(tokens, 10); // Minimum 10 tokens per image
  }

  /**
   * Calculate Google AI (Gemini) image tokens
   * @private
   */
  calculateGoogleImageTokens(attachment, model) {
    const { width, height } = this.getImageDimensions(attachment);
    
    // Gemini uses a fixed token count approach with some size considerations
    let baseTokens = 258; // Standard Gemini image token count
    
    // Adjust based on image size
    const pixelCount = width * height;
    
    if (pixelCount > 1024 * 1024) {
      // Large images (>1MP) cost more
      baseTokens = Math.ceil(baseTokens * 1.5);
    } else if (pixelCount < 256 * 256) {
      // Small images cost less
      baseTokens = Math.ceil(baseTokens * 0.8);
    }
    
    // Model-specific adjustments
    if (model.includes('gemini-2.5-pro')) {
      // Pro model processes images more thoroughly
      baseTokens = Math.ceil(baseTokens * 1.2);
    } else if (model.includes('flash') || model.includes('lite')) {
      // Flash models are more efficient
      baseTokens = Math.ceil(baseTokens * 0.9);
    }
    
    return Math.max(baseTokens, 50); // Minimum 50 tokens per image
  }

  /**
   * Extract image dimensions from attachment object
   * @private
   */
  getImageDimensions(attachment) {
    // Try to get dimensions from attachment metadata
    if (attachment.width && attachment.height) {
      return {
        width: parseInt(attachment.width),
        height: parseInt(attachment.height)
      };
    }

    // Try to extract from data URL if it's a base64 image
    if (attachment.data && attachment.data.startsWith('data:image/')) {
      const dimensions = this.extractDimensionsFromDataURL(attachment.data);
      if (dimensions) {
        return dimensions;
      }
    }

    // Try size property (file size) to estimate dimensions
    if (attachment.size) {
      return this.estimateDimensionsFromFileSize(attachment.size, attachment.type);
    }

    // Fallback to default dimensions
    console.warn('Could not determine image dimensions, using defaults');
    return this.defaultDimensions;
  }

  /**
   * Extract dimensions from base64 data URL (basic implementation)
   * @private
   */
  extractDimensionsFromDataURL(dataURL) {
    try {
      // This is a simplified version - in production you might want to use
      // a proper image parsing library or get dimensions from the frontend
      
      // For now, return null to fall back to other methods
      return null;
    } catch (error) {
      console.warn('Failed to extract dimensions from data URL:', error);
      return null;
    }
  }

  /**
   * Estimate dimensions based on file size and type
   * @private
   */
  estimateDimensionsFromFileSize(sizeBytes, mimeType) {
    // Very rough estimation based on typical compression ratios
    let estimatedPixels;
    
    if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) {
      // JPEG: roughly 1 byte per 10-20 pixels depending on quality
      estimatedPixels = sizeBytes * 15;
    } else if (mimeType?.includes('png')) {
      // PNG: roughly 1 byte per 3-8 pixels depending on content
      estimatedPixels = sizeBytes * 5;
    } else if (mimeType?.includes('webp')) {
      // WebP: roughly 1 byte per 12-25 pixels
      estimatedPixels = sizeBytes * 18;
    } else {
      // Default estimation
      estimatedPixels = sizeBytes * 10;
    }
    
    // Assume roughly square aspect ratio for estimation
    const sideLength = Math.sqrt(estimatedPixels);
    
    return {
      width: Math.round(sideLength),
      height: Math.round(sideLength)
    };
  }

  /**
   * Get default token count for unknown cases
   * @private
   */
  getDefaultImageTokens() {
    return 85; // Conservative estimate based on OpenAI's base cost
  }

  /**
   * Calculate tokens for multiple attachments
   * @param {Array} attachments - Array of image attachments
   * @param {string} provider - AI provider name
   * @param {string} model - Model name
   * @returns {number} Total token count for all images
   */
  calculateMultipleImageTokens(attachments, provider, model) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return 0;
    }

    return attachments.reduce((total, attachment) => {
      return total + this.calculateTokens(attachment, provider, model);
    }, 0);
  }

  /**
   * Get image token calculation details for debugging
   * @param {Object} attachment - Image attachment object
   * @param {string} provider - AI provider name
   * @param {string} model - Model name
   * @returns {Object} Detailed calculation breakdown
   */
  getCalculationDetails(attachment, provider, model) {
    const dimensions = this.getImageDimensions(attachment);
    const tokens = this.calculateTokens(attachment, provider, model);
    
    return {
      provider,
      model,
      dimensions,
      tokens,
      calculation: this.getCalculationMethod(provider),
      fileSize: attachment.size,
      mimeType: attachment.type
    };
  }

  /**
   * Get the calculation method description for a provider
   * @private
   */
  getCalculationMethod(provider) {
    switch (provider) {
      case "openai":
        return "OpenAI tiling system: 85 base + (tiles × 170)";
      case "anthropic":
        return "Anthropic formula: (width × height) / 750";
      case "google":
        return "Google fixed: ~258 tokens with size adjustments";
      default:
        return "Default estimation: 85 tokens";
    }
  }
}

module.exports = ImageTokenCalculator;