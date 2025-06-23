import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";

// Types for credit system
interface CreditUsageStats {
  currentBalance: number;
  subscriptionTier: string;
  totalTokens: number;
  totalCostUsd: number;
  totalCreditsUsed: number;
  totalRequests: number;
  recentUsage: CreditUsageItem[];
}

interface CreditUsageItem {
  id: string;
  provider: string;
  model: string;
  tokens: number;
  costUsd: number;
  creditsUsed: number;
  createdAt: string;
}

interface CreditReservation {
  id: string;
  creditsReserved: number;
  type: 'streaming' | 'batch' | 'preprocessing' | 'manual';
  context?: {
    model?: string;
    provider?: string;
    conversationId?: string;
    messageId?: string;
  };
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

interface ReservationUpdate {
  outputTokensEstimated: number;
  creditsUsed: number;
  creditsRemaining: number;
  usageRatio: number;
  isApproachingLimit: boolean;
}

interface ReservationSettlement {
  trackerId: string;
  creditsReserved: number;
  creditsUsed: number;
  creditsRefunded: number;
  actualTokens: { input: number; output: number; total: number };
  estimatedTokens: { input: number; output: number; total: number };
  accuracyMetrics: {
    accuracy: number;
    accuracyCategory: string;
    percentageError: number;
  };
  performance: {
    duration: number;
    chunksReceived: number;
    streamingRate: number;
    averageChunkSize: number;
  };
}

interface CreditError {
  type:
    | "insufficient_credits"
    | "credit_api_error"
    | "credit_estimation_failed";
  message: string;
  currentBalance?: number;
  requiredCredits?: number;
  estimatedCost?: number;
  subscriptionTier?: string;
}

interface CreditBalance {
  balance: number;
  subscriptionTier: string;
  hasCredits: boolean;
}

type CreditWarningLevel = "none" | "low" | "critical" | "empty";

interface CreditContextType {
  // Balance & Usage
  balance: number | null;
  isLoadingBalance: boolean;
  lastUpdated: Date | null;

  // Usage Statistics
  usageStats: CreditUsageStats | null;
  isLoadingUsage: boolean;

  // Reservations
  reservations: CreditReservation[];
  isLoadingReservations: boolean;
  totalReserved: number;
  availableBalance: number | null;

  // Error States
  error: CreditError | null;
  clearError: () => void;

  // Real-time Updates
  updateBalance: (newBalance: number) => void;
  refreshBalance: () => Promise<void>;
  refreshUsageStats: () => Promise<void>;

  // Reservation Operations
  addReservation: (reservation: CreditReservation) => void;
  updateReservation: (reservationId: string, update: ReservationUpdate) => void;
  removeReservation: (reservationId: string) => void;
  settleReservation: (settlement: ReservationSettlement) => void;

  // Credit Operations
  checkSufficientCredits: (estimatedCost: number) => Promise<boolean>;
  recordCreditUsage: (creditsUsed: number) => void;

  // Utilities
  hasEnoughCredits: (estimatedCost: number) => boolean;
  formatCredits: (credits: number) => string;
  getCreditWarningLevel: () => CreditWarningLevel;
  getWarningMessage: () => string | null;

  // Cache Management
  clearCache: () => void;
}

const CreditContext = createContext<CreditContextType>({
  balance: null,
  isLoadingBalance: true,
  lastUpdated: null,
  usageStats: null,
  isLoadingUsage: false,
  reservations: [],
  isLoadingReservations: false,
  totalReserved: 0,
  availableBalance: null,
  error: null,
  clearError: () => {},
  updateBalance: () => {},
  refreshBalance: async () => {},
  refreshUsageStats: async () => {},
  addReservation: () => {},
  updateReservation: () => {},
  removeReservation: () => {},
  settleReservation: () => {},
  checkSufficientCredits: async () => false,
  recordCreditUsage: () => {},
  hasEnoughCredits: () => false,
  formatCredits: () => "0",
  getCreditWarningLevel: () => "none",
  getWarningMessage: () => null,
  clearCache: () => {},
});

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { user, apiFetch, subscriptionTier } = useAuth();

