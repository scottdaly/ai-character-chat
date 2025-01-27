import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useCharacters } from '../api/characters';
import CharacterCard from './CharacterCard';
import { Character } from '../types';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { characters, createCharacter, isLoading, error } = useCharacters();
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [newCharacter, setNewCharacter] = useState<Omit<Character, 'id'>>({
    name: '',
    description: '',
    model: 'gpt-4o-mini',
    systemPrompt: '',
    createdAt: new Date(),
    UserId: user?.id ? Number(user.id) : 0,
    isPublic: false,
    messageCount: 0
  });

  const handleCreateCharacter = async () => {
    try {
      await createCharacter(newCharacter);
      setShowCharacterForm(false);
      setNewCharacter({
        name: '',
        description: '',
        model: 'gpt-4o-mini',
        systemPrompt: '',
        createdAt: new Date(),
        UserId: user?.id ? Number(user.id) : 0,
        isPublic: false,
        messageCount: 0
      });
    } catch (error) {
      console.error('Failed to create character:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Error loading characters: {error.message}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900 overflow-y-auto dark-scrollbar">
      {/* Header */}
      <div className="p-4 md:py-4 md:px-0 flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl font-bold hover:text-blue-400 transition-colors">
            NeverMade
          </Link>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Logout
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Message */}
          <div className="flex flex-col md:flex-row justify-between items-center mt-4 mb-4 md:mb-16">
            <p className="text-4xl text-gray-100 text-center">Welcome back, {user?.username}</p>
             {/* Create Character Button */}
            <button
              onClick={() => setShowCharacterForm(true)}
              className="w-full cursor-pointer md:w-auto my-8 md:my-0 bg-blue-700 hover:bg-blue-600 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2"
            >
              <FiPlus size={20} /> Create New Character
            </button>
          </div>
          
         

          {/* Your Characters Section */}
          {characters.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Your Characters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map(character => (
                  <CharacterCard 
                    key={character.id} 
                    character={character}
                    showPublicStatus={character.UserId === Number(user?.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Character Creation Modal */}
          {showCharacterForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md space-y-4">
                <h2 className="text-xl font-bold">Create New Character</h2>
                
                <input
                  placeholder="Name"
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <textarea
                  placeholder="Description"
                  value={newCharacter.description}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 120) {
                      setNewCharacter({ ...newCharacter, description: value });
                    }
                  }}
                  maxLength={120}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-sm text-gray-400 text-right">
                  {newCharacter.description.length}/120 characters
                </div>
                
                <select
                  value={newCharacter.model}
                  onChange={(e) => setNewCharacter({ ...newCharacter, model: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <optgroup label="OpenAI">
                    <option value="chatgpt-4o-latest">GPT-4o Latest</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                  </optgroup>
                  <optgroup label="Anthropic">
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  </optgroup>
                </select>
                
                <textarea
                  placeholder="System Prompt"
                  value={newCharacter.systemPrompt}
                  onChange={(e) => setNewCharacter({ ...newCharacter, systemPrompt: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCharacter.isPublic}
                      onChange={(e) => setNewCharacter({ ...newCharacter, isPublic: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-gray-400">Public</span>
                  </label>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowCharacterForm(false)}
                    className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCharacter}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}