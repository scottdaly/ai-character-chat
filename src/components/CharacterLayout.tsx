// src/components/CharacterLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import ConversationList from './ConversationList';
import { useCharacter } from '../api/characters';
import { useAuth } from '../contexts/AuthContext';
import CharacterSettings from './CharacterSettings';

export default function CharacterLayout() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { character } = useCharacter(characterId!);
  const [tempConversationId, setTempConversationId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const isOwner = user?.id ? Number(user.id) === character?.UserId : false;

  // Create temporary conversation when entering character page
  useEffect(() => {
    const createTempConversation = async () => {
      try {
        const tempId = `temp-${Date.now()}`;
        setTempConversationId(tempId);
        navigate(`/dashboard/characters/${characterId}/conversations/${tempId}`);
      } catch (error) {
        console.error('Error creating temporary conversation:', error);
      }
    };

    if (!tempConversationId) {
      createTempConversation();
    }
  }, [characterId]);

  return (
    <div className="flex h-screen bg-gray-900 w-full">
      {/* Conversation List Sidebar */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <FiArrowLeft /> Back to Dashboard
            </button>
            {isOwner && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-600 transition-colors"
                title="Edit character settings"
              >
                <FiSettings />
              </button>
            )}
          </div>
          <h2 className="text-lg font-semibold">{character?.name}</h2>
          <p className="text-sm text-gray-400">{character?.model}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList />
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1">
        <Outlet />
      </div>

      {/* Character Settings Modal */}
      {showSettings && character && (
        <CharacterSettings
          character={character}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            setShowSettings(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}