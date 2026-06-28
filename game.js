// ============================================================
//  TANKY — Batalha de Tanques por Turnos
//  Canvas puro, sem dependências. Terreno destrutível real.
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW_W = canvas.width;   // tamanho visível na tela (viewport)
const VIEW_H = canvas.height;
let W = 2200;                  // largura do MUNDO (recalculada por modo: mais tanques = mapa maior)
const H = VIEW_H * 4;          // altura do MUNDO: 4x mais fundo que a tela

// Cores de cada time (0 = verde à esquerda, 1 = vermelho à direita)
const TEAM_COLORS = ['#22c55e', '#ef4444'];
const MAX_PER_TEAM = 43;       // limite do modo Giga Battle

// Fase "Plataforma": altura da fileira de terra (time de cima) e do piso (time de baixo)
const PLAT_Y = Math.round(VIEW_H * 4 * 0.22);
const PLAT_H = 46;
const FLOOR_Y = Math.round(VIEW_H * 4 * 0.40);

// Terreno em canvas próprio (offscreen) para destruição por pixel
const terrain = document.createElement('canvas');
terrain.width = W;
terrain.height = H;
const tctx = terrain.getContext('2d');

let GRAVITY = 0.25;            // ajustada por cenário/modo (gravidade da Lua, etc.)

// Cenário corrente para a renderização (céu, terreno) — vale também no menu
let renderScene = SCENES.dia;
// Arenas (layout do mapa) disponíveis
const ARENAS = {
  padrao: { id: 'padrao', name: 'Padrão' },
  plataforma: { id: 'plataforma', name: 'Plataforma' },
};
let renderArena = ARENAS.padrao;
// Seleção atual do jogador (cenário, modo, arena e skins por time)
const loadout = { scene: 'dia', mode: 'normal', arena: 'padrao', skins: ['classic', 'classic'] };

// Câmera 2D — acompanha a ação na horizontal e na vertical
const cam = { x: 0, y: 0, targetX: 0, targetY: 0 };

// ---------- Armas ----------
const WEAPONS = [
  { name: 'Tiro Normal', icon: 'shot', radius: 34, damage: 35, color: '#60a5fa', cluster: 0 },
  { name: 'Bomba Pesada', icon: 'bomb', radius: 52, damage: 55, color: '#f97316', cluster: 0 },
  { name: 'Cluster', icon: 'cluster', radius: 22, damage: 22, color: '#a78bfa', cluster: 5 },
  { name: 'Bomba Relógio', icon: 'clock', radius: 192, damage: 65, color: '#22d3ee', cluster: 0, timed: true },
  { name: 'Bombroca (Dardo)', icon: 'dart', radius: 48, damage: 40, color: '#e879f9', cluster: 0, dart: true },
  { name: 'Saltitante', icon: 'bounce', radius: 38, damage: 36, color: '#84cc16', cluster: 0, bounce: 3 },
  { name: 'Bombardeio', icon: 'rain', radius: 30, damage: 24, color: '#38bdf8', cluster: 0, airstrike: 6 },
  { name: 'Napalm', icon: 'flame', radius: 40, damage: 30, color: '#f97316', cluster: 10, napalm: true },
  { name: 'Soprador', icon: 'wind', radius: 52, damage: 8, color: '#67e8f9', cluster: 0, knockback: 4, windBlast: true },
  { name: 'Turbo', icon: 'rocket', radius: 32, damage: 0, color: '#fb7185', cluster: 0, turbo: true },
  { name: 'Ímã', icon: 'magnet', radius: 36, damage: 38, color: '#cbd5e1', cluster: 0, magnet: true },
];

// ---------- Estado do jogo ----------
let game = null;

class Tank {
  constructor(x, color, name, facing) {
    this.x = x;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;   // velocidade horizontal (propulsão do Turbo)
    this.color = color;
    this.name = name;
    this.team = 0;              // 0 ou 1 (definido ao montar a batalha)
    this.skin = 'classic';     // visual (DLC de skins)
    this.maxHealth = 100;      // varia conforme o modo de jogo
    this.health = 100;
    this.angle = facing > 0 ? 45 : 135; // graus, medido a partir do eixo +x
    this.facing = facing;               // 1 = mira p/ direita, -1 p/ esquerda
    this.fuel = 100;
    this.alive = true;
    this.isAI = false;
    this.noFall = false; // imune a dano de queda (durante o voo do Turbo)
    this.roll = 0;       // rotação da caveira ao rolar
    this.rollV = 0;
    this.rested = false; // caveira já parou de rolar
  }
  get barrelTip() {
    const rad = this.angle * Math.PI / 180;
    return {
      x: this.x + Math.cos(rad) * 26,
      y: this.y - 12 - Math.sin(rad) * 26,
    };
  }
}

class Projectile {
  constructor(x, y, vx, vy, weapon, power = 1) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.weapon = weapon;
    this.power = power;                              // potência carregada (0..1)
    this.alive = true;
    this.trail = [];
    this.spin = 0;                                  // rotação acumulada
    this.spinV = (Math.random() * 2 - 1) * 0.25 + 0.25; // velocidade do giro
    this.bounces = 0;                               // quiques já dados (Saltitante)
    this.rocketFuel = weapon.rocket ? 30 : 0;       // frames de propulsão (Turbo)
    // Míssil teleguiado (Ímã): 100% preciso — sem erro de mira
    this.aimErrX = 0;
    this.aimErrY = 0;
  }
}

class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
  }
}

// ============================================================
//  Geração de terreno
// ============================================================
function generateTerrain() {
  tctx.clearRect(0, 0, W, H);

  if (renderArena.id === 'plataforma') { generatePlatformTerrain(); return; }

  // Heightmap mais plano: leves ondulações sobre um chão baixo,
  // deixando bastante profundidade de terra abaixo da superfície.
  const points = [];
  const base = H * 0.52;        // superfície mais baixa = mais terra abaixo
  const minSurf = H * 0.2;
  const maxSurf = H * 0.78;
  const seedA = Math.random() * 10;
  const seedB = Math.random() * 10;
  const seedC = Math.random() * 10;
  for (let x = 0; x <= W; x++) {
    const t = x / W;
    let h = base
      + Math.sin(t * Math.PI * 3 + seedA) * (H * 0.05)
      + Math.sin(t * Math.PI * 7 + seedB) * (H * 0.025)
      + Math.sin(t * Math.PI * 13 + seedC) * (H * 0.012);
    h = Math.max(minSurf, Math.min(maxSurf, h));
    points.push(h);
  }

  const terr = renderScene.terr;

  // Corpo do terreno (cores do cenário)
  const grad = tctx.createLinearGradient(0, minSurf, 0, H);
  grad.addColorStop(0, terr.body[0]);
  grad.addColorStop(0.4, terr.body[1]);
  grad.addColorStop(1, terr.body[2]);
  tctx.fillStyle = grad;
  tctx.beginPath();
  tctx.moveTo(0, H);
  for (let x = 0; x <= W; x++) tctx.lineTo(x, points[x]);
  tctx.lineTo(W, H);
  tctx.closePath();
  tctx.fill();

  // Crista de terra mais clara logo abaixo da superfície
  tctx.lineWidth = 14;
  tctx.strokeStyle = terr.crust;
  tctx.beginPath();
  tctx.moveTo(0, points[0] + 6);
  for (let x = 0; x <= W; x++) tctx.lineTo(x, points[x] + 6);
  tctx.stroke();

  // Cobertura do topo (grama / areia / rocha conforme o cenário)
  tctx.lineWidth = 7;
  tctx.strokeStyle = terr.grass;
  tctx.beginPath();
  tctx.moveTo(0, points[0]);
  for (let x = 0; x <= W; x++) tctx.lineTo(x, points[x]);
  tctx.stroke();
  // brilho claro na borda do topo
  tctx.lineWidth = 2.5;
  tctx.strokeStyle = terr.grassHi;
  tctx.beginPath();
  tctx.moveTo(0, points[0] - 3);
  for (let x = 0; x <= W; x++) tctx.lineTo(x, points[x] - 3);
  tctx.stroke();

  refreshTerrainBuffer();
  return points;
}

// Buffer cacheado dos pixels do terreno (canal alpha) para colisão rápida.
// Reconstruído após gerar/explodir, em vez de ler pixel a pixel a cada frame.
let terrainBuffer = null;
function refreshTerrainBuffer() {
  terrainBuffer = tctx.getImageData(0, 0, W, H).data;
}

// Fase "Plataforma": uma fileira de terra no meio (time de cima) + piso no fundo (time de baixo)
function generatePlatformTerrain() {
  paintLayer(PLAT_Y, PLAT_Y + PLAT_H); // a fileira de terra
  paintLayer(FLOOR_Y, H);              // o piso do time de baixo
  refreshTerrainBuffer();
}

// Pinta uma faixa horizontal de terra (com cobertura de grama no topo)
function paintLayer(top, bottom) {
  const terr = renderScene.terr;
  const grad = tctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, terr.body[0]);
  grad.addColorStop(0.5, terr.body[1]);
  grad.addColorStop(1, terr.body[2]);
  tctx.fillStyle = grad;
  tctx.fillRect(0, top, W, bottom - top);
  tctx.fillStyle = terr.grass;
  tctx.fillRect(0, top, W, 6);
  tctx.fillStyle = terr.grassHi;
  tctx.fillRect(0, top, W, 2);
}

// Verdadeiro se o pixel (x,y) tem terreno sólido
function isSolid(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return terrainBuffer[(y * W + x) * 4 + 3] > 128;
}

// Altura do chão sólido logo abaixo de (x, fromY)
function groundBelow(x, fromY) {
  for (let y = Math.max(0, Math.floor(fromY)); y < H; y++) {
    if (isSolid(x, y)) return y;
  }
  return H;
}

// Abre uma cratera no terreno
function explode(x, y, radius) {
  tctx.globalCompositeOperation = 'destination-out';
  tctx.beginPath();
  tctx.arc(x, y, radius, 0, Math.PI * 2);
  tctx.fill();
  tctx.globalCompositeOperation = 'source-over';

  // Borda queimada
  tctx.globalCompositeOperation = 'source-atop';
  tctx.strokeStyle = 'rgba(20,10,5,0.6)';
  tctx.lineWidth = 4;
  tctx.beginPath();
  tctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  tctx.stroke();
  tctx.globalCompositeOperation = 'source-over';

  refreshTerrainBuffer();
}

// Sandbox: apaga TODO o terreno do mapa (arma Ctrl + D)
function deleteAllTerrain() {
  tctx.clearRect(0, 0, W, H);
  refreshTerrainBuffer();
  for (const t of game.tanks) {
    if (t.alive) eraseDust(t.x, t.y - 6, 18);
  }
}

// ============================================================
//  Início / reinício
// ============================================================
// setup: { teams: [ [isAI,...], [isAI,...] ] } — um booleano por tanque
function startGame(setup) {
  const counts = [setup.teams[0].length, setup.teams[1].length];
  const maxN = Math.max(counts[0], counts[1]);

  // Cenário + modo escolhidos (com a física resultante)
  const scene = SCENES[loadout.scene] || SCENES.dia;
  const modeDef = GAME_MODES[loadout.mode] || GAME_MODES.normal;
  const arena = ARENAS[loadout.arena] || ARENAS.padrao;
  renderScene = scene;
  renderArena = arena;
  GRAVITY = 0.25 * scene.gravityMul * modeDef.gravityMul;
  const windFactor = scene.windMul * modeDef.windMul;

  // O mapa cresce com o time mais cheio para os tanques não se amontoarem.
  // Na Plataforma os dois times ocupam a largura inteira (um sobre o outro).
  W = arena.id === 'plataforma'
    ? Math.max(2200, Math.round(160 + 44 * (maxN - 1)))
    : Math.max(2200, Math.round(2 * (240 + 44 * (maxN - 1))));
  terrain.width = W;
  terrain.height = H;
  generateTerrain();

  const tanks = [];
  const teams = [[], []];
  for (let tm = 0; tm < 2; tm++) {
    const n = counts[tm];
    const facing = tm === 0 ? 1 : -1;
    const skin = SKINS[loadout.skins[tm]] ? loadout.skins[tm] : 'classic';
    for (let i = 0; i < n; i++) {
      const isAI = !!setup.teams[tm][i];
      const x = arena.id === 'plataforma' ? arenaX(i, n) : teamX(tm, i, n);
      const t = new Tank(x, TEAM_COLORS[tm], tankName(tm, i, n, isAI), facing);
      t.team = tm;
      t.isAI = isAI;
      t.skin = skin;
      t.maxHealth = modeDef.hp;
      t.health = modeDef.hp;
      placeTankOnArena(t, tm);
      tanks.push(t);
      teams[tm].push(t);
    }
  }

  game = {
    tanks,
    teams,
    setup,            // guardado para o "jogar de novo"
    mode: 'battle',
    scene,
    modeDef,
    windFactor,
    weapons: modeDef.sandbox ? activeWeapons().concat(SANDBOX_WEAPONS) : activeWeapons(),
    blackhole: null,  // arma DLC: campo de atração em andamento
    meteorRain: null, // chuva de meteoros em andamento
    terrainDirty: false, // crateras de meteoro pendentes de atualizar no buffer
    activeTeam: 0,
    teamTurnIdx: [0, -1], // time 0 começa no #0; time 1 ainda não jogou
    current: tanks.indexOf(teams[0][0]),
    projectiles: [],
    particles: [],
    weaponIndex: 0,
    wind: 0,
    charging: false,
    power: 0,
    state: 'aiming', // aiming | firing | settling | bombblast | over
    settleTimer: 0,
    ai: null,        // estado da jogada da IA no turno atual
    bombs: [],       // bombas-relógio armadas no mapa
    pendingBlasts: [], // bombas que vão estourar agora
    blastTimer: 0,
    turnAccounted: false, // garante 1 contagem de turno por jogada
    bombrocas: [],   // dardos (Bombroca) voando pelo mapa
    cataclysm: null, // efeito "Desaba Tudo" em andamento
    windBlast: null, // vendaval do Soprador: { user, turnsLeft }
    turbo: null,     // modo voo do Turbo: { timer }
  };

  setupTeamHUD();
  newTurnWind();
  snapCamera();
  updateHUD();

  // Se o primeiro a jogar for COM, já inicia a jogada da IA
  const first = game.tanks[game.current];
  if (first.isAI) startAITurn(first);
}

