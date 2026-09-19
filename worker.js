const ALLOWED_ORIGINS = new Set([
  "https://a5-k68-website.pages.dev",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

const FIREBASE_API_KEY = "AIzaSyASwLRIHvF9qZQx8GRsC63kadfZIskKfOc";
const FIREBASE_PROJECT_ID = "a5-k68";
const FIREBASE_DATABASE_URL =
  "https://a5-k68-default-rtdb.asia-southeast1.firebasedatabase.app";

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://a5-k68-website.pages.dev";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    Vary: "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

function base64UrlEncode(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function stringToBase64Url(value) {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function getRequiredEnv(env, name) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} trong Worker.`);
  }

  return value;
}

async function createGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64Url(JSON.stringify({
    alg: "RS256",
    typ: "JWT"
  }));
  const claim = stringToBase64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    // Realtime Database REST yêu cầu cả hai scope này khi xác thực bằng
    // service account. Thiếu `userinfo.email` sẽ khiến access token bị 401.
    scope: [
      "https://www.googleapis.com/auth/firebase.database",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/firebase.messaging"
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${claim}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key.replace(/\\n/g, "\n")),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth HTTP ${response.status}: ${data.error_description || data.error || "không tạo được access token"}`);
  }

  return data.access_token;
}

async function verifyFirebaseUser(apiKey, idToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await response.json();

  if (!response.ok || !data.users?.length) {
    throw new Error(
      `FIREBASE_AUTH HTTP ${response.status}: ${data.error?.message || "token không hợp lệ"}`
    );
  }

  return data.users[0];
}

async function firebaseRequest(databaseUrl, path, accessToken, options = {}) {
  const url = new URL(
    `${databaseUrl.replace(/\/+$/, "")}/${path}.json`
  );
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `REALTIME_DATABASE ${options.method || "GET"} ${path}: HTTP ${response.status} - ${text || "empty response"}`
    );
  }

  return text ? JSON.parse(text) : null;
}

async function sendFcmMessage(projectId, token, title, message, accessToken) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body: message },
          data: {
            url: "https://a5-k68-website.pages.dev/notifications.html"
          },
          webpush: {
            fcmOptions: {
              link: "https://a5-k68-website.pages.dev/notifications.html"
            }
          }
        }
      })
    }
  );

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? null : responseText
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method === "GET") {
      return json({ success: true, service: "A5-K68 FCM API" }, 200, origin);
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method không được hỗ trợ." }, 405, origin);
    }

    try {
      const authorization = request.headers.get("Authorization") || "";

      if (!authorization.startsWith("Bearer ")) {
        return json({ success: false, error: "Thiếu Firebase ID token." }, 401, origin);
      }

      const idToken = authorization.slice("Bearer ".length).trim();
      const apiKey = env.FIREBASE_API_KEY?.trim() || FIREBASE_API_KEY;
      const projectId = env.FIREBASE_PROJECT_ID?.trim() || FIREBASE_PROJECT_ID;
      const databaseUrl = env.FIREBASE_DATABASE_URL?.trim() || FIREBASE_DATABASE_URL;
      const rawServiceAccount = getRequiredEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON");
      const serviceAccount = JSON.parse(rawServiceAccount);

      if (
        serviceAccount.project_id !== projectId ||
        !serviceAccount.client_email ||
        !serviceAccount.private_key
      ) {
        throw new Error("Service account không khớp project hoặc thiếu client_email/private_key.");
      }

      const firebaseUser = await verifyFirebaseUser(apiKey, idToken);
      const accessToken = await createGoogleAccessToken(serviceAccount);
      // Đọc/ghi toàn bộ nhánh `users` và tạo notification bằng quyền service
      // account. Firebase ID token của admin trên web vẫn bị Realtime Database
      // Rules giới hạn, nên request này từng trả về HTTP 401.
      const users = await firebaseRequest(databaseUrl, "users", accessToken);
      const ownProfile = users?.[firebaseUser.localId];

      if (ownProfile?.active !== true || ownProfile?.role !== "admin") {
        return json({ success: false, error: "Tài khoản không có quyền gửi thông báo." }, 403, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ success: false, error: "Body request không phải JSON hợp lệ." }, 400, origin);
      }

      const title = String(body.title || "").trim();
      const message = String(body.message || "").trim();
      const pinned = body.pinned === true;

      if (!title || !message) {
        return json({ success: false, error: "Thiếu tiêu đề hoặc nội dung." }, 400, origin);
      }

      if (title.length > 120 || message.length > 2000) {
        return json({ success: false, error: "Tiêu đề tối đa 120 và nội dung tối đa 2000 ký tự." }, 400, origin);
      }

      const notificationId = crypto.randomUUID();
      await firebaseRequest(databaseUrl, `notifications/${notificationId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          title,
          message,
          type: "Chung",
          pinned,
          createdAt: Date.now(),
          createdBy: firebaseUser.localId
        })
      });

      let totalTokens = 0;
      let sent = 0;
      let failed = 0;
      const fcmErrors = [];

      for (const profile of Object.values(users || {})) {
        for (const tokenData of Object.values(profile?.fcmTokens || {})) {
          const token = tokenData?.token;
          if (!token) continue;

          totalTokens += 1;
          const fcmResult = await sendFcmMessage(
            projectId,
            token,
            title,
            message,
            accessToken
          );

          if (fcmResult.ok) {
            sent += 1;
          } else {
            failed += 1;
            if (fcmErrors.length < 5) {
              fcmErrors.push({
                status: fcmResult.status,
                error: fcmResult.error
              });
            }
          }
        }
      }

      return json(
        {
          success: true,
          notificationId,
          totalTokens,
          sent,
          failed,
          fcmErrors
        },
        200,
        origin
      );
    } catch (error) {
      console.error(
        "FCM Worker error:",
        error instanceof Error ? error.stack || error.message : String(error)
      );
      return json({ success: false, error: error.message || "Worker gặp lỗi." }, 500, origin);
    }
  }
};
