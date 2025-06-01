import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { FiCheck } from "react-icons/fi";
import Navbar from "./Navbar";
import { useSearchParams } from "react-router-dom";
import Toast from "./Toast";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Up to 3 AI characters",
      "Basic chat functionality",
      "GPT-4o Mini access",
      "Community access",
    ],
    priceId: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$10",
    period: "per month",
    features: [
      "Unlimited AI characters",
      "Extended chat limits",
      "Access to all AI models",
      "Upload images and audio to your characters",
      "Early access to new features",
    ],
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
  },
];

export default function SubscriptionPlans() {
  const {
    apiFetch,
    subscriptionTier,
    isLoadingSubscription,
    refreshSubscriptionStatus,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for success or canceled status in URL
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      // Refresh subscription status from AuthContext
      refreshSubscriptionStatus();
    } else if (canceled === "true") {
      setToast({
        message:
          "Subscription process was canceled. Please try again if you want to upgrade.",
        type: "error",
      });
    }
  }, [searchParams, refreshSubscriptionStatus]);

  const handleSubscribe = async (priceId: string | null) => {
    if (!priceId) return;

    try {
      setLoading(true);
      setToast(null);

      const { url } = await apiFetch("/api/create-subscription", {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error("Failed to start subscription process:", err);
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to process subscription",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      setToast(null);

      // For free tier users, redirect to upgrade
      if (subscriptionTier === "free") {
        setToast({
          message: "Please upgrade to Pro to access subscription management.",
          type: "error",
        });
        return;
      }

      const { url } = await apiFetch("/api/create-portal-session", {
        method: "POST",
      });

      if (!url) {
        throw new Error("Failed to create portal session");
      }

      window.location.href = url;
    } catch (err) {
      console.error("Subscription management error:", err);
      setToast({
        message:
          err instanceof Error
            ? err.message
            : "Failed to open subscription management. Please try again later.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto dark-scrollbar scrollable-container">
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Choose Your Plan</h2>
            <p className="text-gray-400">
              Unlock the full potential of AI characters
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col justify-between rounded-xl p-8 relative ${
                  subscriptionTier === plan.id
                    ? "border border-zinc-300 bg-zinc-700/60"
                    : "bg-zinc-700/60 border border-zinc-600"
                }`}
              >
                <div>
                  <div className="flex flex-row justify-between">
                    <div className="mb-8">
                      <h3 className="text-3xl tracking-wide mb-2 instrument-serif-regular">
                        {plan.name} Plan
                      </h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-semibold">
                          {plan.price}
                        </span>
                        <span className="text-gray-400">/ month</span>
                      </div>
                    </div>
                    <div>
                      {subscriptionTier === plan.id && (
                        <span className="text-zinc-100 bg-zinc-600 px-2 py-1 rounded-full text-sm">
                          Current Plan
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-24">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <FiCheck className="text-zinc-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {subscriptionTier === plan.id ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={true}
                    className={`w-full py-3 px-6 rounded-lg transition-colors ${
                      loading
                        ? "opacity-50 cursor-not-allowed"
                        : "border border-zinc-500"
                    }`}
                  >
                    {loading ? "Processing..." : "Current Plan"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.priceId)}
                    disabled={loading}
                    className={`w-full py-3 px-6 rounded-lg transition-colors cursor-pointer ${
                      loading
                        ? "opacity-50 cursor-not-allowed"
                        : plan.id === "free"
                        ? "bg-zinc-700 hover:bg-red-600/50 duration-300 ease-in-out"
                        : "bg-blue-600 hover:bg-blue-800 hover:scale-102 transition-all duration-500 ease-in-out"
                    }`}
                  >
                    {loading
                      ? "Processing..."
                      : plan.id === "free"
                      ? `Cancel Subscription`
                      : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Toast notifications */}
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
