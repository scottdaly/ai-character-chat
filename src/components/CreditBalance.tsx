import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiRefreshCw,
} from "react-icons/fi";
import { useCredit } from "../contexts/CreditContext";
import { useAuth } from "../contexts/AuthContext";

interface CreditBalanceProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "inline";
  showRefresh?: boolean;
  showUpgradeButton?: boolean;
  showWarning?: boolean;
  className?: string;
}

export default function CreditBalance({
  size = "md",
  variant = "default",
  showRefresh = false,
  showUpgradeButton = true,
  showWarning = true,
  className = "",
}: CreditBalanceProps) {
  const { subscriptionTier } = useAuth();
  const {
    balance,
    availableBalance,
    totalReserved,
    reservations,
    isLoadingBalance,
    formatCredits,
    getCreditWarningLevel,
    getWarningMessage,
    refreshBalance,
    error,
    clearError,
  } = useCredit();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<"top" | "bottom">(
    "top"
  );

  const warningLevel = getCreditWarningLevel();
  const warningMessage = getWarningMessage();
  
  // Check if we're in debug mode (localStorage or URL param)
  const isDebugMode = typeof window !== 'undefined' && (
    localStorage.getItem('debugMode') === 'true' ||
    new URLSearchParams(window.location.search).get('debug') === 'true'
  );

  // Function to determine tooltip position based on element position
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only show tooltip in debug mode
    if (!isDebugMode) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;

    // If there's less than 100px above the element, show tooltip below
    if (spaceAbove < 100) {
      setTooltipPosition("bottom");
    } else {
      setTooltipPosition("top");
    }

    setShowTooltip(true);
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    clearError();

    try {
      await refreshBalance();
    } catch (err) {
      console.error("Failed to refresh balance:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Size-based styling
  const sizeClasses = {
    sm: {
      container: "text-sm",
      balance: "text-lg font-semibold",
      icon: 16,
      button: "text-xs px-2 py-1",
    },
    md: {
      container: "text-sm",
      balance: "text-xl font-bold",
      icon: 18,
      button: "text-sm px-3 py-1.5",
    },
    lg: {
      container: "text-base",
      balance: "text-2xl font-bold",
      icon: 20,
      button: "text-sm px-4 py-2",
    },
  };

  const styles = sizeClasses[size];

  // Warning level styling
  const getWarningStyles = () => {
    switch (warningLevel) {
      case "empty":
        return {
          container:
            "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
          balance: "text-red-600 dark:text-red-400",
          icon: "text-red-500",
          warning: "text-red-600 dark:text-red-400",
        };
      case "critical":
        return {
          container:
            "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
          balance: "text-orange-600 dark:text-orange-400",
          icon: "text-orange-500",
          warning: "text-orange-600 dark:text-orange-400",
        };
      case "low":
        return {
          container:
            "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
          balance: "text-yellow-600 dark:text-yellow-500",
          icon: "text-yellow-500",
          warning: "text-yellow-600 dark:text-yellow-500",
        };
      default:
        return {
          container:
            "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700",
          balance: "text-zinc-900 dark:text-zinc-100",
          icon: "text-zinc-500 dark:text-zinc-400",
          warning: "text-zinc-600 dark:text-zinc-400",
        };
    }
  };

  const warningStyles = getWarningStyles();

  // Loading skeleton
  if (isLoadingBalance && balance === null) {
    if (variant === "inline") {
      return (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <div className="animate-pulse flex items-center gap-1.5">
            <div className="w-12 h-3 bg-zinc-300 dark:bg-zinc-600 rounded"></div>
            <div className="w-8 h-2 bg-zinc-300 dark:bg-zinc-600 rounded"></div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${warningStyles.container} ${className}`}
      >
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-zinc-300 dark:bg-zinc-600 rounded"></div>
          <div className="w-16 h-5 bg-zinc-300 dark:bg-zinc-600 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && balance === null) {
    if (variant === "inline") {
      return (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <span className="text-red-600 dark:text-red-400 text-sm">Error</span>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-red-500 hover:text-red-600 dark:hover:text-red-400"
              title="Retry"
            >
              <FiRefreshCw
                size={10}
                className={isRefreshing ? "animate-spin" : ""}
              />
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${className}`}
      >
        <FiAlertTriangle className="text-red-500" size={styles.icon} />
        <span className="text-red-600 dark:text-red-400 text-sm">
          Balance unavailable
        </span>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-1 text-red-500 hover:text-red-600 dark:hover:text-red-400"
            title="Retry"
          >
            <FiRefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>
    );
  }

  // Inline variant - minimal styling without container
  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {/* Simple balance display */}
        <span className={`text-sm font-medium ${warningStyles.balance}`}>
          {availableBalance !== null ? formatCredits(availableBalance) : "0"}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {totalReserved > 0 ? "available" : "credits"}
        </span>
        {isLoadingBalance && (
          <FiRefreshCw size={10} className="text-zinc-400 animate-spin" />
        )}
        {warningLevel !== "none" && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main balance display */}
      <div
        className={`inline-flex items-center gap-2 ${styles.container}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Balance display */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className={`${styles.balance} ${warningStyles.balance}`}>
              {availableBalance !== null ? formatCredits(availableBalance) : "0"}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              credits
            </span>
            {isLoadingBalance && (
              <FiRefreshCw
                size={12}
                className="text-zinc-400 animate-spin ml-1"
              />
            )}
            {warningLevel !== "none" && (
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse ml-1"></div>
            )}
          </div>

          {/* Reservation info and subscription tier */}
          {(totalReserved > 0 || size !== "sm") && (
            <div className="flex items-center gap-2">
              {totalReserved > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {formatCredits(totalReserved)} reserved
                </span>
              )}
              {size !== "sm" && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {subscriptionTier === "pro" ? "Pro Plan" : "Free Plan"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Manual refresh button */}
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`ml-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors ${
              isRefreshing ? "cursor-not-allowed" : "cursor-pointer"
            }`}
            title="Refresh balance"
          >
            <FiRefreshCw
              size={styles.icon}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>

      {/* Warning message */}
      {showWarning && warningMessage && (
        <div
          className={`mt-2 flex items-start gap-2 p-2 rounded-md ${warningStyles.container}`}
        >
          <FiAlertTriangle
            className={`${warningStyles.icon} mt-0.5 flex-shrink-0`}
            size={14}
          />
          <div className="flex-1">
            <p className={`text-xs ${warningStyles.warning}`}>
              {warningMessage}
            </p>
            {showUpgradeButton && subscriptionTier === "free" && (
              <Link
                to="/plans"
                className="inline-block mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
              >
                Upgrade now
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Tooltip - Debug mode only */}
      {showTooltip && isDebugMode && (
        <div
          className={`absolute left-1/2 transform -translate-x-1/2 px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg shadow-lg z-50 whitespace-nowrap ${
            tooltipPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="text-center space-y-1">
            <div className="font-medium">
              {balance !== null ? balance.toFixed(4) : "0.0000"} total credits (raw)
            </div>
            {totalReserved > 0 && (
              <div className="text-amber-300 dark:text-amber-600 text-xs">
                - {totalReserved.toFixed(4)} reserved
              </div>
            )}
            <div className="font-medium border-t border-zinc-700 dark:border-zinc-300 pt-1">
              {availableBalance !== null ? availableBalance.toFixed(4) : "0.0000"} available
            </div>
            <div className="text-zinc-300 dark:text-zinc-600">
              ≈ ${availableBalance !== null ? (availableBalance * 0.001).toFixed(6) : "0.000000"} USD
            </div>
            {reservations.length > 0 && (
              <div className="text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-700 dark:border-zinc-300 pt-1">
                {reservations.length} active reservation{reservations.length !== 1 ? 's' : ''}
              </div>
            )}
            <div className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
              [Debug Mode]
            </div>
          </div>
          {/* Tooltip arrow */}
          <div
            className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent ${
              tooltipPosition === "top"
                ? "top-full border-t-4 border-t-zinc-900 dark:border-t-zinc-100"
                : "bottom-full border-b-4 border-b-zinc-900 dark:border-b-zinc-100"
            }`}
          ></div>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start gap-2">
            <FiAlertTriangle
              className="text-red-500 mt-0.5 flex-shrink-0"
              size={14}
            />
            <div className="flex-1">
              <p className="text-xs text-red-600 dark:text-red-400">
                {error.message}
              </p>
              <button
                onClick={clearError}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
