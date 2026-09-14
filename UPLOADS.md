# Guest photos and videos

The dedicated `/photos` page has the private upload form. Both guest pages link
to it. `/photos` opens without an invitation password for all guests. Sending
files still requires the shared upload code; stored files remain private.
Guests can select multiple files, add their name, and enter a shared upload code.
Files upload sequentially with progress; retrying a failed batch skips files already
confirmed as saved. Originals are stored without conversion. There is no public
listing, gallery, or download endpoint.

## Enable on Cloudflare Pages

1. Create a private R2 bucket, for example `mattandmia-guest-uploads`, in the existing
   Cloudflare account. Keep the public development URL and custom-domain access off.
2. In the Pages project's Settings → Bindings, add an R2 bucket binding named
   `WEDDING_UPLOADS` pointing to that bucket.
3. In Settings → Variables and Secrets, add a secret named `UPLOAD_CODE` with a
   memorable, unique code (at most 128 characters). Share it with attendees. This
   code is case-sensitive and separate from the existing site passwords. Do not
   put it in source control or client-side JavaScript.
4. Configure Production. If enabling Preview too, use a separate test bucket and
   code so previews cannot write to the wedding collection.
5. Deploy the code, or redeploy after changing bindings. This repository deploys
   automatically when pushed to `main`.
6. On the deployed site, test a real phone photo and short video, confirm both
   objects exist in the private R2 bucket, and test a wrong upload code. Check on
   iPhone and Android if possible before sharing with guests.

Production was configured on 14 September 2026 with the private R2 bucket
`mattandmia-guest-uploads`, the `WEDDING_UPLOADS` binding, and an `UPLOAD_CODE`
secret. Public development access is disabled and no custom bucket domains are
configured. Preview uploads remain disabled. The secret is not stored in this repository.

The application itself does not create Cloudflare resources or secrets.
Without both settings, the page displays “Uploads aren’t open yet” and disables
uploading. Remove `UPLOAD_CODE` and redeploy when submissions should close.

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
- The upload code protects the write endpoint independently of the site's light
  client-side gate. A shared code is not individual guest authentication. Rotate
  it if it is shared beyond the guests; R2 usage is billed to the hosting account.
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
