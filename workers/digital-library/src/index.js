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

async function getOrCreateProfile(claims, token, env) {
    try {
        const profile = await getDocument("users", claims.sub, token, env);
        if (profile.data.accountStatus !== "active") {
            throw new HttpError(403, "Tài khoản thư viện đang bị khóa hoặc chưa được kích hoạt.");
        }
        return { uid: claims.sub, email: claims.email, ...profile.data };
    } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 404) throw error;
    }

    const newProfile = {
        email: claims.email,
        displayName: claims.name || claims.email.split("@")[0],
        role: "student",
        accountStatus: "active",
        createdAt: { __timestamp: new Date().toISOString() }
    };
    try {
        await createDocument("users", claims.sub, newProfile, token, env);
    } catch (error) {
        // Another request may have created the profile concurrently.
        if (!(error instanceof HttpError) || error.status !== 409) throw error;
    }
    return { uid: claims.sub, ...newProfile };
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

async function createSubmission(request, claims, profile, token, env) {
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
        throw new HttpError(415, "Tạm thời chỉ nhận metadata JSON; upload tệp sẽ được bật lại khi cấu hình R2.");
    }
    const body = await request.json().catch(() => { throw new HttpError(400, "JSON không hợp lệ."); });
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const type = String(body.type || "").trim();
    const categoryId = String(body.categoryId || "").trim();
    const language = String(body.language || "vi").trim();
    if (title.length < 3 || title.length > 160) throw new HttpError(400, "Tiêu đề phải dài từ 3 đến 160 ký tự.");
    if (description.length > 3000) throw new HttpError(400, "Mô tả quá dài.");
    if (!["image", "pdf", "audio", "video"].includes(type)) throw new HttpError(400, "Loại tài liệu không hợp lệ.");
    if (categoryId.length > 80) throw new HttpError(400, "Mã danh mục quá dài.");
    if (!/^[a-zA-Z]{2,10}(-[a-zA-Z0-9]{2,8})*$/.test(language)) throw new HttpError(400, "Mã ngôn ngữ không hợp lệ.");
    const id = randomId();
    await createDocument("submissions", id, {
        title, description, type, categoryId, language,
        submittedBy: claims.sub,
        submittedByName: profile.displayName || claims.email,
        status: "pending",
        fileStatus: "awaiting_upload",
        submittedAt: { __timestamp: new Date().toISOString() }
    }, token, env);
    return json({ id, status: "pending", fileStatus: "awaiting_upload", message: "Đã nhận metadata. Tệp sẽ được bổ sung khi R2 được cấu hình." }, 201);
}

async function listPublished(url, token, env) {
    const filters = [{
        fieldFilter: {
            field: { fieldPath: "status" },
            op: "EQUAL",
            value: { stringValue: "published" }
        }
    }];
    const categoryId = url.searchParams.get("categoryId");
    if (categoryId) {
        filters.push({
            fieldFilter: {
                field: { fieldPath: "categoryId" },
                op: "EQUAL",
                value: { stringValue: categoryId }
            }
        });
    }
    const type = url.searchParams.get("type");
    if (type) {
        filters.push({
            fieldFilter: {
                field: { fieldPath: "type" },
                op: "EQUAL",
                value: { stringValue: type }
            }
        });
    }

    const where = filters.length === 1
        ? filters[0]
        : { compositeFilter: { op: "AND", filters } };

    const items = await runQuery("libraryItems", {
        where,
        limit: parseLimit(url.searchParams.get("limit"), 24)
    }, token || "", env);
    return json({ items });
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
    const publishedItem = {
        title: submission.data.title,
        description: submission.data.description || "",
        type: submission.data.type,
        categoryId: submission.data.categoryId || "",
        language: submission.data.language || "vi",
        submittedBy: submission.data.submittedBy,
        submittedByName: submission.data.submittedByName || "",
        approvedBy: claims.sub,
        status: "published",
        fileStatus: "awaiting_upload",
        publishedAt: { __timestamp: now }
    };

    await createDocument("libraryItems", libraryItemId, publishedItem, token, env);
    try {
        await patchDocument("submissions", id, {
            status: "approved",
            libraryItemId,
            reviewedBy: claims.sub,
            reviewedAt: { __timestamp: now }
        }, token, env);
    } catch (error) {
        // Avoid leaving a public item if the submission update failed.
        await fetch(firestoreBase(env) + "/libraryItems/" + libraryItemId, {
            method: "DELETE",
            headers: { authorization: "Bearer " + token }
        });
        throw error;
    }

    await createDocument("moderationLogs", randomId(), {
        action: "approve",
        submissionId: id,
        libraryItemId,
        actorUid: claims.sub,
        createdAt: { __timestamp: now }
    }, token, env);

    return json({ id, libraryItemId, status: "published" });
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
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
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
        return json({ ok: true, service: "a5-digital-library-api", version: 1 });
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
        return withHeaders(json({ error: "Xem/tải tệp tạm thời chưa khả dụng; chờ cấu hình R2." }, 503), cors);
    }

    const claims = await verifyFirebaseIdToken(request, env);
    const token = request.headers.get("authorization").replace(/^Bearer\s+/i, "");
    const profile = await getOrCreateProfile(claims, token, env);

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
