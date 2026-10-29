// Builds the static site into dist/.
// Originals in photos/ are resized to several widths in AVIF + JPEG,
// then a single self-contained index.html (inline CSS/JS) is written.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS = path.join(ROOT, 'photos');
const CACHE = path.join(ROOT, '.cache', 'img');
const DIST = path.join(ROOT, 'dist');

const WIDTHS = [640, 960, 1280, 1920, 2560];
const AVIF = { quality: 55, effort: 3 };
const JPEG = { quality: 82, mozjpeg: true };
// Bump when encoder settings change so cached images are regenerated.
const VERSION = 'v1';
// Must match --h (max row height) in src/style.css; used for the `sizes` hint.
const ROW_HEIGHT = 320;

const EXT = /\.(jpe?g|png|tiff?|webp|avif)$/i;

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const slugify = (name) =>
  name.replace(EXT, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photo';

const titleFromFile = (name) =>
  name.replace(EXT, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim();

async function processPhoto(file, config) {
  const src = path.join(PHOTOS, file);
  const buf = await readFile(src);
  const hash = createHash('sha1').update(buf).update(VERSION).digest('hex').slice(0, 8);
  const slug = slugify(file);
  const base = `${slug}-${hash}`;
  const metaPath = path.join(CACHE, `${base}.json`);

  if (existsSync(metaPath)) {
    return { ...JSON.parse(await readFile(metaPath, 'utf8')), file, ...config.photos?.[file] };
  }

  const img = sharp(buf, { failOn: 'none' });
  const meta = await img.metadata();
  // EXIF orientations 5-8 are rotated 90deg, so width/height swap.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  const widths = WIDTHS.filter((w) => w < width);
  if (width <= WIDTHS.at(-1)) widths.push(width);

  const { dominant } = await sharp(buf).rotate().resize(64).stats();
  const color = '#' + [dominant.r, dominant.g, dominant.b].map((n) => n.toString(16).padStart(2, '0')).join('');

  await Promise.all(
    widths.flatMap((w) => {
      // rotate() applies EXIF orientation; metadata is stripped and output is sRGB.
      const pipe = sharp(buf, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true });
      return [
        pipe.clone().avif(AVIF).toFile(path.join(CACHE, `${base}-${w}.avif`)),
        pipe.clone().jpeg(JPEG).toFile(path.join(CACHE, `${base}-${w}.jpg`)),
      ];
    }),
  );

  const result = { slug, base, width, height, widths, color };
  await writeFile(metaPath, JSON.stringify(result));
  console.log(`  processed ${file} (${widths.join(', ')})`);
  return { ...result, file, ...config.photos?.[file] };
}

function figure(p, i) {
  const r = p.width / p.height;
  const set = (ext) => p.widths.map((w) => `img/${p.base}-${w}.${ext} ${w}w`).join(', ');
  const fallback = p.widths.find((w) => w >= 960) ?? p.widths.at(-1);
  const largest = p.widths.at(-1);
  // Phones: one photo per row, full width. Larger screens: justified rows ~ROW_HEIGHT tall.
  const sizes = `(max-width: 640px) 100vw, ${Math.round(r * ROW_HEIGHT * 1.6)}px`;
  const eager = i < 3;
  const alt = p.alt ?? titleFromFile(p.file);
  const caption = p.caption ? ` data-caption="${esc(p.caption)}"` : '';
  return `<a class="p" id="${p.slug}" href="img/${p.base}-${largest}.jpg" style="--r:${r.toFixed(4)};--c:${p.color}"${caption}><picture><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="img/${p.base}-${fallback}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${p.width}" height="${p.height}" alt="${esc(alt)}"${eager ? (i === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"'} decoding="async"></picture></a>`;
}

function page(config, photos, css, js) {
  const title = config.tagline ? `${config.name} — ${config.tagline}` : config.name;
  const og = photos[0] ? `img/${photos[0].base}-${photos[0].widths.find((w) => w >= 1280) ?? photos[0].widths.at(-1)}.jpg` : '';
  const abs = (p) => (config.url ? config.url.replace(/\/$/, '') + '/' + p : p);
  const links = (config.links ?? []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  const gallery = photos.length
    ? `<main class="g">${photos.map(figure).join('')}</main>`
    : `<main class="empty"><p>Add photos to the <code>photos/</code> folder and rebuild.</p></main>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(config.description)}">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(config.description)}">
${og ? `<meta property="og:image" content="${esc(abs(og))}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}${config.url ? `<link rel="canonical" href="${esc(config.url)}">\n` : ''}<link rel="icon" href="data:,">
<style>${css}</style>
</head>
<body>
<header><a class="name" href="./">${esc(config.name)}</a><nav>${links}</nav></header>
${gallery}
<footer>&copy; ${new Date().getFullYear()} ${esc(config.name)}</footer>
<dialog id="lb" aria-label="Photo viewer"><figure><picture><source type="image/avif"><img alt=""></picture><figcaption></figcaption></figure><button class="x" aria-label="Close">&times;</button><button class="prev" aria-label="Previous">&lsaquo;</button><button class="next" aria-label="Next">&rsaquo;</button></dialog>
<script>${js}</script>
</body>
</html>
`;
}

// Collapse whitespace/comments; the sources are small and hand-written.
const minCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const minJs = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\n\s*/g, '\n').trim();

async function main() {
  const t0 = performance.now();
  const config = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
  await mkdir(CACHE, { recursive: true });

  const files = (await readdir(PHOTOS)).filter((f) => EXT.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  console.log(`Building ${files.length} photo(s)...`);

  const photos = [];
  for (const f of files) photos.push(await processPhoto(f, config));

  const slugs = new Set();
  for (const p of photos) {
    if (slugs.has(p.slug)) throw new Error(`Two photos produce the same name "${p.slug}"; rename one of them.`);
    slugs.add(p.slug);
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(path.join(DIST, 'img'), { recursive: true });
  await Promise.all(
    photos.flatMap((p) =>
      p.widths.flatMap((w) =>
        ['avif', 'jpg'].map((ext) => copyFile(path.join(CACHE, `${p.base}-${w}.${ext}`), path.join(DIST, 'img', `${p.base}-${w}.${ext}`))),
      ),
    ),
  );

  const css = minCss(await readFile(path.join(ROOT, 'src', 'style.css'), 'utf8'));
  const js = minJs(await readFile(path.join(ROOT, 'src', 'viewer.js'), 'utf8'));
  const html = page(config, photos, css, js);
  await writeFile(path.join(DIST, 'index.html'), html);
  await writeFile(path.join(DIST, '.nojekyll'), '');

  console.log(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s — index.html is ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
