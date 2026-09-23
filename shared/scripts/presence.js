import { onAuthStateChanged } from
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    onDisconnect,
    onValue,
    push,
    ref,
    serverTimestamp,
    set
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export function startPresence(auth, database) {
    let statusRef = null;
    let stopConnectionListener = null;

    onAuthStateChanged(auth, async user => {
        if (stopConnectionListener) {
            stopConnectionListener();
            stopConnectionListener = null;
        }

        if (statusRef) {
            await set(statusRef, {
                connected: false,
                lastSeen: serverTimestamp()
            });
            statusRef = null;
        }

        if (!user) return;

        const connectionKey = push(ref(database, `presence/${user.uid}`)).key;
        statusRef = ref(
            database,
            `presence/${user.uid}/${connectionKey}`
        );

        const connectedRef = ref(database, ".info/connected");
        stopConnectionListener = onValue(connectedRef, async snapshot => {
            if (snapshot.val() !== true || !statusRef) return;

            const currentStatusRef = statusRef;

            try {
                await onDisconnect(currentStatusRef).set({
                    connected: false,
                    lastSeen: serverTimestamp()
                });

                await set(currentStatusRef, {
                    connected: true,
                    lastSeen: serverTimestamp()
                });
            } catch (error) {
                console.error(
                    "Không thể cập nhật presence. Hãy kiểm tra Firebase Realtime Database Rules.",
                    error
                );
            }
        });
    });
}