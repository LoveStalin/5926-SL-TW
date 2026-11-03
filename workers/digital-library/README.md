# A5 Digital Library API

Cloudflare Worker backend for the separate Firebase project \`a5-digital-library\`.

## Architecture

- Firebase Authentication verifies ID tokens with Google's Secure Token JWKS (RS256). The API requires \`email_verified: true\`.
- Firestore stores user profiles, submissions, published metadata and moderation logs.
- Cloudflare R2 stores private uploaded files. The Worker serves a file only after checking that its Firestore item is still \`published\`.

## Provisioning

1. In Cloudflare, create a **private** R2 bucket named \`a5-digital-library\`. CLI alternative:
   \`\`\`bash
   npx wrangler r2 bucket create a5-digital-library
   \`\`\`
2. Check \`ALLOWED_ORIGINS\` in \`wrangler.toml\`. Add the production Pages/custom domain as an exact origin (scheme + hostname), comma-separated. Do not use \`*\`.
3. Publish \`features/digital-library/firestore.rules\` to the \`a5-digital-library\` Firebase project.
4. A newly verified account gets a basic \`student\` profile the first time it calls a protected API. To grant staff access, open Firestore Console and update only the trusted person's \`users/{uid}\` document:
   - \`role\`: \`teacher\` or \`admin\`
   - \`accountStatus\`: \`active\`
   Never accept role values from the browser or a registration form.
5. Install Wrangler if needed, authenticate with Cloudflare, then deploy from this directory:
   \`\`\`bash
   npx wrangler login
   npx wrangler deploy
   \`\`\`
6. Check \`GET /health\` on the deployed Worker URL.

## API

Public:
- \`GET /health\`
- \`GET /api/v1/library?limit=24&categoryId=...\`
- \`GET /api/v1/library/:id\`
- \`GET /api/v1/library/:id/file\`

Authenticated (Bearer Firebase ID token; verified email required):
- \`POST /api/v1/submissions\` — multipart fields: \`title\`, \`description\`, \`type\`, \`categoryId\`, \`language\`, \`file\`
- \`GET /api/v1/my/submissions\`

Teacher/admin:
- \`GET /api/v1/admin/submissions?status=pending\`
- \`POST /api/v1/admin/submissions/:id/approve\`
- \`POST /api/v1/admin/submissions/:id/reject\` — JSON body: \`{"reason":"..."}\`
- \`POST /api/v1/admin/library/:id/archive\`

## Upload limits

- Images: 10 MiB (JPEG, PNG, WebP)
- PDF: 30 MiB
- Audio: 30 MiB (MPEG, MP4, WAV, OGG)
- Video: 90 MiB (MP4, WebM) to leave room for multipart overhead within the Worker request limit

## Security notes

- Keep the R2 bucket private; do not enable public bucket access.
- Never put R2 access keys or Firebase service-account credentials in frontend code.
- Firestore rules deny client writes to published items and moderation logs.
- Staff roles are assigned manually by a trusted operator, never by request payload.
- The Worker uses the caller's Firebase ID token for Firestore REST calls, so Firestore Security Rules remain active.
- This Worker has **not** been deployed or live-tested yet. Create the R2 bucket and publish the rules before production testing.
