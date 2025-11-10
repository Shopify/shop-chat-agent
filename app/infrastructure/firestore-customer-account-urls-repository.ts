import { Firestore, Timestamp } from "@google-cloud/firestore";
import { CustomerAccountUrls } from "app/domain/customer-account-urls";
import { CustomerAccountUrlsRepository } from "app/domain/customer-account-urls-repository";

const customerAccountUrlsConverter = {
  toFirestore(data: CustomerAccountUrls): FirebaseFirestore.DocumentData {
    return {
      conversationId: data.conversationId,
      mcpApiUrl: data.mcpApiUrl,
      authorizationUrl: data.authorizationUrl,
      tokenUrl: data.tokenUrl,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): CustomerAccountUrls {
    const data = snapshot.data();
    return {
      conversationId: data.conversationId,
      mcpApiUrl: data.mcpApiUrl,
      authorizationUrl: data.authorizationUrl,
      tokenUrl: data.tokenUrl,
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

export class FirestoreCustomerAccountUrlsRepository implements CustomerAccountUrlsRepository {
  private readonly customerAccountUrlsCollection: FirebaseFirestore.CollectionReference<CustomerAccountUrls>;

  constructor(private readonly firestore: Firestore) {
    this.customerAccountUrlsCollection = this.firestore
      .collection('customerAccountUrls')
      .withConverter(customerAccountUrlsConverter);
  }

  async save(
    conversationId: string,
    mcpApiUrl: string,
    authorizationUrl: string,
    tokenUrl: string,
  ): Promise<CustomerAccountUrls> {
    const docRef = this.customerAccountUrlsCollection.doc(conversationId);
    const now = new Date();
    
    const existingDoc = await docRef.get();
    
    const dataToSave = existingDoc.exists 
      ? {
          conversationId,
          mcpApiUrl,
          authorizationUrl,
          tokenUrl,
          updatedAt: now,
        }
      : {
          conversationId,
          mcpApiUrl,
          authorizationUrl,
          tokenUrl,
          createdAt: now,
          updatedAt: now,
        };

    await docRef.set(dataToSave, { merge: true });
    
    const updatedDoc = await docRef.get();
    return updatedDoc.data()!;
  }

  async find(conversationId: string): Promise<CustomerAccountUrls | null> {
    const docRef = this.customerAccountUrlsCollection.doc(conversationId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }
    return doc.data()!;
  }
}
