import { Firestore, Timestamp } from "@google-cloud/firestore";
import { Conversation } from "app/domain/message";
import { ConversationRepository } from "app/domain/conversation-repository";

const conversationConverter = {
  toFirestore(data: Conversation): FirebaseFirestore.DocumentData {
    return {
      id: data.id,
      shopDomain: data.shopDomain,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Conversation {
    const data = snapshot.data();
    return {
      id: data.id,
      shopDomain: data.shopDomain,
      messages: [],
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

export class FirestoreConversationRepository implements ConversationRepository {
  private readonly conversationCollection: FirebaseFirestore.CollectionReference<Conversation>;

  constructor(firestore: Firestore) {
    this.conversationCollection = firestore
      .collection('conversation')
      .withConverter(conversationConverter);
  }

  async upsert(conversationId: string, shopDomain: string): Promise<object> {
    const docRef = this.conversationCollection.doc(conversationId);
    const docSnap = await docRef.get();
    const now = new Date();

    if (docSnap.exists) {
        return await docRef.update({
            updatedAt: now,
        });
    }

    return docRef.set({
        id: conversationId,
        shopDomain: shopDomain,
        createdAt: now,
        updatedAt: now,
    });
  }

  async findAllByShop(shopDomainHash: string): Promise<Conversation[]> {
    const ref = this.conversationCollection.where('shopDomain', '==', shopDomainHash).orderBy('createdAt', 'desc');
    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
