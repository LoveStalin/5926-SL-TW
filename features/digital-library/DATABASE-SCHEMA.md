# A5 Digital Library — Database Schema v2

## Canonical collections
- `users/{uid}` — Firebase Auth profile, audience and trusted RBAC role.
- `libraryItems/{itemId}` — one metadata document for every digital work.
- `libraryItems/{itemId}/assets/{assetId}` — file metadata only; file bytes never live in Firestore.
- `categories/{categoryId}`, `submissions/{submissionId}`, `bookReviews/{reviewId}`, `moderationLogs/{logId}`, `siteConfig/{configId}`.

## Content types
`ebook`, `article`, `video`, `podcast`, `postcard`, `artwork`, `design`, `digital_product`, `document`, `audio`.
New code uses `contentType`. Legacy `type` remains temporarily for compatibility.

## libraryItems
schemaVersion, title, slug, description, contentType, type (legacy), authors[], authorNamesNormalized[], categoryId, tags[], language, metadata{}, reader{}, qrCode{}, status, fileStatus, createdBy, createdAt, updatedAt, publishedAt.

`metadata` is type-specific: ebook ISBN/publisher/pageCount; video duration/aspect ratio; podcast duration/episode; postcard dimensions/theme; artwork/design medium/dimensions/software; digital_product version/format/license.

## Assets
`assetType`, `format`, `storageProvider`, `storageKey`, `mimeType`, `sizeBytes`, `checksum`, `isPrimary`, `access`, `createdAt`, `createdBy`.
`storageProvider=dev` is metadata-only for now. It does not pretend to store file bytes.

## QR
Canonical public target: `https://a5-k68-website.pages.dev/library/{itemId}`. QR points to the item/reader page, never directly to a PDF/MP4 URL.

## Storage
Firestore stores metadata/references. Large files belong in object storage. R2 is the production provider once available; the schema does not depend on R2 being configured today.

## 4.5.2
The school requirement of at least 30 products is a content/curation requirement, not a Firestore document limit. Products can be video, podcast, postcard or other supported digital works.

## Migration
Existing published documents using only legacy `type=image|pdf|audio|video` remain readable. New API writes use schemaVersion=2 and contentType. Old submissions are mapped to the closest canonical content type when approved.