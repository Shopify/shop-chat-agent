export interface CustomerToken {
	id?: string;
	conversationId: string;
	accessToken: string;
	refreshToken?: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}
