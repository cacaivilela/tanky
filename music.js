// ============================================================
//  TANKY — Música de fundo (chiptune gerado por código)
//  Web Audio API: sem arquivos de áudio, funciona offline.
//  Toca um loop alegre estilo 8-bit; botão liga/desliga.
// ============================================================
(function () {
  const KEY = 'tanky_music_on';

  // Frequências das notas (Hz)
  const N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25,
  };

  // Melodia (colcheias) — 4 compassos sobre C · G · Am · F
  const MELODY = [
    'E4','G4','C5','G4','E4','G4','C5','E5',
    'D4','G4','B4','G4','D4','G4','B4','D5',
    'C4','E4','A4','E4','C4','E4','A4','C5',
    'C4','F4','A4','F4','C4','F4','A4','G4',
  ];
  // Baixo (raiz dos acordes, com pausas)
  const BASS = [
    'C3', 0, 'G3', 0, 'C3', 0, 'G3', 0,
    'G3', 0, 'D3', 0, 'G3', 0, 'D3', 0,
    'A3', 0, 'E3', 0, 'A3', 0, 'E3', 0,
    'F3', 0, 'C3', 0, 'F3', 0, 'C3', 0,
  ];

  const TEMPO = 132;                 // batidas por minuto
  const STEP = 60 / TEMPO / 2;       // duração de uma colcheia (s)
  const VOLUME = 0.35;               // volume geral (0..1)

  let ctx = null, master = null;
  let playing = false;
  let enabled = localStorage.getItem(KEY) !== 'off'; // ligado por padrão
  let timer = null, nextTime = 0, step = 0;

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }

  // Toca uma nota curta (envelope com ataque rápido e decaimento)
  function blip(note, time, dur, type, vol) {
    const freq = typeof note === 'string' ? N[note] : note;
    if (!freq) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g); g.connect(master);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  // Agendador com janela de antecipação (lookahead)
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.12) {
      blip(MELODY[step % MELODY.length], nextTime, STEP * 0.9, 'square', 0.10);
      blip(BASS[step % BASS.length], nextTime, STEP * 1.7, 'triangle', 0.16);
      nextTime += STEP;
      step++;
    }
    timer = setTimeout(scheduler, 25);
  }

  function start() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (playing) return;
    playing = true;
    nextTime = ctx.currentTime + 0.06;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 0.6);
    scheduler();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearTimeout(timer);
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    }
  }

  function updateBtn() {
    const b = document.getElementById('music-toggle');
    if (b) {
      b.textContent = enabled ? '🔊' : '🔇';
      b.title = enabled ? 'Música: ligada' : 'Música: desligada';
    }
  }

  function setEnabled(on) {
    enabled = on;
    localStorage.setItem(KEY, on ? 'on' : 'off');
    if (on) start(); else stop();
    updateBtn();
  }

  // Navegadores só deixam tocar som após uma interação do usuário
  function firstGesture(e) {
    if (e && e.target && e.target.closest && e.target.closest('#music-toggle')) return;
    if (enabled) start();
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  }
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  function wireBtn() {
    const b = document.getElementById('music-toggle');
    if (!b) return;
    updateBtn();
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      setEnabled(!enabled);
    });
  }
  if (document.readyState !== 'loading') wireBtn();
  else document.addEventListener('DOMContentLoaded', wireBtn);

  window.TankyMusic = { start, stop, setEnabled, isEnabled: () => enabled };
})();
