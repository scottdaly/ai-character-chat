import { Link, useNavigate } from "react-router-dom";
import { FiGlobe, FiLock, FiUnlock } from "react-icons/fi";
import { Character } from "../types";

interface CharacterCardProps {
  character: Character;
  showMessageCount?: boolean;
  showPublicStatus?: boolean;
  isLocked?: boolean;
  isFreeTier?: boolean;
}

// Skeleton loader component for character cards
export function CharacterCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-lg p-4 border transition-colors h-[200px] bg-zinc-800/50 border-zinc-700/50 animate-pulse">
      <div className="flex flex-col">
        <div className="flex justify-between items-start mb-2">
          {/* Title skeleton */}
          <div className="h-6 bg-zinc-700 rounded w-3/4"></div>
          {/* Model badge skeleton */}
          <div className="h-6 bg-zinc-700 rounded w-16"></div>
        </div>

        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-zinc-700 rounded w-full"></div>
          <div className="h-4 bg-zinc-700 rounded w-5/6"></div>
          <div className="h-4 bg-zinc-700 rounded w-4/6"></div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-sm">
          {/* Author skeleton */}
          <div className="h-4 bg-zinc-700 rounded w-20"></div>
        </div>
        <div className="flex items-center justify-between text-sm">
          {/* Status indicators skeleton */}
          <div className="h-4 bg-zinc-700 rounded w-12"></div>
        </div>
      </div>
    </div>
  );
}

export const getModelAlias = (modelId: string): string => {
  switch (modelId) {
    // OpenAI models
    case "chatgpt-4o-latest":
      return "GPT-4o";
    case "gpt-4o-mini":
      return "GPT-4o Mini";
    case "gpt-4o-mini-2024-07-18":
      return "GPT-4o Mini";
    case "gpt-4.1-nano-2025-04-14":
      return "GPT-4.1 Nano";
    case "gpt-4o-2024-08-06":
      return "GPT-4o";
    case "gpt-4.1-2025-04-14":
      return "GPT-4.1";
    case "o4-mini-2025-04-16":
      return "o4 Mini";
    case "gpt-3.5-turbo":
      return "GPT-3.5 Turbo";

    // Google models
    case "gemini-2.0-flash-lite":
      return "Gemini 2.0 Flash Lite";
    case "gemini-2.0-flash":
      return "Gemini 2.0 Flash";
    case "gemini-2.5-flash-preview-05-20":
      return "Gemini 2.5 Flash";
    case "gemini-2.5-pro-preview-05-06":
      return "Gemini 2.5 Pro";
    case "gemini-1.5-flash":
      return "Gemini 1.5 Flash";
    case "gemini-1.5-pro":
      return "Gemini 1.5 Pro";
    case "gemini-1.0-pro":
      return "Gemini 1.0 Pro";

    // Anthropic models
    case "claude-3-5-sonnet-20241022":
      return "Claude Sonnet 3.5";
    case "claude-3-5-haiku-20241022":
      return "Claude Haiku 3.5";
    case "claude-3-5-haiku-latest":
      return "Claude 3.5 Haiku";
    case "claude-3-7-sonnet-latest":
      return "Claude 3.7 Sonnet";
    case "claude-sonnet-4-20250514":
      return "Claude 4 Sonnet";
    case "claude-opus-4-20250514":
      return "Claude 4 Opus";
    case "claude-3-haiku-20240307":
      return "Claude 3 Haiku";

    default:
      return modelId;
  }
};

export default function CharacterCard({
  character,
  showMessageCount = false,
  showPublicStatus = false,
  isLocked = false,
  isFreeTier = false,
}: CharacterCardProps) {
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Navigate directly to a temporary conversation, bypassing the conversations list
    const tempId = `temp-${Date.now()}`;
    navigate(`/dashboard/characters/${character.id}/conversations/${tempId}`);
  };

  const cardContent = (
    <>
      <div className="flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className={`text-xl font-semibold`}>{character.name}</h3>
          <span
            className={`px-2 py-1 rounded text-sm bg-zinc-700 text-zinc-200`}
          >
            {getModelAlias(character.model)}
          </span>
        </div>

        <p className={`text-sm line-clamp-3 text-zinc-300`}>
          {character.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-sm">
          {character.User?.isOfficial ? (
            <span className={`flex items-center gap-1 `}>
              <span className={`text-zinc-400 font-medium`}>Nevermade</span>
              <span
                className={`inline-block px-1.5 py-0.5 text-xs rounded-full ${
                  isLocked && isFreeTier
                    ? "bg-zinc-700 text-zinc-300"
                    : "bg-blue-600 text-blue-100 "
                }`}
              >
                Official
              </span>
            </span>
          ) : (
            <span className={`text-gray-400`}>
              by @{character.User?.username || "unknown"}
            </span>
          )}
        </div>
        <div
          className={`flex items-center justify-between text-sm text-gray-500`}
        >
          <div className="flex items-center gap-2">
            {showMessageCount && (
              <span className={`text-gray-400`}>
                {character.messageCount.toLocaleString()} messages
              </span>
            )}
            {isLocked && isFreeTier && (
              <span className="flex items-center gap-1  text-red-400 px-2 py-1 rounded-md text-sm">
                <FiLock size={14} /> Locked
              </span>
            )}
          </div>
          {showPublicStatus &&
            !isLocked &&
            (character.isPublic ? (
              <span className="flex items-center gap-1 text-gray-400">
                <FiGlobe size={14} />
                Public
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400">
                <FiLock size={14} />
                Private
              </span>
            ))}
        </div>
      </div>
    </>
  );

  const commonClassName = `flex flex-col justify-between rounded-lg p-4 border transition-colors h-[200px] bg-zinc-800/50 border-zinc-700/50 cursor-pointer hover:bg-zinc-800/70`;

  return (
    <div
      onClick={handleCardClick}
      className={commonClassName}
      title={
        isLocked && isFreeTier
          ? "Upgrade to Pro to chat with this character"
          : undefined
      }
    >
      {cardContent}
    </div>
  );
}
