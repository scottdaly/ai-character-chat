// src/api/messages.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Message } from '../types';
import { useConversations } from './conversations';

export const useMessages = (characterId: string, conversationId: string) => {
  const { apiFetch } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { createConversation } = useConversations(characterId);
  const [realConversationId, setRealConversationId] = useState<string | null>(null);

  // First, handle realConversationId updates
  useEffect(() => {
    console.log('[realConversationId effect] Starting with:', {
      conversationId,
      realConversationId,
      isTemp: conversationId.startsWith('temp-')
    });

    if (!conversationId.startsWith('temp-') && realConversationId !== conversationId) {
      console.log('[realConversationId effect] Updating to:', conversationId);
      setRealConversationId(conversationId);
    }
  }, [conversationId]);

  const loadMessages = useCallback(async (convId: string) => {
    console.log('[loadMessages] Called with convId:', convId);
    try {
      const data = await apiFetch<Message[]>(`/api/conversations/${convId}/messages`);
      console.log('[loadMessages] Setting messages, count:', data.length);
      setMessages(data);
    } catch (err) {
      console.error('[loadMessages] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load messages'));
    }
  }, [apiFetch]);

  // Then handle message loading
  useEffect(() => {
    console.log('[loadMessagesEffect] Starting with:', {
      conversationId,
      realConversationId,
      isLoading
    });

    if (conversationId.startsWith('temp-')) {
      console.log('[loadMessagesEffect] Clearing messages - temp conversation');
      setMessages([]);
      return;
    }

    if (!isLoading) {
      console.log('[loadMessagesEffect] Loading messages for:', conversationId);
      setIsLoading(true);
      loadMessages(conversationId).finally(() => {
        console.log('[loadMessagesEffect] Finished loading');
        setIsLoading(false);
      });
    }

    return () => {
      console.log('[loadMessagesEffect] Cleanup');
    };
  }, [conversationId, loadMessages]);

  const wrappedLoadMessages = useCallback(() => {
    console.log('[wrappedLoadMessages] Called');
    if (isLoading) {
      console.log('[wrappedLoadMessages] Skipping - already loading');
      return;
    }
    return loadMessages(conversationId);
  }, [conversationId, loadMessages, isLoading]);

  const sendMessage = async (content: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Create the user message object
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        role: 'user',
        createdAt: new Date(),
        ConversationId: conversationId,
        CharacterId: characterId,
        UserId: 'temp'
      };

      // For new conversations, always create a new one
      if (conversationId.startsWith('temp-')) {
        // Show user message immediately
        setMessages([userMessage]);
        
        const newConversation = await createConversation();
        setRealConversationId(newConversation.id);
        
        const data = await apiFetch<Message[]>(`/api/conversations/${newConversation.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content })
        });
        
        setMessages(data);
        return data;
      }

      // For existing conversations, just send the message
      // Show user message immediately
      setMessages(prevMessages => [...prevMessages, userMessage]);

      const data = await apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });

      // Replace the temporary message with the real messages
      setMessages(prevMessages => {
        // Remove the temporary message
        const withoutTemp = prevMessages.filter(msg => msg.id !== userMessage.id);
        // Add the new messages
        return [...withoutTemp, ...data];
      });
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    isNewConversation: conversationId.startsWith('temp-'),
    realConversationId,
    loadMessages: wrappedLoadMessages
  };
};