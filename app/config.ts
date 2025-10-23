import { Firestore } from '@google-cloud/firestore';
import { StoreSessionStorageService } from './services/sessionStorage.service';
import { FirestoreSessionStorageRepository } from './infrastructure/firestore-session-repository';
import { FirestoreChatRepository } from './infrastructure/firestore-chat-repository';
let firestore: Firestore;

if (process.env.NODE_ENV !== 'production') {
  firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
} else {
  firestore = new Firestore();
}

const storeSessionStorageRepository = new FirestoreSessionStorageRepository(firestore);

const storeSessionStorageService = new StoreSessionStorageService(storeSessionStorageRepository);

const chatRepository = new FirestoreChatRepository(firestore);

export { firestore, storeSessionStorageService, chatRepository };
