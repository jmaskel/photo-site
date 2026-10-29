(() => {
  const items = [...document.querySelectorAll('.p')];
  const lb = document.getElementById('lb');
  if (!items.length || !lb.showModal) return;
  const img = lb.querySelector('img');
  const source = lb.querySelector('source');
  const cap = lb.querySelector('figcaption');
  let i = -1;

  // Pick a size hint that fits the viewport so the browser fetches the right resolution.
  const sizes = (r) => Math.ceil(Math.min(innerWidth, (innerHeight - 72) * r)) + 'px';

  const load = (n, el, src) => {
    const a = items[n];
    const thumb = a.querySelector('img');
    const s = sizes(thumb.getAttribute('width') / thumb.getAttribute('height') || 1.5);
    if (src) { src.sizes = s; src.srcset = a.querySelector('source').srcset; }
    el.sizes = s;
    el.srcset = thumb.srcset;
    return thumb;
  };

  const preload = (n) => {
    if (n < 0 || n >= items.length) return;
    const p = document.createElement('picture');
    const s = document.createElement('source');
    s.type = 'image/avif';
    const im = document.createElement('img');
    p.append(s, im);
    load(n, im, s);
  };

  const show = (n) => {
    i = (n + items.length) % items.length;
    const a = items[i];
    const thumb = a.querySelector('img');
    // Show the already-loaded grid image instantly while the large one loads.
    img.style.backgroundImage = thumb.currentSrc ? `url("${thumb.currentSrc}")` : '';
    img.removeAttribute('srcset');
    source.removeAttribute('srcset');
    img.width = thumb.getAttribute('width');
    img.height = thumb.getAttribute('height');
    load(i, img, source);
    img.alt = thumb.alt;
    cap.textContent = a.dataset.caption || '';
    history.replaceState(null, '', '#' + a.id);
    preload(i + 1);
    preload(i - 1);
  };

  const open = (n) => {
    show(n);
    if (!lb.open) lb.showModal();
  };

  items.forEach((a, n) =>
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(n);
    }),
  );

  lb.querySelector('.x').onclick = () => lb.close();
  lb.querySelector('.prev').onclick = () => show(i - 1);
  lb.querySelector('.next').onclick = () => show(i + 1);
  img.onload = () => (img.style.backgroundImage = '');
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.tagName === 'FIGURE') lb.close();
  });
  lb.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    items[i]?.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if (!lb.open) return;
    if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  });

  let x0 = null;
  lb.addEventListener('touchstart', (e) => (x0 = e.touches.length === 1 ? e.touches[0].clientX : null), { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  });

  const start = items.findIndex((a) => '#' + a.id === location.hash);
  if (start >= 0) open(start);
})();
