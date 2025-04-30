import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FiCheck } from 'react-icons/fi';
import Navbar from './Navbar';
import { useSearchParams } from 'react-router-dom';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Up to 3 AI characters',
      'Basic chat functionality',
      'GPT-4o Mini access',
      'Community access'
    ],
    priceId: null
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$10',
    period: 'per month',
    features: [
      'Unlimited AI characters',
      'Advanced chat features',
      'All AI models access',
      'Priority support',
      'Early access to new features'
    ],
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID
  }
];

export default function SubscriptionPlans() {
  const { user, apiFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [searchParams] = useSearchParams();

  const fetchSubscriptionStatus = async () => {
    try {
      const status = await apiFetch('/api/subscription-status');
      setCurrentPlan(status.tier);
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
      setCurrentPlan('free');
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [apiFetch]);

  useEffect(() => {
    // Check for success or canceled status in URL
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      // Refresh subscription status
      fetchSubscriptionStatus();
    } else if (canceled === 'true') {
      setError('Subscription process was canceled. Please try again if you want to upgrade.');
    }
  }, [searchParams]);

  const handleSubscribe = async (priceId: string | null) => {
    if (!priceId) return;
    
    try {
      setLoading(true);
      setError(null);

      const { url } = await apiFetch('/api/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ priceId })
      });

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Failed to start subscription process:', err);
      setError(err instanceof Error ? err.message : 'Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      // For free tier users, redirect to upgrade
      if (currentPlan === 'free') {
        setError('Please upgrade to Pro to access subscription management.');
        return;
      }
      
      const { url } = await apiFetch('/api/create-portal-session', {
        method: 'POST'
      });
      
      if (!url) {
        throw new Error('Failed to create portal session');
      }

      window.location.href = url;
    } catch (err) {
      console.error('Subscription management error:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to open subscription management. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900 overflow-y-auto dark-scrollbar">
      <Navbar showUpgradeButton={false} subscriptionTier={currentPlan} />

      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-gray-400">Unlock the full potential of AI characters</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl p-8 ${
                  plan.id === 'pro' 
                    ? 'bg-gradient-to-br from-blue-600 to-blue-800'
                    : 'bg-zinc-800'
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <FiCheck className="text-green-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {currentPlan === plan.id ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={loading}
                    className={`w-full py-3 px-6 rounded-lg transition-colors ${
                      loading ? 'opacity-50 cursor-not-allowed' : 'bg-zinc-700 hover:bg-zinc-600'
                    }`}
                  >
                    {loading ? 'Processing...' : 'Manage Subscription'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.priceId)}
                    disabled={loading}
                    className={`w-full py-3 px-6 rounded-lg transition-colors ${
                      loading ? 'opacity-50 cursor-not-allowed' : 
                      plan.id === 'pro'
                        ? 'bg-white text-blue-900 hover:bg-gray-100'
                        : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {loading ? 'Processing...' : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-8 text-center text-red-500">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 