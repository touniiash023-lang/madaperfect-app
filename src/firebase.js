import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";   // ✅ AJOUT STORAGE

// 🔐 Configuration via .env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// 🔥 Initialisation app Firebase
export const app = initializeApp(firebaseConfig);

// 🔐 Authentification
export const auth = getAuth(app);

// 🗄️ Firestore
export const db = getFirestore(app);

// 🖼️ STORAGE — nécessaire pour afficher ou uploader les images !
export const storage = getStorage(app);   // ✅ IMPORTANT !

// 🎭 Récupération automatique du rôle (admin, commercial...)
export const listenToUserRole = (callback) => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);

    // Récupère les custom claims
    const token = await user.getIdTokenResult(true);
    callback(token.claims.role || null);
  });
};
