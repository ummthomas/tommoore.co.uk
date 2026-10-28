// Project loops: short silent highlight reels cut from each film. They pause off screen,
// and stay on their first frame for anyone who prefers reduced motion.
// Document tours (data-from-start) wait until most of the video is on screen, then play
// from the beginning each time they come into view, so the opening overview is never missed.
(function () {
  const videos = document.querySelectorAll('.loop-video');
  if (!videos.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function sync(video, visible) {
    if (reduceMotion.matches || !visible) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }

  const loops = new IntersectionObserver((entries) => {
    entries.forEach((e) => sync(e.target, e.isIntersecting));
  });

  // Start a tour only once enough of it has buffered to play through smoothly, and rewind
  // while it's off screen so the restart never needs a seek at the moment it begins
  function startTour(video) {
    if (reduceMotion.matches) return;
    if (video.readyState >= 4) {
      video.play().catch(() => {});
      return;
    }
    video.addEventListener('canplaythrough', () => {
      if (video.dataset.playing) video.play().catch(() => {});
    }, { once: true });
  }

  const tours = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const video = e.target;
      if (e.intersectionRatio >= 0.6) {
        if (!video.dataset.playing) {
          video.dataset.playing = '1';
          startTour(video);
        }
      } else if (!e.isIntersecting && video.dataset.playing) {
        delete video.dataset.playing;
        video.pause();
        video.currentTime = 0;
      }
    });
  }, { threshold: [0, 0.6] });

  videos.forEach((video) => {
    const tour = 'fromStart' in video.dataset;
    if (reduceMotion.matches || tour) {
      video.removeAttribute('autoplay');
      video.pause();
    }
    (tour ? tours : loops).observe(video);
  });
})();