// Posição horizontal do i-ésimo tanque do time (espalhados na sua metade do mapa)
function teamX(tm, i, n) {
  const half = W / 2;
  if (tm === 0) {
    const a = 80, b = half - 160;
    return n === 1 ? (a + b) / 2 : a + (b - a) * (i / (n - 1));
  }
  const a = half + 160, b = W - 80;
  return n === 1 ? (a + b) / 2 : b - (b - a) * (i / (n - 1));
}

// Fase Plataforma: tanques espalhados pela largura inteira (mesma coluna nos 2 times)
function arenaX(i, n) {
  const a = 80, b = W - 80;
  return n === 1 ? (a + b) / 2 : a + (b - a) * (i / (n - 1));
}

// Assenta o tanque no chão certo conforme a arena
function placeTankOnArena(t, tm) {
  if (renderArena.id === 'plataforma') {
    // Time 0 (verde) pousa na fileira do meio; time 1 (vermelho) no piso do fundo
    const fromY = tm === 0 ? 0 : PLAT_Y + PLAT_H + 60;
    t.y = groundBelow(t.x, fromY) - 1;
  } else {
    dropTank(t);
  }
}

// Nome exibido do tanque
function tankName(tm, i, n, isAI) {
  if (n === 1) return tm === 0 ? 'Jogador 1' : (isAI ? 'COM' : 'Jogador 2');
  return 'T' + (tm + 1) + '-' + (i + 1) + (isAI ? '' : ' (J)');
}

// Ícones dos times no HUD (robô só quando é exatamente o clássico 1x1 contra o COM)
function setupTeamHUD() {
  document.getElementById('p1-ico').innerHTML =
    pixelIconImg('tank', 2, 'pxicon', { palette: { C: TEAM_COLORS[0] } });
  const t2 = game.teams[1];
  const soloCom = t2.length === 1 && t2[0].isAI;
  document.getElementById('p2-ico').innerHTML = soloCom
    ? pixelIconImg('robot', 2)
    : pixelIconImg('tank', 2, 'pxicon', { palette: { C: TEAM_COLORS[1] } });
}

// Coloca o tanque sobre o terreno
function dropTank(tank) {
  tank.y = groundBelow(tank.x, 0) - 1;
}

function newTurnWind() {
  // Mantém o vendaval do Soprador por 2 turnos de quem o usou
  const wb = game.windBlast;
  if (wb) {
    if (game.current === wb.user) {
      // Voltou a vez de quem usou: conta um turno do vendaval
      wb.turnsLeft--;
      if (wb.turnsLeft > 0) return;  // ainda dura: mantém o vento
      game.windBlast = null;         // acabou: cai pro vento normal abaixo
    } else {
      return;                        // turno do oponente: mantém o vento
    }
  }
  game.wind = (Math.random() * 2 - 1) * 0.06 * (game.windFactor || 1);
}

// A câmera foca o projétil em voo; senão, o tanque da vez
function updateCamera() {
  let focusX, focusY;
  if (game.cataclysm) {
    focusX = W / 2; focusY = H * 0.62;
  } else if (game.state === 'bombblast' && game.pendingBlasts.length > 0) {
    const b = game.pendingBlasts[0];
    focusX = b.x; focusY = b.y;
  } else if (game.projectiles.length > 0) {
    const p = game.projectiles[game.projectiles.length - 1];
    focusX = p.x; focusY = p.y;
  } else if (game.bombrocas.length > 0) {
    const b = game.bombrocas[0];
    focusX = b.x; focusY = b.y;
  } else {
    const t = game.tanks[game.current];
    focusX = t.x; focusY = t.y - 40;
  }
  cam.targetX = clampCam(focusX - VIEW_W / 2, W - VIEW_W);
  cam.targetY = clampCam(focusY - VIEW_H / 2, H - VIEW_H);
  cam.x += (cam.targetX - cam.x) * 0.08; // segue com suavização
  cam.y += (cam.targetY - cam.y) * 0.08;
}

function clampCam(v, max) { return Math.max(0, Math.min(max, v)); }

// Posiciona a câmera instantaneamente sobre o tanque da vez
function snapCamera() {
  const t = game.tanks[game.current];
  cam.targetX = clampCam(t.x - VIEW_W / 2, W - VIEW_W);
  cam.targetY = clampCam((t.y - 40) - VIEW_H / 2, H - VIEW_H);
  cam.x = cam.targetX;
  cam.y = cam.targetY;
}

// ============================================================
//  Controles
// ============================================================
const keys = {};
let fastForward = false; // segurar "v" acelera a partida em 20x

// Acelerador: funciona em qualquer turno (inclusive do COM)
document.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') fastForward = true;
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'v' || e.key === 'V') fastForward = false;
});

document.addEventListener('keydown', (e) => {
  if (!game || game.state === 'over') return;
  // Durante o turno do COM o jogador não controla nada
  if (game.tanks[game.current].isAI) return;
  keys[e.key] = true;

  if (game.state === 'aiming') {
    if (e.key === 'q' || e.key === 'Q') cycleWeapon(-1);
    if (e.key === 'e' || e.key === 'E') cycleWeapon(1);
    if (e.key === ' ' && !game.charging) {
      game.charging = true;
      game.power = 0;
    }
  }
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  if (!game) return;
  keys[e.key] = false;
  if (e.key === ' ' && game.charging && game.state === 'aiming') {
    fire();
  }
});

function cycleWeapon(dir) {
  const n = game.weapons.length;
  game.weaponIndex = (game.weaponIndex + dir + n) % n;
  updateHUD();
}

function fire() {
  game.charging = false;
  launchProjectile(game.power);
}

function launchProjectile(power) {
  const tank = game.tanks[game.current];
  const tip = tank.barrelTip;
  const rad = tank.angle * Math.PI / 180;
  const speed = 6 + power * 16; // potência 0..1
  const vx = Math.cos(rad) * speed;
  const vy = -Math.sin(rad) * speed;
  const w = game.weapons[game.weaponIndex];

  // Turbo: entra em modo voo propulsionado (não dispara projétil).
  // Quanto mais potência carregada, mais tempo de voo (~1.5s a ~7s)
  if (w.turbo) {
    game.turbo = { timer: Math.round(90 + power * 330) };
    tank.noFall = true; // o Turbo não machuca: sem dano de queda nesta jogada
    game.state = 'turbo';
    game.power = 0;
    game.ai = null;
    updatePowerBar();
    return;
  }

  game.projectiles.push(new Projectile(tip.x, tip.y, vx, vy, w, power));
  game.state = 'firing';
  game.power = 0;
  game.ai = null;
  updatePowerBar();
}

// Cratera explosiva deixada pelo Turbo (não machuca quem está voando)
function turboBlast(x, y) {
  const r = 30;
  explode(x, y, r);                       // abre a cratera no terreno
  spawnExplosion(x, y, '#fb7185', r);     // estilhaços
  const flyer = game.tanks[game.current];
  for (const t of game.tanks) {
    if (!t.alive || t === flyer) continue;
    const d = Math.hypot(t.x - x, (t.y - 10) - y);
    if (d < r + 12) t.health -= Math.round(14 * (1 - d / (r + 12)));
  }
}

// Modo voo do Turbo: propulsão contínua na direção oposta ao cano,
// e o jogador gira o cano (↑/↓) para mudar a direção do voo
function updateTurbo() {
  const tb = game.turbo;
  const tank = game.tanks[game.current];
  if (!tank.isAI) {
    if (keys['ArrowUp']) tank.angle += 2.2;
    if (keys['ArrowDown']) tank.angle -= 2.2;
    tank.angle = ((tank.angle % 360) + 360) % 360;
  }

  // Empuxo na direção oposta ao cano
  const rad = tank.angle * Math.PI / 180;
  const thrust = 0.7;
  tank.vx += -Math.cos(rad) * thrust;
  tank.vy += Math.sin(rad) * thrust;
  // Limita a velocidade para o voo ficar controlável
  const maxv = 10;
  const sp = Math.hypot(tank.vx, tank.vy);
  if (sp > maxv) { tank.vx = tank.vx / sp * maxv; tank.vy = tank.vy / sp * maxv; }

  // O vento gira na direção em que o tanque está andando (proporcional à velocidade)
  if (Math.abs(tank.vx) > 0.2) {
    game.wind = Math.max(-0.4, Math.min(0.4, tank.vx * 0.045));
  }

  // Chama saindo pelo cano (na direção do cano)
  const tip = tank.barrelTip;
  for (let k = 0; k < 2; k++) {
    game.particles.push(new Particle(
      tip.x, tip.y,
      Math.cos(rad) * 3 + (Math.random() - 0.5) * 1.5,
      -Math.sin(rad) * 3 + (Math.random() - 0.5) * 1.5,
      10 + Math.random() * 10,
      Math.random() > 0.5 ? '#f97316' : '#fde047',
      Math.random() * 3 + 1.5));
  }

  // Turbo detona o chão por onde passa
  tb.boomTick = (tb.boomTick || 0) - 1;
  if (tb.boomTick <= 0) {
    tb.boomTick = 5; // a cada ~5 frames
    turboBlast(tank.x, tank.y - 6);
  }

  tb.timer--;
  updateHUD();
  document.getElementById('turn-display').textContent =
    'TURBO ' + Math.ceil(tb.timer / 60) + 's';

  if (tb.timer <= 0) {
    game.turbo = null;
    // Mantém o vento da direção do voo pelo próximo turno
    game.windBlast = { user: game.current, turnsLeft: 1 };
    game.state = 'settling'; // espera pousar antes de passar a vez
    game.settleTimer = 30;
  }
}

