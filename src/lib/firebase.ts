import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;
console.log("Firebase initialized with Database ID:", dbId);

// Silence verbose connection cancellation warnings from Firestore SDK
setLogLevel('silent');

export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, dbId);
export const auth = getAuth();

// Connection test removed to avoid unnecessary permission errors
