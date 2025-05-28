import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useCharacters } from "../api/characters";
import CharacterCard, { CharacterCardSkeleton } from "./CharacterCard";
import Navbar from "./Navbar";
import { useUserConversations } from "../api/useUserConversations";
import { checkCharacterAccess } from "../api/characterAccess";

export default function Dashboard() {
  const { user, subscriptionTier, isLoadingSubscription } = useAuth();
  const navigate = useNavigate();
  const { characters, isLoading, error } = useCharacters();
  const {
    conversations: userConversations,
    isLoading: isLoadingConversations,
  } = useUserConversations();
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);

  // Handle loading states with smooth transitions
  useEffect(() => {
    const isActuallyLoading = isLoading || isLoadingConversations;

    if (isActuallyLoading) {
      setIsContentVisible(false);

      // Show skeletons after 200ms if still loading
      const skeletonTimer = setTimeout(() => {
        if (isLoading || isLoadingConversations) {
          setShowSkeletons(true);
        }
      }, 200);

      return () => clearTimeout(skeletonTimer);
    } else {
      // Loading finished
      const finishLoading = async () => {
        // If skeletons were shown, ensure minimum display time
        if (showSkeletons) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        setShowSkeletons(false);

        // Fade in content
        setTimeout(() => setIsContentVisible(true), 50);
      };

      finishLoading();
    }
  }, [isLoading, isLoadingConversations, showSkeletons]);

  const handleCreateCharacter = () => {
    // Check character limit for free users
    if (subscriptionTier === "free" && characters.length >= 3) {
      navigate("/plans");
      return;
    }

    navigate("/dashboard/create-character");
  };

  // Create skeleton loaders
  const renderSkeletonCards = (count: number) => {
    return Array.from({ length: count }, (_, index) => (
      <CharacterCardSkeleton key={`skeleton-${index}`} />
    ));
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Error loading characters: {error.message}
      </div>
    );
  }

  // Get user's created character IDs
  const userCreatedCharacterIds = characters
    .filter((char) => char.UserId?.toString() === user?.id)
    .map((char) => String(char.id));

  // Sort characters by access status and recency
  const sortedCharacters = [...characters].sort((a, b) => {
    const aId = String(a.id);
    const bId = String(b.id);

    if (subscriptionTier === "free") {
      const aAccess = checkCharacterAccess(
        aId,
        subscriptionTier,
        userConversations,
        userCreatedCharacterIds
      );
      const bAccess = checkCharacterAccess(
        bId,
        subscriptionTier,
        userConversations,
        userCreatedCharacterIds
      );

      // Accessible characters first
      if (aAccess.hasAccess && !bAccess.hasAccess) return -1;
      if (!aAccess.hasAccess && bAccess.hasAccess) return 1;

      // Among accessible characters, prioritize by allowed order
      if (aAccess.hasAccess && bAccess.hasAccess) {
        const aIndex = aAccess.allowedCharacterIds.indexOf(aId);
        const bIndex = bAccess.allowedCharacterIds.indexOf(bId);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
      }
    }

    // Default sort by creation date
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex-1 flex flex-col h-full  overflow-y-auto dark-scrollbar">
      {/* Header */}
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          {/* Welcome Message */}
          <div className="flex flex-col md:flex-row justify-between items-center mt-4">
            <p className="text-4xl text-gray-100 text-center">
              Welcome back, {user?.username}
            </p>
            {/* Create Character Button */}
            <button
              onClick={handleCreateCharacter}
              className="w-full font-semibold cursor-pointer md:w-auto my-8 md:my-0 bg-transparent from-transparent to-transparent border border-zinc-600 hover:bg-gradient-to-bl hover:from-zinc-700 hover:to-zinc-600 hover:scale-102 py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
            >
              <FiPlus size={20} /> Create New Character
            </button>
          </div>

          {/* Subscription Status */}
          {!isLoadingSubscription &&
            subscriptionTier === "free" &&
            characters.length >= 3 && (
              <div className="bg-gradient-to-bl from-cyan-800 via-cyan-900/50 to-cyan-700 px-[1px] py-[1px] rounded-lg">
                <div className="bg-zinc-900 rounded-lg">
                  <div className="flex flex-col md:flex-row md:justify-between p-4 rounded-lg bg-gradient-to-tr from-cyan-700/30 via-cyan-900/20 to-cyan-900/40 text-sky-200/80">
                    <div className="flex flex-col mb-4 md:mb-0 gap-2">
                      <p className="text-2xl leading-[1.25rem] text-zinc-100">
                        You've reached the character limit for free accounts
                      </p>
                      <p className="text-md">
                        Want to chat with more characters? Upgrade to create
                        more
                      </p>
                    </div>
                    <Link
                      to="/plans"
                      className="text-white bg-gradient-to-bl from-cyan-800 to-cyan-900 my-auto hover:opacity-95 px-4 py-2 rounded-lg inline-block"
                    >
                      Upgrade to Pro
                    </Link>
                  </div>
                </div>
              </div>
            )}

          {/* Your Characters Section */}
          {showSkeletons ? (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="contents animate-fadeIn">
                  {renderSkeletonCards(6)}
                </div>
              </div>
            </div>
          ) : characters.length > 0 ? (
            <div
              className={`mb-8 transition-opacity duration-300 ${
                isContentVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedCharacters.map((character) => {
                  const characterId = String(character.id);
                  const accessResult = checkCharacterAccess(
                    characterId,
                    subscriptionTier,
                    userConversations,
                    userCreatedCharacterIds
                  );

                  return (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      showPublicStatus={
                        character.UserId?.toString() === user?.id
                      }
                      isFreeTier={subscriptionTier === "free"}
                      isLocked={accessResult.isLocked}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className={`flex-1 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ${
                isContentVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-gray-300 text-center text-xl">
                You don't have any characters yet
              </p>
              <p className="text-gray-300 text-center text-xl">
                Create one to get started or explore public characters
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateCharacter}
                  className="bg-blue-700 hover:bg-blue-600 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <FiPlus size={20} /> Create Character
                </button>
                <Link
                  to="/explore"
                  className="border border-zinc-700 hover:bg-zinc-700 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  Explore
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
