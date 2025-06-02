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
  onConversationUpdate?: () => void,
  onConversationDataUpdate?: (conversationData: any) => void
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

        const data = await apiFetch<
          Message[] | { messages: Message[]; conversation?: any }
        >(`/api/conversations/${newConversation.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content, attachments }),
        });

        // Handle both array response (legacy) and new object response
        if (Array.isArray(data)) {
          setMessages(data);
        } else if (data && "messages" in data) {
          // New format with conversation data
          setMessages(data.messages);

          // If we have conversation data, trigger immediate conversation list update
          if (data.conversation) {
            if (onConversationDataUpdate) {
              onConversationDataUpdate(data.conversation);
            } else if (onConversationUpdate) {
              onConversationUpdate();
            }
          }
        } else {
          // Reload messages to get the updated tree structure
          await loadMessages(newConversation.id);
        }

        // Trigger conversation list update for title changes
        if (onConversationUpdate) {
          setTimeout(() => {
            onConversationUpdate();
          }, 100); // Reduced delay since we now have immediate updates
        }

        return data;
      }

      // For existing conversations, just send the message
      // Show user message immediately
      setMessages((prevMessages) => [...prevMessages, userMessage]);

      const data = await apiFetch<
        Message[] | { messages: Message[]; conversation?: any }
      >(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, attachments }),
      });

      // Handle both array response (legacy) and new object response
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
      } else if (data && "messages" in data) {
        // New format with conversation data
        setMessages((prevMessages) => {
          // Remove the temporary message
          const withoutTemp = prevMessages.filter(
            (msg) => msg.id !== userMessage.id
          );
          // Add the new messages
          return [...withoutTemp, ...data.messages];
        });

        // If we have conversation data, trigger immediate conversation list update
        if (data.conversation) {
          if (onConversationDataUpdate) {
            onConversationDataUpdate(data.conversation);
          } else if (onConversationUpdate) {
            onConversationUpdate();
          }
        }
      } else {
        // Reload messages to get the updated tree structure
        await loadMessages(conversationId);
      }

      // Also notify for existing conversations in case title was updated
      if (onConversationUpdate) {
        setTimeout(() => {
          onConversationUpdate();
        }, 100); // Reduced delay since we now have immediate updates
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

  // Function to allow optimistic updates to messages
  const updateMessages = useCallback(
    (updater: (messages: Message[]) => Message[]) => {
      setMessages(updater);
    },
    []
  );

  // Streaming message function using Server-Sent Events
  const sendMessageStream = async (
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

      // Create temporary user message for immediate display
      const tempUserMessage: Message = {
        id: `temp-user-${Date.now()}`,
        content,
        role: "user",
        createdAt: new Date(),
        ConversationId: conversationId,
        CharacterId: characterId,
        UserId: "temp",
        attachments,
      };

      // Create temporary assistant message for streaming
      const tempAssistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        content: "",
        role: "assistant",
        createdAt: new Date(),
        ConversationId: conversationId,
        CharacterId: characterId,
        UserId: "temp",
      };

      // For new conversations, create conversation first
      let targetConversationId = conversationId;
      if (conversationId.startsWith("temp-")) {
        const newConversation = await createConversation();

        setRealConversationId(newConversation.id);
        targetConversationId = newConversation.id;

        // Update message conversation IDs
        tempUserMessage.ConversationId = newConversation.id;
        tempAssistantMessage.ConversationId = newConversation.id;
      }

      // Add both messages to UI immediately
      setMessages((prevMessages) => {
        const newMessages = [
          ...prevMessages,
          tempUserMessage,
          tempAssistantMessage,
        ];

        return newMessages;
      });

      // Set up streaming with direct fetch (apiFetch doesn't support streaming)
      const streamUrl = `${
        import.meta.env.VITE_API_URL
      }/api/conversations/${targetConversationId}/messages/stream`;
      const token = localStorage.getItem("token");

      return new Promise((resolve, reject) => {
        const controller = new AbortController();

        fetch(streamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ content, attachments }),
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("No response body reader available");
            }

            const decoder = new TextDecoder();
            let streamingContent = "";
            let finalMessage: Message | null = null;
            let conversationUpdate: any = null;
            let updateTimeoutRef: NodeJS.Timeout | null = null;

            try {
              while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data.trim() === "") continue;

                    try {
                      const eventData = JSON.parse(data);

                      switch (eventData.type) {
                        case "userMessage":
                          // Replace temp user message with real one
                          setMessages((prevMessages) => {
                            return prevMessages.map((msg) =>
                              msg.id === tempUserMessage.id
                                ? { ...eventData.message }
                                : msg
                            );
                          });
                          break;

                        case "delta":
                          // Append content to streaming message with debounced updates
                          streamingContent += eventData.content;

                          // Use a debounced update for smoother performance
                          if (updateTimeoutRef) {
                            clearTimeout(updateTimeoutRef);
                          }

                          // Update more frequently for better responsiveness, but still batched
                          updateTimeoutRef = setTimeout(() => {
                            setMessages((prevMessages) => {
                              return prevMessages.map((msg) =>
                                msg.id === tempAssistantMessage.id
                                  ? { ...msg, content: streamingContent }
                                  : msg
                              );
                            });
                          }, 30); // Update every 30ms for smoother but still efficient updates
                          break;

                        case "complete":
                          // Clear any pending debounced update
                          if (updateTimeoutRef) {
                            clearTimeout(updateTimeoutRef);
                          }

                          // Replace temp assistant message with final one
                          finalMessage = eventData.message;
                          conversationUpdate = eventData.conversation;

                          setMessages((prevMessages) => {
                            return prevMessages.map((msg) =>
                              msg.id === tempAssistantMessage.id
                                ? { ...eventData.message }
                                : msg
                            );
                          });
                          break;

                        case "conversationUpdate":
                          // Handle conversation title updates
                          conversationUpdate = eventData.conversation;
                          if (onConversationDataUpdate) {
                            onConversationDataUpdate(eventData.conversation);
                          }
                          break;

                        case "error":
                          throw new Error(eventData.error);
                      }
                    } catch (parseError) {
                      console.error("Failed to parse SSE data:", parseError);
                    }
                  }
                }
              }

              // Trigger conversation list updates
              if (conversationUpdate) {
                if (onConversationDataUpdate) {
                  onConversationDataUpdate(conversationUpdate);
                } else if (onConversationUpdate) {
                  setTimeout(onConversationUpdate, 100);
                }
              }

              resolve({
                messages: finalMessage ? [finalMessage] : [],
                conversation: conversationUpdate,
              });
            } catch (streamError) {
              reader.releaseLock();
              throw streamError;
            }
          })
          .catch((error) => {
            console.error("💥 [STREAM] Stream error occurred:", error);
            // Remove temporary messages on error
            setMessages((prevMessages) => {
              return prevMessages.filter(
                (msg) =>
                  msg.id !== tempUserMessage.id &&
                  msg.id !== tempAssistantMessage.id
              );
            });

            reject(error);
          });
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    conversationTree,
    sendMessage,
    sendMessageStream,
    switchBranch,
    isLoading,
    error,
    isNewConversation: conversationId.startsWith("temp-"),
    realConversationId,
    loadMessages: wrappedLoadMessages,
    updateMessages,
    isAccessDenied,
    accessError,
  };
};
