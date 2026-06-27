// ============================================================
//  TANKY — Pixel art "na mão"
//  Cada ícone é uma grade desenhada pixel por pixel: cada linha
//  é uma string, cada caractere aponta para uma cor da paleta
//  ('.' = transparente). Nada de emojis — tudo carimbado em
//  retângulos no canvas (ou rasterizado para <img> no HUD).
// ============================================================

const ICONS = {
  // ---- Tiro Normal: bala de canhão azul ----
  shot: {
    pal: { b: '#3b82f6', l: '#bfdbfe', o: '#1e3a8a' },
    px: [
      '...bbb...',
      '..bbbbb..',
      '.bblbbbb.',
      'bbllbbbbo',
      'bbbbbbbbo',
      'bbbbbbbbo',
      'obbbbbboo',
      '.obbbbbo.',
      '...ooo...',
    ],
  },

  // ---- Bomba Pesada: bomba redonda com pavio aceso ----
  bomb: {
    pal: { k: '#1f2937', g: '#4b5563', f: '#f59e0b', r: '#ef4444', y: '#fde047' },
    px: [
      '..........y.',
      '.........ryr',
      '..........y.',
      '........f...',
      '.......f....',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '.kkkkkkkkkk.',
      '.kkgkkkkkkk.',
      '.kkkkkkkkkk.',
      '..kkkkkkkk..',
      '...kkkkkk...',
    ],
  },

  // ---- Cluster: alvo concêntrico ----
  cluster: {
    pal: { r: '#ef4444', w: '#ffffff', k: '#7f1d1d' },
    px: [
      'rrrrrrrrr',
      'r.......r',
      'r.wwwww.r',
      'r.w...w.r',
      'r.w.k.w.r',
      'r.w...w.r',
      'r.wwwww.r',
      'r.......r',
      'rrrrrrrrr',
    ],
  },

  // ---- Bomba Relógio: relógio de pé ----
  clock: {
    pal: { k: '#1f2937', w: '#e5f2ff', r: '#ef4444' },
    px: [
      '...kkkk...',
      '.kwwwwwwk.',
      'kwwwwwwwwk',
      'kwwwwkwwwk',
      'kwwwwkwwwk',
      'kwwrrkwwwk',
      'kwwwwwwwwk',
      'kwwwwwwwwk',
      '.kwwwwwwk.',
      '...kkkk...',
      '..k....k..',
    ],
  },

  // ---- Bombroca: tachinha / dardo ----
  dart: {
    pal: { r: '#e11d48', s: '#9ca3af', l: '#fb7185' },
    px: [
      '..rrrr...',
      '.rrrrrr..',
      '.rlrrrr..',
      '.rrrrrr..',
      '..rrrr...',
      '...ss....',
      '...ss....',
      '...ss....',
      '....s....',
      '....s....',
    ],
  },

  // ---- Saltitante: bola quicando ----
  bounce: {
    pal: { g: '#84cc16', d: '#4d7c0f', w: '#ecfccb' },
    px: [
      '...ggggg...',
      '..ggggggg..',
      '.gggwggggg.',
      '.ggggggggg.',
      '.ggggggggg.',
      '..ggggggg..',
      '...ggggg...',
      '...........',
      '.w..w..w...',
      'w..w..w....',
    ],
  },

  // ---- Bombardeio: nuvem com chuva ----
  rain: {
    pal: { w: '#e2e8f0', g: '#94a3b8', b: '#38bdf8' },
    px: [
      '....wwww....',
      '..wwwwwwww..',
      '.wwwwwwwwww.',
      'gggggggggggg',
      '............',
      '.b...b...b..',
      'b...b...b...',
      '.b...b...b..',
      'b...b...b...',
      '............',
    ],
  },

  // ---- Napalm: chama ----
  flame: {
    pal: { r: '#dc2626', o: '#f97316', y: '#fde047' },
    px: [
      '....y.....',
      '...yy.....',
      '...oyo....',
      '..ooyoo...',
      '..oyyyo...',
      '.rooyooo..',
      '.rooyooor.',
      '.roooooor.',
      '.rrooorr..',
      '..rroorr..',
      '...rrrr...',
    ],
  },

  // ---- Soprador: rajadas de vento ----
  wind: {
    pal: { c: '#67e8f9' },
    px: [
      '.ccccccc...',
      'cc.....cc..',
      '.....ccc...',
      '.ccccccc...',
      'cc....cc...',
      '....ccccc..',
      '.cccccc....',
      '......cc...',
      '.cccccc....',
    ],
  },

  // ---- Turbo: foguete ----
  rocket: {
    pal: { w: '#e5e7eb', g: '#9ca3af', r: '#ef4444', b: '#60a5fa', f: '#f97316', y: '#fde047' },
    px: [
      '.....r.....',
      '....www....',
      '....www....',
      '...wwwww...',
      '...wwbww...',
      '...wwbww...',
      '...wwwww...',
      '..wwwwwww..',
      '.rwwwwwwwr.',
      'rr..www..rr',
      '....f.f....',
      '.....y.....',
    ],
  },

  // ---- Galão de combustível (ícone reserva, sem uso no momento) ----
  fuel: {
    pal: { g: '#16a34a', d: '#166534', l: '#86efac', k: '#0f3d23' },
    px: [
      '..kk......',
      '.kggk.....',
      'kgggk.....',
      'kgggggggk.',
      'kglgggggk.',
      'kgggggggk.',
      'kglgggggk.',
      'kgggggggk.',
      'kgggggggk.',
      'kgggggggk.',
      '.kkkkkkkk.',
    ],
  },

  // ---- Ímã: ferradura ----
  magnet: {
    pal: { r: '#dc2626', s: '#cbd5e1', k: '#7f1d1d' },
    px: [
      'ss....ss..',
      'rr....rr..',
      'rr....rr..',
      'rr....rr..',
      'rr....rr..',
      'rrr..rrr..',
      '.rr..rr...',
      '.rrrrrr...',
      '..rrrr....',
    ],
  },

  // ---- Caveira (tanque destruído) ----
  skull: {
    pal: { w: '#e5e7eb', s: '#9ca3af', k: '#1f2937' },
    px: [
      '..wwwww..',
      '.wwwwwww.',
      'wwwwwwwww',
      'wkkwwwkkw',
      'wkkwwwkkw',
      'wwwwkwwww',
      'wwwwwwwww',
      '.wkwkwkw.',
      '..w.w.w..',
    ],
  },

  // ---- Troféu (vitória) ----
  trophy: {
    pal: { g: '#fbbf24', d: '#b45309', l: '#fde68a', k: '#78350f' },
    px: [
      '.ggggggg...',
      'g.ggggg.g..',
      'gg.ggggg.gg',
      'gg.ggggg.gg',
      '.g.ggggg.g.',
      '..ggggggg..',
      '...ggggg...',
      '....ggg....',
      '....ggg....',
      '...ddddd...',
      '..ddddddd..',
      '.ddddddddd.',
    ],
  },

  // ---- Espadas cruzadas (subtítulo) ----
  swords: {
    pal: { s: '#cbd5e1', g: '#b45309' },
    px: [
      'ss.......ss',
      '.ss.....ss.',
      '..ss...ss..',
      '...ss.ss...',
      '....sss....',
      '....sss....',
      '...ss.ss...',
      '..gs...sg..',
      '.gg.....gg.',
      'gg.......gg',
    ],
  },

  // ---- Duas pessoas (2 jogadores) ----
  people: {
    pal: { a: '#fcd34d', b: '#3b82f6', c: '#22c55e' },
    px: [
      '..a.....a..',
      '.aaa...aaa.',
      '..a.....a..',
      '.bbbb.cccc.',
      'bbbbb.ccccc',
      'bbbbb.ccccc',
      'bbbbb.ccccc',
      '.bbbb.cccc.',
      '.bb.b.c.cc.',
      '.b..b.c..c.',
    ],
  },

  // ---- Robô (VS COM) ----
  robot: {
    pal: { m: '#94a3b8', d: '#475569', e: '#38bdf8', r: '#ef4444', k: '#1f2937' },
    px: [
      '.....r.....',
      '.....k.....',
      '..mmmmmmm..',
      '.mmmmmmmmm.',
      '.mmeemeemm.',
      '.mmmmmmmmm.',
      '.mdddddddm.',
      '.mmmmmmmmm.',
      '..mmmmmmm..',
      '.mm.....mm.',
      'm.........m',
    ],
  },

  // ---- Moeda (loja DLC) ----
  coin: {
    pal: { g: '#fbbf24', d: '#b45309', l: '#fff7cc' },
    px: [
      '..ggggg..',
      '.gddddgg.',
      'gglggggdg',
      'gdlllgddg',
      'gglggggdg',
      'gggggdddg',
      'gggdddddg',
      '.gddddgg.',
      '..ggggg..',
    ],
  },

  // ---- Cadeado (conteúdo bloqueado) ----
  lock: {
    pal: { y: '#fbbf24', k: '#374151', d: '#111827' },
    px: [
      '..yyyy..',
      '.y....y.',
      '.y....y.',
      'kkkkkkkk',
      'kkkkkkkk',
      'kkkddkkk',
      'kkkddkkk',
      'kkkkkkkk',
      'kkkkkkkk',
    ],
  },

  // ---- Buraco Negro (arma DLC) ----
  blackhole: {
    pal: { p: '#c084fc', v: '#7c3aed', k: '#0a0a0a' },
    px: [
      '...ppppp...',
      '..pvvvvvp..',
      '.pvkkkkkvp.',
      'pvkkkkkkkvp',
      'pvkkkkkkkvp',
      'pvkkkkkkkvp',
      'pvkkkkkkkvp',
      'pvkkkkkkkvp',
      '.pvkkkkkvp.',
      '..pvvvvvp..',
      '...ppppp...',
    ],
  },

  // ---- Meteoro (arma DLC) ----
  meteor: {
    pal: { r: '#9a3412', o: '#f97316', y: '#fde047', d: '#451a03' },
    px: [
      '.......yoo.',
      '......yooo.',
      '.....oodd..',
      '....oddd...',
      '...oddrd...',
      '..oddrrd...',
      '.yorrrr....',
      'yoorr......',
      'oor........',
      'o..........',
    ],
  },

  // ---- Ogiva Nuclear (arma DLC) ----
  nuke: {
    pal: { y: '#fde047', k: '#1f2937' },
    px: [
      '...kkkkk...',
      '..kyyyyyk..',
      '.kyyykyyyk.',
      '.kyykkkyyk.',
      '.kykkkkkyk.',
      '.kyykkkyyk.',
      '.kyyykyyyk.',
      '.kyyyyyyyk.',
      '..kyyyyyk..',
      '...kkkkk...',
      '....kkk....',
    ],
  },

  // ---- Ctrl + D (arma Sandbox: tecla com a letra D) ----
  ctrld: {
    pal: { k: '#1f2937', w: '#e5e7eb', r: '#f43f5e' },
    px: [
      'kkkkkkkkkkk',
      'kwwwwwwwwwk',
      'kwwrrrr.wwk',
      'kwwrr..rwwk',
      'kwwrr..rwwk',
      'kwwrr..rwwk',
      'kwwrr..rwwk',
      'kwwrrrr.wwk',
      'kwwwwwwwwwk',
      'kkkkkkkkkkk',
    ],
  },

  // ---- Tanque (marcador de jogador) — cor pela paleta { C } ----
  tank: {
    pal: { C: '#22c55e', t: '#241a33', k: '#140a1e', w: '#4b3b63' },
    px: [
      '....kkk....',
      '...kCCCk...',
      '..kCCCCCkkk',
      '.kCCCCCCCk.',
      '.kCCCCCCCk.',
      '.kttttttk..',
      '.wwwwwwww..',
      '..k.kk.k...',
    ],
  },
};

