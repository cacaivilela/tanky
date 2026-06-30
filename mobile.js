// ============================================================
//  TANKY — Edição de Celular
//  Escala o jogo (1000x600) para caber na tela + controles de toque.
//  Reaproveita as variáveis globais de game.js (game, keys, fire, etc.).
// ============================================================
(function () {
  const wrap = document.getElementById('game-wrap');
  const body = document.body;

  // ---- Detecta se a tela é de toque (celular/tablet) ----
  const isTouch = ('ontouchstart' in window) ||
    navigator.maxTouchPoints > 0 ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (isTouch) body.classList.add('is-touch');

  // ---- Escala o jogo para caber em qualquer tela (nunca aumenta além de 1) ----
  function fitScale() {
    const s = Math.min(1, window.innerWidth / 1000, window.innerHeight / 600);
    wrap.style.transform = 'scale(' + s + ')';
  }
  fitScale();
  window.addEventListener('resize', fitScale);
  window.addEventListener('orientationchange', () => setTimeout(fitScale, 60));

  if (!isTouch) return; // o resto só faz sentido em telas de toque

  // ---- Mostra os controles de toque só durante a batalha ----
  function inBattle() {
    return !!(game && game.state !== 'over' &&
      document.getElementById('overlay').classList.contains('hidden'));
  }
  setInterval(() => body.classList.toggle('in-game', inBattle()), 120);

  // O jogador humano pode comandar agora? (sua vez, mirando ou no Turbo)
  function canControl() {
    return !!(game &&
      (game.state === 'aiming' || game.state === 'turbo') &&
      !game.tanks[game.current].isAI);
  }

  const tc = document.getElementById('touch-controls');

  // Botões de "segurar" (setas de mira/movimento e acelerar): mantêm
  // uma tecla pressionada enquanto o dedo está sobre o botão.
  tc.querySelectorAll('[data-hold]').forEach(btn => {
    const key = btn.dataset.hold;
    const press = (e) => {
      e.preventDefault();
      if (key === 'v') fastForward = true; else keys[key] = true;
      btn.classList.add('on');
    };
    const release = (e) => {
      if (e) e.preventDefault();
      if (key === 'v') fastForward = false; else keys[key] = false;
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  // Trocar de arma (← / →)
  tc.querySelectorAll('[data-weap]').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (canControl() && game.state === 'aiming') cycleWeapon(+btn.dataset.weap);
    });
  });

  // FOGO: segura para carregar a potência, solta para atirar (igual à barra de espaço)
  const fireBtn = document.getElementById('tc-fire');
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (canControl() && game.state === 'aiming' && !game.charging) {
      game.charging = true;
      game.power = 0;
      fireBtn.classList.add('on');
    }
  });
  const doFire = (e) => {
    if (e) e.preventDefault();
    if (game && game.charging && game.state === 'aiming') fire();
    fireBtn.classList.remove('on');
  };
  fireBtn.addEventListener('pointerup', doFire);
  fireBtn.addEventListener('pointercancel', doFire);
  fireBtn.addEventListener('contextmenu', e => e.preventDefault());
})();
