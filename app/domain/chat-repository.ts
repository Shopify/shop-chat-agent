import { CustomerAccountUrls } from "./customerAccountUrls";
import { CustomerToken } from "./customerToken";
import { Message } from "./message";

export interface ChatRepository
{
  storeCodeVerifier(state: string, verifier: string): Promise<object>;
  getCodeVerifier(state: string): Promise<object | null>;
  storeCustomerToken(
    conversationId: string,
    accessToken: string,
    expiresAt: string,
  ): Promise<CustomerToken>;
  getCustomerToken(conversationId: string): Promise<CustomerToken | null>;
  createOrUpdateConversation(conversationId: string): Promise<object>;
  saveMessage(
    conversationId: string,
    role: string,
    content: string,
  ): Promise<Message>;
  getConversationHistory(conversationId: string): Promise<Message[]>;
  
  storeCustomerAccountUrls({
    conversationId,
    mcpApiUrl,
    authorizationUrl,
    tokenUrl,
  }): Promise<object>;

  getCustomerAccountUrls(conversationId: string): Promise<CustomerAccountUrls | null>;
}
