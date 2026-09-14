import {
    classAuth,
    classDb
} from "./class-firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";


const displayName = document.getElementById("displayName");
const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const topbarUser = document.getElementById("topbarUser");

const roleTag = document.getElementById("roleTag");
const classTag = document.getElementById("classTag");
const avatar = document.getElementById("avatar");

const adminPanel = document.getElementById("adminPanel");
const statusText = document.getElementById("status");
const logoutButton = document.getElementById("logoutButton");


onAuthStateChanged(classAuth, async (user) => {
    if (!user) {
        window.location.href = "./class-login.html";
        return;
    }

    try {
        const userSnapshot = await get(
            ref(classDb, `users/${user.uid}`)
        );

        if (!userSnapshot.exists()) {
            await signOut(classAuth);

            alert(
                "Tài khoản chưa có hồ sơ trong hệ thống."
            );

            window.location.href = "./class-login.html";
            return;
        }

        const userData = userSnapshot.val();

        if (userData.active !== true) {
            await signOut(classAuth);

            alert(
                "Tài khoản này đang bị khóa hoặc chưa được kích hoạt."
            );

            window.location.href = "./class-login.html";
            return;
        }

        const name =
            userData.displayName ||
            userData.username ||
            "Thành viên 11A5";

        const role =
            userData.role ||
            "student";

        displayName.textContent = name;
        accountName.textContent = name;
        accountEmail.textContent = user.email;

        topbarUser.textContent = user.email;

        roleTag.textContent = role;
        classTag.textContent =
            userData.className || "11A5";

        avatar.textContent =
            name.charAt(0).toUpperCase();

        if (role === "admin" || role === "teacher") {
            adminPanel.classList.remove("hidden");
        }

        statusText.textContent =
            "Tài khoản đã được xác thực thành công.";

        console.log("Dashboard user:", {
            uid: user.uid,
            email: user.email,
            profile: userData
        });

    } catch (error) {
        console.error(
            "Không thể tải profile:",
            error
        );

        statusText.className = "status-text error";

        statusText.textContent =
            "Không thể tải thông tin tài khoản: " +
            error.message;
    }
});


logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Đang đăng xuất...";

    try {
        await signOut(classAuth);

        window.location.href = "./class-login.html";

    } catch (error) {
        console.error(
            "Lỗi đăng xuất:",
            error
        );

        logoutButton.disabled = false;
        logoutButton.textContent = "Đăng xuất";
    }
});