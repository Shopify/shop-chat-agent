import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

export class StoreSessionStorageService implements SessionStorage {
  private storeSessionRepository: SessionStorage;

	constructor(storeSessionRepository: SessionStorage) {
		this.storeSessionRepository = storeSessionRepository;
	}

	async storeSession(session: Session): Promise<boolean> {
    return await this.storeSessionRepository.storeSession(session);
	}

	async loadSession(id: string): Promise<Session | undefined> {
    return await this.storeSessionRepository.loadSession(id);
	}

	async deleteSession(id: string): Promise<boolean> {
    return await this.storeSessionRepository.deleteSession(id);
	}

	async deleteSessions(ids: string[]): Promise<boolean> {
    return await this.storeSessionRepository.deleteSessions(ids);
	}

	async findSessionsByShop(shop: string): Promise<Session[]> {
    return await this.storeSessionRepository.findSessionsByShop(shop);
	}
}
