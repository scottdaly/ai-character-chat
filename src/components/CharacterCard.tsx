import { useNavigate } from "react-router-dom";
import { FiGlobe, FiLock } from "react-icons/fi";
import { Character } from "../types";
import { getModelDisplayName } from "../config/models";

interface CharacterCardProps {
  character: Character;
  showMessageCount?: boolean;
  showPublicStatus?: boolean;
  isLocked?: boolean;
  isFreeTier?: boolean;
}

// Generate a consistent gradient based on character ID
const generateGradient = (characterId: string): string => {
  // Create a more robust hash from the character ID
  let hash = 0;
  for (let i = 0; i < characterId.length; i++) {
    const char = characterId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use golden ratio for better color harmony
  const goldenRatio = 0.618033988749;

  // Generate base hue
  const baseHue = Math.abs(hash) % 360;

  // Create harmonious color schemes using different mathematical relationships
  const schemes = [
    // Triadic (120° apart)
    [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360],
    // Analogous (30° apart)
    [baseHue, (baseHue + 30) % 360, (baseHue + 60) % 360],
    // Split complementary
    [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360],
    // Tetradic square
    [baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360],
    // Golden ratio based
    [
      baseHue,
      (baseHue + goldenRatio * 360) % 360,
      (baseHue + goldenRatio * 360 * 2) % 360,
    ],
  ];

  // Select scheme based on hash
  const schemeIndex = Math.abs(hash >> 8) % schemes.length;
  const [hue1, hue2, hue3] = schemes[schemeIndex];

  // Vary saturation and lightness for depth
  const saturation1 = 65 + (Math.abs(hash >> 16) % 20); // 65-85%
  const saturation2 = 70 + (Math.abs(hash >> 20) % 15); // 70-85%
  const saturation3 = 60 + (Math.abs(hash >> 24) % 25); // 60-85%

  const lightness1 = 55 + (Math.abs(hash >> 12) % 20); // 55-75%
  const lightness2 = 50 + (Math.abs(hash >> 16) % 25); // 50-75%
  const lightness3 = 60 + (Math.abs(hash >> 20) % 15); // 60-75%

  const color1 = `hsl(${hue1}, ${saturation1}%, ${lightness1}%)`;
  const color2 = `hsl(${hue2}, ${saturation2}%, ${lightness2}%)`;
  const color3 = `hsl(${hue3}, ${saturation3}%, ${lightness3}%)`;

  // Enhanced direction selection with more options
  const directions = [
    "135deg", // diagonal top-left to bottom-right
    "45deg", // diagonal top-right to bottom-left
    "90deg", // vertical
    "180deg", // horizontal
    "225deg", // diagonal
    "315deg", // diagonal
    "60deg", // 60 degree angle
    "120deg", // 120 degree angle
  ];

  const directionIndex = Math.abs(hash >> 28) % directions.length;
  const direction = directions[directionIndex];

  return `linear-gradient(${direction}, ${color1}, ${color2}, ${color3})`;
};

// Skeleton loader component for character cards
export function CharacterCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-lg p-4 border transition-colors h-[500px] bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 animate-pulse">
      {/* Image skeleton - always show now for consistency */}
      <div className="w-full aspect-square mb-3 bg-zinc-200 dark:bg-zinc-700 rounded-lg"></div>

      <div className="flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          {/* Title skeleton */}
          <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4"></div>
          {/* Model badge skeleton */}
          <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
        </div>

        {/* Description skeleton */}
        <div className="space-y-2 flex-grow">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-full"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-4/6"></div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-sm">
          {/* Author skeleton */}
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20"></div>
        </div>
        <div className="flex items-center justify-between text-sm">
          {/* Status indicators skeleton */}
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-12"></div>
        </div>
      </div>
    </div>
  );
}

export const getModelAlias = (modelId: string): string => {
  return getModelDisplayName(modelId);
};

