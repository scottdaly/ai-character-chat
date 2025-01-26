import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import CharacterCard from './CharacterCard';
import { Character } from '../types';

export default function Explore() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/characters/explore`);
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard" 
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <FiArrowLeft /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Explore Characters</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          {characters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map(character => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p className="text-xl mb-2">No characters found</p>
              <p>Be the first to create and share a character!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 