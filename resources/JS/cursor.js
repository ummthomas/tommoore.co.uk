// Custom cursor in the style of the "Hello! I'm Tom" multiplayer cursor, shared by every page.
// Elements with data-cursor="…" show that label next to the pointer.
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cursor = document.createElement('div');
  cursor.className = 'tm-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<svg class="tm-cursor-arrow" width="16" height="17" viewBox="5 3.5 15.5 17"><path d="M8.75418 20L5.62291 4.04089L20 11.9182L12.9181 13.9727L8.75418 20Z" fill="#000" stroke="#fff"/></svg><span class="tm-cursor-label"></span>';
  document.body.append(cursor);
  const label = cursor.querySelector('.tm-cursor-label');
  document.documentElement.classList.add('has-tm-cursor');

  let x = 0, y = 0;
  const updateLabel = () => {
    const el = document.elementFromPoint(x, y);
    const target = el && el.closest('[data-cursor]');
    if (target) {
      label.textContent = target.dataset.cursor;
      cursor.classList.add('has-label');
    } else {
      cursor.classList.remove('has-label');
    }
  };

  document.addEventListener('mousemove', (e) => {
    x = e.clientX;
    y = e.clientY;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    cursor.classList.add('is-visible');
    updateLabel();
  });
  // The element under a still pointer changes as the page scrolls
  window.addEventListener('scroll', updateLabel, { passive: true });
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
})();
