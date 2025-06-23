import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft,
  User,
  Activity,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  CreditCard,
  BarChart3
} from 'lucide-react';

interface UserAnalytics {
  userId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCreditsUsed: number;
    totalCostUsd: number;
    currentBalance: number;
  };
  usageByModel: Array<{
    modelName: string;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    creditsUsed: string;
  }>;
  usageOverTime: Array<{
    date: string;
    requestCount: number;
    creditsUsed: string;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balance: number;
    description: string;
    createdAt: string;
  }>;
}

const AdminUserDetails: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30); // days

  useEffect(() => {
    if (userId) {
      fetchUserAnalytics();
    }
  }, [userId, dateRange]);

  const fetchUserAnalytics = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);
      
      const data = await apiFetch<UserAnalytics>(
        `/api/admin/analytics/user/${userId}?startDate=${startDate.toISOString()}`
      );
      
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div>
        <button
          onClick={() => navigate('/admin/analytics/users')}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Users
        </button>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            {error || 'Failed to load user analytics'}
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate daily average
  const dailyAverage = analytics.summary.totalCreditsUsed / dateRange;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/analytics/users')}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Users
        </button>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          User Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Detailed usage statistics for user {userId}
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
          Time Period:
        </label>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(Number(e.target.value))}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Requests
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatNumber(analytics.summary.totalRequests)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ~{(analytics.summary.totalRequests / dateRange).toFixed(1)}/day
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Credits Used
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {analytics.summary.totalCreditsUsed.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ~{dailyAverage.toFixed(2)}/day
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Cost
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatCurrency(analytics.summary.totalCostUsd)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatCurrency(analytics.summary.totalCostUsd / dateRange)}/day
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Balance
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {analytics.summary.currentBalance.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                credits remaining
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Usage by Model */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Usage by Model
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3">Model</th>
                <th className="px-6 py-3">Requests</th>
                <th className="px-6 py-3">Input Tokens</th>
                <th className="px-6 py-3">Output Tokens</th>
                <th className="px-6 py-3">Credits Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {analytics.usageByModel.map((model) => (
                <tr key={model.modelName} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {model.modelName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatNumber(model.requestCount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatNumber(model.inputTokens)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatNumber(model.outputTokens)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {parseFloat(model.creditsUsed).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Recent Transactions
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {analytics.recentTransactions.map((transaction) => (
            <div key={transaction.id} className="px-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(transaction.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${
                    transaction.type === 'credit' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.type === 'credit' ? '+' : '-'}
                    {Math.abs(transaction.amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Balance: {transaction.balance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetails;