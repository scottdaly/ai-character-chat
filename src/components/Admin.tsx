import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CharacterSettings from './CharacterSettings';
import { Character } from '../types';

export default function Admin() {
  const { user, apiFetch } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  useEffect(() => {
    if (user?.isAdmin) {
      apiFetch('/api/admin/characters')
        .then(setCharacters)
        .catch(console.error);
    }
  }, [user]);

  if (!user?.isAdmin) {
    return <div className="p-4 text-red-500">Admin access required</div>;
  }

  return (
    <div className="bg-zinc-900 min-h-screen h-full text-white">
        <div className="flex flex-col p-4 mx-auto max-w-6xl">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
       
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map(character => (
          <div 
            key={character.id}
            className="bg-zinc-800 p-4 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-semibold">{character.name}</h3>
              <button
                onClick={() => setSelectedCharacter(character)}
                className="text-blue-400 hover:text-blue-300"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-400 line-clamp-3">{character.description}</p>
          </div>
        ))}
      </div>

      {selectedCharacter && (
        <CharacterSettings
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
          onSave={() => window.location.reload()}
        />
      )}
      </div>
    </div>
  );
} 