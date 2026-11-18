(() => {
  'use strict';

  const main = document.getElementById('main');
  const slides = [...document.querySelectorAll('.lesson-section')];
  const progress = document.getElementById('progress');
  if (!main || slides.length === 0) return;

  const STORAGE_KEY = 'qclass-presentation-keymap';
  const defaultKeyMap = {
    next: ['PageDown', 'ArrowRight', 'ArrowDown', 'Space'],
    previous: ['PageUp', 'ArrowLeft', 'ArrowUp']
  };
  let currentIndex = 0;
  let captureDirection = null;
  let navigationLockedUntil = 0;
  let keyMap = loadKeyMap();
  const stageAdapters = new Map();

  const interactiveSelector = [
    'input', 'textarea', 'select', 'button', 'a', 'label', 'summary',
    '[contenteditable]:not([contenteditable="false"])', '[role="button"]', '[role="slider"]'
  ].join(',');

  installPresentationStyles();
  const controls = createPresentationControls();
  const counter = controls.querySelector('[data-slide-counter]');
  const stepCounter = controls.querySelector('[data-step-counter]');
  const currentTitle = controls.querySelector('[data-slide-title]');
  const keyOutput = controls.querySelector('[data-key-output]');
  const mappingOutput = controls.querySelector('[data-key-mapping]');
  const tester = controls.querySelector('[data-key-tester]');

  document.body.classList.add('presentation-mode');
  registerStageAdapters();
  const initialHash = decodeURIComponent(location.hash.slice(1));
  const initialIndex = slides.findIndex(slide => slide.id === initialHash);
  showSlide(initialIndex >= 0 ? initialIndex : 0, { animate: false, updateHash: false });

  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('click', handleNavigationClick, true);
  window.addEventListener('hashchange', handleHashChange);

  controls.querySelector('[data-slide-previous]').addEventListener('click', performPrevious);
  controls.querySelector('[data-slide-next]').addEventListener('click', performNext);
  controls.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) requestAnimationFrame(() => button.blur());
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && event.detail > 0) requestAnimationFrame(() => button.blur());
    requestAnimationFrame(updatePresentationUi);
  });
  controls.querySelector('[data-key-toggle]').addEventListener('click', event => {
    const isOpen = controls.classList.toggle('key-tester-open');
    tester.hidden = !isOpen;
    event.currentTarget.setAttribute('aria-expanded', String(isOpen));
  });
  controls.querySelectorAll('[data-capture-direction]').forEach(button => {
    button.addEventListener('click', () => {
      captureDirection = button.dataset.captureDirection;
      keyOutput.textContent = `${captureDirection === 'next' ? '다음' : '이전'} 버튼을 한 번 눌러 주세요.`;
      controls.querySelectorAll('[data-capture-direction]').forEach(item => {
        item.classList.toggle('is-capturing', item === button);
      });
      button.blur();
    });
  });
  controls.querySelector('[data-key-reset]').addEventListener('click', () => {
    keyMap = cloneDefaultKeyMap();
    saveKeyMap();
    updateMappingOutput();
    keyOutput.textContent = '기본 키 설정으로 복원했습니다.';
  });

  function handleKeydown(event) {
    const keyId = normalizeKey(event);
    updateKeyTestOutput(event, keyId);

    if (captureDirection) {
      event.preventDefault();
      event.stopImmediatePropagation();
      assignCapturedKey(keyId);
      return;
    }
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isInteractive(event.target) || isInteractive(document.activeElement)) return;

    const direction = directionFor(keyId);
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (now < navigationLockedUntil) return;
    navigationLockedUntil = now + 180;
    if (direction > 0) performNext();
    else performPrevious();
  }

  function handleNavigationClick(event) {
    const tocLink = event.target.closest('#toc a[href^="#"]');
    const jumpButton = event.target.closest('.jump[data-target], .ai-jump[data-target]');
    const targetId = tocLink ? decodeURIComponent(tocLink.hash.slice(1)) : jumpButton?.dataset.target;
    if (!targetId) return;
    const destination = slides.findIndex(slide => slide.id === targetId);
    if (destination < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showSlide(destination);
  }

  function handleHashChange() {
    const targetId = decodeURIComponent(location.hash.slice(1));
    const destination = slides.findIndex(slide => slide.id === targetId);
    if (destination >= 0 && destination !== currentIndex) showSlide(destination, { updateHash: false });
  }

  function performNext() {
    const adapter = stageAdapters.get(slides[currentIndex].id);
    if (adapter && adapter.getStep() < adapter.length) {
      adapter.forward();
      updatePresentationUi();
      return;
    }
    showSlide(currentIndex + 1);
  }

  function performPrevious() {
    const adapter = stageAdapters.get(slides[currentIndex].id);
    if (adapter && adapter.getStep() > 0) {
      adapter.backward();
      updatePresentationUi();
      return;
    }
    showSlide(currentIndex - 1);
  }

  function registerStageAdapters() {
    registerToggleSequence('scarcity', ['#scarcity .reveal'], button => button.nextElementSibling?.classList.contains('open'));
    registerResetSequence('oil-production', '#oil-production .secret', '#oil-production .reset-reveals', button => button.classList.contains('revealed'));
    registerResetSequence('oil-reserves', '#oil-reserves .secret', '#oil-reserves .reset-reveals', button => button.classList.contains('revealed'));
    registerOpenCloseStage('korea-oil', '#revealKorea', '#hideKorea', () => document.querySelector('#koreaAnswer')?.classList.contains('open'));
    registerResetSequence('scarcity-price', '#scarcity-price .price-step', '#resetPriceSteps', button => button.classList.contains('revealed'));
    registerToggleSequence('quiz', '#quizList .quiz-card button', button => button.nextElementSibling?.classList.contains('show'));
    registerStoryStage();
    registerResetSequence('ai-basics', '#ai-basics [data-reveal]', '#ai-basics [data-stage="ai-basics"]', button => button.classList.contains('completed'));
    registerFeatureExamples();
    registerOpenCloseStage('ai-prompt', '#makeBetterPrompt', '#hideBetterPrompt', () => document.querySelector('#goodPrompt')?.classList.contains('open'));
    registerResetSequence('ai-prompt-parts', '#promptParts button', '#resetPromptParts', button => button.classList.contains('revealed'));
    registerAiCheckStage();
  }

  function registerResetSequence(slideId, buttonSelector, resetSelector, isDone) {
    const buttons = [...document.querySelectorAll(buttonSelector)];
    const reset = document.querySelector(resetSelector);
    if (!buttons.length || !reset) return;
    registerAdapter(slideId, {
      length: buttons.length,
      getStep: () => buttons.filter(isDone).length,
      forward() {
        buttons.find(button => !isDone(button))?.click();
      },
      backward() {
        const targetStep = Math.max(0, this.getStep() - 1);
        reset.click();
        for (let index = 0; index < targetStep; index += 1) buttons[index].click();
      }
    });
  }

  function registerToggleSequence(slideId, buttonSelector, isDone) {
    const buttons = typeof buttonSelector === 'string'
      ? [...document.querySelectorAll(buttonSelector)]
      : buttonSelector.map(selector => document.querySelector(selector)).filter(Boolean);
    if (!buttons.length) return;
    registerAdapter(slideId, {
      length: buttons.length,
      getStep: () => buttons.filter(isDone).length,
      forward() {
        buttons.find(button => !isDone(button))?.click();
      },
      backward() {
        [...buttons].reverse().find(isDone)?.click();
      }
    });
  }

  function registerOpenCloseStage(slideId, openSelector, closeSelector, isOpen) {
    const openButton = document.querySelector(openSelector);
    const closeButton = document.querySelector(closeSelector);
    if (!openButton || !closeButton) return;
    registerAdapter(slideId, {
      length: 1,
      getStep: () => Number(Boolean(isOpen())),
      forward: () => openButton.click(),
      backward: () => closeButton.click()
    });
  }

  function registerFeatureExamples() {
    const slide = document.getElementById('ai-assistant');
    const buttons = [...document.querySelectorAll('#ai-assistant .ai-feature-grid button')];
    const output = document.querySelector('#featureExample');
    if (!slide || !buttons.length || !output) return;
    const initialText = output.textContent;
    registerAdapter('ai-assistant', {
      length: buttons.length,
      getStep: () => {
        const activeIndex = buttons.findIndex(button => button.classList.contains('active'));
        return activeIndex + 1;
      },
      forward() {
        buttons[this.getStep()]?.click();
      },
      backward() {
        const targetStep = this.getStep() - 1;
        buttons.forEach(button => button.classList.remove('active'));
        if (targetStep > 0) buttons[targetStep - 1].click();
        else output.textContent = initialText;
      }
    });
  }

  function registerStoryStage() {
    const controller = window.qClassStoryController;
    if (!controller) return;
    registerAdapter('story', {
      length: controller.length,
      getStep: controller.getStep,
      forward: controller.next,
      backward: controller.previous
    });
  }

  function registerAiCheckStage() {
    const correctButton = document.querySelector('#ai-check [data-check="correct"]');
    const choiceButtons = [...document.querySelectorAll('#ai-check .check-choices button')];
    const feedback = document.querySelector('#checkFeedback');
    const strategy = document.querySelector('#strategyChoice');
    if (!correctButton || !feedback || !strategy) return;
    registerAdapter('ai-check', {
      length: 1,
      getStep: () => Number(feedback.classList.contains('open')),
      forward: () => correctButton.click(),
      backward: () => {
        choiceButtons.forEach(button => button.classList.remove('selected'));
        feedback.classList.remove('open');
        strategy.classList.remove('open');
      }
    });
  }

  function registerAdapter(slideId, adapter) {
    if (!document.getElementById(slideId)) return;
    stageAdapters.set(slideId, adapter);
    document.getElementById(slideId).classList.add('has-presentation-stages');
  }

  function showSlide(requestedIndex, options = {}) {
    const destination = Math.max(0, Math.min(slides.length - 1, requestedIndex));
    if (destination === currentIndex && slides[destination].classList.contains('is-active-slide')) {
      updatePresentationUi();
      return;
    }
    const direction = destination >= currentIndex ? 'next' : 'previous';
    currentIndex = destination;
    main.classList.remove('slide-direction-next', 'slide-direction-previous');
    main.classList.add(`slide-direction-${direction}`);
    slides.forEach((slide, index) => {
      const isActive = index === currentIndex;
      slide.classList.toggle('is-active-slide', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      if (isActive) slide.scrollTop = 0;
    });
    main.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    updatePresentationUi();

    if (options.updateHash !== false) history.replaceState(null, '', `#${encodeURIComponent(slides[currentIndex].id)}`);
    if (options.animate === false) {
      slides[currentIndex].classList.add('slide-no-animation');
      requestAnimationFrame(() => slides[currentIndex].classList.remove('slide-no-animation'));
    }
  }

  function updatePresentationUi() {
    const activeSlide = slides[currentIndex];
    const adapter = stageAdapters.get(activeSlide.id);
    const currentStep = adapter?.getStep() || 0;
    const totalSteps = adapter?.length || 0;
    const title = activeSlide.querySelector('h1, h2, h3')?.textContent?.replace(/\s+/g, ' ').trim() || activeSlide.id;
    counter.textContent = `${currentIndex + 1} / ${slides.length}`;
    stepCounter.hidden = totalSteps === 0;
    stepCounter.textContent = totalSteps ? `단계 ${currentStep} / ${totalSteps}` : '';
    currentTitle.textContent = title;
    progress.style.width = `${((currentIndex + 1) / slides.length) * 100}%`;
    controls.querySelector('[data-slide-previous]').disabled = currentIndex === 0 && currentStep === 0;
    controls.querySelector('[data-slide-next]').disabled = currentIndex === slides.length - 1 && currentStep >= totalSteps;
    document.querySelectorAll('#toc a[href^="#"]').forEach(link => {
      const isActive = decodeURIComponent(link.hash.slice(1)) === activeSlide.id;
      link.classList.toggle('active', isActive);
      if (isActive) link.scrollIntoView({ block: 'nearest' });
    });
  }

  function directionFor(keyId) {
    if (keyMap.next.includes(keyId)) return 1;
    if (keyMap.previous.includes(keyId)) return -1;
    return 0;
  }

  function normalizeKey(event) {
    if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') return 'Space';
    return event.key || event.code || 'Unknown';
  }

  function isInteractive(element) {
    return element instanceof Element && Boolean(element.closest(interactiveSelector));
  }

  function updateKeyTestOutput(event, keyId) {
    const recognized = directionFor(keyId);
    const action = recognized > 0 ? '다음 단계' : recognized < 0 ? '이전 단계' : '미연결';
    keyOutput.textContent = `key: ${printableKey(event.key)} · code: ${event.code || '-'} · 동작: ${action}`;
    keyOutput.classList.remove('key-next', 'key-previous', 'key-unmapped');
    keyOutput.classList.add(recognized > 0 ? 'key-next' : recognized < 0 ? 'key-previous' : 'key-unmapped');
  }

  function assignCapturedKey(keyId) {
    if (!keyId || keyId === 'Unknown') return;
    const assignedDirection = captureDirection;
    const otherDirection = assignedDirection === 'next' ? 'previous' : 'next';
    keyMap[otherDirection] = keyMap[otherDirection].filter(key => key !== keyId);
    if (!keyMap[assignedDirection].includes(keyId)) keyMap[assignedDirection].push(keyId);
    captureDirection = null;
    controls.querySelectorAll('[data-capture-direction]').forEach(button => button.classList.remove('is-capturing'));
    saveKeyMap();
    updateMappingOutput();
    keyOutput.textContent = `${printableKey(keyId)} 키를 ${assignedDirection === 'next' ? '다음' : '이전'} 슬라이드에 연결했습니다.`;
  }

  function updateMappingOutput() {
    mappingOutput.textContent = `다음: ${keyMap.next.map(printableKey).join(', ')} | 이전: ${keyMap.previous.map(printableKey).join(', ')}`;
  }

  function printableKey(key) {
    if (key === ' ') return 'Space';
    return key || '-';
  }

  function cloneDefaultKeyMap() {
    return { next: [...defaultKeyMap.next], previous: [...defaultKeyMap.previous] };
  }

  function loadKeyMap() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved?.next) && Array.isArray(saved?.previous)) return saved;
    } catch (error) {
      // 저장된 키 설정이 손상된 경우 기본값을 사용한다.
    }
    return cloneDefaultKeyMap();
  }

  function saveKeyMap() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keyMap));
    } catch (error) {
      // 저장할 수 없는 환경에서도 현재 세션의 키 연결은 유지한다.
    }
  }

  function createPresentationControls() {
    const panel = document.createElement('section');
    panel.className = 'presentation-controls';
    panel.setAttribute('aria-label', '프레젠테이션 컨트롤');
    panel.innerHTML = `
      <div class="presentation-summary">
        <button type="button" data-slide-previous aria-label="이전 단계">‹</button>
        <div><strong data-slide-counter>1 / ${slides.length}</strong><small data-step-counter hidden></small><span data-slide-title></span></div>
        <button type="button" data-slide-next aria-label="다음 단계">›</button>
        <button type="button" class="key-toggle" data-key-toggle aria-expanded="false">키 테스트</button>
      </div>
      <div class="key-tester" data-key-tester hidden>
        <strong>레이저 포인터 키 입력 테스트</strong>
        <p>포인터의 다음/이전 버튼을 눌러 브라우저가 받는 키를 확인하세요.</p>
        <output data-key-output aria-live="polite">아직 입력된 키가 없습니다.</output>
        <small data-key-mapping></small>
        <div>
          <button type="button" data-capture-direction="next">다음 키로 지정</button>
          <button type="button" data-capture-direction="previous">이전 키로 지정</button>
          <button type="button" data-key-reset>기본값 복원</button>
        </div>
      </div>`;
    document.body.append(panel);
    panel.querySelector('[data-key-mapping]').textContent = `다음: ${keyMap.next.map(printableKey).join(', ')} | 이전: ${keyMap.previous.map(printableKey).join(', ')}`;
    return panel;
  }

  function installPresentationStyles() {
    const style = document.createElement('style');
    style.id = 'presentation-mode-styles';
    style.textContent = `
      html, body.presentation-mode { height: 100%; overflow: hidden !important; }
      body.presentation-mode #main { height: 100vh; height: 100dvh; overflow: hidden !important; scroll-behavior: auto !important; position: relative; }
      body.presentation-mode .lesson-section { display: none !important; width: 100%; height: 100%; min-height: 100% !important; max-height: 100%; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
      body.presentation-mode .lesson-section.is-active-slide { display: block !important; animation: slide-in-next .34s cubic-bezier(.22,.7,.25,1) both; }
      body.presentation-mode #main.slide-direction-previous .lesson-section.is-active-slide { animation-name: slide-in-previous; }
      body.presentation-mode .lesson-section.hero.is-active-slide { display: flex !important; }
      body.presentation-mode .lesson-section.concept.is-active-slide { display: grid !important; }
      body.presentation-mode .lesson-section.slide-no-animation { animation: none !important; }
      body.presentation-mode .sidebar nav { overscroll-behavior: contain; }
      body.presentation-mode .scroll-hint { display: none; }
      @keyframes slide-in-next { from { opacity: 0; transform: translate3d(28px,0,0); } to { opacity: 1; transform: none; } }
      @keyframes slide-in-previous { from { opacity: 0; transform: translate3d(-28px,0,0); } to { opacity: 1; transform: none; } }
      .presentation-controls { position: fixed; z-index: 500; right: 18px; bottom: 16px; width: min(440px, calc(100vw - 36px)); color: #293e4b; font-family: Pretendard, "Noto Sans KR", system-ui, sans-serif; filter: drop-shadow(0 10px 24px rgba(20,49,61,.18)); }
      .presentation-summary { margin-left: auto; width: fit-content; max-width: 100%; display: flex; align-items: center; gap: 7px; padding: 7px; border: 1px solid rgba(62,135,147,.2); border-radius: 16px; background: rgba(255,255,255,.94); backdrop-filter: blur(10px); }
      .presentation-summary > div { min-width: 88px; max-width: 180px; display: grid; line-height: 1.15; }
      .presentation-summary strong { font-size: 14px; color: #3e8793; }
      .presentation-summary small { margin-top: 2px; color: #d37f82; font-size: 9px; font-weight: 900; }
      .presentation-summary small[hidden] { display: none; }
      .presentation-summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: #60737b; }
      .presentation-controls button { border: 0; border-radius: 10px; background: #293e4b; color: #fff; min-height: 34px; padding: 7px 11px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
      .presentation-controls button:disabled { opacity: .35; cursor: default; }
      .presentation-summary > button:not(.key-toggle) { width: 34px; padding: 0; font-size: 23px; }
      .presentation-summary .key-toggle { background: #3e8793; }
      .key-tester { margin-top: 8px; padding: 16px; border: 1px solid #d7e6e9; border-radius: 18px; background: rgba(255,255,255,.98); }
      .key-tester[hidden] { display: none; }
      .key-tester > strong { display: block; font-size: 14px; }
      .key-tester p { margin: 5px 0 10px; color: #60737b; font-size: 12px; }
      .key-tester output { display: block; min-height: 42px; padding: 11px; border-radius: 11px; background: #edf8f8; font-size: 12px; font-weight: 800; word-break: break-word; }
      .key-tester output.key-next { background: #e4f7ed; }
      .key-tester output.key-previous { background: #fff5d8; }
      .key-tester output.key-unmapped { background: #f6eef1; }
      .key-tester small { display: block; margin: 8px 0; color: #71858d; line-height: 1.45; }
      .key-tester > div { display: flex; flex-wrap: wrap; gap: 6px; }
      .key-tester button.is-capturing { background: #d37f82; animation: key-capture-pulse 1s infinite; }
      @keyframes key-capture-pulse { 50% { transform: scale(.97); opacity: .78; } }
      @media (min-width: 761px) and (max-height: 900px) {
        body.presentation-mode .lesson-section:not(.game-section):not(.story-section) { padding: clamp(24px, 4vh, 46px) clamp(30px, 5vw, 82px) 68px; }
        body.presentation-mode .lecture h2,
        body.presentation-mode .results-section h2 { font-size: clamp(34px, 6.4vh, 58px); margin: 6px 0 clamp(18px, 3vh, 30px); }
        body.presentation-mode .rule-grid,
        body.presentation-mode .steps,
        body.presentation-mode .item-showcase { gap: 13px; }
        body.presentation-mode .rule-grid article,
        body.presentation-mode .steps article,
        body.presentation-mode .item-showcase article { padding: clamp(17px, 2.7vh, 24px); }
        body.presentation-mode .rule-grid article { min-height: 0; }
        body.presentation-mode .rule-grid i,
        body.presentation-mode .item-showcase i { font-size: clamp(38px, 6vh, 52px); }
        body.presentation-mode .rule-grid b { margin: 12px 0 6px; }
        body.presentation-mode .rule-grid p,
        body.presentation-mode .steps p,
        body.presentation-mode .item-showcase p { margin-top: 7px; line-height: 1.45; }
        body.presentation-mode .quiz-list { gap: 12px; }
        body.presentation-mode .quiz-card { padding: 17px 24px; }
        body.presentation-mode .story-section { padding: 24px 30px 62px; }
        body.presentation-mode .cinema { height: min(64vh, 560px); }
        body.presentation-mode .game-section { padding: 16px 18px 64px; }
        body.presentation-mode .game-shell { min-height: calc(100vh - 80px); padding: 18px; }
      }
      @media (min-width: 1200px) and (min-height: 700px) and (max-height: 900px) {
        body.presentation-mode .game-section { overflow-y: hidden; }
      }
      @media (max-width: 760px) {
        body.presentation-mode #main { height: 100dvh !important; overflow: hidden !important; }
        body.presentation-mode .lesson-section { min-height: 100% !important; height: 100% !important; padding-bottom: 86px; }
        .presentation-controls { right: 10px; bottom: 9px; width: min(410px, calc(100vw - 20px)); }
        .presentation-summary > div { max-width: 120px; }
      }
      @media (prefers-reduced-motion: reduce) { body.presentation-mode .lesson-section.is-active-slide { animation: none !important; } }`;
    document.head.append(style);
  }
})();
