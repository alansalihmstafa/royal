---
name: testing-royal-site
description: Test the Royal static site (royalchess.pages.dev) end-to-end. Use when verifying theme/carousel, hidden @admin access, device image uploads, or admin customization settings.
---

# Testing the Royal site

Royal is a 100% static site (no backend). App data & settings load with a fallback cascade: `/api/apps` (only on Netlify) -> browser `localStorage` -> bundled `apps.json` / `settings.json`. All admin edits live in `localStorage` until exported and committed.

- Live site: https://royalchess.pages.dev (Cloudflare Pages)
- Admin: https://royalchess.pages.dev/admin
- localStorage keys: `royalApps` (apps), `royalSettings` (site customization)

## Access / credentials

- **Admin is hidden**: there is no Admin button. Open it by typing `@admin` into the homepage search bar and pressing Enter (redirects to `/admin`). Direct URL `/admin` also works.
- **Admin passcode**: `royal` (hardcoded as `ADMIN_PASSCODE` in `admin.html`).
- No external secrets are needed to test the UI. Deploying to Cloudflare Pages needs a Cloudflare API token + account ID (see Devin Secrets below).

## Core flows to test

1. **Theme + hero carousel** (homepage): theme is dark with a violet `#7c5cff` accent (NOT neon green). A hero carousel auto-rotates every ~5s (configurable). Verify the active dot advances and the slide app name changes.
2. **Hidden admin**: `@admin` in search -> admin login. Passcode `royal` -> dashboard.
3. **Upload icon/banner from device** (the key feature): in admin "Add New App", click **Choose icon** / **Choose photo**, pick an image. The preview should switch from the placeholder (`star` / image emoji) to an `<img src="data:image/...">` (client-side canvas resize: icon <=320px, banner <=1400px). Publish -> the app appears on the public homepage with the uploaded image as its icon (an `<img>`, not an emoji). If "Show in slideshow" is checked it also becomes a carousel slide.
4. **Admin customization** (Site Settings tab): change accent color (hex or color picker), site name, tagline, slideshow speed, footer. Save -> homepage reflects the change (e.g. gold accent on chips/buttons/dots). `Reset to default` restores violet `#7c5cff`.

## Gotchas / tips

- **Carousel pause-on-hover is intended.** If the slide never advances while testing auto-rotation, the mouse cursor is probably resting over the carousel. Move the cursor off the carousel (e.g. to the page body) and wait ~5s; rotation resumes. Don't report this as a bug.
- **File picker**: the GTK "Open File" dialog appears on `Choose icon`/`Choose photo`. Fastest path: press `Ctrl+L`, type the absolute image path (e.g. `/home/ubuntu/Pictures/your-icon.png`), Enter. Prepare a test image first (a solid-color shape works and is easy to spot vs the default emoji).
- **Changes are per-browser**: uploads/settings persist only in this browser's `localStorage`. They do NOT affect other visitors or the repo until you click **Export apps.json** / **Export settings.json** and commit those files. After testing, use **Reset to default** + delete any test apps to leave the live site clean for the public.
- **Use the UI, not curl**: it's a static site; everything is client-side, so test via the browser.
- A published app with no uploaded banner gets an auto-generated banner derived from its icon for the carousel slide.

## Devin Secrets Needed

- `CLOUDFLARE_API_TOKEN` (or similarly named) — only needed to redeploy to Cloudflare Pages via Wrangler. Must NOT have Client IP Address filtering (the deploy server IP changes between sessions). Needs `Account > Cloudflare Pages > Edit`.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID for the deploy.
- No secrets are required just to test the UI on the already-live site.
