importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyASwLRIHvF9qZQx8GRsC63kadfZIsKkFoc",
    authDomain: "a5-k68.firebaseapp.com",
    databaseURL: "https://a5-k68-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "a5-k68",
    storageBucket: "a5-k68.firebasestorage.app",
    messagingSenderId: "1066608071041",
    appId: "1:1066608071041:web:fa1c12f8c594253de2d880"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "A5-K68 có thông báo mới";
    const options = {
        body: payload.notification?.body || "Mở website để xem chi tiết.",
        icon: "/favicon.ico",
        data: { url: payload.data?.url || "/features/notifications/notifications.html" }
    };
    self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || "/features/notifications/notifications.html", self.location.origin).href;
    event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
            if (client.url.startsWith(self.location.origin) && "focus" in client) {
                client.navigate(targetUrl);
                return client.focus();
            }
        }
        return clients.openWindow(targetUrl);
    }));
});