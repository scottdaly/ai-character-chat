// src/api/messages.ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCredit } from "../contexts/CreditContext";
import { Message, MessageAttachment, ConversationTree } from "../types";
import { useConversations } from "./conversations";
import { UserConversationWithCharacter } from "./useUserConversations";
import { checkCharacterAccess } from "./characterAccess";

export interface MessageResponse {
  messages: Message[];
  conversation?: {
    id: string;
    title: string;
    lastMessage: string;
    updatedAt: string;
  };
  creditsUsed?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
  processingTime?: number;
}

interface CreditError {
  error: string;
  creditsNeeded?: number;
  currentBalance?: number;
  estimatedCost?: number;
  subscriptionTier?: string;
}

// Define proper type for conversation data update
interface ConversationUpdateData {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

export const useMessages = (
  characterId: string,
  conversationId: string,
  subscriptionStatus: { tier: string } | null,
  userConversations: UserConversationWithCharacter[],
  isLoadingUserConversations: boolean,
  onConversationUpdate?: () => void,
  onConversationDataUpdate?: (conversationData: ConversationUpdateData) => void
) => {
  const { apiFetch, user } = useAuth();
  const {
    checkSufficientCredits,
    recordCreditUsage,
    clearError: clearCreditError,
  } = useCredit();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTree, setConversationTree] =
    useState<ConversationTree | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createConversation } = useConversations(characterId);
  const [realConversationId, setRealConversationId] = useState<string | null>(
    null
  );
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [accessError, setAccessError] = useState<Error | null>(null);

  // Credit-related state
  const [lastCreditUsage, setLastCreditUsage] = useState<{
    creditsUsed: number;
    tokenUsage?: { inputTokens: number; outputTokens: number };
  } | null>(null);
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);

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
    async (convId: string): Promise<void> => {
      if (isAccessDenied) {
        setMessages([]);
        setConversationTree(null);
        return;
      }
      try {
        const data = await apiFetch<ConversationTree | { messages: Message[] }>(
          `/api/conversations/${convId}/messages`
        );

        // Handle both tree structure and legacy linear messages with proper type guards
        if (
          data &&
          typeof data === "object" &&
          "tree" in data &&
          "currentPath" in data
        ) {
          // New tree structure
          const treeData = data as ConversationTree;
          setConversationTree(treeData);
          setMessages(treeData.currentPath);
        } else if (data && typeof data === "object" && "messages" in data) {
          // Legacy linear messages
          const legacyData = data as { messages: Message[] };
          setMessages(legacyData.messages);
          setConversationTree(null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
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

  // Estimate credit cost for a message
  const estimateMessageCost = useCallback(
    (content: string, attachments?: MessageAttachment[]) => {
      // Simple estimation: ~4 chars per token, plus attachment overhead
      const contentTokens = Math.ceil(content.length / 4);
      const attachmentTokens = attachments ? attachments.length * 1000 : 0; // 1000 tokens per image
      const estimatedInputTokens = contentTokens + attachmentTokens;
      const estimatedOutputTokens = Math.min(estimatedInputTokens * 0.5, 1000); // Conservative estimate

      // Rough cost estimation (this should match backend logic)
      // Using average pricing across models: ~$0.001 per 1000 tokens
      const estimatedCostUsd =
        ((estimatedInputTokens + estimatedOutputTokens) / 1000) * 0.001;
      const estimatedCredits = estimatedCostUsd / 0.001; // Convert to credits (1 credit = $0.001)

      return {
        estimatedCredits: Math.ceil(estimatedCredits * 1.2), // Add 20% buffer
        estimatedInputTokens,
        estimatedOutputTokens,
      };
    },
    []
  );

  const sendMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ): Promise<MessageResponse> => {
    if (isAccessDenied) {
      throw (
        accessError || new Error("Access Denied: Upgrade to send messages.")
      );
    }

    // Credit system integration - pre-flight check
    const costEstimate = estimateMessageCost(content, attachments);

    try {
      setIsCheckingCredits(true);
      clearCreditError();

      // Check if user has sufficient credits
      const hasSufficientCredits = await checkSufficientCredits(
        costEstimate.estimatedCredits
      );
      if (!hasSufficientCredits) {
        const creditError: CreditError = {
          error: "Insufficient credits",
          creditsNeeded: costEstimate.estimatedCredits,
          estimatedCost: costEstimate.estimatedCredits,
        };
        throw creditError;
      }
    } catch (err) {
      // Re-throw credit errors with additional context
      if (typeof err === "object" && err !== null && "error" in err) {
        const creditError = err as CreditError;
        creditError.estimatedCost = costEstimate.estimatedCredits;
        throw creditError;
      }
      throw err;
    } finally {
      setIsCheckingCredits(false);
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

        const data = await apiFetch<MessageResponse>(
          `/api/conversations/${newConversation.id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ content, attachments }),
          }
        );

        // Handle response and credit tracking
        if (data.creditsUsed !== undefined) {
          recordCreditUsage(data.creditsUsed);
          setLastCreditUsage({
            creditsUsed: data.creditsUsed,
            tokenUsage: data.tokenUsage,
          });
        }

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

      const data = await apiFetch<MessageResponse>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content, attachments }),
        }
      );

      // Handle credit tracking
      if (data.creditsUsed !== undefined) {
        recordCreditUsage(data.creditsUsed);
        setLastCreditUsage({
          creditsUsed: data.creditsUsed,
          tokenUsage: data.tokenUsage,
        });
      }

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

      return data;
    } catch (err) {
      console.error("Message error:", err);

      // Handle credit-specific errors
      if (typeof err === "object" && err !== null && "error" in err) {
        const creditError = err as CreditError;
        if (creditError.error === "Insufficient credits") {
          // This will be handled by the calling component
          throw creditError;
        }
      }

      // Handle other API errors
      if (err instanceof Error) {
        if (err.message.includes("402")) {
          // Parse credit error from API response
          try {
            const errorMessage = err.message.split("402: ")[1];
            if (errorMessage) {
              const errorData = JSON.parse(errorMessage);
              throw {
                error: "Insufficient credits",
                creditsNeeded: errorData.creditsNeeded,
                currentBalance: errorData.currentBalance,
                estimatedCost: errorData.estimatedCost,
                subscriptionTier: errorData.subscriptionTier,
              } as CreditError;
            }
          } catch (parseError) {
            throw {
              error: "Insufficient credits",
              estimatedCost: costEstimate.estimatedCredits,
            } as CreditError;
          }
        }
        throw new Error(err.message || "Failed to send message");
      }

      throw new Error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const switchBranch = async (messageId: string): Promise<ConversationTree> => {
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
      setError(err instanceof Error ? err.message : "Failed to switch branch");
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

  // Streaming message function using Server-Sent Events with credit integration
  const sendMessageStream = async (
    content: string,
    attachments?: MessageAttachment[]
  ): Promise<{
    success: boolean;
    creditUsage?: {
      creditsUsed: number;
      tokenUsage?: { inputTokens: number; outputTokens: number };
    } | null;
  }> => {
    if (isAccessDenied) {
      throw (
        accessError || new Error("Access Denied: Upgrade to send messages.")
      );
    }

    // Credit system integration - pre-flight check
    const costEstimate = estimateMessageCost(content, attachments);

    try {
      setIsCheckingCredits(true);
      clearCreditError();

      // Check if user has sufficient credits
      const hasSufficientCredits = await checkSufficientCredits(
        costEstimate.estimatedCredits
      );
      if (!hasSufficientCredits) {
        const creditError: CreditError = {
          error: "Insufficient credits",
          creditsNeeded: costEstimate.estimatedCredits,
          estimatedCost: costEstimate.estimatedCredits,
        };
        throw creditError;
      }
    } catch (err) {
      // Re-throw credit errors with additional context
      if (typeof err === "object" && err !== null && "error" in err) {
        const creditError = err as CreditError;
        creditError.estimatedCost = costEstimate.estimatedCredits;
        throw creditError;
      }
      throw err;
    } finally {
      setIsCheckingCredits(false);
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
              // Handle credit errors from streaming endpoint
              if (response.status === 402) {
                try {
                  const errorData = await response.json();
                  const creditError: CreditError = {
                    error: "Insufficient credits",
                    creditsNeeded: errorData.creditsNeeded,
                    currentBalance: errorData.currentBalance,
                    estimatedCost:
                      errorData.estimatedCost || costEstimate.estimatedCredits,
                    subscriptionTier: errorData.subscriptionTier,
                  };
                  throw creditError;
                } catch (parseError) {
                  throw {
                    error: "Insufficient credits",
                    estimatedCost: costEstimate.estimatedCredits,
                  } as CreditError;
                }
              }

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
            let conversationUpdate: ConversationUpdateData | null = null;
            let creditUsageInfo: {
              creditsUsed: number;
              tokenUsage?: { inputTokens: number; outputTokens: number };
            } | null = null;
            let updateTimeoutRef: NodeJS.Timeout | null = null;

            // Stream processing function
            const processStream = async (): Promise<void> => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split("\n");

                  for (const line of lines) {
                    if (line.startsWith("data: ")) {
                      try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === "delta" && data.content) {
                          streamingContent += data.content;

                          // Debounced UI update for better performance
                          if (updateTimeoutRef) {
                            clearTimeout(updateTimeoutRef);
                          }

                          updateTimeoutRef = setTimeout(() => {
                            setMessages((prevMessages) => {
                              const updatedMessages = [...prevMessages];
                              const assistantIndex = updatedMessages.findIndex(
                                (msg) => msg.id === tempAssistantMessage.id
                              );

                              if (assistantIndex !== -1) {
                                updatedMessages[assistantIndex] = {
                                  ...updatedMessages[assistantIndex],
                                  content: streamingContent,
                                };
                              }

                              return updatedMessages;
                            });
                          }, 50); // 50ms debounce
                        } else if (data.type === "complete") {
                          // Final message received
                          finalMessage = data.message;
                          conversationUpdate = data.conversation;
                        } else if (data.type === "creditUsage") {
                          // Credit usage information
                          creditUsageInfo = {
                            creditsUsed: data.creditsUsed,
                            tokenUsage: data.tokenUsage,
                          };
                        } else if (data.type === "error") {
                          throw new Error(data.error);
                        }
                      } catch (parseError) {
                        console.warn("Failed to parse SSE data:", parseError);
                      }
                    }
                  }
                }

                // Process credit usage
                if (creditUsageInfo) {
                  recordCreditUsage(creditUsageInfo.creditsUsed);
                  setLastCreditUsage(creditUsageInfo);
                }

                // Final UI update
                if (finalMessage) {
                  setMessages((prevMessages) => {
                    const updatedMessages = prevMessages.filter(
                      (msg) =>
                        msg.id !== tempUserMessage.id &&
                        msg.id !== tempAssistantMessage.id
                    );

                    // Add the real messages from the server
                    return [
                      ...updatedMessages,
                      tempUserMessage,
                      finalMessage as Message,
                    ];
                  });

                  // Update conversation if we have data
                  if (conversationUpdate) {
                    if (onConversationDataUpdate) {
                      onConversationDataUpdate(conversationUpdate);
                    } else if (onConversationUpdate) {
                      onConversationUpdate();
                    }
                  }
                }

                resolve({ success: true, creditUsage: creditUsageInfo });
              } catch (streamError) {
                console.error("Stream processing error:", streamError);

                // Remove temporary messages on error
                setMessages((prevMessages) =>
                  prevMessages.filter(
                    (msg) =>
                      msg.id !== tempUserMessage.id &&
                      msg.id !== tempAssistantMessage.id
                  )
                );

                reject(streamError);
              } finally {
                if (updateTimeoutRef) {
                  clearTimeout(updateTimeoutRef);
                }
              }
            };

            await processStream();
          })
          .catch((fetchError) => {
            console.error("Fetch error:", fetchError);

            // Remove temporary messages on error
            setMessages((prevMessages) =>
              prevMessages.filter(
                (msg) =>
                  msg.id !== tempUserMessage.id &&
                  msg.id !== tempAssistantMessage.id
              )
            );

            reject(fetchError);
          });
      });
    } catch (err) {
      console.error("Stream setup error:", err);

      // Handle credit-specific errors
      if (typeof err === "object" && err !== null && "error" in err) {
        const creditError = err as CreditError;
        if (creditError.error === "Insufficient credits") {
          throw creditError;
        }
      }

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
    // Credit-related exports
    lastCreditUsage,
    isCheckingCredits,
    estimateMessageCost,
  };
};
