import { Firestore, Timestamp } from "@google-cloud/firestore";
import { CustomerTokenRepository } from "app/domain/customer-token-repository";
import { CustomerToken } from "app/domain/customer-token";

const customerTokenConverter = {
  toFirestore(data: CustomerToken): FirebaseFirestore.DocumentData {
    return {
      conversationId: data.conversationId,
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): CustomerToken {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      conversationId: data.conversationId,
      accessToken: data.accessToken,
      expiresAt:
        data.expiresAt instanceof Timestamp
          ? data.expiresAt.toDate()
          : data.expiresAt,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : data.updatedAt,
    };
  }
};

export class FirestoreCustomerTokenRepository implements CustomerTokenRepository {
  private readonly customerTokenCollection: FirebaseFirestore.CollectionReference<CustomerToken>;

  constructor(private readonly firestore: Firestore) {
    this.customerTokenCollection = this.firestore
      .collection('customerToken')
      .withConverter(customerTokenConverter);
  }

  async save(conversationId: string, accessToken: string, expiresAt: string): Promise<CustomerToken> {
    const docRef = this.customerTokenCollection.doc(conversationId);
    const now = new Date();
    const expiresAtDate = new Date(expiresAt);
    
    const existingDoc = await docRef.get();
    
    const dataToSave = existingDoc.exists 
      ? {
          conversationId,
          accessToken,
          expiresAt: expiresAtDate,
          updatedAt: now,
        }
      : {
          conversationId,
          accessToken,
          expiresAt: expiresAtDate,
          createdAt: now,
          updatedAt: now,
        };

    await docRef.set(dataToSave, { merge: true });
    
    const updatedDoc = await docRef.get();
    return updatedDoc.data()!;
  }

  async find(conversationId: string): Promise<CustomerToken | null> {
    const docRef = this.customerTokenCollection.doc(conversationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data()!;
  }
}