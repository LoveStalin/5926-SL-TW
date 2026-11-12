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

// DOM Elements
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
const publishTypeSelect = document.getElementById("publishType");
const publishFileInput = document.getElementById("publishFile");
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

// 3D Bookshelf Elements
const shelfTrack = document.getElementById("shelfTrack");
const shelfPrevBtn = document.getElementById("shelfPrevBtn");
const shelfNextBtn = document.getElementById("shelfNextBtn");
const spotlightTitle = document.getElementById("spotlightTitle");
const spotlightCategoryBadge = document.getElementById("spotlightCategoryBadge");
const spotlightFormatBadge = document.getElementById("spotlightFormatBadge");
const spotlightYearBadge = document.getElementById("spotlightYearBadge");
const spotlightAuthor = document.getElementById("spotlightAuthor");
const spotlightCategory = document.getElementById("spotlightCategory");
const spotlightRatingStars = document.getElementById("spotlightRatingStars");
const spotlightRatingSummary = document.getElementById("spotlightRatingSummary");
const spotlightDescription = document.getElementById("spotlightDescription");
const spotlightOpenBtn = document.getElementById("spotlightOpenBtn");
const spotlightDetailsBtn = document.getElementById("spotlightDetailsBtn");
const spotlightRateBtn = document.getElementById("spotlightRateBtn");
const shelfCounter = document.getElementById("shelfCounter");
const categoryPills = [...document.querySelectorAll(".category-pill")];
const librarySearchInput = document.getElementById("librarySearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const ambientMusicCapsule = document.getElementById("ambientMusicCapsule");
const ambientToggleBtn = document.getElementById("ambientToggleBtn");
const ambientPlayIcon = document.getElementById("ambientPlayIcon");
const ambientTrackTitle = document.getElementById("ambientTrackTitle");
const ambientTrackSub = document.getElementById("ambientTrackSub");
const particlesContainer = document.getElementById("particlesContainer");

// Category counter badges
const countAllEl = document.getElementById("countAll");
const countBookEl = document.getElementById("countBook");
const countPodcastEl = document.getElementById("countPodcast");
const countVideoEl = document.getElementById("countVideo");
const countOtherEl = document.getElementById("countOther");

const PUBLIC_LIBRARY_PATH = "/features/digital-library/digital-library.html";
const LOCAL_LAN_LIBRARY_URL = "http://192.168.1.104:5500" + PUBLIC_LIBRARY_PATH; // TODO: Change to Production Address to activate the QR Code
const PUBLIC_LIBRARY_URL = LOCAL_LAN_LIBRARY_URL;
const PRODUCTION_WORKER_API_BASE_URL = "https://a5-digital-library-api.thanhnguyenxuan917.workers.dev";
const USE_LOCAL_WORKER = new URLSearchParams(window.location.search).get("api") === "local";
const WORKER_API_BASE_URL = USE_LOCAL_WORKER
    ? "http://127.0.0.1:8787"
    : PRODUCTION_WORKER_API_BASE_URL;

let authMode = "login";
let diagnosticsRun = 0;
let activeItemId = null;
let currentFilter = "all";
let currentSearchQuery = "";
let allLibraryItems = [];
let filteredLibraryItems = [];
let activeShelfIndex = 0;

// PDF.js dynamic loader
let pdfjsLibPromise = null;
function getPdfJs() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
            pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
            return pdfjs;
        })();
    }
    return pdfjsLibPromise;
}

// In-memory thumbnail caches
const thumbnailCache = new Map();

// Color schemes for dynamic 3D cards
const BOOK_THEMES = [
    {
        cover: "linear-gradient(145deg, #1d4332 0%, #0d2118 70%)",
        spine: "#183b2c",
        back: "#0f261c",
        accent: "#72f0ae"
    },
    {
        cover: "linear-gradient(145deg, #a3722b 0%, #4a3411 70%)",
        spine: "#8c6020",
        back: "#38270c",
        accent: "#fed7aa"
    },
    {
        cover: "linear-gradient(145deg, #873e31 0%, #3e1b13 70%)",
        spine: "#753428",
        back: "#2b130d",
        accent: "#fecaca"
    },
    {
        cover: "linear-gradient(145deg, #2b4b6b 0%, #112233 70%)",
        spine: "#23405c",
        back: "#0d1b29",
        accent: "#bae6fd"
    },
    {
        cover: "linear-gradient(145deg, #5b4069 0%, #2a1b33 70%)",
        spine: "#4c3558",
        back: "#201426",
        accent: "#e9d5ff"
    },
    {
        cover: "linear-gradient(145deg, #445943 0%, #1e2b1d 70%)",
        spine: "#374936",
        back: "#162015",
        accent: "#d9f99d"
    },
    {
        cover: "linear-gradient(145deg, #884852 0%, #3d2025 70%)",
        spine: "#763d46",
        back: "#2b1619",
        accent: "#fbcfe8"
    },
    {
        cover: "linear-gradient(145deg, #374151 0%, #111827 70%)",
        spine: "#2a323f",
        back: "#0e131b",
        accent: "#e5e7eb"
    }
];

function getDeterministicTheme(str = "") {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % BOOK_THEMES.length;
    return {
        ...BOOK_THEMES[idx],
        height: 295 + (Math.abs(hash) % 22) + "px",
        spineWidth: 38 + (Math.abs(hash >> 3) % 10) + "px"
    };
}

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
    return averageRating.toFixed(1) + "/5 · " + ratingCount + " đánh giá";
}

function paintRatingStars(rating) {
    itemRatingStars.forEach(button => {
        const value = Number(button.dataset.rating);
        button.classList.toggle("selected", value <= rating);
    });
}

