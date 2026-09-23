import { onAuthStateChanged, signOut } from
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { ref, get } from
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { classAuth, classDb } from "../../shared/scripts/class-firebase.js";
import { startPresence } from "../../shared/scripts/presence.js";

const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileRole = document.getElementById("profileRole");
const profileClass = document.getElementById("profileClass");
const profileGroup = document.getElementById("profileGroup");
const profileStatus = document.getElementById("profileStatus");

const accessTitle = document.getElementById("accessTitle");
const accessDescription = document.getElementById("accessDescription");

const logoutButton = document.getElementById("logoutButton");
const statusText = document.getElementById("status");

startPresence(classAuth, classDb);

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error", isError);
}

function getInitial(name) {
    if (!name || typeof name !== "string") {
        return "A";
    }

    return name.trim().charAt(0).toUpperCase() || "A";
}

function formatRole(role) {
    if (!role) {
        return "Chưa xác định";
    }

    const roleNames = {
        admin: "Administrator",
        teacher: "Teacher",
        student: "Student"
    };

    return roleNames[role] || role;
}

function renderProfile(user, profile) {
    const displayName =
        profile.displayName ||
        user.displayName ||
        "Class User";

    const role = profile.role || "unknown";
    const className = profile.className || "Chưa cập nhật";
    const group = profile.group || "Chưa cập nhật";
    const active = profile.active === true;

    profileAvatar.textContent = getInitial(displayName);
    profileName.textContent = displayName;
    profileEmail.textContent = user.email || "Không có email";

    profileRole.textContent = formatRole(role);
    profileClass.textContent = className;
    profileGroup.textContent = group;

    profileStatus.textContent = active
        ? "Đang hoạt động"
        : "Đã vô hiệu hóa";

    profileStatus.classList.toggle("active-status", active);

    if (role === "admin") {
        accessTitle.textContent = "Administrator";

        accessDescription.textContent =
            "Tài khoản này có quyền quản trị hệ thống " +
            "Class Account của A5-K68.";
    } else if (role === "teacher") {
        accessTitle.textContent = "Teacher";

        accessDescription.textContent =
            "Tài khoản giáo viên trong hệ thống Class Account.";
    } else {
        accessTitle.textContent = "Student";

        accessDescription.textContent =
            "Tài khoản học sinh thuộc tập thể A5-K68.";
    }

    setStatus("Hồ sơ đã được xác thực thành công.");
}

onAuthStateChanged(classAuth, async (user) => {
    if (!user) {
        window.location.href = "../auth/class-login.html";
        return;
    }

    try {
        setStatus("Đang tải thông tin hồ sơ...");

        const profileRef = ref(classDb, `users/${user.uid}`);
        const snapshot = await get(profileRef);

        if (!snapshot.exists()) {
            setStatus(
                "Không tìm thấy dữ liệu hồ sơ tài khoản.",
                true
            );

            return;
        }

        const profile = snapshot.val();

        if (profile.active !== true) {
            setStatus(
                "Tài khoản này hiện không hoạt động.",
                true
            );

            return;
        }

        renderProfile(user, profile);
    } catch (error) {
        console.error("Profile loading error:", error);

        setStatus(
            "Không thể tải hồ sơ. Kiểm tra Firebase Rules.",
            true
        );
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Đang đăng xuất...";

    try {
        await signOut(classAuth);
        window.location.href = "../auth/class-login.html";
    } catch (error) {
        console.error("Logout error:", error);

        logoutButton.disabled = false;
        logoutButton.textContent = "Đăng xuất";

        setStatus(
            "Đăng xuất thất bại. Vui lòng thử lại.",
            true
        );
    }
});