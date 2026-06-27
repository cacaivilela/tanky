// ============================================================
//  TANKY — DLCs (loja com desbloqueio)
//  Dados dos pacotes + conteúdo + carteira (moedas) salvos no
//  navegador (localStorage). A UI da loja vive em game.js.
// ============================================================

// ---- Pacotes compráveis ----
const DLC_PACKS = [
  { id: 'arsenal',   name: 'Arsenal Cósmico',  icon: 'nuke',   price: 150,
    desc: '3 armas novas: Buraco Negro, Chuva de Meteoros e Ogiva Nuclear.' },
  { id: 'skins',     name: 'Skins Lendárias',  icon: 'tank',   price: 100,
    desc: '4 visuais de tanque: Listrado, Néon, Camuflado e Fantasma.' },
  { id: 'dimensoes', name: 'Outras Dimensões', icon: 'rocket', price: 200,
    desc: '5 cenários com física própria: Noite, Deserto, Vulcão, Lua e Espaço.' },
  { id: 'modos',     name: 'Regras Caóticas',  icon: 'flame',  price: 120,
    desc: '4 modos: Morte Súbita, Furacão, Gravidade Baixa e Vida Tripla.' },

  // ---- DLCs extras ----
  { id: 'arsenal_pesado',  name: 'Arsenal Pesado',     icon: 'bomb',   price: 180,
    desc: '2 armas brutais: Dinamite e Estilhaço.' },
  { id: 'arsenal_exotico', name: 'Arsenal Exótico',    icon: 'wind',   price: 170,
    desc: '3 armas: Bumerangue, Vendaval e Míssil Burro.' },
  { id: 'arsenal_fogo',    name: 'Arsenal Inflamável', icon: 'flame',  price: 170,
    desc: '2 armas de fogo: Lança-Chamas e Mini Nuke.' },
  { id: 'skins_metal',     name: 'Skins Metálicas',    icon: 'tank',   price: 110,
    desc: '2 visuais reluzentes: Dourado e Cromado.' },
  { id: 'skins_cyber',     name: 'Skins Cyber',        icon: 'tank',   price: 110,
    desc: '2 visuais: Cyber (circuitos) e Zebra.' },
  { id: 'dim_gelo',        name: 'Dimensão Glacial',   icon: 'rocket', price: 160,
    desc: '2 cenários gelados: Gelo e Nevasca.' },
  { id: 'dim_fogo',        name: 'Dimensão Infernal',  icon: 'flame',  price: 160,
    desc: '2 cenários ardentes: Inferno e Cinzas.' },
  { id: 'dim_doce',        name: 'Dimensão Doce',      icon: 'coin',   price: 140,
    desc: '2 cenários: Algodão Doce e Tóxico.' },
  { id: 'modos_extremos',  name: 'Modos Extremos',     icon: 'nuke',   price: 140,
    desc: '3 modos: Caos, Relâmpago e Pesadão.' },
  { id: 'modos_zen',       name: 'Modos Tranquilos',   icon: 'clock',  price: 120,
    desc: '3 modos: Maratona, Brisa e Lua Total.' },
];

// ---- Armas extras (entram na roda quando o pacote é adquirido) ----
const EXTRA_WEAPONS = [
  { pack: 'arsenal', name: 'Buraco Negro',      icon: 'blackhole', radius: 46, damage: 30, color: '#a855f7', cluster: 0, blackhole: true },
  { pack: 'arsenal', name: 'Chuva de Meteoros', icon: 'meteor',    radius: 32, damage: 24, color: '#fb923c', cluster: 0, airstrike: 500 },
  { pack: 'arsenal', name: 'Ogiva Nuclear',     icon: 'nuke',      radius: 95, damage: 80, color: '#fde047', cluster: 6, napalm: true },

  { pack: 'arsenal_pesado',  name: 'Dinamite',     icon: 'bomb',    radius: 70, damage: 70, color: '#f59e0b', cluster: 0 },
  { pack: 'arsenal_pesado',  name: 'Estilhaço',    icon: 'cluster', radius: 24, damage: 18, color: '#a78bfa', cluster: 10 },
  { pack: 'arsenal_exotico', name: 'Bumerangue',   icon: 'bounce',  radius: 36, damage: 34, color: '#84cc16', cluster: 0, bounce: 6 },
  { pack: 'arsenal_exotico', name: 'Vendaval',     icon: 'wind',    radius: 50, damage: 6,  color: '#67e8f9', cluster: 0, knockback: 6, windBlast: true },
  { pack: 'arsenal_exotico', name: 'Míssil Burro', icon: 'rocket',  radius: 34, damage: 42, color: '#fb7185', cluster: 0, rocket: true },
  { pack: 'arsenal_fogo',    name: 'Lança-Chamas', icon: 'flame',   radius: 44, damage: 28, color: '#f97316', cluster: 14, napalm: true },
  { pack: 'arsenal_fogo',    name: 'Mini Nuke',    icon: 'nuke',    radius: 72, damage: 60, color: '#fde047', cluster: 4, napalm: true },
];