// --------------------------------------------------------------------------
// ACCURATE CONTENT CLASSIFICATION
// Prioritizes primary file format & mime type over raw form fields
// --------------------------------------------------------------------------
function getItemCategory(item) {
    if (!item) return "other";

    const format = String(item.format || item.primaryAsset?.format || "").trim().toLowerCase();
    const mime = String(item.mimeType || item.primaryAsset?.mimeType || "").trim().toLowerCase();
    const contentType = String(item.contentType || "").trim().toLowerCase();
    const legacyType = String(item.type || "").trim().toLowerCase();
    const cat = String(item.categoryId || "").trim().toLowerCase();
    const title = String(item.title || "").trim().toLowerCase();
    const desc = String(item.description || "").trim().toLowerCase();

    // 1. VIDEO (Check format, MIME type, contentType, and keywords)
    const isVideoFormat = ["mp4", "webm", "mov", "m4v", "mkv", "avi", "flv"].includes(format);
    const isVideoMime = mime.startsWith("video/") || mime.includes("mp4");
    const isVideoType = contentType === "video" || legacyType === "video";
    const isVideoText = title.endsWith(".mp4")
        || title.endsWith(".webm")
        || title.endsWith(".mov")
        || cat.includes("video")
        || cat.includes("phim")
        || cat.includes("clip")
        || desc.includes("mp4")
        || desc.includes("video");

    if (isVideoFormat || isVideoMime || isVideoType || isVideoText) {
        return "video";
    }

    // 2. PODCAST / AUDIO (Check format, MIME type, contentType, and keywords)
    const isAudioFormat = ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma"].includes(format);
    const isAudioMime = mime.startsWith("audio/") || mime.includes("mpeg") || mime.includes("audio");
    const isAudioType = ["podcast", "audio"].includes(contentType) || legacyType === "audio";
    const isAudioText = title.endsWith(".mp3")
        || title.endsWith(".wav")
        || title.endsWith(".m4a")
        || cat.includes("podcast")
        || cat.includes("audio")
        || cat.includes("am-thanh")
        || cat.includes("radio");

    if (isAudioFormat || isAudioMime || isAudioType || isAudioText) {
        return "podcast";
    }

    // 3. BOOK / PDF / DOCUMENT (Check format, MIME type, contentType, and keywords)
    const isPdfFormat = format === "pdf" || mime.includes("pdf");
    const isBookType = ["ebook", "document"].includes(contentType) || ["pdf", "document"].includes(legacyType);
    const isBookText = title.endsWith(".pdf")
        || cat.includes("book")
        || cat.includes("sach")
        || cat.includes("tai-lieu")
        || cat.includes("văn học")
        || cat.includes("pdf");

    if (isPdfFormat || isBookType || isBookText) {
        return "book";
    }

    // 4. IMAGE / POSTCARD / ARTWORK
    const isImageFormat = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(format) || mime.startsWith("image/");
    const isImageType = ["postcard", "artwork", "design", "image"].includes(contentType) || legacyType === "image";

    if (isImageFormat || isImageType) {
        return "other";
    }

    return "other";
}

// Render first page of PDF onto a Canvas element (for 3D book cover)
async function renderPdfCoverToCanvas(canvas, itemId, targetWidth = 440) {
    if (!canvas) return;

    if (thumbnailCache.has("pdf_" + itemId)) {
        const cached = thumbnailCache.get("pdf_" + itemId);
        const ctx = canvas.getContext("2d");
        canvas.width = cached.width;
        canvas.height = cached.height;
        ctx.drawImage(cached, 0, 0);
        canvas.classList.add("loaded");
        return;
    }

    try {
        const pdfjs = await getPdfJs();
        const fileUrl = assetUrl(itemId);
        const loadingTask = pdfjs.getDocument({
            url: fileUrl,
            withCredentials: false
        });

        const docProxy = await loadingTask.promise;
        const page = await docProxy.getPage(1);
        const unscaled = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, Math.max(1, targetWidth / unscaled.width));
        const viewport = page.getViewport({ scale });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");

        await page.render({ canvasContext: ctx, viewport }).promise;
        canvas.classList.add("loaded");

        // Cache the rendered image
        const img = new Image();
        img.src = canvas.toDataURL("image/jpeg", 0.88);
        img.width = canvas.width;
        img.height = canvas.height;
        thumbnailCache.set("pdf_" + itemId, img);
    } catch (err) {
        console.warn(`[PDF Cover] Could not render cover for ${itemId}:`, err.message);
    }
}

// Render video frame onto canvas for video 3D cover
async function renderVideoPosterToCanvas(canvas, itemId) {
    if (!canvas) return;

    if (thumbnailCache.has("vid_" + itemId)) {
        const cached = thumbnailCache.get("vid_" + itemId);
        const ctx = canvas.getContext("2d");
        canvas.width = cached.width;
        canvas.height = cached.height;
        ctx.drawImage(cached, 0, 0);
        canvas.classList.add("loaded");
        return;
    }

    try {
        const fileUrl = assetUrl(itemId);
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = fileUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.currentTime = 0.5;

        await new Promise((resolve, reject) => {
            video.onloadeddata = () => resolve();
            video.onseeked = () => resolve();
            video.onerror = () => reject(new Error("Video load failed"));
            setTimeout(() => resolve(), 3500); // 3.5s timeout fallback
        });

        if (video.videoWidth && video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.classList.add("loaded");

            const img = new Image();
            img.src = canvas.toDataURL("image/jpeg", 0.85);
            img.width = canvas.width;
            img.height = canvas.height;
            thumbnailCache.set("vid_" + itemId, img);
        }
    } catch (err) {
        console.warn(`[Video Poster] Could not capture frame for ${itemId}:`, err.message);
    }
}

