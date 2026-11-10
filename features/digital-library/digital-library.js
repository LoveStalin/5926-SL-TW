import { libraryAuth, libraryDb } from "./firebase.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    setDoc,
    serverTimestamp,
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

const itemModal = document.getElementById("itemModal");
const itemModalClose = document.getElementById("itemModalClose");
const itemModalType = document.getElementById("itemModalType");
const itemModalTitle = document.getElementById("itemModalTitle");
const itemModalDescription = document.getElementById("itemModalDescription");
const itemMetadata = document.getElementById("itemMetadata");
const itemPreview = document.getElementById("itemPreview");
const itemModalStatus = document.getElementById("itemModalStatus");
const qrCanvas = document.getElementById("qrCanvas");
const qrTargetUrl = document.getElementById("qrTargetUrl");
const qrCopyButton = document.getElementById("qrCopyButton");
const qrDownloadButton = document.getElementById("qrDownloadButton");
const itemOpenButton = document.getElementById("itemOpenButton");
const itemRatingSummary = document.getElementById("itemRatingSummary");
const itemRatingStars = [...document.querySelectorAll(".rating-star")];
const itemRatingStatus = document.getElementById("itemRatingStatus");

const PUBLIC_LIBRARY_PATH = "/features/digital-library/digital-library.html";

// LOCAL DEV QR TARGET
// The phone must reach the PC's Live Server through the PC's LAN IP.
// Do NOT use 127.0.0.1/localhost here: on the phone, that points to the phone itself.
// Do NOT use the production Pages domain while this feature is still being tested locally.
const LOCAL_LAN_LIBRARY_URL = "http://192.168.1.104:5500" + PUBLIC_LIBRARY_PATH;

// QR codes generated during local development intentionally point to the LAN host.
// When the feature is eventually deployed publicly, this constant can be changed
// to the final public library URL.
const PUBLIC_LIBRARY_URL = LOCAL_LAN_LIBRARY_URL;

// The production Worker is intentionally used from local development too.
// This keeps the local frontend connected to the real Firestore + B2 backend.
// Use ?api=local only when explicitly testing the local Wrangler Worker.
const PRODUCTION_WORKER_API_BASE_URL = "https://a5-digital-library-api.thanhnguyenxuan917.workers.dev";
const USE_LOCAL_WORKER =
    new URLSearchParams(window.location.search).get("api") === "local";
const WORKER_API_BASE_URL = USE_LOCAL_WORKER
    ? "http://127.0.0.1:8787"
    : PRODUCTION_WORKER_API_BASE_URL;

let authMode = "login";
let diagnosticsRun = 0;
let activeItemId = null;

function buildLibraryItemUrl(itemId) {
    return PUBLIC_LIBRARY_URL + "?item=" + encodeURIComponent(itemId);
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index++;
    }
    return value >= 10 || index === 0 ? value.toFixed(0) + " " + units[index] : value.toFixed(1) + " " + units[index];
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return hours + " giờ " + minutes + " phút " + secs + " giây";
    if (minutes > 0) return minutes + " phút " + secs + " giây";
    return secs + " giây";
}

function formatRatio(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "—";
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(Math.round(width), Math.round(height));
    return Math.round(width / divisor) + ":" + Math.round(height / divisor);
}

function assetUrl(itemId) {
    return WORKER_API_BASE_URL.replace(/\/$/, "") +
        "/api/v1/library/" + encodeURIComponent(itemId) + "/file";
}

function getPrimaryAsset(assets = []) {
    return assets.find(asset => asset.isPrimary === true)
        || assets.find(asset => asset.assetType === "original")
        || assets[0]
        || null;
}

function appendMetadata(label, value) {
    const row = document.createElement("div");
    row.className = "item-meta-row";
    const labelElement = document.createElement("dt");
    labelElement.textContent = label;
    const valueElement = document.createElement("dd");
    valueElement.textContent = value || "—";
    row.append(labelElement, valueElement);
    itemMetadata.append(row);
}

function formatRatingSummary(ratingCount, averageRating) {
    if (!ratingCount) return "Chưa có đánh giá";
    return averageRating.toFixed(1) + "/5 · " + ratingCount + (ratingCount === 1 ? " đánh giá" : " đánh giá");
}

function paintRatingStars(rating) {
    itemRatingStars.forEach(button => {
        const value = Number(button.dataset.rating);
        button.classList.toggle("selected", value <= rating);
    });
}

