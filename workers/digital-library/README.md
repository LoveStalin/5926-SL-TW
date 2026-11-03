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
3. A newly verified account gets a basic `student` profile on its first protected API call. Assign trusted staff roles manually in Firestore Console by setting `role` to `teacher` or `admin` and `accountStatus` to `active`.
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
- `GET /api/v1/my/submissions`

Teacher/admin:
- `GET /api/v1/admin/submissions?status=pending`
- `POST /api/v1/admin/submissions/:id/approve`
- `POST /api/v1/admin/submissions/:id/reject` — JSON body: `{"reason":"..."}`
- `POST /api/v1/admin/library/:id/archive`

## Security

- No R2 binding is required in this temporary mode.
- Firestore rules deny client writes to published items and moderation logs.
- Staff roles are assigned manually, never from browser input.
- The Worker uses the caller's Firebase ID token for Firestore REST calls, so Firestore Security Rules remain active.
- Do not put service-account credentials or storage secrets in frontend code.
- This Worker has not been deployed or live-tested.

## Re-enabling R2

When R2 is ready, restore the bucket binding, upload implementation and file-serving handler. Existing temporary submissions are marked `fileStatus: "awaiting_upload"`.
