# Guest photos and videos

`/photos` is shared by both sets of guests and requires no invitation password,
upload code, or Google login. Guests select multiple files and optionally give
their name. Files upload sequentially with progress and retry controls.

## Production storage

New uploads use Google Drive folder `1yJLavQHYDCENRILcy3VLfInUMNs2JE-m`
(Matt and Mia's Wedding). Mia owns the folder; `admin@betaone.io` authorised the
uploader with Editor access. New files consume the authorising account's storage.
The folder is shared with anyone who has its link. Files inherit that sharing;
the website itself has no gallery or download endpoint. `/upload-privacy`
explains this to guests.

Google Cloud project: `matt-and-mia-wedding`. Drive and Picker APIs are enabled.
The external OAuth app is In production, avoiding the seven-day refresh token
expiry imposed on Drive authorisations in Testing. It uses `drive.file` with
explicit Google Picker selection of the wedding folder, not whole-Drive access.

Cloudflare Pages Production settings:

- `UPLOAD_STORAGE=google-drive`
- `GOOGLE_DRIVE_FOLDER_ID=1yJLavQHYDCENRILcy3VLfInUMNs2JE-m`
- Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

Secrets stay server-side. Never put them in browser JavaScript, Git, or chat.
Preview uploads remain unconfigured. Redeploy after changing settings.
The former `UPLOAD_CODE` secret is unused.

## Upload behaviour

- Originals are streamed without conversion or buffering entire videos in memory.
- Maximum 90 MiB per file (labelled 90 MB), below Cloudflare's request limit.
- JPEG, PNG, GIF, WebP, HEIC, HEIF, AVIF, MP4, MOV, M4V, WebM and 3GP accepted.
  Extension validation is not content scanning.
- Guest names are stored in Drive file descriptions; original filenames are retained.
- The server refreshes its Google access token, creates a resumable upload session,
  and streams the file to Google. It reports success only after Google returns a
  saved file ID. Tokens and upload session URLs are never returned to guests.
- Uploads are open to anyone with the website link. Origin and size checks apply.
- Keep the page open and phone awake. Failed files can be retried, but transfers
  do not resume across page refreshes. A lost response after a successful save can
  produce a duplicate on retry.
- Google access can be revoked or expire for other reasons. If uploads fail,
  check authorisation, account storage, and folder permissions.

## Existing files and rollback

Previous uploads remain in private Cloudflare R2 bucket
`mattandmia-guest-uploads`, bound as `WEDDING_UPLOADS`. Nothing was migrated or
deleted. Public R2 access remains disabled. Download earlier files through the
Cloudflare dashboard. There is no automatic deletion schedule.

Drive errors never silently redirect uploads to R2. To roll back, set
`UPLOAD_STORAGE=r2` and redeploy; the retained R2 binding resumes storage there.
To close submissions, set `UPLOAD_STORAGE=disabled` and redeploy.

## Verification

Run `node --test tests/*.test.mjs`. Tests cover guest page behaviour, validation,
streamed storage, failed or incomplete Google responses, and configuration that
fails closed. Provider responses are mocked; also test a photo and short video
through a deployed page and verify their folder and size in Google Drive.
A plain static Python server cannot execute Pages Functions; use Wrangler Pages
dev or a separately configured preview for integration work.

References:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2#expiration
- https://developers.cloudflare.com/pages/functions/bindings/#r2-buckets
