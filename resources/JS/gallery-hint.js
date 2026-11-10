// Once per visit, a small note points at the gallery icon in the corner, so people know it is there.
// It waits a moment after the page settles, leaves on its own, and never returns in the same session.
(() => {
  const KEY = 'gallery-hint-seen';
  const DELAY = 2500;
  const STAY = 9000;

  const icon = document.querySelector('.site-gallery:not(.is-active)');
  if (!icon) return;

  // If the browser will not remember that we showed it, stay quiet rather than show it on every page
  try {
    if (sessionStorage.getItem(KEY)) return;
  } catch {
    return;
  }

  const hint = document.createElement('div');
  hint.className = 'gallery-hint';
  hint.setAttribute('role', 'status');
  hint.innerHTML = `
    <a class="gallery-hint-link" href="${icon.getAttribute('href')}">
      <span class="gallery-hint-kicker">New</span>
      Walk through my work in a 3D <span class="gallery-hint-end">gallery<span class="gallery-hint-arrow" aria-hidden="true">→</span></span>
    </a>
    <button class="gallery-hint-close" type="button" aria-label="Dismiss">×</button>`;

  let frame = 0;
  let timer = 0;

  // Sit just under the icon, right edges lined up, wherever the icon happens to be
  const place = () => {
    frame = 0;
    const r = icon.getBoundingClientRect();
    hint.style.top = `${r.bottom + 10}px`;
    hint.style.right = `${Math.max(16, document.documentElement.clientWidth - r.right)}px`;
    hint.style.setProperty('--tip', `${r.width / 2}px`);
    // On small screens the icon scrolls away with the nav; the note goes with it
    if (r.bottom < 0) hide();
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(place); };

  const hide = () => {
    clearTimeout(timer);
    hint.classList.remove('is-shown');
    icon.classList.remove('is-hinted');
    removeEventListener('scroll', queue);
    removeEventListener('resize', queue);
    setTimeout(() => hint.remove(), 300);
  };

  const show = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch {}
    document.body.append(hint);
    place();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    requestAnimationFrame(() => {
      hint.classList.add('is-shown');
      icon.classList.add('is-hinted');
    });
    timer = setTimeout(hide, STAY);
  };

  hint.querySelector('.gallery-hint-close').addEventListener('click', hide);
  icon.addEventListener('click', hide);
  // Hovering keeps it open while someone reads it
  hint.addEventListener('mouseenter', () => clearTimeout(timer));
  hint.addEventListener('mouseleave', () => { timer = setTimeout(hide, 2500); });

  const start = () => setTimeout(show, DELAY);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
