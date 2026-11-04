(() => {
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const updateProgress = (type) => {
    const selector = type === 'production' ? '#oil-production .secret.revealed' : '#oil-reserves .secret.revealed';
    const output = document.querySelector(type === 'production' ? '#productionProgress' : '#reservesProgress');
    output.textContent = `${$$(selector).length} / 3`;
  };

  $$('.oil-data-section .secret').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.closest('#oil-production') ? 'production' : 'reserves';
      const rank = Number(button.dataset.rank);
      const previous = rank === 1 || button.parentElement.querySelector(`[data-rank="${rank - 1}"]`)?.classList.contains('revealed');
      if (!previous) {
        if (typeof notify === 'function') notify('앞 순위부터 차례대로 공개해 주세요.');
        return;
      }
      button.classList.add('revealed');
      button.querySelector('.country-name').textContent = button.dataset.country;
      updateProgress(group);
    });
  });

  $$('.reset-reveals').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.reset === 'production' ? document.querySelector('#oil-production') : document.querySelector('#oil-reserves');
    $$('.secret', section).forEach(item => {
      item.classList.remove('revealed');
      item.querySelector('.country-name').textContent = '???';
    });
    updateProgress(button.dataset.reset);
  }));

  document.querySelector('#toggleReserves').addEventListener('click', event => {
    const grid = document.querySelector('#reserveGrid');
    grid.classList.toggle('show-all');
    event.currentTarget.textContent = grid.classList.contains('show-all') ? '상위 6개만 보기' : '전체 순위 보기';
  });

  const koreaAnswer = document.querySelector('#koreaAnswer');
  const setKorea = open => {
    koreaAnswer.classList.toggle('open', open);
    koreaAnswer.setAttribute('aria-hidden', String(!open));
    document.querySelector('.korea-question').style.display = open ? 'none' : '';
    document.querySelector('#koreaProgress').textContent = open ? '공개' : '가림';
  };
  document.querySelector('#revealKorea').addEventListener('click', () => setKorea(true));
  document.querySelector('#hideKorea').addEventListener('click', () => setKorea(false));

  const steps = $$('.price-step');
  const resetSteps = () => {
    steps.forEach((step, index) => {
      step.classList.remove('revealed');
      step.classList.toggle('locked', index > 0);
    });
    document.querySelector('#priceConclusion').classList.remove('open');
    document.querySelector('#priceProgress').textContent = '0 / 3';
  };
  steps.forEach((step, index) => step.addEventListener('click', () => {
    if (step.classList.contains('locked')) {
      if (typeof notify === 'function') notify('앞 단계를 먼저 공개해 주세요.');
      return;
    }
    step.classList.add('revealed');
    if (steps[index + 1]) steps[index + 1].classList.remove('locked');
    const count = $$('.price-step.revealed').length;
    document.querySelector('#priceProgress').textContent = `${count} / 3`;
    if (count === 3) document.querySelector('#priceConclusion').classList.add('open');
  }));
  document.querySelector('#resetPriceSteps').addEventListener('click', resetSteps);
  resetSteps();
})();
