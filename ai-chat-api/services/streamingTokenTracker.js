/**
 * Streaming Token Tracker
 * Tracks token usage in real-time during streaming operations
 * Manages credit reservations and provides accurate settlement
 */

class StreamingTokenTracker {
  constructor(creditService, tokenizerService) {
    this.creditService = creditService;
    this.tokenizerService = tokenizerService;
    this.activeTrackers = new Map(); // reservationId -> tracker data
    this.streamingStats = new Map(); // For monitoring
    this.maxActiveTrackers = 1000; // Safety limit
  }

  /**
   * Start tracking a streaming operation
   * @param {Object} config - Tracking configuration
   * @returns {Promise<Object>} Tracker initialization result
   */
  async startTracking(config) {
    try {
      // Validate configuration
      this.validateTrackingConfig(config);

      // Check active tracker limit
      if (this.activeTrackers.size >= this.maxActiveTrackers) {
        throw new Error('Maximum active trackers exceeded');
      }

      // Estimate initial credit needs using enhanced tokenization
      const creditEstimation = await this.creditService.estimateMessageCredits(
        config.content,
        config.model,
        config.provider,
        {
          systemPrompt: config.systemPrompt,
          conversationHistory: config.conversationHistory,
          attachments: config.attachments
        }
      );

      // Apply buffer multiplier for streaming uncertainty
      const bufferMultiplier = creditEstimation.bufferMultiplier || 1.2;
      // Use creditsToCharge (whole numbers) with buffer
      const reservationAmount = Math.ceil(creditEstimation.creditsToCharge * bufferMultiplier);

      // Create credit reservation
      const reservation = await this.creditService.reserveCredits(
        config.userId,
        reservationAmount,
        {
          conversationId: config.conversationId,
          messageId: config.messageId,
          type: 'streaming',
          model: config.model,
          provider: config.provider,
          estimatedTokens: creditEstimation.inputTokens + creditEstimation.estimatedOutputTokens,
          operationType: config.operationType || 'chat_completion',
          expirationMinutes: config.expirationMinutes || 15,
          metadata: {
            bufferMultiplier,
            tokenCountMethod: creditEstimation.tokenCountMethod,
            confidence: creditEstimation.confidence
          },
          ipAddress: config.ipAddress,
          userAgent: config.userAgent
        }
      );

      // Initialize tracker
      const tracker = {
        reservationId: reservation.reservationId,
        userId: config.userId,
        conversationId: config.conversationId,
        messageId: config.messageId,
        model: config.model,
        provider: config.provider,
        startTime: new Date(),
        status: 'active',
        
        // Token counting
        inputTokens: creditEstimation.inputTokens,
        outputTokens: 0,
        estimatedOutputTokens: creditEstimation.estimatedOutputTokens,
        
        // Credit tracking
        creditsReserved: reservationAmount,
        creditsUsed: 0,
        
        // Streaming data
        chunksReceived: 0,
        totalChars: 0,
        lastUpdateTime: new Date(),
        
        // Estimation data
        estimation: creditEstimation,
        bufferMultiplier,
        
        // Performance tracking
        averageChunkSize: 0,
        streamingRate: 0, // chars per second
        
        // Error tracking
        errors: [],
        retries: 0
      };

      this.activeTrackers.set(reservation.reservationId, tracker);

      // Update streaming stats
      this.updateStreamingStats('started', config.provider);

      return {
        success: true,
        reservationId: reservation.reservationId,
        trackerId: reservation.reservationId,
        creditsReserved: reservationAmount,
        estimatedTokens: {
          input: creditEstimation.inputTokens,
          output: creditEstimation.estimatedOutputTokens
        },
        expiresAt: reservation.expiresAt,
        bufferMultiplier
      };
    } catch (error) {
      console.error('Failed to start streaming tracker:', error);
      throw error;
    }
  }

