// Connects Monee to your Firebase project (values come from .env)
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// false = something is missing from .env (the app shows a setup message instead of crashing)
export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

export const app = firebaseReady ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

// Login. On phones we save the login in AsyncStorage, so you stay logged in after closing the app.
function makeAuth() {
  if (!app) return null;
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app); // the browser remembers logins by itself
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: FirebaseAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // Already set up (happens when Fast Refresh reloads this file)
    return FirebaseAuth.getAuth(app);
  }
}
export const auth = makeAuth();

// Database
function makeDb() {
  if (!app) return null;
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true, // empty fields are skipped instead of causing errors
      experimentalAutoDetectLongPolling: true, // more reliable connection on phones
    });
  } catch (e) {
    return getFirestore(app);
  }
}
export const db = makeDb();
