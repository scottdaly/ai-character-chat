import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";

interface User {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
  profilePicture?: string | null;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  subscriptionTier: string;
  isLoadingSubscription: boolean;
  login: (token?: string) => void;
  logout: () => Promise<void>;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  updateUser: (user: User) => void;
  refreshSubscriptionStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  subscriptionTier: "free",
  isLoadingSubscription: true,
  login: () => {},
  logout: async () => {},
  apiFetch: async () => {
    throw new Error("apiFetch not implemented");
  },
  updateUser: () => {},
  refreshSubscriptionStatus: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  // Load cached subscription status from localStorage
  useEffect(() => {
    const cachedTier = localStorage.getItem("subscriptionTier");
    if (cachedTier) {
      setSubscriptionTier(cachedTier);
      setIsLoadingSubscription(false);
    } else {
      // If no cached tier, set to false so we don't show loading indefinitely
      setIsLoadingSubscription(false);
    }
  }, []);

  const apiFetch = useCallback(
    async <T = any,>(url: string, options: RequestInit = {}): Promise<T> => {
      const token = localStorage.getItem("token");

      // Don't set Content-Type for FormData - let browser set it with boundary
      const isFormData = options.body instanceof FormData;

      const headers = {
        ...(!isFormData && { "Content-Type": "application/json" }),
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
        ...options,
        headers,
      });

      // Check if the response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server error: Expected JSON response");
      }

      const data = await response.json();

      if (!response.ok) {
        // Handle unauthorized errors by clearing auth state
        if (response.status === 401) {
          localStorage.removeItem("token");
          setUser(null);
          throw new Error("Unauthorized");
        }
        throw new Error(
          data.error || `API request failed with status ${response.status}`
        );
      }

      return data as T;
    },
    []
  );

  // Fetch subscription status when user changes
  useEffect(() => {
    const fetchSubscriptionForUser = async () => {
      if (!user) {
        setSubscriptionTier("free");
        setIsLoadingSubscription(false);
        localStorage.removeItem("subscriptionTier");
        lastUserIdRef.current = null;
        return;
      }

      // Only fetch if we haven't already fetched for this user
      if (lastUserIdRef.current === user.id) {
        return;
      }

      try {
        setIsLoadingSubscription(true);
        const status = await apiFetch("/api/subscription-status");
        setSubscriptionTier(status.tier);

        // Cache the subscription tier
        localStorage.setItem("subscriptionTier", status.tier);

        // Update user object with subscription data
        setUser((prev) =>
          prev
            ? {
                ...prev,
                subscriptionTier: status.tier,
                subscriptionStatus: status.status,
                subscriptionEndsAt: status.currentPeriodEnd,
              }
            : null
        );

        lastUserIdRef.current = user.id;
      } catch (error) {
        console.error(
          "[AuthContext] Failed to fetch subscription status:",
          error
        );
        setSubscriptionTier("free");
        localStorage.setItem("subscriptionTier", "free");
        lastUserIdRef.current = null;
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    if (!isLoading && user) {
      fetchSubscriptionForUser();
    } else if (!isLoading && !user) {
      setSubscriptionTier("free");
      setIsLoadingSubscription(false);
      localStorage.removeItem("subscriptionTier");
      lastUserIdRef.current = null;
    }
  }, [user?.id, isLoading]);

  const login = useCallback((token?: string) => {
    if (token) {
      localStorage.setItem("token", token);
      // Trigger auth check after setting token
      checkAuth();
    } else {
      // Redirect to Google OAuth
      window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout API call failed:", error);
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem("token");
      setUser(null);
      window.location.href = "/";
    }
  }, [apiFetch]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        setUser(null);
        return;
      }

      const userData = await apiFetch<User>("/api/me");
      setUser(userData);
    } catch (error) {
      console.error("Auth check failed:", error);
      // Clear invalid token
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!user) {
      setSubscriptionTier("free");
      setIsLoadingSubscription(false);
      localStorage.removeItem("subscriptionTier");
      lastUserIdRef.current = null;
      return;
    }

    try {
      setIsLoadingSubscription(true);
      const status = await apiFetch("/api/subscription-status");
      setSubscriptionTier(status.tier);

      // Cache the subscription tier
      localStorage.setItem("subscriptionTier", status.tier);

      // Update user object with subscription data
      setUser((prev) =>
        prev
          ? {
              ...prev,
              subscriptionTier: status.tier,
              subscriptionStatus: status.status,
              subscriptionEndsAt: status.currentPeriodEnd,
            }
          : null
      );

      lastUserIdRef.current = user.id;
    } catch (error) {
      console.error("Failed to fetch subscription status:", error);
      setSubscriptionTier("free");
      localStorage.setItem("subscriptionTier", "free");
      lastUserIdRef.current = null;
    } finally {
      setIsLoadingSubscription(false);
    }
  }, [user, apiFetch]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      user,
      isLoading,
      subscriptionTier,
      isLoadingSubscription,
      login,
      logout,
      apiFetch,
      updateUser,
      refreshSubscriptionStatus,
    }),
    [
      user,
      isLoading,
      subscriptionTier,
      isLoadingSubscription,
      login,
      logout,
      apiFetch,
      updateUser,
      refreshSubscriptionStatus,
    ]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
