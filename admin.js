import { classAuth, classDb } from "./class-firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const WORKER_URL =
    "https://a5-k68-notification-worker.thanhnguyenxuan917.workers.dev";

const totalUsers = document.getElementById("totalUsers");
const adminUsers = document.getElementById("adminUsers");
const teacherUsers = document.getElementById("teacherUsers");
const studentUsers = document.getElementById("studentUsers");
const usersList = document.getElementById("usersList");
const searchInput = document.getElementById("searchInput");
const statusText = document.getElementById("status");
const logoutButton = document.getElementById("logoutButton");

const notificationForm = document.getElementById("notificationForm");
const notificationTitle = document.getElementById("notificationTitle");
const notificationMessage = document.getElementById("notificationMessage");
const notificationPinned = document.getElementById("notificationPinned");
const sendNotificationButton = document.getElementById(
    "sendNotificationButton"
);
const notificationStatus = document.getElementById("notificationStatus");

let users = [];
let currentAdmin = null;

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error", isError);
}

function setNotificationStatus(message, isError = false) {
    notificationStatus.textContent = message;
    notificationStatus.classList.toggle("error", isError);
}

function getInitial(name) {
    return (
        (name || "A").trim().charAt(0).toUpperCase() || "A"
    );
}

function roleLabel(role) {
    const roles = {
        admin: "Ban cán sự",
        teacher: "Thầy cô",
        student: "Học sinh"
    };

    return roles[role] || role || "Chưa cập nhật";
}

function renderStats() {
    totalUsers.textContent = users.length;

    adminUsers.textContent = users.filter(
        user => user.role === "admin"
    ).length;

    teacherUsers.textContent = users.filter(
        user => user.role === "teacher"
    ).length;

    studentUsers.textContent = users.filter(
        user => user.role === "student"
    ).length;
}

function renderUsers(keyword = "") {
    const normalizedKeyword = keyword.trim().toLowerCase();

    const filteredUsers = users.filter(user => {
        const searchableText = [
            user.displayName,
            user.email,
            user.role,
            user.className,
            user.group
        ]
            .join(" ")
            .toLowerCase();

        return searchableText.includes(normalizedKeyword);
    });

    usersList.innerHTML = "";

    if (filteredUsers.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                Không tìm thấy tài khoản phù hợp.
            </div>
        `;
        return;
    }

    filteredUsers
        .sort((first, second) =>
            (first.displayName || "").localeCompare(
                second.displayName || "",
                "vi"
            )
        )
        .forEach(user => {
            const row = document.createElement("article");
            row.className = "user-row";

            const name = user.displayName || "Class User";
            const email = user.email || "Không có email";
            const role = user.role || "unknown";
            const isActive = user.active === true;

            row.innerHTML = `
                <div class="user-main">
                    <div class="user-avatar">${getInitial(name)}</div>
                    <div>
                        <p class="user-name"></p>
                        <p class="user-email"></p>
                    </div>
                </div>

                <span class="user-role"></span>

                <span class="user-status ${isActive ? "" : "disabled"}">
                    ${isActive ? "Đang hoạt động" : "Tạm ẩn"}
                </span>
            `;

            row.querySelector(".user-name").textContent = name;
            row.querySelector(".user-email").textContent = email;
            row.querySelector(".user-role").textContent = roleLabel(role);

            usersList.appendChild(row);
        });
}

async function loadUsers() {
    const snapshot = await get(ref(classDb, "users"));

    if (!snapshot.exists()) {
        users = [];
        renderStats();
        renderUsers();
        return;
    }

    const data = snapshot.val();

    users = Object.entries(data).map(([uid, profile]) => ({
        uid,
        ...profile
    }));

    renderStats();
    renderUsers();
}

async function sendNotification(event) {
    event.preventDefault();

    if (!currentAdmin) {
        setNotificationStatus(
            "Chưa xác thực tài khoản quản trị.",
            true
        );
        return;
    }

    const title = notificationTitle.value.trim();
    const message = notificationMessage.value.trim();
    const pinned = notificationPinned.checked;

    if (!title || !message) {
        setNotificationStatus(
            "Hãy nhập đầy đủ tiêu đề và nội dung.",
            true
        );
        return;
    }

    if (title.length > 120) {
        setNotificationStatus(
            "Tiêu đề không được dài quá 120 ký tự.",
            true
        );
        return;
    }

    if (message.length > 2000) {
        setNotificationStatus(
            "Nội dung không được dài quá 2000 ký tự.",
            true
        );
        return;
    }

    const confirmed = window.confirm(
        `Gửi thông báo này đến các thiết bị đã bật push?\n\n` +
        `Tiêu đề: ${title}\n\n${message}`
    );

    if (!confirmed) {
        return;
    }

    sendNotificationButton.disabled = true;
    sendNotificationButton.textContent = "Đang gửi...";
    setNotificationStatus("Đang xác thực và gửi thông báo...");

    try {
        const idToken = await currentAdmin.getIdToken(true);

        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({
                title,
                message,
                pinned
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || `Worker trả về lỗi HTTP ${response.status}.`
            );
        }

        setNotificationStatus(
            `Đã gửi thành công. ` +
            `Đã gửi: ${result.sent || 0}; ` +
            `Thất bại: ${result.failed || 0}; ` +
            `Tổng thiết bị: ${result.totalTokens || 0}.`
        );

        notificationForm.reset();
    } catch (error) {
        console.error("Notification sending error:", error);

        setNotificationStatus(
            `Gửi thông báo thất bại: ${error.message}`,
            true
        );
    } finally {
        sendNotificationButton.disabled = false;
        sendNotificationButton.textContent = "Gửi thông báo →";
    }
}

onAuthStateChanged(classAuth, async user => {
    if (!user) {
        window.location.href = "./class-login.html";
        return;
    }

    currentAdmin = user;

    try {
        const ownProfileSnapshot = await get(
            ref(classDb, `users/${user.uid}`)
        );

        if (!ownProfileSnapshot.exists()) {
            await signOut(classAuth);
            window.location.href = "./class-login.html";
            return;
        }

        const ownProfile = ownProfileSnapshot.val();

        if (
            ownProfile.active !== true ||
            ownProfile.role !== "admin"
        ) {
            setStatus(
                "Tài khoản không có quyền truy cập khu vực quản trị.",
                true
            );

            setTimeout(() => {
                window.location.href = "./dashboard.html";
            }, 1500);

            return;
        }

        await loadUsers();

        setStatus("Đã xác thực quyền quản trị.");

        if (notificationForm) {
            notificationForm.addEventListener(
                "submit",
                sendNotification
            );
        }
    } catch (error) {
        console.error("Admin loading error:", error);

        setStatus(
            "Không thể tải danh sách tài khoản. Kiểm tra Firebase Rules.",
            true
        );
    }
});

if (searchInput) {
    searchInput.addEventListener("input", event => {
        renderUsers(event.target.value);
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Đang đăng xuất...";

        try {
            await signOut(classAuth);
            window.location.href = "./class-login.html";
        } catch (error) {
            console.error("Logout error:", error);

            logoutButton.disabled = false;
            logoutButton.textContent = "Đăng xuất";

            setStatus("Đăng xuất thất bại.", true);
        }
    });
}