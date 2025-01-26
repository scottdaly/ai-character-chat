// src/components/AuthSuccess.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthSuccess() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // Get token from URL
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) {
          throw new Error('No token found');
        }

        // Store token
        localStorage.setItem('token', token);

        // Clear token from URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Verify token and get user data
        const userData = await apiFetch('/api/me');
        
        // Redirect based on username status
        if (!userData.username) {
          navigate('/setup-username');
        } else {
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Authentication failed:', error);
        navigate('/');
      }
    };

    authenticateUser();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Completing authentication...</p>
      </div>
    </div>
  );
}