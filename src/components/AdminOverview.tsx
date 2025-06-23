import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Users,
  Activity,
  DollarSign,
  TrendingUp,
  PieChart,
  Zap,
} from "lucide-react";

interface SystemStats {
  summary: {
    totalRequests: number;
    activeUsers: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCreditsUsed: number;
    totalRevenue: number;
    averageCreditsPerRequest: string | number;
  };
  topUsers: Array<{
    userId: string;
    requestCount: number;
    creditsUsed: string;
    totalCostUsd: string;
    userDetails: {
      email: string;
      username?: string;
      subscriptionTier?: string;
    };
  }>;
  usageByModel: Array<{
    modelName: string;
    modelProvider: string;
    requestCount: number;
    creditsUsed: string;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
    activeUsers: number;
    creditsUsed: string;
    revenue: string;
  }>;
}

const AdminOverview: React.FC = () => {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30); // days

  useEffect(() => {
    fetchSystemStats();
  }, [dateRange]);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const data = await apiFetch<SystemStats>(
        `/api/admin/analytics/system?startDate=${startDate.toISOString()}`
      );

      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Error: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Admin Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          System-wide analytics and usage statistics
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Requests
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatNumber(stats.summary.totalRequests)}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Users
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatNumber(stats.summary.activeUsers)}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Tokens
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatNumber(
                  (stats.summary.totalInputTokens || 0) +
                    (stats.summary.totalOutputTokens || 0)
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatNumber(stats.summary.totalInputTokens || 0)} in /{" "}
                {formatNumber(stats.summary.totalOutputTokens || 0)} out
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
                {stats.summary.totalCreditsUsed.toFixed(2)}
              </p>
            </div>
            <Zap className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Revenue
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatCurrency(stats.summary.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Top Users by Usage
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Requests</th>
                <th className="px-6 py-3">Credits Used</th>
                <th className="px-6 py-3">Cost</th>
                <th className="px-6 py-3">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.topUsers.slice(0, 5).map((user) => (
                <tr
                  key={user.userId}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.userDetails.email}
                      </div>
                      {user.userDetails.username && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{user.userDetails.username}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatNumber(user.requestCount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {parseFloat(user.creditsUsed).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatCurrency(parseFloat(user.totalCostUsd))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.userDetails.subscriptionTier === "pro"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {user.userDetails.subscriptionTier || "free"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Usage by Model
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {stats.usageByModel.map((model) => {
              const percentage =
                (parseFloat(model.creditsUsed) /
                  stats.summary.totalCreditsUsed) *
                100;

              return (
                <div key={`${model.modelProvider}-${model.modelName}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {model.modelName} ({model.modelProvider})
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {model.requestCount} requests
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {percentage.toFixed(1)}% of total usage
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {parseFloat(model.creditsUsed).toFixed(2)} credits
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
