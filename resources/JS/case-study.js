// Case study navigation: builds the "On this page" list in the side rail from the
// headings marked with data-toc, and highlights the section currently being read
(function () {
  const toc = document.querySelector('.site-toc');
  if (!toc) return;

  const overview = document.querySelector('h1');
  const sections = [...document.querySelectorAll('h2[data-toc]')];
  if (!overview.id) overview.id = 'overview';

  const targets = [{ el: overview, label: 'Overview' }]
    .concat(sections.map((el) => ({ el, label: el.dataset.toc })));

  toc.innerHTML = targets
    .map((t) => `<a href="#${t.el.id}">${t.label}</a>`)
    .join('') + '<span class="site-toc-marker" aria-hidden="true"></span>';
  const links = [...toc.querySelectorAll('a')];
  const marker = toc.querySelector('.site-toc-marker');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  links.forEach((link, i) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      targets[i].el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', link.getAttribute('href'));
    });
  });

  // The current section is the last one whose heading has passed a third of the way down the screen
  let ticking = false;
  function updateActive() {
    ticking = false;
    const line = window.innerHeight * 0.35;
    let active = 0;
    targets.forEach((t, i) => {
      if (t.el.getBoundingClientRect().top <= line) active = i;
    });
    // At the very bottom of the page, the last section is the one being read
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) active = targets.length - 1;
    links.forEach((link, i) => {
      if (i === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    // One marker slides between sections rather than jumping from link to link
    marker.style.transform = `translateY(${links[active].offsetTop}px)`;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateActive);
    }
  }, { passive: true });
  window.addEventListener('resize', updateActive);
  updateActive();
})();
