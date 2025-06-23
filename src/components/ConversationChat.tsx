import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiImage,
  FiX,
  FiCopy,
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiEdit3,
  FiTrash2,
  FiMoreVertical,
  FiRotateCcw,
} from "react-icons/fi";
import { AiFillEdit } from "react-icons/ai";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useMessages } from "../api/messages";
import { useConversation } from "../api/conversations";
import { useConversations } from "../api/conversations";
import { useUserConversations } from "../api/useUserConversations";
import { useCharacter } from "../api/characters";
import { checkCharacterAccess } from "../api/characterAccess";
import { HiArrowSmRight, HiDotsVertical } from "react-icons/hi";
import { MessageAttachment } from "../types";
import { supportsImages } from "../config/models";
import Toast from "./Toast";
import Tooltip from "./Tooltip";
import UniversalModal from "./UniversalModal";
import { IoRefresh } from "react-icons/io5";
import { MessageTreeNode } from "../types";
import MarkdownMessage from "./MarkdownMessage";
import UserAvatar from "./UserAvatar";
import { useCredit } from "../contexts/CreditContext";
import { useData } from "../contexts/DataContext";
import InsufficientCreditsModal from "./InsufficientCreditsModal";
import CreditBalance from "./CreditBalance";

// Typewriter effect component for smooth streaming
const TypewriterText = ({
  text,
  isComplete = false,
}: {
  text: string;
  isComplete?: boolean;
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  // Adaptive speed based on content length
  const getSpeed = (textLength: number) => {
    if (textLength > 500) return 2; // Very fast for long content
    if (textLength > 200) return 3; // Fast for medium content
    return 5; // Normal speed for short content
  };

  // Batch size for longer content (characters per update)
  const getBatchSize = (textLength: number) => {
    if (textLength > 1000) return 3; // 3 characters at once for very long content
    if (textLength > 500) return 2; // 2 characters at once for long content
    return 1; // 1 character at a time for normal content
  };

  useEffect(() => {
    if (isComplete) {
      // If complete, show full text immediately
      setDisplayedText(text);
      return;
    }

    if (currentIndex < text.length) {
      const speed = getSpeed(text.length);
      const batchSize = getBatchSize(text.length);
      const nextIndex = Math.min(currentIndex + batchSize, text.length);

      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, nextIndex));
        setCurrentIndex(nextIndex);
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [text, currentIndex, isComplete]);

  // Reset when text changes significantly (new content)
  useEffect(() => {
    if (text.length < displayedText.length) {
      setDisplayedText("");
      setCurrentIndex(0);
    }
  }, [text, displayedText.length]);

  return (
    <div className="streaming-message">
      <MarkdownMessage content={displayedText} />
    </div>
  );
};

// Typing indicator component
const TypingIndicator = () => {
  return (
    <div className="flex flex-col items-start pb-4">
      <div className="max-w-2xl p-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
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
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 cursor-pointer"
          }`}
          aria-label="Previous branch"
        >
          <FiChevronLeft className="h-4 w-4" />
        </button>
      </Tooltip>

      <span className="text-xs text-zinc-600 dark:text-zinc-200 min-w-[1rem] text-center">
        {currentBranchIndex + 1}/{totalBranches}
      </span>

      <Tooltip text="Next branch" show={!isLastBranch}>
        <button
          onClick={switchToNext}
          disabled={isLastBranch}
          className={`p-1 rounded flex items-center transition-colors duration-300 ease-in-out ${
            isLastBranch
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 cursor-pointer"
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
  const { refreshBalance } = useCredit();
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
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
    location?:
      | "top-right"
      | "top-left"
      | "top-center"
      | "bottom-right"
      | "bottom-left"
      | "bottom-center";
  } | null>(null);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Scroll state management
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastMessageCountRef = useRef(0);

  // Navigation delay for streaming - prevent remounting during stream
  const isStreamingRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);

  // Message seen tracking
  const [latestSeenMessageId, setLatestSeenMessageId] = useState<string | null>(
    null
  );
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const latestMessageRef = useRef<HTMLDivElement>(null);

  // Regenerate message state
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<
    string | null
  >(null);
  const [originalMessageContent, setOriginalMessageContent] =
    useState<string>("");

  // Header dropdown state
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isRenamingConversation, setIsRenamingConversation] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const headerDropdownRef = useRef<HTMLDivElement>(null);

  // Delete conversation confirmation state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Credit modal state
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditError, setCreditError] = useState<{
    creditsNeeded: number;
    currentBalance: number;
    estimatedCost: number;
    subscriptionTier?: string;
  } | null>(null);

  const {
    conversations: userConversations,
    isLoading: isLoadingUserConversations,
  } = useUserConversations();

  // Get character data directly to access model information immediately
  const { character } = useCharacter(characterId!);

  // Get conversation refresh function to update sidebar when titles change
  const { loadConversations, updateConversation } = useConversations(
    characterId!
  );

  // Create a wrapper function to refresh conversation list
  const refreshConversationList = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  // Create a function to update a specific conversation
  const updateSpecificConversation = useCallback(
    (conversationData: any) => {
      if (conversationData && updateConversation) {
        updateConversation({
          id: conversationData.id,
          title: conversationData.title,
          lastMessage: conversationData.lastMessage,
        });
      }
    },
    [updateConversation]
  );

  // Use centralized character access checking with auth context subscription tier
  const characterAccess =
    characterId && subscriptionTier && !isLoadingUserConversations
      ? checkCharacterAccess(characterId, subscriptionTier, userConversations)
      : null;

  const {
    messages,
    conversationTree,
    sendMessageStream,
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
    refreshConversationList, // Pass the wrapper function to update sidebar
    updateSpecificConversation // Pass the specific conversation update function
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
        location: "top-center",
      });
    } catch (err) {
      console.error("Failed to copy message:", err);
      setToast({
        message: "Failed to copy message",
        type: "error",
        location: "top-center",
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
        location: "top-center",
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

  // Header dropdown handlers
  const handleHeaderDropdownToggle = () => {
    setIsHeaderDropdownOpen(!isHeaderDropdownOpen);
  };

  const handleRenameConversation = () => {
    if (conversation) {
      setIsRenamingConversation(true);
      setRenameValue(conversation.title);
      setIsHeaderDropdownOpen(false);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameValue.trim() || !conversation) {
      setIsRenamingConversation(false);
      return;
    }

    try {
      const conversationIdToUse = realConversationId || conversationId;
      if (!conversationIdToUse || conversationIdToUse.startsWith("temp-")) {
        setToast({
          message: "Cannot rename a new conversation",
          type: "error",
        });
        return;
      }

      await apiFetch(`/api/conversations/${conversationIdToUse}`, {
        method: "PUT",
        body: JSON.stringify({ title: renameValue.trim() }),
      });

      // Update the conversation list
      refreshConversationList();

      setToast({
        message: "Conversation renamed successfully",
        type: "success",
        location: "top-center",
      });
    } catch (err) {
      console.error("Failed to rename conversation:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to rename conversation";
      setToast({
        message: errorMessage,
        type: "error",
        location: "top-center",
      });
    } finally {
      setIsRenamingConversation(false);
      setRenameValue("");
    }
  };

  const handleRenameCancel = () => {
    setIsRenamingConversation(false);
    setRenameValue("");
  };

  const handleDeleteConversation = () => {
    const conversationIdToUse = realConversationId || conversationId;
    if (!conversationIdToUse || conversationIdToUse.startsWith("temp-")) {
      setToast({
        message: "Cannot delete a new conversation",
        type: "error",
        location: "top-center",
      });
      return;
    }

    // Open the confirmation modal
    setIsDeleteModalOpen(true);
    setIsHeaderDropdownOpen(false);
  };

  const handleConfirmDelete = async () => {
    const conversationIdToUse = realConversationId || conversationId;
    if (!conversationIdToUse || conversationIdToUse.startsWith("temp-")) {
      return;
    }

    try {
      await apiFetch(`/api/conversations/${conversationIdToUse}`, {
        method: "DELETE",
      });

      setToast({
        message: "Conversation deleted successfully",
        type: "success",
        location: "top-center",
      });

      // Navigate to a new conversation
      const tempId = `temp-${Date.now()}`;
      navigate(`/dashboard/characters/${characterId}/conversations/${tempId}`);

      // Update the conversation list
      refreshConversationList();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete conversation";
      setToast({
        message: errorMessage,
        type: "error",
        location: "top-center",
      });
    } finally {
      setIsDeleteModalOpen(false);
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

  // Check if user is near bottom of scroll
  const checkScrollPosition = useCallback(() => {
    const container = document.getElementById("messages-container");
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPosition = scrollTop + clientHeight;
    const isNearBottom = scrollHeight - scrollPosition < 100; // Within 100px of bottom

    setUserScrolledUp(!isNearBottom);
    setShouldAutoScroll(isNearBottom);
  }, []);

  // Handle scroll events
  useEffect(() => {
    const container = document.getElementById("messages-container");
    if (!container) return;

    container.addEventListener("scroll", checkScrollPosition);
    return () => container.removeEventListener("scroll", checkScrollPosition);
  }, [checkScrollPosition]);

  // Intersection Observer to detect when latest message is visible
  useEffect(() => {
    const latestMessageElement = latestMessageRef.current;
    if (!latestMessageElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // User can see the latest message - mark as seen
            const latestMessage = messages[messages.length - 1];
            if (latestMessage) {
              setLatestSeenMessageId(latestMessage.id);
              setHasUnseenMessages(false);
              setUserScrolledUp(false);
            }
          }
        });
      },
      {
        root: document.getElementById("messages-container"),
        threshold: 0.1, // Trigger when at least 10% of the message is visible
        rootMargin: "0px 0px -50px 0px", // Require the message to be 50px above the bottom
      }
    );

    observer.observe(latestMessageElement);

    return () => {
      observer.disconnect();
    };
  }, [messages]);

  // Update unseen message state when messages change
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const hasNewMessage = latestMessage.id !== latestSeenMessageId;

    // Only mark as unseen if:
    // 1. There's a new message
    // 2. It's not a temp message (streaming)
    // 3. User is scrolled up
    if (hasNewMessage && !latestMessage.id.startsWith("temp-")) {
      setHasUnseenMessages(userScrolledUp);
    }
  }, [messages, latestSeenMessageId, userScrolledUp]);

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
      // If currently streaming, delay the navigation until streaming completes
      if (isStreamingRef.current) {
        pendingNavigationRef.current = realConversationId;
      } else {
        navigate(
          `/dashboard/characters/${characterId}/conversations/${realConversationId}`,
          { replace: true }
        );
      }
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

    // Reset scroll state when user sends a message - they want to see the response
    setShouldAutoScroll(true);
    setUserScrolledUp(false);

    const messageContent = newMessage;
    const messageAttachments = [...selectedImages];
    setNewMessage("");
    setSelectedImages([]);

    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.style.height = "24px";
    }

    try {
      // Set streaming flag to prevent navigation during stream
      isStreamingRef.current = true;

      await sendMessageStream(messageContent, messageAttachments);
    } catch (err) {
      console.error("Failed to send message:", err);

      // Restore the message and attachments
      setNewMessage(messageContent);
      setSelectedImages(messageAttachments);

      // Handle credit-specific errors
      if (typeof err === "object" && err !== null && "error" in err) {
        const creditErr = err as any;
        if (creditErr.error === "Insufficient credits") {
          setCreditError({
            creditsNeeded: creditErr.creditsNeeded || 0,
            currentBalance: creditErr.currentBalance || 0,
            estimatedCost: creditErr.estimatedCost || 0,
            subscriptionTier: creditErr.subscriptionTier,
          });
          setShowCreditModal(true);

          // Refresh credit balance to ensure accuracy
          refreshBalance();
          return;
        }
      }

      // Show user-friendly error message for non-credit errors
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
    } finally {
      // Always clear streaming flag
      isStreamingRef.current = false;

      if (
        pendingNavigationRef.current &&
        pendingNavigationRef.current !== conversationId
      ) {
        navigate(
          `/dashboard/characters/${characterId}/conversations/${pendingNavigationRef.current}`,
          { replace: true }
        );
        pendingNavigationRef.current = null;
      } else if (pendingNavigationRef.current) {
        // This should never happen but just in case
        // [NAV] Pending navigation exists but condition not met:
      }
    }
  };

  useEffect(() => {
    // Only auto-scroll when:
    // 1. User is near bottom (shouldAutoScroll is true)
    // 2. A new message was added (not just content updated during streaming)
    // 3. User hasn't manually scrolled up

    const messageCountChanged = messages.length !== lastMessageCountRef.current;

    if (messagesEndRef.current && shouldAutoScroll && messageCountChanged) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }

    // Update the message count ref
    lastMessageCountRef.current = messages.length;
  }, [messages.length, shouldAutoScroll]); // Only depend on message count, not content

  // Force scroll when conversation changes (new conversation)
  useEffect(() => {
    if (conversationId && messagesEndRef.current) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }
      }, 100); // Small delay to ensure messages are rendered

      // Reset scroll state for new conversation
      setShouldAutoScroll(true);
      setUserScrolledUp(false);
      setLatestSeenMessageId(null);
      setHasUnseenMessages(false);
    }
  }, [conversationId]);

  // Handle scroll to bottom manually
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
      setShouldAutoScroll(true);
      setUserScrolledUp(false);

      // Mark latest message as seen when manually scrolling to bottom
      const latestMessage = messages[messages.length - 1];
      if (latestMessage) {
        setLatestSeenMessageId(latestMessage.id);
        setHasUnseenMessages(false);
      }
    }
  }, [messages]);

  // Re-check scroll position when loading state changes
  useEffect(() => {
    if (!messagesLoading) {
      // Small delay to ensure DOM has updated after streaming completes
      setTimeout(() => {
        checkScrollPosition();
      }, 100);
    }
  }, [messagesLoading, checkScrollPosition]);

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

  // Close header dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        headerDropdownRef.current &&
        !headerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsHeaderDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        message:
          typeof messagesError === "string"
            ? messagesError
            : "Failed to load messages",
        type: "error",
      });
    }
  }, [messagesError, accessError]);

  return (
    <div className="flex-1 flex flex-col h-full w-full justify-center items-center">
      {((isAccessDenied && accessError) ||
        (characterAccess && !characterAccess.hasAccess)) && (
        <div className="flex p-6 w-full">
          <div className="flex flex-row items-center justify-between p-6 border border-cyan-300/20 dark:border-cyan-300/10 bg-gradient-to-r from-cyan-500/10 to-cyan-400/10 dark:from-cyan-500/10 dark:to-cyan-400/10 rounded-xl w-full">
            <div className="max-w-4xl flex items-start gap-4">
              <FiAlertTriangle
                size={32}
                className="text-cyan-600 dark:text-cyan-100"
              />
              <div className="">
                <p className="font-semibold text-xl text-zinc-900 dark:text-white">
                  {accessError?.message || characterAccess?.reason}
                </p>
                <p className="text-cyan-800/80 dark:text-cyan-100/80 text-sm">
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
              className="inline-block mt-2 bg-zinc-800 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-black font-medium px-4 py-2 rounded-lg transition-all duration-300 ease-in-out"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}

      <div
        id="messages-container"
        className="flex-1 space-y-4 w-full overflow-y-auto chat-container relative"
      >
        <div className="top-0 flex sticky items-center justify-between w-full bg-white dark:bg-mainBG border-b border-zinc-200 dark:border-mainBG-lighter xl:border-none xl:bg-transparent z-10 py-2 px-1">
          <div className="flex items-center gap-2">
            {/* Mobile Sidebar Toggle Button */}
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden z-50 p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-black/50 hover:text-zinc-900 dark:hover:text-white transition-all duration-300 ease-in-out"
              >
                <FiMenu size={24} />
              </button>
            )}

            {/* Mobile Credit Balance */}
            <div className="sm:hidden">
              <CreditBalance
                size="sm"
                variant="inline"
                showRefresh={false}
                showUpgradeButton={false}
                showWarning={false}
              />
            </div>
          </div>

          {/* Spacer for center alignment */}
          <div className="flex-1"></div>

          {/* Header Right Side - Credit Balance, Avatar and Options */}
          <div className="flex items-center gap-3 px-3">
            {/* Credit Balance (hidden on mobile) */}
            <div className="hidden sm:block">
              <CreditBalance
                size="sm"
                variant="inline"
                showRefresh={false}
                showUpgradeButton={false}
                showWarning={false}
              />
            </div>

            {/* Header Options Button with Dropdown */}
            <div className="relative">
              <button
                onClick={handleHeaderDropdownToggle}
                className="flex flex-row items-center gap-2 p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 group/options rounded-lg transition-all duration-300 ease-in-out"
              >
                <FiMoreVertical
                  className="text-zinc-700 dark:text-zinc-200 group-hover/options:text-zinc-900 dark:group-hover/options:text-zinc-100 transition-all duration-300 ease-in-out"
                  size={20}
                />
              </button>

              {/* Dropdown Menu */}
              {isHeaderDropdownOpen && !isNewConversation && (
                <div
                  ref={headerDropdownRef}
                  className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-[60] min-w-[140px] px-1"
                >
                  <button
                    onClick={handleRenameConversation}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 hover:text-zinc-900 dark:hover:text-white flex items-center gap-2"
                  >
                    <FiEdit3 className="h-3 w-3" />
                    Rename
                  </button>
                  <button
                    onClick={handleDeleteConversation}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-red-600 dark:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-500/15 flex items-center gap-2"
                  >
                    <FiTrash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
            {/* User Avatar */}
            <UserAvatar size="sm" />
          </div>
        </div>
        <div className="max-w-4xl p-4 mx-auto flex flex-col h-full">
          {messages.length === 0 &&
            !messagesLoading &&
            !isAccessDenied &&
            (characterAccess === null || characterAccess.hasAccess) && (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                {isNewConversation ? (
                  <p className="text-center text-gray-500 dark:text-gray-400">
                    Type your first message to start the conversation
                  </p>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400">
                    No messages in this conversation
                  </p>
                )}
              </div>
            )}
          {messages.map((message, index) => (
            <div
              key={message.id}
              ref={index === messages.length - 1 ? latestMessageRef : null}
              className={`group flex flex-col ${
                message.role === "user" ? "items-end" : "items-start"
              }`}
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
                      ? "px-4 py-3 mb-0.5 bg-zinc-100 dark:bg-zinc-700/70 text-zinc-900 dark:text-white"
                      : "text-zinc-900 dark:text-zinc-100 pb-1.5"
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
                        className="w-full bg-transparent text-zinc-900 dark:text-white p-2 rounded border border-zinc-100 dark:border-zinc-600 focus:border-zinc-200 dark:focus:border-zinc-500 focus:outline-none resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Enter to save • Esc to cancel
                          </span>
                          <button
                            onClick={handleCancelEdit}
                            disabled={messagesLoading || isEditLoading}
                            className="px-3 py-1 bg-zinc-200 dark:bg-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:bg-zinc-100 dark:disabled:bg-zinc-500 disabled:cursor-not-allowed text-zinc-800 dark:text-white rounded text-sm transition-colors"
                          >
                            Cancel
                          </button>
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
                        </div>
                      </div>
                    </div>
                  ) : message.role === "assistant" ? (
                    regeneratingMessageId === message.id ? (
                      <div className="flex items-center gap-3 text-blue-500 dark:text-blue-400 italic">
                        <IoRefresh className="h-4 w-4 animate-spin" />
                        <span>Regenerating response...</span>
                      </div>
                    ) : (
                      <TypewriterText
                        text={message.content}
                        isComplete={!message.id.startsWith("temp-")}
                      />
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              )}

              <div className="flex flex-row justify-between w-full">
                {message.role === "assistant" ? (
                  <div className="opacity-0 group-hover:opacity-100 gap-1 transition-opacity duration-200 ease-in-out flex items-center justify-center flex-row bg-zinc-100/50 dark:bg-zinc-700/50 border border-zinc-300 dark:border-zinc-700 rounded-lg p-0.5">
                    <Tooltip text="Copy message" offsetSize="large">
                      <button
                        onClick={() => handleCopyMessage(message.content)}
                        className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded-md flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out group/copy"
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
                        className={`p-1.5 rounded-md flex items-center gap-2 disabled:opacity-50 transition-colors duration-300 ease-in-out group/regenerate ${
                          regeneratingMessageId === message.id
                            ? "text-blue-500 dark:text-blue-400 bg-zinc-200 dark:bg-zinc-700 cursor-not-allowed"
                            : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
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
                  className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out text-xs text-zinc-500 dark:text-zinc-400 ${
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
                        className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 p-1 rounded flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out group/edit"
                      >
                        <FiEdit3 className="h-4 w-4 transition-transform duration-300 ease-in-out group-hover/edit:scale-110" />
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

      {/* Floating scroll to bottom button */}
      {hasUnseenMessages && (
        <div className="absolute bottom-20 right-8 z-10">
          <button
            onClick={scrollToBottom}
            className="bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-full p-3 shadow-lg border border-zinc-300 dark:border-zinc-600 transition-all duration-200 flex items-center gap-2"
            title="Scroll to bottom"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            <span className="text-sm hidden sm:inline">New messages</span>
          </button>
        </div>
      )}

      <div className="flex px-4 pb-4 w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex gap-2 max-w-4xl w-full">
            <div
              className="flex flex-1 flex-col px-2 py-2 gap-2 w-full bg-white dark:bg-mainBG-lighter shadow-md border border-zinc-200 dark:border-mainBG-lightest rounded-lg focus-within:border-zinc-500 dark:focus-within:border-zinc-400/40 message-scrollbar cursor-text"
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
                <div className="flex flex-wrap gap-2 p-2 border-b border-zinc-300 dark:border-zinc-700">
                  {selectedImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative border border-zinc-300 dark:border-zinc-700 rounded-lg"
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
                        className="absolute -top-2 -right-2 flex bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white rounded-full w-6 h-6 items-center justify-center text-xs cursor-pointer transition-colors duration-300 ease-in-out"
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
                className="w-full px-1 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none resize-none bg-transparent border-none min-h-[24px] max-h-[150px] overflow-y-auto"
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
                <div className="flex flex-row gap-2 pt-2">
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
                        className="flex items-center text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-800 px-1.5 py-1.5 rounded-lg  gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out group/image-upload"
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
                  className="bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300/70 dark:hover:bg-zinc-600/70 text-zinc-800 dark:text-zinc-100 px-3 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-zinc-200 dark:disabled:hover:bg-zinc-700 disabled:hover:border-zinc-500 disabled:cursor-text cursor-pointer transition-colors duration-300 ease-in-out group/send disabled:group/send:cursor-text"
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
          location={toast.location}
        />
      )}

      {/* Rename Conversation Modal */}
      {isRenamingConversation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            // Only close if clicking the backdrop itself
            if (e.target === e.currentTarget) {
              handleRenameCancel();
            }
          }}
        >
          <div
            className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                Rename Conversation
              </h3>
              <button
                onClick={handleRenameCancel}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameSubmit();
                  } else if (e.key === "Escape") {
                    handleRenameCancel();
                  }
                }}
                className="w-full bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white px-3 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-blue-500 dark:focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter conversation title"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleRenameCancel}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-all duration-300 ease-in-out"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!renameValue.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-300 ease-in-out"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      <UniversalModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Conversation"
        icon="warning"
        buttons={[
          {
            text: "Cancel",
            onClick: () => setIsDeleteModalOpen(false),
            variant: "secondary",
          },
          {
            text: "Delete",
            onClick: handleConfirmDelete,
            variant: "danger",
          },
        ]}
      >
        <p className="text-gray-700 dark:text-gray-300">
          Are you sure you want to delete this conversation? This action cannot
          be undone.
        </p>
      </UniversalModal>

      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        isOpen={showCreditModal}
        onClose={() => {
          setShowCreditModal(false);
          setCreditError(null);
        }}
        creditsNeeded={creditError?.creditsNeeded}
        currentBalance={creditError?.currentBalance}
        estimatedCost={creditError?.estimatedCost}
        subscriptionTier={creditError?.subscriptionTier}
        context={{
          action: "send message",
          model: characterModel,
          characterName: character?.name || conversation?.Character?.name,
        }}
      />
    </div>
  );
}
