import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CharacterCard from './CharacterCard';
import { Character } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function Explore() {
  const { user, login, apiFetch } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch<Character[]>('/api/characters/explore');
        setCharacters(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load characters:', error);
        setCharacters([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacters();
  }, [apiFetch]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <nav className="bg-gray-800 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold hover:text-blue-400 transition-colors">
            Nevermade
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/explore"
              className="rounded-lg bg-gray-700 px-4 py-2 text-white"
              aria-current="page"
            >
              Explore
            </Link>
            {user ? (
              <Link
                to="/dashboard"
                className="rounded-lg border border-gray-400 hover:bg-gray-700 px-4 py-2"
              >
                Dashboard
              </Link>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 hover:bg-gray-600"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Explore Characters</h1>
        
        <div className="max-w-6xl mx-auto">
          {characters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map(character => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p className="text-xl mb-2">No public characters found</p>
              <p>Sign in to create and share your own characters!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 