import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSend } from 'react-icons/fi';
import { useMessages } from '../api/messages';
import { useConversation } from '../api/conversations';

export default function ConversationChat() {
  const { characterId, conversationId } = useParams();
  const navigate = useNavigate();
  const {
    messages,
    sendMessage,
    isLoading: messagesLoading,
    error: messagesError,
    isNewConversation,
    realConversationId,
    loadMessages
  } = useMessages(characterId!, conversationId!);
  const { conversation } = useConversation(conversationId!);
  const [newMessage, setNewMessage] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Update document title when conversation changes
  useEffect(() => {
    if (conversation) {
      document.title = `${conversation.title} - NeverMade`;
    } else if (isNewConversation) {
      document.title = 'NeverMade - AI Chat';
    }
    return () => {
      document.title = 'NeverMade - AI Chat';
    };
  }, [conversation, isNewConversation]);

  // Handle URL update when real conversation is created
  useEffect(() => {
    if (realConversationId && realConversationId !== conversationId) {
      navigate(
        `/dashboard/characters/${characterId}/conversations/${realConversationId}`,
        { replace: true }
      );
    }
  }, [realConversationId]);

  // Add this effect to reload messages when conversation changes
  useEffect(() => {
    if (conversationId && !conversationId.startsWith('temp-')) {
      loadMessages();
    }
  }, [conversationId, loadMessages]);

  // Add this effect to clear input when conversation changes
  useEffect(() => {
    setNewMessage('');
    // Reset textarea height
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = '40px';
    }
  }, [conversationId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage;
    setNewMessage('');
    setPendingMessage(messageContent);
    setAutoScroll(true);

    // Reset textarea height
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = '40px';
    }

    try {
      await sendMessage(messageContent);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore the message content so the user can try again
      setNewMessage(messageContent);
    } finally {
      setPendingMessage(null);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && (messages.length > 0 || pendingMessage)) {
      const container = document.getElementById('messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, autoScroll, pendingMessage]);

  if (!characterId || !conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Invalid character or conversation ID
      </div>
    );
  }

  if (messagesError) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Error: {messagesError.message}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full justify-center items-center">
      {/* Messages Container */}
      <div
        id="messages-container"
        className="flex-1 p-4 space-y-4 w-full overflow-y-auto"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col h-full">
        {messages.length === 0 && !pendingMessage ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            {isNewConversation
              ? <p className="text-gray-400 text-center">Type your first message to start the conversation</p>
              : <p className="text-gray-400 text-center">No messages in this conversation</p>
            }
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col pb-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl p-4 rounded-xl ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <span className="text-xs text-gray-400 mt-1 px-2">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
            {pendingMessage && !messagesLoading && (
              <div
                key="pending-message"
                className="flex flex-col items-end"
              >
                <div className="max-w-2xl p-4 rounded-xl bg-blue-600 text-white">
                  <p className="whitespace-pre-wrap">{pendingMessage}</p>
                </div>
                <span className="text-xs text-gray-400 mt-1 px-2">
                  {new Date().toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {messagesLoading && (
              <div className="flex justify-start">
                <div className="max-w-2xl p-4 rounded-xl bg-zinc-800 text-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent border-gray-300"></div>
                    <span className="text-sm text-gray-300">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex p-4 border-t border-zinc-700 w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center w-full">
        <div className="flex gap-2 max-w-4xl w-full">
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              // Reset height before calculating new height
              e.target.style.height = 'auto';
              // Set new height based on scrollHeight
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 bg-zinc-800 text-gray-100 rounded-lg placeholder:text-gray-400 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
            disabled={messagesLoading}
            rows={1}
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 h-[40px]"
            disabled={messagesLoading || !newMessage.trim()}
          >
            <FiSend className="inline-block" /> Send
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}