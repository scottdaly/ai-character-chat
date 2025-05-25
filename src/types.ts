// src/types.ts
export interface Character {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  createdAt: Date;
  UserId: string;
  isPublic: boolean;
  messageCount: number;
  User?: {
    username: string;
    displayName: string;
    isOfficial: boolean;
  };
}

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: Date;
  ConversationId: string;
  CharacterId: string;
  UserId: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: Date;
  characterId: string;
  userId: string;
  Character?: {
    name: string;
    model: string;
  };
}