// --------------------------------------------------------------------------
// 3D Bookshelf Construction & Navigation
// --------------------------------------------------------------------------
function updateCategoryCounters() {
    let bookCount = 0;
    let podcastCount = 0;
    let videoCount = 0;
    let otherCount = 0;

    allLibraryItems.forEach(item => {
        const cat = getItemCategory(item);
        if (cat === "book") bookCount++;
        else if (cat === "podcast") podcastCount++;
        else if (cat === "video") videoCount++;
        else otherCount++;
    });

    if (countAllEl) countAllEl.textContent = allLibraryItems.length;
    if (countBookEl) countBookEl.textContent = bookCount;
    if (countPodcastEl) countPodcastEl.textContent = podcastCount;
    if (countVideoEl) countVideoEl.textContent = videoCount;
    if (countOtherEl) countOtherEl.textContent = otherCount;
}

function filterLibraryItems() {
    filteredLibraryItems = allLibraryItems.filter(item => {
        const cat = getItemCategory(item);
        if (currentFilter !== "all" && cat !== currentFilter) {
            return false;
        }
        if (currentSearchQuery) {
            const q = currentSearchQuery.toLowerCase();
            const title = String(item.title || "").toLowerCase();
            const desc = String(item.description || "").toLowerCase();
            const authors = Array.isArray(item.authors) ? item.authors.join(" ").toLowerCase() : "";
            const catId = String(item.categoryId || "").toLowerCase();
            if (!title.includes(q) && !desc.includes(q) && !authors.includes(q) && !catId.includes(q)) {
                return false;
            }
        }
        return true;
    });

    activeShelfIndex = 0;
    renderBookshelf();
    renderCollectionGrid();
}

function renderBookshelf() {
    if (!shelfTrack) return;
    shelfTrack.replaceChildren();

    // Empty state: when no documents match the active filter or library is empty
    if (filteredLibraryItems.length === 0) {
        shelfTrack.style.justifyContent = "center";
        const empty = document.createElement("div");
        empty.className = "shelf-empty-state";
        empty.innerHTML = `
            <div class="empty-book-icon">📚</div>
            <h3>Chưa có tài liệu nào</h3>
            <p>${currentFilter === "all" ? "Hiện chưa có tác phẩm nào được xuất bản trong cơ sở dữ liệu." : "Không có tác phẩm nào thuộc mục này. Hãy chọn mục khác hoặc đăng tải tài liệu mới."}</p>
        `;
        shelfTrack.append(empty);
        updateSpotlight(null);

        if (shelfPrevBtn) shelfPrevBtn.style.display = "none";
        if (shelfNextBtn) shelfNextBtn.style.display = "none";
        return;
    }

    // Adjust shelf centering depending on item count
    shelfTrack.style.justifyContent = filteredLibraryItems.length <= 3 ? "center" : "flex-start";

    // Show/hide shelf navigation buttons
    if (shelfPrevBtn) shelfPrevBtn.style.display = filteredLibraryItems.length > 1 ? "grid" : "none";
    if (shelfNextBtn) shelfNextBtn.style.display = filteredLibraryItems.length > 1 ? "grid" : "none";

    filteredLibraryItems.forEach((item, index) => {
        const theme = getDeterministicTheme(item.id + (item.title || ""));
        const category = getItemCategory(item);
        const isActive = index === activeShelfIndex;

        const bookEl = document.createElement("div");
        bookEl.className = "shelf-book" + (isActive ? " is-active" : "");
        bookEl.style.setProperty("--book-height", theme.height);
        bookEl.style.setProperty("--book-cover-bg", theme.cover);
        bookEl.style.setProperty("--book-spine-color", theme.spine);
        bookEl.style.setProperty("--book-back-bg", theme.back);
        bookEl.style.setProperty("--book-accent", theme.accent);
        bookEl.dataset.index = String(index);
        bookEl.dataset.id = item.id;
        bookEl.setAttribute("role", "button");
        bookEl.setAttribute("tabindex", "0");
        bookEl.setAttribute("aria-label", item.title || "Tài liệu");

        // 3D Box Container
        const box = document.createElement("div");
        box.className = "book-3d-box";

        // Front Face
        const faceFront = document.createElement("div");
        faceFront.className = "face face-front";

        // Procedural designed cover
        const procCover = document.createElement("div");
        procCover.className = "cover-procedural";
        const catLabel = category === "video" ? "VIDEO (MP4)" : category === "podcast" ? "PODCAST (MP3)" : "SÁCH SỐ";
        procCover.innerHTML = `
            <div class="cover-header-ornament">
                <span>A5 ARCHIVE</span>
                <span>${catLabel}</span>
            </div>
            <div class="cover-title-wrap">
                <h3 class="cover-title">${escapeHtml(item.title || "Tài liệu")}</h3>
                <p class="cover-author">${escapeHtml(Array.isArray(item.authors) && item.authors.length ? item.authors.join(", ") : "A5-K68")}</p>
            </div>
            <div class="cover-footer">
                <span>QUẢNG NINH</span>
                <strong>${item.year || (item.publishedAt ? new Date(item.publishedAt.toMillis?.() || Date.now()).getFullYear() : "2026")}</strong>
            </div>
        `;

        // Canvas for PDF First Page or Video Poster
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-cover-canvas";
        faceFront.append(procCover, canvas);

        // Glossy sheen overlay
        const sheen = document.createElement("div");
        sheen.className = "cover-sheen";
        faceFront.append(sheen);

        // Custom 3D accessories for Podcast & Video
        if (category === "podcast") {
            const vinyl = document.createElement("div");
            vinyl.className = "podcast-vinyl-disc";
            vinyl.innerHTML = '<div class="vinyl-center-label">A5 · MP3</div>';
            box.append(vinyl);
        } else if (category === "video") {
            const videoOverlay = document.createElement("div");
            videoOverlay.className = "video-play-overlay";
            videoOverlay.innerHTML = '<div class="video-play-badge">▶</div>';
            faceFront.append(videoOverlay);
        }

        // Spine Face (Gáy sách)
        const faceSpine = document.createElement("div");
        faceSpine.className = "face face-spine";
        const spineIcon = category === "video" ? "🎬" : category === "podcast" ? "🎧" : "📖";
        faceSpine.innerHTML = `
            <div class="spine-badge">${spineIcon}</div>
            <div class="spine-title-vertical">${escapeHtml(item.title || "TÀI LIỆU")}</div>
            <div class="spine-footer-year">${item.year || "2026"}</div>
        `;

        // Page Edges
        const facePagesRight = document.createElement("div");
        facePagesRight.className = "face face-pages-right";

        const facePagesTop = document.createElement("div");
        facePagesTop.className = "face face-pages-top";

        const facePagesBottom = document.createElement("div");
        facePagesBottom.className = "face face-pages-bottom";

        // Back Cover Face
        const faceBack = document.createElement("div");
        faceBack.className = "face face-back";
        faceBack.innerHTML = '<div class="back-barcode"></div>';

        // Floor Shadow
        const shadow = document.createElement("div");
        shadow.className = "book-floor-shadow";

        box.append(faceFront, faceSpine, facePagesRight, facePagesTop, facePagesBottom, faceBack, shadow);
        bookEl.append(box);

        // Click to focus
        bookEl.addEventListener("click", () => {
            setActiveShelfBook(index);
        });

        shelfTrack.append(bookEl);

        // Dynamic cover render
        if (category === "book") {
            void renderPdfCoverToCanvas(canvas, item.id);
        } else if (category === "video") {
            void renderVideoPosterToCanvas(canvas, item.id);
        }
    });

    updateSpotlight(filteredLibraryItems[activeShelfIndex]);
    scrollActiveBookIntoView();
}

