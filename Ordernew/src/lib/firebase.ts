import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;
console.log("Firebase initialized with Database ID:", dbId);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, dbId);
export const auth = getAuth();

// Connection test removed to avoid unnecessary permission errors