// ============================================================
//  Atualização por frame
// ============================================================
function update() {
  if (!game) return;

  updateCamera();

  if (game.state === 'aiming') {
    const tank = game.tanks[game.current];
    if (tank.isAI) {
      updateAI(tank);
    } else {
      // Ângulo — gira a volta inteira (0–359°)
      if (keys['ArrowUp']) tank.angle += 1.5;
      if (keys['ArrowDown']) tank.angle -= 1.5;
      tank.angle = ((tank.angle % 360) + 360) % 360;
      // Movimento
      if (keys['ArrowLeft'] && tank.fuel > 0) moveTank(tank, -1);
      if (keys['ArrowRight'] && tank.fuel > 0) moveTank(tank, 1);
      // Carregar potência
      if (game.charging) {
        game.power = Math.min(1, game.power + 0.012);
        updatePowerBar();
      }
    }
    updateHUD();
  }

  if (game.state === 'turbo') updateTurbo();

  // Projéteis
  for (const p of game.projectiles) {
    if (!p.alive) continue;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 14) p.trail.shift();

    p.vy += GRAVITY;
    p.vx += game.wind;

    // Foguete (Turbo): empuxo próprio na direção do voo + chama traseira
    if (p.rocketFuel > 0) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const ax = p.vx / sp, ay = p.vy / sp;
      p.vx += ax * 0.9;
      p.vy += ay * 0.9;
      p.rocketFuel--;
      for (let k = 0; k < 2; k++) {
        game.particles.push(new Particle(
          p.x - ax * 9, p.y - ay * 9,
          -ax * 2 + (Math.random() - 0.5) * 1.5,
          -ay * 2 + (Math.random() - 0.5) * 1.5,
          10 + Math.random() * 10,
          Math.random() > 0.5 ? '#f97316' : '#fde047',
          Math.random() * 3 + 1.5));
      }
    }

    // Ímã: míssil teleguiado — gira suavemente até o inimigo mais próximo
    if (p.weapon.magnet) {
      const shooter = game.tanks[game.current];
      let tgt = null, best = Infinity;
      for (const t of game.tanks) {
        if (!t.alive || t.team === shooter.team) continue;
        const d = Math.hypot(t.x - p.x, (t.y - 10) - p.y);
        if (d < best) { best = d; tgt = t; }
      }
      if (tgt) {
        p.vy -= GRAVITY; // propulsão própria: o míssil não cai
        const desired = Math.atan2((tgt.y - 10 + p.aimErrY) - p.y, (tgt.x + p.aimErrX) - p.x);
        let cur = Math.atan2(p.vy, p.vx);
        let diff = desired - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.PI; // aponta direto no alvo: 100% preciso
        cur += Math.max(-turn, Math.min(turn, diff));
        const speed = Math.min(14, Math.hypot(p.vx, p.vy) + 0.5); // acelera até o teto
        p.vx = Math.cos(cur) * speed;
        p.vy = Math.sin(cur) * speed;
        // chama de propulsão saindo da traseira
        const ax = p.vx / speed, ay = p.vy / speed;
        game.particles.push(new Particle(
          p.x - ax * 9, p.y - ay * 9,
          -ax * 2 + (Math.random() - 0.5) * 1.5,
          -ay * 2 + (Math.random() - 0.5) * 1.5,
          10 + Math.random() * 10,
          Math.random() > 0.5 ? '#f97316' : '#fde047',
          Math.random() * 2.5 + 1.5));
      }
    }

    p.x += p.vx;
    p.y += p.vy;
    p.spin += p.spinV; // gira sobre o próprio eixo

    // Saiu pelos lados ou por baixo
    if (p.x < -50 || p.x > W + 50 || p.y > H + 50) {
      if (p.weapon.deleteAll) deleteAllTerrain(); // garante o efeito mesmo sem tocar nada
      p.alive = false;
      continue;
    }

    // Acertou terreno?
    if (isSolid(p.x, p.y)) {
      // Saltitante quica algumas vezes antes de explodir
      if (p.weapon.bounce && p.bounces < p.weapon.bounce) { bounceProjectile(p); continue; }
      detonate(p); continue;
    }

    // Acertou tanque?
    for (const t of game.tanks) {
      if (!t.alive) continue;
      const dx = p.x - t.x, dy = p.y - (t.y - 10);
      if (dx * dx + dy * dy < 18 * 18) { detonate(p); break; }
    }
  }
  game.projectiles = game.projectiles.filter(p => p.alive);

  // Atualiza o buffer de colisão uma vez por frame se houve crateras de meteoro
  if (game.terrainDirty) { refreshTerrainBuffer(); game.terrainDirty = false; }

  // Partículas
  for (const pt of game.particles) {
    pt.vy += GRAVITY * 0.5;
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.life--;
  }
  game.particles = game.particles.filter(pt => pt.life > 0);

  // Bombroca: dardos voando pelo mapa
  updateBombrocas();

  // Chuva de meteoros: solta os dardos aos poucos
  updateMeteorRain();

  // Desaba Tudo: terra voando e desabando
  updateCataclysm();

  // Buraco Negro (DLC): suga os tanques e implode
  updateBlackhole();

  // Faz tanques caírem após explosões (suspenso durante o cataclismo)
  if (!game.cataclysm) { applyTankGravity(); updateSkulls(); }

  // Transição de fim de turno (espera projéteis, bombrocas, cataclismo e a chuva de meteoros)
  if (game.state === 'firing' && game.projectiles.length === 0 &&
      game.bombrocas.length === 0 && !game.cataclysm && !game.meteorRain) {
    game.state = 'settling';
    game.settleTimer = 40;
  }
  if (game.state === 'settling') {
    game.settleTimer--;
    // o buraco negro mantém tudo em movimento; não dá pra esperar repouso total
    if (game.settleTimer <= 0 && (tanksAtRest() || game.blackhole)) {
      checkDeaths();
      if (!checkGameOver()) advanceTurnOrBlast();
    }
  }
  if (game.state === 'bombblast') {
    if (--game.blastTimer <= 0) {
      // Estoura as bombas vencidas
      for (const b of game.pendingBlasts) applyBlast(b.x, b.y, b.weapon);
      game.bombs = game.bombs.filter(b => !game.pendingBlasts.includes(b));
      game.pendingBlasts = [];
      checkDeaths();
      if (!checkGameOver()) {
        // Tanques podem ter caído: reassenta antes de seguir
        game.state = 'settling';
        game.settleTimer = 40;
      }
    }
  }
}

// No fim de cada jogada: ou estoura bombas que venceram, ou passa o turno
function advanceTurnOrBlast() {
  let due = [];
  if (!game.turnAccounted) {
    due = tickBombs();
    // conta o turno do buraco negro; ao acabar, ele implode junto das bombas
    if (game.blackhole && --game.blackhole.turns <= 0) {
      due.push({ x: game.blackhole.x, y: game.blackhole.y, weapon: game.blackhole.weapon });
      game.blackhole = null;
    }
    game.turnAccounted = true;
  }
  if (due.length > 0) {
    game.pendingBlasts = due;
    game.state = 'bombblast';
    game.blastTimer = 75; // tempo para a câmera ir e a bomba piscar rápido
  } else {
    nextTurn();
  }
}

// Conta um turno para cada bomba; devolve as que vão estourar agora.
// A bomba recém-plantada "pula" a contagem da própria jogada (justArmed).
function tickBombs() {
  const due = [];
  for (const b of game.bombs) {
    if (b.justArmed) { b.justArmed = false; continue; }
    b.fuse--;
    if (b.fuse <= 0) due.push(b);
  }
  return due;
}

function moveTank(tank, dir) {
  const nx = tank.x + dir * 1.4;
  if (nx < 16 || nx > W - 16) return;
  const groundY = groundBelow(nx, tank.y - 30);
  // Não escala paredes muito íngremes
  if (groundY - 1 < tank.y - 14) return;
  tank.x = nx;
  tank.y = groundY - 1;
  tank.fuel = Math.max(0, tank.fuel - 0.5);
  // vira a mira para o lado do movimento
  tank.facing = dir;
}

function applyTankGravity() {
  for (const t of game.tanks) {
    if (!t.alive) continue;

    // Horizontal: propulsão do Turbo / deslizamento
    if (Math.abs(t.vx) > 0.01) {
      const nx = Math.max(16, Math.min(W - 16, t.x + t.vx));
      const stepGround = groundBelow(nx, Math.max(0, t.y - 50)) - 1;
      if (stepGround < t.y - 18) {
        t.vx = 0; // bateu numa parede/ladeira íngreme à frente
      } else {
        t.x = nx;
      }
    } else {
      t.vx = 0;
    }

    // Vertical: gravidade + impulso
    t.vy += GRAVITY;
    const groundY = groundBelow(t.x, Math.max(0, t.y - 50)) - 1;
    let ny = t.y + t.vy;
    if (ny >= groundY) {
      ny = groundY;
      if (t.vy > 8 && !t.noFall) t.health -= Math.floor((t.vy - 8) * 2); // dano de queda
      t.vy = 0;
      t.vx *= 0.6; // perde velocidade ao tocar o chão
      if (Math.abs(t.vx) < 0.05) t.vx = 0;
    }
    t.y = ny;
  }
}

function tanksAtRest() {
  return game.tanks.every(t =>
    !t.alive || (Math.abs(t.vy) < 0.5 && Math.abs(t.vx) < 0.3));
}

// Caveiras dos tanques destruídos: caem, quicam e rolam ladeira abaixo
function updateSkulls() {
  for (const t of game.tanks) {
    if (t.alive || t.rested) continue;

    t.vy += GRAVITY;
    t.x += t.vx;
    t.y += t.vy;

    // paredes do mundo
    if (t.x < 8) { t.x = 8; t.vx = Math.abs(t.vx) * 0.5; }
    if (t.x > W - 8) { t.x = W - 8; t.vx = -Math.abs(t.vx) * 0.5; }

    const groundY = groundBelow(t.x, Math.max(0, t.y - 40)) - 1;
    if (t.y >= groundY) {
      t.y = groundY;
      if (t.vy > 1.2) {
        t.vy *= -0.4;                 // quica
      } else {
        t.vy = 0;
        // rola na direção da ladeira
        const gl = groundBelow(t.x - 7, Math.max(0, t.y - 40));
        const gr = groundBelow(t.x + 7, Math.max(0, t.y - 40));
        const slope = (gr - gl) / 14; // >0 desce para a direita
        t.vx += slope * 0.7;
        t.vx *= 0.88;                 // atrito
        if (Math.abs(t.vx) < 0.1 && Math.abs(slope) < 0.08) { t.vx = 0; t.rested = true; }
      }
    }

    t.roll += t.vx * 0.11; // gira conforme rola
  }
}

// Normal aproximada da superfície do terreno no ponto (aponta para fora)
function terrainNormal(x, y) {
  const s = 5;
  let nx = (isSolid(x - s, y) ? 1 : 0) - (isSolid(x + s, y) ? 1 : 0);
  let ny = (isSolid(x, y - s) ? 1 : 0) - (isSolid(x, y + s) ? 1 : 0);
  if (nx === 0 && ny === 0) { nx = 0; ny = -1; }
  const len = Math.hypot(nx, ny) || 1;
  return { x: nx / len, y: ny / len };
}

// Faz a granada saltitante quicar na superfície
function bounceProjectile(p) {
  // recua até sair do terreno
  let guard = 0;
  while (isSolid(p.x, p.y) && guard++ < 40) { p.x -= p.vx * 0.2; p.y -= p.vy * 0.2; }
  const n = terrainNormal(p.x, p.y);
  const dot = p.vx * n.x + p.vy * n.y;
  p.vx = (p.vx - 2 * dot * n.x) * 0.62; // reflete com perda de energia
  p.vy = (p.vy - 2 * dot * n.y) * 0.62;
  p.bounces++;
  spawnExplosion(p.x, p.y, p.weapon.color, 8);
  // quase parado: explode
  if (Math.hypot(p.vx, p.vy) < 1.6) detonate(p);
}

function detonate(p) {
  p.alive = false;
  // Bomba-relógio não explode ao tocar: ela se arma e conta o turno
  if (p.weapon.timed) {
    armBomb(p.x, p.y, p.weapon);
    return;
  }
  // Bombroca: um dardo que voa pelo mapa apagando tudo que toca por 12s
  if (p.weapon.dart) {
    startBombroca(p.x, p.y, p.weapon, p.vx, p.vy);
    return;
  }
  // Desaba Tudo: revira o mapa inteiro
  if (p.weapon.cataclysm) {
    startCataclysm();
    return;
  }
  // Bombardeio: chama uma chuva de bombas do céu sobre o ponto
  if (p.weapon.airstrike) {
    startAirstrike(p.x, p.y, p.weapon);
    return;
  }
  // Chuva de Meteoros: 500 dardos de bombardeiro no mesmo lugar
  if (p.weapon.meteorstorm) {
    startMeteorStorm(p.x, p.y, p.weapon);
    return;
  }
  // Dardo de meteoro: explode e gera dardos bombardeiros que não explodem
  if (p.weapon.meteor) {
    meteorBlast(p.x, p.y, p.weapon);
    return;
  }
  // Dardo bombardeiro "dud": não explode, só cava um buraquinho ao cair
  if (p.weapon.dud) {
    eraseCanvas(p.x, p.y, p.weapon.radius);
    game.terrainDirty = true;
    return;
  }
  // Buraco Negro (DLC): abre um campo que suga os tanques antes de explodir
  if (p.weapon.blackhole) {
    startBlackhole(p.x, p.y, p.weapon);
    return;
  }
  // Ctrl + D (Sandbox): apaga toda a terra do mapa
  if (p.weapon.deleteAll) {
    deleteAllTerrain();
    return;
  }
  applyBlast(p.x, p.y, p.weapon);
}

// ============================================================
//  Buraco Negro (arma DLC) — campo que puxa os tanques e implode
// ============================================================
function startBlackhole(x, y, weapon) {
  game.blackhole = { x, y, weapon, turns: 13, radius: weapon.radius, t: 0 };
}

