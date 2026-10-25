// Testimonials on the About page: filter by player-coach pillar (direction, people, craft),
// show how many quotes back each pillar, and let each pillar jump to its own quotes
(function () {
  const section = document.getElementById('testimonials');
  if (!section) return;

  const items = [...section.querySelectorAll('.testimonial')];
  const buttons = [...section.querySelectorAll('.testimonial-filters button')];
  const empty = section.querySelector('.testimonial-empty');
  const tagsOf = (item) => (item.dataset.tags || '').split(/\s+/);
  const count = (filter) => filter === 'all' ? items.length : items.filter((item) => tagsOf(item).includes(filter)).length;

  // Show counts on the filters, e.g. "People 3"
  buttons.forEach((button) => {
    const n = document.createElement('span');
    n.className = 'testimonial-count';
    n.textContent = count(button.dataset.filter);
    button.append(' ', n);
  });

  function show(filter) {
    let visible = 0;
    items.forEach((item) => {
      const match = filter === 'all' || tagsOf(item).includes(filter);
      item.hidden = !match;
      if (match) visible++;
    });
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    empty.hidden = visible > 0;
  }

  buttons.forEach((button) => button.addEventListener('click', () => show(button.dataset.filter)));

  // Each player-coach pillar links to its testimonials, with the count in the link
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.lead-link[data-filter]').forEach((link) => {
    const n = count(link.dataset.filter);
    link.querySelector('.link-text').textContent = n === 1 ? 'What 1 person says' : `What ${n} people say`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      show(link.dataset.filter);
      section.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
