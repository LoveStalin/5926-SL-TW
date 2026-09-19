import { classAuth, classDb } from "../../shared/scripts/class-firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

const VAPID_KEY = "BN7OVxfwgAKxwXX7chYbsQUSHGsDeGpn7yiU5H2k-sifPYZL1kui1Vbh2BRoZTdp8_dvzH5EZ8zTCjqq2h5e3EU";
const WORKER_URL = "https://a5-k68-notification-worker.thanhnguyenxuan917.workers.dev";
const list = document.getElementById("notificationsList");
const enableButton = document.getElementById("enableNotifications");
const permissionText = document.getElementById("permissionText");
const statusText = document.getElementById("status");
const logoutButton = document.getElementById("logoutButton");
const notificationCount = document.getElementById("notificationCount");

let currentUser = null;
let canManageNotifications = false;

const app = initializeApp({
    apiKey: "AIzaSyASwLRIHvF9qZQx8GRsC63kadfZIskKfOc",
    authDomain: "a5-k68.firebaseapp.com",
    databaseURL: "https://a5-k68-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "a5-k68",
    storageBucket: "a5-k68.firebasestorage.app",
    messagingSenderId: "1066608071041",
    appId: "1:1066608071041:web:fa1c12f8c594253de2d880"
}, "class-messaging-app");

function showStatus(message, type = "") {
    statusText.className = `status-text ${type}`;
    statusText.textContent = message;
}

function renderNotifications(data) {
    list.innerHTML = "";
    const items = Object.entries(data || {}).sort((a, b) => {
        const pinnedOrder = Number(b[1].pinned === true)
            - Number(a[1].pinned === true);

        return pinnedOrder || (b[1].createdAt || 0) - (a[1].createdAt || 0);
    });

    notificationCount.textContent = items.length
        ? `${items.length} thông báo`
        : "Hộp thư trống";

    if (!items.length) {
        list.innerHTML = '<p class="empty-state">Chưa có thông báo nào.</p>';
        return;
    }

    for (const [notificationId, item] of items) {
        const article = document.createElement("article");
        article.className = `notification-item${item.pinned ? " notification-item--pinned" : ""}`;

        const icon = document.createElement("span");
        icon.className = "notification-item-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = item.pinned ? "⌖" : "✦";

        const content = document.createElement("div");
        content.className = "notification-item-content";

        const meta = document.createElement("div");
        meta.className = "notification-meta";

        const type = document.createElement("span");
        type.className = "notification-type";
        type.textContent = item.type || "Chung";

        const createdAt = item.createdAt ? new Date(item.createdAt) : null;
        const hasValidDate = createdAt && !Number.isNaN(createdAt.getTime());
        const time = document.createElement("time");
        time.textContent = hasValidDate
            ? createdAt.toLocaleString("vi-VN")
            : "Mới cập nhật";

        if (hasValidDate) {
            time.dateTime = createdAt.toISOString();
        }

        meta.append(type, time);

        if (item.pinned) {
            const pin = document.createElement("span");
            pin.className = "notification-pin";
            pin.textContent = "Đã ghim";
            meta.append(pin);
        }

        const title = document.createElement("h2");
        title.textContent = item.title || "Thông báo A5-K68";

        const message = document.createElement("p");
        message.textContent = item.message || "";

        content.append(meta, title, message);
        article.append(icon, content);

        if (canManageNotifications) {
            const actions = document.createElement("div");
            actions.className = "notification-actions";

            const pinButton = document.createElement("button");
            pinButton.type = "button";
            pinButton.className = "notification-action-button";
            pinButton.textContent = item.pinned ? "Bỏ ghim" : "Ghim";
            pinButton.setAttribute(
                "aria-label",
                `${item.pinned ? "Bỏ ghim" : "Ghim"} thông báo: ${item.title || "Thông báo A5-K68"}`
            );
            pinButton.addEventListener("click", () =>
                manageNotification(notificationId, "set-pinned", !item.pinned)
            );

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "notification-action-button notification-action-button--danger";
            deleteButton.textContent = "Xóa";
            deleteButton.setAttribute(
                "aria-label",
                `Xóa thông báo: ${item.title || "Thông báo A5-K68"}`
            );
            deleteButton.addEventListener("click", () =>
                manageNotification(notificationId, "delete-notification")
            );

            actions.append(pinButton, deleteButton);
            content.append(actions);
        }

        list.appendChild(article);
    }
}