export default function CharacterCard({
  character,
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
    <div className="flex flex-col h-full justify-between group-hover/characterCard:scale-101 transition-all duration-300 ease-in-out">
      {/* Character image or gradient placeholder */}
      <div className="w-full aspect-square mb-3 overflow-hidden rounded-lg relative">
        {character.image ? (
          <img
            src={character.image}
            alt={character.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // If image fails to load, show gradient instead
              const target = e.target as HTMLImageElement;
              const container = target.parentElement;
              if (container) {
                target.style.display = "none";
                // Create gradient background
                const gradientDiv = document.createElement("div");
                gradientDiv.className = "w-full h-full absolute inset-0";
                gradientDiv.style.background = generateGradient(character.id);
                gradientDiv.style.opacity = "0.9";
                container.appendChild(gradientDiv);

                // Add noise texture
                const noiseDiv = document.createElement("div");
                noiseDiv.className =
                  "w-full h-full absolute inset-0 opacity-30";
                noiseDiv.style.mixBlendMode = "overlay";
                noiseDiv.innerHTML = `
                  <svg class="w-full h-full">
                    <defs>
                      <filter id="noise-error-${character.id}">
                        <feTurbulence
                          type="fractalNoise"
                          baseFrequency="0.65"
                          numOctaves="3"
                          stitchTiles="stitch"
                        />
                        <feColorMatrix type="saturate" values="0" />
                      </filter>
                    </defs>
                    <rect width="100%" height="100%" filter="url(#noise-error-${character.id})" />
                  </svg>
                `;
                container.appendChild(noiseDiv);

                // Add glow effect
                const glowDiv = document.createElement("div");
                glowDiv.className = "w-full h-full absolute inset-0";
                glowDiv.style.background = `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent 50%)`;
                glowDiv.style.mixBlendMode = "soft-light";
                container.appendChild(glowDiv);
              }
            }}
          />
        ) : (
          // Show gradient placeholder when no image
          <>
            <div
              className="w-full h-full absolute inset-0"
              style={{
                background: generateGradient(character.id),
                opacity: 0.9,
              }}
            />
            {/* Add noise texture */}
            <div className="w-full h-full absolute inset-0 opacity-30 mix-blend-overlay">
              <svg className="w-full h-full">
                <defs>
                  <filter id={`noise-${character.id}`}>
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.65"
                      numOctaves="3"
                      stitchTiles="stitch"
                    />
                    <feColorMatrix type="saturate" values="0" />
                  </filter>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  filter={`url(#noise-${character.id})`}
                />
              </svg>
            </div>
            {/* Add a subtle glow effect */}
            <div
              className="w-full h-full absolute inset-0"
              style={{
                background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent 50%)`,
                mixBlendMode: "soft-light",
              }}
            />
          </>
        )}
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className={`text-xl font-semibold text-zinc-800 dark:text-white`}>
          {character.name}
        </h3>

        <p
          className={`text-sm line-clamp-3 text-zinc-600 dark:text-zinc-300 flex-grow`}
        >
          {character.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-sm">
          {character.User?.isOfficial ? (
            <span className={`flex items-center gap-1 `}>
              <span className={`text-zinc-600 dark:text-zinc-400 font-medium`}>
                Nevermade
              </span>
              <span
                className={`inline-block px-1.5 py-0.5 text-xs rounded-full ${
                  !isFreeTier
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                Official
              </span>
            </span>
          ) : (
            <span className={`text-zinc-500 dark:text-zinc-400`}>
              @{character.User?.username || "Community"}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <div
            className={`flex items-center gap-1.5 ${
              isLocked
                ? "text-amber-600 dark:text-amber-500"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {showPublicStatus &&
              (character.isPublic ? (
                <FiGlobe className="h-4 w-4" title="This character is public" />
              ) : (
                <FiLock className="h-4 w-4" title="This character is private" />
              ))}
            {isLocked && <FiLock className="h-4 w-4" title="Locked" />}
          </div>
        </div>
      </div>
    </div>
  );

  // All cards now have consistent height since they all have an image section
  const commonClassName = `group/characterCard flex flex-col justify-between rounded-lg p-4 border transition-colors h-[500px] ${
    isLocked
      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60"
      : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600"
  } cursor-pointer`;

  return (
    <a
      href={`/dashboard/characters/${character.id}`}
      onClick={handleCardClick}
      className={commonClassName}
      title={
        isLocked && isFreeTier
          ? "Upgrade to Pro to chat with this character"
          : undefined
      }
    >
      {cardContent}
    </a>
  );
}
