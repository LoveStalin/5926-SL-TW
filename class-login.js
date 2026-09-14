import {
    classAuth,
    classDb
} from "./class-firebase.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

console.log("class-login.js đã chạy");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const statusText = document.getElementById("status");

if (!loginForm) {
    console.error("Không tìm thấy loginForm");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    console.log("Form submit đã bị chặn");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    loginButton.disabled = true;
    loginButton.textContent = "Đang đăng nhập...";
    statusText.className = "";
    statusText.textContent = "Đang kiểm tra tài khoản...";

    try {
        console.log("Đang đăng nhập:", email);

        const userCredential =
            await signInWithEmailAndPassword(
                classAuth,
                email,
                password
            );

        const user = userCredential.user;

        console.log("Firebase Auth thành công:", user.uid);

        const userSnapshot = await get(
            ref(classDb, `users/${user.uid}`)
        );

        if (!userSnapshot.exists()) {
            await signOut(classAuth);

            throw new Error(
                "Tài khoản đã tồn tại nhưng chưa có profile trong Database."
            );
        }

        const userData = userSnapshot.val();

        if (userData.active !== true) {
            await signOut(classAuth);

            throw new Error(
                "Tài khoản đang bị khóa hoặc chưa được kích hoạt."
            );
        }

        statusText.className = "success";

        statusText.textContent =
            "Đăng nhập thành công!\n\n" +
            `Tên: ${userData.displayName}\n` +
            `Vai trò: ${userData.role}\n` +
            `Lớp: ${userData.className}`;

        console.log("Profile:", userData);

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);

        statusText.className = "error";

        statusText.textContent =
            "Đăng nhập thất bại:\n" +
            error.message;

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Đăng nhập";
    }
});

onAuthStateChanged(classAuth, (user) => {
    if (user) {
        console.log("Auth state: đang đăng nhập", user.email);
    } else {
        console.log("Auth state: chưa đăng nhập");
    }
});