async function loadNotifications() {
    const snapshot = await get(ref(classDb, "notifications"));
    renderNotifications(snapshot.exists() ? snapshot.val() : {});
}

async function manageNotification(notificationId, action, pinned) {
    if (!currentUser || !canManageNotifications) return;

    const isDeleting = action === "delete-notification";

    if (isDeleting && !window.confirm("Xóa thông báo này? Thao tác không thể hoàn tác.")) {
        return;
    }

    try {
        showStatus(isDeleting ? "Đang xóa thông báo..." : "Đang cập nhật trạng thái ghim...");

        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${await currentUser.getIdToken(true)}`
            },
            body: JSON.stringify({ action, notificationId, pinned })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || `Worker trả về lỗi HTTP ${response.status}.`);
        }

        showStatus(
            isDeleting
                ? "Đã xóa thông báo."
                : (pinned ? "Đã ghim thông báo." : "Đã bỏ ghim thông báo."),
            "success"
        );
        await loadNotifications();
    } catch (error) {
        showStatus(`Không thể cập nhật thông báo: ${error.message}`, "error");
    }
}

async function enablePush(user, askPermission = false) {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        permissionText.textContent = "Trình duyệt này không hỗ trợ thông báo web.";
        return false;
    }

    const supported = await isSupported();

    if (!supported) {
        permissionText.textContent =
            "Firebase Messaging chưa được hỗ trợ trên trình duyệt này.";
        return false;
    }

    let permission = Notification.permission;

    // Chỉ xin quyền khi người dùng thực sự bấm nút
    if (permission === "default" && askPermission) {
        permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
        if (permission === "denied") {
            permissionText.textContent =
                "Thông báo đang bị chặn trong cài đặt trình duyệt.";
        } else {
            permissionText.textContent =
                "Bấm 'Bật thông báo' để nhận thông báo từ A5-K68.";
        }

        return false;
    }

    // Permission đã được cấp → không hỏi lại
    const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
    );

    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
    });

    if (!token) {
        throw new Error("Firebase không cấp được FCM token.");
    }

    await set(
        ref(
            classDb,
            `users/${user.uid}/fcmTokens/${encodeURIComponent(token)}`
        ),
        {
            token,
            createdAt: Date.now(),
            userAgent: navigator.userAgent
        }
    );

    permissionText.textContent = "Đã bật thông báo trên máy này ✅";
    enableButton.textContent = "Đã bật";
    enableButton.disabled = true;

    onMessage(messaging, (payload) => {
        const title =
            payload.notification?.title ||
            "A5-K68 có thông báo mới";

        const body =
            payload.notification?.body ||
            "Mở trang thông báo để xem chi tiết.";

        showStatus(`${title}: ${body}`, "success");
        loadNotifications();
    });

    return true;
}

onAuthStateChanged(classAuth, async (user) => {
    if (!user) {
        window.location.href = "../auth/class-login.html";
        return;
    }
    try {
        currentUser = user;
        const ownProfileSnapshot = await get(ref(classDb, `users/${user.uid}`));
        const ownProfile = ownProfileSnapshot.exists()
            ? ownProfileSnapshot.val()
            : null;
        canManageNotifications = ownProfile?.active === true
            && ["admin", "teacher"].includes(ownProfile?.role);

        await loadNotifications();

if (Notification.permission === "granted") {
    await enablePush(user);
} else {
    enableButton.addEventListener("click", () => enablePush(user).catch(error => showStatus("Không thể bật thông báo: " + error.message, "error")));
}

} catch (error) {

showStatus("Không thể tải thông báo: " + error.message, "error");

}
});

logoutButton.addEventListener("click", async () => {
    await signOut(classAuth);
    window.location.href = "../auth/class-login.html";
});
