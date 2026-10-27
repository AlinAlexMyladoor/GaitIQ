import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue, off, set } from "firebase/database";

// Environment-backed Firebase configuration
// Technical API configuration is loaded from build/runtime environment variables, not requested from end users in the monitoring UI.
const getEnvConfig = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://insole-4e4f4-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "insole-4e4f4",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
});

export const isFirebaseConfigValid = (cfg) => {
  if (!cfg) return false;
  return (
    typeof cfg.databaseURL === "string" &&
    cfg.databaseURL.startsWith("https://") &&
    !cfg.databaseURL.includes("YOUR_DATABASE_URL")
  );
};

let app = null;
let db = null;
let initError = null;

const config = getEnvConfig();

try {
  if (isFirebaseConfigValid(config)) {
    app = getApps().length > 0 ? getApp() : initializeApp(config);
    db = getDatabase(app);
  } else {
    initError = "Firebase database URL is not configured in environment variables.";
  }
} catch (err) {
  console.error("Firebase initialization failed:", err);
  initError = err.message;
}

export const getFirebaseConnectionInfo = () => {
  return {
    isConfigured: isFirebaseConfigValid(config) && db !== null,
    databaseURL: config.databaseURL || "Not configured",
    projectId: config.projectId || "Not configured",
    error: initError,
  };
};

export { app, db, ref, onValue, off, set, initError };
