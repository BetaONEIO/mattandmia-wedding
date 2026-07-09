# Matt & Mia — Wedding Site

A small static site with a password gate. Two audiences, two passwords, two content pages.

## What it is

- `index.html` — landing page: hero up top with the password prompt underneath.
- `wedding.html` — full-day site for guests invited to ceremony + reception + evening.
- `ceremony.html` — church-only site for guests invited to the service only.

Passwords (case-insensitive, compared by SHA-256):

| Word         | Unlocks                                  |
| ------------ | ---------------------------------------- |
| `specialday` | All pages (full day); token is `wedding` |
| `church`     | Ceremony page only; token is `ceremony`  |

Every content page is now gated — each loads `guard.js` via `<script src="guard.js" data-requires="TOKEN"></script>` in the `<head>`. The guard reads the required token from its own `<script>` tag (`document.currentScript`), so it runs synchronously in the head **before** the body paints and redirects to `index.html` if the session token doesn't satisfy it. The `wedding` token satisfies every page; otherwise the token must match the page.

> Note: `data-requires` lives on the guard `<script>` tag, **not** on `<body>`. An earlier version read `document.body.dataset.requires` from a head script, but `document.body` is `null` at that point, so the guard silently failed and every page rendered ungated.

## File layout

```
index.html      hero + gate UI
gate.js         hashes the input, sets sessionStorage["mm_access"], redirects
wedding.html    full-day content;    guard.js data-requires="wedding"
ceremony.html   church-only content; guard.js data-requires="ceremony"
guard.js        loaded first on each content page; redirects to index.html
                if sessionStorage token doesn't satisfy data-requires.
                "wedding" satisfies every page; otherwise token must match.
site.js         countdown timer, "Sign out" links, RSVP form submit handler
styles.css      shared styles (Cormorant Garamond + Montserrat, soft palette)
functions/api/rsvp.js
                Cloudflare Pages Function — receives RSVP POSTs from both
                content pages and relays them as email via Brevo's API.
```

## Running locally

```
python3 -m http.server 8765 --directory .
open http://127.0.0.1:8765/
```

`crypto.subtle` (used for hashing) requires a secure context — `http://127.0.0.1` and `https://` both qualify, plain `file://` does not in some browsers.

## Hosting

Repo: https://github.com/BetaONEIO/mattandmia-wedding (currently public).

**Live on Cloudflare Pages: https://mattandmia.pages.dev** (a custom domain is planned but not yet attached). Pushing to `main` triggers a new deploy.

- **RSVP forms** post to `/api/rsvp`, a Cloudflare Pages Function (`functions/api/rsvp.js`) that relays the submission as an email via Brevo, sent straight to `miadallyn24@gmail.com`. Same-origin, so no CORS issues (this replaced an earlier FormSubmit-based version that had intermittent 522s and an activation-email gotcha).
  - Sender is hardcoded in the function as `admin@betaone.io` (verified sender in the Brevo account).
  - Requires two Pages project environment variables, set for **both** Production and Preview (Settings → Environment variables): `BREVO_API_KEY` (Secret) and `RSVP_TO_EMAIL` (plain, currently `miadallyn24@gmail.com`). Both are already configured in the live project.
- **Make repo private** if you want the password words out of public view — the *deployed* JS is still readable by visitors, but the source repo is no longer indexable.

## Security notes

The gate is **light protection only**. `gate.js` literally contains the words `specialday` and `church` as JS strings — anyone who views source can read them. The hashing only stops the words appearing as plaintext in network logs. This is the norm for wedding sites; it keeps casual snoopers and search engines out (`<meta name="robots" content="noindex,nofollow">` is set on every page) but is not a real auth boundary. If you ever need real auth, put the site behind Cloudflare Access or Netlify password protection.

## Placeholders to replace before sharing

Search for these and swap for the real values — they are scattered across `wedding.html` and `ceremony.html`:

- **Date**: `12 September 2026` and the matching `data-date="2026-09-12T..."` on the countdowns
- **Ceremony venue**: `St. Mary's Chapel`, `Hartington Lane`
- **Reception venue**: `Manor House Barn`, `Long Compton Road`, `Cotswolds, GL54`
- **RSVP email**: `mattandmia@example.com` and the deadline `1 August 2026`
- **Hotels**: `The Lygon Arms`, `Manor House Inn`, `Cotswold Cottages`
- **Our Story copy** in `wedding.html` (currently a placeholder coffee-shop story)
- **Schedule times** in both files
- **FAQ answers** in both files

## Done so far

- Built the gate, both content pages, and shared styling
- Initial commit pushed to `main` (`279e13a`)

## Likely next steps when you come back

1. Replace placeholder content with real details (see list above)
2. Decide on hosting and deploy
3. Decide on repo visibility (public vs private)
4. Optional: add a photo to the hero — currently it's typography on a soft gradient
5. Optional: rotate the password words once invitations go out, if any leaked
