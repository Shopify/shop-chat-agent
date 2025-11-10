import type {
	CollectionReference,
	DocumentData,
	Firestore,
	FirestoreDataConverter,
	QueryDocumentSnapshot,
	WithFieldValue,
} from "@google-cloud/firestore";
import { Session, type SessionParams } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

type SessionDocument = {
	shopID: string;
	value: SessionParams;
};

const sessionConverter: FirestoreDataConverter<SessionDocument> = {
	toFirestore(data: WithFieldValue<SessionDocument>): DocumentData {
		return data;
	},

	fromFirestore(
		snapshot: QueryDocumentSnapshot<SessionDocument>,
	): SessionDocument {
		return snapshot.data();
	},
};

export class FirestoreSessionStorageRepository implements SessionStorage {
	private firestore: Firestore;
	private collection: CollectionReference<SessionDocument>;

	constructor(firestore: Firestore) {
		this.firestore = firestore;
		this.collection = this.firestore
			.collection("shopifySessions")
			.withConverter(sessionConverter);
	}

	async storeSession(session: Session): Promise<boolean> {
		try {
			await this.collection.doc(session.id).set({
				shopID: session.shop,
				value: session.toObject(),
			});
			return true;
		} catch {
			return false;
		}
	}

	async loadSession(id: string): Promise<Session | undefined> {
		const snapshot = await this.collection.doc(id).get();
		if (snapshot.exists) {
			const data = snapshot.data();
			if (data) {
				return new Session(data.value);
			}
		}
	}

	async deleteSession(id: string): Promise<boolean> {
		try {
			await this.collection.doc(id).delete();
			return true;
		} catch {
			return false;
		}
	}

	async deleteSessions(ids: string[]): Promise<boolean> {
		try {
			const batch = this.firestore.batch();
			ids.forEach((id) => {
				batch.delete(this.collection.doc(id));
			});
			await batch.commit();
			return true;
		} catch {
			return false;
		}
	}

	async findSessionsByShop(shop: string): Promise<Session[]> {
		const snapshots = await this.collection.where("shopID", "==", shop).get();
		return snapshots.docs.map((snapshot) => {
			const data = snapshot.data();
			return new Session(data.value);
		});
	}
}