  /**
   * Update tracker with streaming chunk data
   * @param {string} trackerId - Tracker/reservation ID
   * @param {string} chunk - Text chunk received
   * @param {Object} options - Update options
   * @returns {Object} Update result
   */
  updateWithChunk(trackerId, chunk, options = {}) {
    const tracker = this.activeTrackers.get(trackerId);
    
    if (!tracker) {
      throw new Error(`Tracker not found: ${trackerId}`);
    }

    if (tracker.status !== 'active') {
      throw new Error(`Cannot update inactive tracker: ${tracker.status}`);
    }

    try {
      // Update chunk data
      tracker.chunksReceived++;
      tracker.totalChars += chunk.length;
      tracker.lastUpdateTime = new Date();

      // Calculate streaming rate
      const elapsedSeconds = (tracker.lastUpdateTime - tracker.startTime) / 1000;
      tracker.streamingRate = elapsedSeconds > 0 ? tracker.totalChars / elapsedSeconds : 0;
      tracker.averageChunkSize = tracker.totalChars / tracker.chunksReceived;

      // Estimate output tokens based on current progress
      const estimatedOutputTokens = this.estimateTokensFromChars(
        tracker.totalChars,
        tracker.provider,
        tracker.model
      );

      tracker.outputTokens = estimatedOutputTokens;

      // Calculate current credit usage
      const currentUsage = this.calculateCurrentCreditUsage(tracker);
      tracker.creditsUsed = currentUsage;

      // Check if we're approaching reservation limit
      const usageRatio = currentUsage / tracker.creditsReserved;
      
      if (usageRatio > 0.8) {
        console.warn(`Streaming approaching credit limit: ${usageRatio * 100}% used for tracker ${trackerId}`);
        
        // Optionally extend reservation if needed
        if (usageRatio > 0.9 && options.autoExtend) {
          this.extendReservation(trackerId, currentUsage * 0.5); // Add 50% more
        }
      }

      // Update streaming stats
      this.updateStreamingStats('chunk_received', tracker.provider);

      return {
        success: true,
        trackerId,
        chunksReceived: tracker.chunksReceived,
        outputTokensEstimated: estimatedOutputTokens,
        creditsUsed: currentUsage,
        creditsRemaining: tracker.creditsReserved - currentUsage,
        usageRatio: Math.round(usageRatio * 10000) / 100, // Percentage with 2 decimals
        streamingRate: Math.round(tracker.streamingRate),
        isApproachingLimit: usageRatio > 0.8
      };
    } catch (error) {
      tracker.errors.push({
        timestamp: new Date(),
        error: error.message,
        chunk: chunk?.substring(0, 100) // First 100 chars for debugging
      });
      
      console.error(`Tracker update error for ${trackerId}:`, error);
      
      return {
        success: false,
        error: error.message,
        trackerId
      };
    }
  }

  /**
   * Complete streaming and settle the reservation
   * @param {string} trackerId - Tracker/reservation ID
   * @param {Object} finalData - Final streaming data
   * @returns {Promise<Object>} Settlement result
   */
  async completeStreaming(trackerId, finalData = {}) {
    const tracker = this.activeTrackers.get(trackerId);
    
    if (!tracker) {
      throw new Error(`Tracker not found: ${trackerId}`);
    }

    try {
      tracker.status = 'completing';
      
      // Calculate final token counts
      let finalOutputTokens = tracker.outputTokens;
      
      // Use provided final data if available
      if (finalData.outputTokens) {
        finalOutputTokens = finalData.outputTokens;
      } else if (finalData.totalText) {
        finalOutputTokens = this.estimateTokensFromChars(
          finalData.totalText.length,
          tracker.provider,
          tracker.model
        );
      }

      // Get final pricing and calculate actual credits used
      const pricing = await this.creditService.getModelPricing(tracker.model, tracker.provider);
      const creditCalculation = this.creditService.calculateCreditsFromUsage(
        { inputTokens: tracker.inputTokens, outputTokens: finalOutputTokens },
        pricing
      );
      const actualCreditsUsed = creditCalculation.actualCredits;
      const chargeableCredits = creditCalculation.chargeableCredits;

      // Prepare usage data for settlement
      const usageData = {
        inputTokens: tracker.inputTokens,
        outputTokens: finalOutputTokens,
        totalText: finalData.totalText || '',
        processingTime: new Date() - tracker.startTime,
        chunksReceived: tracker.chunksReceived,
        averageChunkSize: tracker.averageChunkSize,
        streamingRate: tracker.streamingRate,
        errors: tracker.errors,
        retries: tracker.retries
      };

      // Settle the reservation with chargeable credits (whole numbers)
      const settlement = await this.creditService.settleReservation(
        tracker.reservationId,
        chargeableCredits,
        usageData
      );

      // Update tracker status
      tracker.status = 'completed';
      tracker.outputTokens = finalOutputTokens;
      tracker.creditsUsed = actualCreditsUsed;
      tracker.creditsCharged = chargeableCredits;
      tracker.completedAt = new Date();
      tracker.settlement = settlement;

      // Update streaming stats
      this.updateStreamingStats('completed', tracker.provider);
      
      // Clean up tracker after a delay (for debugging purposes)
      setTimeout(() => {
        this.activeTrackers.delete(trackerId);
      }, 30000); // Keep for 30 seconds

      return {
        success: true,
        reservationId: tracker.reservationId,
        trackerId,
        actualTokens: {
          input: tracker.inputTokens,
          output: finalOutputTokens,
          total: tracker.inputTokens + finalOutputTokens
        },
        estimatedTokens: {
          input: tracker.estimation.inputTokens,
          output: tracker.estimation.estimatedOutputTokens,
          total: tracker.estimation.inputTokens + tracker.estimation.estimatedOutputTokens
        },
        credits: {
          reserved: tracker.creditsReserved,
          used: actualCreditsUsed,
          charged: chargeableCredits,
          refunded: settlement.creditsRefunded
        },
        accuracyMetrics: settlement.accuracyMetrics,
        performance: {
          duration: usageData.processingTime,
          chunksReceived: tracker.chunksReceived,
          streamingRate: tracker.streamingRate,
          averageChunkSize: tracker.averageChunkSize
        },
        settlement: settlement
      };
    } catch (error) {
      // Mark tracker as failed and try to cancel reservation
      tracker.status = 'failed';
      tracker.errors.push({
        timestamp: new Date(),
        error: error.message,
        type: 'completion_error'
      });

      try {
        await this.creditService.cancelReservation(
          tracker.reservationId,
          `Streaming completion failed: ${error.message}`
        );
      } catch (cancelError) {
        console.error(`Failed to cancel reservation ${tracker.reservationId}:`, cancelError);
      }

      this.updateStreamingStats('failed', tracker.provider);
      
      throw error;
    }
  }

