# A5 Digital Library API

Cloudflare Worker backend for the separate Firebase project `a5-digital-library`.

## Temporary backend mode (R2 not enabled yet)

This branch runs in **metadata-only mode** until R2 is available.

- Firebase Authentication verifies ID tokens with Google's Secure Token JWKS (RS256). The API requires `email_verified: true`.
- Firestore stores user profiles, submission metadata, published metadata and moderation logs.
- Submission requests accept JSON metadata only; file bytes are not uploaded or stored.
- Published library records are public to read. File viewing/downloading returns HTTP 503 until R2 is configured.

## Provisioning

1. Publish `features/digital-library/firestore.rules` to the `a5-digital-library` Firebase project.
2. Check `ALLOWED_ORIGINS` in `wrangler.toml`. Add production origins exactly; do not use `*`.
3. A newly verified account chooses Guest or Student after the first login. The Worker then creates a `viewer` profile with `audienceType: "guest" | "student"`. To provision an admin: create the account in Firebase Authentication, copy its UID, then create `users/{UID}` in Firestore Console with `email`, `displayName`, `role: "admin"`, `accountStatus: "active"` and `createdAt`. Assign `teacher` or `project_member` only through trusted Admin provisioning/Firestore Console. Never accept elevated roles from registration or browser requests.
4. Deploy from this directory:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
5. Check `GET /health` on the deployed Worker URL.

## API

Public:
- `GET /health`
- `GET /api/v1/library?limit=24&categoryId=...`
- `GET /api/v1/library/:id`
- `GET /api/v1/library/:id/file` — temporarily returns HTTP 503.

Authenticated (Bearer Firebase ID token; verified email required):
- `POST /api/v1/submissions` — JSON: `{"title":"...","description":"...","type":"pdf","categoryId":"...","language":"vi"}`. Creates a pending metadata-only submission.
- `GET /api/v1/me` — returns the authenticated user's profile, or `needsAudienceSelection: true` when Guest/Student has not yet been selected.
- `POST /api/v1/me/audience` — creates the first viewer profile from `{"audienceType":"guest"|"student"}`; the choice cannot be changed by the user afterwards.
- `POST /api/v1/library` — Project Member only; creates and immediately publishes a metadata-only library item.
- `GET /api/v1/my/submissions`

Teacher/admin:
- `GET /api/v1/admin/submissions?status=pending`
- `POST /api/v1/admin/submissions/:id/approve`
- `POST /api/v1/admin/submissions/:id/reject` — JSON body: `{"reason":"..."}`
- `POST /api/v1/admin/library/:id/archive`

## Security

- No R2 binding is required in this temporary mode.
- Firestore rules deny client writes to published items and moderation logs.
- New profiles are created only after an authenticated user chooses Guest or Student. Firestore Rules restrict self-created profiles to `role: "viewer"` and the `guest/student` audience allowlist.
- Admin, teacher and project_member roles are provisioned only through trusted administration/Firestore Console against the Firebase Authentication UID. The Worker reads and validates the stored role on every protected request; it never trusts a role from the browser.
- Project Members can create and publish metadata directly. Teacher/admin moderation endpoints remain separate. Role changes remain a trusted operation; there is no public role-management API.
- The Worker uses the caller's Firebase ID token for Firestore REST calls, so Firestore Security Rules remain active.
- Do not put service-account credentials or storage secrets in frontend code.
- This Worker has not been deployed or live-tested.

## Re-enabling R2

When R2 is ready, restore the bucket binding, upload implementation and file-serving handler. Existing temporary submissions are marked `fileStatus: "awaiting_upload"`.

## Account diagnostics in the website

After deploying the Worker, copy its exact `workers.dev` URL and set
`WORKER_API_BASE_URL` near the top of `features/digital-library/digital-library.js`.
The account panel then checks:

- Firebase Authentication session, verified email and UID.
- Worker `GET /health` availability.
- Authenticated `GET /api/v1/me` response.
- Firestore profile UID/email match, account status and trusted role.

The Worker rejects a profile when its stored Firestore email does not match the verified Firebase Authentication email. The browser displays the role returned by the Worker; it does not assign or promote roles itself. The health endpoint includes the configured CORS headers for the website origin.
