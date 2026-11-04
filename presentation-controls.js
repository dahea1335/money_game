(() => {
  const mainElement = document.getElementById('main');
  const lessonSections = [...document.querySelectorAll('.lesson-section')];
  if (!mainElement || lessonSections.length === 0) return;

  const keyActions = new Map([
    ['ArrowRight', 1],
    ['PageDown', 1],
    ['ArrowLeft', -1],
    ['PageUp', -1]
  ]);

  const interactiveSelector = [
    'input',
    'textarea',
    'select',
    'button',
    'a',
    'label',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="button"]',
    '.story-controls',
    '#cinema'
  ].join(',');

  const isInteractive = element =>
    element instanceof Element && Boolean(element.closest(interactiveSelector));

  const isInteractionInProgress = event => {
    if (isInteractive(event.target) || isInteractive(document.activeElement)) return true;
    return Boolean(document.fullscreenElement?.closest?.('#cinema'));
  };

  const directionFor = event => {
    if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') return 1;
    return keyActions.get(event.key) || 0;
  };

  const currentSectionIndex = () => {
    const mainRect = mainElement.getBoundingClientRect();
    const marker = mainRect.top + Math.min(mainRect.height, window.innerHeight) * .38;
    const visibleIndex = lessonSections.findIndex(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= marker && rect.bottom > marker;
    });
    if (visibleIndex >= 0) return visibleIndex;

    return lessonSections.reduce((closest, section, index) => {
      const distance = Math.abs(section.getBoundingClientRect().top - mainRect.top);
      return distance < closest.distance ? { index, distance } : closest;
    }, { index: 0, distance: Infinity }).index;
  };

  const moveSection = direction => {
    const current = currentSectionIndex();
    const destination = Math.max(0, Math.min(lessonSections.length - 1, current + direction));
    if (destination === current) return;
    lessonSections[destination].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.addEventListener('keydown', event => {
    const direction = directionFor(event);
    if (!direction || event.repeat || isInteractionInProgress(event)) return;
    event.preventDefault();
    moveSection(direction);
  });
})();
