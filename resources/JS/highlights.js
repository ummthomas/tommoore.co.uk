// Highlighted text (<mark>) sweeps in as if it's being read: once a paragraph reaches the
// middle of the screen, its highlights fill one at a time, each starting when the reader
// would get to it. Without this script, or with reduced motion, highlights show as normal.
(function () {
  const marks = [...document.querySelectorAll('mark')];
  if (!marks.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('has-mark-sweep');

  const MS_PER_WORD = 70;   // a brisk reading pace before each highlight
  const START = 200;        // short pause once the paragraph reaches the middle
  const GAP = 150;          // breath between one highlight finishing and the next starting
  const sweepFor = (mark) => Math.min(1300, 450 + mark.textContent.length * 14);
  const words = (text) => (text.trim().match(/\S+/g) || []).length;

  // Highlights are grouped by the paragraph (or list item, caption…) they sit in
  const blocks = new Map();
  marks.forEach((mark) => {
    const block = mark.closest('p, li, dd, blockquote, figcaption, h1, h2, h3, h4') || mark.parentElement;
    if (!blocks.has(block)) blocks.set(block, []);
    blocks.get(block).push(mark);
  });

  function play(block) {
    let read = 0;      // words read so far in the paragraph
    let free = 0;      // when the previous highlight finishes
    let before = '';   // plain text read since the last highlight
    const started = new Set();
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const mark = blocks.get(block).find((m) => m.contains(node));
      if (!mark) { before += node.textContent; continue; }
      if (started.has(mark)) continue;
      started.add(mark);
      read += words(before);
      before = '';
      const start = Math.max(START + read * MS_PER_WORD, free + GAP);
      const length = sweepFor(mark);
      mark.style.transitionDelay = `${start}ms`;
      mark.style.transitionDuration = `${length}ms`;
      mark.classList.add('is-marked');
      read += words(mark.textContent);
      free = start + length;
    }
  }

  // A thin band across the middle of the viewport: a paragraph starts once it crosses it
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      play(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '-45% 0px -45% 0px' });

  blocks.forEach((_, block) => io.observe(block));
})();
