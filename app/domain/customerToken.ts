export interface CustomerToken {
	id: string;
	conversationId: string;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}
