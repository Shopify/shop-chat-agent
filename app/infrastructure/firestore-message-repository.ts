import { Firestore, Timestamp } from "@google-cloud/firestore";
import { MessageRepository } from "app/domain/message-repository";
import { Message } from "app/domain/message";

const messageConverter = {
  toFirestore(data: Message): FirebaseFirestore.DocumentData {
    return {
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt,
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Message {
    const data = snapshot.data();
    return {
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
    };
  }
};

export class FirestoreMessageRepository implements MessageRepository {
  constructor(private readonly firestore: Firestore) {
  }

  private getMessagesCollection(conversationId: string): FirebaseFirestore.CollectionReference<Message> {
    return this.firestore
      .collection('conversation')
      .doc(conversationId)
      .collection('messages')
      .withConverter(messageConverter);
  }

  async save(conversationId: string, role: 'user' | 'assistant', content: string): Promise<Message> {
    const message: Message = {
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    const docRef = await this.getMessagesCollection(conversationId).add(message);
    const createdDoc = await docRef.get();
    return createdDoc.data() as Message;
  }

  async find(conversationId: string): Promise<Message[]> {
    const messagesRef = this.getMessagesCollection(conversationId);
    const snapshot = await messagesRef
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => doc.data());
  }
}
