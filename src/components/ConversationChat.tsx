import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSend } from 'react-icons/fi';
import { useMessages } from '../api/messages';


export default function ConversationChat() {
  const { characterId, conversationId } = useParams();
  const navigate = useNavigate();
  const {
    messages,
    sendMessage,
    isLoading,
    error,
    isNewConversation,
    realConversationId,
    loadMessages
  } = useMessages(characterId!, conversationId!);
  const [newMessage, setNewMessage] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

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

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full justify-center items-center">
      {/* Messages Container */}
      <div
        id="messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-4 w-full max-w-4xl"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
        }}
      >
        {messages.length === 0 && !pendingMessage ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            {isNewConversation
              ? 'Type your first message to start the conversation'
              : 'No messages in this conversation'}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl p-4 rounded-xl ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-100'
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
            {pendingMessage && !isLoading && (
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
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-2xl p-4 rounded-xl bg-gray-800 text-gray-100">
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

      {/* Input Area */}
      <div className="flex p-4 border-t border-gray-700 w-full items-center justify-center">
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
            className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
            disabled={isLoading}
            rows={1}
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 h-[40px]"
            disabled={isLoading || !newMessage.trim()}
          >
            <FiSend className="inline-block" /> Send
          </button>
        </div>
        
        </div>
      </div>
    </div>
  );
}