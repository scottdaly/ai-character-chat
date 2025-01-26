// src/components/Home.tsx
import { useState, useEffect } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Character } from '../types';
import { useCharacters } from '../api/characters';
import { getModelAlias } from './CharacterCard';

export default function Home() {
  const { user, login } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/characters/featured`);
        if (!response.ok) {
          throw new Error('Failed to load characters');
        }
        const data = await response.json();
        setCharacters(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load characters:', error);
        setCharacters([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacters();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <nav className="bg-gray-800 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Nevermade</h1>
          <div className="flex items-center gap-4">
            <Link
              to="/explore"
              className="rounded-lg px-4 py-2 hover:bg-gray-700"
            >
              Explore
            </Link>
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-lg border border-gray-400 hover:bg-gray-700 px-4 py-2"
                >
                  Dashboard
                </Link>
                
              </>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 hover:bg-gray-600"
              >
                <FcGoogle className="text-xl" /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-16 text-center">
          
          <p className="mx-auto mb-8 max-w-2xl text-3xl text-gray-400">
            Create your own custom AI personalities powered by state-of-the-art language models
          </p>
          {user ? (
            <Link
              to="/dashboard"
              className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold hover:bg-blue-500"
            >
              Go to Dashboard
            </Link>
          ) : (
            <button
              onClick={login}
              className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold hover:bg-blue-500"
            >
              Get Started
            </button>
          )}
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Characters</h2>
          {isLoading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map(character => (
                user ? (
                  <Link
                    key={character.id}
                    to={`/dashboard/characters/${character.id}`}
                    className="p-6 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{character.name}</h3>
                        <p className="text-sm text-gray-400">
                          {character.User?.isOfficial ? (
                            <span className="flex items-center gap-1">
                              by <span className="text-blue-400 font-medium">Nevermade</span>
                              <span className="inline-block px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                Official
                              </span>
                            </span>
                          ) : (
                            <span>by @{character.User?.username || 'unknown'}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 rounded ${
                        character.User?.isOfficial 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {getModelAlias(character.model)}
                      </span>
                    </div>
                    </div>
                    <p className="text-gray-400 mb-4 line-clamp-3">{character.description}</p>
                    
                  </Link>
                ) : (
                  <button
                    key={character.id}
                    onClick={login}
                    className="p-6 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors text-left w-full"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{character.name}</h3>
                        <p className="text-sm text-gray-400">
                          {character.User?.isOfficial ? (
                            <span className="flex items-center gap-1">
                              by <span className="text-blue-400 font-medium">Nevermade</span>
                              <span className="inline-block px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                Official
                              </span>
                            </span>
                          ) : (
                            <span>by @{character.User?.username || 'unknown'}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-400 mb-4 line-clamp-3">{character.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 rounded ${
                        character.User?.isOfficial 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {getModelAlias(character.model)}
                      </span>
                      <span className="text-blue-400">Sign in to chat →</span>
                    </div>
                  </button>
                )
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border-2 border-gray-700 p-6">
            <h3 className="mb-3 text-xl font-semibold">🤖 Custom Characters</h3>
            <p className="text-gray-400">
              Design unique AI personalities with custom prompts and model configurations
            </p>
          </div>
          
          <div className="rounded-xl border-2 border-gray-700 p-6">
            <h3 className="mb-3 text-xl font-semibold">💬 Natural Conversations</h3>
            <p className="text-gray-400">
              Engage in fluid, contextual dialogues powered by advanced language models
            </p>
          </div>
          
          <div className="rounded-xl border-2 border-gray-700 p-6">
            <h3 className="mb-3 text-xl font-semibold">🔒 Secure & Private</h3>
            <p className="text-gray-400">
              Your conversations are protected with enterprise-grade security
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}