async function loadItemRating(itemId) {
    itemRatingStatus.textContent = "";
    itemRatingSummary.textContent = "Đang tải...";
    paintRatingStars(0);

    const reviewsRef = collection(libraryDb, "libraryItems", itemId, "ratings");
    const snapshot = await getDocs(reviewsRef);
    let total = 0;
    let myRating = 0;
    const currentUser = libraryAuth.currentUser;

    snapshot.forEach(review => {
        const rating = Number(review.data().rating);
        if (rating >= 1 && rating <= 5) {
            total += rating;
            if (currentUser && review.id === currentUser.uid) myRating = rating;
        }
    });

    const count = snapshot.size;
    const average = count ? total / count : 0;
    itemRatingSummary.textContent = formatRatingSummary(count, average);
    paintRatingStars(myRating);

    if (!currentUser) {
        itemRatingStatus.textContent = "Đăng nhập bằng tài khoản Học sinh/Khách tham quan để đánh giá.";
        itemRatingStars.forEach(button => button.disabled = true);
        return;
    }

    const profileSnap = await getDoc(doc(libraryDb, "users", currentUser.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : null;
    const canRate = profile
        && profile.accountStatus === "active"
        && profile.role === "viewer"
        && ["student", "guest"].includes(profile.audienceType);

    itemRatingStars.forEach(button => button.disabled = !canRate);

    if (!canRate) {
        itemRatingStatus.textContent = "Chỉ tài khoản Học sinh hoặc Khách tham quan mới có thể đánh giá.";
    } else if (myRating) {
        itemRatingStatus.textContent = "Bạn đã đánh giá " + myRating + "/5 sao. Chọn lại để cập nhật.";
    } else {
        itemRatingStatus.textContent = "Chọn số sao để đánh giá.";
    }
}

async function saveItemRating(itemId, rating) {
    const user = libraryAuth.currentUser;
    if (!user) {
        itemRatingStatus.textContent = "Vui lòng đăng nhập để đánh giá.";
        return;
    }

    itemRatingStars.forEach(button => button.disabled = true);
    itemRatingStatus.textContent = "Đang lưu đánh giá...";

    try {
        const ratingRef = doc(libraryDb, "libraryItems", itemId, "ratings", user.uid);
        const existing = await getDoc(ratingRef);
        const payload = existing.exists()
            ? { rating, updatedAt: serverTimestamp() }
            : { rating, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

        await setDoc(ratingRef, payload, { merge: true });
        itemRatingStatus.textContent = "Đã lưu đánh giá " + rating + "/5 sao.";
        await loadItemRating(itemId);
    } catch (error) {
        console.error("Digital Library rating:", error);
        itemRatingStatus.textContent = "Không thể lưu đánh giá. Kiểm tra quyền tài khoản và thử lại.";
        itemRatingStars.forEach(button => button.disabled = false);
    }
}


async function renderItemPreview(itemId, item, assets) {
    itemPreview.replaceChildren();
    const asset = getPrimaryAsset(assets);
    const type = String(item.contentType || item.type || "").toLowerCase();
    const fileUrl = assetUrl(itemId);

    if (!asset) {
        const empty = document.createElement("div");
        empty.className = "preview-placeholder";
        empty.innerHTML = "<span>📄</span><strong>Chưa có file</strong><small>Tài liệu này chưa được upload.</small>";
        itemPreview.append(empty);
        return;
    }

    const format = String(asset.format || "").toLowerCase();

    if (type === "video" || ["mp4", "webm", "mov", "m4v"].includes(format)) {
        const video = document.createElement("video");
        video.className = "item-preview-media";
        video.crossOrigin = "anonymous";
        video.src = fileUrl;
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        video.controls = true;

        let videoMetadataRendered = false;
        const renderVideoMetadata = () => {
            if (videoMetadataRendered) return;
            if (!Number.isFinite(video.duration) && !(video.videoWidth && video.videoHeight)) return;
            videoMetadataRendered = true;
            if (Number.isFinite(video.duration)) {
                appendMetadata("Thời lượng", formatDuration(video.duration));
            }
            if (video.videoWidth && video.videoHeight) {
                appendMetadata("Tỷ lệ", formatRatio(video.videoWidth, video.videoHeight));
            }
        };

        video.addEventListener("loadedmetadata", renderVideoMetadata, { once: false });
        video.addEventListener("durationchange", renderVideoMetadata, { once: false });
        video.addEventListener("loadeddata", () => {
            renderVideoMetadata();
            try { video.currentTime = 0; } catch {}
        }, { once: true });
        video.load();
        video.addEventListener("error", () => {
            if (!videoMetadataRendered) {
                appendMetadata("Thời lượng", "Không xác định");
                appendMetadata("Tỷ lệ", "Không xác định");
                videoMetadataRendered = true;
            }
        }, { once: true });

        itemPreview.append(video);
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        return;
    }

    if (type === "audio" || type === "podcast" || ["mp3", "wav", "m4a", "ogg", "flac"].includes(format)) {
        const audio = document.createElement("audio");
        audio.src = fileUrl;
        audio.preload = "metadata";
        audio.addEventListener("loadedmetadata", () => {
            appendMetadata("Thời lượng", formatDuration(audio.duration));
        }, { once: true });
        itemPreview.innerHTML = '<div class="preview-placeholder audio-placeholder"><span>📀</span><strong>Âm thanh</strong><small>File âm thanh số</small></div>';
        itemPreview.append(audio);
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        return;
    }

    if (type === "ebook" || type === "document" || format === "pdf") {
        const pdf = document.createElement("iframe");
        pdf.className = "item-preview-pdf";
        pdf.src = fileUrl + "#page=1&toolbar=0&navpanes=0&scrollbar=0";
        pdf.title = "Trang đầu của tài liệu PDF";
        itemPreview.append(pdf);
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        appendMetadata("Trang", "Đang tải...");
        try {
            const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
            pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
            const documentProxy = await pdfjs.getDocument({ url: fileUrl }).promise;
            const page = await documentProxy.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            const canvas = document.createElement("canvas");
            canvas.className = "pdf-first-page";
            const scale = Math.min(2, 520 / viewport.width);
            const scaled = page.getViewport({ scale });
            canvas.width = Math.ceil(scaled.width);
            canvas.height = Math.ceil(scaled.height);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: scaled }).promise;
            itemPreview.replaceChildren(canvas);
            itemMetadata.lastElementChild.querySelector("dd").textContent = String(documentProxy.numPages) + " trang";
        } catch (error) {
            console.warn("PDF preview unavailable:", error);
            itemMetadata.lastElementChild.querySelector("dd").textContent = "Không xác định";
        }
        return;
    }

    if (["image", "png", "jpg", "jpeg", "webp", "gif", "svg"].includes(format) ||
        ["postcard", "artwork", "design"].includes(type)) {
        const image = document.createElement("img");
        image.className = "item-preview-media";
        image.src = fileUrl;
        image.alt = item.title || "Ảnh xem trước";
        image.addEventListener("load", () => {
            appendMetadata("Kích thước", image.naturalWidth + " × " + image.naturalHeight + " px");
            appendMetadata("Tỷ lệ", formatRatio(image.naturalWidth, image.naturalHeight));
        }, { once: true });
        itemPreview.append(image);
        const imageCount = assets.filter(entry => ["image", "png", "jpg", "jpeg", "webp", "gif", "svg"].includes(String(entry.format || "").toLowerCase())).length || 1;
        appendMetadata("Số ảnh", String(imageCount));
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        return;
    }

    const fallback = document.createElement("div");
    fallback.className = "preview-placeholder";
    fallback.innerHTML = '<span>📄</span><strong>' + (asset.format || "Tệp số").toUpperCase() + '</strong><small>Xem tài liệu để mở nội dung đầy đủ.</small>';
    itemPreview.append(fallback);
    appendMetadata("Định dạng", String(asset.format || "Không xác định").toUpperCase());
    appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
}

async function openItemModal(itemId) {
    activeItemId = itemId;
    itemModal.hidden = false;
    document.body.classList.add("modal-open");
    itemModalType.textContent = "ĐANG TẢI TÀI LIỆU";
    itemModalTitle.textContent = "Đang tải...";
    itemModalDescription.textContent = "";
    itemMetadata.replaceChildren();
    itemPreview.innerHTML = '<div class="preview-loading">Đang tải bản xem trước...</div>';
    itemModalStatus.textContent = "";
    itemRatingSummary.textContent = "Chưa có đánh giá";
    itemRatingStatus.textContent = "";
    paintRatingStars(0);
    itemRatingStars.forEach(button => button.disabled = true);

    try {
        const response = await fetch(
            WORKER_API_BASE_URL.replace(/\/$/, "") + "/api/v1/library/" + encodeURIComponent(itemId),
            { headers: { accept: "application/json" } }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Không thể tải thông tin tài liệu.");

        const item = data.item || {};
        const assets = Array.isArray(data.assets) ? data.assets : [];
        const targetUrl = buildLibraryItemUrl(itemId);
        const primaryAsset = getPrimaryAsset(assets);

        itemModalType.textContent = String(item.contentType || item.type || "TÀI LIỆU SỐ").toUpperCase();
        itemModalTitle.textContent = item.title || "Tài liệu";
        itemModalDescription.textContent = item.description || "Chưa có mô tả.";
        appendMetadata("Thể loại", item.categoryId || item.contentType || item.type || "—");
        if (Array.isArray(item.authors) && item.authors.length) appendMetadata("Tác giả", item.authors.join(", "));
        if (item.language) appendMetadata("Ngôn ngữ", item.language.toUpperCase());

        qrTargetUrl.textContent = targetUrl;
        itemOpenButton.disabled = !primaryAsset;
        itemOpenButton.onclick = () => {
            if (!primaryAsset) return;
            window.open(assetUrl(itemId), "_blank", "noopener,noreferrer");
        };

        await QRCode.toCanvas(qrCanvas, targetUrl, {
            width: 180,
            margin: 2,
            errorCorrectionLevel: "M"
        });

        await renderItemPreview(itemId, item, assets);
        await loadItemRating(itemId);
    } catch (error) {
        itemModalStatus.textContent = error.message || "Không thể tải thông tin tài liệu.";
        itemPreview.innerHTML = '<div class="preview-placeholder"><span>⚠️</span><strong>Không thể tải bản xem trước</strong><small>Hãy thử lại sau.</small></div>';
    }
}

function closeItemModal() {
    itemModal.hidden = true;
    activeItemId = null;
    document.body.classList.remove("modal-open");
    itemModalStatus.textContent = "";
}

itemModalClose.addEventListener("click", closeItemModal);
itemRatingStars.forEach(button => {
    button.addEventListener("click", () => {
        if (!activeItemId) return;
        saveItemRating(activeItemId, Number(button.dataset.rating));
    });
});

itemModal.addEventListener("click", event => {
    if (event.target === itemModal) closeItemModal();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !itemModal.hidden) closeItemModal();
});

qrCopyButton.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(qrTargetUrl.textContent);
        itemModalStatus.textContent = "Đã sao chép liên kết tài liệu.";
    } catch {
        itemModalStatus.textContent = "Không thể sao chép tự động. Hãy sao chép liên kết bên trên.";
    }
});

qrDownloadButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "a5-digital-library-qr.png";
    link.href = qrCanvas.toDataURL("image/png");
    link.click();
});

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

    try {
        const user = libraryAuth.currentUser;
        if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");

        const idToken = await user.getIdToken();
        const formData = new FormData(publishForm);
        const file = formData.get("file");

        if (file instanceof File && file.size > 100 * 1024 * 1024) {
            throw new Error("File vượt quá 100 MB. Hãy dùng file test nhỏ hơn.");
        }

        publishStatus.textContent = "① Đang tạo metadata...";
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
                contentType: String(formData.get("contentType") || ""),
                categoryId: String(formData.get("categoryId") || "").trim(),
                language: "vi"
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Không thể tạo tài liệu.");

        if (file instanceof File && file.size > 0) {
            const format = String(file.name.split(".").pop() || "bin")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "")
                .slice(0, 20) || "bin";

            publishStatus.textContent = "② Đang upload " + file.name + " (" + Math.ceil(file.size / 1024 / 1024) + " MB) vào Storage...";

            const uploadResponse = await fetch(
                WORKER_API_BASE_URL.replace(/\/$/, "") +
                "/api/v1/library/" + encodeURIComponent(data.id) +
                "/upload?assetType=original&format=" + encodeURIComponent(format) + "&isPrimary=true",
                {
                    method: "PUT",
                    headers: {
                        authorization: "Bearer " + idToken,
                        "content-type": file.type || "application/octet-stream",
                        "x-file-name": encodeURIComponent(file.name)
                    },
                    body: file
                }
            );

            const uploadData = await uploadResponse.json().catch(() => ({}));
            if (!uploadResponse.ok) {
                throw new Error("Metadata đã tạo nhưng upload thất bại: " + (uploadData.error || "Storage không nhận file."));
            }

            publishStatus.textContent =
                "✅ Đã thêm tài liệu và upload thành công. Asset " +
                uploadData.id + " · " + uploadData.sizeBytes + " bytes.";
        } else {
            publishStatus.textContent =
                "✅ Đã thêm tài liệu. Chưa có file — trạng thái Storage: awaiting_upload.";
        }

        publishForm.reset();
        await loadPublishedItems();
    } catch (error) {
        publishStatus.textContent = error.message || "Không thể thêm tài liệu. Hãy thử lại.";
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

    if (!WORKER_API_BASE_URL || !/^https?:\/\//i.test(WORKER_API_BASE_URL)) {
    addDiagnostic("Cloudflare Worker", "Chưa cấu hình URL", "warn");
    addDiagnostic("Firestore profile", "Chưa thể kiểm tra", "warn");
    addDiagnostic("Role authorization", "Chưa thể kiểm tra", "warn");
    diagnosticsMessage.textContent =
        "Chưa có URL Worker hợp lệ. Kiểm tra WORKER_API_BASE_URL trong digital-library.js.";
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
        publishPanel.hidden = !["project_member", "teacher", "admin"].includes(profile.role);
        await loadPublishedItems();

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
        accountRole.dataset.role = "unknown";
        await loadPublishedItems();
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

            const cardActions = document.createElement("div");
            cardActions.className = "book-card-actions";

            const qrButton = document.createElement("button");
            qrButton.type = "button";
            qrButton.className = "secondary-button qr-card-button";
            qrButton.innerHTML = "▣ QR Code";
            qrButton.setAttribute("aria-label", "Xem mã QR: " + (item.title || "Tài liệu"));
            qrButton.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                void openItemModal(documentSnapshot.id);
            });

            cardActions.append(qrButton);
            card.append(type, title, description, cardActions);

            if (["admin", "teacher"].includes(accountRole.dataset.role)) {
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-book-button";
                deleteButton.setAttribute("aria-label", "Xóa tài liệu");
                deleteButton.title = "Xóa tài liệu";
                deleteButton.innerHTML = "🗑️";

                deleteButton.addEventListener("click", async event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const confirmed = window.confirm(
                        "Xóa tài liệu này?\\n\\n" +
                        (item.title || "Tài liệu") +
                        "\\n\\nFile và dữ liệu của tài liệu sẽ bị xóa khỏi thư viện."
                    );
                    if (!confirmed) return;

                    deleteButton.disabled = true;
                    deleteButton.textContent = "…";

                    try {
                        const user = libraryAuth.currentUser;
                        if (!user) throw new Error("Phiên đăng nhập đã hết. Hãy đăng nhập lại.");

                        const idToken = await user.getIdToken();
                        const response = await fetch(
                            WORKER_API_BASE_URL.replace(/\/$/, "") +
                            "/api/v1/admin/library/" + encodeURIComponent(documentSnapshot.id),
                            {
                                method: "DELETE",
                                headers: {
                                    authorization: "Bearer " + idToken
                                }
                            }
                        );

                        const body = await response.json().catch(() => ({}));
                        if (!response.ok) {
                            throw new Error(body.error || body.message || "Không thể xóa tài liệu.");
                        }

                        await loadPublishedItems();
                    } catch (error) {
                        console.error("Digital Library delete:", error);
                        alert("Không thể xóa tài liệu.\\n\\n" + (error.message || "Lỗi không xác định."));
                        deleteButton.disabled = false;
                        deleteButton.innerHTML = "🗑️";
                    }
                });

                card.append(deleteButton);
            }

            libraryGrid.append(card);
        });
        libraryStatus.textContent = `Đang hiển thị ${snapshot.size} tài liệu đã xuất bản.`;

        const requestedItemId = new URLSearchParams(window.location.search).get("item");
        if (requestedItemId) {
            const requestedDocument = documents.find(documentSnapshot => documentSnapshot.id === requestedItemId);
            if (requestedDocument) {
                await openItemModal(requestedDocument.id);
            }
        }
    } catch (error) {
        libraryStatus.textContent = "Chưa kết nối được Firestore. Hãy kiểm tra cấu hình và Security Rules.";
        console.error("Digital Library Firestore:", error);
    }
}

loadPublishedItems();