// Carimba o ícone no canvas, centrado em (cx, cy), cada célula = um
// retângulo de lado `scale`. Calcula as bordas em inteiros para não
// deixar costuras entre os pixels.
function drawPixelIcon(ctx, name, cx, cy, scale, opts = {}) {
  const ic = ICONS[name];
  if (!ic) return;
  const px = ic.px;
  const pal = opts.palette ? { ...ic.pal, ...opts.palette } : ic.pal;
  const h = px.length;
  const w = px[0].length;
  const flip = !!opts.flip;
  const ox = cx - (w * scale) / 2;
  const oy = cy - (h * scale) / 2;

  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  for (let r = 0; r < h; r++) {
    const row = px[r];
    const y0 = Math.round(oy + r * scale);
    const y1 = Math.round(oy + (r + 1) * scale);
    for (let c = 0; c < w; c++) {
      const ch = row[flip ? (w - 1 - c) : c];
      const col = pal[ch];
      if (!col) continue;
      const x0 = Math.round(ox + c * scale);
      const x1 = Math.round(ox + (c + 1) * scale);
      ctx.fillStyle = col;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.restore();
}

// ---- Rasterização para o HUD/DOM (cacheada) ----
const _iconURLCache = {};

function pixelIconDataURL(name, scale = 3, opts = {}) {
  const ic = ICONS[name];
  if (!ic) return '';
  const key = name + '|' + scale + '|' + (opts.palette ? JSON.stringify(opts.palette) : '');
  if (_iconURLCache[key]) return _iconURLCache[key];

  const w = ic.px[0].length;
  const h = ic.px.length;
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  drawPixelIcon(cv.getContext('2d'), name, cv.width / 2, cv.height / 2, scale, opts);
  const url = cv.toDataURL();
  _iconURLCache[key] = url;
  return url;
}

// HTML de uma <img> com o ícone (para colocar dentro de textos do HUD)
function pixelIconImg(name, scale = 3, cls = 'pxicon', opts = {}) {
  return `<img class="${cls}" src="${pixelIconDataURL(name, scale, opts)}" alt="">`;
}

// Preenche cada placeholder <span data-icon="..."> da página com seu ícone
function fillIconPlaceholders(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    const name = el.getAttribute('data-icon');
    if (!ICONS[name]) continue;
    const scale = parseInt(el.getAttribute('data-scale') || '3', 10);
    const color = el.getAttribute('data-color');
    const opts = color ? { palette: { C: color } } : {};
    el.innerHTML = pixelIconImg(name, scale, 'pxicon', opts);
  }
}
