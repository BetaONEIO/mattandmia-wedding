# Guest photos and videos

The dedicated `/photos` page has the private upload form. Both guest pages link
to it. `/photos` opens without an invitation password for all guests. Anyone with the link can send files; stored files remain private.
Guests can select multiple files and optionally add their name. No password or upload code is required.
Files upload sequentially with progress; retrying a failed batch skips files already
confirmed as saved. Originals are stored without conversion. There is no public
listing, gallery, or download endpoint.

## Enable on Cloudflare Pages

1. Create a private R2 bucket, for example `mattandmia-guest-uploads`, in the existing
   Cloudflare account. Keep the public development URL and custom-domain access off.
2. In the Pages project's Settings → Bindings, add an R2 bucket binding named
   `WEDDING_UPLOADS` pointing to that bucket.
3. Configure Production. If enabling Preview too, use a separate test bucket.
4. Deploy the code, or redeploy after changing bindings. Pushing to `main`
   automatically deploys this repository.
5. Test a photo and short video on the deployed site and confirm both objects
   exist in the private bucket.

Production uses `mattandmia-guest-uploads` through the `WEDDING_UPLOADS` binding.
Public bucket access is disabled and no custom bucket domains are configured.
Preview uploads remain disabled. The former `UPLOAD_CODE` secret is not used.
Without the R2 binding, the form disables uploading. Remove the binding and
redeploy to close submissions.

## Retrieve the files

Open the R2 bucket in the Cloudflare dashboard to view and download objects. Files
are grouped by upload date; a random ID prevents repeated filenames from replacing
one another. Object custom metadata records `originalName` and `guestName`.
For bulk downloads, use an R2-compatible S3 client with a bucket-scoped read token.
Keep originals until you have a verified backup; no automatic deletion is configured.

## Limits and behaviour

- Maximum 90 MiB per file (labelled 90 MB in the form), below Cloudflare's 100 MB
  request cap on Free/Pro accounts. Longer videos need trimming into smaller clips.
- JPEG, PNG, GIF, WebP, HEIC/HEIF, AVIF, MP4, MOV, M4V, WebM and 3GP are accepted.
  Validation uses the extension; files are private attachments, not rendered by
  the website. This is not content scanning.
- The server streams the request body directly to R2 without buffering videos.
- The upload endpoint is open to anyone with the link. Same-origin checks and
  file limits still apply. R2 usage is billed to the hosting account.
- Keep the page open and phone awake while sending files. Interrupted files can
  be retried; there is no cross-refresh resume. A connection lost after storage
  completes can result in a duplicate on retry.
- A plain static Python server cannot execute Pages Functions. Test locally with
  Wrangler Pages dev and a local R2 binding, or use a configured Pages preview.

## Verification

Run `node --test tests/upload.test.mjs`. These tests cover configuration, access
checks, invalid inputs, streamed storage, unique names and storage failures using
an R2 stub. They do not replace the deployed real-bucket smoke test above.

References:
- https://developers.cloudflare.com/pages/functions/bindings/#r2-buckets
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/workers/platform/limits/#request-limits
