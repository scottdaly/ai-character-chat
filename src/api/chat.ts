// src/api/chat.ts
import { useAuth } from '../contexts/AuthContext';
import { Message } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const useChat = () => {
  const { apiFetch } = useAuth();

  const sendMessage = async (characterId: string, messages: ChatMessage[]) => {
    const response = await apiFetch(`/api/chat/${characterId}`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
    return response.json() as Promise<Message>;
  };

  const getChatHistory = async (characterId: string) => {
    const response = await apiFetch(`/api/chat/${characterId}/history`);
    return response.json() as Promise<Message[]>;
  };

  return { sendMessage, getChatHistory };
};