import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCESdNqE4J3FfVVFJTmyFEK1lJmB-tEPMI",
  authDomain: "project-70cbf.firebaseapp.com",
  databaseURL: "https://project-70cbf-default-rtdb.firebaseio.com",
  projectId: "project-70cbf",
  storageBucket: "project-70cbf.firebasestorage.app",
  messagingSenderId: "266192526810",
  appId: "1:266192526810:web:db8a75abeb35cc505a34e3"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
setPersistence(auth, browserLocalPersistence); 