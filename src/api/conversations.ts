// api/conversations.ts
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useState, useEffect, useCallback } from "react";
import { Conversation } from "../types";

export const useConversations = (characterId: string) => {
  const { apiFetch } = useAuth();
  const { invalidateUserCharacters } = useData();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch<Conversation[]>(
        `/api/characters/${characterId}/conversations`
      );
      setConversations(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load conversations")
      );
    } finally {
      setIsLoading(false);
    }
  }, [characterId, apiFetch]);

  // Function to update a single conversation in the list
  const updateConversation = useCallback(
    (updatedConversation: Partial<Conversation> & { id: string }) => {
      setConversations((prevConversations) => {
        const index = prevConversations.findIndex(
          (conv) => conv.id === updatedConversation.id
        );
        if (index !== -1) {
          const newConversations = [...prevConversations];
          newConversations[index] = {
            ...newConversations[index],
            ...updatedConversation,
          };
          return newConversations;
        }
        return prevConversations;
      });
    },
    []
  );

  const createConversation = async () => {
    try {
      console.log(
        "[useConversations] Creating new conversation for character:",
        characterId
      );
      const newConversation = await apiFetch<Conversation>(
        `/api/characters/${characterId}/conversations`,
        {
          method: "POST",
        }
      );
      setConversations((prev) => [newConversation, ...prev]);

      // Invalidate user characters cache so Dashboard will refresh and show this character
      console.log(
        "[useConversations] Invalidating user characters cache after conversation creation"
      );
      invalidateUserCharacters();

      return newConversation;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to create conversation")
      );
      throw err;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await apiFetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to delete conversation")
      );
      throw err;
    }
  };

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    createConversation,
    deleteConversation,
    loadConversations,
    updateConversation,
    isLoading,
    error,
  };
};

export const useConversation = (conversationId: string) => {
  const { apiFetch } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConversation = useCallback(async () => {
    if (!conversationId || conversationId.startsWith("temp-")) {
      setConversation(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiFetch<Conversation>(
        `/api/conversations/${conversationId}`
      );
      setConversation(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load conversation")
      );
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, apiFetch]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  return { conversation, isLoading, error, loadConversation };
};
