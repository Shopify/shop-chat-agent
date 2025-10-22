import { Firestore } from '@google-cloud/firestore';

// export const firebaseConfig = {
//   apiKey: process.env.FIREBASE_API_KEY,
//   authDomain: process.env.FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.FIREBASE_PROJECT_ID,
//   storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.FIREBASE_APP_ID,
// };

// Create a new client
export const firestore = new Firestore({
  projectId: 'esquad-shopify-chat-agent',
  keyFilename: './.gcp-sa-el-local.json',
});


try{
  await firestore.collection("test").add({
    foo: "bar"
  });

}
catch (error) {
  console.error(error);
}
// if (process.env.NODE_ENV !== "production") {

// }


/**
 * Store a code verifier for PKCE authentication
 * @param {string} state - The state parameter used in OAuth flow
 * @param {string} verifier - The code verifier to store
 * @returns {Promise<Object>} - The saved code verifier object
 */
export async function storeCodeVerifier(state, verifier) {
  // Calculate expiration date (10 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  try {
    return await prisma.codeVerifier.create({
      data: {
        id: `cv_${Date.now()}`,
        state,
        verifier,
        expiresAt
      }
    });
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
export async function getCodeVerifier(state) {
  try {
    const verifier = await prisma.codeVerifier.findFirst({
      where: {
        state,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (verifier) {
      // Delete it after retrieval to prevent reuse
      await prisma.codeVerifier.delete({
        where: {
          id: verifier.id
        }
      });
    }

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
export async function storeCustomerToken(conversationId: string, accessToken: string, expiresAt: string) {
  try {
    // Check if a token already exists for this conversation
    const existingToken = await firestore.customerToken.findFirst({
      where: { conversationId }
    });

    if (existingToken) {
      // Update existing token
      return await firestore.customerToken.update({
        where: { id: existingToken.id },
        data: {
          accessToken,
          expiresAt,
          updatedAt: new Date()
        }
      });
    }

    // Create a new token record
    return await firestore.customerToken.create({
      data: {
        id: `ct_${Date.now()}`,
        conversationId,
        accessToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
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
export async function getCustomerToken(conversationId) {
  try {
    const tokensRef = firestore.collection("customerToken");
    const snapshot = await tokensRef
      .where("conversationId", "==", conversationId)
      .where("expiresAt", ">", new Date())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const token = { id: doc.id, ...doc.data() };

    return token;
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
export async function createOrUpdateConversation(conversationId: string) {
  // const docRef = firestore.collection("conversation").doc(conversationId);

  // if ((await docRef.get()).exists) {
  //   return docRef.update({
  //     updatedAt: new Date()
  //   });
  // }

  // return docRef.create({
  //   id: conversationId
  // });


  try {
  const docRef = firestore.collection("conversation").doc(conversationId);
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
 * @returns {Promise<Object>} - The saved message
 */
export async function saveMessage(conversationId, role, content) {
  try {// Ensure the conversation exists
  await createOrUpdateConversation(conversationId);

  // Create the message
  const message = {
    conversationId,
    role,
    content,
    createdAt: new Date(),
  };
  const docRef = await firestore.collection("message").add(message);
  return { id: docRef.id, ...message };
} catch (error) {
  console.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Get conversation history
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} - Array of messages in the conversation
 */
export async function getConversationHistory(conversationId) {
  try {
    const messagesRef = firestore.collection("message");
    const snapshot = await messagesRef
    .where("conversationId", "==", conversationId)
    .orderBy("createdAt", "asc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
export async function storeCustomerAccountUrls({conversationId, mcpApiUrl, authorizationUrl, tokenUrl}) {

  firestore.collection("customerAccountUrls").doc(conversationId).set({
    conversationId,
    mcpApiUrl,
    authorizationUrl,
    tokenUrl,
    updatedAt: new Date(),
  });


  // try {
  //   return await firestore.customerAccountUrls.upsert({
  //     where: { conversationId },
  //     create: {
  //       conversationId,
  //       mcpApiUrl,
  //       authorizationUrl,
  //       tokenUrl,
  //       updatedAt: new Date(),
  //     },
  //     update: {
  //       mcpApiUrl,
  //       authorizationUrl,
  //       tokenUrl,
  //       updatedAt: new Date(),
  //     },
  //   });
  // } catch (error) {
  //   console.error('Error storing customer account URLs:', error);
  //   throw error;
  // }
}

/**
 * Get customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {Object|null} - The customer account URLs or null if not found
 */
export async function getCustomerAccountUrls(conversationId: string) {
  const docRef = firestore.collection("customerAccountUrls").doc(conversationId);

  const doc = await docRef.get();
  console.log(`getCustomerAccountUrls 2 -> ${conversationId}`, doc);
  if (!doc.exists) {
    console.error('Error retrieving customer account URLs:');
    return null;
  }

  const customerAccountUrls = doc.data();
  if (!customerAccountUrls) {
    console.error('Error retrieving customer account URLs:');
    return null;
  }

  return customerAccountUrls;

  // try {
  //   return await firestore.customerAccountUrls.findUnique({
  //     where: { conversationId }
  //   });
  // } catch (error) {
  //   console.error('Error retrieving customer account URLs:', error);
  //   return null;
  // }
}
