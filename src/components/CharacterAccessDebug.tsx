import { useAuth } from "../contexts/AuthContext";
import { useUserConversations } from "../api/useUserConversations";
import { useCharacters } from "../api/characters";
import { checkCharacterAccess } from "../api/characterAccess";
import { useState, useEffect } from "react";

export default function CharacterAccessDebug() {
  const { user, apiFetch } = useAuth();
  const {
    conversations: userConversations,
    isLoading: isLoadingConversations,
  } = useUserConversations();
  const { characters, isLoading: isLoadingCharacters } = useCharacters();
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    tier: string;
  }>({ tier: "free" });

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const status = await apiFetch("/api/subscription-status");
        setSubscriptionStatus(status);
      } catch (error) {
        console.error("Failed to fetch subscription status:", error);
      }
    };

    if (user) {
      fetchSubscriptionStatus();
    }
  }, [apiFetch, user]);

  if (isLoadingConversations || isLoadingCharacters) {
    return <div>Loading...</div>;
  }

  const userCreatedCharacterIds = characters
    .filter((char) => char.UserId?.toString() === user?.id)
    .map((char) => String(char.id));

  return (
    <div className="p-4 bg-zinc-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Character Access Debug</h3>

      <div className="mb-4">
        <p>
          <strong>Subscription Tier:</strong> {subscriptionStatus.tier}
        </p>
        <p>
          <strong>Total Characters:</strong> {characters.length}
        </p>
        <p>
          <strong>User Conversations:</strong> {userConversations.length}
        </p>
        <p>
          <strong>User Created Characters:</strong>{" "}
          {userCreatedCharacterIds.length}
        </p>
      </div>

      <div className="mb-4">
        <h4 className="font-semibold mb-2">
          Conversation History (by recency):
        </h4>
        {userConversations
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .map((conv, index) => (
            <div key={conv.id} className="text-sm">
              {index + 1}. Character {conv.characterId} -{" "}
              {new Date(conv.createdAt).toLocaleDateString()}
            </div>
          ))}
      </div>

      <div>
        <h4 className="font-semibold mb-2">Character Access Status:</h4>
        {characters.map((character) => {
          const characterId = String(character.id);
          const accessResult = checkCharacterAccess(
            characterId,
            subscriptionStatus.tier,
            userConversations,
            userCreatedCharacterIds
          );

          return (
            <div
              key={character.id}
              className="text-sm mb-2 p-2 border border-zinc-600 rounded"
            >
              <div>
                <strong>{character.name}</strong> (ID: {characterId})
              </div>
              <div>
                Access: {accessResult.hasAccess ? "✅ Allowed" : "❌ Locked"}
              </div>
              <div>
                Created by user:{" "}
                {userCreatedCharacterIds.includes(characterId) ? "Yes" : "No"}
              </div>
              {accessResult.reason && (
                <div className="text-red-400">
                  Reason: {accessResult.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