function setActiveShelfBook(index) {
    if (index < 0 || index >= filteredLibraryItems.length) return;
    activeShelfIndex = index;

    const bookEls = shelfTrack.querySelectorAll(".shelf-book");
    bookEls.forEach((el, idx) => {
        el.classList.toggle("is-active", idx === activeShelfIndex);
    });

    const activeItem = filteredLibraryItems[activeShelfIndex];
    updateSpotlight(activeItem);
    scrollActiveBookIntoView();
}

function scrollActiveBookIntoView() {
    const activeEl = shelfTrack.querySelector(".shelf-book.is-active");
    if (!activeEl) return;
    const trackWidth = shelfTrack.clientWidth;
    const targetScroll = activeEl.offsetLeft - (trackWidth / 2) + (activeEl.clientWidth / 2);
    shelfTrack.scrollTo({ left: targetScroll, behavior: "smooth" });
}

function navigateShelf(dir) {
    if (filteredLibraryItems.length === 0) return;
    const newIndex = (activeShelfIndex + dir + filteredLibraryItems.length) % filteredLibraryItems.length;
    setActiveShelfBook(newIndex);
}

function updateSpotlight(item) {
    if (!item) {
        if (spotlightTitle) spotlightTitle.textContent = "Thư viện đang chờ tác phẩm";
        if (spotlightCategoryBadge) spotlightCategoryBadge.textContent = "TRỐNG";
        if (spotlightFormatBadge) spotlightFormatBadge.textContent = "—";
        if (spotlightYearBadge) spotlightYearBadge.textContent = "—";
        if (spotlightAuthor) spotlightAuthor.textContent = "—";
        if (spotlightCategory) spotlightCategory.textContent = "—";
        if (spotlightDescription) spotlightDescription.textContent = "Hiện chưa có tác phẩm nào trong mục này. Hãy sử dụng form bên dưới để tải lên tác phẩm đầu tiên.";
        if (spotlightRatingStars) spotlightRatingStars.textContent = "☆☆☆☆☆";
        if (spotlightRatingSummary) spotlightRatingSummary.textContent = "Chưa có đánh giá";
        if (spotlightOpenBtn) spotlightOpenBtn.disabled = true;
        if (spotlightDetailsBtn) spotlightDetailsBtn.disabled = true;
        if (spotlightRateBtn) spotlightRateBtn.disabled = true;
        if (shelfCounter) shelfCounter.textContent = "Tác phẩm 00 / 00";
        return;
    }

    const category = getItemCategory(item);
    const catLabels = {
        book: "SÁCH & PDF",
        podcast: "PODCAST (MP3)",
        video: "VIDEO (MP4)",
        other: "TÀI LIỆU SỐ"
    };

    const formatLabel = String(item.format || (category === "video" ? "MP4" : category === "podcast" ? "MP3" : "PDF")).toUpperCase();

    if (spotlightTitle) spotlightTitle.textContent = item.title || "Tài liệu";
    if (spotlightCategoryBadge) spotlightCategoryBadge.textContent = catLabels[category] || "TÀI LIỆU";
    if (spotlightFormatBadge) spotlightFormatBadge.textContent = formatLabel;
    if (spotlightYearBadge) spotlightYearBadge.textContent = item.year || "2026";
    if (spotlightAuthor) spotlightAuthor.textContent = Array.isArray(item.authors) && item.authors.length ? item.authors.join(", ") : "Tập thể A5-K68";
    if (spotlightCategory) spotlightCategory.textContent = item.categoryId || "Chung";
    if (spotlightDescription) spotlightDescription.textContent = item.description || "Không có mô tả cho tác phẩm này.";
    if (shelfCounter) shelfCounter.textContent = `Tác phẩm ${String(activeShelfIndex + 1).padStart(2, "0")} / ${String(filteredLibraryItems.length).padStart(2, "0")}`;

    // Action button labels and handlers
    if (spotlightOpenBtn) {
        spotlightOpenBtn.disabled = false;
        if (category === "video") {
            spotlightOpenBtn.innerHTML = "<span>▶ Xem video / Mở file</span>";
        } else if (category === "podcast") {
            spotlightOpenBtn.innerHTML = "<span>🎧 Nghe podcast / Mở file</span>";
        } else {
            spotlightOpenBtn.innerHTML = "<span>📖 Mở tài liệu / Đọc ngay</span>";
        }
        spotlightOpenBtn.onclick = () => {
            window.open(assetUrl(item.id), "_blank", "noopener,noreferrer");
        };
    }

    if (spotlightDetailsBtn) {
        spotlightDetailsBtn.disabled = false;
        spotlightDetailsBtn.onclick = () => {
            void openItemModal(item.id);
        };
    }

    if (spotlightRateBtn) {
        spotlightRateBtn.disabled = false;
        spotlightRateBtn.onclick = () => {
            void openItemModal(item.id);
        };
    }

    // Load real rating from Firestore
    void fetchSpotlightRating(item.id);
}

async function fetchSpotlightRating(itemId) {
    try {
        const reviewsRef = collection(libraryDb, "libraryItems", itemId, "ratings");
        const snapshot = await getDocs(reviewsRef);
        let total = 0;
        snapshot.forEach(docSnap => {
            const r = Number(docSnap.data().rating);
            if (r >= 1 && r <= 5) total += r;
        });
        const count = snapshot.size;
        const avg = count ? total / count : 0;
        if (spotlightRatingSummary) {
            spotlightRatingSummary.textContent = count ? `${avg.toFixed(1)}/5 · ${count} đánh giá` : "Chưa có đánh giá";
        }
        if (spotlightRatingStars) {
            const rounded = Math.round(avg);
            spotlightRatingStars.textContent = "★".repeat(rounded) + "☆".repeat(5 - rounded);
        }
    } catch {
        if (spotlightRatingSummary) spotlightRatingSummary.textContent = "Chưa có đánh giá";
    }
}

// --------------------------------------------------------------------------
// Ambient Audio / Sound Environment
// --------------------------------------------------------------------------
let ambientAudioCtx = null;
let ambientGain = null;
let isAmbientPlaying = false;

function toggleAmbientAudio() {
    if (isAmbientPlaying) {
        stopAmbientAudio();
    } else {
        startAmbientAudio();
    }
}

function startAmbientAudio() {
    try {
        if (!ambientAudioCtx) {
            ambientAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ambientAudioCtx.state === "suspended") {
            void ambientAudioCtx.resume();
        }

        ambientGain = ambientAudioCtx.createGain();
        ambientGain.gain.setValueAtTime(0.001, ambientAudioCtx.currentTime);
        ambientGain.gain.exponentialRampToValueAtTime(0.04, ambientAudioCtx.currentTime + 2);
        ambientGain.connect(ambientAudioCtx.destination);

        const frequencies = [220, 261.63, 329.63, 392, 440];
        frequencies.forEach(freq => {
            const osc = ambientAudioCtx.createOscillator();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ambientAudioCtx.currentTime);
            osc.connect(ambientGain);
            osc.start();
        });

        isAmbientPlaying = true;
        if (ambientMusicCapsule) ambientMusicCapsule.classList.add("is-playing");
        if (ambientPlayIcon) ambientPlayIcon.textContent = "⏸";
        if (ambientTrackTitle) ambientTrackTitle.textContent = "Âm hưởng thư viện số";
        if (ambientTrackSub) ambientTrackSub.textContent = "Đang phát · Yên tĩnh";
    } catch (err) {
        console.warn("Web Audio pad error:", err);
    }
}

function stopAmbientAudio() {
    if (ambientGain && ambientAudioCtx) {
        ambientGain.gain.exponentialRampToValueAtTime(0.0001, ambientAudioCtx.currentTime + 0.8);
        setTimeout(() => {
            try { ambientAudioCtx.close(); } catch {}
            ambientAudioCtx = null;
        }, 850);
    }
    isAmbientPlaying = false;
    if (ambientMusicCapsule) ambientMusicCapsule.classList.remove("is-playing");
    if (ambientPlayIcon) ambientPlayIcon.textContent = "▶";
    if (ambientTrackTitle) ambientTrackTitle.textContent = "Không gian đọc A5";
    if (ambientTrackSub) ambientTrackSub.textContent = "Bấm để bật âm hưởng";
}

function createAmbientParticles() {
    if (!particlesContainer) return;
    particlesContainer.replaceChildren();
    for (let i = 0; i < 18; i++) {
        const p = document.createElement("div");
        p.className = "shelf-particle";
        p.style.left = Math.random() * 95 + "%";
        p.style.bottom = Math.random() * 80 + "%";
        p.style.animationDelay = Math.random() * 8 + "s";
        p.style.animationDuration = 7 + Math.random() * 7 + "s";
        particlesContainer.append(p);
    }
}

// --------------------------------------------------------------------------
// Secondary Collection Grid Rendering
// --------------------------------------------------------------------------
function renderCollectionGrid() {
    if (!libraryGrid) return;
    libraryGrid.replaceChildren();

    if (filteredLibraryItems.length === 0) {
        if (libraryStatus) libraryStatus.textContent = "Không có tài liệu nào trong cơ sở dữ liệu phù hợp bộ lọc.";
        return;
    }

    if (libraryStatus) {
        libraryStatus.textContent = `Đang hiển thị ${filteredLibraryItems.length} tài liệu từ cơ sở dữ liệu.`;
    }

    filteredLibraryItems.forEach(item => {
        const theme = getDeterministicTheme(item.id + (item.title || ""));
        const category = getItemCategory(item);
        const card = document.createElement("article");
        card.className = "book-card";

        const catNames = { video: "Video (MP4)", podcast: "Podcast (MP3)", book: "Sách & PDF", other: "Tài liệu" };
        const typeLabel = catNames[category] || String(item.contentType || item.type || "Tài liệu").replace(/_/g, " ");

        const visual = document.createElement("div");
        visual.className = "book-card-visual";

        const cardObject = document.createElement("div");
        cardObject.className = "card-object";
        cardObject.style.setProperty("--card-bg", theme.cover);

        const coverSmall = document.createElement("small");
        coverSmall.textContent = typeLabel.toUpperCase();

        const coverTitle = document.createElement("strong");
        coverTitle.textContent = item.title || "TÀI LIỆU";

        const coverMeta = document.createElement("span");
        coverMeta.textContent = `A5 · ${item.year || "2026"}`;

        const cardCanvas = document.createElement("canvas");
        cardCanvas.className = "card-canvas-cover";

        cardObject.append(coverSmall, coverTitle, coverMeta, cardCanvas);
        visual.append(cardObject);

        const body = document.createElement("div");
        body.className = "book-card-body";

        const type = document.createElement("span");
        type.className = "book-type";
        type.textContent = typeLabel;

        const title = document.createElement("h3");
        title.textContent = item.title || "Tài liệu chưa có tiêu đề";

        const description = document.createElement("p");
        description.textContent = item.description || "Chưa có mô tả.";

        const cardActions = document.createElement("div");
        cardActions.className = "book-card-actions";

        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "primary-button qr-card-button";
        openBtn.innerHTML = category === "video" ? "▶ Xem video" : category === "podcast" ? "🎧 Nghe" : "📖 Mở đọc";
        openBtn.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            window.open(assetUrl(item.id), "_blank", "noopener,noreferrer");
        });

        const qrButton = document.createElement("button");
        qrButton.type = "button";
        qrButton.className = "secondary-button qr-card-button";
        qrButton.innerHTML = "▣ QR Code";
        qrButton.setAttribute("aria-label", "Xem mã QR: " + (item.title || "Tài liệu"));
        qrButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            void openItemModal(item.id);
        });

        cardActions.append(openBtn, qrButton);
        body.append(type, title, description, cardActions);
        card.append(visual, body);

        // Delete button for Admins and Teachers
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
                    "Xóa tài liệu này khỏi cơ sở dữ liệu?\n\n" +
                    (item.title || "Tài liệu") +
                    "\n\nFile và metadata sẽ bị xóa vĩnh viễn khỏi Cloudflare R2 và Firestore."
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
                        "/api/v1/admin/library/" + encodeURIComponent(item.id),
                        {
                            method: "DELETE",
                            headers: { authorization: "Bearer " + idToken }
                        }
                    );

                    const resBody = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(resBody.error || resBody.message || "Không thể xóa tài liệu.");
                    }

                    await loadPublishedItems();
                } catch (error) {
                    console.error("Digital Library delete:", error);
                    alert("Không thể xóa tài liệu.\n\n" + (error.message || "Lỗi không xác định."));
                    deleteButton.disabled = false;
                    deleteButton.innerHTML = "🗑️";
                }
            });

            card.append(deleteButton);
        }

        libraryGrid.append(card);

        // Cover thumbnail rendering
        if (category === "book") {
            void renderPdfCoverToCanvas(cardCanvas, item.id, 240);
        } else if (category === "video") {
            void renderVideoPosterToCanvas(cardCanvas, item.id);
        }
    });
}

// --------------------------------------------------------------------------
// Rating Management
// --------------------------------------------------------------------------
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
        itemRatingStatus.textContent = "Đăng nhập bằng tài khoản Học sinh/Khách để đánh giá.";
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
        await fetchSpotlightRating(itemId);
    } catch (error) {
        console.error("Digital Library rating:", error);
        itemRatingStatus.textContent = "Không thể lưu đánh giá. Kiểm tra quyền tài khoản và thử lại.";
        itemRatingStars.forEach(button => button.disabled = false);
    }
}

// --------------------------------------------------------------------------
// Modal Preview Rendering
// --------------------------------------------------------------------------
async function renderItemPreview(itemId, item, assets) {
    itemPreview.replaceChildren();
    const asset = getPrimaryAsset(assets);
    const type = String(item.contentType || item.type || "").toLowerCase();
    const fileUrl = assetUrl(itemId);

    if (!asset) {
        const empty = document.createElement("div");
        empty.className = "preview-placeholder";
        empty.innerHTML = "<span>📄</span><strong>Chưa có file</strong><small>Tài liệu này chưa được upload file đính kèm.</small>";
        itemPreview.append(empty);
        return;
    }

    const format = String(asset.format || "").toLowerCase();

    // Video preview
    if (type === "video" || ["mp4", "webm", "mov", "m4v"].includes(format)) {
        const video = document.createElement("video");
        video.className = "item-preview-media";
        video.crossOrigin = "anonymous";
        video.src = fileUrl;
        video.preload = "metadata";
        video.controls = true;
        video.playsInline = true;

        video.addEventListener("loadedmetadata", () => {
            if (Number.isFinite(video.duration)) appendMetadata("Thời lượng", formatDuration(video.duration));
            if (video.videoWidth && video.videoHeight) appendMetadata("Tỷ lệ", formatRatio(video.videoWidth, video.videoHeight));
        }, { once: true });

        itemPreview.append(video);
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        return;
    }

    // Audio / Podcast preview
    if (type === "audio" || type === "podcast" || ["mp3", "wav", "m4a", "ogg", "flac"].includes(format)) {
        const audio = document.createElement("audio");
        audio.src = fileUrl;
        audio.preload = "metadata";
        audio.controls = true;
        audio.style.width = "100%";
        audio.style.marginTop = "16px";

        audio.addEventListener("loadedmetadata", () => {
            appendMetadata("Thời lượng", formatDuration(audio.duration));
        }, { once: true });

        const holder = document.createElement("div");
        holder.className = "preview-placeholder";
        holder.innerHTML = "<span>🎧</span><strong>Tệp âm thanh số</strong><small>Nghe trực tiếp podcast trong thư viện</small>";
        holder.append(audio);
        itemPreview.append(holder);
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        return;
    }

    // PDF preview
    if (type === "ebook" || type === "document" || format === "pdf") {
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-first-page";
        itemPreview.append(canvas);
        appendMetadata("Dung lượng", formatBytes(asset.sizeBytes));
        appendMetadata("Trang", "Đang tải...");

        try {
            const pdfjs = await getPdfJs();
            const docProxy = await pdfjs.getDocument({ url: fileUrl }).promise;
            const page = await docProxy.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 540 / viewport.width);
            const scaled = page.getViewport({ scale });
            canvas.width = Math.ceil(scaled.width);
            canvas.height = Math.ceil(scaled.height);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: scaled }).promise;

            const pageRow = itemMetadata.querySelector(".item-meta-row:last-child dd");
            if (pageRow) pageRow.textContent = String(docProxy.numPages) + " trang";
        } catch (error) {
            console.warn("PDF preview fallback:", error);
            itemPreview.innerHTML = '<div class="preview-placeholder"><span>📖</span><strong>Tài liệu PDF</strong><small>Bấm "Mở tài liệu" để xem đầy đủ.</small></div>';
        }
        return;
    }

    // Image preview
    if (["image", "png", "jpg", "jpeg", "webp", "gif", "svg"].includes(format) ||
        ["postcard", "artwork", "design"].includes(type)) {
        const image = document.createElement("img");
        image.className = "item-preview-media";
        image.src = fileUrl;
        image.alt = item.title || "Ảnh tài liệu";
        image.addEventListener("load", () => {
            appendMetadata("Kích thước", image.naturalWidth + " × " + image.naturalHeight + " px");
            appendMetadata("Tỷ lệ", formatRatio(image.naturalWidth, image.naturalHeight));
        }, { once: true });
        itemPreview.append(image);
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
    if (event.key === "Escape" && !itemModal.hidden) {
        closeItemModal();
        return;
    }
    if (itemModal.hidden && !document.activeElement.matches("input, textarea, select")) {
        if (event.key === "ArrowLeft") {
            navigateShelf(-1);
        } else if (event.key === "ArrowRight") {
            navigateShelf(1);
        }
    }
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

// --------------------------------------------------------------------------
// Auth & Account Diagnostics
// --------------------------------------------------------------------------
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

// Auto-detect content type when a file is chosen in publishForm
if (publishFileInput && publishTypeSelect) {
    publishFileInput.addEventListener("change", () => {
        const file = publishFileInput.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const mime = file.type?.toLowerCase() || "";

        if (["mp4", "webm", "mov", "m4v"].includes(ext) || mime.startsWith("video/")) {
            publishTypeSelect.value = "video";
        } else if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext) || mime.startsWith("audio/")) {
            publishTypeSelect.value = "podcast";
        } else if (ext === "pdf" || mime === "application/pdf") {
            publishTypeSelect.value = "ebook";
        } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || mime.startsWith("image/")) {
            publishTypeSelect.value = "artwork";
        }
    });
}

// --------------------------------------------------------------------------
// Publish / Upload Item
// --------------------------------------------------------------------------
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
            throw new Error("File vượt quá 100 MB. Hãy dùng file nhỏ hơn.");
        }

        let contentType = String(formData.get("contentType") || "").trim();
        // Intelligent auto-correction for uploaded file format
        if (file instanceof File && file.size > 0) {
            const ext = file.name.split(".").pop()?.toLowerCase() || "";
            if (["mp4", "webm", "mov", "m4v"].includes(ext)) {
                contentType = "video";
            } else if (["mp3", "wav", "m4a", "ogg"].includes(ext)) {
                contentType = "podcast";
            } else if (ext === "pdf" && contentType !== "document") {
                contentType = "ebook";
            }
        }

        publishStatus.textContent = "① Đang tạo metadata tài liệu...";
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
                contentType,
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

            publishStatus.textContent = "② Đang tải " + file.name + " (" + Math.ceil(file.size / 1024 / 1024) + " MB) lên Cloudflare Storage...";

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

            publishStatus.textContent = "✅ Đã thêm tài liệu và upload file thành công!";
        } else {
            publishStatus.textContent = "✅ Đã thêm tài liệu vào thư viện.";
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
    accountDisplayName.textContent = user.displayName || user.email?.split("@")[0] || "Thành viên Thư viện";
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
    } catch {
        addDiagnostic("Cloudflare Worker", "Không kết nối được", "warn");
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
            accountRole.textContent = "CHƯA XÁC MINH";
            return;
        }

        const profile = data.user;
        if (data.needsAudienceSelection) {
            audienceSelection.hidden = false;
            publishPanel.hidden = true;
            accountRole.textContent = "CHỌN VAI TRÒ";
            accountRole.dataset.role = "unselected";
            diagnosticsMessage.textContent = "Tài khoản đã xác minh. Hãy chọn Guest hoặc Student để hoàn tất hồ sơ.";
            return;
        }

        addDiagnostic("Firestore profile", "Found · UID matched", "ok");
        audienceSelection.hidden = true;
        const roleLabels = {
            admin: "ADMIN",
            teacher: "TEACHER",
            project_member: "PROJECT MEMBER",
            viewer: profile.audienceType === "guest" ? "GUEST · VIEWER" : "STUDENT · VIEWER",
            student: "STUDENT · VIEWER"
        };
        const roleLabel = roleLabels[profile.role] || "VIEWER";
        accountDisplayName.textContent = profile.displayName || user.displayName || user.email;
        accountRole.textContent = roleLabel;
        accountRole.dataset.role = profile.role || "viewer";
        publishPanel.hidden = !["project_member", "teacher", "admin"].includes(profile.role);
        await loadPublishedItems();

        diagnosticsMessage.textContent = "Đã xác minh thành công: Firebase Authentication, Firestore profile và vai trò.";
    } catch {
        addDiagnostic("Role authorization", "Viewer mode", "ok");
        accountRole.textContent = "VIEWER";
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
                authStatus.textContent = "Email chưa được xác minh. Hãy kiểm tra hộp thư trước.";
                return;
            }

            authStatus.textContent = "Đăng nhập thành công!";
            await refreshAccountDiagnostics(currentUser);
        }
    } catch (error) {
        const messages = {
            "auth/email-already-in-use": "Email này đã được đăng ký.",
            "auth/invalid-email": "Địa chỉ email không hợp lệ.",
            "auth/weak-password": "Mật khẩu chưa đủ mạnh (tối thiểu 6 ký tự).",
            "auth/invalid-credential": "Email hoặc mật khẩu không chính xác.",
            "auth/too-many-requests": "Có quá nhiều lần thử. Hãy thử lại sau."
        };
        authStatus.textContent = messages[error.code] || "Không thể xử lý yêu cầu. Kiểm tra thông tin và thử lại.";
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

// --------------------------------------------------------------------------
// Load Published Items from Firestore ONLY (Zero hardcoding)
// --------------------------------------------------------------------------
async function loadPublishedItems() {
    try {
        const publishedQuery = query(
            collection(libraryDb, "libraryItems"),
            where("status", "==", "published"),
            limit(50)
        );
        const snapshot = await getDocs(publishedQuery);

        if (snapshot.empty) {
            allLibraryItems = [];
            filteredLibraryItems = [];
            updateCategoryCounters();
            renderBookshelf();
            renderCollectionGrid();
            if (libraryStatus) libraryStatus.textContent = "Chưa có tài liệu nào được xuất bản trong thư viện.";
            return;
        }

        // Fetch each document and its primary asset from the subcollection or Worker
        const documents = await Promise.all(snapshot.docs.map(async docSnap => {
            const data = docSnap.data();
            let primaryAsset = null;
            let format = "";
            let mimeType = "";

            // 1. Check Firestore subcollection libraryItems/{id}/assets
            try {
                const assetsSnap = await getDocs(collection(libraryDb, "libraryItems", docSnap.id, "assets"));
                const assets = assetsSnap.docs.map(a => ({ id: a.id, ...a.data() }));
                primaryAsset = assets.find(a => a.isPrimary === true)
                    || assets.find(a => a.assetType === "original")
                    || assets[0]
                    || null;
                if (primaryAsset) {
                    format = String(primaryAsset.format || "").toLowerCase();
                    mimeType = String(primaryAsset.mimeType || "").toLowerCase();
                }
            } catch (err) {
                console.warn("Subcollection read fallback for", docSnap.id, err);
            }

            // 2. Fallback: if format is still unknown, fetch Worker API /api/v1/library/{id}
            if (!format) {
                try {
                    const resp = await fetch(
                        WORKER_API_BASE_URL.replace(/\/$/, "") + "/api/v1/library/" + encodeURIComponent(docSnap.id),
                        { headers: { accept: "application/json" } }
                    );
                    if (resp.ok) {
                        const wData = await resp.json().catch(() => ({}));
                        const wAssets = Array.isArray(wData.assets) ? wData.assets : [];
                        primaryAsset = getPrimaryAsset(wAssets);
                        if (primaryAsset) {
                            format = String(primaryAsset.format || "").toLowerCase();
                            mimeType = String(primaryAsset.mimeType || "").toLowerCase();
                        }
                    }
                } catch (err) {
                    console.warn("Worker item fetch fallback for", docSnap.id, err);
                }
            }

            return {
                id: docSnap.id,
                ...data,
                primaryAsset,
                format,
                mimeType
            };
        }));

        // Sort latest published first
        documents.sort((a, b) => {
            const aTime = a.publishedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
            const bTime = b.publishedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        // ONLY store real documents from database (NO HARDCODING)
        allLibraryItems = documents;

        updateCategoryCounters();
        filterLibraryItems();

        const requestedItemId = new URLSearchParams(window.location.search).get("item");
        if (requestedItemId) {
            const matchIdx = filteredLibraryItems.findIndex(i => i.id === requestedItemId);
            if (matchIdx !== -1) {
                setActiveShelfBook(matchIdx);
                await openItemModal(requestedItemId);
            }
        }
    } catch (error) {
        console.error("Digital Library Firestore error:", error);
        allLibraryItems = [];
        filteredLibraryItems = [];
        updateCategoryCounters();
        renderBookshelf();
        renderCollectionGrid();
        if (libraryStatus) {
            libraryStatus.textContent = "Chưa kết nối được Firestore. Hãy kiểm tra cấu hình mạng và Security Rules.";
        }
    }
}

// --------------------------------------------------------------------------
// Event Listeners for Filters, Search, Navigation & Audio
// --------------------------------------------------------------------------
categoryPills.forEach(pill => {
    pill.addEventListener("click", () => {
        categoryPills.forEach(p => {
            p.classList.toggle("active", p === pill);
            p.setAttribute("aria-selected", p === pill ? "true" : "false");
        });
        currentFilter = pill.dataset.filter || "all";
        filterLibraryItems();
    });
});

if (shelfPrevBtn) {
    shelfPrevBtn.addEventListener("click", () => navigateShelf(-1));
}
if (shelfNextBtn) {
    shelfNextBtn.addEventListener("click", () => navigateShelf(1));
}

if (librarySearchInput) {
    librarySearchInput.addEventListener("input", event => {
        currentSearchQuery = event.target.value.trim();
        if (clearSearchBtn) clearSearchBtn.hidden = !currentSearchQuery;
        filterLibraryItems();
    });
}

if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
        if (librarySearchInput) {
            librarySearchInput.value = "";
            currentSearchQuery = "";
            clearSearchBtn.hidden = true;
            filterLibraryItems();
        }
    });
}

if (ambientToggleBtn) {
    ambientToggleBtn.addEventListener("click", toggleAmbientAudio);
}

// Touch swipe support on 3D shelf
let touchStartX = 0;
let touchEndX = 0;
if (shelfTrack) {
    shelfTrack.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    shelfTrack.addEventListener("touchend", e => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 45) {
            navigateShelf(diff > 0 ? 1 : -1);
        }
    }, { passive: true });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initialize
createAmbientParticles();
loadPublishedItems();