  /**
   * Cancel an active streaming tracker
   * @param {string} trackerId - Tracker/reservation ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelStreaming(trackerId, reason = 'User cancelled') {
    const tracker = this.activeTrackers.get(trackerId);
    
    if (!tracker) {
      throw new Error(`Tracker not found: ${trackerId}`);
    }

    try {
      tracker.status = 'cancelling';
      
      // Cancel the credit reservation
      const cancellation = await this.creditService.cancelReservation(
        tracker.reservationId,
        reason
      );

      // Update tracker
      tracker.status = 'cancelled';
      tracker.cancelledAt = new Date();
      tracker.cancellationReason = reason;

      this.updateStreamingStats('cancelled', tracker.provider);

      // Clean up tracker
      setTimeout(() => {
        this.activeTrackers.delete(trackerId);
      }, 5000);

      return {
        success: true,
        trackerId,
        reservationId: tracker.reservationId,
        creditsRefunded: cancellation.creditsRefunded,
        reason
      };
    } catch (error) {
      tracker.status = 'failed';
      throw error;
    }
  }

  /**
   * Get tracker status and current metrics
   * @param {string} trackerId - Tracker/reservation ID
   * @returns {Object} Tracker status
   */
  getTrackerStatus(trackerId) {
    const tracker = this.activeTrackers.get(trackerId);
    
    if (!tracker) {
      return { found: false };
    }

    const currentTime = new Date();
    const elapsedMs = currentTime - tracker.startTime;
    const elapsedMinutes = elapsedMs / (1000 * 60);
    
    return {
      found: true,
      trackerId,
      reservationId: tracker.reservationId,
      status: tracker.status,
      elapsedTime: {
        milliseconds: elapsedMs,
        minutes: Math.round(elapsedMinutes * 100) / 100
      },
      tokens: {
        input: tracker.inputTokens,
        output: tracker.outputTokens,
        estimated: tracker.estimatedOutputTokens
      },
      credits: {
        reserved: tracker.creditsReserved,
        used: tracker.creditsUsed,
        remaining: tracker.creditsReserved - tracker.creditsUsed
      },
      streaming: {
        chunksReceived: tracker.chunksReceived,
        totalChars: tracker.totalChars,
        averageChunkSize: tracker.averageChunkSize,
        streamingRate: tracker.streamingRate
      },
      errors: tracker.errors.length,
      lastUpdate: tracker.lastUpdateTime
    };
  }

