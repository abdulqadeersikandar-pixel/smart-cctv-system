import admin from 'firebase-admin';
import { env } from './env.js';

let app = null;
let firestore = null;

const hasCredentials =
  Boolean(env.firebaseProjectId) &&
  Boolean(env.firebaseClientEmail) &&
  Boolean(env.firebasePrivateKey);

if (hasCredentials) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey.replace(/\\n/g, '\n'),
    }),
  });
  firestore = admin.firestore(app);
}

export const hasFirebaseAdmin = hasCredentials;

export async function verifyFirebaseToken(idToken) {
  if (!app) {
    throw new Error('Firebase Admin SDK is not configured on the server.');
  }
  return admin.auth(app).verifyIdToken(idToken);
}

export function getFirestore() {
  if (!firestore) {
    throw new Error('Firestore is unavailable because Firebase Admin is not configured.');
  }
  return firestore;
}
