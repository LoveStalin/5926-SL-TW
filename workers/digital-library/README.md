# A5 Digital Library API

Cloudflare Worker backend for the separate Firebase project \`a5-digital-library\`.

## Components

- Firebase Authentication: verifies Firebase ID tokens (RS256, Google Secure Token JWKS), including \`email_verified\`.
- Firestore: stores profiles, submissions, published library metadata and moderation logs.
- Cloudflare R2: stores private uploaded files. Public file access is proxied through the Worker and allowed only for published Firestore records.

## Required setup

1. Create a private Cloudflare R2 bucket named \`a5-digital-library\`.
2. Check \`ALLOWED_ORIGINS\` in \`wrangler.toml\`; add the final Pages/custom domain as an exact origin, comma-separated.
3. Deploy Firestore rules from \`firestore.rules\` to the \`a5-digital-library\` Firebase project.
4. Create a user profile by signing in once; the API provisions a basic \`student\` profile. Assign \`teacher\` or \`admin\` manually in Firestore Console to trusted staff only.
5. From this directory, run \`npx wrangler deploy\`.

## Endpoints

- \`GET /health\`
- \`GET /api/v1/library?limit=24&categoryId=...\`
- \`GET /api/v1/library/:id/file\`
- \`POST /api/v1/submissions\` (multipart: title, description, type, categoryId, language, file)
- \`GET /api/v1/my/submissions\`
- \`GET /api/v1/admin/submissions?status=pending\`
- \`POST /api/v1/admin/submissions/:id/approve\`
- \`POST /api/v1/admin/submissions/:id/reject\` (JSON: reason)
- \`POST /api/v1/admin/library/:id/archive\`

Protected endpoints require \`Authorization: Bearer <Firebase ID token>\`. The API rejects unverified email accounts.

## File limits

- Images: 10 MiB (JPEG, PNG, WebP)
- PDF: 30 MiB
- Audio: 30 MiB (MPEG, MP4, WAV, OGG)
- Video: 100 MiB (MP4, WebM)

## Security notes

- R2 bucket stays private; do not enable public bucket access.
- Never put R2 access keys or Firebase service-account credentials in frontend code.
- Firestore rules deny client writes to published items and moderation logs.
- Staff roles are never accepted from request payloads.
- This Worker has not been deployed. Configure the R2 bucket and deploy Firestore rules before production testing.
