import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CharacterCard, { CharacterCardSkeleton } from "./CharacterCard";
import { Character } from "../types";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "./Navbar";
import { useCharacters } from "../api/characters";

export default function Explore() {
  const { user, login, apiFetch, subscriptionTier, isLoadingSubscription } =
    useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const navigate = useNavigate();

  const { characters: userCharacters, isLoading: isLoadingUserCharacters } =
    useCharacters();

  useEffect(() => {
    const loadExploreCharacters = async () => {
      try {
        setIsLoading(true);
        setIsContentVisible(false);

        // Show skeletons after 200ms if still loading
        const skeletonTimer = setTimeout(() => {
          if (isLoading) {
            setShowSkeletons(true);
          }
        }, 200);

        const data = await apiFetch("/api/characters/explore");
        setCharacters(Array.isArray(data) ? data : []);

        clearTimeout(skeletonTimer);

        // If skeletons were shown, ensure minimum display time
        if (showSkeletons) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        setIsLoading(false);
        setShowSkeletons(false);

        // Fade in content
        setTimeout(() => setIsContentVisible(true), 50);
      } catch (error) {
        console.error("Failed to load characters:", error);
        setCharacters([]);
        setIsLoading(false);
        setShowSkeletons(false);
        setTimeout(() => setIsContentVisible(true), 50);
      }
    };

    loadExploreCharacters();
  }, [apiFetch]);

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
      userCharacters.length >= 3 &&
      !userCharacters.some((uc) => uc.id === character.id)
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
    <div className="min-h-screen bg-zinc-900 text-gray-100">
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      <main className="container mx-auto max-w-6xl px-4 py-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-8">Explore Characters</h1>

        <div className="space-y-12">
          {/* Official Characters Section */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {showSkeletons ? (
                // Show skeleton loaders with fade-in
                <div className="contents animate-fadeIn">
                  {renderSkeletonCards(6)}
                </div>
              ) : (
                // Show actual content with fade-in
                <div
                  className={`contents transition-opacity duration-300 ${
                    isContentVisible ? "opacity-100" : "opacity-0"
                  }`}
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
                </div>
              )}
            </div>
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
