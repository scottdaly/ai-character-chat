import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { Character } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface CharacterSettingsProps {
  character: Character;
  onClose: () => void;
  onSave: () => void;
}

export default function CharacterSettings({ character, onClose, onSave }: CharacterSettingsProps) {
  const { apiFetch } = useAuth();
  const [editedCharacter, setEditedCharacter] = useState({
    name: character.name,
    description: character.description,
    model: character.model,
    systemPrompt: character.systemPrompt,
    isPublic: character.isPublic
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate required fields
      if (!editedCharacter.name.trim()) {
        setError('Name is required');
        return;
      }

      if (!editedCharacter.systemPrompt?.trim()) {
        setError('System prompt is required');
        return;
      }
      
      await apiFetch(`/api/characters/${character.id}`, {
        method: 'PUT',
        body: JSON.stringify(editedCharacter)
      });

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      console.error('Failed to save character:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Edit Character</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX />
          </button>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
        
        <input
          placeholder="Name"
          value={editedCharacter.name}
          onChange={(e) => setEditedCharacter({ ...editedCharacter, name: e.target.value })}
          className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <textarea
          placeholder="Description"
          value={editedCharacter.description}
          onChange={(e) => setEditedCharacter({ ...editedCharacter, description: e.target.value })}
          className="w-full bg-gray-700 rounded-lg px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <select
          value={editedCharacter.model}
          onChange={(e) => setEditedCharacter({ ...editedCharacter, model: e.target.value })}
          className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="chatgpt-4o-latest">GPT-4o Latest</option>
          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
        </select>
        
        <textarea
          placeholder="System Prompt"
          value={editedCharacter.systemPrompt}
          onChange={(e) => setEditedCharacter({ ...editedCharacter, systemPrompt: e.target.value })}
          className="w-full bg-gray-700 rounded-lg px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={editedCharacter.isPublic}
              onChange={(e) => setEditedCharacter({ ...editedCharacter, isPublic: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-gray-400">Public</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
} 