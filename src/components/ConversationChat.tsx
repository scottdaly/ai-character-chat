import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiSend, FiAlertTriangle } from "react-icons/fi";
import { useMessages } from "../api/messages";
import { useConversation, useConversations } from "../api/conversations";
import { useAuth } from "../contexts/AuthContext";
import { useUserConversations } from "../api/useUserConversations";
import { checkCharacterAccess } from "../api/characterAccess";

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
  const { apiFetch, user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    tier: string;
  } | null>(null);
  const {
    conversations: userConversations,
    isLoading: isLoadingUserConversations,
  } = useUserConversations();

  // Get conversation refresh function to update sidebar when titles change
  const { loadConversations } = useConversations(characterId!);

  // Create a wrapper function to add logging
  const refreshConversationList = useCallback(() => {
    console.log(
      "[ConversationChat] Refreshing conversation list due to message update"
    );
    loadConversations();
  }, [loadConversations]);

  // Use centralized character access checking
  const characterAccess =
    characterId && subscriptionStatus && !isLoadingUserConversations
      ? checkCharacterAccess(
          characterId,
          subscriptionStatus.tier,
          userConversations
        )
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
    subscriptionStatus,
    userConversations,
    isLoadingUserConversations,
    refreshConversationList // Pass the wrapper function to update sidebar
  );

  const { conversation } = useConversation(
    realConversationId || conversationId!
  );
  const [newMessage, setNewMessage] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      apiFetch("/api/subscription-status")
        .then(setSubscriptionStatus)
        .catch((err) => {
          console.error("Failed to fetch subscription status:", err);
          setSubscriptionStatus({ tier: "free" });
        });
    }
  }, [apiFetch, user]);

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
      textarea.style.height = "40px";
    }
  }, [conversationId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage;
    setNewMessage("");
    setPendingMessage(messageContent);

    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.style.height = "40px";
    }

    try {
      await sendMessage(messageContent);
    } catch (err) {
      console.error("Failed to send message:", err);
      setNewMessage(messageContent);
    } finally {
      setPendingMessage(null);
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

  if (messagesError && !accessError) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Error: {messagesError.message}
      </div>
    );
  }

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
              className={`flex flex-col pb-4 ${
                message.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-2xl p-4 rounded-xl ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              <span className="text-xs text-gray-400 mt-1 px-2">
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
          {messagesLoading && messages.length > 0 && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex p-4 border-t border-zinc-700 w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex gap-2 max-w-4xl w-full">
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
              placeholder="Type your message..."
              className="flex-1 bg-zinc-800 text-gray-100 rounded-lg placeholder:text-gray-400 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
              disabled={
                messagesLoading ||
                isAccessDenied ||
                isLoadingUserConversations ||
                !subscriptionStatus ||
                (characterAccess !== null && !characterAccess.hasAccess)
              }
              rows={1}
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 h-[40px]"
              disabled={
                messagesLoading ||
                !newMessage.trim() ||
                isAccessDenied ||
                isLoadingUserConversations ||
                !subscriptionStatus ||
                (characterAccess !== null && !characterAccess.hasAccess)
              }
            >
              <FiSend className="inline-block" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