  /**
   * Get overall streaming statistics
   * @returns {Object} Streaming statistics
   */
  getStreamingStats() {
    const stats = {
      activeTrackers: this.activeTrackers.size,
      totalStarted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0,
      byProvider: {},
      performance: {
        averageDuration: 0,
        averageStreamingRate: 0,
        averageChunkSize: 0
      }
    };

    // Aggregate from streaming stats map
    for (const [key, value] of this.streamingStats.entries()) {
      const [provider, metric] = key.split(':');
      
      if (!stats.byProvider[provider]) {
        stats.byProvider[provider] = {};
      }
      
      stats.byProvider[provider][metric] = value;
      
      if (metric === 'started') stats.totalStarted += value;
      if (metric === 'completed') stats.totalCompleted += value;
      if (metric === 'failed') stats.totalFailed += value;
      if (metric === 'cancelled') stats.totalCancelled += value;
    }

    // Calculate performance metrics from active trackers
    if (this.activeTrackers.size > 0) {
      let totalRate = 0;
      let totalChunkSize = 0;
      let count = 0;

      for (const tracker of this.activeTrackers.values()) {
        if (tracker.streamingRate > 0) {
          totalRate += tracker.streamingRate;
          totalChunkSize += tracker.averageChunkSize;
          count++;
        }
      }

      if (count > 0) {
        stats.performance.averageStreamingRate = Math.round(totalRate / count);
        stats.performance.averageChunkSize = Math.round(totalChunkSize / count);
      }
    }

    return stats;
  }

  /**
   * Clean up expired or stale trackers
   * @param {number} maxAgeMinutes - Maximum age in minutes
   * @returns {Object} Cleanup results
   */
  async cleanupStaleTrackers(maxAgeMinutes = 30) {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const staleTrackers = [];
    
    for (const [trackerId, tracker] of this.activeTrackers.entries()) {
      if (tracker.startTime < cutoffTime || tracker.lastUpdateTime < cutoffTime) {
        staleTrackers.push({ trackerId, tracker });
      }
    }

    const results = {
      found: staleTrackers.length,
      cleaned: 0,
      errors: []
    };

    for (const { trackerId, tracker } of staleTrackers) {
      try {
        if (tracker.status === 'active') {
          await this.cancelStreaming(trackerId, 'Stale tracker cleanup');
        } else {
          this.activeTrackers.delete(trackerId);
        }
        results.cleaned++;
      } catch (error) {
        results.errors.push({
          trackerId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate tracking configuration
   * @private
   */
  validateTrackingConfig(config) {
    const required = ['userId', 'content', 'model', 'provider'];
    
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof config.userId !== 'string') {
      throw new Error('userId must be a string');
    }

    if (typeof config.content !== 'string') {
      throw new Error('content must be a string');
    }
  }

  /**
   * Estimate tokens from character count
   * @private
   */
  estimateTokensFromChars(charCount, provider, model) {
    const charsPerToken = this.getCharsPerToken(provider, model);
    return Math.ceil(charCount / charsPerToken);
  }

  /**
   * Get characters per token for provider/model
   * @private
   */
  getCharsPerToken(provider, model) {
    const defaults = {
      openai: 3.8,
      anthropic: 3.5,
      google: 4.0
    };

    return defaults[provider] || 4.0;
  }

  /**
   * Calculate current credit usage for tracker
   * @private
   */
  async calculateCurrentCreditUsage(tracker) {
    try {
      const pricing = await this.creditService.getModelPricing(tracker.model, tracker.provider);
      const inputCost = (tracker.inputTokens / 1000) * pricing.inputPricePer1k;
      const outputCost = (tracker.outputTokens / 1000) * pricing.outputPricePer1k;
      const totalCost = inputCost + outputCost;
      return totalCost / 0.001; // Convert to credits
    } catch (error) {
      console.warn('Failed to calculate current credit usage:', error);
      // Fallback to rough estimation
      const totalTokens = tracker.inputTokens + tracker.outputTokens;
      return totalTokens / 1000 * 0.002 / 0.001; // Rough average pricing
    }
  }

  /**
   * Update streaming statistics
   * @private
   */
  updateStreamingStats(metric, provider) {
    const key = `${provider}:${metric}`;
    const current = this.streamingStats.get(key) || 0;
    this.streamingStats.set(key, current + 1);
  }

  /**
   * Extend a reservation with additional credits
   * @private
   */
  async extendReservation(trackerId, additionalCredits) {
    // This would need to be implemented as a new method in CreditService
    // For now, just log the need for extension
    console.warn(`Reservation extension needed for tracker ${trackerId}: ${additionalCredits} additional credits`);
  }
}

module.exports = StreamingTokenTracker;