// Project loops: short silent highlight reels cut from each film. They pause off screen,
// and stay on their first frame for anyone who prefers reduced motion.
(function () {
  const videos = document.querySelectorAll('.loop-video');
  if (!videos.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function sync(video, visible) {
    if (reduceMotion.matches || !visible) video.pause();
    else video.play().catch(() => {});
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => sync(e.target, e.isIntersecting));
  });
  videos.forEach((video) => {
    if (reduceMotion.matches) video.removeAttribute('autoplay');
    io.observe(video);
  });
})();