function updateBlackhole() {
  const bh = game.blackhole;
  if (!bh) return;
  bh.t++;

  const R = bh.radius * 4;
  for (const t of game.tanks) {
    if (!t.alive) continue;
    const dx = bh.x - t.x, dy = bh.y - (t.y - 10);
    const d = Math.hypot(dx, dy) || 1;
    if (d < R) {
      const pull = (1 - d / R) * 3.2;
      t.x = Math.max(16, Math.min(W - 16, t.x + (dx / d) * pull));
      t.vy += (dy / d) * 0.35;
    }
  }

  // Puxa qualquer dardo (Bombroca) do mapa inteiro, mais forte quanto mais perto
  for (const b of game.bombrocas) {
    const dx = bh.x - b.x, dy = bh.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const pull = 0.6 + (1 - Math.min(1, d / R)) * 0.6; // sempre puxa; reforça de perto
    b.vx += (dx / d) * pull;
    b.vy += (dy / d) * pull;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 8) { b.vx = b.vx / sp * 8; b.vy = b.vy / sp * 8; } // mantém controlável
  }

  // Poeira espiralando para dentro
  for (let k = 0; k < 2; k++) {
    const a = bh.t * 0.3 + k * Math.PI + Math.random();
    const rr = bh.radius * (1.5 + Math.random());
    game.particles.push(new Particle(
      bh.x + Math.cos(a) * rr, bh.y + Math.sin(a) * rr,
      -Math.cos(a) * 2, -Math.sin(a) * 2,
      18, Math.random() > 0.5 ? '#a855f7' : '#e9d5ff', Math.random() * 2 + 1));
  }
}

function drawBlackhole() {
  const bh = game.blackhole;
  if (!bh) return;
  const pulse = 0.5 + 0.5 * Math.sin(bh.t * 0.2);
  ctx.save();
  const g = ctx.createRadialGradient(bh.x, bh.y, bh.radius * 0.5, bh.x, bh.y, bh.radius * 3);
  g.addColorStop(0, 'rgba(168,85,247,0.5)');
  g.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(bh.x, bh.y, bh.radius * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.beginPath();
  ctx.arc(bh.x, bh.y, bh.radius * (1.1 + pulse * 0.2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(bh.x, bh.y, bh.radius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Faz chover bombas do céu sobre a região atingida (Bombardeio) — original
function startAirstrike(x, y, weapon) {
  // marca de impacto inicial
  applyBlast(x, y, { ...weapon, airstrike: 0, radius: 26, damage: 16 });
  for (let i = 0; i < weapon.airstrike; i++) {
    const ox = Math.max(20, Math.min(W - 20, x + (Math.random() * 2 - 1) * 130));
    const sy = Math.max(8, y - 480 - Math.random() * 90);
    const proj = new Projectile(
      ox, sy, (Math.random() * 2 - 1) * 1.5, 3 + Math.random() * 2,
      { ...weapon, airstrike: 0, radius: 32, damage: 24, color: '#38bdf8' });
    game.projectiles.push(proj);
  }
}

// Chuva de Meteoros: despeja muitos dardos de bombardeiro no MESMO lugar,
// aos poucos (vários por frame) pra aguentar centenas de impactos.
function startMeteorStorm(x, y, weapon) {
  game.meteorRain = { weapon, cx: x, cy: y, remaining: weapon.meteorstorm };
}

function updateMeteorRain() {
  const mr = game.meteorRain;
  if (!mr) return;
  const batch = Math.min(mr.remaining, 16); // limita por frame (desempenho)
  for (let i = 0; i < batch; i++) {
    const sy = Math.max(8, mr.cy - 500 - Math.random() * 320); // despencam do alto
    game.projectiles.push(new Projectile(
      mr.cx, sy, 0, 3 + Math.random() * 2, // todos na mesma coluna, caindo reto
      { ...mr.weapon, meteorstorm: 0, meteor: true, radius: 22, damage: 12, color: '#38bdf8' }));
  }
  mr.remaining -= batch;
  if (mr.remaining <= 0) game.meteorRain = null;
}

// O dardo de meteoro EXPLODE (cratera + dano) e, ao explodir, gera alguns
// dardos voadores que NÃO explodem (tipo Bombroca) — "gerando mais" destruição.
function meteorBlast(x, y, w) {
  eraseCanvas(x, y, w.radius);
  game.terrainDirty = true;
  spawnExplosion(x, y, w.color, w.radius);
  for (const t of game.tanks) {
    if (!t.alive) continue;
    const dist = Math.hypot(t.x - x, (t.y - 10) - y);
    if (dist < w.radius + 12) t.health -= Math.round(w.damage * (1 - dist / (w.radius + 12)));
  }
  // gera dardos do tipo bombardeiro que NÃO explodem (caem do céu e só cavam)
  if (game.projectiles.length < 900 && Math.random() < 0.6) spawnDudDart(x, y, w);
}

// Dardo bombardeiro que não explode: despenca do alto e some ao tocar, cavando pouco
function spawnDudDart(x, y, w) {
  const ox = Math.max(20, Math.min(W - 20, x + (Math.random() * 2 - 1) * 70));
  const sy = Math.max(8, y - 280 - Math.random() * 160);
  game.projectiles.push(new Projectile(
    ox, sy, (Math.random() * 2 - 1) * 1, 2 + Math.random() * 2,
    { dud: true, radius: 16, damage: 0, color: '#38bdf8' }));
}

// Apaga um pedaço circular do terreno no canvas (sem atualizar o buffer)
function eraseCanvas(x, y, r) {
  tctx.globalCompositeOperation = 'destination-out';
  tctx.beginPath();
  tctx.arc(x, y, r, 0, Math.PI * 2);
  tctx.fill();
  tctx.globalCompositeOperation = 'source-over';
}

// Apaga e já atualiza o buffer de colisão
function eraseTerrain(x, y, r) {
  eraseCanvas(x, y, r);
  refreshTerrainBuffer();
}

// Lança um dardo que voa pelo mapa por 12s apagando tudo que tocar, e some
function startBombroca(x, y, weapon, vx, vy) {
  const SPEED = 6;                       // velocidade de cruzeiro do dardo
  const sp = Math.hypot(vx, vy) || 1;
  game.bombrocas.push({
    x, y,
    vx: (vx / sp) * SPEED,
    vy: (vy / sp) * SPEED,
    timer: 720,        // 12 segundos a ~60fps
    radius: weapon.radius,
    weapon,
    angle: Math.atan2(vy, vx),
    eraseTick: 0,
    t: 0,
  });
  eraseTerrain(x, y, weapon.radius); // abre o buraco inicial
}

// Solta partícula de "apagamento" (poeira que se desfaz)
function eraseDust(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 1.6;
    game.particles.push(new Particle(
      x, y, Math.cos(a) * sp, Math.sin(a) * sp - 1,
      18 + Math.random() * 14,
      Math.random() > 0.4 ? '#f0abfc' : '#ffffff',
      Math.random() * 3 + 1.5));
  }
}

// A cada frame: o dardo voa, quica nas bordas, abre túnel e desintegra tanques
function updateBombrocas() {
  if (game.bombrocas.length === 0) return;
  for (const b of game.bombrocas) {
    b.timer--;
    b.t++;

    // Movimento
    b.x += b.vx;
    b.y += b.vy;
    const r = b.radius;
    // Quica nas paredes do mundo
    if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
    if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx); }
    if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); }
    if (b.y > H - r) { b.y = H - r; b.vy = -Math.abs(b.vy); }
    b.angle = Math.atan2(b.vy, b.vx);

    // Abre o túnel: apaga o canvas todo frame, atualiza colisão de vez em quando
    eraseCanvas(b.x, b.y, r);
    if (--b.eraseTick <= 0) {
      b.eraseTick = 8;
      refreshTerrainBuffer();
    }
    eraseDust(b.x, b.y, 1);

    // Apaga (desintegra) qualquer tanque que o dardo encostar
    for (const t of game.tanks) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - b.x, (t.y - 10) - b.y);
      if (d < r + 10) {
        t.health -= 2.5; // some rápido ao ser tocado
        if (b.t % 2 === 0) eraseDust(t.x, t.y - 10, 1);
      }
    }
  }
  checkDeaths();
  // Se algum time foi eliminado, o dardo some imediatamente
  if (game.teams.some(team => team.every(t => !t.alive))) {
    for (const b of game.bombrocas) b.timer = 0;
  }
  // Garante a colisão atualizada quando o último dardo some
  const ending = game.bombrocas.some(b => b.timer <= 0);
  game.bombrocas = game.bombrocas.filter(b => b.timer > 0);
  if (ending) refreshTerrainBuffer();
}

// ============================================================
//  Desaba Tudo — joga toda a terra pra cima; ela desaba em pedaços
// ============================================================
const EARTH_COLORS = ['#7a5b30', '#6b4f2a', '#5e4524', '#4a3720', '#2e2011'];

function startCataclysm() {
  const chunks = [];
  const N = 260;
  // Amostra a terra existente como origem dos pedaços (antes de limpar)
  for (let i = 0; i < N; i++) {
    const x = Math.random() * W;
    const surf = groundBelow(x, 0);
    if (surf >= H - 2) continue;              // coluna sem terra
    const y = surf + Math.random() * (H - surf) * 0.6;
    const w = 18 + Math.random() * 44;
    const h = 16 + Math.random() * 34;
    chunks.push({
      x, y, w, h,
      vx: (Math.random() * 2 - 1) * 5,
      vy: -(9 + Math.random() * 13),          // arremessado pra cima
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() * 2 - 1) * 0.22,
      color: EARTH_COLORS[(Math.random() * EARTH_COLORS.length) | 0],
      shape: Math.random() < 0.5 ? 'rect' : 'poly',
      sides: 3 + ((Math.random() * 4) | 0),   // 3–6 lados
      jag: 0.55 + Math.random() * 0.4,        // irregularidade do polígono
      settled: false,
    });
  }

  // Limpa o terreno: será reconstruído conforme os pedaços assentam
  tctx.clearRect(0, 0, W, H);
  refreshTerrainBuffer();

  const COL = 24;
  const base = Math.floor(H * 0.72); // os pedaços assentam a partir desta linha
  game.cataclysm = {
    chunks,
    COL,
    base,
    cols: Math.ceil(W / COL),
    settleTop: new Array(Math.ceil(W / COL)).fill(base), // topo da pilha por coluna
  };
}

function updateCataclysm() {
  const c = game.cataclysm;
  if (!c) return;

  let flying = 0;
  for (const ch of c.chunks) {
    if (ch.settled) continue;
    flying++;

    ch.vy += GRAVITY;
    ch.x += ch.vx;
    ch.y += ch.vy;
    ch.rot += ch.rotV;

    // Quica nas laterais do mundo
    if (ch.x < ch.w / 2) { ch.x = ch.w / 2; ch.vx = Math.abs(ch.vx) * 0.6; }
    if (ch.x > W - ch.w / 2) { ch.x = W - ch.w / 2; ch.vx = -Math.abs(ch.vx) * 0.6; }

    // Só assenta enquanto desce, ao alcançar o topo da pilha local
    if (ch.vy > 0) {
      const landY = chunkLandingY(c, ch);
      if (ch.y >= landY) {
        ch.y = landY;
        ch.settled = true;
        stampChunk(tctx, ch);   // carimba o pedaço no terreno
        raiseSettle(c, ch);     // sobe a pilha das colunas cobertas
      }
    }
  }

  if (flying === 0) finishCataclysm();
}

// Onde o pedaço pousa: em cima do ponto mais alto da pilha que ele cobre
function chunkLandingY(c, ch) {
  const c0 = Math.max(0, Math.floor((ch.x - ch.w / 2) / c.COL));
  const c1 = Math.min(c.cols - 1, Math.floor((ch.x + ch.w / 2) / c.COL));
  let top = H;
  for (let i = c0; i <= c1; i++) top = Math.min(top, c.settleTop[i]);
  return top - ch.h * 0.42;
}

function raiseSettle(c, ch) {
  const newTop = ch.y - ch.h * 0.42;
  const c0 = Math.max(0, Math.floor((ch.x - ch.w / 2) / c.COL));
  const c1 = Math.min(c.cols - 1, Math.floor((ch.x + ch.w / 2) / c.COL));
  for (let i = c0; i <= c1; i++) c.settleTop[i] = Math.min(c.settleTop[i], newTop);
}

// Caminho do pedaço (retângulo ou polígono irregular), centrado na origem
function chunkPath(g, ch) {
  g.beginPath();
  if (ch.shape === 'rect') {
    g.rect(-ch.w / 2, -ch.h / 2, ch.w, ch.h);
  } else {
    const n = ch.sides;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rad = ch.jag + 0.45 * (((k * 53) % 7) / 7); // varia o raio por vértice
      const px = Math.cos(a) * (ch.w / 2) * rad;
      const py = Math.sin(a) * (ch.h / 2) * rad;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }
}

