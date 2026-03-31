import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBJWnOY8VNLzoO0Qgmn0GdkOy24k-y3vN0",
  authDomain: "johnsonfamilyapp.firebaseapp.com",
  projectId: "johnsonfamilyapp",
  storageBucket: "johnsonfamilyapp.firebasestorage.app",
  messagingSenderId: "934966255891",
  appId: "1:934966255891:web:c99efc1f8635b0da3e7ae6"
};

// Initialize the core Firebase application
export const app = initializeApp(firebaseConfig);

// Initialize Cloud Databases
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Authentication globally
export const auth = getAuth(app);
