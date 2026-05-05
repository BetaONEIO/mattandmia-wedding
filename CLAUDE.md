# Matt & Mia — Wedding Site

A small static site with a password gate. Two audiences, two passwords, two content pages.

## What it is

- `index.html` — landing page with a password input. No content, just the gate.
- `wedding.html` — full-day site for guests invited to the ceremony + meal.
- `meal.html` — evening-only site for guests invited to the evening reception.

Passwords (case-insensitive, compared by SHA-256):

| Word      | Unlocks                          |
| --------- | -------------------------------- |
| `wedding` | Both pages (full day)            |
| `meal`    | Evening page only                |

## File layout

```
index.html      gate UI
gate.js         hashes the input, sets sessionStorage["mm_access"], redirects
wedding.html    full-day content; <body data-requires="wedding">
meal.html       evening content;  <body data-requires="meal">
guard.js        loaded first on each content page; redirects to index.html
                if sessionStorage token doesn't satisfy data-requires
                ("wedding" satisfies both, "meal" satisfies meal only)
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

Not yet deployed. Easiest options:
- **GitHub Pages** — Settings → Pages → Deploy from `main`. Free, zero config. URL is public though, and password words are in `gate.js` source.
- **Netlify / Cloudflare Pages** — same drop-in. Add HTTP basic auth on top if you want real protection.
- **Make repo private** if you want the password words out of public view — the *deployed* JS is still readable by visitors, but the source repo is no longer indexable.

## Security notes

The gate is **light protection only**. `gate.js` literally contains the words `wedding` and `meal` as JS strings — anyone who views source can read them. The hashing only stops the words appearing as plaintext in network logs. This is the norm for wedding sites; it keeps casual snoopers and search engines out (`<meta name="robots" content="noindex,nofollow">` is set on every page) but is not a real auth boundary. If you ever need real auth, put the site behind Cloudflare Access or Netlify password protection.

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
