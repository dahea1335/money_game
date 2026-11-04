(() => {
  const ending = document.getElementById('ending');
  const confetti = document.getElementById('endingConfetti');
  const mainElement = document.getElementById('main');
  if (!ending || !confetti || !mainElement) return;

  const colors = ['#3e8793', '#f7c6c7', '#e9b95b', '#ffffff', '#79cbd3'];
  for (let index = 0; index < 20; index++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--left', `${4 + ((index * 23) % 92)}%`);
    piece.style.setProperty('--color', colors[index % colors.length]);
    piece.style.setProperty('--delay', `${(index % 8) * .12}s`);
    piece.style.setProperty('--duration', `${2.7 + (index % 5) * .24}s`);
    piece.style.setProperty('--rotate', `${(index * 37) % 180}deg`);
    piece.style.setProperty('--drift', `${-38 + (index % 7) * 13}px`);
    confetti.append(piece);
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .55)) return;
    ending.classList.add('is-visible');
    observer.disconnect();
  }, { root: mainElement, threshold: [.55] });

  observer.observe(ending);
})();
