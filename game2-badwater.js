(() => {
  const originalRenderGame = renderGame;

  const cleanLegacyWaterDrawData = () => {
    const game = games[2];
    let changed = false;

    if (Object.prototype.hasOwnProperty.call(game, 'waterPool')) {
      delete game.waterPool;
      changed = true;
    }

    game.teams.forEach(team => {
      if (Object.prototype.hasOwnProperty.call(team.items, 'dentedWater')) {
        team.items.badWater = Number(team.items.dentedWater) || 0;
        delete team.items.dentedWater;
        changed = true;
      }
      if (!Number.isFinite(Number(team.items.badWater))) {
        team.items.badWater = 0;
        changed = true;
      }
    });

    return changed;
  };

  const updateBadWater = (teamIndex, value) => {
    const team = games[2].teams[teamIndex];
    snapshot(2);
    team.items.badWater = Math.max(0, Math.floor(Number(value) || 0));
    save();
    renderGame(2);
  };

  const enhanceGame2 = () => {
    const root = document.querySelector('#game2 .game-shell');
    if (!root) return;

    root.querySelectorAll('.team-card').forEach((card, teamIndex) => {
      const team = games[2].teams[teamIndex];
      const waterControl = card.querySelector('.item-toggle[data-item="water"]')?.closest('.item-control');
      if (!waterControl) return;

      const quantity = Math.max(0, Math.floor(Number(team.items.badWater) || 0));
      const badWaterControl = document.createElement('div');
      badWaterControl.className = 'item-control bad-water-control';
      badWaterControl.innerHTML = `
        <button class="item-toggle ${quantity > 0 ? 'owned' : ''}" data-item="badWater" type="button" title="불량 물 기록/취소">
          <span class="bad-water-icon">🧴</span><span>불량 물</span>
        </button>
        <label>수량<input class="item-qty" data-item="badWater" type="number" min="0" value="${quantity}" aria-label="${esc(team.name)} 불량 물 수량"></label>`;

      waterControl.after(badWaterControl);

      badWaterControl.querySelector('.item-toggle').addEventListener('click', () => {
        updateBadWater(teamIndex, quantity > 0 ? 0 : 1);
      });
      badWaterControl.querySelector('.item-qty').addEventListener('change', event => {
        updateBadWater(teamIndex, event.target.value);
      });
    });

    const note = document.createElement('div');
    note.className = 'game2-record-note';
    note.textContent = '2차 게임에서는 학생들이 실제 카드를 뽑습니다. 정상 물과 불량 물 결과를 각 팀 카드에 직접 기록하세요.';
    root.querySelector('.game-status').before(note);
  };

  renderGame = function patchedGame2Render(gameNumber) {
    originalRenderGame(gameNumber);
    if (gameNumber === 2) enhanceGame2();
  };

  if (cleanLegacyWaterDrawData()) save();
  renderGame(2);
})();
