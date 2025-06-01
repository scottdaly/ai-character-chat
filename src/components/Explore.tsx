import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CharacterCard, { CharacterCardSkeleton } from "./CharacterCard";
import ControlledCarousel from "./ControlledCarousel";
import { Character } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import Navbar from "./Navbar";

export default function Explore() {
  const { user, login, subscriptionTier, isLoadingSubscription } = useAuth();
  const { exploreCharacters, loadExploreCharacters, userCharacters } =
    useData();
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(
    exploreCharacters.data.length > 0
  );
  const navigate = useNavigate();

  // Extract data from cached structure
  const characters = exploreCharacters.data;
  const isLoading = exploreCharacters.isLoading;
  const userCharactersList = userCharacters.data;
  const isLoadingUserCharacters = userCharacters.isLoading;

  // Load explore characters when component mounts (will use cache if available)
  useEffect(() => {
    loadExploreCharacters();
  }, [loadExploreCharacters]);

  // Handle loading states with smooth transitions
  useEffect(() => {
    if (isLoading) {
      setIsContentVisible(false);

      // Show skeletons after 200ms if still loading
      const skeletonTimer = setTimeout(() => {
        if (isLoading) {
          setShowSkeletons(true);
        }
      }, 200);

      return () => clearTimeout(skeletonTimer);
    } else {
      // Check if we have cached data - if so, show immediately
      const hasCachedData = characters.length > 0;

      if (hasCachedData && !showSkeletons) {
        // Data is cached and we never showed skeletons - show immediately
        setIsContentVisible(true);
        setShowSkeletons(false);
      } else {
        // Loading finished after showing skeletons
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
    }
  }, [isLoading, showSkeletons]);

  // Separate effect to handle visibility when data changes
  useEffect(() => {
    // If we have data and we're not loading, show content immediately
    if (characters.length > 0 && !isLoading) {
      setIsContentVisible(true);
    }
  }, [characters.length, isLoading]);

  // Separate official and public characters
  const officialCharacters = characters.filter((char) => char.User?.isOfficial);
  const publicCharacters = characters.filter((char) => !char.User?.isOfficial);

  const handleCharacterClick = (character: Character) => {
    if (!user) {
      login();
      return;
    }

    if (
      !isLoadingSubscription &&
      !isLoadingUserCharacters &&
      subscriptionTier === "free" &&
      userCharactersList.length >= 3 &&
      !userCharactersList.some((uc) => uc.id === character.id)
    ) {
      navigate("/plans");
    } else {
      const tempId = `temp-${Date.now()}`;
      navigate(`/dashboard/characters/${character.id}/conversations/${tempId}`);
    }
  };

  // Create skeleton loaders
  const renderSkeletonCards = (count: number) => {
    return Array.from({ length: count }, (_, index) => (
      <CharacterCardSkeleton key={`skeleton-${index}`} />
    ));
  };

  return (
    <div className="min-h-screen text-gray-100">
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      <main className="container mx-auto max-w-6xl px-4 py-8 overflow-y-auto scrollable-container">
        <h1 className="text-3xl font-bold mb-8">Explore Characters</h1>

        <div className="space-y-12">
          {/* Official Characters Section */}
          <section>
            {showSkeletons ? (
              // Show skeleton loaders with fade-in
              <div>
                <h2 className="text-2xl font-semibold mb-6">
                  Official Characters
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
                  {renderSkeletonCards(6)}
                </div>
              </div>
            ) : (
              // Show actual content with fade-in
              <div
                className={`transition-opacity duration-300 ${
                  isContentVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                <ControlledCarousel
                  title="Official Characters"
                  itemsPerView={{ mobile: 1, tablet: 2, desktop: 3 }}
                  gap="1rem"
                  className="mb-4"
                >
                  {officialCharacters.map((character) => (
                    <div
                      key={character.id}
                      onClick={() => handleCharacterClick(character)}
                      className="cursor-pointer"
                    >
                      <CharacterCard
                        character={character}
                        showMessageCount={true}
                      />
                    </div>
                  ))}
                </ControlledCarousel>
              </div>
            )}
          </section>

          {/* Public Characters Section */}
          {!showSkeletons && publicCharacters.length > 0 && (
            <section
              className={`transition-opacity duration-300 ${
                isContentVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <h2 className="text-2xl font-semibold mb-4">
                Community Characters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicCharacters.map((character) => (
                  <div
                    key={character.id}
                    onClick={() => handleCharacterClick(character)}
                    className="cursor-pointer"
                  >
                    <CharacterCard
                      character={character}
                      showMessageCount={true}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Show skeleton for community section while loading */}
          {showSkeletons && (
            <section className="animate-fadeIn">
              <h2 className="text-2xl font-semibold mb-4">
                Community Characters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderSkeletonCards(3)}
              </div>
            </section>
          )}

          {/* Show message if no characters found - only when not loading */}
          {!showSkeletons && !isLoading && characters.length === 0 && (
            <div
              className={`text-center text-gray-400 py-8 transition-opacity duration-300 ${
                isContentVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-xl mb-2">No characters found</p>
              <p>Sign in to create and share your own characters!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
