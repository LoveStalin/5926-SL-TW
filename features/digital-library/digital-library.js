import { libraryAuth, libraryDb } from "./firebase.js";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection,
    getDocs,
    limit,
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
const accountPanel = document.getElementById("accountPanel");
const accountDisplayName = document.getElementById("accountDisplayName");
const accountEmail = document.getElementById("accountEmail");
const accountRole = document.getElementById("accountRole");
const diagnosticsList = document.getElementById("diagnosticsList");
const diagnosticsMessage = document.getElementById("diagnosticsMessage");
const refreshDiagnosticsButton = document.getElementById("refreshDiagnostics");
const signOutButton = document.getElementById("signOutButton");
const audienceSelection = document.getElementById("audienceSelection");
const audienceStatus = document.getElementById("audienceStatus");
const audienceButtons = [...document.querySelectorAll("[data-audience]")];
const publishPanel = document.getElementById("publishPanel");
const publishForm = document.getElementById("publishForm");
const publishSubmit = document.getElementById("publishSubmit");
const publishStatus = document.getElementById("publishStatus");
const modeButtons = [...document.querySelectorAll("[data-mode]")];

// Set this to the exact workers.dev URL after deploying the Worker.
// Example format: https://a5-digital-library-api.<your-subdomain>.workers.dev
const WORKER_API_BASE_URL = "https://a5-digital-library-api.thanhnguyenxuan917.workers.dev";

let authMode = "login";
let diagnosticsRun = 0;

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

function addDiagnostic(label, value, state = "pending") {
    const row = document.createElement("div");
    row.className = "diagnostic-row";

    const labelElement = document.createElement("span");
    labelElement.className = "diagnostic-label";
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = "diagnostic-value";

    const stateElement = document.createElement("span");
    stateElement.className = "diagnostic-state " + state;
    stateElement.textContent = value;
    valueElement.append(stateElement);
    row.append(labelElement, valueElement);
    diagnosticsList.append(row);
}

function addDiagnosticValue(label, value) {
    const row = document.createElement("div");
    row.className = "diagnostic-row";

    const labelElement = document.createElement("span");
    labelElement.className = "diagnostic-label";
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = "diagnostic-value";
    valueElement.textContent = value || "—";
    row.append(labelElement, valueElement);
    diagnosticsList.append(row);
}

function apiErrorMessage(status, message) {
    if (status === 401) return "Worker từ chối token. Hãy đăng xuất rồi đăng nhập lại; kiểm tra email đã xác minh.";
    if (status === 403) return message || "Firestore Rules hoặc quyền tài khoản đã từ chối yêu cầu.";
    if (status === 404) return "Không tìm thấy API /api/v1/me. Kiểm tra phiên bản Worker đã deploy.";
    if (status >= 500) return message || "Worker/Firestore đang gặp lỗi máy chủ.";
    return message || "Không thể xác minh hồ sơ qua Worker.";
}

