import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCbyTKzz3z5b2dL87PUIU4JnaLH3tA5ioo",
    authDomain: "a5-5926-sl.firebaseapp.com",
    databaseURL: "https://a5-5926-sl-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "a5-5926-sl",
    storageBucket: "a5-5926-sl.firebasestorage.app",
    messagingSenderId: "401664459618",
    appId: "1:401664459618:web:49771b3e6f9fc221a2623b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue };