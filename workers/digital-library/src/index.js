import { AwsClient } from "aws4fetch";

const FIREBASE_JWKS_URL =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let jwksCache = null;
let jwksExpiresAt = 0;


class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", ...headers }
    });
}

function base64UrlToBytes(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeBase64UrlJson(value) {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function getFirebaseJwks() {
    if (jwksCache && Date.now() < jwksExpiresAt) return jwksCache;

    const response = await fetch(FIREBASE_JWKS_URL);
    if (!response.ok) throw new HttpError(503, "Không thể tải khóa xác minh Firebase.");

    const data = await response.json();
    const cacheControl = response.headers.get("cache-control") || "";
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
    jwksCache = data.keys || [];
    jwksExpiresAt = Date.now() + Math.max(60, maxAge) * 1000;
    return jwksCache;
}

async function verifyFirebaseIdToken(request, env) {
    const authorization = request.headers.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, "Thiếu Firebase ID token.");

    const token = match[1];
    const parts = token.split(".");
    if (parts.length !== 3) throw new HttpError(401, "Firebase ID token không hợp lệ.");

    let header;
    let claims;
    try {
        header = decodeBase64UrlJson(parts[0]);
        claims = decodeBase64UrlJson(parts[1]);
    } catch {
        throw new HttpError(401, "Không thể đọc Firebase ID token.");
    }

    const projectId = env.FIREBASE_PROJECT_ID;
    const now = Math.floor(Date.now() / 1000);
    if (
        header.alg !== "RS256" ||
        !header.kid ||
        claims.aud !== projectId ||
        claims.iss !== "https://securetoken.google.com/" + projectId ||
        typeof claims.sub !== "string" ||
        claims.sub.length === 0 ||
        claims.sub.length > 128 ||
        !claims.exp ||
        claims.exp <= now ||
        claims.iat > now + 60 ||
        !claims.auth_time ||
        claims.auth_time > now + 60 ||
        claims.email_verified !== true ||
        typeof claims.email !== "string"
    ) {
        throw new HttpError(401, "Token hết hạn, sai dự án hoặc email chưa xác minh.");
    }

    const jwks = await getFirebaseJwks();
    const jwk = jwks.find(key => key.kid === header.kid);
    if (!jwk) {
        jwksCache = null;
        jwksExpiresAt = 0;
        throw new HttpError(401, "Không tìm thấy khóa xác minh token.");
    }

    const publicKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
    );
    const signedData = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        base64UrlToBytes(parts[2]),
        signedData
    );
    if (!valid) throw new HttpError(401, "Chữ ký Firebase ID token không hợp lệ.");

    return claims;
}

function firestoreBase(env) {
    return "https://firestore.googleapis.com/v1/projects/" +
        encodeURIComponent(env.FIREBASE_PROJECT_ID) +
        "/databases/(default)/documents";
}

function encodeValue(value) {
    if (value === null) return { nullValue: null };
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") {
        return Number.isInteger(value)
            ? { integerValue: String(value) }
            : { doubleValue: value };
    }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
    if (value && typeof value === "object" && value.__timestamp) {
        return { timestampValue: value.__timestamp };
    }
    return {
        mapValue: {
            fields: Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, encodeValue(item)])
            )
        }
    };
}

function decodeValue(value) {
    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return value.doubleValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("nullValue" in value) return null;
    if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
    if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
    return null;
}

function encodeFields(data) {
    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
    );
}

function decodeFields(fields = {}) {
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
    );
}

async function firestoreRequest(path, token, options = {}) {
    const response = await fetch(firestoreBase(options.env) + path, {
        method: options.method || "GET",
        headers: {
            ...(token ? { authorization: "Bearer " + token } : {}),
            ...(options.body ? { "content-type": "application/json" } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON error */ }

    if (!response.ok) {
        const message = data.error?.message || "Firestore request thất bại.";
        if (response.status === 404) throw new HttpError(404, message);
        if (response.status === 403) throw new HttpError(403, "Firestore Security Rules từ chối thao tác.");
        throw new HttpError(response.status >= 500 ? 502 : response.status, message);
    }
    return data;
}

async function getDocument(collectionName, id, token, env) {
    const path = "/" + collectionName + "/" + encodeURIComponent(id);
    const document = await firestoreRequest(path, token, { env });
    return { id, data: decodeFields(document.fields), name: document.name };
}

async function createDocument(collectionName, id, data, token, env) {
    const path = "/" + collectionName + "?documentId=" + encodeURIComponent(id);
    return firestoreRequest(path, token, {
        env,
        method: "POST",
        body: { fields: encodeFields(data) }
    });
}

async function patchDocument(collectionName, id, data, token, env) {
    const params = Object.keys(data)
        .map(key => "updateMask.fieldPaths=" + encodeURIComponent(key))
        .join("&");
    return firestoreRequest(
        "/" + collectionName + "/" + encodeURIComponent(id) + "?" + params,
        token,
        { env, method: "PATCH", body: { fields: encodeFields(data) } }
    );
}

async function runQuery(collectionName, structuredQuery, token, env) {
    const result = await firestoreRequest(
        ":runQuery",
        token,
        { env, method: "POST", body: { structuredQuery: { from: [{ collectionId: collectionName }], ...structuredQuery } } }
    );
    return (result || [])
        .filter(row => row.document)
        .map(row => ({
            id: row.document.name.split("/").pop(),
            ...decodeFields(row.document.fields)
        }));
}

function normalizeProfile(uid, email, data) {
    const allowedRoles = ["viewer", "project_member", "teacher", "admin", "student"];
    if (!allowedRoles.includes(data.role)) {
        throw new HttpError(403, "Tài khoản chưa được cấp role hợp lệ.");
    }
    if (typeof data.email !== "string" || data.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        throw new HttpError(403, "Email trong Firestore không khớp với email Firebase Authentication.");
    }
    if (data.accountStatus !== "active") {
        throw new HttpError(403, "Tài khoản thư viện đang bị khóa hoặc chưa được kích hoạt.");
    }
    const legacyStudent = data.role === "student";
    const audienceType = data.audienceType || (legacyStudent ? "student" : null);
    if (data.role === "viewer" && !["guest", "student"].includes(audienceType)) {
        throw new HttpError(403, "Hồ sơ viewer thiếu audienceType hợp lệ.");
    }
    return {
        uid,
        email,
        displayName: typeof data.displayName === "string" ? data.displayName : email.split("@")[0],
        audienceType,
        role: legacyStudent ? "viewer" : data.role,
        accountStatus: data.accountStatus
    };
}

async function getOrCreateProfile(claims, token, env) {
    try {
        const profile = await getDocument("users", claims.sub, token, env);
        return normalizeProfile(claims.sub, claims.email, profile.data);
    } catch (error) {
        if (error instanceof HttpError && error.status === 404) return null;
        throw error;
    }
}

async function createAudienceProfile(claims, token, env, audienceType) {
    if (!["guest", "student"].includes(audienceType)) {
        throw new HttpError(400, "Lựa chọn phải là guest hoặc student.");
    }
    const profile = {
        email: claims.email,
        displayName: claims.name || claims.email.split("@")[0],
        audienceType,
        role: "viewer",
        accountStatus: "active",
        createdAt: { __timestamp: new Date().toISOString() }
    };
    await createDocument("users", claims.sub, profile, token, env);
    return normalizeProfile(claims.sub, claims.email, profile);
}

function requireStaff(profile) {
    if (!["teacher", "admin"].includes(profile.role)) {
        throw new HttpError(403, "Chức năng này chỉ dành cho giáo viên hoặc quản trị viên.");
    }
}

function randomId() {
    return crypto.randomUUID().replace(/-/g, "");
}


function parseLimit(value, fallback = 20) {
    const number = Number(value);
    return Number.isInteger(number) ? Math.min(50, Math.max(1, number)) : fallback;
}

const CONTENT_TYPES = ["ebook", "article", "video", "podcast", "postcard", "artwork", "design", "digital_product", "document", "audio"];
const LEGACY_TYPE_BY_CONTENT = { ebook: "pdf", article: "pdf", video: "video", podcast: "audio", postcard: "image", artwork: "image", design: "image", digital_product: "document", document: "pdf", audio: "audio" };

function normalizeStringArray(value, maxItems, maxLength) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maxItems) throw new HttpError(400, "Danh sách dữ liệu không hợp lệ.");
    return value.map(item => String(item).trim()).filter(Boolean).slice(0, maxItems).map(item => item.slice(0, maxLength));
}

function normalizeSlug(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function normalizeMetadata(value) {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "metadata phải là object.");
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
        const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
        if (!safeKey) continue;
        if (["string", "number", "boolean"].includes(typeof item) || item === null) result[safeKey] = item;
    }
    return result;
}

function normalizeReader(value) {
    if (value === undefined) return { enabled: false, defaultFormat: null };
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "reader phải là object.");
    return { enabled: value.enabled === true, defaultFormat: value.defaultFormat ? String(value.defaultFormat).slice(0, 20) : null };
}

function normalizeContentInput(body) {
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const contentType = String(body.contentType || body.type || "").trim();
    const categoryId = String(body.categoryId || "").trim();
    const language = String(body.language || "vi").trim();
    if (title.length < 3 || title.length > 160) throw new HttpError(400, "Tiêu đề phải dài từ 3 đến 160 ký tự.");
    if (description.length > 3000) throw new HttpError(400, "Mô tả quá dài.");
    if (!CONTENT_TYPES.includes(contentType)) throw new HttpError(400, "contentType không hợp lệ.");
    if (categoryId.length > 80) throw new HttpError(400, "Mã danh mục quá dài.");
    if (!/^[a-zA-Z]{2,10}(-[a-zA-Z0-9]{2,8})*$/.test(language)) throw new HttpError(400, "Mã ngôn ngữ không hợp lệ.");
    const authors = normalizeStringArray(body.authors, 20, 160);
    return { title, slug: normalizeSlug(body.slug || title), description, contentType, legacyType: LEGACY_TYPE_BY_CONTENT[contentType], categoryId, language, authors, tags: normalizeStringArray(body.tags, 30, 50), authorNamesNormalized: authors.map(name => name.toLowerCase()), metadata: normalizeMetadata(body.metadata), reader: normalizeReader(body.reader) };
}

function normalizeQrCode(value, itemId) {
    const enabled = value === undefined ? true : value?.enabled === true;
    return { enabled, targetPath: enabled ? "/library/" + itemId : null };
}

async function createLibraryItem(request, claims, profile, token, env) {
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) throw new HttpError(415, "Tạm thời chỉ nhận metadata JSON; file upload sẽ được nối vào Storage Layer sau.");
    const body = await request.json().catch(() => { throw new HttpError(400, "JSON không hợp lệ."); });
    const content = normalizeContentInput(body);
    const id = randomId();
    const now = new Date().toISOString();
    const qrCode = normalizeQrCode(body.qrCode, id);
    await createDocument("libraryItems", id, { schemaVersion: 2, title: content.title, slug: content.slug, description: content.description, contentType: content.contentType, type: content.legacyType, authors: content.authors, authorNamesNormalized: content.authorNamesNormalized, categoryId: content.categoryId, tags: content.tags, language: content.language, metadata: content.metadata, reader: content.reader, qrCode, submittedBy: claims.sub, submittedByName: profile.displayName || claims.email, publishedBy: claims.sub, status: "published", fileStatus: "awaiting_upload", createdBy: claims.sub, createdAt: { __timestamp: now }, updatedAt: { __timestamp: now }, publishedAt: { __timestamp: now } }, token, env);
    return json({ id, status: "published", fileStatus: "awaiting_upload", contentType: content.contentType, qrCode, message: "Đã tạo metadata. File sẽ được gắn qua Storage Layer." }, 201);
}

async function createSubmission(request, claims, profile, token, env) {
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) throw new HttpError(415, "Tạm thời chỉ nhận metadata JSON; file upload sẽ được nối vào Storage Layer sau.");
    const body = await request.json().catch(() => { throw new HttpError(400, "JSON không hợp lệ."); });
    const content = normalizeContentInput(body);
    const id = randomId();
    const now = new Date().toISOString();
    await createDocument("submissions", id, { schemaVersion: 2, title: content.title, slug: content.slug, description: content.description, contentType: content.contentType, type: content.legacyType, authors: content.authors, authorNamesNormalized: content.authorNamesNormalized, categoryId: content.categoryId, tags: content.tags, language: content.language, metadata: content.metadata, reader: content.reader, status: "pending", fileStatus: "awaiting_upload", submittedBy: claims.sub, submittedByName: profile.displayName || claims.email, submittedAt: { __timestamp: now } }, token, env);
    return json({ id, status: "pending", fileStatus: "awaiting_upload", contentType: content.contentType, message: "Đã nhận metadata. File sẽ được gắn sau khi Storage Layer sẵn sàng." }, 201);
}

async function listSubcollection(parentPath, collectionName, token, env, pageSize = 100) {
    const path = "/" + parentPath + "/" + collectionName + "?pageSize=" + pageSize;
    const result = await firestoreRequest(path, token, { env });
    return (result.documents || []).map(document => ({
        id: document.name.split("/").pop(),
        ...decodeFields(document.fields)
    }));
}

function getStorageProvider(env) {
    const provider = String(env.DIGITAL_LIBRARY_STORAGE_PROVIDER || "dev").trim().toLowerCase();
    if (!["dev", "b2"].includes(provider)) {
        throw new HttpError(503, "Storage provider không hợp lệ.");
    }
    if (provider === "dev" && !env.DIGITAL_LIBRARY_BUCKET) {
        throw new HttpError(503, "DEV storage chưa được bind. Hãy chạy Worker bằng wrangler.dev.toml.");
    }
    if (provider === "b2" && (!env.B2_ENDPOINT || !env.B2_BUCKET || !env.B2_KEY_ID || !env.B2_APPLICATION_KEY)) {
        throw new HttpError(503, "Backblaze B2 chưa được cấu hình đầy đủ.");
    }
    return provider;
}

function requireR2(env) {
    if (!env.DIGITAL_LIBRARY_BUCKET) {
        throw new HttpError(503, "DEV storage chưa được bind. Hãy chạy Worker bằng wrangler.dev.toml.");
    }
    return env.DIGITAL_LIBRARY_BUCKET;
}

function b2ObjectUrl(env, storageKey) {
    const endpoint = String(env.B2_ENDPOINT || "").replace(/\/+$/, "");
    const bucket = encodeURIComponent(String(env.B2_BUCKET || ""));
    const key = String(storageKey || "").split("/").map(encodeURIComponent).join("/");
    return endpoint + "/" + bucket + "/" + key;
}

function b2Client(env) {
    const endpoint = new URL(env.B2_ENDPOINT);
    const region = endpoint.hostname.split(".")[1];
    return new AwsClient({
        accessKeyId: env.B2_KEY_ID,
        secretAccessKey: env.B2_APPLICATION_KEY,
        service: "s3",
        region,
        retries: 2
    });
}

async function b2PutObject(request, env, storageKey, mimeType, itemId, assetId, fileName, contentLength) {
    const body = await request.arrayBuffer();
    const response = await b2Client(env).fetch(b2ObjectUrl(env, storageKey), {
        method: "PUT",
        headers: {
            "content-type": mimeType,
            "content-length": String(contentLength),
            "content-disposition": "inline",
            "x-amz-meta-itemid": itemId,
            "x-amz-meta-assetid": assetId,
            "x-amz-meta-originalname": fileName
        },
        body
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new HttpError(502, "Backblaze B2 upload thất bại" + (detail ? ": " + detail.slice(0, 500) : "."));
    }
}

async function b2DeleteObject(env, storageKey) {
    const response = await b2Client(env).fetch(b2ObjectUrl(env, storageKey), {
        method: "DELETE"
    });
    if (!response.ok && response.status !== 404) {
        const detail = await response.text().catch(() => "");
        throw new HttpError(502, "Backblaze B2 delete thất bại" + (detail ? ": " + detail.slice(0, 500) : "."));
    }
}

async function b2GetObject(request, env, storageKey) {
    const headers = new Headers();
    const range = request.headers.get("range");
    const ifNoneMatch = request.headers.get("if-none-match");
    const ifModifiedSince = request.headers.get("if-modified-since");
    if (range) headers.set("range", range);
    if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);
    if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince);

    return b2Client(env).fetch(b2ObjectUrl(env, storageKey), {
        method: "GET",
        headers
    });
}

function normalizeUploadFormat(file, requestedFormat) {
    const explicit = String(requestedFormat || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (explicit) return explicit.slice(0, 20);
    const fromName = String(file.name || "").split(".").pop().toLowerCase().replace(/[^a-z0-9]+/g, "");
    return fromName.slice(0, 20) || "bin";
}

function buildStorageKey(itemId, assetId, format) {
    return "library/" + itemId + "/" + assetId + "." + format;
}

async function uploadLibraryAsset(request, itemId, claims, profile, token, env) {
    if (!["project_member", "teacher", "admin"].includes(profile.role)) {
        throw new HttpError(403, "Chỉ Project Member, giáo viên hoặc admin mới được upload file.");
    }

    const item = await getDocument("libraryItems", itemId, token, env);
    if (!["published", "archived"].includes(item.data.status)) {
        throw new HttpError(404, "Không tìm thấy tài liệu hợp lệ.");
    }

    const storageProvider = getStorageProvider(env);
    const maxBytes = Number(env.DIGITAL_LIBRARY_MAX_UPLOAD_BYTES || 50 * 1024 * 1024);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (!contentLength) {
        throw new HttpError(411, "Upload file phải có Content-Length.");
    }
    if (contentLength > maxBytes) {
        throw new HttpError(413, "File vượt quá giới hạn upload hiện tại.");
    }
    if (!request.body) {
        throw new HttpError(400, "Thiếu request body.");
    }

    const url = new URL(request.url);
    const assetType = String(url.searchParams.get("assetType") || "original").trim();
    const format = String(url.searchParams.get("format") || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
    const encodedFileName = String(request.headers.get("x-file-name") || "").trim();
    let fileName = encodedFileName;
    try {
        fileName = decodeURIComponent(encodedFileName);
    } catch {
        // Keep the raw header value if an older client sent a non-encoded filename.
    }
    fileName = fileName.slice(0, 200);
    if (!["cover", "original", "preview", "thumbnail", "attachment"].includes(assetType)) {
        throw new HttpError(400, "assetType không hợp lệ.");
    }
    if (!format) {
        throw new HttpError(400, "Thiếu format, ví dụ pdf hoặc mp4.");
    }

    const assetId = randomId();
    const storageKey = buildStorageKey(itemId, assetId, format);
    const mimeType = request.headers.get("content-type") || "application/octet-stream";

    if (storageProvider === "dev") {
        const bucket = requireR2(env);
        await bucket.put(storageKey, request.body, {
            httpMetadata: {
                contentType: mimeType,
                contentDisposition: "inline"
            },
            customMetadata: {
                itemId,
                assetId,
                originalName: fileName
            }
        });
    } else {
        await b2PutObject(request, env, storageKey, mimeType, itemId, assetId, fileName, contentLength);
    }

    const now = new Date().toISOString();
    try {
        await createDocument("libraryItems/" + itemId + "/assets", assetId, {
            assetType,
            format,
            storageProvider,
            storageKey,
            mimeType,
            sizeBytes: contentLength,
            checksum: "",
            isPrimary: url.searchParams.get("isPrimary") !== "false",
            access: url.searchParams.get("access") === "private" ? "private" : "public",
            createdAt: { __timestamp: now },
            createdBy: claims.sub
        }, token, env);

        await patchDocument("libraryItems", itemId, {
            fileStatus: "uploaded",
            updatedAt: { __timestamp: now }
        }, token, env);
    } catch (error) {
        if (storageProvider === "dev") {
            await requireR2(env).delete(storageKey);
        } else {
            await b2DeleteObject(env, storageKey);
        }
        throw error;
    }

    return json({
        id: assetId,
        itemId,
        assetType,
        format,
        storageProvider,
        storageKey,
        sizeBytes: contentLength,
        mimeType,
        status: "uploaded"
    }, 201);
}

async function getPrimaryLibraryAsset(itemId, token, env) {
    const assets = await listSubcollection("libraryItems/" + itemId, "assets", token, env);
    return assets.find(asset => asset.isPrimary === true)
        || assets.find(asset => asset.assetType === "original")
        || assets[0]
        || null;
}

async function serveLibraryAsset(request, itemId, token, env) {
    const item = await getDocument("libraryItems", itemId, token || "", env);
    if (item.data.status !== "published") {
        throw new HttpError(404, "Không tìm thấy tài liệu đã xuất bản.");
    }

    const asset = await getPrimaryLibraryAsset(itemId, token || "", env);
    if (!asset || !asset.storageKey) {
        throw new HttpError(404, "Tài liệu chưa có file.");
    }

    const storageProvider = String(asset.storageProvider || env.DIGITAL_LIBRARY_STORAGE_PROVIDER || "dev").trim().toLowerCase();

    if (storageProvider === "b2") {
        const response = await b2GetObject(request, env, asset.storageKey);
        if (response.status === 404) throw new HttpError(404, "File không tồn tại trong Storage.");
        if (!response.ok && response.status !== 304 && response.status !== 206) {
            const detail = await response.text().catch(() => "");
            throw new HttpError(response.status >= 500 ? 502 : response.status, "Backblaze B2 không thể đọc file." + (detail ? " " + detail.slice(0, 300) : ""));
        }

        const headers = new Headers(response.headers);
        headers.set("cache-control", "public, max-age=3600");
        headers.set("accept-ranges", "bytes");
        headers.set("x-content-type-options", "nosniff");
        return new Response(response.body, { status: response.status, headers });
    }

    if (storageProvider !== "dev") {
        throw new HttpError(503, "Storage provider của asset không được hỗ trợ.");
    }

    const bucket = requireR2(env);
    const object = await bucket.get(asset.storageKey, {
        onlyIf: request.headers,
        range: request.headers
    });
    if (!object) throw new HttpError(404, "File không tồn tại trong Storage.");

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=3600");
    headers.set("accept-ranges", "bytes");
    headers.set("x-content-type-options", "nosniff");

    if (object.range) {
        const range = object.range;
        const start = range.offset;
        const end = range.offset + range.length - 1;
        headers.set("content-range", "bytes " + start + "-" + end + "/" + object.size);
        headers.set("content-length", String(range.length));
        return new Response(object.body, { status: 206, headers });
    }

    headers.set("content-length", String(object.size));
    return new Response(object.body, { status: 200, headers });
}

async function createAssetMetadata(request, itemId, claims, profile, token, env) {
    const item = await getDocument("libraryItems", itemId, token, env);
    const canWrite = ["project_member", "teacher", "admin"].includes(profile.role) || item.data.submittedBy === claims.sub;
    if (!canWrite) throw new HttpError(403, "Không có quyền gắn asset cho tài liệu này.");
    const body = await request.json().catch(() => { throw new HttpError(400, "JSON không hợp lệ."); });
    const assetType = String(body.assetType || "").trim();
    const format = String(body.format || "").trim().toLowerCase();
    const storageProvider = String(body.storageProvider || env.DIGITAL_LIBRARY_STORAGE_PROVIDER || "dev").trim();
    const storageKey = String(body.storageKey || "").trim();
    if (!["cover", "original", "preview", "thumbnail", "attachment"].includes(assetType)) throw new HttpError(400, "assetType không hợp lệ.");
    if (!/^[a-z0-9.+-]{1,30}$/.test(format)) throw new HttpError(400, "format không hợp lệ.");
    if (!["dev", "b2"].includes(storageProvider)) throw new HttpError(400, "storageProvider phải là dev hoặc b2.");
    if (storageKey.length > 500) throw new HttpError(400, "storageKey quá dài.");
    if (storageProvider === "b2" && !storageKey) throw new HttpError(400, "B2 asset phải có storageKey.");
    const assetId = randomId();
    const now = new Date().toISOString();
    await createDocument("libraryItems/" + itemId + "/assets", assetId, { assetType, format, storageProvider, storageKey: storageKey || null, mimeType: String(body.mimeType || "").slice(0, 120), sizeBytes: Number.isSafeInteger(body.sizeBytes) && body.sizeBytes >= 0 ? body.sizeBytes : 0, checksum: String(body.checksum || "").slice(0, 128), isPrimary: body.isPrimary === true, access: body.access === "private" ? "private" : "public", createdAt: { __timestamp: now }, createdBy: claims.sub }, token, env);
    return json({ id: assetId, itemId, storageProvider, message: storageProvider === "dev" ? "Đã lưu metadata asset ở chế độ DEV; file bytes chưa được lưu." : "Đã lưu metadata asset cho B2." }, 201);
}

async function listPublished(url, token, env) {
    const items = await runQuery("libraryItems", { where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } }, limit: parseLimit(url.searchParams.get("limit"), 50) }, token || "", env);
    const categoryId = url.searchParams.get("categoryId");
    const contentType = url.searchParams.get("contentType") || url.searchParams.get("type");
    const tag = url.searchParams.get("tag");
    const filtered = items.filter(item => (!categoryId || item.categoryId === categoryId) && (!contentType || item.contentType === contentType || (!item.contentType && item.type === contentType) || (contentType === "ebook" && item.type === "pdf") || (contentType === "podcast" && item.type === "audio") || (contentType === "postcard" && item.type === "image")) && (!tag || (Array.isArray(item.tags) && item.tags.includes(tag))));
    return json({ items: filtered });
}

async function getPublishedItem(id, token, env) {
    const item = await getDocument("libraryItems", id, token || "", env);
    if (item.data.status !== "published") throw new HttpError(404, "Không tìm thấy tài liệu đã xuất bản.");
    return item;
}

async function listMySubmissions(claims, token, env, url) {
    const submissions = await runQuery("submissions", {
        where: {
            fieldFilter: {
                field: { fieldPath: "submittedBy" },
                op: "EQUAL",
                value: { stringValue: claims.sub }
            }
        },
        limit: parseLimit(url.searchParams.get("limit"), 30)
    }, token, env);
    return json({ submissions });
}

async function listPendingSubmissions(token, env, url) {
    const status = url.searchParams.get("status") || "pending";
    if (!["pending", "approved", "rejected"].includes(status)) {
        throw new HttpError(400, "Trạng thái lọc không hợp lệ.");
    }
    const submissions = await runQuery("submissions", {
        where: {
            fieldFilter: {
                field: { fieldPath: "status" },
                op: "EQUAL",
                value: { stringValue: status }
            }
        },
        limit: parseLimit(url.searchParams.get("limit"), 30)
    }, token, env);
    return json({ submissions });
}

async function approveSubmission(id, claims, token, env) {
    const submission = await getDocument("submissions", id, token, env);
    if (submission.data.status !== "pending") throw new HttpError(409, "Bài gửi không còn ở trạng thái chờ duyệt.");
    const libraryItemId = randomId();
    const now = new Date().toISOString();
    const contentType = submission.data.contentType || ({ pdf: "ebook", audio: "podcast", image: "postcard", video: "video" }[submission.data.type] || "document");
    const publishedItem = { schemaVersion: 2, title: submission.data.title, slug: submission.data.slug || normalizeSlug(submission.data.title), description: submission.data.description || "", contentType, type: submission.data.type || LEGACY_TYPE_BY_CONTENT[contentType], authors: submission.data.authors || [], authorNamesNormalized: submission.data.authorNamesNormalized || [], categoryId: submission.data.categoryId || "", tags: submission.data.tags || [], language: submission.data.language || "vi", metadata: submission.data.metadata || {}, reader: submission.data.reader || { enabled: false, defaultFormat: null }, qrCode: { enabled: true, targetPath: "/library/" + libraryItemId }, submittedBy: submission.data.submittedBy, submittedByName: submission.data.submittedByName || "", approvedBy: claims.sub, status: "published", fileStatus: "awaiting_upload", createdBy: submission.data.submittedBy, createdAt: submission.data.submittedAt || { __timestamp: now }, updatedAt: { __timestamp: now }, publishedAt: { __timestamp: now } };
    await createDocument("libraryItems", libraryItemId, publishedItem, token, env);
    try {
        await patchDocument("submissions", id, { status: "approved", libraryItemId, reviewedBy: claims.sub, reviewedAt: { __timestamp: now } }, token, env);
    } catch (error) {
        await fetch(firestoreBase(env) + "/libraryItems/" + libraryItemId, { method: "DELETE", headers: { authorization: "Bearer " + token } });
        throw error;
    }
    await createDocument("moderationLogs", randomId(), { action: "approve", submissionId: id, libraryItemId, actorUid: claims.sub, createdAt: { __timestamp: now } }, token, env);
    return json({ id, libraryItemId, status: "published", contentType });
}
async function rejectSubmission(id, request, claims, token, env) {
    const submission = await getDocument("submissions", id, token, env);
    if (submission.data.status !== "pending") throw new HttpError(409, "Bài gửi không còn ở trạng thái chờ duyệt.");

    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim().slice(0, 1000);
    const now = new Date().toISOString();

    await patchDocument("submissions", id, {
        status: "rejected",
        reviewNote: reason,
        reviewedBy: claims.sub,
        reviewedAt: { __timestamp: now }
    }, token, env);

    await createDocument("moderationLogs", randomId(), {
        action: "reject",
        submissionId: id,
        actorUid: claims.sub,
        reason,
        createdAt: { __timestamp: now }
    }, token, env);

    return json({ id, status: "rejected" });
}

async function archiveLibraryItem(id, claims, token, env) {
    const item = await getDocument("libraryItems", id, token, env);
    if (item.data.status !== "published") throw new HttpError(409, "Tài liệu không ở trạng thái đã xuất bản.");
    const now = new Date().toISOString();

    await patchDocument("libraryItems", id, {
        status: "archived",
        archivedBy: claims.sub,
        archivedAt: { __timestamp: now }
    }, token, env);

    await createDocument("moderationLogs", randomId(), {
        action: "archive",
        libraryItemId: id,
        actorUid: claims.sub,
        createdAt: { __timestamp: now }
    }, token, env);

    return json({ id, status: "archived" });
}

function corsHeaders(request, env) {
    const origin = request.headers.get("origin");
    const allowed = (env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    if (origin && !allowed.includes(origin)) {
        throw new HttpError(403, "Origin không được phép truy cập API.");
    }

    const headers = {
        "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type, X-File-Name",
        "access-control-max-age": "86400",
        "vary": "Origin"
    };
    if (origin) headers["access-control-allow-origin"] = origin;
    return headers;
}

async function handle(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    if (method === "OPTIONS") {
        const preflightHeaders = corsHeaders(request, env);
        return new Response(null, { status: 204, headers: preflightHeaders });
    }
    if (method === "GET" && path === "/health") {
        return withHeaders(
            json({ ok: true, service: "a5-digital-library-api", version: 1 }),
            corsHeaders(request, env)
        );
    }

    const cors = corsHeaders(request, env);
    if (method === "GET" && path === "/api/v1/library") {
        return listPublished(url, null, env).then(response => withHeaders(response, cors));
    }

    const publicItemMatch = path.match(/^\/api\/v1\/library\/([a-zA-Z0-9_-]+)$/);
    if (method === "GET" && publicItemMatch) {
        const item = await getPublishedItem(publicItemMatch[1], null, env);
        const { assetKey, ...publicData } = item.data;
        return withHeaders(json({ id: item.id, item: publicData }), cors);
    }

    const publicFileMatch = path.match(/^\/api\/v1\/library\/([a-zA-Z0-9_-]+)\/file$/);
    if (method === "GET" && publicFileMatch) {
        return withHeaders(await serveLibraryAsset(request, publicFileMatch[1], null, env), cors);
    }

    const claims = await verifyFirebaseIdToken(request, env);
    const token = request.headers.get("authorization").replace(/^Bearer\s+/i, "");
    const profile = await getOrCreateProfile(claims, token, env);

    if (method === "GET" && path === "/api/v1/me") {
        return withHeaders(json(profile
            ? { user: profile }
            : { user: null, needsAudienceSelection: true }), cors);
    }

    if (method === "POST" && path === "/api/v1/me/audience") {
        if (profile) throw new HttpError(409, "Hồ sơ đã được thiết lập; không thể tự đổi nhóm người dùng.");
        const body = await request.json().catch(() => { throw new HttpError(400, "JSON không hợp lệ."); });
        const created = await createAudienceProfile(claims, token, env, body.audienceType);
        return withHeaders(json({ user: created }, 201), cors);
    }

    if (!profile) throw new HttpError(409, "Hãy chọn Guest hoặc Student để hoàn tất hồ sơ.");

    if (method === "POST" && path === "/api/v1/library") {
        if (!["project_member", "teacher", "admin"].includes(profile.role)) {
            throw new HttpError(403, "Chỉ Project Member, giáo viên hoặc admin mới được thêm tài liệu.");
        }
        return withHeaders(await createLibraryItem(request, claims, profile, token, env), cors);
    }

    if (method === "POST" && path === "/api/v1/submissions") {
        return withHeaders(await createSubmission(request, claims, profile, token, env), cors);
    }
    if (method === "GET" && path === "/api/v1/my/submissions") {
        return withHeaders(await listMySubmissions(claims, token, env, url), cors);
    }

    if (path === "/api/v1/admin/submissions" && method === "GET") {
        requireStaff(profile);
        return withHeaders(await listPendingSubmissions(token, env, url), cors);
    }

    const approveMatch = path.match(/^\/api\/v1\/admin\/submissions\/([a-zA-Z0-9_-]+)\/approve$/);
    if (method === "POST" && approveMatch) {
        requireStaff(profile);
        return withHeaders(await approveSubmission(approveMatch[1], claims, token, env), cors);
    }

    const rejectMatch = path.match(/^\/api\/v1\/admin\/submissions\/([a-zA-Z0-9_-]+)\/reject$/);
    if (method === "POST" && rejectMatch) {
        requireStaff(profile);
        return withHeaders(await rejectSubmission(rejectMatch[1], request, claims, token, env), cors);
    }

    const uploadMatch = path.match(/^\/api\/v1\/library\/([a-zA-Z0-9_-]+)\/upload$/);
    if (method === "PUT" && uploadMatch) {
        return withHeaders(await uploadLibraryAsset(request, uploadMatch[1], claims, profile, token, env), cors);
    }

    const assetMatch = path.match(/^\/api\/v1\/library\/([a-zA-Z0-9_-]+)\/assets$/);
    if (method === "POST" && assetMatch) {
        return withHeaders(await createAssetMetadata(request, assetMatch[1], claims, profile, token, env), cors);
    }
    const archiveMatch = path.match(/^\/api\/v1\/admin\/library\/([a-zA-Z0-9_-]+)\/archive$/);
    if (method === "POST" && archiveMatch) {
        requireStaff(profile);
        return withHeaders(await archiveLibraryItem(archiveMatch[1], claims, token, env), cors);
    }

    throw new HttpError(404, "Không tìm thấy API endpoint.");
}

function withHeaders(response, headers) {
    const merged = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) merged.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

export default {
    async fetch(request, env) {
        try {
            return await handle(request, env);
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            if (!(error instanceof HttpError)) console.error("Digital Library Worker error:", error);
            let headers = {};
            try { headers = corsHeaders(request, env); } catch { /* blocked origin */ }
            return json({
                error: error instanceof HttpError ? error.message : "Lỗi máy chủ nội bộ."
            }, status, headers);
        }
    }
};
