import { Firestore } from "@google-cloud/firestore";
import { ChatRepository } from "app/domain/chat-repository";
import { CustomerAccountUrls } from "app/domain/customerAccountUrls";
import { CustomerToken } from "app/domain/customerToken";
import { Message } from "app/domain/message";

export class FirestoreChatRepository implements ChatRepository
{
  firestore: Firestore;
  constructor(firestore: Firestore){
    this.firestore = firestore;
  }

  async storeCodeVerifier(state: string, verifier: string): Promise<object> {
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

  async getCodeVerifier(state: string): Promise<object | null> {
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

  async storeCustomerToken(conversationId: string, accessToken: string, expiresAt: string): Promise<CustomerToken> {
    try {
      const tokensRef = this.firestore.collection('customerToken');
      const snapshot = await tokensRef
        .where('conversationId', '==', conversationId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const dataToUpdate = {
          accessToken,
          expiresAt: new Date(expiresAt),
          updatedAt: new Date(),
        };
        await doc.ref.update(dataToUpdate);
        return { id: doc.id, ...doc.data(), ...dataToUpdate } as CustomerToken;
      }

      const dataToCreate = {
        conversationId,
        accessToken,
        expiresAt: new Date(expiresAt),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const docRef = await tokensRef.add(dataToCreate);
      return { id: docRef.id, ...dataToCreate } as CustomerToken;
    } catch (error) {
      console.error('Error storing customer token:', error);
      throw error;
    }
  }

  async getCustomerToken(conversationId: string): Promise<CustomerToken | null> {
    try {
      const tokensRef = this.firestore.collection('customerToken');
      const snapshot = await tokensRef
        .where('conversationId', '==', conversationId)
        .where('expiresAt', '>', new Date())
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const token = { id: doc.id, ...doc.data() };

      return token as CustomerToken;
    } catch (error) {
      console.error('Error retrieving customer token:', error);
      return null;
    }
  }

  async createOrUpdateConversation(conversationId: string): Promise<object> {
    try {
      const docRef = this.firestore.collection('conversation').doc(conversationId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        return await docRef.update({
          updatedAt: new Date(),
        });
      }

      return await docRef.set({
        id: conversationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error creating/updating conversation:', error);
      throw error;
    }
  }

  async saveMessage(conversationId: string, role: string, content: string): Promise<Message> {
    try {
      await this.createOrUpdateConversation(conversationId);

      const message = {
        conversationId,
        role,
        content,
        createdAt: new Date(),
      };
      const docRef = await this.firestore.collection('conversation').doc(conversationId).collection('messages').add(message);
      return { id: docRef.id, ...message } as Message;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    try {
      const messagesRef = this.firestore.collection('conversation').doc(conversationId).collection('messages');
      const snapshot = await messagesRef
        .orderBy('createdAt', 'asc')
        .get();

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Message[];
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      return [];
    }
  }

  async storeCustomerAccountUrls({
    conversationId,
    mcpApiUrl,
    authorizationUrl,
    tokenUrl,
  }): Promise<object> {
    try {
      const docRef = this.firestore
        .collection('customerAccountUrls')
        .doc(conversationId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const dataToUpdate = {
          mcpApiUrl,
          authorizationUrl,
          tokenUrl,
          updatedAt: new Date(),
        };
        await docRef.update(dataToUpdate);
        return { ...docSnap.data(), ...dataToUpdate };
      } else {
        const dataToCreate = {
          conversationId,
          mcpApiUrl,
          authorizationUrl,
          tokenUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await docRef.set(dataToCreate);
        return dataToCreate;
      }
    } catch (error) {
      console.error('Error storing customer account URLs:', error);
      throw error;
    }
  }

  async getCustomerAccountUrls(conversationId: string): Promise<CustomerAccountUrls | null> {
    try {
      const docRef = this.firestore
        .collection('customerAccountUrls')
        .doc(conversationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();

      return data as CustomerAccountUrls;
    } catch (error) {
      console.error('Error retrieving customer account URLs:', error);
      return null;
    }
  }
}
