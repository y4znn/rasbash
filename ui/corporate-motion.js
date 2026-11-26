if (typeof document !== 'undefined') {
  const film = document.querySelector('.rb-ground-film');
  if (film) {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    function playGroundStudy() {
      if (motion.matches || navigator.connection?.saveData) {
        film.pause();
      } else {
        if (!film.getAttribute('src')) {
          film.src = '/art/hero-bg.mp4';
        }
        film.muted = true;
        film.loop = true;
        film.play().catch(() => {});
      }
    }
    playGroundStudy();
    motion.addEventListener('change', playGroundStudy);
  }
  const inquiries = document.getElementById('inquiries');
  if (inquiries && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        inquiries.classList.add('arrived');
        observer.disconnect();
      }
    }, {threshold: 0.3});
    observer.observe(inquiries);
  }
}
