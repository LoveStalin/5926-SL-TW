import { libraryAuth, libraryDb } from "./firebase.js";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authStatus = document.getElementById("authStatus");
const libraryStatus = document.getElementById("libraryStatus");
const libraryGrid = document.getElementById("libraryGrid");
const modeButtons = [...document.querySelectorAll("[data-mode]")];

let authMode = "login";

function setAuthMode(mode) {
    authMode = mode;
    modeButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.mode === mode);
    });
    authSubmit.textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
    authPassword.autocomplete = mode === "login" ? "current-password" : "new-password";
    authStatus.textContent = "";
}

modeButtons.forEach(button => {
    button.addEventListener("click", () => setAuthMode(button.dataset.mode));
});

authForm.addEventListener("submit", async event => {
    event.preventDefault();
    authSubmit.disabled = true;
    authStatus.textContent = "Đang xử lý...";

    const email = authEmail.value.trim();
    const password = authPassword.value;

    try {
        if (authMode === "register") {
            const credential = await createUserWithEmailAndPassword(libraryAuth, email, password);
            await sendEmailVerification(credential.user);
            await signOut(libraryAuth);
            authStatus.textContent = "Đã tạo tài khoản. Hãy mở email để xác minh trước khi đăng nhập.";
        } else {
            const credential = await signInWithEmailAndPassword(libraryAuth, email, password);
            await credential.user.reload();

            if (!libraryAuth.currentUser?.emailVerified) {
                await signOut(libraryAuth);
                authStatus.textContent = "Email chưa được xác minh. Hãy kiểm tra hộp thư và xác minh email trước.";
                return;
            }

            authStatus.textContent = "Đăng nhập thành công. Tài khoản đã được xác minh.";
        }
    } catch (error) {
        const messages = {
            "auth/email-already-in-use": "Email này đã được đăng ký.",
            "auth/invalid-email": "Địa chỉ email không hợp lệ.",
            "auth/weak-password": "Mật khẩu chưa đủ mạnh (tối thiểu 6 ký tự).",
            "auth/invalid-credential": "Email hoặc mật khẩu không chính xác.",
            "auth/too-many-requests": "Có quá nhiều lần thử. Hãy đợi một chút rồi thử lại."
        };
        authStatus.textContent = messages[error.code] || "Không thể xử lý yêu cầu. Kiểm tra cấu hình Firebase và thử lại.";
        console.error("Digital Library Authentication:", error);
    } finally {
        authSubmit.disabled = false;
    }
});

async function loadPublishedItems() {
    try {
        const publishedQuery = query(
            collection(libraryDb, "libraryItems"),
            where("status", "==", "published"),
            orderBy("publishedAt", "desc"),
            limit(24)
        );
        const snapshot = await getDocs(publishedQuery);

        libraryGrid.replaceChildren();
        if (snapshot.empty) {
            libraryStatus.textContent = "Chưa có tài liệu nào được xuất bản.";
            return;
        }

        snapshot.forEach(documentSnapshot => {
            const item = documentSnapshot.data();
            const card = document.createElement("article");
            card.className = "book-card";

            const type = document.createElement("span");
            type.className = "book-type";
            type.textContent = item.type || "Tài liệu";

            const title = document.createElement("h3");
            title.textContent = item.title || "Tài liệu chưa có tiêu đề";

            const description = document.createElement("p");
            description.textContent = item.description || "Chưa có mô tả.";

            card.append(type, title, description);
            libraryGrid.append(card);
        });
        libraryStatus.textContent = `Đang hiển thị ${snapshot.size} tài liệu đã xuất bản.`;
    } catch (error) {
        libraryStatus.textContent = "Chưa kết nối được Firestore. Hãy kiểm tra cấu hình và Security Rules.";
        console.error("Digital Library Firestore:", error);
    }
}

loadPublishedItems();
