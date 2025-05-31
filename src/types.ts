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
  image?: string; // Optional image URL or path
  User?: {
    username: string;
    displayName: string;
    isOfficial: boolean;
  };
}

export interface MessageAttachment {
  type: "image";
  data: string; // base64 encoded data
  mimeType: string; // e.g., "image/jpeg", "image/png"
  name?: string; // optional filename
}

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: Date;
  ConversationId: string;
  CharacterId: string;
  UserId: string;
  attachments?: MessageAttachment[];
  parentId?: string;
  childIndex?: number;
}

export interface MessageTreeNode extends Message {
  children: MessageTreeNode[];
  isOnCurrentPath: boolean;
}

export interface ConversationTree {
  tree: MessageTreeNode[];
  currentPath: Message[];
  currentHeadId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: Date;
  characterId: string;
  userId: string;
  currentHeadId?: string;
  Character?: {
    name: string;
    model: string;
  };
}
