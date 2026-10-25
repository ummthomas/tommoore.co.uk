// Decorative dashed lines draw in the first time their section scrolls into view
(function () {
  const lines = document.querySelectorAll('.projects-intro');
  if (!lines.length || !('IntersectionObserver' in window)) {
    lines.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  lines.forEach((el) => io.observe(el));
})();
