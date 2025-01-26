import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function UsernamePromptModal() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { apiFetch } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate username format before sending
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }

      const data = await apiFetch('/api/setup-username', {
        method: 'POST',
        body: JSON.stringify({ username })
      });

      // Store the new token if one is returned
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      // Username set successfully, reload the page to refresh user data
      window.location.reload();
    } catch (err) {
      console.error('Username setup error:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-xl">
        <h2 className="text-2xl font-bold mb-6 text-center">Set Your Username</h2>
        
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
              Choose a username to continue. This will be displayed as your creator name.
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
          <p className="text-sm text-gray-400">
            By continuing, you agree to the <Link to="/terms" className="text-blue-500 hover:text-blue-400">Terms of Service</Link> and <Link to="/privacy" className="text-blue-500 hover:text-blue-400">Privacy Policy</Link>.  
          </p>
        </form>
      </div>
    </div>
  );
} 