function stampChunk(g, ch) {
  g.save();
  g.translate(ch.x, ch.y);
  g.rotate(ch.rot);
  g.fillStyle = ch.color;
  chunkPath(g, ch);
  g.fill();
  g.restore();
}

function finishCataclysm() {
  // Fundação sólida abaixo da linha base, pra o relevo ter corpo
  const base = game.cataclysm.base;
  const grad = tctx.createLinearGradient(0, base - 10, 0, H);
  grad.addColorStop(0, '#6b4f2a');
  grad.addColorStop(1, '#2e2011');
  tctx.fillStyle = grad;
  tctx.fillRect(0, base - 6, W, H - base + 6);
  refreshTerrainBuffer();

  // Reposiciona os tanques sobre o novo relevo
  for (const t of game.tanks) {
    if (!t.alive) continue;
    t.y = groundBelow(t.x, 0) - 1;
    t.vy = 0;
    t.vx = 0;
  }
  game.cataclysm = null;
}

// Explosão de fato: cratera, partículas, dano e estilhaços
function applyBlast(x, y, w) {
  explode(x, y, w.radius);
  spawnExplosion(x, y, w.color, w.radius);

  // Dano aos tanques (proporcional à distância)
  for (const t of game.tanks) {
    if (!t.alive) continue;
    const dx = t.x - x, dy = (t.y - 10) - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < w.radius + 16) {
      const dmg = Math.round(w.damage * (1 - dist / (w.radius + 16)));
      t.health -= Math.max(0, dmg);
      // empurrão (forte no Soprador)
      const kb = w.knockback || 1;
      t.x += Math.sign(dx || 1) * (w.radius - dist) * 0.15 * kb;
      t.x = Math.max(16, Math.min(W - 16, t.x));
      if (kb > 1) t.vy = Math.min(t.vy, -5); // arremessa o tanque pra cima
    }
  }

  // Cluster: estilhaços secundários
  if (w.cluster > 0) {
    for (let i = 0; i < w.cluster; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      const sp = 3 + Math.random() * 3;
      const frag = new Projectile(x, y - 4,
        Math.cos(ang) * sp, -Math.abs(Math.sin(ang)) * sp,
        { ...w, cluster: 0, radius: 16, damage: 14 });
      game.projectiles.push(frag);
    }
  }

  // Napalm: cuspe de fogo extra para a explosão "queimar"
  if (w.napalm) {
    for (let i = 0; i < 16; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const sp = 2 + Math.random() * 4;
      game.particles.push(new Particle(
        x, y, Math.cos(ang) * sp, -Math.abs(Math.sin(ang)) * sp - 1,
        30 + Math.random() * 28,
        Math.random() > 0.5 ? '#f97316' : '#fbbf24',
        Math.random() * 4 + 2));
    }
  }

  // Soprador: dispara um vendaval de 9999 na direção do oponente,
  // que dura 2 turnos de quem usou (sabota o tiro de quem levar o sopro)
  if (w.windBlast) {
    const shooter = game.tanks[game.current];
    const foe = nearestEnemy(shooter);
    const dir = (foe && foe.x >= shooter.x) ? 1 : -1;
    game.wind = dir * 9.999;   // o HUD mostra 9999 (|vento| × 1000)
    game.windBlast = { user: game.current, turnsLeft: 2 };
    updateHUD();
  }
}

// Planta uma bomba-relógio na superfície do ponto de impacto
function armBomb(x, y, weapon) {
  const gy = groundBelow(x, Math.max(0, y - 2));
  const sy = gy < H ? gy : y;
  x = Math.max(16, Math.min(W - 16, x));
  game.bombs.push({ x, y: sy, fuse: 1, justArmed: true, weapon, t: 0 });
}

function spawnExplosion(x, y, color, radius) {
  const n = Math.floor(radius * 0.9);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = Math.random() * 5 + 1;
    game.particles.push(new Particle(
      x, y, Math.cos(ang) * sp, Math.sin(ang) * sp - 2,
      30 + Math.random() * 20,
      Math.random() > 0.5 ? color : '#fde047',
      Math.random() * 4 + 2
    ));
  }
}

function checkDeaths() {
  for (const t of game.tanks) {
    if (t.health <= 0 && t.alive) {
      t.alive = false;
      t.health = 0;
      spawnExplosion(t.x, t.y - 10, '#f97316', 60);
      // a explosão cospe a caveira pra cima e pro lado
      t.vy = -(4 + Math.random() * 3);
      t.vx = (Math.random() * 2 - 1) * 4;
      t.rollV = (Math.random() * 2 - 1) * 0.3;
      t.rested = false;
    }
  }
}

function checkGameOver() {
  const aliveTeams = [0, 1].filter(tm => game.teams[tm].some(t => t.alive));
  if (aliveTeams.length <= 1) {
    game.state = 'over';
    let reward = 0;
    if (aliveTeams.length === 1) {
      const loser = 1 - aliveTeams[0];
      reward = 40 + 12 * game.teams[loser].length + (game.modeDef.id !== 'normal' ? 40 : 0);
      addCoins(reward);
    }
    showGameOver(aliveTeams.length === 1 ? aliveTeams[0] : null, reward);
    return true;
  }
  return false;
}

function nextTurn() {
  pickNextActiveTank();

  const t = game.tanks[game.current];
  t.fuel = 100;
  game.tanks.forEach(tk => tk.noFall = false); // a imunidade do Turbo vale só pela jogada
  newTurnWind();
  game.state = 'aiming';
  game.power = 0;
  game.ai = null;
  game.turnAccounted = false; // a nova jogada ainda não contou os turnos das bombas
  snapCamera();
  updatePowerBar();
  updateHUD();

  if (t.isAI) startAITurn(t);
}

// Passa a vez para o outro time e escolhe o próximo tanque vivo dele (round-robin)
function pickNextActiveTank() {
  const other = 1 - game.activeTeam;
  if (game.teams[other].some(t => t.alive)) game.activeTeam = other;

  const team = game.teams[game.activeTeam];
  let idx = game.teamTurnIdx[game.activeTeam];
  for (let k = 0; k < team.length; k++) {
    idx = (idx + 1) % team.length;
    if (team[idx].alive) break;
  }
  game.teamTurnIdx[game.activeTeam] = idx;
  game.current = game.tanks.indexOf(team[idx]);
}

