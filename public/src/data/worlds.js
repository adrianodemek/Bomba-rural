// Mundos (com paleta de cores e minério próprio) e dificuldades.

export const WORLDS = [
  {
    id: 0,
    name: 'Sítio',
    mineral: { name: 'Pirita', color: 0xe8b84a, light: 0xfff1a8 },
    theme: {
      floor: [0x7a5a3e, 0x765639], speck: 0x6a4c33, hi: 0x8a6a4a, line: 0x6e5038,
      pillar: { K: 0x241d1a, H: 0x6e655c, h: 0x5a524a, S: 0x4a433d, D: 0x332d29 },
      rock: { K: 0x2e2a26, G: 0x8b8580, H: 0xbdb7ae, D: 0x5f5a55 },
      tree: { n: 0x4f9a3a, l: 0x7cc95a, g: 0x2f6b2a, T: 0x7a4e2c, t: 0x5a3820 },
      debris: { rock: 0x8b8580, tree: 0x4f9a3a },
    },
  },
  {
    id: 1,
    name: 'Floresta Antiga',
    mineral: { name: 'Âmbar', color: 0xe08a2a, light: 0xffc070 },
    theme: {
      floor: [0x4f4a2e, 0x4b4630], speck: 0x3f3a22, hi: 0x5f5a3a, line: 0x45402a,
      pillar: { K: 0x1e2416, H: 0x5e6b4a, h: 0x4e5a3c, S: 0x3f4a30, D: 0x2e3622 },
      rock: { K: 0x2a2418, G: 0x7d6e5a, H: 0xa8987e, D: 0x564a3a },
      tree: { n: 0x3f7a2a, l: 0x5ea040, g: 0x2a5020, T: 0x5a3a20, t: 0x3e2814 },
      debris: { rock: 0x7d6e5a, tree: 0x3f7a2a },
    },
  },
  {
    id: 2,
    name: 'Pico Gelado',
    mineral: { name: 'Gelo Eterno', color: 0x6fd3f5, light: 0xe6fbff },
    theme: {
      floor: [0x5a6a7a, 0x56667a], speck: 0x4a5a6a, hi: 0x7a8a9a, line: 0x4e5e6e,
      pillar: { K: 0x2a3a4a, H: 0x9ab0c8, h: 0x7a90a8, S: 0x60768e, D: 0x4a5e74 },
      rock: { K: 0x3a4a5a, G: 0xb8c8d8, H: 0xe8f0f8, D: 0x8898a8 },
      tree: { n: 0x3f7a6a, l: 0xe8f0f8, g: 0x2f5a5a, T: 0x5a4a40, t: 0x3e3028 },
      debris: { rock: 0xb8c8d8, tree: 0xe8f0f8 },
    },
  },
  {
    id: 3,
    name: 'Cânion de Ferro',
    mineral: { name: 'Ferro', color: 0xc8553d, light: 0xf0a080 },
    theme: {
      floor: [0x4a3a36, 0x463733], speck: 0x3a2c28, hi: 0x5a4a44, line: 0x3e302c,
      pillar: { K: 0x1e1a18, H: 0x7a7270, h: 0x625a58, S: 0x4e4644, D: 0x3a3432 },
      rock: { K: 0x221e1c, G: 0x6a6462, H: 0x9a9492, D: 0x4a4442 },
      tree: { n: 0x6a5a40, l: 0x8a7a5a, g: 0x4a3a28, T: 0x3e2e20, t: 0x2a1e14 },
      debris: { rock: 0x6a6462, tree: 0x6a5a40 },
    },
  },
  {
    id: 4,
    name: 'Ruínas de Cristal',
    mineral: { name: 'Ametista', color: 0xb88cf0, light: 0xf0e0ff },
    theme: {
      floor: [0x3a2e4a, 0x372b46], speck: 0x2e2440, hi: 0x4a3e5e, line: 0x30263e,
      pillar: { K: 0x1a1426, H: 0x6e5a8a, h: 0x5a4874, S: 0x483a60, D: 0x352a48 },
      rock: { K: 0x241c30, G: 0x7a6a8e, H: 0xa898c0, D: 0x564a6a },
      tree: { n: 0x8a6ad0, l: 0xc8b0ff, g: 0x5a40a0, T: 0x4a3a6a, t: 0x30244a },
      debris: { rock: 0x7a6a8e, tree: 0x8a6ad0 },
    },
  },
];

// Zonas: cada mundo tem 3 (8 fases cada). sky = céu aberto (tem manhã, tarde e noite).
// weather: partículas do clima (ver BattleScene.setAmbience).
export const ZONES = [
  [
    { name: 'Pasto', sky: true, weather: 'petals' },
    { name: 'Milharal', sky: true, weather: 'chaff' },
    { name: 'Pedreira', sky: true, weather: 'dust' },
  ],
  [
    { name: 'Trilha', sky: true, weather: 'leaves' },
    { name: 'Pântano', sky: true, weather: 'fireflies' },
    { name: 'Árvore-Mãe', sky: false, weather: 'spores' },
  ],
  [
    { name: 'Encosta Nevada', sky: true, weather: 'snow' },
    { name: 'Lago Congelado', sky: true, weather: 'snow' },
    { name: 'Caverna de Gelo', sky: false, weather: 'glints' },
  ],
  [
    { name: 'Ferrovia', sky: true, weather: 'sand' },
    { name: 'Ferro-velho', sky: true, weather: 'embers' },
    { name: 'Fundição', sky: false, weather: 'embers' },
  ],
  [
    { name: 'Templo', sky: true, weather: 'motes' },
    { name: 'Jardim Flutuante', sky: true, weather: 'motes' },
    { name: 'Abismo', sky: false, weather: 'motes' },
  ],
];

export const DIFFICULTIES = ['Fácil', 'Normal', 'Difícil', 'Muito Difícil', 'Inferno'];
export const DIFFICULTY_SHORT = ['Fácil', 'Normal', 'Difícil', 'M. Difícil', 'Inferno'];
export const DIFFICULTY_COLORS = ['#9be37a', '#ffd86a', '#ff9a4a', '#ff6a5a', '#e04ad0'];

// Colossos da semana (um por semana, em rodízio). armor = dureza: quanto mais alta, mais a Penetração vale.
export const COLOSSI = [
  { name: 'Colosso de Ferro', world: 3, armor: 0.55, tip: 'Dureza alta: Penetração vale muito esta semana.' },
  { name: 'Colosso de Gelo', world: 2, armor: 0.2, tip: 'Dureza baixa: Ataque e críticos brilham esta semana.' },
  { name: 'Colosso de Âmbar', world: 1, armor: 0.4, tip: 'Dureza média: equilibre Ataque e Penetração.' },
  { name: 'Colosso de Ametista', world: 4, armor: 0.3, tip: 'Recarga e Velocidade fazem diferença nos 2 minutos.' },
];
