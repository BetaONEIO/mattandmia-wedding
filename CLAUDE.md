# Matt & Mia — Wedding Site

A small static site with a password gate. Three audiences, two passwords, three content pages.

## What it is

- `index.html` — landing page: hero up top with the password prompt underneath.
- `wedding.html` — full-day site for guests invited to ceremony + reception + evening.
- `ceremony.html` — church-only site for guests invited to the service only.
- `meal.html` — evening-only site for guests invited to the evening reception.

Passwords (case-insensitive, compared by SHA-256):

| Word         | Unlocks                                  |
| ------------ | ---------------------------------------- |
| `specialday` | All pages (full day); token is `wedding` |
| `church`     | Ceremony page only; token is `ceremony`  |
| `meal`       | Evening page only                        |

Every content page is now gated — each loads `guard.js` and declares a `data-requires` token. The `wedding` token satisfies every page; otherwise the token must match the page.

## File layout

```
index.html      hero + gate UI
gate.js         hashes the input, sets sessionStorage["mm_access"], redirects
wedding.html    full-day content;   <body data-requires="wedding">
ceremony.html   church-only content; <body data-requires="ceremony">
meal.html       evening content;     <body data-requires="meal">
guard.js        loaded first on each content page; redirects to index.html
                if sessionStorage token doesn't satisfy data-requires.
                "wedding" satisfies every page; otherwise token must match.
site.js         countdown timer + "Sign out" links (clears the token)
styles.css      shared styles (Cormorant Garamond + Montserrat, soft palette)
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

- **RSVP forms** post to `miadallyn24@gmail.com` via FormSubmit (formsubmit.co). FormSubmit needs a one-time activation — submit the live form once and click the confirmation email it sends to that address.
- **Make repo private** if you want the password words out of public view — the *deployed* JS is still readable by visitors, but the source repo is no longer indexable.

## Security notes

The gate is **light protection only**. `gate.js` literally contains the words `specialday` and `meal` as JS strings — anyone who views source can read them. The hashing only stops the words appearing as plaintext in network logs. This is the norm for wedding sites; it keeps casual snoopers and search engines out (`<meta name="robots" content="noindex,nofollow">` is set on every page) but is not a real auth boundary. If you ever need real auth, put the site behind Cloudflare Access or Netlify password protection.

## Placeholders to replace before sharing

Search for these and swap for the real values — they are scattered across `wedding.html` and `meal.html`:

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
4. Optional: swap the email RSVP for a form (Tally, Google Form, or a Netlify form)
5. Optional: add a photo to the hero — currently it's typography on a soft gradient
6. Optional: rotate the password words once invitations go out, if any leaked
