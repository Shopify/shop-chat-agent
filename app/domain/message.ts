export interface Conversation {
  id: string;
  shopDomain: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}
