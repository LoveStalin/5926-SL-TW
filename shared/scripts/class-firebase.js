import { initializeApp } from
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { getDatabase } from
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";


const classFirebaseConfig = {
    apiKey: "AIzaSyASwLRIHvF9qZQx8GRsC63kadfZIskKfOc",

    authDomain: "a5-k68.firebaseapp.com",

    databaseURL:
        "https://a5-k68-default-rtdb.asia-southeast1.firebasedatabase.app/",

    projectId: "a5-k68",

    storageBucket: "a5-k68.firebasestorage.app",

    messagingSenderId: "1066608071041",

    appId: "1:1066608071041:web:fa1c12f8c594253de2d880"
};


const classApp = initializeApp(
    classFirebaseConfig,
    "class-account-app"
);


export const classAuth = getAuth(classApp);

export const classDb = getDatabase(classApp);