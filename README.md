# Photo site

A minimal, fast photography portfolio. One static HTML page with inline CSS and
about 3 KB of JavaScript, no frameworks, no web fonts.

- **Fast:** each photo is exported in up to 5 sizes as AVIF (with JPEG fallback). Browsers
  download only the size that fits the screen. Images below the fold load lazily, and
  each one shows its dominant color until it loads, so the layout never jumps.
- **Responsive:** justified rows on monitors (every photo uncropped, rows fill the width),
  one full-width photo per row on phones.
- **Viewer:** click a photo to see it full screen. Arrow keys or swipe to move between
  photos, Esc to close. Every photo has a shareable link (`/#photo-name`).
- Light and dark mode follow the visitor's system setting.

## Use it

Requires Node 20+.

```sh
npm install
# 1. Drop your photos into photos/ (sorted by filename: 01-foo.jpg, 02-bar.jpg, ...)
# 2. Edit site.config.json (name, links, alt text and captions)
npm run dev      # build, then preview at http://localhost:8080
```

The first build encodes every photo (a few seconds each). Later builds reuse the
results in `.cache/` and only process new or changed photos.

### site.config.json

| Key           | What it does                                                        |
| ------------- | ------------------------------------------------------------------- |
| `name`        | Shown top-left, in the page title and footer                        |
| `tagline`     | Added to the page title                                             |
| `description` | Search engine and link-preview description                          |
| `url`         | Your site's full URL (optional, makes link previews use full URLs)  |
| `links`       | Top-right links, e.g. email, Instagram                              |
| `photos`      | Per-photo `alt` text and optional `caption`, keyed by filename      |

Without an `alt`, the filename is used (`03-misty-harbor.jpg` → "misty harbor").

## Publish

**GitHub Pages:** in the repo go to *Settings → Pages → Source* and pick *GitHub Actions*.
Every push to `main` then builds and deploys the site.

**Anywhere else** (Netlify, Cloudflare Pages, any web host): run `npm run build` and
upload the `dist/` folder, or set the build command to `npm run build` and the output
directory to `dist`.

## Tuning

In `build.mjs`: `WIDTHS` (output sizes), `AVIF` / `JPEG` quality. In `src/style.css`:
`--h` (row height), `--gap`, colors. Change `VERSION` in `build.mjs` after changing
encoder settings so cached images are regenerated.
