import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize App Check — prevents unauthorized clients from calling Firebase APIs.
// In development, uses a debug token generated in the Firebase Console.
// Production requires a reCAPTCHA Enterprise site key.
const APP_CHECK_SITE_KEY = import.meta.env.VITE_APP_CHECK_SITE_KEY as string | undefined;

if (APP_CHECK_SITE_KEY) {
  // Production: reCAPTCHA Enterprise

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.DEV) {
  // Development: self-signed debug tokens (see Firebase Console → App Check → Apps)
  // Add `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` in the browser console to get a token.

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('dev-token-placeholder'),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn(
    '[App Check] Not initialized — set VITE_APP_CHECK_SITE_KEY to enable. Firebase APIs are unprotected.'
  );
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Enable offline persistence (IndexedDB-backed)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence failed: Browser not supported');
  }
});

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  code?: string;
  operationType: OperationType;
  path: string | null;
  userId?: string;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    code,
    operationType,
    path,
    userId: auth.currentUser?.uid,
  };
  console.error('Firestore Error:', errInfo);
}
