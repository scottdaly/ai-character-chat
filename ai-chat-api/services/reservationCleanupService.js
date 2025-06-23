/**
 * Reservation Cleanup Service
 * Handles periodic cleanup of expired reservations and stale tracking data
 */

class ReservationCleanupService {
  constructor(creditService, streamingTokenTracker) {
    this.creditService = creditService;
    this.streamingTokenTracker = streamingTokenTracker;
    this.isRunning = false;
    this.cleanupInterval = null;
    this.stats = {
      totalCleanupRuns: 0,
      totalReservationsProcessed: 0,
      totalCreditsRefunded: 0,
      totalTrackersCleanedUp: 0,
      lastRunTime: null,
      lastRunDuration: 0,
      errors: []
    };
  }

  /**
   * Start the periodic cleanup job
   * @param {number} intervalMinutes - Cleanup interval in minutes (default: 5)
   */
  start(intervalMinutes = 5) {
    if (this.isRunning) {
      console.warn('Reservation cleanup service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`Starting reservation cleanup service with ${intervalMinutes}-minute intervals`);

    // Run initial cleanup
    this.runCleanup().catch(error => {
      console.error('Initial cleanup failed:', error);
    });

    // Set up periodic cleanup
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
        this.recordError('scheduled_cleanup_failed', error);
      }
    }, intervalMs);
  }

  /**
   * Stop the periodic cleanup job
   */
  stop() {
    if (!this.isRunning) {
      console.warn('Reservation cleanup service is not running');
      return;
    }

    this.isRunning = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('Reservation cleanup service stopped');
  }

  /**
   * Run a complete cleanup cycle
   * @returns {Promise<Object>} Cleanup results
   */
  async runCleanup() {
    const startTime = Date.now();
    this.stats.totalCleanupRuns++;

    console.log(`🧹 Starting reservation cleanup cycle #${this.stats.totalCleanupRuns}`);

    const results = {
      expiredReservations: { processed: 0, refunded: 0, errors: [] },
      staleTrackers: { found: 0, cleaned: 0, errors: [] },
      performance: { duration: 0, startTime: new Date() }
    };

    try {
      // 1. Clean up expired reservations
      console.log('  → Cleaning up expired reservations...');
      const reservationResults = await this.cleanupExpiredReservations();
      results.expiredReservations = reservationResults;
      
      this.stats.totalReservationsProcessed += reservationResults.processed;
      this.stats.totalCreditsRefunded += reservationResults.totalRefunded;

      // 2. Clean up stale tracking data
      console.log('  → Cleaning up stale trackers...');
      const trackerResults = await this.cleanupStaleTrackers();
      results.staleTrackers = trackerResults;
      
      this.stats.totalTrackersCleanedUp += trackerResults.cleaned;

      // 3. Clean up old error metrics
      console.log('  → Cleaning up old metrics...');
      if (this.streamingTokenTracker && typeof this.streamingTokenTracker.cleanupStaleTrackers === 'function') {
        await this.streamingTokenTracker.cleanupStaleTrackers(30); // 30 minutes
      }

      const duration = Date.now() - startTime;
      results.performance.duration = duration;
      this.stats.lastRunTime = new Date();
      this.stats.lastRunDuration = duration;

      console.log(`✅ Cleanup cycle completed in ${duration}ms`);
      console.log(`  → Expired reservations: ${results.expiredReservations.processed} processed, ${results.expiredReservations.refunded.toFixed(4)} credits refunded`);
      console.log(`  → Stale trackers: ${results.staleTrackers.cleaned} cleaned up`);

      return results;

    } catch (error) {
      const duration = Date.now() - startTime;
      results.performance.duration = duration;
      
      console.error('❌ Cleanup cycle failed:', error);
      this.recordError('cleanup_cycle_failed', error);
      
      throw error;
    }
  }

  /**
   * Clean up expired credit reservations
   * @param {number} batchSize - Number of reservations to process per batch
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredReservations(batchSize = 100) {
    try {
      const results = await this.creditService.cleanupExpiredReservations(batchSize);
      
      if (results.errors.length > 0) {
        console.warn(`⚠️ ${results.errors.length} errors during reservation cleanup:`, results.errors);
        results.errors.forEach(error => {
          this.recordError('reservation_cleanup_error', new Error(error));
        });
      }

      return {
        processed: results.processed,
        refunded: results.totalRefunded,
        errors: results.errors
      };

    } catch (error) {
      console.error('Failed to cleanup expired reservations:', error);
      this.recordError('reservation_cleanup_failed', error);
      
      return {
        processed: 0,
        refunded: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Clean up stale tracker data
   * @param {number} maxAgeMinutes - Maximum age for trackers in minutes
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupStaleTrackers(maxAgeMinutes = 30) {
    if (!this.streamingTokenTracker || typeof this.streamingTokenTracker.cleanupStaleTrackers !== 'function') {
      console.warn('StreamingTokenTracker not available or missing cleanup method');
      return { found: 0, cleaned: 0, errors: [] };
    }

    try {
      const results = await this.streamingTokenTracker.cleanupStaleTrackers(maxAgeMinutes);
      
      if (results.errors.length > 0) {
        console.warn(`⚠️ ${results.errors.length} errors during tracker cleanup:`, results.errors);
        results.errors.forEach(error => {
          this.recordError('tracker_cleanup_error', new Error(error.error));
        });
      }

      return results;

    } catch (error) {
      console.error('Failed to cleanup stale trackers:', error);
      this.recordError('tracker_cleanup_failed', error);
      
      return {
        found: 0,
        cleaned: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Get cleanup service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      uptime: this.stats.lastRunTime ? Date.now() - this.stats.lastRunTime.getTime() : null
    };
  }

  /**
   * Get health status of the cleanup service
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const stats = this.getStats();
    const now = new Date();
    
    // Check if cleanup is running and recent
    const isHealthy = this.isRunning && 
                     stats.lastRunTime && 
                     (now - stats.lastRunTime) < (10 * 60 * 1000); // Within last 10 minutes

    const recentErrors = this.stats.errors.filter(error => 
      (now - error.timestamp) < (60 * 60 * 1000) // Last hour
    );

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      isRunning: this.isRunning,
      lastRun: stats.lastRunTime,
      totalRuns: stats.totalCleanupRuns,
      averageRunDuration: stats.totalCleanupRuns > 0 ? 
        (stats.totalReservationsProcessed / stats.totalCleanupRuns) : 0,
      recentErrors: recentErrors.length,
      totalCreditsRefunded: stats.totalCreditsRefunded,
      details: {
        reservationsProcessed: stats.totalReservationsProcessed,
        trackersCleanedUp: stats.totalTrackersCleanedUp,
        lastRunDuration: stats.lastRunDuration
      }
    };
  }

  /**
   * Force run cleanup immediately (for testing/admin use)
   * @returns {Promise<Object>} Cleanup results
   */
  async forceCleanup() {
    console.log('🔧 Force cleanup requested');
    return await this.runCleanup();
  }

  /**
   * Record an error for monitoring
   * @private
   */
  recordError(type, error) {
    this.stats.errors.push({
      type,
      message: error.message,
      timestamp: new Date(),
      stack: error.stack
    });

    // Keep only last 50 errors to prevent memory leak
    if (this.stats.errors.length > 50) {
      this.stats.errors = this.stats.errors.slice(-50);
    }
  }

  /**
   * Clean up old error records
   * @param {number} maxAgeHours - Maximum age for error records
   */
  cleanupOldErrors(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    this.stats.errors = this.stats.errors.filter(error => error.timestamp > cutoffTime);
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats() {
    this.stats = {
      totalCleanupRuns: 0,
      totalReservationsProcessed: 0,
      totalCreditsRefunded: 0,
      totalTrackersCleanedUp: 0,
      lastRunTime: null,
      lastRunDuration: 0,
      errors: []
    };
  }
}

module.exports = ReservationCleanupService;