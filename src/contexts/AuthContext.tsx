import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiFetch = async <T = any>(url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
      ...options,
      headers,
    });

    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server error: Expected JSON response');
    }
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data as T;
  };

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setUser(null);
          return;
        }

        const userData = await apiFetch('/api/me');
        
        setUser({
          id: userData.id,
          displayName: userData.displayName,
          email: userData.email,
          username: userData.username,
          isAdmin: userData.isAdmin
        });
      } catch (error) {
        console.error('Auth check failed:', error);
        if (error instanceof Error && error.message === 'Unauthorized') {
          localStorage.removeItem('token');
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Add an event listener to check auth when the window regains focus
    const handleFocus = () => {
      checkAuth();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}