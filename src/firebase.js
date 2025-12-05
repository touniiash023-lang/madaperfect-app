// -------------------------------
// Firebase imports
// -------------------------------
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// -------------------------------
// Firebase configuration
// -------------------------------
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// -------------------------------
// Initialize Firebase services
// -------------------------------
export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// -------------------------------
// Listen to user role (admin / commercial)
// -------------------------------
export const listenToUserRole = (callback) => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);   // not logged
      return;
    }

    try {
      // Always refresh token to get the updated role
      const token = await user.getIdTokenResult(true);

      // Return role (admin, commercial, etc.)
      callback(token.claims.role || null);

    } catch (err) {
      console.error("Erreur récupération rôle:", err);
      callback(null);
    }
  });
};