async function chooseAudience(audienceType) {
    if (!["guest", "student"].includes(audienceType)) return;
    audienceButtons.forEach(button => button.disabled = true);
    audienceStatus.textContent = "Đang lưu lựa chọn...";
    try {
        const user = libraryAuth.currentUser;
        if (!user) throw new Error("Vui lòng đăng nhập lại.");
        const idToken = await user.getIdToken();
        const response = await fetch(WORKER_API_BASE_URL.replace(/\/$/, "") + "/api/v1/me/audience", {
            method: "POST",
            headers: {
                authorization: "Bearer " + idToken,
                "content-type": "application/json",
                accept: "application/json"
            },
            body: JSON.stringify({ audienceType })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Không thể lưu lựa chọn.");
        audienceStatus.textContent = "Đã lưu lựa chọn. Đang cập nhật hồ sơ...";
        await refreshAccountDiagnostics(user);
    } catch (error) {
        audienceStatus.textContent = error.message || "Có lỗi xảy ra. Hãy thử lại.";
    } finally {
        audienceButtons.forEach(button => button.disabled = false);
    }
}

audienceButtons.forEach(button => {
    button.addEventListener("click", () => chooseAudience(button.dataset.audience));
});

publishForm.addEventListener("submit", async event => {
    event.preventDefault();
    publishSubmit.disabled = true;
    publishStatus.textContent = "Đang xuất bản metadata...";
    try {
        const user = libraryAuth.currentUser;
        if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
        const idToken = await user.getIdToken();
        const formData = new FormData(publishForm);
        const response = await fetch(WORKER_API_BASE_URL.replace(/\/$/, "") + "/api/v1/library", {
            method: "POST",
            headers: {
                authorization: "Bearer " + idToken,
                "content-type": "application/json",
                accept: "application/json"
            },
            body: JSON.stringify({
                title: String(formData.get("title") || "").trim(),
                description: String(formData.get("description") || "").trim(),
                type: String(formData.get("type") || ""),
                categoryId: String(formData.get("categoryId") || "").trim(),
                language: "vi"
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Không thể xuất bản tài liệu.");
        publishStatus.textContent = "Đã xuất bản thông tin tài liệu thành công. ID: " + data.id + ". Tệp đính kèm sẽ được bổ sung khi R2 sẵn sàng.";
        publishForm.reset();
        await loadPublishedItems();
    } catch (error) {
        publishStatus.textContent = error.message || "Không thể xuất bản. Hãy thử lại.";
    } finally {
        publishSubmit.disabled = false;
    }
});

async function refreshAccountDiagnostics(user = libraryAuth.currentUser) {
    if (!user) return;
    const runId = ++diagnosticsRun;
    refreshDiagnosticsButton.disabled = true;
    diagnosticsList.replaceChildren();
    diagnosticsMessage.textContent = "Đang kiểm tra Firebase và API...";
    accountDisplayName.textContent = user.displayName || user.email?.split("@")[0] || "Library user";
    accountEmail.textContent = user.email || "Không có email";
    accountRole.textContent = "ĐANG KIỂM TRA";

    addDiagnostic("Firebase Authentication", "Đã đăng nhập", "ok");
    addDiagnostic("Email verification", user.emailVerified ? "Verified" : "Not verified", user.emailVerified ? "ok" : "error");
    addDiagnosticValue("Firebase UID", user.uid);

    if (!user.emailVerified) {
        addDiagnostic("Firestore profile", "Chưa kiểm tra", "warn");
        addDiagnostic("Cloudflare Worker", "Chưa kiểm tra", "warn");
        addDiagnostic("Role authorization", "Bị chặn", "error");
        diagnosticsMessage.textContent = "Email chưa được xác minh. Hãy xác minh email trước khi sử dụng API thư viện.";
        refreshDiagnosticsButton.disabled = false;
        return;
    }

    if (!WORKER_API_BASE_URL || !/^https:\/\//i.test(WORKER_API_BASE_URL)) {
        addDiagnostic("Cloudflare Worker", "Chưa cấu hình URL", "warn");
        addDiagnostic("Firestore profile", "Chưa thể kiểm tra", "warn");
        addDiagnostic("Role authorization", "Chưa thể kiểm tra", "warn");
        diagnosticsMessage.textContent = "Firebase Authentication đã nhận tài khoản. Sau khi deploy Worker, thêm URL workers.dev vào WORKER_API_BASE_URL trong digital-library.js để xác minh Firestore và vai trò.";
        accountRole.textContent = "CHƯA XÁC MINH";
        refreshDiagnosticsButton.disabled = false;
        return;
    }

    let workerOnline = false;
    try {
        const healthResponse = await fetch(WORKER_API_BASE_URL.replace(/\/$/, "") + "/health", {
            method: "GET",
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(10000)
        });
        const healthData = await healthResponse.json().catch(() => ({}));
        workerOnline = healthResponse.ok && healthData.ok === true;
        addDiagnostic("Cloudflare Worker", workerOnline ? "Online · Health OK" : "Health check failed", workerOnline ? "ok" : "error");
        if (!workerOnline) {
            addDiagnostic("Firestore profile", "Chưa kiểm tra", "warn");
            addDiagnostic("Role authorization", "Chưa kiểm tra", "warn");
            diagnosticsMessage.textContent = healthData.error || "Worker phản hồi nhưng health check không hợp lệ.";
            return;
        }
    } catch (error) {
        addDiagnostic("Cloudflare Worker", "Không kết nối được", "error");
        addDiagnostic("Firestore profile", "Chưa kiểm tra", "warn");
        addDiagnostic("Role authorization", "Chưa kiểm tra", "warn");
        diagnosticsMessage.textContent = error.name === "TimeoutError"
            ? "Worker không phản hồi trong thời gian cho phép."
            : "Không thể kết nối Worker. Kiểm tra URL, trạng thái deploy và CORS.";
        return;
    } finally {
        if (runId === diagnosticsRun) refreshDiagnosticsButton.disabled = false;
    }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(WORKER_API_BASE_URL.replace(/\/$/, "") + "/api/v1/me", {
            method: "GET",
            headers: {
                authorization: "Bearer " + idToken,
                accept: "application/json"
            },
            signal: AbortSignal.timeout(12000)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            addDiagnostic("Firestore profile", "Không xác minh được", "error");
            addDiagnostic("Role authorization", "Bị từ chối", "error");
            diagnosticsMessage.textContent = apiErrorMessage(response.status, data.error);
            accountRole.textContent = "CHƯA XÁC MINH";
            return;
        }

        const profile = data.user;
        if (data.needsAudienceSelection) {
            audienceSelection.hidden = false;
            publishPanel.hidden = true;
            addDiagnostic("Firestore profile", "Chưa hoàn tất lựa chọn", "warn");
            addDiagnostic("Role authorization", "Chờ chọn Guest/Student", "warn");
            accountRole.textContent = "CHỌN VAI TRÒ";
            accountRole.dataset.role = "unselected";
            diagnosticsMessage.textContent = "Tài khoản đã xác minh. Hãy chọn Guest hoặc Student để hoàn tất hồ sơ.";
            return;
        }

        if (!profile || profile.uid !== user.uid ||
            String(profile.email || "").toLowerCase() !== String(user.email || "").toLowerCase()) {
            addDiagnostic("Firestore profile", "Dữ liệu không khớp", "error");
            addDiagnostic("Role authorization", "Không đáng tin cậy", "error");
            diagnosticsMessage.textContent = "UID hoặc email Worker trả về không khớp tài khoản Firebase đang đăng nhập. Không hiển thị quyền từ dữ liệu này.";
            accountRole.textContent = "DATA MISMATCH";
            return;
        }

        addDiagnostic("Firestore profile", "Found · UID matched", "ok");
        addDiagnostic("Firestore email", "Matched Authentication", "ok");
        addDiagnostic("Account status", profile.accountStatus || "Unknown", profile.accountStatus === "active" ? "ok" : "error");
        audienceSelection.hidden = true;
        const roleLabels = {
            admin: "ADMIN",
            teacher: "TEACHER",
            project_member: "PROJECT MEMBER",
            viewer: profile.audienceType === "guest" ? "GUEST · VIEWER" : "STUDENT · VIEWER",
            student: "STUDENT · VIEWER"
        };
        const roleLabel = roleLabels[profile.role] || "UNKNOWN";
        addDiagnostic("Role authorization", roleLabel, roleLabels[profile.role] ? "ok" : "error");
        accountDisplayName.textContent = profile.displayName || user.displayName || user.email;
        accountRole.textContent = roleLabel;
        accountRole.dataset.role = profile.role || "unknown";
        publishPanel.hidden = profile.role !== "project_member";
        diagnosticsMessage.textContent = profile.accountStatus === "active"
            ? "Đã xác minh thành công: Firebase Authentication, Firestore profile và vai trò do Worker xác nhận."
            : "Đã đọc được hồ sơ nhưng tài khoản không ở trạng thái active.";
    } catch (error) {
        addDiagnostic("Firestore profile", "Request failed", "error");
        addDiagnostic("Role authorization", "Chưa xác minh", "warn");
        diagnosticsMessage.textContent = error.name === "TimeoutError"
            ? "Yêu cầu /api/v1/me hết thời gian chờ."
            : "Không thể đọc hồ sơ. Kiểm tra Worker, CORS và Firestore Security Rules.";
    } finally {
        if (runId === diagnosticsRun) refreshDiagnosticsButton.disabled = false;
    }
}

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
            const currentUser = libraryAuth.currentUser;

            if (!currentUser?.emailVerified) {
                await signOut(libraryAuth);
                authStatus.textContent = "Email chưa được xác minh. Hãy kiểm tra hộp thư và xác minh email trước.";
                return;
            }

            authStatus.textContent = "Firebase Authentication thành công. Đang kiểm tra hồ sơ và quyền...";
            await refreshAccountDiagnostics(currentUser);
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

refreshDiagnosticsButton.addEventListener("click", () => refreshAccountDiagnostics());
signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
        await signOut(libraryAuth);
        authStatus.textContent = "Đã đăng xuất.";
    } catch (error) {
        diagnosticsMessage.textContent = "Không thể đăng xuất. Hãy thử lại.";
        console.error("Digital Library sign out:", error);
    } finally {
        signOutButton.disabled = false;
    }
});

onAuthStateChanged(libraryAuth, user => {
    const signedIn = Boolean(user);
    authForm.hidden = signedIn;
    accountPanel.hidden = !signedIn;
    if (user) {
        void refreshAccountDiagnostics(user);
    } else {
        diagnosticsRun++;
        diagnosticsList.replaceChildren();
        diagnosticsMessage.textContent = "";
        accountRole.textContent = "SIGNED OUT";
        audienceSelection.hidden = true;
        publishPanel.hidden = true;
    }
});

async function loadPublishedItems() {
    try {
        const publishedQuery = query(
            collection(libraryDb, "libraryItems"),
            where("status", "==", "published"),
            limit(24)
        );
        const snapshot = await getDocs(publishedQuery);

        libraryGrid.replaceChildren();
        if (snapshot.empty) {
            libraryStatus.textContent = "Chưa có tài liệu nào được xuất bản.";
            return;
        }

        const documents = [...snapshot.docs].sort((a, b) => {
            const aTime = a.data().publishedAt?.toMillis?.() || 0;
            const bTime = b.data().publishedAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        documents.forEach(documentSnapshot => {
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
