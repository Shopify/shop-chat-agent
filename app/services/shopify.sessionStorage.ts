import { Session, SessionParams } from "@shopify/shopify-api";
import { SessionStorage } from "@shopify/shopify-app-session-storage";
import {
  Firestore,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  WithFieldValue,
  DocumentData,
  CollectionReference,
} from "@google-cloud/firestore";

type SessionDocument = {
  shopID: string;
  value: SessionParams;
};

export class FirestoreSessionStorage implements SessionStorage {
  private firestore: Firestore;
  private collection: CollectionReference<SessionDocument>;
  private converter: FirestoreDataConverter<SessionDocument>;

  constructor(firestore: Firestore, private tableName: string = "shopifySessions") {
    this.firestore = firestore;
    this.converter = {
      toFirestore(data: WithFieldValue<SessionDocument>): DocumentData {
        return data;
      },

      fromFirestore(
        snapshot: QueryDocumentSnapshot<SessionDocument>
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

  async loadSession(id: string): Promise<Session | undefined> {
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

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const snapshots = await this.collection.where("shopID", "==", shop).get();
    return snapshots.docs.map((snapshot) => {
      const data = snapshot.data();
      return new Session(data.value);
    });
  }

  /**
   * To use the emulator, set the FIRESTORE_EMULATOR_HOST environment variable.
   * This method is now a no-op for compatibility.
   */
  useEmulator() {
    // The @google-cloud/firestore library uses the FIRESTORE_EMULATOR_HOST environment variable.
    // See https://cloud.google.com/sdk/gcloud/reference/beta/emulators/firestore/
  }
}
