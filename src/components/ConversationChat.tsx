import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiImage,
  FiX,
  FiCopy,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { AiFillEdit } from "react-icons/ai";
import { useAuth } from "../contexts/AuthContext";
import { useMessages } from "../api/messages";
import { useConversation } from "../api/conversations";
import { useConversations } from "../api/conversations";
import { useUserConversations } from "../api/useUserConversations";
import { useCharacter } from "../api/characters";
import { checkCharacterAccess } from "../api/characterAccess";
import { HiArrowSmRight } from "react-icons/hi";
import { MessageAttachment } from "../types";
import { supportsImages } from "../config/models";
import Toast from "./Toast";
import Tooltip from "./Tooltip";
import { IoRefresh } from "react-icons/io5";
import { MessageTreeNode } from "../types";
import MarkdownMessage from "./MarkdownMessage";

// Typing indicator component
const TypingIndicator = () => {
  return (
    <div className="flex flex-col items-start pb-4">
      <div className="max-w-2xl p-4 rounded-xl bg-zinc-800 text-zinc-100">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
      <span className="text-xs text-gray-400 mt-1 px-2">
        {new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
};

// Helper function to find the deepest child in a branch
const findDeepestChild = (node: MessageTreeNode): MessageTreeNode => {
  if (!node.children || node.children.length === 0) {
    return node;
  }
  // For branches, we want to follow the first child (the main conversation path)
  return findDeepestChild(node.children[0]);
};

// Inline branch selector component
const InlineBranchSelector = ({
  message,
  onSwitchBranch,
}: {
  message: MessageTreeNode;
  onSwitchBranch: (messageId: string) => void;
}) => {
  if (!message.children || message.children.length <= 1) {
    return null;
  }

  // Find current branch index
  const currentBranchIndex = message.children.findIndex(
    (child) => child.isOnCurrentPath
  );
  const totalBranches = message.children.length;

  const switchToPrevious = () => {
    if (currentBranchIndex > 0) {
      const prevIndex = currentBranchIndex - 1;
      const targetChild = message.children[prevIndex];
      const deepestChild = findDeepestChild(targetChild);
      onSwitchBranch(deepestChild.id);
    }
  };

  const switchToNext = () => {
    if (currentBranchIndex < totalBranches - 1) {
      const nextIndex = currentBranchIndex + 1;
      const targetChild = message.children[nextIndex];
      const deepestChild = findDeepestChild(targetChild);
      onSwitchBranch(deepestChild.id);
    }
  };

  const isFirstBranch = currentBranchIndex === 0;
  const isLastBranch = currentBranchIndex === totalBranches - 1;

  return (
    <div className="flex items-center gap-1">
      <Tooltip text="Previous branch" show={!isFirstBranch}>
        <button
          onClick={switchToPrevious}
          disabled={isFirstBranch}
          className={`p-1 rounded flex items-center transition-colors duration-300 ease-in-out ${
            isFirstBranch
              ? "text-zinc-500"
              : "text-zinc-200 hover:text-zinc-100 hover:bg-zinc-700/50 cursor-pointer"
          }`}
          aria-label="Previous branch"
        >
          <FiChevronLeft className="h-4 w-4" />
        </button>
      </Tooltip>

      <span className="text-xs text-zinc-200 min-w-[1rem] text-center">
        {currentBranchIndex + 1}/{totalBranches}
      </span>

      <Tooltip text="Next branch" show={!isLastBranch}>
        <button
          onClick={switchToNext}
          disabled={isLastBranch}
          className={`p-1 rounded flex items-center transition-colors duration-300 ease-in-out ${
            isLastBranch
              ? "text-zinc-500"
              : "text-zinc-200 hover:text-zinc-100 hover:bg-zinc-700/50 cursor-pointer"
          }`}
          aria-label="Next branch"
        >
          <FiChevronRight className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
};

export default function ConversationChat() {
  const { characterId, conversationId } = useParams();
  const navigate = useNavigate();
  const { apiFetch, subscriptionTier } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload state
  const [selectedImages, setSelectedImages] = useState<MessageAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Toast state for error handling
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Regenerate message state
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<
    string | null
  >(null);
  const [originalMessageContent, setOriginalMessageContent] =
    useState<string>("");

  const {
    conversations: userConversations,
    isLoading: isLoadingUserConversations,
  } = useUserConversations();

  // Get character data directly to access model information immediately
  const { character } = useCharacter(characterId!);

  // Get conversation refresh function to update sidebar when titles change
  const { loadConversations } = useConversations(characterId!);

  // Create a wrapper function to refresh conversation list
  const refreshConversationList = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  // Use centralized character access checking with auth context subscription tier
  const characterAccess =
    characterId && subscriptionTier && !isLoadingUserConversations
      ? checkCharacterAccess(characterId, subscriptionTier, userConversations)
      : null;

  const {
    messages,
    conversationTree,
    sendMessage,
    switchBranch,
    isLoading: messagesLoading,
    error: messagesError,
    isNewConversation,
    realConversationId,
    loadMessages,
    updateMessages,
    isAccessDenied,
    accessError,
  } = useMessages(
    characterId!,
    conversationId!,
    { tier: subscriptionTier }, // Use centralized subscription tier
    userConversations,
    isLoadingUserConversations,
    refreshConversationList // Pass the wrapper function to update sidebar
  );

  const { conversation } = useConversation(
    realConversationId || conversationId!
  );
  const [newMessage, setNewMessage] = useState("");

  // Check if current character's model supports images
  // Use character data directly if available, fallback to conversation data
  const characterModel = character?.model || conversation?.Character?.model;
  const currentModelSupportsImages = characterModel
    ? supportsImages(characterModel)
    : false;

  // Handle image file selection
  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: MessageAttachment[] = [];

    for (const file of Array.from(files)) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        console.error("Invalid file type:", file.type);
        setToast({
          message: `"${file.name}" is not a valid image file. Please select an image.`,
          type: "error",
        });
        continue;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        console.error("File too large:", file.size);
        setToast({
          message: `"${file.name}" is too large. Please select an image smaller than 5MB.`,
          type: "error",
        });
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newImages.push({
          type: "image",
          data: base64,
          mimeType: file.type,
          name: file.name,
        });
      } catch (error) {
        console.error("Failed to read file:", error);
        setToast({
          message: `Failed to read "${file.name}". Please try selecting the image again.`,
          type: "error",
        });
      }
    }

    setSelectedImages((prev) => [...prev, ...newImages]);
    setIsUploading(false);

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove selected image
  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Copy message to clipboard
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToast({
        message: "Message copied to clipboard",
        type: "success",
      });
    } catch (err) {
      console.error("Failed to copy message:", err);
      setToast({
        message: "Failed to copy message",
        type: "error",
      });
    }
  };

  // Regenerate assistant message with in-place replacement
  const handleRegenerateMessage = async (messageId: string) => {
    try {
      // Find the message to regenerate
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex === -1) return;

      // Only allow regenerating assistant messages
      const messageToRegenerate = messages[messageIndex];
      if (messageToRegenerate.role !== "assistant") {
        setToast({
          message: "Can only regenerate assistant messages",
          type: "error",
        });
        return;
      }

      // Prevent regenerating if already in progress
      if (regeneratingMessageId) {
        setToast({
          message: "Please wait for the current regeneration to complete",
          type: "error",
        });
        return;
      }

      // Validate conversation state
      const conversationIdToUse = realConversationId || conversationId;
      if (!conversationIdToUse || conversationIdToUse.startsWith("temp-")) {
        setToast({
          message: "Cannot regenerate messages in a new conversation",
          type: "error",
        });
        return;
      }

      // Start regeneration process
      setRegeneratingMessageId(messageId);
      setOriginalMessageContent(messageToRegenerate.content);

      // Optimistically update the UI to show regenerating state
      updateMessages((currentMessages) => {
        const updatedMessages = [...currentMessages];
        updatedMessages[messageIndex] = {
          ...messageToRegenerate,
          content: "Regenerating response...",
        };
        return updatedMessages;
      });

      // Call the API to regenerate the message
      const response = await apiFetch<{ content: string; message: any }>(
        `/api/conversations/${conversationIdToUse}/messages/${messageId}/regenerate`,
        {
          method: "POST",
        }
      );

      // Update the message with the new content
      updateMessages((currentMessages) => {
        const updatedMessages = [...currentMessages];
        const targetIndex = updatedMessages.findIndex(
          (msg) => msg.id === messageId
        );
        if (targetIndex !== -1) {
          updatedMessages[targetIndex] = {
            ...updatedMessages[targetIndex],
            content: response.content,
            createdAt: new Date(), // Update timestamp to reflect regeneration
          };
        }
        return updatedMessages;
      });

      // Show success feedback
      setToast({
        message: "Message regenerated successfully",
        type: "success",
      });
    } catch (err) {
      console.error("Failed to regenerate message:", err);

      // Restore original content on error
      if (originalMessageContent) {
        updateMessages((currentMessages) => {
          const updatedMessages = [...currentMessages];
          const targetIndex = updatedMessages.findIndex(
            (msg) => msg.id === messageId
          );
          if (targetIndex !== -1) {
            updatedMessages[targetIndex] = {
              ...updatedMessages[targetIndex],
              content: originalMessageContent,
            };
          }
          return updatedMessages;
        });
      }

      const errorMessage =
        err instanceof Error ? err.message : "Failed to regenerate message";

      // Provide more specific error messages
      let displayMessage = errorMessage;
      if (errorMessage.includes("safety policies")) {
        displayMessage =
          "The AI declined to regenerate due to safety policies. Please try editing your previous message.";
      } else if (errorMessage.includes("quota exceeded")) {
        displayMessage = "AI service quota exceeded. Please try again later.";
      } else if (
        errorMessage.includes("Network Error") ||
        errorMessage.includes("fetch")
      ) {
        displayMessage =
          "Connection error. Please check your internet connection and try again.";
      }

      setToast({
        message: displayMessage,
        type: "error",
      });
    } finally {
      // Clean up regeneration state
      setRegeneratingMessageId(null);
      setOriginalMessageContent("");
    }
  };

  // Start editing a message
  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  // Handle branch switching
  const handleSwitchBranch = async (messageId: string) => {
    try {
      await switchBranch(messageId);
    } catch (err) {
      console.error("Failed to switch branch:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to switch branch";
      setToast({
        message: errorMessage,
        type: "error",
      });
    }
  };

  // Helper function to find tree node for a message
  const findTreeNode = (
    messageId: string,
    nodes: MessageTreeNode[]
  ): MessageTreeNode | null => {
    for (const node of nodes) {
      if (node.id === messageId) {
        return node;
      }
      const found = findTreeNode(messageId, node.children);
      if (found) {
        return found;
      }
    }
    return null;
  };

  // Helper function to get branch selector for a user message
  const getBranchSelector = (messageId: string) => {
    if (!conversationTree?.tree) return null;

    try {
      const treeNode = findTreeNode(messageId, conversationTree.tree);
      if (!treeNode || treeNode.role !== "user") return null;

      // For user messages, only show siblings (alternative versions of this user message)
      let siblings: MessageTreeNode[] = [];
      if (treeNode.parentId === null) {
        // For root messages, siblings are other root messages with the same role
        siblings = conversationTree.tree.filter(
          (node) => node.parentId === null && node.role === "user"
        );
      } else if (treeNode.parentId) {
        // For non-root messages, find siblings through parent
        const parent = findTreeNode(treeNode.parentId, conversationTree.tree);
        siblings =
          parent?.children?.filter((child) => child.role === "user") || [];
      }

      const hasMultipleSiblings = siblings.length > 1;

      // Only show branch selector if there are multiple sibling user messages
      if (hasMultipleSiblings && treeNode) {
        // Create a virtual message node for sibling selection
        const virtualMessage: MessageTreeNode = {
          ...treeNode,
          children: siblings,
          isOnCurrentPath: treeNode.isOnCurrentPath || false,
        };
        return (
          <InlineBranchSelector
            message={virtualMessage}
            onSwitchBranch={handleSwitchBranch}
          />
        );
      }

      return null;
    } catch (err) {
      console.error("Error finding tree node:", err);
      return null;
    }
  };

  // Save edited message
  const handleSaveEdit = async (messageId: string) => {
    try {
      // Find the message to edit
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex === -1) return;

      const messageToEdit = messages[messageIndex];

      // Only allow editing user messages
      if (messageToEdit.role !== "user") {
        setToast({
          message: "Can only edit user messages",
          type: "error",
        });
        return;
      }

      // Check if content actually changed
      if (editingContent.trim() === messageToEdit.content.trim()) {
        setEditingMessageId(null);
        setEditingContent("");
        return;
      }

      // Validate content
      if (!editingContent.trim()) {
        setToast({
          message: "Message cannot be empty",
          type: "error",
        });
        return;
      }

      const conversationIdToUse = realConversationId || conversationId;
      if (!conversationIdToUse || conversationIdToUse.startsWith("temp-")) {
        setToast({
          message: "Cannot edit messages in a new conversation",
          type: "error",
        });
        return;
      }

      // Start edit loading state
      setIsEditLoading(true);

      // Step 1: Optimistically update the UI - close edit mode and show edited message
      updateMessages((currentMessages) => {
        const updatedMessages = [...currentMessages];
        updatedMessages[messageIndex] = {
          ...messageToEdit,
          content: editingContent.trim(),
        };

        // Step 2: Remove all messages after the edited one (they're from the old branch)
        return updatedMessages.slice(0, messageIndex + 1);
      });

      // Clear editing state to show the updated message
      setEditingMessageId(null);
      setEditingContent("");

      // Call the API to edit the message
      await apiFetch(
        `/api/conversations/${conversationIdToUse}/messages/${messageId}/edit`,
        {
          method: "PUT",
          body: JSON.stringify({ content: editingContent.trim() }),
        }
      );

      // Step 3: Reload messages to get the updated conversation tree with new AI response
      await loadMessages();
    } catch (err) {
      console.error("Failed to save edited message:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save edited message";

      // Restore original messages on error
      await loadMessages();

      setToast({
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsEditLoading(false);
    }
  };

  useEffect(() => {
    if (conversation) {
      document.title = `${conversation.title} - NeverMade`;
    } else if (isNewConversation) {
      document.title = "NeverMade - AI Chat";
    }
    return () => {
      document.title = "NeverMade - AI Chat";
    };
  }, [conversation, isNewConversation]);

  useEffect(() => {
    if (realConversationId && realConversationId !== conversationId) {
      navigate(
        `/dashboard/characters/${characterId}/conversations/${realConversationId}`,
        { replace: true }
      );
    }
  }, [realConversationId]);

  useEffect(() => {
    if (conversationId && !conversationId.startsWith("temp-")) {
      loadMessages();
    }
  }, [conversationId, loadMessages]);

  useEffect(() => {
    setNewMessage("");
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.style.height = "24px";
    }
  }, [conversationId]);

  const handleSend = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return;

    const messageContent = newMessage;
    const messageAttachments = [...selectedImages];
    setNewMessage("");
    setSelectedImages([]);

    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.style.height = "24px";
    }

    try {
      await sendMessage(messageContent, messageAttachments);
    } catch (err) {
      console.error("Failed to send message:", err);

      // Restore the message and attachments
      setNewMessage(messageContent);
      setSelectedImages(messageAttachments);

      // Show user-friendly error message
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";

      // Provide more specific error messages based on common error types
      let displayMessage = errorMessage;
      if (errorMessage.includes("safety policies")) {
        displayMessage =
          "The AI declined to respond due to safety policies. Please try rephrasing your message.";
      } else if (errorMessage.includes("copyright concerns")) {
        displayMessage =
          "The AI declined to respond due to potential copyright concerns. Please try a different approach.";
      } else if (errorMessage.includes("quota exceeded")) {
        displayMessage = "AI service quota exceeded. Please try again later.";
      } else if (errorMessage.includes("Upgrade to Pro")) {
        displayMessage = errorMessage; // Keep subscription-related messages as-is
      } else if (errorMessage.includes("Failed to get AI response")) {
        displayMessage =
          "The AI service is temporarily unavailable. Please try again in a moment.";
      } else if (
        errorMessage.includes("Network Error") ||
        errorMessage.includes("fetch")
      ) {
        displayMessage =
          "Connection error. Please check your internet connection and try again.";
      }

      setToast({
        message: displayMessage,
        type: "error",
      });
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, messagesLoading]);

  // Add keyboard shortcuts for branch navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not editing or typing
      if (
        editingMessageId ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT"
      ) {
        return;
      }

      // Alt + number keys to switch branches
      if (event.altKey && event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        const branchNumber = parseInt(event.key) - 1;

        // Find the last message with branches
        if (conversationTree && conversationTree.tree) {
          const findLastMessageWithBranches = (
            nodes: MessageTreeNode[]
          ): MessageTreeNode | null => {
            let lastWithBranches: MessageTreeNode | null = null;

            const traverse = (nodeList: MessageTreeNode[]) => {
              for (const node of nodeList) {
                if (node.children && node.children.length > 1) {
                  lastWithBranches = node;
                }
                traverse(node.children);
              }
            };

            traverse(nodes);
            return lastWithBranches;
          };

          const lastBranchedMessage = findLastMessageWithBranches(
            conversationTree.tree
          );
          if (
            lastBranchedMessage &&
            lastBranchedMessage.children[branchNumber]
          ) {
            handleSwitchBranch(lastBranchedMessage.children[branchNumber].id);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [conversationTree, editingMessageId, handleSwitchBranch]);

  if (!characterId || !conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Invalid character or conversation ID
      </div>
    );
  }

  // Don't show full-screen error for message errors - use toast instead
  useEffect(() => {
    if (messagesError && !accessError) {
      setToast({
        message: messagesError.message || "Failed to load messages",
        type: "error",
      });
    }
  }, [messagesError, accessError]);

  return (
    <div className="flex-1 flex flex-col h-full w-full justify-center items-center">
      {((isAccessDenied && accessError) ||
        (characterAccess && !characterAccess.hasAccess)) && (
        <div className="flex p-6 w-full">
          <div className="flex flex-row items-center justify-between p-6 border border-cyan-300/10 bg-gradient-to-r from-cyan-500/10 to-cyan-400/10 rounded-xl w-full">
            <div className="max-w-4xl flex items-start gap-4">
              <FiAlertTriangle size={32} className="text-cyan-100" />
              <div className="">
                <p className="font-semibold text-xl text-white">
                  {accessError?.message || characterAccess?.reason}
                </p>
                <p className="text-cyan-100/80 text-sm">
                  You can chat with your 3 most recent characters on the free
                  plan.{" "}
                  <span className="">
                    You can still view your conversation history, but to
                    continue chatting with this character, you'll need to
                    upgrade to Pro.
                  </span>
                </p>
              </div>
            </div>
            <Link
              to="/plans"
              className="inline-block mt-2 bg-zinc-100 hover:bg-white hover:scale-104 text-black font-medium px-4 py-2 rounded-lg transition-all duration-300 ease-in-out"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}

      <div
        id="messages-container"
        className="flex-1 p-4 space-y-4 w-full overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto flex flex-col h-full">
          {messages.length === 0 &&
            !messagesLoading &&
            !isAccessDenied &&
            (characterAccess === null || characterAccess.hasAccess) && (
              <div className="flex items-center justify-center h-full text-gray-400">
                {isNewConversation ? (
                  <p className="text-gray-400 text-center">
                    Type your first message to start the conversation
                  </p>
                ) : (
                  <p className="text-gray-400 text-center">
                    No messages in this conversation
                  </p>
                )}
              </div>
            )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`group flex flex-col ${
                message.role === "user" ? "items-end" : "items-start"
              } space-y-2`}
            >
              {/* Show attachments outside the message bubble */}
              {message.attachments && message.attachments.length > 0 && (
                <div
                  className={`flex flex-col space-y-2 ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {message.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="rounded-lg overflow-hidden max-w-sm"
                    >
                      {attachment.type === "image" && (
                        <img
                          src={attachment.data}
                          alt={attachment.name || "Uploaded image"}
                          className="w-full h-auto rounded-lg shadow-lg"
                          style={{ maxHeight: "300px", objectFit: "cover" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Message text bubble - only show if there's content */}
              {message.content && (
                <div
                  className={`relative max-w-2xl rounded-xl leading-relaxed peer ${
                    message.role === "user"
                      ? "px-4 py-3 bg-zinc-700/70 text-white"
                      : "text-zinc-100 pb-0.5"
                  }
                  ${
                    message.attachments &&
                    message.attachments.length > 0 &&
                    "rounded-tr-md"
                  }
                  `}
                >
                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit(message.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        className="w-full bg-zinc-800 text-white p-2 rounded border border-zinc-600 focus:border-zinc-500 focus:outline-none resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(message.id)}
                            disabled={
                              !editingContent.trim() ||
                              messagesLoading ||
                              isEditLoading
                            }
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                          >
                            {isEditLoading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={messagesLoading || isEditLoading}
                            className="px-3 py-1 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-500 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        <span className="text-xs text-zinc-400">
                          Enter to save • Esc to cancel
                        </span>
                      </div>
                    </div>
                  ) : message.role === "assistant" ? (
                    regeneratingMessageId === message.id ? (
                      <div className="flex items-center gap-3 text-blue-400 italic">
                        <IoRefresh className="h-4 w-4 animate-spin" />
                        <span>Regenerating response...</span>
                      </div>
                    ) : (
                      <MarkdownMessage content={message.content} />
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              )}

              <div className="flex flex-row justify-between w-full">
                {message.role === "assistant" ? (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out flex items-center justify-center flex-row gap-2 py-1 bg-zinc-700/50 border border-zinc-700 rounded-lg px-1">
                    <Tooltip text="Copy message" offsetSize="large">
                      <button
                        onClick={() => handleCopyMessage(message.content)}
                        className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 py-2 px-2 rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out group/copy"
                        aria-label="Copy message"
                      >
                        <FiCopy className="h-4 w-4 transition-transform duration-300 ease-in-out group-hover/copy:scale-110" />
                      </button>
                    </Tooltip>
                    <Tooltip
                      text={
                        regeneratingMessageId === message.id
                          ? "Regenerating..."
                          : "Regenerate message"
                      }
                      offsetSize="large"
                    >
                      <button
                        onClick={() => handleRegenerateMessage(message.id)}
                        disabled={
                          messagesLoading ||
                          isEditLoading ||
                          regeneratingMessageId !== null
                        }
                        className={`py-2 px-2 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors duration-300 ease-in-out group/regenerate ${
                          regeneratingMessageId === message.id
                            ? "text-blue-400 bg-zinc-700 cursor-not-allowed"
                            : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 cursor-pointer"
                        }`}
                        aria-label={
                          regeneratingMessageId === message.id
                            ? "Regenerating message"
                            : "Regenerate message"
                        }
                      >
                        <IoRefresh
                          className={`h-4 w-4 transition-transform duration-300 ease-in-out ${
                            regeneratingMessageId === message.id
                              ? "animate-spin"
                              : "group-hover/regenerate:scale-110"
                          }`}
                        />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <div></div>
                )}
                <span
                  className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out text-xs text-zinc-400 ${
                    message.role === "user"
                      ? "px-2 flex flex-row gap-2 justify-end items-center"
                      : ""
                  }`}
                >
                  {message.role === "user" && (
                    <Tooltip text="Edit message">
                      <button
                        onClick={() =>
                          handleStartEdit(message.id, message.content)
                        }
                        disabled={
                          messagesLoading ||
                          editingMessageId !== null ||
                          isEditLoading
                        }
                        className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50 p-1.5 rounded flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out group/edit"
                      >
                        <AiFillEdit className="h-4 w-4 transition-transform duration-300 ease-in-out group-hover/edit:scale-110" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Branch selector inline with edit button - only for user messages */}
                  {message.role === "user" && getBranchSelector(message.id)}

                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          {(messagesLoading || isEditLoading) && messages.length > 0 && (
            <TypingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex px-4 pb-4 w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex gap-2 max-w-4xl w-full">
            <div
              className="flex flex-1 flex-col px-3 py-2 gap-2 w-full bg-zinc-700 border border-zinc-600 rounded-lg focus-within:border-zinc-400/50 message-scrollbar cursor-text"
              onClick={(e) => {
                // Check if the clicked element is a button or inside a button
                const target = e.target as HTMLElement;
                const isButton = target.closest("button") !== null;

                // Only focus if we didn't click on a button
                if (!isButton && textareaRef.current) {
                  textareaRef.current.focus();
                }
              }}
            >
              {/* Image preview area */}
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border-b border-zinc-700">
                  {selectedImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative group border border-zinc-700 rounded-lg"
                    >
                      <img
                        src={image.data}
                        alt={image.name || "Selected image"}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        title="Remove image"
                        className="absolute -top-2 -right-2 hidden group-hover:flex bg-zinc-700 border border-zinc-600 hover:bg-zinc-600 text-white rounded-full w-6 h-6 items-center justify-center text-xs cursor-pointer transition-colors duration-300 ease-in-out"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  currentModelSupportsImages
                    ? "Type your message or upload images..."
                    : "Type your message..."
                }
                className="w-full text-gray-100 placeholder:text-gray-400 focus:outline-none resize-none bg-transparent border-none min-h-[24px] max-h-[150px] overflow-y-auto"
                disabled={
                  messagesLoading ||
                  isEditLoading ||
                  isAccessDenied ||
                  isLoadingUserConversations ||
                  !subscriptionTier ||
                  (characterAccess !== null && !characterAccess.hasAccess)
                }
                rows={1}
                style={{ height: "24px" }}
                ref={textareaRef}
              />
              <div className="flex flex-row justify-between">
                <div className="flex flex-row gap-2 py-1">
                  {currentModelSupportsImages && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <button
                        className="text-zinc-200 hover:text-white hover:bg-zinc-800 border border-zinc-500 hover:border-zinc-800 px-1.5 py-1.5 rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out group/image-upload"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        disabled={isUploading}
                        title="Upload images"
                      >
                        <FiImage className="h-4 w-4 group-hover/image-upload:scale-110 transition-transform duration-300 ease-in-out" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSend();
                  }}
                  className="border border-zinc-500 hover:border-zinc-800 hover:bg-zinc-800 text-zinc-100 px-3 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-zinc-700 disabled:hover:border-zinc-500 disabled:cursor-text cursor-pointer transition-colors duration-300 ease-in-out group/send disabled:group/send:cursor-text"
                  title="Send message"
                  disabled={
                    messagesLoading ||
                    isEditLoading ||
                    (!newMessage.trim() && selectedImages.length === 0) ||
                    isAccessDenied ||
                    isLoadingUserConversations ||
                    !subscriptionTier ||
                    (characterAccess !== null && !characterAccess.hasAccess)
                  }
                >
                  <HiArrowSmRight className="inline-block group-hover/send:scale-110 transition-transform duration-300 ease-in-out" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
