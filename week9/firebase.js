import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAo_UrEPe3D837sFXzBTgM8fB7F7Sktiec",
  authDomain: "shared-minds-b2486.firebaseapp.com",
  projectId: "shared-minds-b2486",
  storageBucket: "shared-minds-b2486.firebasestorage.app",
  messagingSenderId: "1046534521025",
  appId: "1:1046534521025:web:5be683ff2e76c7cd95d440",
  measurementId: "G-BZE47BG1DF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Save a thought to Firestore
export async function saveThought(thoughtText) {
  try {
    const docRef = await addDoc(collection(db, "thoughts"), {
      text: thoughtText,
      timestamp: new Date()
    });
    console.log("Thought saved with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving thought:", error);
    throw error;
  }
}

// Load all thoughts from Firestore
export async function loadThoughts() {
  try {
    const querySnapshot = await getDocs(collection(db, "thoughts"));
    const thoughts = [];
    querySnapshot.forEach((doc) => {
      thoughts.push({
        id: doc.id,
        text: doc.data().text,
        timestamp: doc.data().timestamp
      });
    });
    console.log("Loaded", thoughts.length, "thoughts from Firestore");
    return thoughts;
  } catch (error) {
    console.error("Error loading thoughts:", error);
    throw error;
  }
}
