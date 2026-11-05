# Digital Library — DEV Storage

This Worker uses a local R2 simulation during development. Cloudflare documents that Wrangler's default local R2 bindings store objects on the developer machine under the project's `.wrangler/state` directory and do not touch production R2. citeturn241931search1turn241931search3

## Start

```bash
cd workers/digital-library
npx wrangler dev --config wrangler.dev.toml
```

The local API is normally available at `http://localhost:8787`.

## Upload

Authenticated Project Member/Teacher/Admin:

```bash
curl -X POST "http://localhost:8787/api/v1/library/ITEM_ID/upload" \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -F "file=@/path/to/book.pdf" \
  -F "assetType=original" \
  -F "isPrimary=true"
```

For a video:

```bash
curl -X POST "http://localhost:8787/api/v1/library/ITEM_ID/upload" \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -F "file=@/path/to/video.mp4" \
  -F "assetType=original" \
  -F "isPrimary=true"
```

Then open:

```
http://localhost:8787/api/v1/library/ITEM_ID/file
```

The same API shape will be used with real R2 later; only the storage binding/provider changes. R2 also supports ranged reads, which is important for browser video playback and large-file delivery. citeturn325516search0turn325516search3

## Important

- DEV storage is local only.
- Do not run `wrangler dev --remote` with a real R2 binding unless you intentionally want to touch remote data.
- Do not commit `.wrangler/state`; it can contain the local object data.
