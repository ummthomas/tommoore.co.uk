// Footer dashed line, shared by every page: one smooth sine wave flowing across the gap
// between the invitation and the meta row, fading in when the footer comes into view
(function () {
  const footer = document.querySelector('.footer');
  const marquee = footer && footer.querySelector('.home-marquee-footer');
  if (!marquee) return;

  const svg = marquee.querySelector('.home-marquee-svg');
  const path = marquee.querySelector('.home-marquee-line');
  const direction = Number(marquee.dataset.direction) || -1;
  const speed = 42; // px per second, matching the home page hero lines
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let travel = 0, last = 0, frame = null, visible = false, dash = 0;

  // Smooth curve through a list of [x, y] points (Catmull-Rom converted to cubic Béziers)
  function curve(points) {
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6},` +
           ` ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6},` +
           ` ${p2[0]} ${p2[1]}`;
    }
    return d;
  }

  // A sine wave sampled every 24px: one full wave, dipping low above the meta row
  function build() {
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const textBottom = footer.querySelector('.footer-content').getBoundingClientRect().bottom - box.top;
    const gap = footer.querySelector('.footer-meta').getBoundingClientRect().top - box.top - textBottom;
    const mid = textBottom + gap * 0.45;
    const points = [];
    for (let x = 0; x <= box.width + 24; x += 24) {
      const t = Math.min(x / box.width, 1);
      points.push([x, mid + gap * 0.25 * Math.sin(Math.PI * 2 * t - Math.PI * 0.3)]);
    }
    path.setAttribute('d', curve(points));
    // One dash plus one gap, read from the CSS so the loop never jumps
    dash = getComputedStyle(path).strokeDasharray.split(/[ ,]+/).reduce((sum, n) => sum + parseFloat(n), 0);
    render();
  }

  function render() {
    if (dash) path.style.strokeDashoffset = direction * (travel % dash);
  }

  function tick(now) {
    if (last) travel += speed * (now - last) / 1000;
    last = now;
    render();
    frame = requestAnimationFrame(tick);
  }

  function update() {
    cancelAnimationFrame(frame);
    frame = null;
    last = 0;
    if (visible && !reduceMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }

  // Hidden until the footer scrolls into view, then it fades in and starts moving
  if (!reduceMotion.matches) marquee.classList.add('is-waiting');
  new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      visible = entry.isIntersecting;
      if (visible) marquee.classList.add('is-in');
    });
    update();
  }).observe(footer);

  document.addEventListener('visibilitychange', update);
  reduceMotion.addEventListener('change', update);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  build();
  document.fonts.ready.then(build);
})();
