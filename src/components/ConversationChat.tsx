import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiAlertTriangle, FiImage, FiX, FiCopy } from "react-icons/fi";
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

export default function ConversationChat() {
  const { characterId, conversationId } = useParams();
  const navigate = useNavigate();
  const { apiFetch, user, subscriptionTier } = useAuth();
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

  const {
    conversations: userConversations,
    isLoading: isLoadingUserConversations,
  } = useUserConversations();

  // Get character data directly to access model information immediately
  const { character } = useCharacter(characterId!);

  // Get conversation refresh function to update sidebar when titles change
  const { loadConversations } = useConversations(characterId!);

  // Create a wrapper function to add logging
  const refreshConversationList = useCallback(() => {
    console.log(
      "[ConversationChat] Refreshing conversation list due to message update"
    );
    loadConversations();
  }, [loadConversations]);

  // Use centralized character access checking with auth context subscription tier
  const characterAccess =
    characterId && subscriptionTier && !isLoadingUserConversations
      ? checkCharacterAccess(characterId, subscriptionTier, userConversations)
      : null;

  const {
    messages,
    sendMessage,
    isLoading: messagesLoading,
    error: messagesError,
    isNewConversation,
    realConversationId,
    loadMessages,
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

  // Regenerate assistant message
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

      // Get all messages up to (but not including) the message to regenerate
      const messagesUpToRegenerate = messages.slice(0, messageIndex);

      // Get the user message that prompted this assistant response
      const userMessage =
        messagesUpToRegenerate[messagesUpToRegenerate.length - 1];
      if (!userMessage || userMessage.role !== "user") {
        setToast({
          message: "Cannot find the user message that prompted this response",
          type: "error",
        });
        return;
      }

      // Make API call to regenerate the message
      const conversationIdToUse = realConversationId || conversationId;
      if (!conversationIdToUse || conversationIdToUse.startsWith("temp-")) {
        setToast({
          message: "Cannot regenerate messages in a new conversation",
          type: "error",
        });
        return;
      }

      // Call the API to regenerate the message
      await apiFetch(
        `/api/conversations/${conversationIdToUse}/messages/${messageId}/regenerate`,
        {
          method: "POST",
        }
      );

      // Reload messages to get the updated conversation
      loadMessages();

      setToast({
        message: "Message regenerated successfully",
        type: "success",
      });
    } catch (err) {
      console.error("Failed to regenerate message:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to regenerate message";
      setToast({
        message: errorMessage,
        type: "error",
      });
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

      // Call the API to edit the message
      await apiFetch(
        `/api/conversations/${conversationIdToUse}/messages/${messageId}/edit`,
        {
          method: "PUT",
          body: JSON.stringify({ content: editingContent.trim() }),
        }
      );

      // Clear editing state
      setEditingMessageId(null);
      setEditingContent("");

      // Reload messages to get the updated conversation
      loadMessages();

      setToast({
        message: "Message edited successfully",
        type: "success",
      });
    } catch (err) {
      console.error("Failed to save edited message:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save edited message";
      setToast({
        message: errorMessage,
        type: "error",
      });
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
                      : "text-zinc-100 pt-3 pb-0.5"
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
                            disabled={!editingContent.trim() || messagesLoading}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={messagesLoading}
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
                        className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 py-2 px-2 rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out hover-group"
                        aria-label="Copy message"
                      >
                        <FiCopy className="h-4 w-4 transition-transform duration-300 ease-in-out hover-group-hover:scale-110" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Regenerate message" offsetSize="large">
                      <button
                        onClick={() => handleRegenerateMessage(message.id)}
                        disabled={messagesLoading}
                        className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 py-2 px-2 rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out hover-group"
                        aria-label="Regenerate message"
                      >
                        <IoRefresh className="h-4 w-4 transition-transform duration-300 ease-in-out hover-group-hover:scale-110" />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <div></div>
                )}
                <span
                  className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out text-xs text-zinc-400 last:pb-6 ${
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
                        disabled={messagesLoading || editingMessageId !== null}
                        className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50 p-1.5 rounded flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out hover-group"
                      >
                        <AiFillEdit className="h-4 w-4 transition-transform duration-300 ease-in-out hover-group-hover:scale-110" />
                      </button>
                    </Tooltip>
                  )}
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          {messagesLoading && messages.length > 0 && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex p-4 border-t border-zinc-700 w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex gap-2 max-w-4xl w-full">
            <div
              className="flex flex-1 flex-col px-3 py-2 gap-2 w-full bg-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-zinc-600 message-scrollbar cursor-text"
              onClick={(e) => {
                // Check if the clicked element is a button or inside a button
                const target = e.target as HTMLElement;
                const isButton = target.closest("button") !== null;

                console.log("Input area clicked:", {
                  target: target.tagName,
                  isButton,
                  textareaExists: !!textareaRef.current,
                });

                // Only focus if we didn't click on a button
                if (!isButton && textareaRef.current) {
                  textareaRef.current.focus();
                  console.log("Textarea focused");
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
                        className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 border border-zinc-700 px-1.5 py-1.5 rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors duration-300 ease-in-out"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        disabled={isUploading}
                        title="Upload images"
                      >
                        <FiImage className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSend();
                  }}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-3 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-zinc-700 cursor-pointer transition-colors duration-300 ease-in-out"
                  title="Send message"
                  disabled={
                    messagesLoading ||
                    (!newMessage.trim() && selectedImages.length === 0) ||
                    isAccessDenied ||
                    isLoadingUserConversations ||
                    !subscriptionTier ||
                    (characterAccess !== null && !characterAccess.hasAccess)
                  }
                >
                  <HiArrowSmRight className="inline-block" />
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
