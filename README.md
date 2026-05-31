# Royal

A dark, neon-themed website for distributing **Royal** desktop apps, tools, and
software downloads. Pure HTML/CSS/JS — no build step required.

## Pages

- `index.html` — public site: hero, searchable app grid, latest updates, contact.
- `admin.html` — admin panel to add / edit / delete apps (passcode gated).

## How the app list works

The app list loads with graceful fallbacks so the site works on any host:

1. **Netlify function** `/api/apps` (shared, persistent — only if deployed on Netlify).
2. **Browser storage** — apps saved by the admin panel in your browser.
3. **`apps.json`** — the static list bundled with the site (the default content).

### Publishing changes (static hosting)

1. Open `admin.html`, log in with the passcode (default **`royal`**, set in
   `admin.html` → `ADMIN_PASSCODE`).
2. Add / edit / delete apps. Changes are saved in your browser immediately.
3. Click **Export apps.json** (or **Copy JSON**), replace `apps.json` in the repo,
   and commit. Every visitor now sees the updated list.

## Hosting 100% free

This is a static site, so any free static host works:

- **Any static host / CDN** — upload the folder as-is.
- **GitHub Pages** — enable Pages on this repo (Settings → Pages → deploy from branch).
- **Netlify** — drag-and-drop the folder, or connect the repo. For shared persistent
  storage via the admin panel, the included Netlify function `netlify/functions/apps.js`
  (using Netlify Blobs) is wired up at `/api/apps`. Set `ADMIN_PASSWORD` in the Netlify
  dashboard to change the admin passcode.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
