import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Support both build-time Vite environment variables and runtime container injection
const runtimeConfig = typeof window !== 'undefined' ? (window as any).__EXAMFLOW_CONFIG__ : null;

const apiKey =
  import.meta.env.VITE_FIREBASE_API_KEY ||
  runtimeConfig?.apiKey ||
  '';

const authDomain =
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
  runtimeConfig?.authDomain ||
  'online-examamination.firebaseapp.com';

const projectId =
  import.meta.env.VITE_FIREBASE_PROJECT_ID ||
  runtimeConfig?.projectId ||
  'online-examamination';

const storageBucket =
  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
  runtimeConfig?.storageBucket ||
  'online-examamination.firebasestorage.app';

const messagingSenderId =
  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
  runtimeConfig?.messagingSenderId ||
  '219771742130';

const appId =
  import.meta.env.VITE_FIREBASE_APP_ID ||
  runtimeConfig?.appId ||
  '1:219771742130:web:5744e7caae7db4944026ab';

export const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