// ---- Armas exclusivas do modo Sandbox ----
const SANDBOX_WEAPONS = [
  { name: 'Ctrl + D', icon: 'ctrld', radius: 30, damage: 0, color: '#f43f5e', cluster: 0, deleteAll: true },
];

// ---- Skins (aplicadas por time; 'classic' é grátis) ----
const SKINS = {
  classic:   { id: 'classic',   name: 'Clássico' },
  listrado:  { id: 'listrado',  pack: 'skins', name: 'Listrado' },
  neon:      { id: 'neon',      pack: 'skins', name: 'Néon' },
  camuflado: { id: 'camuflado', pack: 'skins', name: 'Camuflado' },
  fantasma:  { id: 'fantasma',  pack: 'skins', name: 'Fantasma' },
  dourado:   { id: 'dourado',   pack: 'skins_metal', name: 'Dourado' },
  cromado:   { id: 'cromado',   pack: 'skins_metal', name: 'Cromado' },
  cyber:     { id: 'cyber',     pack: 'skins_cyber', name: 'Cyber' },
  zebra:     { id: 'zebra',     pack: 'skins_cyber', name: 'Zebra' },
};

// ---- Cenários / Dimensões (cores do ambiente + física própria) ----
const SCENES = {
  dia: {
    id: 'dia', name: 'Dia',
    sky: ['#2f7fc4', '#5ba6e0', '#a9d8f2', '#e4f4ff'],
    orb: { color: '#fffceb', glow: '255,250,210', moon: false },
    mtn: ['#9fc0d6', '#6fa06a'],
    terr: { body: ['#9b6b3f', '#7a5230', '#3d2a16'], crust: '#8a5e38', grass: '#6cc24a', grassHi: '#bff08a' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1,
  },
  noite: {
    id: 'noite', pack: 'dimensoes', name: 'Noite',
    sky: ['#0b1026', '#1a2348', '#2a3a6b', '#3a4a7a'],
    orb: { color: '#e8eefc', glow: '200,210,255', moon: true },
    mtn: ['#2a3556', '#1f2b44'],
    terr: { body: ['#3a2f4a', '#2a2238', '#150f22'], crust: '#4a3a5e', grass: '#3a6a4a', grassHi: '#6aa07a' },
    stars: true, clouds: true, gravityMul: 1, windMul: 1,
  },
  deserto: {
    id: 'deserto', pack: 'dimensoes', name: 'Deserto',
    sky: ['#e8a85c', '#f0c07a', '#f6d99a', '#fcefc8'],
    orb: { color: '#fff6d0', glow: '255,230,160', moon: false },
    mtn: ['#c89a6a', '#b07a4a'],
    terr: { body: ['#e0b870', '#c89a55', '#8a6a35'], crust: '#d4a860', grass: '#cfae5e', grassHi: '#f0d68a' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1.4,
  },
  vulcao: {
    id: 'vulcao', pack: 'dimensoes', name: 'Vulcão',
    sky: ['#2a1015', '#5a1a1f', '#8a2a20', '#c24a2a'],
    orb: { color: '#ffcf8a', glow: '255,120,40', moon: false },
    mtn: ['#3a1a1f', '#5a2520'],
    terr: { body: ['#5a2a20', '#3a1a14', '#1a0a08'], crust: '#7a3a20', grass: '#c2410c', grassHi: '#fb923c' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1,
  },
  lua: {
    id: 'lua', pack: 'dimensoes', name: 'Lua',
    sky: ['#05060a', '#0a0e1a', '#12182a', '#1a2236'],
    orb: { color: '#eef0f5', glow: '220,225,240', moon: true },
    mtn: ['#2a2f3a', '#1f2430'],
    terr: { body: ['#8a8a92', '#5a5a62', '#2a2a30'], crust: '#9a9aa2', grass: '#b0b0b8', grassHi: '#e0e0e8' },
    stars: true, clouds: false, gravityMul: 0.45, windMul: 0.4,
  },
  espaco: {
    id: 'espaco', pack: 'dimensoes', name: 'Espaço',
    sky: ['#000008', '#04040f', '#080818', '#0a0a22'],
    orb: { color: '#cfe0ff', glow: '120,150,255', moon: true },
    mtn: ['#15152a', '#0f0f1f'],
    terr: { body: ['#3a3a55', '#252540', '#101020'], crust: '#4a4a66', grass: '#6a6aff', grassHi: '#a0a0ff' },
    stars: true, clouds: false, gravityMul: 0.35, windMul: 0,
  },
  gelo: {
    id: 'gelo', pack: 'dim_gelo', name: 'Gelo',
    sky: ['#bce3f5', '#d6eefb', '#eaf6ff', '#ffffff'],
    orb: { color: '#ffffff', glow: '220,240,255', moon: false },
    mtn: ['#9bbcd2', '#bcd6e8'],
    terr: { body: ['#bcd6e8', '#9bbcd2', '#6a8ba0'], crust: '#cfe6f2', grass: '#e8f6ff', grassHi: '#ffffff' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1,
  },
  nevasca: {
    id: 'nevasca', pack: 'dim_gelo', name: 'Nevasca',
    sky: ['#5b6b7a', '#7e8c9a', '#a9b6c2', '#cdd6de'],
    orb: { color: '#e8eef4', glow: '210,225,235', moon: false },
    mtn: ['#6b7884', '#8b98a4'],
    terr: { body: ['#c2cdd6', '#9aa6b0', '#6a747e'], crust: '#d8e2ea', grass: '#eef4f8', grassHi: '#ffffff' },
    stars: false, clouds: true, gravityMul: 1, windMul: 2,
  },
  inferno: {
    id: 'inferno', pack: 'dim_fogo', name: 'Inferno',
    sky: ['#1a0608', '#3a0c0e', '#6a1410', '#a83218'],
    orb: { color: '#ff9a3c', glow: '255,90,20', moon: false },
    mtn: ['#3a1410', '#5a2018'],
    terr: { body: ['#5a1f12', '#3a120a', '#180704'], crust: '#7a3018', grass: '#ff5722', grassHi: '#ffd54a' },
    stars: false, clouds: false, gravityMul: 1, windMul: 1,
  },
  cinzas: {
    id: 'cinzas', pack: 'dim_fogo', name: 'Cinzas',
    sky: ['#2a2a2a', '#454545', '#666666', '#8a8a8a'],
    orb: { color: '#d8c8b0', glow: '180,160,130', moon: false },
    mtn: ['#3a3a3a', '#545454'],
    terr: { body: ['#5a5550', '#3a3632', '#1c1a18'], crust: '#6a6258', grass: '#7a7268', grassHi: '#b0a896' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1.3,
  },
  doce: {
    id: 'doce', pack: 'dim_doce', name: 'Algodão Doce',
    sky: ['#ff9ecf', '#ffb8da', '#ffd1e6', '#fff0f7'],
    orb: { color: '#fffafc', glow: '255,200,230', moon: false },
    mtn: ['#e57bb0', '#c95a96'],
    terr: { body: ['#f7a8d0', '#e87bb0', '#b95a8f'], crust: '#ffc1e2', grass: '#ff5ea8', grassHi: '#ffd1ec' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1,
  },
  toxico: {
    id: 'toxico', pack: 'dim_doce', name: 'Tóxico',
    sky: ['#1a2a10', '#2f4a18', '#4a6a22', '#7a9a3a'],
    orb: { color: '#d8ff7a', glow: '160,255,80', moon: false },
    mtn: ['#2f4a18', '#456a22'],
    terr: { body: ['#3a5a1a', '#2a4012', '#142808'], crust: '#4a6a22', grass: '#7aff3a', grassHi: '#c8ff8a' },
    stars: false, clouds: true, gravityMul: 1, windMul: 1,
  },
};

// ---- Modos de jogo (modificadores; 'normal' é grátis) ----
const GAME_MODES = {
  normal:       { id: 'normal',       name: 'Normal',          hp: 100, gravityMul: 1,   windMul: 1 },
  sandbox:      { id: 'sandbox',      name: 'Sandbox',         hp: 999, gravityMul: 1,   windMul: 1, sandbox: true },
  morte_subita: { id: 'morte_subita', pack: 'modos', name: 'Morte Súbita',    hp: 45,  gravityMul: 1,   windMul: 1 },
  furacao:      { id: 'furacao',      pack: 'modos', name: 'Furacão',         hp: 100, gravityMul: 1,   windMul: 3.5 },
  grav_baixa:   { id: 'grav_baixa',   pack: 'modos', name: 'Gravidade Baixa', hp: 100, gravityMul: 0.4, windMul: 1 },
  vida_tripla:  { id: 'vida_tripla',  pack: 'modos', name: 'Vida Tripla',     hp: 300, gravityMul: 1,   windMul: 1 },

  caos:        { id: 'caos',        pack: 'modos_extremos', name: 'Caos',       hp: 60,  gravityMul: 0.7, windMul: 2.5 },
  relampago:   { id: 'relampago',   pack: 'modos_extremos', name: 'Relâmpago',  hp: 40,  gravityMul: 1,   windMul: 2 },
  pesadao:     { id: 'pesadao',     pack: 'modos_extremos', name: 'Pesadão',    hp: 100, gravityMul: 1.8, windMul: 1 },
  maratona:    { id: 'maratona',    pack: 'modos_zen',      name: 'Maratona',   hp: 250, gravityMul: 1,   windMul: 1 },
  brisa:       { id: 'brisa',       pack: 'modos_zen',      name: 'Brisa',      hp: 100, gravityMul: 1,   windMul: 0.3 },
  lua_total:   { id: 'lua_total',   pack: 'modos_zen',      name: 'Lua Total',  hp: 100, gravityMul: 0.25, windMul: 0.5 },
};

// ============================================================
//  Carteira / progresso (localStorage)
// ============================================================
const SAVE_KEY = 'tanky_save_v1';
const STARTING_COINS = 250; // bônus de boas-vindas para já dar pra comprar algo
const dlcState = { coins: STARTING_COINS, owned: [] };

function dlcLoad() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      dlcState.coins = Number.isFinite(d.coins) ? d.coins : STARTING_COINS;
      dlcState.owned = Array.isArray(d.owned) ? d.owned : [];
    } else {
      dlcSave(); // primeira vez: grava o bônus inicial
    }
  } catch (e) { /* localStorage indisponível: segue em memória */ }
}

function dlcSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(dlcState)); } catch (e) {}
}

