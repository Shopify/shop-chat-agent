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
import type { shopifySession } from "app/domain/shopifySession";

type SessionDocument = {
	shopID: string;
	value: SessionParams;
};

export class FirestoreSessionStorage implements SessionStorage {
	private firestore: Firestore;
	private collection: CollectionReference<SessionDocument>;
	private converter: FirestoreDataConverter<SessionDocument>;
	private tableName: string;

	constructor(firestore: Firestore) {
		this.firestore = firestore;
		this.tableName = "shopifySessions";
		this.converter = {
			toFirestore(data: WithFieldValue<SessionDocument>): DocumentData {
				return data;
			},

			fromFirestore(
				snapshot: QueryDocumentSnapshot<SessionDocument>,
			): SessionDocument {
				return snapshot.data();
			},
		};
		this.collection = this.firestore
			.collection(this.tableName)
			.withConverter(this.converter);
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

	async loadSession(id: string): Promise<shopifySession | undefined> {
		const snapshot = await this.collection.doc(id).get();
		if (snapshot.exists) {
			const data = snapshot.data();
			if (data) {
				return new Session(data.value);
			}
		}
		return undefined;
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

	async findSessionsByShop(shop: string): Promise<shopifySession[]> {
		const snapshots = await this.collection.where("shopID", "==", shop).get();
		return snapshots.docs.map((snapshot) => {
			const data = snapshot.data();
			return new Session(data.value);
		});
	}
}
