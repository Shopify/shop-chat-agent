import { CustomerAccountUrls } from "./customer-account-urls";

export interface CustomerAccountUrlsRepository
{
  save(
    conversationId: string,
    mcpApiUrl: string,
    authorizationUrl: string,
    tokenUrl: string,
  ): Promise<CustomerAccountUrls>;

  find(conversationId: string): Promise<CustomerAccountUrls | null>;
}
