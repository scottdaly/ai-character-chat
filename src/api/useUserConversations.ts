import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Conversation, Character } from "../types";

interface ConversationWithCharacter extends Conversation {
  Character: Pick<Character, "id" | "name" | "model">;
  CharacterId: string; // Normalize to string to match server
}

export interface UserConversationWithCharacter
  extends ConversationWithCharacter {
  characterId: string; // Add this for frontend compatibility
}

export function useUserConversations() {
  const { apiFetch, user } = useAuth();
  const [conversations, setConversations] = useState<
    UserConversationWithCharacter[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/conversations");
      // Normalize the data structure to match what the frontend expects
      const normalizedData = Array.isArray(data)
        ? data.map((conv: any) => ({
            ...conv,
            characterId:
              conv.CharacterId?.toString() ||
              conv.Character?.id?.toString() ||
              conv.characterId,
            CharacterId:
              conv.CharacterId?.toString() ||
              conv.Character?.id?.toString() ||
              conv.characterId,
          }))
        : [];
      setConversations(normalizedData);
    } catch (err) {
      console.error("Failed to fetch user conversations:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch conversations")
      );
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Helper function to get the most recent 3 character IDs in server order
  const getMostRecentCharacterIds = useCallback(
    (limit: number = 3): string[] => {
      // Sort by createdAt DESC (most recent first), then get unique character IDs
      const sortedConversations = [...conversations].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const uniqueCharacterIds = [
        ...new Set(sortedConversations.map((conv) => conv.characterId)),
      ];

      return uniqueCharacterIds.slice(0, limit);
    },
    [conversations]
  );

  return {
    conversations,
    isLoading,
    error,
    refetchConversations: fetchConversations,
    getMostRecentCharacterIds,
  };
}
