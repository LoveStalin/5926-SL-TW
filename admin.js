import { classAuth, classDb } from "./class-firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const totalUsers = document.getElementById("totalUsers");
const adminUsers = document.getElementById("adminUsers");
const teacherUsers = document.getElementById("teacherUsers");
const studentUsers = document.getElementById("studentUsers");
const usersList = document.getElementById("usersList");
const searchInput = document.getElementById("searchInput");
const statusText = document.getElementById("status");
const logoutButton = document.getElementById("logoutButton");

let users = [];

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error", isError);
}

function getInitial(name) {
    return (name || "A").trim().charAt(0).toUpperCase() || "A";
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
    adminUsers.textContent = users.filter(user => user.role === "admin").length;
    teacherUsers.textContent = users.filter(user => user.role === "teacher").length;
    studentUsers.textContent = users.filter(user => user.role === "student").length;
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
        ].join(" ").toLowerCase();

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

onAuthStateChanged(classAuth, async user => {
    if (!user) {
        window.location.href = "./class-login.html";
        return;
    }

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

        if (ownProfile.active !== true || ownProfile.role !== "admin") {
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
    } catch (error) {
        console.error("Admin loading error:", error);
        setStatus(
            "Không thể tải danh sách tài khoản. Kiểm tra Firebase Rules.",
            true
        );
    }
});

searchInput.addEventListener("input", event => {
    renderUsers(event.target.value);
});

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
