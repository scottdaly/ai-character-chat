import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SetupUsername() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Get token from URL and store it
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('token', token);
      // Clear token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiFetch('/api/setup-username', {
        method: 'POST',
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set username');
      }

      // Store the new token if one is returned
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      // Username set successfully, redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set username');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Choose Your Username</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              minLength={3}
              maxLength={30}
              required
            />
            <p className="mt-1 text-sm text-gray-400">
              This will be displayed as your creator name for characters you create.
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed py-2 px-4 rounded-lg transition-colors"
          >
            {isLoading ? 'Setting username...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
} 