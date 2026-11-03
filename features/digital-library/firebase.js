// Firebase riêng cho A5 Digital Library.
// Không import hoặc dùng shared/scripts/class-firebase.js ở module này.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7bYdHCgP1VN47lZ51rtCbmJTPGNvdKYQ",
    authDomain: "a5-digital-library.firebaseapp.com",
    projectId: "a5-digital-library",
    storageBucket: "a5-digital-library.firebasestorage.app",
    messagingSenderId: "5148499914",
    appId: "1:5148499914:web:2ee62ca04bc2d7e454b933"
};

const libraryApp = initializeApp(firebaseConfig, "a5-digital-library");

export const libraryAuth = getAuth(libraryApp);
export const libraryDb = getFirestore(libraryApp);
