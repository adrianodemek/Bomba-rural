// Arte provisória em pixel art, gerada por código.
// Cada desenho é uma lista de linhas; cada caractere é um pixel ('.' = transparente).
import { PALETTES } from '../data/heroes.js';
import { WORLDS } from '../data/worlds.js';
import { RARITY_COLORS } from '../data/heroes.js';
import { GEMS } from '../data/gems.js';

function drawMap(scene, key, rows, palette) {
  if (scene.textures.exists(key)) return; // já veio de um PNG do manifesto
  const h = rows.length;
  const w = rows[0].length;
  const g = scene.add.graphics();
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Sprite "${key}": linha ${y} tem ${row.length} px (esperado ${w})`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = palette[ch];
      if (color === undefined) throw new Error(`Sprite "${key}": cor "${ch}" sem paleta`);
      g.fillStyle(color, 1);
      g.fillRect(x, y, 1, 1);
    }
  });
  g.generateTexture(key, w, h);
  g.destroy();
  markLegacy(scene, key);
}

// Arte provisória (16 px): a arte 48 px do mesmo nome, quando chega depois, toma o lugar dela (art/hd.js).
function markLegacy(scene, key) {
  const t = scene.textures.get(key);
  t.customData = { ...(t.customData || {}), legacy: true };
}

function drawWith(scene, key, w, h, fn) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  fn(g);
  g.generateTexture(key, w, h);
  g.destroy();
  markLegacy(scene, key);
}

function setPx(rows, points, ch) {
  const out = rows.map((r) => r.split(''));
  for (const [x, y] of points) out[y][x] = ch;
  return out.map((r) => r.join(''));
}

// ---------- Heróis ----------
function heroRows(dir, frame) {
  const top = [
    '..........S.....',
    '.........SO.....',
    '........F.......',
    '.......F........',
    '.....KKKKKK.....',
    '....KBBBBBBK....',
    '...KBHBBBBBBK...',
  ];
  let eyes;
  let mouth;
  if (dir === 'down') {
    eyes = '...KBWKBBWKBK...';
    mouth = '...KDBBMMBBDK...';
  } else if (dir === 'side') {
    eyes = '...KBBBBBWKBK...';
    mouth = '...KDBBBBMMDK...';
  } else {
    eyes = '...KBBBBBBBBK...';
    mouth = '...KDBBBBBBDK...';
  }
  const body = [eyes, eyes, '...KBBBBBBBBK...', mouth, '....KDDDDDDK....', '.....KKKKKK.....'];
  const feet = frame === 0
    ? ['....LL....LL....', '....LL....LL....']
    : ['.....LL..LL.....', '................'];
  return [...top, ...body, ...feet, '................'];
}

// ---------- Mapas fixos ----------
const ROCK = [
  '................',
  '....KKKKKK......',
  '...KHHGGGGKK....',
  '..KHHGGGGGGGK...',
  '..KHGGGGGDGGGK..',
  '.KHGGGGGGGDGGK..',
  '.KGGGGDGGGGGGGK.',
  '.KGGGGGDGGGGGGK.',
  '.KGGGGGGGGGGDGK.',
  '.KDGGGGGGGGGDGK.',
  '.KDGGGGDDGGGGDK.',
  '..KDGGGGGGGGDK..',
  '..KDDGGGGGGDDK..',
  '...KKDDDDDDKK...',
  '.....KKKKKK.....',
  '................',
];

const VEIN = setPx(
  setPx(ROCK, [[5, 4], [6, 4], [9, 6], [10, 7], [4, 8], [5, 9], [10, 10], [7, 11], [11, 8]], 'Y'),
  [[6, 5], [9, 7], [4, 9]],
  'Z',
);
const ORE = [
  '..KKKK..',
  '.KZZYYK.',
  'KZYYYYYK',
  'KYYYYYYK',
  '.KYYYYK.',
  '..KYYK..',
  '...KK...',
  '........',
];
const KEY = [
  '.KKK....',
  'KZYYK...',
  'KY.YK...',
  'KYYYK...',
  '.KYKKKKK',
  '..KYYYYK',
  '...KYKYK',
  '....K.K.',
];

const TREE = [
  '................',
  '.....nnnnn......',
  '...nnlllnnnn....',
  '..nnllllnnnnn...',
  '..nlllnnnnnngn..',
  '.nnllnnnnnnnggn.',
  '.nnlnnnnnnnnggn.',
  '.nnnnnnnnnngggn.',
  '..nnnnnnnnggggn.',
  '..gnnnnnnggggg..',
  '...gggnnggggg...',
  '.....ggTTgg.....',
  '......TTTT......',
  '......TTTT......',
  '.....tTTTTt.....',
  '................',
];

const CHEST = [
  '................',
  '................',
  '...KKKKKKKKKK...',
  '..KwwwwwwwwwwK..',
  '..KwWWWWWWWWwK..',
  '..KYYYYYYYYYYK..',
  '..KwwwwYYwwwwK..',
  '..KKKKKyyKKKKK..',
  '..KwwwwyywwwwK..',
  '..KWWWWWWWWWWK..',
  '..KwwwwwwwwwwK..',
  '..KYYYYYYYYYYK..',
  '..KwwwwwwwwwwK..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
];
const CHEST_PAL = { w: 0x8a5a2b, W: 0xa8743c, Y: 0xf2c14e, y: 0xfff1a8, K: 0x3b2414 };

const PILLAR = [
  'KKKKKKKKKKKKKKKK',
  'KHHHHHHKHHHHHHHK',
  'KhSSSSSKhSSSSSSK',
  'KhSSSSSKhSSSSSSK',
  'KDDDDDDKDDDDDDDK',
  'KKKKKKKKKKKKKKKK',
  'KHHHKHHHHHHHKHHK',
  'KhSSKhSSSSSSKhSK',
  'KhSSKhSSSSSSKhSK',
  'KDDDKDDDDDDDKDDK',
  'KKKKKKKKKKKKKKKK',
  'KHHHHHHKHHHHHHHK',
  'KhSSSSSKhSSSSSSK',
  'KhSSSSSKhSSSSSSK',
  'KDDDDDDKDDDDDDDK',
  'KKKKKKKKKKKKKKKK',
];

const BOMB_0 = [
  '...........SO...',
  '..........SF....',
  '.........F......',
  '......KKFKK.....',
  '.....KbbbbbK....',
  '....KbHHbbbbK...',
  '...KbHbbbbbbbK..',
  '...KbbbbbbbbbK..',
  '...KbbbbbbbbbK..',
  '...KbbbbbbbbbK..',
  '...KbbbbbbbbbK..',
  '....KbbbbbbbK...',
  '.....KbbbbbK....',
  '......KKKKK.....',
  '................',
  '................',
];
const BOMB_1 = ['..........OS....', '...........S....', ...BOMB_0.slice(2)];
const BOMB_PAL = { K: 0x111118, b: 0x2b2b38, H: 0x8a8aa0, F: 0x8a5a2b, S: 0xffe066, O: 0xff8c2a };

const COIN = [
  '..KKKK..',
  '.KYYYYK.',
  'KYZZYYYK',
  'KYZYYYYK',
  'KYYYYYYK',
  'KYYYYYdK',
  '.KYYddK.',
  '..KKKK..',
];
const COIN_PAL = { K: 0x7a4a10, Y: 0xf2c14e, Z: 0xfff1a8, d: 0xc8902a };

const LOCK = [
  '..KKKK..',
  '.K....K.',
  '.K....K.',
  'KYYYYYYK',
  'KYYKKYYK',
  'KYYKKYYK',
  'KYYYYYYK',
  'KKKKKKKK',
];

const ICON_FORGE = [
  '............',
  '............',
  'KKKKKKKKKK..',
  'KSSSSSSSSKK.',
  '.KSSSSSSSSK.',
  '..KKSSSSKK..',
  '....KSSK....',
  '....KSSK....',
  '...KSSSSK...',
  '..KSSSSSSK..',
  '..KKKKKKKK..',
  '............',
];
const ICON_SKILLS = [
  '.....YY.....',
  '.....YY.....',
  '....YYYY....',
  'YYYYYYYYYYYY',
  '.YYYYYYYYYY.',
  '..YYYYYYYY..',
  '...YYYYYY...',
  '...YYYYYY...',
  '..YYY..YYY..',
  '..YY....YY..',
  '.YY......YY.',
  '............',
];
const ICON_MAP = [
  '..K.........',
  '..KRRRRR....',
  '..KRRRRRRR..',
  '..KRRRRRRR..',
  '..KRRRRR....',
  '..K.........',
  '..K.........',
  '..K.........',
  '..K.........',
  '.gKggg......',
  'gggggggg....',
  '............',
];
const ICON_HOUSE = [
  '.....RR.....',
  '....RRRR....',
  '...RRRRRR...',
  '..RRRRRRRR..',
  '.RRRRRRRRRR.',
  '..WWWWWWWW..',
  '..WWWWWWWW..',
  '..WWKKWWWW..',
  '..WWKKWBBW..',
  '..WWKKWBBW..',
  '..WWKKWWWW..',
  '..WWWWWWWW..',
];
const ICON_GEAR = [
  '.....GG.....',
  '..G.GGGG.G..',
  '..GGGGGGGG..',
  '..GGG..GGG..',
  'GGGG....GGGG',
  '.GG......GG.',
  '.GG......GG.',
  'GGGG....GGGG',
  '..GGG..GGG..',
  '..GGGGGGGG..',
  '..G.GGGG.G..',
  '.....GG.....',
];
const ICON_TROPHY = [
  '............',
  '.YYYYYYYYYY.',
  'Y.YYYYYYYY.Y',
  'Y.YYYYYYYY.Y',
  '.YYYYYYYYYY.',
  '...YYYYYY...',
  '....YYYY....',
  '.....YY.....',
  '.....YY.....',
  '....YYYY....',
  '...YYYYYY...',
  '............',
];
const ICON_BAG = [
  '....KKKK....',
  '...K.FF.K...',
  '..KKKKKKKK..',
  '.KFFFFFFFFK.',
  'KFFFFFFFFFFK',
  'KFFFYYYYFFFK',
  'KFFFYKKYFFFK',
  'KFFFFYYFFFFK',
  'KFFFFFFFFFFK',
  'KFFFFFFFFFFK',
  '.KFFFFFFFFK.',
  '..KKKKKKKK..',
];
const ICON_MARKET = [
  'RRWWRRWWRRWW',
  'RRWWRRWWRRWW',
  'KKKKKKKKKKKK',
  '.K........K.',
  '.K.YY..BB.K.',
  '.K.YY..BB.K.',
  '.KFFFFFFFFK.',
  '.KFKKKKKKFK.',
  '.KFFFFFFFFK.',
  '.KF......FK.',
  '.KF......FK.',
  '.KK......KK.',
];
const ICON_PAL = {
  K: 0x2a1d17, S: 0x9aa0a8, Y: 0xf2c14e, R: 0xc8553d, g: 0x4f9a3a, W: 0xe8d5b0, B: 0x7fb7e0, G: 0xd8cbb2, F: 0xa8743c,
};


const CRYSTAL = [
  '...KK...',
  '..KCCK..',
  '.KCWCCK.',
  'KCWCCCdK',
  'KCCCCddK',
  '.KCCddK.',
  '..KCdK..',
  '...KK...',
];
const CRYSTAL_PAL = { K: 0x1d4a6e, C: 0x6fd3f5, W: 0xe6fbff, d: 0x3a9fd0 };

const CAGE = [
  '.....KKKK.......',
  '....K....K......',
  '....K....K......',
  '..KKKKKKKKKKKK..',
  '..KGGGGGGGGGGK..',
  '..K.G..G..G..K..',
  '..K.G..G..G..K..',
  '..K.G..G..G..K..',
  '..K.G..G..G..K..',
  '..K.G..G..G..K..',
  '..K.G..G..G..K..',
  '..K.G..G..G..K..',
  '..KGGGGGGGGGGK..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
];
const CAGE_OPEN = [
  '................',
  '................',
  '................',
  '..KKKKKKKKKKKK..',
  '..KGGGGGGGGGGK..',
  '..K..........K..',
  '..K..........K..',
  '..K..........K..',
  '..K..........K..',
  '..K..........K..',
  '..K..........K..',
  '..K..........K..',
  '..KGGGGGGGGGGK..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
];
const CAGE_PAL = { K: 0x3b2414, G: 0xc8902a };

const ROLE_ATTACKER = [
  '......KK',
  '.....KWK',
  '....KWK.',
  'K..KWK..',
  '.KKWK...',
  '..KK....',
  '.K.KK...',
  'K...K...',
];
const ROLE_SUPPORT = [
  '..KKKK..',
  '..KRRK..',
  'KKKRRKKK',
  'KRRRRRRK',
  'KRRRRRRK',
  'KKKRRKKK',
  '..KRRK..',
  '..KKKK..',
];
const ROLE_COLLECTOR = [
  '..KKKK..',
  '...KK...',
  '..KYYK..',
  '.KYYYYK.',
  'KYYKYYYK',
  'KYKKKYYK',
  'KYYKYYYK',
  '.KKKKKK.',
];
const ROLE_SPECIALIST = [
  '....KK..',
  '...KPK..',
  '..KPPK..',
  '.KPPPPKK',
  'KKPPPPK.',
  '..KPPK..',
  '..KPK...',
  '..KK....',
];
const ROLE_PAL = { K: 0x2a1d17, W: 0xd8dde3, R: 0x6cc04a, Y: 0xf2c14e, P: 0xb88cf0 };

const STAR = [
  '...KK...',
  '...YY...',
  'KKYYYYKK',
  '.KYYYYK.',
  '..YYYY..',
  '.KYKKYK.',
  '.KK..KK.',
  '........',
];


// ---------- Itens (12×12) ----------
// K contorno · M cor da raridade · L clara · D escura · Y dourado fixo · G vidro
const ITEM_MAPS = {
  weapon: [
    '............',
    '...KKKKKK...',
    '....KYYK....',
    '.....KK.....',
    '.....KK.....',
    '..KKKKKKKK..',
    '.KMLMMMMMMK.',
    '.KMLMKKMMMK.',
    '.KMMMKKMMMK.',
    '.KMMMMMMMMK.',
    '.KDDDDDDDDK.',
    '..KKKKKKKK..',
  ],
  gloves: [
    '............',
    '...K.K.K....',
    '..KMKMKMK...',
    '..KMKMKMK.K.',
    '..KMLMMMKKMK',
    '..KMLMMMMMMK',
    '..KMMMMMMMK.',
    '..KMMMMMMK..',
    '..KYYYYYYK..',
    '..KMMMMMMK..',
    '..KDDDDDDK..',
    '..KKKKKKKK..',
  ],
  helm: [
    '............',
    '....KKKK....',
    '...KMMMMK...',
    '..KMLLMMMK..',
    '..KMLMMMMK..',
    '.KMMMMMMMMK.',
    '.KMKKKKKKMK.',
    '.KMK....KMK.',
    '.KMK....KMK.',
    '.KKK....KKK.',
    '............',
    '............',
  ],
  armor: [
    '............',
    '.KKK....KKK.',
    'KMMMKKKKMMMK',
    'KMMMMMMMMMMK',
    '.KMLMMMMMMK.',
    '..KLMMMMMK..',
    '..KMMMMMMK..',
    '..KMMDDMMK..',
    '..KMMMMMMK..',
    '..KDDDDDDK..',
    '...KKKKKK...',
    '............',
  ],
  pants: [
    '............',
    '..KKKKKKKK..',
    '..KMMMMMMK..',
    '..KYYYYYYK..',
    '..KMLMMMMK..',
    '..KMLMKMMK..',
    '..KMMK.KMK..',
    '..KMMK.KMK..',
    '..KMMK.KMK..',
    '..KDDK.KDK..',
    '..KKKK.KKK..',
    '............',
  ],
  boots: [
    '............',
    '....KKKK....',
    '....KMMK....',
    '....KMMK....',
    '....KLMK....',
    '....KMMK....',
    '....KMLMKK..',
    '...KMMMMMMK.',
    '...KMMMMMMMK',
    '...KDDDDDDDK',
    '...KKKKKKKKK',
    '............',
  ],
  ring: [
    '............',
    '.....KK.....',
    '....KLMK....',
    '....KMMK....',
    '...KKKKKK...',
    '..KYYKKYYK..',
    '.KYK....KYK.',
    '.KYK....KYK.',
    '.KYK....KYK.',
    '..KYYKKYYK..',
    '...KKKKKK...',
    '............',
  ],
  necklace: [
    '............',
    '.KK......KK.',
    '..KY....YK..',
    '...KY..YK...',
    '....KYYK....',
    '.....KK.....',
    '....KMMK....',
    '...KMLMMK...',
    '...KMMMMK...',
    '....KMMK....',
    '.....KK.....',
    '............',
  ],
  flask: [
    '............',
    '.....KK.....',
    '....KYYK....',
    '.....KK.....',
    '....KGGK....',
    '...KMMMMK...',
    '..KMLMMMMK..',
    '..KMMMMMMK..',
    '..KMMMMMMK..',
    '..KDMMMMDK..',
    '...KKKKKK...',
    '............',
  ],
};
const BOSS = [
  '......KK........',
  '.....KLLK.......',
  '....KLWLMK..KK..',
  '...KLWLMMK.KLMK.',
  '...KLLMMMDKLMDK.',
  '..KLWLMMMDKMMDK.',
  '..KLLMMMMDKMMDK.',
  '.KKLMMMMMDKMDKK.',
  'KLMKMMMMMDKMDKLK',
  'KLMKMMMMDDKDDKMK',
  'KMMDKMMMDKKDKMDK',
  '.KMDKMMMDKDKKMDK',
  '.KDDDKMDDKKDDDK.',
  '..KKSSSSSSSSKK..',
  '.KSSSSSSSSSSSSK.',
  '..KKKKKKKKKKKK..',
];
const GEM = [
  '..KKKK..',
  '.KLLMMK.',
  'KLWLMMDK',
  'KMMMMMDK',
  '.KMMMDK.',
  '..KMDK..',
  '...KK...',
  '........',
];
const SEALED = [
  '............',
  '..KKKKKKKK..',
  '.KPPPPRPPPK.',
  '.KPPPPRPPPK.',
  '.KPPPPRPPPK.',
  '.KRRRRSRRRK.',
  '.KPPPPRPPPK.',
  '.KPPPPRPPPK.',
  '.KPPPPRPPPK.',
  '.KPPPPRPPPK.',
  '..KKKKKKKK..',
  '............',
];

function mix(c, target, t) {
  const r = (c >> 16) & 255; const g = (c >> 8) & 255; const b = c & 255;
  const tr = (target >> 16) & 255; const tg = (target >> 8) & 255; const tb = target & 255;
  return (Math.round(r + (tr - r) * t) << 16) | (Math.round(g + (tg - g) * t) << 8) | Math.round(b + (tb - b) * t);
}

// Pontos das rachaduras (x, y) no tile 16×16.
const CRACK_1 = [[6, 2], [7, 3], [7, 4], [8, 4], [8, 5], [7, 6], [9, 6], [6, 7], [10, 7], [10, 8]];
const CRACK_2 = [...CRACK_1, [4, 8], [5, 9], [5, 10], [11, 9], [12, 10], [8, 9], [8, 10], [9, 11], [6, 11]];

// Gera todas as texturas que ainda não existem.
export function generateAllTextures(scene) {
  // Por mundo: chão (2 variações), bloco, pedra, veio e árvore com a paleta do mundo.
  const floorSpecks = [
    [[3, 4], [11, 2], [7, 9], [13, 12], [2, 13], [9, 6]],
    [[5, 2], [12, 7], [3, 10], [10, 13], [14, 4], [7, 14]],
  ];
  WORLDS.forEach((wd, w) => {
    const t = wd.theme;
    floorSpecks.forEach((specks, v) => {
      drawWith(scene, `floor_w${w}_${v}`, 16, 16, (g) => {
        g.fillStyle(t.floor[v], 1);
        g.fillRect(0, 0, 16, 16);
        g.fillStyle(t.speck, 1);
        specks.forEach(([x, y], i) => g.fillRect(x, y, i % 2 ? 2 : 1, 1));
        g.fillStyle(t.hi, 1);
        specks.slice(0, 3).forEach(([x, y]) => g.fillRect((x + 4) % 16, (y + 5) % 16, 1, 1));
        g.fillStyle(t.line, 1);
        g.fillRect(15, 0, 1, 16);
        g.fillRect(0, 15, 16, 1);
      });
    });
    drawMap(scene, `pillar_w${w}`, PILLAR, t.pillar);
    drawMap(scene, `rock_w${w}`, ROCK, t.rock);
    drawMap(scene, `vein_w${w}`, VEIN, { ...t.rock, Y: wd.mineral.color, Z: wd.mineral.light });
    drawMap(scene, `tree_w${w}`, TREE, t.tree);
    drawMap(scene, `ore_${w}`, ORE, { K: 0x2a1d17, Y: wd.mineral.color, Z: wd.mineral.light });
    drawMap(scene, `boss_w${w}`, BOSS, {
      K: 0x1d1510, M: wd.mineral.color, L: wd.mineral.light, W: 0xffffff,
      D: mix(wd.mineral.color, 0x000000, 0.4), S: t.pillar.H,
    });
  });
  drawMap(scene, 'key', KEY, { K: 0x5a3a10, Y: 0xf2c14e, Z: 0xfff1a8 });

  // Itens: um ícone por espaço e raridade, e um "vazio" cinza para os espaços livres.
  for (const [slot, rows] of Object.entries(ITEM_MAPS)) {
    RARITY_COLORS.forEach((c, r) => {
      const base = r === 0 ? 0xa8a8a8 : c;
      drawMap(scene, `item_${slot}_${r}`, rows, {
        K: 0x1d1510, M: base, L: mix(base, 0xffffff, 0.5), D: mix(base, 0x000000, 0.35), Y: 0xd8a840, G: 0xd8e8f0,
      });
    });
    drawMap(scene, `item_${slot}_empty`, rows, {
      K: 0x2a1e15, M: 0x4a3a2e, L: 0x5a4a3e, D: 0x3a2e26, Y: 0x4a3a2e, G: 0x5a4a3e,
    });
  }
  drawMap(scene, 'sealed', SEALED, { K: 0x3b2414, P: 0xc8a878, R: 0xc8553d, S: 0xf2c14e });
  for (const [id, g] of Object.entries(GEMS)) {
    drawMap(scene, `gem_${id}`, GEM, { K: 0x1d1510, M: g.color, L: g.light, W: 0xffffff, D: mix(g.color, 0x000000, 0.35) });
  }
  drawMap(scene, 'gem_empty', GEM, { K: 0x2a1e15, M: 0x4a3a2e, L: 0x5a4a3e, W: 0x5a4a3e, D: 0x3a2e26 });

  drawMap(scene, 'chest', CHEST, CHEST_PAL);

  drawWith(scene, 'crack_1', 16, 16, (g) => {
    g.fillStyle(0x1d1916, 1);
    CRACK_1.forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  });
  drawWith(scene, 'crack_2', 16, 16, (g) => {
    g.fillStyle(0x1d1916, 1);
    CRACK_2.forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  });

  drawMap(scene, 'bomb_0', BOMB_0, BOMB_PAL);
  drawMap(scene, 'bomb_1', BOMB_1, BOMB_PAL);

  // Explosão: 4 quadros, do clarão branco até a fumaça.
  const boom = [
    [[0xffffff, 5], [0xfff1a8, 3]],
    [[0xffe066, 7], [0xfff1a8, 5], [0xffffff, 2]],
    [[0xff8c2a, 8], [0xffd04a, 6], [0xfff1a8, 3]],
    [[0x7a5a50, 6], [0xc8553d, 4], [0xff8c2a, 2]],
  ];
  boom.forEach((layers, i) => {
    drawWith(scene, `boom_${i}`, 16, 16, (g) => {
      layers.forEach(([color, r]) => {
        g.fillStyle(color, 1);
        g.fillRect(8 - r, 8 - r + 1, r * 2, r * 2 - 2);
        g.fillRect(8 - r + 1, 8 - r, r * 2 - 2, r * 2);
      });
    });
  });

  drawMap(scene, 'coin', COIN, COIN_PAL);
  drawWith(scene, 'debris', 2, 2, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
  });

  drawMap(scene, 'icon_lock', LOCK, { K: 0x2a1d17, Y: 0xd8cbb2 });
  drawMap(scene, 'icon_forge', ICON_FORGE, ICON_PAL);
  drawMap(scene, 'icon_skills', ICON_SKILLS, ICON_PAL);
  drawMap(scene, 'icon_map', ICON_MAP, ICON_PAL);
  drawMap(scene, 'icon_house', ICON_HOUSE, ICON_PAL);
  drawMap(scene, 'icon_bag', ICON_BAG, ICON_PAL);
  drawMap(scene, 'icon_market', ICON_MARKET, ICON_PAL);
  drawMap(scene, 'icon_gear', ICON_GEAR, ICON_PAL);
  drawMap(scene, 'icon_trophy', ICON_TROPHY, ICON_PAL);

  PALETTES.forEach((h, id) => {
    const pal = {
      K: 0x2a1d17, B: h.color, D: h.dark, H: h.light, W: 0xffffff,
      M: 0x7a2b2b, F: 0x8a5a2b, S: 0xffe066, O: 0xff8c2a, L: 0x3b2a20,
    };
    for (const dir of ['down', 'up', 'side']) {
      for (const f of [0, 1]) drawMap(scene, `hero${id}_${dir}_${f}`, heroRows(dir, f), pal);
    }
  });

  drawMap(scene, 'crystal', CRYSTAL, CRYSTAL_PAL);
  drawMap(scene, 'cage', CAGE, CAGE_PAL);
  drawMap(scene, 'cage_open', CAGE_OPEN, CAGE_PAL);
  drawMap(scene, 'role_attacker', ROLE_ATTACKER, ROLE_PAL);
  drawMap(scene, 'role_support', ROLE_SUPPORT, ROLE_PAL);
  drawMap(scene, 'role_collector', ROLE_COLLECTOR, ROLE_PAL);
  drawMap(scene, 'role_specialist', ROLE_SPECIALIST, ROLE_PAL);
  drawMap(scene, 'star', STAR, { Y: 0xf2c14e, K: 0x7a4a10 });
  drawMap(scene, 'star_empty', STAR, { Y: 0x4a3626, K: 0x2a1d17 });
  drawWith(scene, 'spark', 4, 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(1, 0, 2, 4);
    g.fillRect(0, 1, 4, 2);
  });
}

export function createAnimations(scene) {
  PALETTES.forEach((_, id) => {
    for (const dir of ['down', 'up', 'side']) {
      scene.anims.create({
        key: `h${id}_walk_${dir}`,
        frames: [{ key: `hero${id}_${dir}_0` }, { key: `hero${id}_${dir}_1` }],
        frameRate: 8,
        repeat: -1,
      });
    }
  });
  scene.anims.create({ key: 'bomb_fuse', frames: [{ key: 'bomb_0' }, { key: 'bomb_1' }], frameRate: 6, repeat: -1 });
  scene.anims.create({
    key: 'boom',
    frames: [0, 1, 2, 3].map((i) => ({ key: `boom_${i}` })),
    frameRate: 16,
    repeat: 0,
  });
}
