export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  conversation: Conversation;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}
