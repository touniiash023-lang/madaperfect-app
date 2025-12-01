// firebase.js FINAL
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Permet de récupérer le rôle (admin ou commercial)
export const listenToUserRole = (callback) => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);

    const token = await user.getIdTokenResult(true);
    callback(token.claims.role || null);
  });
};
