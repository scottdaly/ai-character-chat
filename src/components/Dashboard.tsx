import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiPlus, FiDollarSign, FiActivity } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useCredit } from "../contexts/CreditContext";
import CharacterCard, { CharacterCardSkeleton } from "./CharacterCard";
import Navbar from "./Navbar";
// CreditBalance only imported when needed for debug mode
import CreditBalance from "./CreditBalance";
import { useUserConversations } from "../api/useUserConversations";
import { checkCharacterAccess } from "../api/characterAccess";

export default function Dashboard() {
  const { user, subscriptionTier, isLoadingSubscription } = useAuth();
  const navigate = useNavigate();
  const { userCharacters, loadUserCharacters } = useData();
  const { usageStats, formatCredits } = useCredit();

  // Debug flag to show detailed credit analytics
  const showDebugStats = false; // Set to true to show credit usage statistics
  const {
    conversations: userConversations,
    isLoading: isLoadingConversations,
  } = useUserConversations();
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(
    userCharacters.data.length > 0
  );

  // Extract data from cached structure
  const characters = userCharacters.data;
  const isLoading = userCharacters.isLoading;
  const error = userCharacters.error;

  // Load characters when component mounts (will use cache if available)
  useEffect(() => {
    loadUserCharacters();
  }, [loadUserCharacters]);

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
      // Loading finished - handle based on whether we have data
      const hasCachedData = characters.length > 0;

      if (hasCachedData && !showSkeletons) {
        // Data is cached and we never showed skeletons - show immediately
        setIsContentVisible(true);
        setShowSkeletons(false);
      } else {
        // Loading finished - either with data or empty state
        const finishLoading = async () => {
          // If skeletons were shown, ensure minimum display time
          if (showSkeletons) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          setShowSkeletons(false);

          // Always show content when loading is done (even if empty)
          setTimeout(() => setIsContentVisible(true), 50);
        };

        finishLoading();
      }
    }
  }, [isLoading, isLoadingConversations, showSkeletons]);

  // Separate effect to handle visibility when data changes
  useEffect(() => {
    // If we're not loading, show content immediately (whether we have data or not)
    if (!isLoading && !isLoadingConversations) {
      setIsContentVisible(true);
    }
  }, [characters.length, isLoading, isLoadingConversations]);

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
    <div className="flex-1 flex flex-col h-full overflow-y-auto dark-scrollbar scrollable-container bg-white dark:bg-zinc-900">
      {/* Header */}
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      {/* Content */}
      <div className="flex-1 px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          {/* Welcome Message */}
          <div className="flex flex-col md:flex-row justify-between items-center mt-4">
            <p className="text-4xl text-zinc-800 dark:text-gray-100 text-center">
              Welcome back, {user?.username}
            </p>
            {/* Create Character Button */}
            <button
              onClick={handleCreateCharacter}
              className="w-full font-semibold cursor-pointer md:w-auto my-8 md:my-0 text-zinc-800 dark:text-white bg-transparent from-transparent to-transparent border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-gradient-to-bl dark:hover:from-zinc-700 dark:hover:to-zinc-600 hover:scale-102 py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
            >
              <FiPlus size={20} /> Create New Character
            </button>
          </div>

          {/* Credit Usage Dashboard - Debug Mode Only */}
          {showDebugStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Current Balance */}
              <div className="md:col-span-2">
                <CreditBalance
                  size="lg"
                  showRefresh={true}
                  className="h-full"
                />
              </div>

              {/* Usage Stats */}
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiActivity className="text-blue-500" size={20} />
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    Total Messages
                  </h3>
                </div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {usageStats?.totalRequests?.toLocaleString() || "0"}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatCredits(usageStats?.totalCreditsUsed || 0)} used
                </p>
              </div>

              {/* Cost Stats */}
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiDollarSign className="text-green-500" size={20} />
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    Total Cost
                  </h3>
                </div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                  ${(usageStats?.totalCostUsd || 0).toFixed(2)}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {(usageStats?.totalTokens || 0).toLocaleString()} tokens
                </p>
              </div>
            </div>
          )}

          {/* Subscription Status */}
          {!isLoadingSubscription &&
            subscriptionTier === "free" &&
            characters.length >= 3 && (
              <div className="bg-gradient-to-bl from-cyan-500 via-cyan-600/50 to-cyan-400 dark:from-cyan-800 dark:via-cyan-900/50 dark:to-cyan-700 p-[1px] rounded-lg">
                <div className="bg-white dark:bg-zinc-900 rounded-lg">
                  <div className="flex flex-col md:flex-row md:justify-between p-4 rounded-lg bg-gradient-to-tr from-cyan-400/20 via-cyan-100/10 to-cyan-100/20 dark:from-cyan-700/30 dark:via-cyan-900/20 dark:to-cyan-900/40 text-sky-900 dark:text-sky-200/80">
                    <div className="flex flex-col mb-4 md:mb-0 gap-2">
                      <p className="text-2xl leading-[1.25rem] text-zinc-800 dark:text-zinc-100">
                        You've reached the character limit for free accounts
                      </p>
                      <p className="text-md">
                        Want to chat with more characters? Upgrade to create
                        more
                      </p>
                    </div>
                    <Link
                      to="/plans"
                      className="text-white bg-gradient-to-bl from-cyan-600 to-cyan-700 dark:from-cyan-800 dark:to-cyan-900 my-auto hover:opacity-95 px-4 py-2 rounded-lg inline-block"
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
              className={`flex-1 flex flex-col items-center justify-center gap-3 transition-opacity duration-300 py-12 ${
                isContentVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex flex-col items-center justify-center">
                <p className="text-zinc-800 dark:text-gray-100 text-center text-3xl font-bold leading-[2rem]">
                  You don't have any characters yet
                </p>
                <p className="text-zinc-600 dark:text-gray-400 text-center text-lg mt-2 mb-6">
                  Click the button below to create your first one.
                </p>
                <button
                  onClick={handleCreateCharacter}
                  className="bg-gradient-to-bl from-zinc-700 to-zinc-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ease-in-out hover:scale-102"
                >
                  <FiPlus size={20} /> Create Your First Character
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
