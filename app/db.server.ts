import { Firestore } from '@google-cloud/firestore';
import { CustomerAccountUrls } from './domain/customerAccountUrls';
import { Message } from './domain/message';
import { CustomerToken } from './domain/customerToken';

let firestore: Firestore;

if (process.env.NODE_ENV !== 'production') {
  firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
} else {
  firestore = new Firestore();
}

export default firestore;

/**
 * Store a code verifier for PKCE authentication
 * @param {string} state - The state parameter used in OAuth flow
 * @param {string} verifier - The code verifier to store
 * @returns {Promise<Object>} - The saved code verifier object
 */
export async function storeCodeVerifier(state: string, verifier: string) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  try {
    const dataToStore = {
      state,
      verifier,
      expiresAt,
      createdAt: new Date(),
    };
    const docRef = await firestore.collection('codeVerifier').add(dataToStore);
    return { id: docRef.id, ...dataToStore };
  } catch (error) {
    console.error('Error storing code verifier:', error);
    throw error;
  }
}

/**
 * Get a code verifier by state parameter
 * @param {string} state - The state parameter used in OAuth flow
 * @returns {Promise<Object|null>} - The code verifier object or null if not found
 */
export async function getCodeVerifier(state: string) {
  try {
    const verifierRef = firestore.collection('codeVerifier');
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

    // Delete it after retrieval to prevent reuse
    await doc.ref.delete();

    return verifier;
  } catch (error) {
    console.error('Error retrieving code verifier:', error);
    return null;
  }
}

/**
 * Store a customer access token in the database
 * @param {string} conversationId - The conversation ID to associate with the token
 * @param {string} accessToken - The access token to store
 * @param {Date} expiresAt - When the token expires
 * @returns {Promise<Object>} - The saved customer token
 */
export async function storeCustomerToken(
  conversationId: string,
  accessToken: string,
  expiresAt: string,
): Promise<CustomerToken> {
  try {
    const tokensRef = firestore.collection('customerToken');
    const snapshot = await tokensRef
      .where('conversationId', '==', conversationId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      // Update existing token
      const doc = snapshot.docs[0];
      const dataToUpdate = {
        accessToken,
        expiresAt: new Date(expiresAt),
        updatedAt: new Date(),
      };
      await doc.ref.update(dataToUpdate);
      return { id: doc.id, ...doc.data(), ...dataToUpdate } as CustomerToken;
    }

    // Create a new token record
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

/**
 * Get a customer access token by conversation ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer token or null if not found/expired
 */
export async function getCustomerToken(conversationId: string): Promise<CustomerToken|null> {
  try {
    const tokensRef = firestore.collection('customerToken');
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

/**
 * Create or update a conversation in the database
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} - The created or updated conversation
 */
export async function createOrUpdateConversation(conversationId: string): Promise<object> {
  try {
    const docRef = firestore.collection('conversation').doc(conversationId);
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

/**
 * Save a message to the database
 * @param {string} conversationId - The conversation ID
 * @param {string} role - The message role (user or assistant)
 * @param {string} content - The message content
 * @returns {Promise<Message>} - The saved message
 */
export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<Message> {
  try {
    // Ensure the conversation exists
    await createOrUpdateConversation(conversationId);

    // Create the message
    const message = {
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    const docRef = await firestore.collection('conversation').doc(conversationId).collection('messages').add(message);
    return { id: docRef.id, ...message } as Message;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Get conversation history
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Message>} - Array of messages in the conversation
 */
export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  try {
    const messagesRef = firestore.collection('conversation').doc(conversationId).collection('messages');
    const snapshot = await messagesRef
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Message[];
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return [];
  }
}

/**
 * Store customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} mcpApiUrl - The customer account MCP URL
 * @param {string} authorizationUrl - The customer account authorization URL
 * @param {string} tokenUrl - The customer account token URL
 * @returns {Promise<Object>} - The saved urls object
 */
export async function storeCustomerAccountUrls({
  conversationId,
  mcpApiUrl,
  authorizationUrl,
  tokenUrl,
}): Promise<object> {
  try {
    const docRef = firestore
      .collection('customerAccountUrls')
      .doc(conversationId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      // Document exists, update it
      const dataToUpdate = {
        mcpApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      };
      await docRef.update(dataToUpdate);
      return { ...docSnap.data(), ...dataToUpdate };
    } else {
      // Document doesn't exist, create it
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

/**
 * Get customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {CustomerAccountUrls|null} - The customer account URLs or null if not found
 */
export async function getCustomerAccountUrls(conversationId: string): Promise<CustomerAccountUrls|null> {
  try {
    const docRef = firestore
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
