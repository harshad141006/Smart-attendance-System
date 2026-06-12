import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './index.js';

let firebaseAuth;
let firebaseDb;

try {
  // Initialize Firebase Admin with credentials
  const app = initializeApp({
    credential: cert({
      projectId: config.FIREBASE_PROJECT_ID,
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
      privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  // Get service instances
  firebaseAuth = getAuth(app);
  firebaseDb = getFirestore(app);
  
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  console.log('ℹ️  Running in demo mode without Firebase');
  firebaseAuth = null;
  firebaseDb = null;
}

export { firebaseAuth, firebaseDb };
export default { firebaseAuth, firebaseDb };
