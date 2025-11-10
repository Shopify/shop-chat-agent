import { CustomerToken } from "./customer-token";

export interface CustomerTokenRepository
{
  find(conversationId: string): Promise<CustomerToken | null>;

  save(
    conversationId: string,
    accessToken: string,
    expiresAt: string,
  ): Promise<CustomerToken>;
}