  // Core state
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Usage statistics
  const [usageStats, setUsageStats] = useState<CreditUsageStats | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Reservations
  const [reservations, setReservations] = useState<CreditReservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);

  // Error handling
  const [error, setError] = useState<CreditError | null>(null);

  // Cache management
  const lastUserIdRef = useRef<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cache keys
  const CACHE_KEYS = {
    balance: `credit_balance_${user?.id}`,
    lastUpdated: `credit_last_updated_${user?.id}`,
    usageStats: `credit_usage_stats_${user?.id}`,
    reservations: `credit_reservations_${user?.id}`,
  };

  // Calculate derived values
  const totalReserved = useMemo(() => {
    return reservations.reduce((total, reservation) => {
      return total + (reservation.isExpired ? 0 : reservation.creditsReserved);
    }, 0);
  }, [reservations]);

  const availableBalance = useMemo(() => {
    if (balance === null) return null;
    return Math.max(0, balance - totalReserved);
  }, [balance, totalReserved]);

  // Load cached data on mount
  useEffect(() => {
    if (user?.id) {
      const cachedBalance = localStorage.getItem(CACHE_KEYS.balance);
      const cachedLastUpdated = localStorage.getItem(CACHE_KEYS.lastUpdated);
      const cachedUsageStats = localStorage.getItem(CACHE_KEYS.usageStats);

      if (cachedBalance && cachedLastUpdated) {
        const lastUpdateTime = new Date(cachedLastUpdated);
        const now = new Date();
        const timeDiff = now.getTime() - lastUpdateTime.getTime();

        // Use cached data if less than 5 minutes old
        if (timeDiff < 5 * 60 * 1000) {
          setBalance(parseFloat(cachedBalance));
          setLastUpdated(lastUpdateTime);
          setIsLoadingBalance(false);
        }
      }

      if (cachedUsageStats) {
        try {
          setUsageStats(JSON.parse(cachedUsageStats));
        } catch (e) {
          console.warn("Failed to parse cached usage stats:", e);
        }
      }

      const cachedReservations = localStorage.getItem(CACHE_KEYS.reservations);
      if (cachedReservations) {
        try {
          const parsedReservations = JSON.parse(cachedReservations);
          // Filter out expired reservations
          const activeReservations = parsedReservations.filter((r: CreditReservation) => {
            return new Date(r.expiresAt) > new Date();
          });
          setReservations(activeReservations);
        } catch (e) {
          console.warn("Failed to parse cached reservations:", e);
        }
      }
    }
  }, [user?.id]);

  // Fetch credit balance from API
  const refreshBalance = useCallback(async () => {
    if (!user?.id) {
      setBalance(null);
      setIsLoadingBalance(false);
      return;
    }

    // Skip if already fetched for this user recently
    if (lastUserIdRef.current === user.id && balance !== null) {
      const timeSinceUpdate = lastUpdated
        ? Date.now() - lastUpdated.getTime()
        : Infinity;
      if (timeSinceUpdate < 60 * 1000) {
        // 1 minute
        return;
      }
    }

    try {
      setIsLoadingBalance(true);
      setError(null);

      const data: CreditBalance = await apiFetch("/api/credit/balance");

      setBalance(data.balance);
      const now = new Date();
      setLastUpdated(now);
      lastUserIdRef.current = user.id;

      // Cache the data
      localStorage.setItem(CACHE_KEYS.balance, data.balance.toString());
      localStorage.setItem(CACHE_KEYS.lastUpdated, now.toISOString());
    } catch (err) {
      console.error("Failed to fetch credit balance:", err);
      setError({
        type: "credit_api_error",
        message:
          err instanceof Error ? err.message : "Failed to fetch credit balance",
      });

      // Don't clear existing balance on error - keep showing cached data
      if (balance === null) {
        setBalance(0); // Fallback to 0 if no cached data
      }
    } finally {
      setIsLoadingBalance(false);
    }
  }, [user?.id, balance, lastUpdated, apiFetch]);

  // Fetch usage statistics
  const refreshUsageStats = useCallback(async () => {
    if (!user?.id) {
      setUsageStats(null);
      return;
    }

    try {
      setIsLoadingUsage(true);
      setError(null);

      const data: CreditUsageStats = await apiFetch(
        "/api/credit/usage?limit=20"
      );

      setUsageStats(data);

      // Cache usage stats (shorter cache time)
      localStorage.setItem(CACHE_KEYS.usageStats, JSON.stringify(data));
    } catch (err) {
      console.error("Failed to fetch usage stats:", err);
      setError({
        type: "credit_api_error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to fetch usage statistics",
      });
    } finally {
      setIsLoadingUsage(false);
    }
  }, [user?.id, apiFetch]);

  // Auto-refresh balance when user changes
  useEffect(() => {
    if (user?.id && user.id !== lastUserIdRef.current) {
      refreshBalance();
    } else if (!user?.id) {
      setBalance(null);
      setUsageStats(null);
      setReservations([]);
      setIsLoadingBalance(false);
      setError(null);
      lastUserIdRef.current = null;
    }
  }, [user?.id, refreshBalance]);

  // Set up periodic refresh
  useEffect(() => {
    if (user?.id) {
      // Refresh every 5 minutes
      refreshTimeoutRef.current = setInterval(() => {
        refreshBalance();
      }, 5 * 60 * 1000);

      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [user?.id, refreshBalance]);

  // Reservation management
  const addReservation = useCallback((reservation: CreditReservation) => {
    setReservations(prev => {
      const updated = [...prev, reservation];
      if (user?.id) {
        localStorage.setItem(CACHE_KEYS.reservations, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

  const updateReservation = useCallback((reservationId: string, update: ReservationUpdate) => {
    setReservations(prev => {
      const updated = prev.map(r => {
        if (r.id === reservationId) {
          return {
            ...r,
            // Update with streaming progress - this doesn't change the reservation itself
            // but could be used for UI display of current usage
          };
        }
        return r;
      });
      if (user?.id) {
        localStorage.setItem(CACHE_KEYS.reservations, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

  const removeReservation = useCallback((reservationId: string) => {
    setReservations(prev => {
      const updated = prev.filter(r => r.id !== reservationId);
      if (user?.id) {
        localStorage.setItem(CACHE_KEYS.reservations, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

  const settleReservation = useCallback((settlement: ReservationSettlement) => {
    // Remove the settled reservation and update balance
    removeReservation(settlement.trackerId);
    
    // Update balance with refunded credits
    if (settlement.creditsRefunded > 0 && balance !== null) {
      const newBalance = balance + settlement.creditsRefunded;
      updateBalance(newBalance);
    }
  }, [removeReservation, balance]);

  // Manual balance update (for real-time updates)
  const updateBalance = useCallback(
    (newBalance: number) => {
      setBalance(newBalance);
      const now = new Date();
      setLastUpdated(now);

      // Update cache
      if (user?.id) {
        localStorage.setItem(CACHE_KEYS.balance, newBalance.toString());
        localStorage.setItem(CACHE_KEYS.lastUpdated, now.toISOString());
      }
    },
    [user?.id]
  );

  // Record credit usage (for real-time deduction)
  const recordCreditUsage = useCallback(
    (creditsUsed: number) => {
      if (balance !== null && creditsUsed > 0) {
        const newBalance = Math.max(0, balance - creditsUsed);
        updateBalance(newBalance);
      }
    },
    [balance, updateBalance]
  );

  // Check if user has sufficient credits (considering reservations)
  const checkSufficientCredits = useCallback(
    async (estimatedCost: number): Promise<boolean> => {
      // Refresh balance if stale
      if (!lastUpdated || Date.now() - lastUpdated.getTime() > 2 * 60 * 1000) {
        await refreshBalance();
      }

      return availableBalance !== null && availableBalance >= estimatedCost;
    },
    [availableBalance, lastUpdated, refreshBalance]
  );

  // Utility functions
  const hasEnoughCredits = useCallback(
    (estimatedCost: number): boolean => {
      return availableBalance !== null && availableBalance >= estimatedCost;
    },
    [availableBalance]
  );

  const formatCredits = useCallback((credits: number): string => {
    // Always show the exact number with commas for readability
    return Math.floor(credits).toLocaleString();
  }, []);

  const getCreditWarningLevel = useCallback((): CreditWarningLevel => {
    if (availableBalance === null || availableBalance === undefined) return "none";

    if (availableBalance <= 0) return "empty";
    if (availableBalance < 10) return "critical";
    if (availableBalance < 100) return "low";
    return "none";
  }, [availableBalance]);

  const getWarningMessage = useCallback((): string | null => {
    const warningLevel = getCreditWarningLevel();

    switch (warningLevel) {
      case "empty":
        return "You have no credits remaining. Upgrade to continue chatting.";
      case "critical":
        return "You have very few credits left. Consider upgrading soon.";
      case "low":
        return "Your credit balance is getting low. You may want to upgrade.";
      default:
        return null;
    }
  }, [getCreditWarningLevel]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCache = useCallback(() => {
    if (user?.id) {
      localStorage.removeItem(CACHE_KEYS.balance);
      localStorage.removeItem(CACHE_KEYS.lastUpdated);
      localStorage.removeItem(CACHE_KEYS.usageStats);
      localStorage.removeItem(CACHE_KEYS.reservations);
    }
    setReservations([]);
  }, [user?.id]);

  // Memoize context value
  const contextValue = useMemo(
    () => ({
      balance,
      isLoadingBalance,
      lastUpdated,
      usageStats,
      isLoadingUsage,
      reservations,
      isLoadingReservations,
      totalReserved,
      availableBalance,
      error,
      clearError,
      updateBalance,
      refreshBalance,
      refreshUsageStats,
      addReservation,
      updateReservation,
      removeReservation,
      settleReservation,
      checkSufficientCredits,
      recordCreditUsage,
      hasEnoughCredits,
      formatCredits,
      getCreditWarningLevel,
      getWarningMessage,
      clearCache,
    }),
    [
      balance,
      isLoadingBalance,
      lastUpdated,
      usageStats,
      isLoadingUsage,
      reservations,
      isLoadingReservations,
      totalReserved,
      availableBalance,
      error,
      clearError,
      updateBalance,
      refreshBalance,
      refreshUsageStats,
      addReservation,
      updateReservation,
      removeReservation,
      settleReservation,
      checkSufficientCredits,
      recordCreditUsage,
      hasEnoughCredits,
      formatCredits,
      getCreditWarningLevel,
      getWarningMessage,
      clearCache,
    ]
  );

  return (
    <CreditContext.Provider value={contextValue}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredit() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCredit must be used within a CreditProvider");
  }
  return context;
}

// Export types for use in other components
export type {
  CreditUsageStats,
  CreditUsageItem,
  CreditError,
  CreditBalance,
  CreditWarningLevel,
  CreditReservation,
  ReservationUpdate,
  ReservationSettlement,
};
