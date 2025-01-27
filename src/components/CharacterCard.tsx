import { Link } from 'react-router-dom';
import { FiGlobe, FiLock } from 'react-icons/fi';
import { Character } from '../types';

interface CharacterCardProps {
  character: Character;
  showMessageCount?: boolean;
  showPublicStatus?: boolean;
}

export const getModelAlias = (modelId: string): string => {
  switch (modelId) {
    case 'chatgpt-4o-latest':
      return 'GPT-4o';
    case 'gpt-4o-mini':
      return 'GPT-4o Mini';
    case 'claude-3-5-sonnet-20241022':
      return 'Claude Sonnet 3.5';
    case 'claude-3-5-haiku-20241022':
      return 'Claude Haiku 3.5';
    default:
      return modelId;
  }
};

export default function CharacterCard({ character, showMessageCount = false, showPublicStatus = false }: CharacterCardProps) {
  return (
    <Link
      to={`/dashboard/characters/${character.id}/conversations`}
      className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors h-[200px] flex flex-col justify-between"
    >
      <div className="flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-semibold text-white">{character.name}</h3>
          <span className="px-2 py-1 bg-gray-700 rounded text-gray-300 text-sm">
            {getModelAlias(character.model)}
          </span>
        </div>
      
        <p className="text-zinc-300 text-sm line-clamp-3">{character.description}</p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-sm">
          {character.User?.isOfficial ? (
            <span className="flex items-center gap-1">
              <span className="text-blue-400 font-medium">Nevermade</span>
              <span className="inline-block px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                Official
              </span>
            </span>
          ) : (
            <span className="text-gray-400">by @{character.User?.username || 'unknown'}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            {showMessageCount && (
              <span className="text-gray-400">
                {character.messageCount.toLocaleString()} messages
              </span>
            )}
          </div>
          {showPublicStatus && (
            character.isPublic ? (
              <span className="flex items-center gap-1 text-gray-400">
                <FiGlobe size={14} />
                Public
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400">
                <FiLock size={14} />
                Private
              </span>
            )
          )}
        </div>
      </div>
    </Link>
  );
} 