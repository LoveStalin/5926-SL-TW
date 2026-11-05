var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var jwksCache = null;
var jwksExpiresAt = 0;
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}
__name(json, "json");
function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
__name(base64UrlToBytes, "base64UrlToBytes");
function decodeBase64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}
__name(decodeBase64UrlJson, "decodeBase64UrlJson");
async function getFirebaseJwks() {
  if (jwksCache && Date.now() < jwksExpiresAt) return jwksCache;
  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) throw new HttpError(503, "Kh\xF4ng th\u1EC3 t\u1EA3i kh\xF3a x\xE1c minh Firebase.");
  const data = await response.json();
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = data.keys || [];
  jwksExpiresAt = Date.now() + Math.max(60, maxAge) * 1e3;
  return jwksCache;
}
__name(getFirebaseJwks, "getFirebaseJwks");
async function verifyFirebaseIdToken(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Thi\u1EBFu Firebase ID token.");
  const token = match[1];
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Firebase ID token kh\xF4ng h\u1EE3p l\u1EC7.");
  let header;
  let claims;
  try {
    header = decodeBase64UrlJson(parts[0]);
    claims = decodeBase64UrlJson(parts[1]);
  } catch {
    throw new HttpError(401, "Kh\xF4ng th\u1EC3 \u0111\u1ECDc Firebase ID token.");
  }
  const projectId = env.FIREBASE_PROJECT_ID;
  const now = Math.floor(Date.now() / 1e3);
  if (header.alg !== "RS256" || !header.kid || claims.aud !== projectId || claims.iss !== "https://securetoken.google.com/" + projectId || typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 128 || !claims.exp || claims.exp <= now || claims.iat > now + 60 || !claims.auth_time || claims.auth_time > now + 60 || claims.email_verified !== true || typeof claims.email !== "string") {
    throw new HttpError(401, "Token h\u1EBFt h\u1EA1n, sai d\u1EF1 \xE1n ho\u1EB7c email ch\u01B0a x\xE1c minh.");
  }
  const jwks = await getFirebaseJwks();
  const jwk = jwks.find((key) => key.kid === header.kid);
  if (!jwk) {
    jwksCache = null;
    jwksExpiresAt = 0;
    throw new HttpError(401, "Kh\xF4ng t\xECm th\u1EA5y kh\xF3a x\xE1c minh token.");
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
  if (!valid) throw new HttpError(401, "Ch\u1EEF k\xFD Firebase ID token kh\xF4ng h\u1EE3p l\u1EC7.");
  return claims;
}
__name(verifyFirebaseIdToken, "verifyFirebaseIdToken");
function firestoreBase(env) {
  return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/databases/(default)/documents";
}
__name(firestoreBase, "firestoreBase");
function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
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
__name(encodeValue, "encodeValue");
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
__name(decodeValue, "decodeValue");
function encodeFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
  );
}
__name(encodeFields, "encodeFields");
function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
  );
}
__name(decodeFields, "decodeFields");
async function firestoreRequest(path, token, options = {}) {
  const response = await fetch(firestoreBase(options.env) + path, {
    method: options.method || "GET",
    headers: {
      ...token ? { authorization: "Bearer " + token } : {},
      ...options.body ? { "content-type": "application/json" } : {}
    },
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
  }
  if (!response.ok) {
    const message = data.error?.message || "Firestore request th\u1EA5t b\u1EA1i.";
    if (response.status === 404) throw new HttpError(404, message);
    if (response.status === 403) throw new HttpError(403, "Firestore Security Rules t\u1EEB ch\u1ED1i thao t\xE1c.");
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }
  return data;
}
__name(firestoreRequest, "firestoreRequest");
async function getDocument(collectionName, id, token, env) {
  const path = "/" + collectionName + "/" + encodeURIComponent(id);
  const document = await firestoreRequest(path, token, { env });
  return { id, data: decodeFields(document.fields), name: document.name };
}
__name(getDocument, "getDocument");
async function createDocument(collectionName, id, data, token, env) {
  const path = "/" + collectionName + "?documentId=" + encodeURIComponent(id);
  return firestoreRequest(path, token, {
    env,
    method: "POST",
    body: { fields: encodeFields(data) }
  });
}
__name(createDocument, "createDocument");
async function patchDocument(collectionName, id, data, token, env) {
  const params = Object.keys(data).map((key) => "updateMask.fieldPaths=" + encodeURIComponent(key)).join("&");
  return firestoreRequest(
    "/" + collectionName + "/" + encodeURIComponent(id) + "?" + params,
    token,
    { env, method: "PATCH", body: { fields: encodeFields(data) } }
  );
}
__name(patchDocument, "patchDocument");
async function runQuery(collectionName, structuredQuery, token, env) {
  const result = await firestoreRequest(
    ":runQuery",
    token,
    { env, method: "POST", body: { structuredQuery: { from: [{ collectionId: collectionName }], ...structuredQuery } } }
  );
  return (result || []).filter((row) => row.document).map((row) => ({
    id: row.document.name.split("/").pop(),
    ...decodeFields(row.document.fields)
  }));
}
__name(runQuery, "runQuery");
function normalizeProfile(uid, email, data) {
  const allowedRoles = ["viewer", "project_member", "teacher", "admin", "student"];
  if (!allowedRoles.includes(data.role)) {
    throw new HttpError(403, "T\xE0i kho\u1EA3n ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5p role h\u1EE3p l\u1EC7.");
  }
  if (typeof data.email !== "string" || data.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new HttpError(403, "Email trong Firestore kh\xF4ng kh\u1EDBp v\u1EDBi email Firebase Authentication.");
  }
  if (data.accountStatus !== "active") {
    throw new HttpError(403, "T\xE0i kho\u1EA3n th\u01B0 vi\u1EC7n \u0111ang b\u1ECB kh\xF3a ho\u1EB7c ch\u01B0a \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t.");
  }
  const legacyStudent = data.role === "student";
  const audienceType = data.audienceType || (legacyStudent ? "student" : null);
  if (data.role === "viewer" && !["guest", "student"].includes(audienceType)) {
    throw new HttpError(403, "H\u1ED3 s\u01A1 viewer thi\u1EBFu audienceType h\u1EE3p l\u1EC7.");
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
__name(normalizeProfile, "normalizeProfile");
async function getOrCreateProfile(claims, token, env) {
  try {
    const profile = await getDocument("users", claims.sub, token, env);
    return normalizeProfile(claims.sub, claims.email, profile.data);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
__name(getOrCreateProfile, "getOrCreateProfile");
async function createAudienceProfile(claims, token, env, audienceType) {
  if (!["guest", "student"].includes(audienceType)) {
    throw new HttpError(400, "L\u1EF1a ch\u1ECDn ph\u1EA3i l\xE0 guest ho\u1EB7c student.");
  }
  const profile = {
    email: claims.email,
    displayName: claims.name || claims.email.split("@")[0],
    audienceType,
    role: "viewer",
    accountStatus: "active",
    createdAt: { __timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  };
  await createDocument("users", claims.sub, profile, token, env);
  return normalizeProfile(claims.sub, claims.email, profile);
}
__name(createAudienceProfile, "createAudienceProfile");
function requireStaff(profile) {
  if (!["teacher", "admin"].includes(profile.role)) {
    throw new HttpError(403, "Ch\u1EE9c n\u0103ng n\xE0y ch\u1EC9 d\xE0nh cho gi\xE1o vi\xEAn ho\u1EB7c qu\u1EA3n tr\u1ECB vi\xEAn.");
  }
}
__name(requireStaff, "requireStaff");
function randomId() {
  return crypto.randomUUID().replace(/-/g, "");
}
__name(randomId, "randomId");
function parseLimit(value, fallback = 20) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(50, Math.max(1, number)) : fallback;
}
__name(parseLimit, "parseLimit");
var CONTENT_TYPES = ["ebook", "article", "video", "podcast", "postcard", "artwork", "design", "digital_product", "document", "audio"];
var LEGACY_TYPE_BY_CONTENT = { ebook: "pdf", article: "pdf", video: "video", podcast: "audio", postcard: "image", artwork: "image", design: "image", digital_product: "document", document: "pdf", audio: "audio" };
function normalizeStringArray(value, maxItems, maxLength) {
  if (value === void 0) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new HttpError(400, "Danh s\xE1ch d\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7.");
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, maxItems).map((item) => item.slice(0, maxLength));
}
__name(normalizeStringArray, "normalizeStringArray");
function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
__name(normalizeSlug, "normalizeSlug");
function normalizeMetadata(value) {
  if (value === void 0) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "metadata ph\u1EA3i l\xE0 object.");
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
    if (!safeKey) continue;
    if (["string", "number", "boolean"].includes(typeof item) || item === null) result[safeKey] = item;
  }
  return result;
}
__name(normalizeMetadata, "normalizeMetadata");
function normalizeReader(value) {
  if (value === void 0) return { enabled: false, defaultFormat: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "reader ph\u1EA3i l\xE0 object.");
  return { enabled: value.enabled === true, defaultFormat: value.defaultFormat ? String(value.defaultFormat).slice(0, 20) : null };
}
__name(normalizeReader, "normalizeReader");
function normalizeContentInput(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const contentType = String(body.contentType || body.type || "").trim();
  const categoryId = String(body.categoryId || "").trim();
  const language = String(body.language || "vi").trim();
  if (title.length < 3 || title.length > 160) throw new HttpError(400, "Ti\xEAu \u0111\u1EC1 ph\u1EA3i d\xE0i t\u1EEB 3 \u0111\u1EBFn 160 k\xFD t\u1EF1.");
  if (description.length > 3e3) throw new HttpError(400, "M\xF4 t\u1EA3 qu\xE1 d\xE0i.");
  if (!CONTENT_TYPES.includes(contentType)) throw new HttpError(400, "contentType kh\xF4ng h\u1EE3p l\u1EC7.");
  if (categoryId.length > 80) throw new HttpError(400, "M\xE3 danh m\u1EE5c qu\xE1 d\xE0i.");
  if (!/^[a-zA-Z]{2,10}(-[a-zA-Z0-9]{2,8})*$/.test(language)) throw new HttpError(400, "M\xE3 ng\xF4n ng\u1EEF kh\xF4ng h\u1EE3p l\u1EC7.");
  const authors = normalizeStringArray(body.authors, 20, 160);
  return { title, slug: normalizeSlug(body.slug || title), description, contentType, legacyType: LEGACY_TYPE_BY_CONTENT[contentType], categoryId, language, authors, tags: normalizeStringArray(body.tags, 30, 50), authorNamesNormalized: authors.map((name) => name.toLowerCase()), metadata: normalizeMetadata(body.metadata), reader: normalizeReader(body.reader) };
}
__name(normalizeContentInput, "normalizeContentInput");
function normalizeQrCode(value, itemId) {
  const enabled = value === void 0 ? true : value?.enabled === true;
  return { enabled, targetPath: enabled ? "/library/" + itemId : null };
}
__name(normalizeQrCode, "normalizeQrCode");
async function createLibraryItem(request, claims, profile, token, env) {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) throw new HttpError(415, "T\u1EA1m th\u1EDDi ch\u1EC9 nh\u1EADn metadata JSON; file upload s\u1EBD \u0111\u01B0\u1EE3c n\u1ED1i v\xE0o Storage Layer sau.");
  const body = await request.json().catch(() => {
    throw new HttpError(400, "JSON kh\xF4ng h\u1EE3p l\u1EC7.");
  });
  const content = normalizeContentInput(body);
  const id = randomId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const qrCode = normalizeQrCode(body.qrCode, id);
  await createDocument("libraryItems", id, { schemaVersion: 2, title: content.title, slug: content.slug, description: content.description, contentType: content.contentType, type: content.legacyType, authors: content.authors, authorNamesNormalized: content.authorNamesNormalized, categoryId: content.categoryId, tags: content.tags, language: content.language, metadata: content.metadata, reader: content.reader, qrCode, submittedBy: claims.sub, submittedByName: profile.displayName || claims.email, publishedBy: claims.sub, status: "published", fileStatus: "awaiting_upload", createdBy: claims.sub, createdAt: { __timestamp: now }, updatedAt: { __timestamp: now }, publishedAt: { __timestamp: now } }, token, env);
  return json({ id, status: "published", fileStatus: "awaiting_upload", contentType: content.contentType, qrCode, message: "\u0110\xE3 t\u1EA1o metadata. File s\u1EBD \u0111\u01B0\u1EE3c g\u1EAFn qua Storage Layer." }, 201);
}
__name(createLibraryItem, "createLibraryItem");
async function createSubmission(request, claims, profile, token, env) {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) throw new HttpError(415, "T\u1EA1m th\u1EDDi ch\u1EC9 nh\u1EADn metadata JSON; file upload s\u1EBD \u0111\u01B0\u1EE3c n\u1ED1i v\xE0o Storage Layer sau.");
  const body = await request.json().catch(() => {
    throw new HttpError(400, "JSON kh\xF4ng h\u1EE3p l\u1EC7.");
  });
  const content = normalizeContentInput(body);
  const id = randomId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await createDocument("submissions", id, { schemaVersion: 2, title: content.title, slug: content.slug, description: content.description, contentType: content.contentType, type: content.legacyType, authors: content.authors, authorNamesNormalized: content.authorNamesNormalized, categoryId: content.categoryId, tags: content.tags, language: content.language, metadata: content.metadata, reader: content.reader, status: "pending", fileStatus: "awaiting_upload", submittedBy: claims.sub, submittedByName: profile.displayName || claims.email, submittedAt: { __timestamp: now } }, token, env);
  return json({ id, status: "pending", fileStatus: "awaiting_upload", contentType: content.contentType, message: "\u0110\xE3 nh\u1EADn metadata. File s\u1EBD \u0111\u01B0\u1EE3c g\u1EAFn sau khi Storage Layer s\u1EB5n s\xE0ng." }, 201);
}
__name(createSubmission, "createSubmission");
async function listSubcollection(parentPath, collectionName, token, env, pageSize = 100) {
  const path = "/" + parentPath + "/" + collectionName + "?pageSize=" + pageSize;
  const result = await firestoreRequest(path, token, { env });
  return (result.documents || []).map((document) => ({
    id: document.name.split("/").pop(),
    ...decodeFields(document.fields)
  }));
}
__name(listSubcollection, "listSubcollection");
function requireStorage(env) {
  if (!env.DIGITAL_LIBRARY_BUCKET) {
    throw new HttpError(503, "Storage ch\u01B0a \u0111\u01B0\u1EE3c bind. H\xE3y ch\u1EA1y Worker b\u1EB1ng wrangler.dev.toml \u0111\u1EC3 d\xF9ng DEV storage.");
  }
  return env.DIGITAL_LIBRARY_BUCKET;
}
__name(requireStorage, "requireStorage");
function buildStorageKey(itemId, assetId, format) {
  return "library/" + itemId + "/" + assetId + "." + format;
}
__name(buildStorageKey, "buildStorageKey");
async function uploadLibraryAsset(request, itemId, claims, profile, token, env) {
  if (!["project_member", "teacher", "admin"].includes(profile.role)) {
    throw new HttpError(403, "Ch\u1EC9 Project Member, gi\xE1o vi\xEAn ho\u1EB7c admin m\u1EDBi \u0111\u01B0\u1EE3c upload file.");
  }
  const item = await getDocument("libraryItems", itemId, token, env);
  if (!["published", "archived"].includes(item.data.status)) {
    throw new HttpError(404, "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u h\u1EE3p l\u1EC7.");
  }
  const bucket = requireStorage(env);
  const maxBytes = Number(env.DIGITAL_LIBRARY_MAX_UPLOAD_BYTES || 100 * 1024 * 1024);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentLength) {
    throw new HttpError(411, "Upload file ph\u1EA3i c\xF3 Content-Length.");
  }
  if (contentLength > maxBytes) {
    throw new HttpError(413, "File v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n upload hi\u1EC7n t\u1EA1i.");
  }
  if (!request.body) {
    throw new HttpError(400, "Thi\u1EBFu request body.");
  }
  const url = new URL(request.url);
  const assetType = String(url.searchParams.get("assetType") || "original").trim();
  const format = String(url.searchParams.get("format") || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
  const fileName = String(request.headers.get("x-file-name") || "").trim().slice(0, 200);
  if (!["cover", "original", "preview", "thumbnail", "attachment"].includes(assetType)) {
    throw new HttpError(400, "assetType kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  if (!format) {
    throw new HttpError(400, "Thi\u1EBFu format, v\xED d\u1EE5 pdf ho\u1EB7c mp4.");
  }
  const assetId = randomId();
  const storageKey = buildStorageKey(itemId, assetId, format);
  const storageProvider = env.DIGITAL_LIBRARY_STORAGE_PROVIDER || "dev";
  const mimeType = request.headers.get("content-type") || "application/octet-stream";
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
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    await bucket.delete(storageKey);
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
__name(uploadLibraryAsset, "uploadLibraryAsset");
async function getPrimaryLibraryAsset(itemId, token, env) {
  const assets = await listSubcollection("libraryItems/" + itemId, "assets", token, env);
  return assets.find((asset) => asset.isPrimary === true) || assets.find((asset) => asset.assetType === "original") || assets[0] || null;
}
__name(getPrimaryLibraryAsset, "getPrimaryLibraryAsset");
async function serveLibraryAsset(request, itemId, token, env) {
  const item = await getDocument("libraryItems", itemId, token || "", env);
  if (item.data.status !== "published") {
    throw new HttpError(404, "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u \u0111\xE3 xu\u1EA5t b\u1EA3n.");
  }
  const asset = await getPrimaryLibraryAsset(itemId, token || "", env);
  if (!asset || !asset.storageKey) {
    throw new HttpError(404, "T\xE0i li\u1EC7u ch\u01B0a c\xF3 file.");
  }
  const bucket = requireStorage(env);
  const object = await bucket.get(asset.storageKey, {
    onlyIf: request.headers,
    range: request.headers
  });
  if (!object) throw new HttpError(404, "File kh\xF4ng t\u1ED3n t\u1EA1i trong Storage.");
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
__name(serveLibraryAsset, "serveLibraryAsset");
async function createAssetMetadata(request, itemId, claims, profile, token, env) {
  const item = await getDocument("libraryItems", itemId, token, env);
  const canWrite = ["project_member", "teacher", "admin"].includes(profile.role) || item.data.submittedBy === claims.sub;
  if (!canWrite) throw new HttpError(403, "Kh\xF4ng c\xF3 quy\u1EC1n g\u1EAFn asset cho t\xE0i li\u1EC7u n\xE0y.");
  const body = await request.json().catch(() => {
    throw new HttpError(400, "JSON kh\xF4ng h\u1EE3p l\u1EC7.");
  });
  const assetType = String(body.assetType || "").trim();
  const format = String(body.format || "").trim().toLowerCase();
  const storageProvider = String(body.storageProvider || "dev").trim();
  const storageKey = String(body.storageKey || "").trim();
  if (!["cover", "original", "preview", "thumbnail", "attachment"].includes(assetType)) throw new HttpError(400, "assetType kh\xF4ng h\u1EE3p l\u1EC7.");
  if (!/^[a-z0-9.+-]{1,30}$/.test(format)) throw new HttpError(400, "format kh\xF4ng h\u1EE3p l\u1EC7.");
  if (!["dev", "r2"].includes(storageProvider)) throw new HttpError(400, "storageProvider ph\u1EA3i l\xE0 dev ho\u1EB7c r2.");
  if (storageKey.length > 500) throw new HttpError(400, "storageKey qu\xE1 d\xE0i.");
  if (storageProvider === "r2" && !storageKey) throw new HttpError(400, "R2 asset ph\u1EA3i c\xF3 storageKey.");
  const assetId = randomId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await createDocument("libraryItems/" + itemId + "/assets", assetId, { assetType, format, storageProvider, storageKey: storageKey || null, mimeType: String(body.mimeType || "").slice(0, 120), sizeBytes: Number.isSafeInteger(body.sizeBytes) && body.sizeBytes >= 0 ? body.sizeBytes : 0, checksum: String(body.checksum || "").slice(0, 128), isPrimary: body.isPrimary === true, access: body.access === "private" ? "private" : "public", createdAt: { __timestamp: now }, createdBy: claims.sub }, token, env);
  return json({ id: assetId, itemId, storageProvider, message: storageProvider === "dev" ? "\u0110\xE3 l\u01B0u metadata asset \u1EDF ch\u1EBF \u0111\u1ED9 DEV; file bytes ch\u01B0a \u0111\u01B0\u1EE3c l\u01B0u." : "\u0110\xE3 l\u01B0u metadata asset cho R2." }, 201);
}
__name(createAssetMetadata, "createAssetMetadata");
async function listPublished(url, token, env) {
  const items = await runQuery("libraryItems", { where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } }, limit: parseLimit(url.searchParams.get("limit"), 50) }, token || "", env);
  const categoryId = url.searchParams.get("categoryId");
  const contentType = url.searchParams.get("contentType") || url.searchParams.get("type");
  const tag = url.searchParams.get("tag");
  const filtered = items.filter((item) => (!categoryId || item.categoryId === categoryId) && (!contentType || item.contentType === contentType || !item.contentType && item.type === contentType || contentType === "ebook" && item.type === "pdf" || contentType === "podcast" && item.type === "audio" || contentType === "postcard" && item.type === "image") && (!tag || Array.isArray(item.tags) && item.tags.includes(tag)));
  return json({ items: filtered });
}
__name(listPublished, "listPublished");
async function getPublishedItem(id, token, env) {
  const item = await getDocument("libraryItems", id, token || "", env);
  if (item.data.status !== "published") throw new HttpError(404, "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u \u0111\xE3 xu\u1EA5t b\u1EA3n.");
  return item;
}
__name(getPublishedItem, "getPublishedItem");
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
__name(listMySubmissions, "listMySubmissions");
async function listPendingSubmissions(token, env, url) {
  const status = url.searchParams.get("status") || "pending";
  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new HttpError(400, "Tr\u1EA1ng th\xE1i l\u1ECDc kh\xF4ng h\u1EE3p l\u1EC7.");
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
__name(listPendingSubmissions, "listPendingSubmissions");
async function approveSubmission(id, claims, token, env) {
  const submission = await getDocument("submissions", id, token, env);
  if (submission.data.status !== "pending") throw new HttpError(409, "B\xE0i g\u1EEDi kh\xF4ng c\xF2n \u1EDF tr\u1EA1ng th\xE1i ch\u1EDD duy\u1EC7t.");
  const libraryItemId = randomId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
__name(approveSubmission, "approveSubmission");
async function rejectSubmission(id, request, claims, token, env) {
  const submission = await getDocument("submissions", id, token, env);
  if (submission.data.status !== "pending") throw new HttpError(409, "B\xE0i g\u1EEDi kh\xF4ng c\xF2n \u1EDF tr\u1EA1ng th\xE1i ch\u1EDD duy\u1EC7t.");
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim().slice(0, 1e3);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
__name(rejectSubmission, "rejectSubmission");
async function archiveLibraryItem(id, claims, token, env) {
  const item = await getDocument("libraryItems", id, token, env);
  if (item.data.status !== "published") throw new HttpError(409, "T\xE0i li\u1EC7u kh\xF4ng \u1EDF tr\u1EA1ng th\xE1i \u0111\xE3 xu\u1EA5t b\u1EA3n.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
__name(archiveLibraryItem, "archiveLibraryItem");
function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) {
    throw new HttpError(403, "Origin kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p truy c\u1EADp API.");
  }
  const headers = {
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
__name(corsHeaders, "corsHeaders");
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
    return listPublished(url, null, env).then((response) => withHeaders(response, cors));
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
    return withHeaders(json(profile ? { user: profile } : { user: null, needsAudienceSelection: true }), cors);
  }
  if (method === "POST" && path === "/api/v1/me/audience") {
    if (profile) throw new HttpError(409, "H\u1ED3 s\u01A1 \u0111\xE3 \u0111\u01B0\u1EE3c thi\u1EBFt l\u1EADp; kh\xF4ng th\u1EC3 t\u1EF1 \u0111\u1ED5i nh\xF3m ng\u01B0\u1EDDi d\xF9ng.");
    const body = await request.json().catch(() => {
      throw new HttpError(400, "JSON kh\xF4ng h\u1EE3p l\u1EC7.");
    });
    const created = await createAudienceProfile(claims, token, env, body.audienceType);
    return withHeaders(json({ user: created }, 201), cors);
  }
  if (!profile) throw new HttpError(409, "H\xE3y ch\u1ECDn Guest ho\u1EB7c Student \u0111\u1EC3 ho\xE0n t\u1EA5t h\u1ED3 s\u01A1.");
  if (method === "POST" && path === "/api/v1/library") {
    if (!["project_member", "teacher", "admin"].includes(profile.role)) {
      throw new HttpError(403, "Ch\u1EC9 Project Member, gi\xE1o vi\xEAn ho\u1EB7c admin m\u1EDBi \u0111\u01B0\u1EE3c th\xEAm t\xE0i li\u1EC7u.");
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
  throw new HttpError(404, "Kh\xF4ng t\xECm th\u1EA5y API endpoint.");
}
__name(handle, "handle");
function withHeaders(response, headers) {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}
__name(withHeaders, "withHeaders");
var src_default = {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (!(error instanceof HttpError)) console.error("Digital Library Worker error:", error);
      let headers = {};
      try {
        headers = corsHeaders(request, env);
      } catch {
      }
      return json({
        error: error instanceof HttpError ? error.message : "L\u1ED7i m\xE1y ch\u1EE7 n\u1ED9i b\u1ED9."
      }, status, headers);
    }
  }
};

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-PcNRn7/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-PcNRn7/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
