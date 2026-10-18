import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import { firebaseConfig } from './firebase-config.js';

// `npm run dev:emulators` liga este modo: login e banco rodam nos emuladores locais, sem projeto real.
const useEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === 'true';

const EMULATOR_CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-ypt.firebaseapp.com',
  databaseURL: 'https://demo-ypt-default-rtdb.firebaseio.com',
  projectId: 'demo-ypt',
  appId: 'demo-app',
};

const config = useEmulators ? EMULATOR_CONFIG : firebaseConfig;

if (config && !config.databaseURL) {
  console.warn('firebaseConfig sem databaseURL: crie o Realtime Database no console e copie a URL dele para src/firebase-config.js.');
}

export const firebaseReady = Boolean(config?.apiKey && config?.databaseURL);
export const app = firebaseReady ? initializeApp(config) : null;
// initializeAuth em vez de getAuth: não carrega o iframe de login por popup, que trava dentro do WebView do Capacitor.
export const auth = app ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }) : null;
export const db = app ? getDatabase(app) : null;

if (app && useEmulators) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(db, host, 9000);
}