function ownsPack(id) { return dlcState.owned.includes(id); }
function packUnlocked(packId) { return !packId || ownsPack(packId); }

function buyPack(id) {
  const p = DLC_PACKS.find(p => p.id === id);
  if (!p || ownsPack(id) || dlcState.coins < p.price) return false;
  dlcState.coins -= p.price;
  dlcState.owned.push(id);
  dlcSave();
  return true;
}

function addCoins(n) { dlcState.coins += n; dlcSave(); }

// Compra em duas etapas: cobra as moedas (chargePack) e, após o "download",
// instala o pacote (finishInstall).
function canBuyPack(id) {
  const p = DLC_PACKS.find(p => p.id === id);
  return !!p && !ownsPack(id) && dlcState.coins >= p.price;
}
function chargePack(id) {
  const p = DLC_PACKS.find(p => p.id === id);
  if (!canBuyPack(id)) return false;
  dlcState.coins -= p.price;
  dlcSave();
  return true;
}
function finishInstall(id) {
  if (!ownsPack(id)) { dlcState.owned.push(id); dlcSave(); }
}

// Listas só com o que está liberado (mais o conteúdo grátis)
function unlockedScenes() { return Object.values(SCENES).filter(s => packUnlocked(s.pack)); }
function unlockedModes()  { return Object.values(GAME_MODES).filter(m => packUnlocked(m.pack)); }
function unlockedSkins()  { return Object.values(SKINS).filter(s => packUnlocked(s.pack)); }
// Armas base (de game.js) + extras adquiridas
function activeWeapons()  { return WEAPONS.concat(EXTRA_WEAPONS.filter(w => ownsPack(w.pack))); }

dlcLoad();
