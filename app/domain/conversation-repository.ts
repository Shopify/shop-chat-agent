import { Conversation } from "./message";

export interface ConversationRepository
{
  upsert(conversationId: string, shopDomain:string): Promise<object>;
  findAllByShop(shopDomainHash: string, startAfterCreateAt?: number|null, limit?: number): Promise<Conversation[]>;
}
