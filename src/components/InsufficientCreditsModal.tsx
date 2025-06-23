import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCreditCard,
  FiTrendingUp,
  FiX,
  FiInfo,
} from "react-icons/fi";
import { useCredit } from "../contexts/CreditContext";
import { useAuth } from "../contexts/AuthContext";
import UniversalModal from "./UniversalModal";

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsNeeded?: number;
  currentBalance?: number;
  estimatedCost?: number;
  subscriptionTier?: string;
  errorMessage?: string;
  context?: {
    action: string; // e.g., "send message", "create character"
    model?: string;
    characterName?: string;
  };
}

export default function InsufficientCreditsModal({
  isOpen,
  onClose,
  creditsNeeded = 0,
  currentBalance = 0,
  estimatedCost = 0,
  subscriptionTier = "free",
  errorMessage,
  context,
}: InsufficientCreditsModalProps) {
  const { formatCredits, refreshBalance } = useCredit();
  const { apiFetch } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Calculate shortage
  const shortage = creditsNeeded - currentBalance;
  const shortageUsd = shortage * 0.001;

  // Get appropriate upgrade plan
  const getUpgradePlan = () => {
    if (subscriptionTier === "free") {
      return {
        name: "Pro",
        credits: "20,000",
        price: "$10",
        period: "month",
        priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
      };
    }
    return null;
  };

  const upgradePlan = getUpgradePlan();

  // Handle upgrade
  const handleUpgrade = async () => {
    if (!upgradePlan?.priceId) return;

    try {
      setIsUpgrading(true);

      const { url } = await apiFetch("/api/create-subscription", {
        method: "POST",
        body: JSON.stringify({ priceId: upgradePlan.priceId }),
      });

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error("Failed to start upgrade process:", err);
      setIsUpgrading(false);
    }
  };

  // Format action context
  const getActionDescription = () => {
    if (!context) return "complete this action";

    const { action, model, characterName } = context;
    let description = action;

    if (characterName) {
      description += ` with ${characterName}`;
    }

    if (model) {
      description += ` (${model})`;
    }

    return description;
  };

  const actionDescription = getActionDescription();

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Insufficient Credits"
      icon="alert"
      size="md"
      hideCloseButton={false}
    >
      <div className="space-y-6">
        {/* Error Message */}
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <FiAlertTriangle
            className="text-red-500 mt-0.5 flex-shrink-0"
            size={20}
          />
          <div className="flex-1">
            <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
              Not enough credits
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              {errorMessage ||
                `You need ${formatCredits(
                  creditsNeeded
                )} credits to ${actionDescription}, but you only have ${formatCredits(
                  currentBalance
                )} credits available.`}
            </p>
          </div>
        </div>

        {/* Cost Breakdown */}
        {estimatedCost > 0 && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
              <FiInfo size={16} />
              Cost Breakdown
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Estimated cost:
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCredits(estimatedCost)} credits
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Current balance:
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCredits(currentBalance)} credits
                </span>
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2">
                <div className="flex justify-between">
                  <span className="text-red-600 dark:text-red-400">
                    Shortage:
                  </span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatCredits(shortage)} credits (≈$
                    {shortageUsd.toFixed(3)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Status */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
          <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            Current Plan: {subscriptionTier === "pro" ? "Pro" : "Free"}
          </h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {subscriptionTier === "free"
              ? "Free plan includes 1,000 credits per month."
              : "Pro plan includes 20,000 credits per month."}
          </p>
        </div>

        {/* Upgrade Option */}
        {upgradePlan && subscriptionTier === "free" && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <FiTrendingUp
                  className="text-blue-600 dark:text-blue-400"
                  size={20}
                />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Upgrade to {upgradePlan.name} Plan
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Get {upgradePlan.credits} credits per {upgradePlan.period} for{" "}
                  {upgradePlan.price}
                </p>

                {/* Benefits */}
                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 mb-4">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Unlimited AI characters
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Access to all AI models
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Extended chat limits
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Upload images and audio
                  </li>
                </ul>

                <button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isUpgrading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiCreditCard size={16} />
                      Upgrade to {upgradePlan.name} - {upgradePlan.price}/
                      {upgradePlan.period}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alternative Actions */}
        <div className="space-y-3">
          <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
            What you can do:
          </h4>

          <div className="space-y-2 text-sm">
            {subscriptionTier === "free" && (
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full mt-2"></div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <Link
                    to="/plans"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Upgrade to Pro
                  </Link>{" "}
                  for more credits and unlimited access
                </p>
              </div>
            )}

            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full mt-2"></div>
              <p className="text-zinc-600 dark:text-zinc-400">
                Wait until next month for your credits to refresh
              </p>
            </div>

            {context?.model && (
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full mt-2"></div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Try using a more efficient model to reduce costs
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
          >
            Close
          </button>

          {subscriptionTier === "free" && (
            <Link
              to="/plans"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg transition-colors"
              onClick={onClose}
            >
              View Plans
            </Link>
          )}
        </div>
      </div>
    </UniversalModal>
  );
}
