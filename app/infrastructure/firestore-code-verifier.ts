import { Firestore } from "@google-cloud/firestore";
import { CodeVerifierRepository } from "app/domain/code-verifier-repository";

export class FirestoreCodeVerifier implements CodeVerifierRepository {
  firestore: Firestore;
  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async save(state: string, verifier: string): Promise<object> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    try {
      const dataToStore = {
        state,
        verifier,
        expiresAt,
        createdAt: new Date(),
      };
      const docRef = await this.firestore.collection('codeVerifier').add(dataToStore);
      return { id: docRef.id, ...dataToStore };
    } catch (error) {
      console.error('Error storing code verifier:', error);
      throw error;
    }
  }

  async find(state: string): Promise<object | null> {
    try {
      const verifierRef = this.firestore.collection('codeVerifier');
      const snapshot = await verifierRef
        .where('state', '==', state)
        .where('expiresAt', '>', new Date())
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const verifier = { id: doc.id, ...doc.data() };

      await doc.ref.delete();

      return verifier;
    } catch (error) {
      console.error('Error retrieving code verifier:', error);
      return null;
    }
  }
}