// Inimigo vivo mais próximo (do time oposto)
function nearestEnemy(tank) {
  let best = null, bd = Infinity;
  for (const t of game.tanks) {
    if (!t.alive || t.team === tank.team) continue;
    const d = Math.abs(t.x - tank.x);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// ============================================================
//  Inteligência artificial (COM)
// ============================================================

// Inicia a jogada da IA: escolhe a arma, decide se anda, depois mira e atira
function startAITurn(tank) {
  const target = nearestEnemy(tank);
  if (!target) return;

  // Qualidade do tiro a partir de onde está (reaproveitada nas decisões)
  const baseScore = shotScoreAt(tank.x, target);

  game.weaponIndex = aiChooseWeapon(tank, target, baseScore);

  game.ai = {
    phase: 'think',      // think -> move -> aimInit -> aim -> charge
    timer: 40,           // pausa para "pensar"
    target,
    moveTarget: aiDecideMove(tank, target, baseScore), // x de destino, ou null
    targetAngle: tank.angle,
    targetPower: 0.7,
  };
  updateHUD();
}

// Escolhe a arma de acordo com a distância e a vida
function aiChooseWeapon(tank, target, score) {
  const dist = Math.abs(target.x - tank.x);
  const r = Math.random();

  // Pouca vida: arrisca a explosão gigante da bomba-relógio
  if (tank.health < 35 && r < 0.4) return 3;
  // Variedade ocasional com as armas especiais
  if (r < 0.14) return 3;             // Bomba Relógio
  if (r < 0.22) return 4;             // Bombroca (dardo)
  // Armas diretas conforme a distância
  if (dist > 650) return 1;           // longe -> Bomba Pesada (raio perdoa erro)
  const p = Math.random();
  if (p < 0.55) return 0;             // Tiro Normal
  if (p < 0.80) return 1;             // Bomba Pesada
  return 2;                           // Cluster
}

// Decide para onde o COM deve andar antes de atirar (ou null para ficar parado)
function aiDecideMove(tank, target, baseScore) {
  const clampX = (x) => Math.max(40, Math.min(W - 40, x));

  // 1) Fugir de uma bomba-relógio armada por perto
  for (const b of game.bombs) {
    if (Math.hypot(b.x - tank.x, b.y - tank.y) < 170) {
      const away = tank.x < b.x ? -1 : 1;
      return clampX(tank.x + away * (140 + Math.random() * 90));
    }
  }

  // 2) Procurar uma posição com tiro melhor (avalia alguns deslocamentos)
  const start = baseScore != null ? baseScore : shotScoreAt(tank.x, target);
  let best = { x: tank.x, score: start };
  for (const off of [-110, -60, 60, 110]) {
    const cx = clampX(tank.x + off);
    const s = shotScoreAt(cx, target);
    if (s < best.score - 10) best = { x: cx, score: s }; // só vale se melhora bem
  }
  return best.x !== tank.x ? best.x : null;
}

// Qualidade do melhor tiro possível a partir de uma posição x (menor = melhor)
function shotScoreAt(cx, target) {
  const gy = groundBelow(cx, 0) - 1;
  return aiComputeShot({ x: cx, y: gy }, target).dist;
}

// Calcula o tiro a partir da posição atual e começa a mirar
function aiComputeAndAim(tank, target) {
  const ai = game.ai;
  const sol = aiComputeShot(tank, target);
  // Mira bem imprecisa: o COM erra com frequência
  const angle = sol.angle + (Math.random() * 2 - 1) * 16;
  const power = sol.power + (Math.random() * 2 - 1) * 0.2;
  ai.targetAngle = angle; // sem trava: permite mirar pra baixo (fase Plataforma)
  ai.targetPower = Math.max(0.15, Math.min(1, power));
  ai.phase = 'aim';
}

// Avança a animação da jogada da IA, frame a frame
function updateAI(tank) {
  const ai = game.ai;
  if (!ai) return;

  if (ai.phase === 'think') {
    if (ai.timer-- <= 0) ai.phase = (ai.moveTarget != null) ? 'move' : 'aimInit';
    return;
  }

  if (ai.phase === 'move') {
    // Anda em direção ao destino, gastando combustível
    if (Math.abs(ai.moveTarget - tank.x) > 3 && tank.fuel > 0) {
      const dir = ai.moveTarget > tank.x ? 1 : -1;
      const before = tank.x;
      moveTank(tank, dir);
      if (Math.abs(tank.x - before) < 0.05) ai.phase = 'aimInit'; // travou (parede)
    } else {
      ai.phase = 'aimInit'; // chegou ou acabou o combustível
    }
    return;
  }

  if (ai.phase === 'aimInit') {
    // Recalcula o tiro a partir de onde parou e começa a mirar
    aiComputeAndAim(tank, ai.target);
    return;
  }

  if (ai.phase === 'aim') {
    // Move o canhão suavemente até o ângulo calculado
    const diff = ai.targetAngle - tank.angle;
    if (Math.abs(diff) <= 1.6) {
      tank.angle = ai.targetAngle;
      ai.phase = 'charge';
    } else {
      tank.angle += Math.sign(diff) * 1.6;
    }
    return;
  }

  if (ai.phase === 'charge') {
    // "Carrega" a barra de potência e dispara ao atingir o alvo
    game.power = Math.min(ai.targetPower, game.power + 0.012);
    updatePowerBar();
    if (game.power >= ai.targetPower - 0.001) {
      launchProjectile(game.power);
    }
  }
}

// Procura ângulo + potência que cheguem mais perto do alvo
function aiComputeShot(shooter, target) {
  const dir = target.x >= shooter.x ? 1 : -1;
  const below = (target.y - shooter.y) > 60; // alvo bem abaixo: considerar tiros pra baixo
  let best = { dist: Infinity, angle: dir > 0 ? 45 : 135, power: 0.7 };

  // Ângulos candidatos: sempre pra cima; e também pra baixo quando o alvo está embaixo
  const angles = [];
  for (let a = 18; a <= 82; a += 2) angles.push(dir > 0 ? a : 180 - a);
  if (below) for (let a = 18; a <= 82; a += 2) angles.push(dir > 0 ? -a : 180 + a);

  for (const angle of angles) {
    for (let power = 0.2; power <= 1.0; power += 0.04) {
      const dist = simulateShot(shooter, angle, power, target);
      if (dist < best.dist) best = { dist, angle, power };
    }
  }
  return best;
}

// Simula uma trajetória (sem afetar o jogo) e devolve a menor
// distância que o projétil chega do centro do alvo
function simulateShot(shooter, angleDeg, power, target) {
  const rad = angleDeg * Math.PI / 180;
  const speed = 6 + power * 16;
  let x = shooter.x + Math.cos(rad) * 26;
  let y = shooter.y - 12 - Math.sin(rad) * 26;
  let vx = Math.cos(rad) * speed;
  let vy = -Math.sin(rad) * speed;

  const tx = target.x, ty = target.y - 10;
  let minDist = Infinity;

  for (let i = 0; i < 500; i++) {
    vy += GRAVITY;
    vx += game.wind;
    x += vx; y += vy;

    const d = Math.hypot(x - tx, y - ty);
    if (d < minDist) minDist = d;

    if (x < -60 || x > W + 60 || y > H + 60) break;
    if (isSolid(x, y)) break; // bateu no terreno: para aqui
  }
  return minDist;
}

// ============================================================
//  Renderização
// ============================================================
function draw() {
  // Cenário de fundo (céu, sol, montanhas, estrelas) em espaço de tela
  drawBackground();

  // Tudo a partir daqui é desenhado em coordenadas de MUNDO,
  // deslocadas pela câmera.
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  // Terreno
  ctx.drawImage(terrain, 0, 0);

  if (game) {
    // Pedaços de terra voando (Desaba Tudo)
    drawCataclysm();

    // Zona de perigo das bombrocas ativas
    drawBombrocas();

    // Bombas-relógio armadas
    drawBombs();

    // Buraco Negro (DLC)
    drawBlackhole();

    // Tanques
    for (const t of game.tanks) drawTank(t);

    // Mira / trajetória prevista (somente na vez de mirar)
    if (game.state === 'aiming') drawAimGuide(game.tanks[game.current]);

    // Projéteis
    for (const p of game.projectiles) drawProjectile(p);

    // Partículas
    for (const pt of game.particles) {
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Setas (espaço de tela) apontando tanques fora da viewport
  if (game) drawOffscreenIndicators();

  // Vinheta para dar profundidade às bordas
  drawVignette();

  // Indicador de aceleração (segurando "v")
  if (fastForward) {
    ctx.save();
    ctx.font = 'bold 18px Trebuchet MS';
    ctx.textAlign = 'center';
    const txt = '» 20x';
    const w = ctx.measureText(txt).width + 20;
    ctx.fillStyle = 'rgba(20,12,38,0.7)';
    roundRect(ctx, VIEW_W / 2 - w / 2, 88, w, 26, 9);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.fillText(txt, VIEW_W / 2, 106);
    ctx.restore();
  }
}

// Mostra, na borda da tela, a direção de cada tanque fora da área visível
function drawOffscreenIndicators() {
  const m = 22; // margem da borda
  const t = game.tanks[game.current];
  if (!t || !t.alive) return;

  const sx = t.x - cam.x;          // posição na tela
  const sy = (t.y - 16) - cam.y;
  if (sx >= m && sx <= VIEW_W - m && sy >= m && sy <= VIEW_H - m) return;

  // Direção do centro da tela até o tanque
  const cxs = VIEW_W / 2, cys = VIEW_H / 2;
  const ang = Math.atan2(sy - cys, sx - cxs);
  // Projeta na borda (clampando aos limites internos)
  const ex = Math.max(m, Math.min(VIEW_W - m, sx));
  const ey = Math.max(m, Math.min(VIEW_H - m, sy));

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Estrelas fixas (pré-calculadas) espalhadas pela abóbada do céu
const STARS = [];
for (let i = 0; i < 90; i++) {
  STARS.push({
    x: Math.random() * VIEW_W,
    y: Math.random() * VIEW_H * 0.55,
    r: Math.random() * 1.4 + 0.4,
    tw: Math.random() * Math.PI * 2, // fase do brilho
  });
}

let bgTime = 0;
let cloudOffset = 0;

// Cenário de dia: céu azul, sol claro, montanhas e nuvens brancas
function drawBackground() {
  bgTime += 0.02;

  // Profundidade (0 = superfície, 1 = fundo do mundo)
  const depth = H > VIEW_H ? Math.min(1, Math.max(0, cam.y / (H - VIEW_H))) : 0;

  const sc = renderScene;

  // Céu em degradê (cores do cenário)
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0.00, sc.sky[0]);
  g.addColorStop(0.45, sc.sky[1]);
  g.addColorStop(0.80, sc.sky[2]);
  g.addColorStop(1.00, sc.sky[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Estrelas (cenários noturnos / espaciais)
  if (sc.stars) {
    for (const s of STARS) {
      const tw = 0.5 + 0.5 * Math.sin(bgTime * 2 + s.tw);
      ctx.globalAlpha = (0.4 + tw * 0.6) * (1 - depth);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sol / Lua, lá no alto
  const sunX = VIEW_W * 0.8 - cam.x * 0.04;
  const sunY = VIEW_H * 0.2 - cam.y * 0.06;
  const sunR = 56;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunR * 3.4);
  glow.addColorStop(0, `rgba(${sc.orb.glow},0.85)`);
  glow.addColorStop(1, `rgba(${sc.orb.glow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = sc.orb.color;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Crateras quando é lua
  if (sc.orb.moon) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(sunX - 16, sunY - 10, 9, 0, Math.PI * 2);
    ctx.arc(sunX + 14, sunY + 8, 7, 0, Math.PI * 2);
    ctx.arc(sunX + 4, sunY - 16, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Camadas de montanhas em parallax (cores do cenário)
  drawMountains(0.10, VIEW_H * 0.70, 70, sc.mtn[0], 1.3, cam, depth);
  drawMountains(0.20, VIEW_H * 0.80, 95, sc.mtn[1], 2.1, cam, depth);

  // Nuvens brancas fofas (escondidas em cenários espaciais)
  if (sc.clouds) {
    cloudOffset += 0.12;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - depth)})`;
    const span = VIEW_W + 320;
    const parX = cam.x * 0.25;
    const cpy = cam.y * 0.3;
    for (let i = 0; i < 6; i++) {
      const cx = (((i * 270 + cloudOffset - parX) % span) + span) % span - 160;
      const cy = 60 + (i % 3) * 30 - cpy;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 74, 24, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 52, cy + 8, 52, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 44, cy + 9, 44, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Escurecimento subterrâneo conforme a câmera desce
  if (depth > 0.001) {
    ctx.fillStyle = `rgba(20,12,6,${depth * 0.82})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawMountains(parallax, baseY, amp, color, seed, cam, depth) {
  const off = cam.x * parallax;
  const vy = cam.y * (parallax * 1.1);
  ctx.fillStyle = color;
  ctx.globalAlpha = 1 - depth * 0.7;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= VIEW_W; sx += 10) {
    const wx = sx + off;
    const h = baseY
      + Math.sin(wx * 0.0022 + seed) * amp
      + Math.sin(wx * 0.006 + seed * 2) * amp * 0.35;
    ctx.lineTo(sx, h - vy);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Vinheta sutil escurecendo os cantos da tela
function drawVignette() {
  const vg = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawTank(t) {
  if (!t.alive) {
    // Caveira rolante
    ctx.save();
    ctx.translate(t.x, t.y - 9);
    ctx.rotate(t.roll);
    drawPixelIcon(ctx, 'skull', 0, 0, 2.4);
    ctx.restore();
    return;
  }

  // Sombra no chão
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 1, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.lineJoin = 'round';
  if (t.skin === 'fantasma') ctx.globalAlpha = 0.5; // skin DLC: semitransparente
  const ink = '#140a1e'; // contorno escuro de todo o tanque

  // Esteiras
  ctx.fillStyle = '#241a33';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  roundRect(ctx, -20, -10, 40, 12, 5);
  ctx.fill();
  ctx.stroke();
  // Rodas
  ctx.fillStyle = '#4b3b63';
  for (let i = -15; i <= 15; i += 10) {
    ctx.beginPath();
    ctx.arc(i, -3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Corpo
  ctx.fillStyle = t.color;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  roundRect(ctx, -16, -22, 32, 14, 4);
  ctx.fill();
  ctx.stroke();
  // Brilho
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRect(ctx, -13, -20, 26, 4, 2);
  ctx.fill();

  // Torre
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(0, -22, 9, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  // Detalhe da skin (DLC) — mantém a cor do time como base
  if (t.skin === 'listrado') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let sx = -12; sx < 14; sx += 8) ctx.fillRect(sx, -22, 3, 14);
  } else if (t.skin === 'neon') {
    ctx.save();
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -16, -22, 32, 14, 4);
    ctx.stroke();
    ctx.restore();
  } else if (t.skin === 'camuflado') {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.arc(-6, -16, 4, 0, Math.PI * 2);
    ctx.arc(6, -19, 3, 0, Math.PI * 2);
    ctx.arc(2, -12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.skin === 'dourado') {
    ctx.fillStyle = 'rgba(251,191,36,0.55)';
    roundRect(ctx, -16, -22, 32, 14, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    roundRect(ctx, -13, -20, 18, 3, 2);
    ctx.fill();
  } else if (t.skin === 'cromado') {
    ctx.fillStyle = 'rgba(226,232,240,0.5)';
    roundRect(ctx, -16, -22, 32, 14, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-13, -21, 26, 2);
  } else if (t.skin === 'cyber') {
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-14, -15); ctx.lineTo(14, -15);
    ctx.moveTo(-8, -22); ctx.lineTo(-8, -8);
    ctx.moveTo(6, -22); ctx.lineTo(6, -8);
    ctx.stroke();
    ctx.restore();
  } else if (t.skin === 'zebra') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let sx = -14; sx < 14; sx += 7) ctx.fillRect(sx, -22, 2, 14);
  }

  // Canhão
  const rad = t.angle * Math.PI / 180;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(Math.cos(rad) * 26, -24 - Math.sin(rad) * 26);
  ctx.stroke();
  ctx.strokeStyle = '#c9b8e0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(Math.cos(rad) * 24, -24 - Math.sin(rad) * 24);
  ctx.stroke();

  ctx.restore();

  // Barra de vida sobre o tanque (relativa ao máximo do modo de jogo)
  const bw = 36;
  const hr = Math.max(0, t.health / t.maxHealth);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(t.x - bw / 2, t.y - 46, bw, 5);
  ctx.fillStyle = hr > 0.5 ? '#4ade80' : hr > 0.25 ? '#fde047' : '#f87171';
  ctx.fillRect(t.x - bw / 2, t.y - 46, bw * hr, 5);

  // Marca de tanque controlado por jogador (humano)
  if (!t.isAI) {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 50, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Indicador da vez
  if (game.state !== 'over' && game.tanks[game.current] === t) {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 52);
    ctx.lineTo(t.x - 6, t.y - 60);
    ctx.lineTo(t.x + 6, t.y - 60);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCataclysm() {
  const c = game.cataclysm;
  if (!c) return;
  for (const ch of c.chunks) {
    if (ch.settled) continue; // já carimbado no terreno
    ctx.save();
    ctx.translate(ch.x, ch.y);
    ctx.rotate(ch.rot);
    ctx.fillStyle = ch.color;
    chunkPath(ctx, ch);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawBombrocas() {
  for (const b of game.bombrocas) {
    const secs = Math.ceil(b.timer / 60);
    const glow = 0.5 + 0.5 * Math.sin(b.t * 0.2);

    // Aura de "apagamento" ao redor da ponta
    ctx.save();
    ctx.globalAlpha = 0.10 + glow * 0.10;
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dardo cravado, apontando na direção do impacto, tremendo um pouco
    const shake = Math.sin(b.t * 0.7) * 0.05;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate((b.angle || Math.PI / 2) + shake);
    // haste
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    // ponta brilhante
    ctx.fillStyle = '#fae8ff';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    // penas traseiras
    ctx.fillStyle = '#a21caf';
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-38, -7);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-38, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Ícone de tachinha + contador de segundos restantes
    drawPixelIcon(ctx, 'dart', b.x, b.y - b.radius - 30, 1.6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(secs + 's', b.x, b.y - b.radius - 10);
    ctx.fillText(secs + 's', b.x, b.y - b.radius - 10);
  }
}

function drawBombs() {
  for (const b of game.bombs) {
    b.t++;
    const pending = game.pendingBlasts.includes(b);
    const blinkSpeed = pending ? 5 : 24;     // pisca rápido quando vai estourar
    const on = Math.floor(b.t / blinkSpeed) % 2 === 0;

    ctx.save();
    ctx.translate(b.x, b.y - 11);

    // Corpo metálico
    ctx.fillStyle = '#334155';
    roundRect(ctx, -11, -11, 22, 20, 5);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Luz piscante no topo
    ctx.fillStyle = on ? '#ef4444' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(0, -15, 4, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, -15, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Mostrador
    drawPixelIcon(ctx, 'clock', 0, -1, 1.3);
    ctx.restore();

    // Contador de turnos acima da bomba
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 13px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.max(0, b.fuse)), b.x, b.y - 30);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawProjectile(p) {
  // Rastro
  for (let i = 0; i < p.trail.length; i++) {
    ctx.globalAlpha = (i / p.trail.length) * 0.5;
    ctx.fillStyle = p.weapon.color;
    ctx.beginPath();
    ctx.arc(p.trail[i].x, p.trail[i].y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Foguete / míssil teleguiado (Ímã): aponta na direção do voo
  if (p.weapon.rocket || p.weapon.magnet) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    // chama de propulsão atrás (enquanto há empuxo)
    if (p.rocketFuel > 0 || p.weapon.magnet) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-11, -4);
      ctx.lineTo(-20 - Math.random() * 8, 0);
      ctx.lineTo(-11, 4);
      ctx.closePath();
      ctx.fill();
    }
    // corpo do foguete
    ctx.fillStyle = '#e5e7eb';
    roundRect(ctx, -11, -4, 18, 8, 3);
    ctx.fill();
    // ponta vermelha (cone)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(7, -4);
    ctx.lineTo(15, 0);
    ctx.lineTo(7, 4);
    ctx.closePath();
    ctx.fill();
    // aletas
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-11, -4); ctx.lineTo(-14, -7); ctx.lineTo(-7, -4); ctx.closePath();
    ctx.moveTo(-11, 4); ctx.lineTo(-14, 7); ctx.lineTo(-7, 4); ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // Projétil em forma de obus, girando: a frente acompanha a
  // trajetória e ele rotaciona sobre o próprio eixo enquanto voa.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx) + p.spin);
  ctx.fillStyle = p.weapon.color;
  roundRect(ctx, -7, -3.5, 14, 7, 3.5); // corpo do obus
  ctx.fill();
  // Ponta clara
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(5, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Aletas traseiras
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(-7, -3.5);
  ctx.lineTo(-11, -5);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-11, 5);
  ctx.lineTo(-7, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAimGuide(t) {
  const tip = t.barrelTip;
  const rad = t.angle * Math.PI / 180;
  const speed = 6 + game.power * 16;
  let x = tip.x, y = tip.y;
  let vx = Math.cos(rad) * speed;
  let vy = -Math.sin(rad) * speed;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 30; i++) {
    vy += GRAVITY;
    vx += game.wind;
    x += vx; y += vy;
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (x < 0 || x > W || y > H) break;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============================================================
//  HUD (DOM)
// ============================================================
function updateHUD() {
  if (!game) return;

  // Barra e rótulo por time: fração de tanques vivos
  for (let tm = 0; tm < 2; tm++) {
    const team = game.teams[tm];
    const alive = team.filter(t => t.alive).length;
    document.getElementById(tm === 0 ? 'p1-health' : 'p2-health').style.width =
      (alive / team.length * 100) + '%';
    document.getElementById(tm === 0 ? 'p1-name' : 'p2-name').textContent =
      team.length > 1 ? 'TIME ' + (tm + 1) + '  ' + alive + '/' + team.length : team[0].name;
  }

  const cur = game.tanks[game.current];
  document.getElementById('turn-display').textContent = 'Vez: ' + cur.name;
  document.getElementById('turn-display').style.color = cur.color;

  document.getElementById('angle-val').textContent = Math.round(cur.angle) + '°';
  const wp = game.weapons[game.weaponIndex];
  document.getElementById('weapon-val').innerHTML =
    pixelIconImg(wp.icon, 2) + ' ' + wp.name;
  document.getElementById('fuel-val').textContent = Math.round(cur.fuel);

  // Vento
  const w = game.wind;
  const arrow = w > 0.005 ? '→' : w < -0.005 ? '←' : '·';
  const strength = Math.round(Math.abs(w) * 1000);
  document.getElementById('wind-val').textContent = arrow + ' ' + strength;

  // Destaca o time da vez
  document.getElementById('p1-info').classList.toggle('dimmed', game.activeTeam !== 0);
  document.getElementById('p2-info').classList.toggle('dimmed', game.activeTeam !== 1);
}

function updatePowerBar() {
  document.getElementById('power-fill').style.width = (game.power * 100) + '%';
}

// ============================================================
//  Overlays
// ============================================================
const overlay = document.getElementById('overlay');
const overlayBox = document.getElementById('overlay-box');
const MENU_HTML = overlayBox.innerHTML; // guarda o menu inicial para poder voltar

// Setups dos modos clássicos (1 tanque por time)
const SETUPS = {
  pvp: { teams: [[false], [false]] },
  pvc: { teams: [[false], [true]] },
};

function showMenu() {
  game = null;
  renderScene = SCENES[loadout.scene] || SCENES.dia; // o menu mostra o cenário escolhido
  overlayBox.innerHTML = MENU_HTML;
  fillIconPlaceholders(overlayBox);
  wireMenu();
  overlay.classList.remove('hidden');
}

function wireMenu() {
  document.getElementById('start-pvp').addEventListener('click', () => {
    overlay.classList.add('hidden');
    startGame(SETUPS.pvp);
  });
  document.getElementById('start-pvc').addEventListener('click', () => {
    overlay.classList.add('hidden');
    startGame(SETUPS.pvc);
  });
  document.getElementById('start-giga').addEventListener('click', showGigaConfig);
  document.getElementById('start-sandbox').addEventListener('click', () => {
    loadout.mode = 'sandbox';      // força o modo Sandbox
    overlay.classList.add('hidden');
    startGame(SETUPS.pvc);         // jogador contra o COM
  });
  document.getElementById('open-shop').addEventListener('click', openShop);
  document.getElementById('open-credits').addEventListener('click', showCredits);
  const fusionBtn = document.getElementById('open-fusion');
  if (fusionBtn) fusionBtn.addEventListener('click', showFusion);
  const installBtn = document.getElementById('install-app');
  if (installBtn) {
    installBtn.style.display = deferredInstallPrompt ? 'inline-block' : 'none';
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (e) {}
      deferredInstallPrompt = null;
      updateInstallButton();
    });
  }
  renderMenuExtras();
}

// Tela de créditos
function showCredits() {
  overlayBox.innerHTML = `
    <h1 style="font-size:46px;letter-spacing:5px">⭐ ${pixelIconImg('trophy', 4)} CRÉDITOS ⭐</h1>
    <p class="subtitle">TANKY — Batalha de Tanques por Turnos</p>
    <div class="credits-box">
      <p class="cr-role">✨ Criação · Programação · Arte · Game design ✨</p>
      <p class="cr-name">🎮 Caio Henrique Barros Vilela 🎮</p>
      <p class="cr-line">🎉 Meu primeiro jogo — 27 de junho de 2026 🎉</p>
      <p class="cr-line">💻 Feito do zero em HTML, CSS e JavaScript</p>
      <p class="cr-line">🤖 Agradecimento especial ao Claude (Anthropic) pela ajuda 🙏</p>
      <p class="cr-line cr-family">❤️ Este jogo foi feito para a minha família e também para os meus amigos ❤️</p>
    </div>
    <div class="btn-row" style="margin-top:18px">
      <a class="start-btn cr-site" href="https://cacaivilela.github.io/" target="_blank" rel="noopener">MEU SITE</a>
      <button id="cr-back" class="start-btn" style="background:linear-gradient(#64748b,#475569);box-shadow:0 6px 0 #334155">VOLTAR</button>
    </div>
  `;
  document.getElementById('cr-back').addEventListener('click', showMenu);
}

// Saldo de moedas + seletores de cenário/modo/skins (só o que está liberado)
function renderMenuExtras() {
  document.getElementById('coins-bar').innerHTML =
    pixelIconImg('coin', 2) + ' ' + dlcState.coins;

  const host = document.getElementById('loadout');
  host.innerHTML = '';
  host.appendChild(makeSelector('Cenário', unlockedScenes(), loadout.scene, id => {
    loadout.scene = id;
    renderScene = SCENES[id]; // pré-visualiza no fundo do menu
  }));
  host.appendChild(makeSelector('Modo', unlockedModes(), loadout.mode, id => {
    loadout.mode = id;
  }));
  host.appendChild(makeSelector('Arena', Object.values(ARENAS), loadout.arena, id => {
    loadout.arena = id;
  }));
  host.appendChild(makeSelector('Skin T1', unlockedSkins(), loadout.skins[0], id => {
    loadout.skins[0] = id;
  }));
  host.appendChild(makeSelector('Skin T2', unlockedSkins(), loadout.skins[1], id => {
    loadout.skins[1] = id;
  }));
}

// Seletor cíclico "‹ valor ›"
function makeSelector(label, opts, currentId, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'ld-row';
  let idx = Math.max(0, opts.findIndex(o => o.id === currentId));
  const render = () => {
    wrap.innerHTML =
      `<span class="ld-label">${label}</span>` +
      `<button class="ld-arrow" data-d="-1">‹</button>` +
      `<span class="ld-val">${opts[idx].name}</span>` +
      `<button class="ld-arrow" data-d="1">›</button>`;
    wrap.querySelectorAll('.ld-arrow').forEach(b => b.addEventListener('click', () => {
      idx = (idx + (+b.dataset.d) + opts.length) % opts.length;
      onChange(opts[idx].id);
      render();
    }));
  };
  render();
  return wrap;
}

// ---- Loja DLC ----
function openShop() {
  overlayBox.innerHTML = `
    <h1 style="font-size:46px;letter-spacing:5px">LOJA DLC</h1>
    <p class="subtitle">${pixelIconImg('coin', 2)} <b id="shop-coins">${dlcState.coins}</b> moedas — ganhe vencendo batalhas</p>
    <div id="shop-list"></div>
    <div class="btn-row" style="margin-top:16px">
      <button id="shop-back" class="start-btn" style="background:linear-gradient(#64748b,#475569);box-shadow:0 6px 0 #334155">VOLTAR</button>
    </div>
  `;
  renderShop();
  document.getElementById('shop-back').addEventListener('click', showMenu);
}

const downloading = {}; // packId -> porcentagem do download em andamento

function renderShop() {
  const list = document.getElementById('shop-list');
  if (!list) return;
  list.innerHTML = '';
  for (const p of DLC_PACKS) {
    const owned = ownsPack(p.id);
    const dl = downloading[p.id] != null;
    const card = document.createElement('div');
    card.className = 'dlc-card' + (owned ? ' owned' : '');

    let right;
    if (owned) {
      right = `<button class="dlc-buy" disabled>INSTALADO</button>`;
    } else if (dl) {
      right = `<div class="dl-box">
        <div class="dl-bar"><div class="dl-fill" id="dl-${p.id}" style="width:${downloading[p.id]}%"></div></div>
        <span class="dl-pct" id="dlp-${p.id}">${Math.floor(downloading[p.id])}%</span>
      </div>`;
    } else {
      right = `<button class="dlc-buy">${pixelIconImg('coin', 2) + ' ' + p.price}</button>`;
    }

    card.innerHTML = `
      <div class="dlc-ico">${pixelIconImg(owned ? p.icon : 'lock', 3)}</div>
      <div class="dlc-info">
        <div class="dlc-name">${p.name}</div>
        <div class="dlc-desc">${dl ? 'Baixando…' : p.desc}</div>
      </div>
      ${right}
    `;

    if (!owned && !dl) {
      const btn = card.querySelector('.dlc-buy');
      btn.addEventListener('click', () => {
        if (chargePack(p.id)) {
          const sc = document.getElementById('shop-coins');
          if (sc) sc.textContent = dlcState.coins;
          startDownload(p.id);
        } else {
          btn.classList.add('cant');
          setTimeout(() => btn.classList.remove('cant'), 300);
        }
      });
    }
    list.appendChild(card);
  }
}

// Anima o "download" do DLC e instala ao chegar em 100%
function startDownload(id) {
  downloading[id] = 0;
  renderShop();
  const timer = setInterval(() => {
    downloading[id] = Math.min(100, downloading[id] + 4 + Math.random() * 9);
    const fill = document.getElementById('dl-' + id);
    const pct = document.getElementById('dlp-' + id);
    if (fill) fill.style.width = downloading[id] + '%';
    if (pct) pct.textContent = Math.floor(downloading[id]) + '%';
    if (downloading[id] >= 100) {
      clearInterval(timer);
      delete downloading[id];
      finishInstall(id); // só fica disponível depois de baixar
      renderShop();
    }
  }, 120);
}

// ============================================================
//  Forja de Fusão — combina 2 armas e cria uma nova
// ============================================================
const fuse = { a: 0, b: 1 };

// Texto curto com os comportamentos da arma (para a pré-visualização)
function weaponTraits(w) {
  const t = [];
  if (w.cluster) t.push('espalha x' + w.cluster);
  if (w.napalm) t.push('fogo');
  if (w.bounce) t.push('quica x' + w.bounce);
  if (w.magnet) t.push('teleguiado');
  if (w.rocket) t.push('propulsão');
  if (w.windBlast || w.knockback) t.push('empurra');
  if (w.timed) t.push('bomba-relógio');
  if (w.dart) t.push('dardo');
  if (w.airstrike) t.push('bombardeio');
  if (w.meteorstorm) t.push('meteoros');
  if (w.meteor) t.push('meteoro');
  if (w.blackhole) t.push('buraco negro');
  if (w.cataclysm) t.push('cataclismo');
  return t.length ? t.join(' · ') : 'explosão';
}

function showFusion() {
  const pool = fusableWeapons();
  fuse.a = Math.min(fuse.a, pool.length - 1);
  fuse.b = Math.min(fuse.b, pool.length - 1);
  overlayBox.innerHTML = `
    <h1 style="font-size:38px;letter-spacing:4px">${pixelIconImg('swords', 3)} FORJA DE FUSÃO</h1>
    <p class="subtitle">${pixelIconImg('coin', 2)} <b id="fuse-coins">${dlcState.coins}</b> moedas — cada fusão custa <b>${FUSION_COST}</b></p>
    <p class="subtitle" style="font-size:13px;opacity:.85">Junte 2 armas e crie uma nova! Ela entra na roda de armas (Q/E) durante a batalha.</p>
    <div id="fuse-pickers"></div>
    <div id="fuse-preview"></div>
    <div class="btn-row" style="margin-top:6px">
      <button id="fuse-make" class="start-btn" style="background:linear-gradient(#c084fc,#7c3aed);box-shadow:0 6px 0 #5b21b6;color:#fff">${pixelIconImg('nuke', 2)} FUNDIR ARMAS</button>
    </div>
    <div class="fuse-sub">MINHAS FUSÕES</div>
    <div id="fuse-list"></div>
    <div class="btn-row" style="margin-top:14px">
      <button id="fuse-back" class="start-btn" style="background:linear-gradient(#64748b,#475569);box-shadow:0 6px 0 #334155">VOLTAR</button>
    </div>
  `;
  renderFusePickers();
  renderFusePreview();
  renderFuseList();
  document.getElementById('fuse-make').addEventListener('click', doFuse);
  document.getElementById('fuse-back').addEventListener('click', showMenu);
}

function fuseSelector(label, key, pool) {
  const wrap = document.createElement('div');
  wrap.className = 'ld-row';
  const render = () => {
    const w = pool[fuse[key]];
    wrap.innerHTML =
      `<span class="ld-label">${label}</span>` +
      `<button class="ld-arrow" data-d="-1">‹</button>` +
      `<span class="ld-val">${pixelIconImg(w.icon, 2)} ${w.name}</span>` +
      `<button class="ld-arrow" data-d="1">›</button>`;
    wrap.querySelectorAll('.ld-arrow').forEach(btn => btn.addEventListener('click', () => {
      fuse[key] = (fuse[key] + (+btn.dataset.d) + pool.length) % pool.length;
      render();
      renderFusePreview();
    }));
  };
  render();
  return wrap;
}

function renderFusePickers() {
  const host = document.getElementById('fuse-pickers');
  if (!host) return;
  const pool = fusableWeapons();
  host.innerHTML = '';
  host.appendChild(fuseSelector('Arma A', 'a', pool));
  host.appendChild(fuseSelector('Arma B', 'b', pool));
}

function renderFusePreview() {
  const host = document.getElementById('fuse-preview');
  if (!host) return;
  const pool = fusableWeapons();
  const w = fuseWeapons(pool[fuse.a], pool[fuse.b]);
  host.innerHTML = `
    <div class="fuse-card" style="border-color:${w.color}">
      <div class="dlc-ico">${pixelIconImg(w.icon, 3)}</div>
      <div class="dlc-info">
        <div class="dlc-name" style="color:${w.color}">${w.name}</div>
        <div class="dlc-desc">Dano ${w.damage} · Raio ${w.radius} · ${weaponTraits(w)}</div>
      </div>
    </div>`;
}

function doFuse() {
  const btn = document.getElementById('fuse-make');
  if (dlcState.fusions.length >= MAX_FUSIONS || dlcState.coins < FUSION_COST) {
    btn.classList.add('cant');
    setTimeout(() => btn.classList.remove('cant'), 300);
    return;
  }
  const pool = fusableWeapons();
  const w = fuseWeapons(pool[fuse.a], pool[fuse.b]);
  dlcState.coins -= FUSION_COST;
  dlcSave();
  addFusion(w);
  const sc = document.getElementById('fuse-coins');
  if (sc) sc.textContent = dlcState.coins;
  renderFuseList();
}

function renderFuseList() {
  const host = document.getElementById('fuse-list');
  if (!host) return;
  if (!dlcState.fusions.length) {
    host.innerHTML = `<p class="dlc-desc" style="text-align:center;opacity:.7;padding:8px">Nenhuma fusão ainda — crie a sua acima! (até ${MAX_FUSIONS})</p>`;
    return;
  }
  host.innerHTML = '';
  dlcState.fusions.forEach((w, i) => {
    const card = document.createElement('div');
    card.className = 'fuse-card';
    card.style.borderColor = w.color;
    card.innerHTML = `
      <div class="dlc-ico">${pixelIconImg(w.icon, 3)}</div>
      <div class="dlc-info">
        <div class="dlc-name" style="color:${w.color}">${w.name}</div>
        <div class="dlc-desc">Dano ${w.damage} · Raio ${w.radius} · ${weaponTraits(w)}</div>
      </div>
      <button class="dlc-buy fuse-del" style="background:linear-gradient(#f87171,#dc2626);box-shadow:0 4px 0 #991b1b;color:#fff">APAGAR</button>`;
    card.querySelector('.fuse-del').addEventListener('click', () => {
      removeFusion(i);
      renderFuseList();
    });
    host.appendChild(card);
  });
}

// ============================================================
//  Giga Battle — configuração (até 43 por time, cada um COM/JOGADOR)
// ============================================================
const giga = { counts: [8, 8], ai: [null, null] };

// Cria/ajusta os arrays de COM(true)/JOGADOR(false) preservando o que já existe
function gigaResize(tm, n) {
  n = Math.max(1, Math.min(MAX_PER_TEAM, n));
  const old = giga.ai[tm] || [];
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = old[i] != null ? old[i] : true; // padrão: COM
  giga.counts[tm] = n;
  giga.ai[tm] = arr;
}

function gigaInit() {
  gigaResize(0, giga.counts[0]);
  gigaResize(1, giga.counts[1]);
  giga.ai[0][0] = false; // ao menos um jogador para começar
}

function showGigaConfig() {
  if (!giga.ai[0]) gigaInit();
  overlayBox.innerHTML = `
    <h1 style="font-size:46px;letter-spacing:5px">GIGA BATTLE</h1>
    <p class="subtitle">Até ${MAX_PER_TEAM} por time — clique em cada tanque p/ alternar <b style="color:#38bdf8">JOG</b> / <b>COM</b></p>
    <div class="btn-row" style="margin-bottom:8px">
      <button id="giga-max" class="start-btn" style="font-size:14px;padding:8px 20px;background:linear-gradient(#f472b6,#db2777);box-shadow:0 5px 0 #9d174d;color:#fff">MAX ${MAX_PER_TEAM} × ${MAX_PER_TEAM}</button>
    </div>
    <div id="giga-teams"></div>
    <div class="btn-row" style="margin-top:18px">
      <button id="giga-start" class="start-btn">INICIAR BATALHA</button>
      <button id="giga-back" class="start-btn" style="background:linear-gradient(#64748b,#475569);box-shadow:0 6px 0 #334155">VOLTAR</button>
    </div>
  `;
  renderGigaTeams();
  document.getElementById('giga-max').addEventListener('click', () => {
    gigaResize(0, MAX_PER_TEAM);
    gigaResize(1, MAX_PER_TEAM);
    renderGigaTeams();
  });
  document.getElementById('giga-start').addEventListener('click', () => {
    overlay.classList.add('hidden');
    startGame({ teams: [giga.ai[0].slice(), giga.ai[1].slice()] });
  });
  document.getElementById('giga-back').addEventListener('click', showMenu);
}

function renderGigaTeams() {
  const host = document.getElementById('giga-teams');
  host.innerHTML = '';
  for (let tm = 0; tm < 2; tm++) {
    const panel = document.createElement('div');
    panel.className = 'giga-team';
    panel.style.borderColor = TEAM_COLORS[tm];
    panel.innerHTML = `
      <div class="giga-head" style="color:${TEAM_COLORS[tm]}">
        <span>TIME ${tm + 1}</span>
        <span class="giga-count">
          <button data-d="-1" data-tm="${tm}">−</button>
          <b>${giga.counts[tm]}</b>
          <button data-d="1" data-tm="${tm}">+</button>
        </span>
        <span class="giga-bulk">
          <button data-all="j" data-tm="${tm}">todos JOG</button>
          <button data-all="c" data-tm="${tm}">todos COM</button>
        </span>
      </div>
      <div class="giga-grid"></div>
    `;
    host.appendChild(panel);
    renderGigaGrid(tm, panel.querySelector('.giga-grid'));
  }

  host.querySelectorAll('button[data-d]').forEach(b => b.addEventListener('click', () => {
    gigaResize(+b.dataset.tm, giga.counts[+b.dataset.tm] + (+b.dataset.d));
    renderGigaTeams();
  }));
  host.querySelectorAll('button[data-all]').forEach(b => b.addEventListener('click', () => {
    const tm = +b.dataset.tm, v = b.dataset.all === 'c';
    for (let i = 0; i < giga.ai[tm].length; i++) giga.ai[tm][i] = v;
    renderGigaTeams();
  }));
}

function renderGigaGrid(tm, grid) {
  grid.innerHTML = '';
  for (let i = 0; i < giga.counts[tm]; i++) {
    const chip = document.createElement('button');
    const human = !giga.ai[tm][i];
    chip.className = 'giga-chip' + (human ? ' human' : '');
    chip.textContent = (i + 1) + (human ? 'J' : '');
    chip.addEventListener('click', () => {
      giga.ai[tm][i] = !giga.ai[tm][i];
      const h = !giga.ai[tm][i];
      chip.classList.toggle('human', h);
      chip.textContent = (i + 1) + (h ? 'J' : '');
    });
    grid.appendChild(chip);
  }
}

function showGameOver(winnerTeam, reward) {
  const setup = game.setup;
  const win = winnerTeam != null;
  const color = win ? TEAM_COLORS[winnerTeam] : '#fff';
  const team = win ? game.teams[winnerTeam] : null;
  const label = win
    ? (team.length > 1 ? 'TIME ' + (winnerTeam + 1) : team[0].name) + ' venceu a batalha!'
    : 'Todos os tanques foram destruídos!';
  const coinLine = reward > 0
    ? `<p class="subtitle" style="color:#fbbf24">${pixelIconImg('coin', 2)} +${reward} moedas &nbsp;·&nbsp; saldo: ${dlcState.coins}</p>`
    : '';
  overlayBox.innerHTML = `
    <h1>${win ? pixelIconImg('trophy', 5, 'pxicon') + ' VITÓRIA!' : 'EMPATE'}</h1>
    <p class="subtitle" style="color:${color}">${label}</p>
    ${coinLine}
    <div class="btn-row">
      <button id="restart-btn" class="start-btn">JOGAR DE NOVO</button>
      <button id="menu-btn" class="start-btn" style="background:linear-gradient(#64748b,#475569);box-shadow:0 6px 0 #334155">MENU</button>
    </div>
    <a class="credit" href="https://cacaivilela.github.io/" target="_blank" rel="noopener">Feito por Caio Henrique Barros Vilela</a>
  `;
  overlay.classList.remove('hidden');
  document.getElementById('restart-btn').addEventListener('click', () => {
    overlay.classList.add('hidden');
    startGame(setup);
  });
  document.getElementById('menu-btn').addEventListener('click', showMenu);
}

// ============================================================
//  Loop principal
// ============================================================
function loop() {
  const steps = fastForward ? 20 : 1; // segurar "v" acelera 20x
  for (let i = 0; i < steps; i++) update();
  draw();
  requestAnimationFrame(loop);
}

// ============================================================
//  PWA — instalar como app + service worker (funciona offline)
// ============================================================
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e; // guarda para o botão "INSTALAR APP"
  updateInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallButton();
});
function updateInstallButton() {
  const b = document.getElementById('install-app');
  if (b) b.style.display = deferredInstallPrompt ? 'inline-block' : 'none';
}

// Preenche os ícones de pixel art dos placeholders (menu, HUD) e liga o menu
fillIconPlaceholders();
wireMenu();
loop();
