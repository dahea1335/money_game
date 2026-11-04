(() => {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const flash = message => {
    if (typeof notify === 'function') notify(message);
  };

  $$('.ai-jump').forEach(button => button.addEventListener('click', () => jump(button.dataset.target)));

  const basicsSection = $('#ai-basics');
  const revealButtons = $$('[data-reveal]', basicsSection);
  const revealPanels = revealButtons.map(button => $('#' + button.dataset.reveal));
  const basicsReset = $('[data-stage="ai-basics"]', basicsSection);
  let basicsStep = 0;

  const renderBasicsStep = () => {
    revealButtons.forEach((button, index) => {
      const isRevealed = index < basicsStep;
      button.disabled = index > basicsStep;
      button.classList.toggle('completed', isRevealed);
      button.setAttribute('aria-expanded', String(isRevealed));
      revealPanels[index].classList.toggle('open', isRevealed);
      revealPanels[index].setAttribute('aria-hidden', String(!isRevealed));
    });
  };

  revealButtons.forEach((button, index) => button.addEventListener('click', () => {
    if (button.disabled || index > basicsStep) return;
    basicsStep = Math.max(basicsStep, index + 1);
    renderBasicsStep();
    if (index === revealButtons.length - 1) {
      requestAnimationFrame(() => revealPanels[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  }));

  basicsReset.addEventListener('click', () => {
    basicsStep = 0;
    renderBasicsStep();
  });
  renderBasicsStep();

  $$('.ai-feature-grid button').forEach(button => button.addEventListener('click', () => {
    $$('.ai-feature-grid button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    $('#featureExample').textContent = button.dataset.example;
  }));

  $('#makeBetterPrompt').addEventListener('click', () => {
    $('#goodPrompt').classList.add('open');
    $('#promptInsight').classList.add('open');
  });
  $('#hideBetterPrompt').addEventListener('click', () => {
    $('#goodPrompt').classList.remove('open');
    $('#promptInsight').classList.remove('open');
  });

  const parts = $$('.prompt-parts button');
  parts.forEach((button, index) => button.addEventListener('click', () => {
    if (button.classList.contains('locked')) return flash('앞의 요소부터 차례로 확인해 주세요.');
    button.classList.add('revealed');
    parts[index + 1]?.classList.remove('locked');
    if (parts.every(item => item.classList.contains('revealed'))) $('#completePrompt').classList.add('open');
  }));
  $('#resetPromptParts').addEventListener('click', () => {
    parts.forEach((button, index) => {
      button.classList.remove('revealed');
      button.classList.toggle('locked', index > 0);
    });
    $('#completePrompt').classList.remove('open');
  });

  const basePrompt = `너는 경매 게임 전략을 도와주는 AI 비서야.

우리 팀은 중학교 1학년 학생들이고 지금 '무인도 탈출 머니게임'에 참여하고 있어.

게임 규칙은 다음과 같아.
- 총 6개 팀이 경쟁해.
- 각 팀은 20머니로 시작해.
- 탈출하려면 물, 통조림, 성냥, 뗏목을 각각 1개 이상 확보해야 해.
- 필요한 생존 도구를 모두 확보한 팀만 탈출할 수 있어.
- 폭죽은 탈출 필수품이 아닌 선택형 보너스 아이템이야.
- 선착순 탈출 성공 2팀만 게임 종료 후 폭죽 1개당 5머니를 받아.
- 탈출 실패 팀은 폭죽이 있어도 보너스를 받지 못해.
- 탈출에 성공한 팀 중 폭죽 보너스를 더한 최종 머니가 많은 팀이 이겨.
- 남은 머니가 같으면 먼저 필요한 도구를 확보한 팀이 이겨.
- 다른 팀의 입찰 금액은 알 수 없어.

2차 게임의 조건은 다음과 같아.
- 물은 총 13개가 공급되고 최고 가격은 2머니야.
- 통조림은 7개, 성냥은 6개, 뗏목은 5개야.
- 폭죽의 공급 수량은 선생님이 안내한 조건을 따라야 해. 폭죽을 살 때와 사지 않을 때의 장점과 위험을 비교해야 해.

우리 팀의 목표는 생존 도구를 모두 확보하면서 최대한 많은 머니를 남기는 거야.

다음 질문에 답해 줘.
1. 어떤 도구부터 확보하면 좋을까?
2. 각 도구에 얼마까지 사용할지 추천해 줘.
3. 추천 금액의 합계는 20머니 이하여야 해.
4. 다른 팀 때문에 계획대로 구매하지 못했을 때 대안은 무엇일까?
5. 폭죽을 구매하는 전략과 구매하지 않는 전략의 장점과 위험은 무엇일까?

중학교 1학년이 이해할 수 있도록 표로 정리해 줘. 낙찰 가격은 예측일 뿐이며 반드시 이길 수 있다고 단정하지 마.`;
  const buildPrompt = () => {
    const experience = $('#gameExperience').value.trim();
    return basePrompt + (experience ? `\n\n[우리 팀의 1차 게임 경험]\n${experience}` : '');
  };
  const refreshPrompt = () => $('#studentPrompt').textContent = buildPrompt();
  $('#gameExperience').addEventListener('input', refreshPrompt);
  refreshPrompt();

  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  };
  $('#copyStudentPrompt').addEventListener('click', async () => {
    await copyText(buildPrompt());
    $('#promptCopyStatus').textContent = '프롬프트를 복사했습니다!';
    flash('프롬프트 복사 완료');
  });
  $('#togglePromptCard').addEventListener('click', event => {
    const card = $('.prompt-card');
    card.classList.toggle('collapsed');
    event.currentTarget.textContent = card.classList.contains('collapsed') ? '내용 펼치기' : '내용 접기';
  });

  $$('.check-choices button').forEach(button => button.addEventListener('click', () => {
    $$('.check-choices button').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    const correct = button.dataset.check === 'correct';
    $('#checkFeedback').classList.add('open');
    $('#checkFeedback').innerHTML = correct
      ? '<b>맞아요. 문제가 있는 전략입니다.</b><br>뗏목만 구매하고 다른 생존 도구를 확보하지 못하면 탈출할 수 없어요. AI의 답변도 반드시 확인해야 합니다.'
      : '<b>다시 생각해 봐요.</b><br>뗏목만으로는 탈출할 수 없습니다. 물·통조림·성냥도 모두 필요해요. 폭죽은 선택형 보너스 아이템입니다.';
    $('#strategyChoice').classList.add('open');
  }));

  let selectedStrategy = '';
  $$('[data-strategy]').forEach(button => button.addEventListener('click', () => {
    $$('[data-strategy]').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    selectedStrategy = button.dataset.strategy;
    $('#selectedStrategy').textContent = selectedStrategy;
  }));
  $('#copyStrategy').addEventListener('click', async () => {
    if (!selectedStrategy) return flash('먼저 전략을 선택해 주세요.');
    await copyText(selectedStrategy);
    flash('선택한 전략을 복사했습니다.');
  });

  const addGameBridge = () => {
    const shell = $('#game1 .game-shell');
    if (!shell || $('.ai-bridge-panel', shell)) return;
    const panel = document.createElement('div');
    panel.className = 'ai-bridge-panel';
    panel.innerHTML = '<p>이번에는 AI 비서의 조언을 받아 새로운 전략을 세워볼까요?</p><button type="button">AI 학습 시작 →</button>';
    $('button', panel).addEventListener('click', () => jump('ai-intro'));
    shell.append(panel);
  };
  addGameBridge();
  new MutationObserver(addGameBridge).observe($('#game1 .game-shell'), { childList: true });
})();
