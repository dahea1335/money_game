(() => {
  const renderedGame = renderGame;

  const syncEscapeOrder = gameNumber => {
    const teams = games[gameNumber].teams;
    let changed = false;
    let nextOrder = teams.reduce((max, team) => {
      const order = Number(team.escapeOrder);
      return team.escaped && Number.isInteger(order) && order > 0 ? Math.max(max, order) : max;
    }, 0);

    teams.forEach(team => {
      if (!team.escaped && Object.prototype.hasOwnProperty.call(team, 'escapeOrder')) {
        delete team.escapeOrder;
        changed = true;
      }
    });
    teams.forEach(team => {
      const order = Number(team.escapeOrder);
      if (team.escaped && (!Number.isInteger(order) || order < 1)) {
        team.escapeOrder = ++nextOrder;
        changed = true;
      }
    });
    return changed;
  };

  const resultData = gameNumber => {
    if (syncEscapeOrder(gameNumber)) save();
    const eligibilityOrder = games[gameNumber].teams
      .map((team, index) => ({ team, index }))
      .filter(entry => entry.team.escaped)
      .sort((a, b) => (a.team.escapeOrder - b.team.escapeOrder) || (a.index - b.index));
    const eligible = new Set(
      eligibilityOrder.slice(0, 2).map(entry => entry.index)
    );

    return games[gameNumber].teams.map((team, index) => {
      const fireworks = Math.max(0, Math.floor(Number(team.items.firework) || 0));
      const bonus = team.escaped && eligible.has(index) ? fireworks * 5 : 0;
      return {
        i: index,
        t: team,
        endMoney: Number(team.money) || 0,
        fireworks,
        bonus,
        finalMoney: (Number(team.money) || 0) + bonus,
        escapeOrder: team.escaped ? Number(team.escapeOrder) : Number.MAX_SAFE_INTEGER,
        teamOrder: index
      };
    });
  };

  rank = gameNumber => resultData(gameNumber).sort((a, b) =>
    (Number(b.t.escaped) - Number(a.t.escaped)) ||
    (b.finalMoney - a.finalMoney) ||
    (a.escapeOrder - b.escapeOrder) ||
    (a.teamOrder - b.teamOrder));

  renderResults = gameNumber => {
    const board = document.querySelector('#resultBoard');
    if (!board) return;
    board.innerHTML = rank(gameNumber).map((entry, position) => `
      <article class="result-row ${position === 0 && entry.t.escaped ? 'winner' : ''}">
        <div class="result-team">
          <b>${position === 0 && entry.t.escaped ? '🏆 ' : ''}${position + 1}위 · ${esc(entry.t.name)}</b>
          <span class="escape-state ${entry.t.escaped ? 'success' : ''}">${entry.t.escaped ? `선착순 ${entry.escapeOrder}번째 탈출` : '탈출 실패'}</span>
        </div>
        <div class="result-money-breakdown">
          <span>게임 종료 잔액 <b>${entry.endMoney}</b></span>
          <span>폭죽 교환 보너스 <b>+${entry.bonus}</b></span>
          <strong>최종 ${entry.finalMoney}머니</strong>
        </div>
      </article>`).join('');
  };

  const decorateBonusRule = gameNumber => {
    const root = document.querySelector(`#game${gameNumber} .game-shell`);
    if (!root) return;

    root.querySelectorAll('.item-toggle[data-item="firework"]').forEach(button => {
      const control = button.closest('.item-control');
      if (!control || control.querySelector('.bonus-chip')) return;
      control.classList.add('firework-bonus-control');
      const chip = document.createElement('small');
      chip.className = 'bonus-chip';
      chip.textContent = 'BONUS';
      control.append(chip);
      button.title = '폭죽 기록/취소 · 선착순 탈출 성공 2팀은 종료 후 1개당 5머니';
    });

    const status = root.querySelector('.game-status');
    if (status) {
      status.firstElementChild.textContent = '탈출 필수 도구: 물 · 통조림 · 성냥 · 뗏목';
      const note = document.createElement('div');
      note.className = 'firework-bonus-note';
      note.innerHTML = '<b>보너스 아이템: 폭죽 🎆</b><span>선착순 탈출 성공 2팀만 게임 종료 후 1개당 5머니 · 탈출 실패 시 보너스 없음</span>';
      status.before(note);
    }
  };

  renderGame = gameNumber => {
    const changedBeforeRender = syncEscapeOrder(gameNumber);
    renderedGame(gameNumber);
    const changedAfterRender = syncEscapeOrder(gameNumber);
    if (changedBeforeRender || changedAfterRender) save();
    decorateBonusRule(gameNumber);
    renderResults(currentResult);
  };

  renderGame(1);
  renderGame(2);
  renderResults(currentResult);
})();
