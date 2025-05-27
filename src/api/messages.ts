// src/api/messages.ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Message, MessageAttachment, ConversationTree } from "../types";
import { useConversations } from "./conversations";
import { UserConversationWithCharacter } from "./useUserConversations";
import { checkCharacterAccess } from "./characterAccess";

export const useMessages = (
  characterId: string,
  conversationId: string,
  subscriptionStatus: { tier: string } | null,
  userConversations: UserConversationWithCharacter[],
  isLoadingUserConversations: boolean,
  onConversationUpdate?: () => void
) => {
  const { apiFetch, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTree, setConversationTree] =
    useState<ConversationTree | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { createConversation } = useConversations(characterId);
  const [realConversationId, setRealConversationId] = useState<string | null>(
    null
  );
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [accessError, setAccessError] = useState<Error | null>(null);

  // Validation Effect
  useEffect(() => {
    if (!subscriptionStatus || !user || isLoadingUserConversations) {
      return;
    }

    // Use centralized character access logic
    const accessResult = checkCharacterAccess(
      characterId,
      subscriptionStatus.tier,
      userConversations
    );

    if (!accessResult.hasAccess) {
      setIsAccessDenied(true);
      setAccessError(new Error(accessResult.reason || "Access denied"));
      setMessages([]);
      return;
    }

    setIsAccessDenied(false);
    setAccessError(null);
  }, [
    characterId,
    conversationId,
    subscriptionStatus,
    userConversations,
    user,
    isLoadingUserConversations,
  ]);

  // First, handle realConversationId updates
  useEffect(() => {
    if (
      !conversationId.startsWith("temp-") &&
      realConversationId !== conversationId
    ) {
      setRealConversationId(conversationId);
    }
  }, [conversationId]);

  const loadMessages = useCallback(
    async (convId: string) => {
      if (isAccessDenied) {
        setMessages([]);
        setConversationTree(null);
        return;
      }
      try {
        const data = await apiFetch<ConversationTree | { messages: Message[] }>(
          `/api/conversations/${convId}/messages`
        );

        // Handle both tree structure and legacy linear messages
        if ("tree" in data && "currentPath" in data) {
          // New tree structure
          const treeData = data as ConversationTree;
          setConversationTree(treeData);
          setMessages(treeData.currentPath);
        } else {
          // Legacy linear messages
          setMessages((data as { messages: Message[] }).messages);
          setConversationTree(null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to load messages")
        );
      }
    },
    [apiFetch, isAccessDenied]
  );

  // Then handle message loading
  useEffect(() => {
    if (conversationId.startsWith("temp-")) {
      setMessages([]);
      return;
    }

    if (!isLoading) {
      setIsLoading(true);
      loadMessages(conversationId).finally(() => {
        setIsLoading(false);
      });
    }
  }, [conversationId, loadMessages]);

  const wrappedLoadMessages = useCallback(() => {
    if (isLoading) {
      return;
    }
    return loadMessages(conversationId);
  }, [conversationId, loadMessages, isLoading]);

  const sendMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    if (isAccessDenied) {
      throw (
        accessError || new Error("Access Denied: Upgrade to send messages.")
      );
    }
    try {
      setIsLoading(true);
      setError(null);

      // Create the user message object
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        role: "user",
        createdAt: new Date(),
        ConversationId: conversationId,
        CharacterId: characterId,
        UserId: "temp",
        attachments,
      };

      // For new conversations, always create a new one
      if (conversationId.startsWith("temp-")) {
        // Show user message immediately
        setMessages([userMessage]);

        const newConversation = await createConversation();
        setRealConversationId(newConversation.id);

        const data = await apiFetch<Message[]>(
          `/api/conversations/${newConversation.id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ content, attachments }),
          }
        );

        // Handle both array response (new messages) and reload from server
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          // Reload messages to get the updated tree structure
          await loadMessages(newConversation.id);
        }

        // Notify parent component to refresh conversation list
        // This is especially important for title updates after first message
        // Add a small delay to ensure server has updated the title
        if (onConversationUpdate) {
          setTimeout(() => {
            onConversationUpdate();
          }, 500);
        }

        return data;
      }

      // For existing conversations, just send the message
      // Show user message immediately
      setMessages((prevMessages) => [...prevMessages, userMessage]);

      const data = await apiFetch<Message[]>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content, attachments }),
        }
      );

      // Handle both array response (new messages) and reload from server
      if (Array.isArray(data)) {
        // Replace the temporary message with the real messages
        setMessages((prevMessages) => {
          // Remove the temporary message
          const withoutTemp = prevMessages.filter(
            (msg) => msg.id !== userMessage.id
          );
          // Add the new messages
          return [...withoutTemp, ...data];
        });
      } else {
        // Reload messages to get the updated tree structure
        await loadMessages(conversationId);
      }

      // Also notify for existing conversations in case title was updated
      if (onConversationUpdate) {
        setTimeout(() => {
          onConversationUpdate();
        }, 500);
      }

      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchBranch = async (messageId: string) => {
    try {
      setIsLoading(true);
      const data = await apiFetch<ConversationTree>(
        `/api/conversations/${conversationId}/switch-branch/${messageId}`,
        {
          method: "PUT",
        }
      );

      setConversationTree(data);
      setMessages(data.currentPath);

      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to switch branch")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    conversationTree,
    sendMessage,
    switchBranch,
    isLoading,
    error,
    isNewConversation: conversationId.startsWith("temp-"),
    realConversationId,
    loadMessages: wrappedLoadMessages,
    isAccessDenied,
    accessError,
  };
};
