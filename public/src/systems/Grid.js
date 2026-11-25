// A grade da mina: pilares fixos, objetos destrutíveis e bombas.
import { BALANCE } from '../config/balance.js';

// Gerador aleatório com semente (a mesma fase sempre sai igual).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(world, stage, difficulty) {
  return (Math.imul(world + 1, 73856093) ^ Math.imul(stage, 19349663) ^ Math.imul(difficulty + 1, 83492791)) >>> 0;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Facilita as primeiras fases do jogo (gi = índice global da fase, 1 = primeira).
// Vale 'key' na fase 1 e chega em 1 (sem efeito) na fase earlyEase.stages.
export function earlyEase(gi, key) {
  const E = BALANCE.stage.earlyEase;
  if (!E || gi >= E.stages) return 1;
  const t = Math.max(0, gi - 1) / (E.stages - 1);
  return E[key] + (1 - E[key]) * t;
}

// Curva do Fácil: parte linear (hpGrowthPerStage) × parte composta (hpCompound por fase). Vale 1 na fase 1.
export function rawStageCurve(gi) {
  const S = BALANCE.stage;
  const n = Math.max(0, gi - 1);
  return (1 + S.hpGrowthPerStage * n) * Math.pow(S.hpCompound || 1, n);
}

// Última fase de uma dificuldade (índice global).
const lastGi = () => BALANCE.stage.stagesPerWorld * BALANCE.stage.worldsPerDifficulty;

// Quanto a vida dos objetos cresce numa fase (índice global gi) e dificuldade.
// Fácil: a curva do Fácil (com começo suave). Nas outras, a dificuldade TERMINA em difficulties[d].hp × o fim
// do Fácil e COMEÇA em difficultyStart (≈30%) do fim da anterior; no meio segue o mesmo formato da curva
// do Fácil (sobe mais no começo de cada mundo e no fim fica mais íngreme). Assim não há um trecho "de graça"
// no começo de cada dificuldade nova (antes a 1ª fase tinha só 1% a 6% da vida do chefe anterior).
export function stageHpGrowth(gi, difficulty) {
  if (!difficulty) return rawStageCurve(gi) * earlyEase(gi, 'hpMult');
  const D = BALANCE.difficulties;
  const R = rawStageCurve(lastGi());
  const end = D[difficulty].hp * R;
  const start = (BALANCE.stage.difficultyStart ?? 0.3) * D[difficulty - 1].hp * R;
  const k = Math.log(end / start) / Math.log(R);
  return start * Math.pow(rawStageCurve(gi), k);
}

// Escala do ouro de uma fase (sem os bônus do jogador): acompanha a vida dos objetos × o bônus de recompensa
// por fase × a eficiência da dificuldade (recompensa ÷ vida). No Fácil, nível 1 = 1.
export function stageGoldScale(gi, difficulty = 0) {
  const g = Math.max(1, gi);
  const D = BALANCE.difficulties[difficulty] || BALANCE.difficulties[0];
  const hp = difficulty ? stageHpGrowth(g, difficulty) : rawStageCurve(g);
  return hp * (1 + BALANCE.loot.rewardGrowthPerStage * (g - 1) * 0.25) * (D.reward / D.hp);
}

export class Grid {
  constructor() {
    const { cols, rows, tile } = BALANCE.grid;
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    this.originX = Math.floor((BALANCE.screen.width - cols * tile) / 2);
    this.originY = BALANCE.layout.arenaY + (BALANCE.grid.offsetY ?? Math.floor((BALANCE.layout.arenaH - rows * tile) / 2));

    const n = cols * rows;
    this.pillars = new Uint8Array(n);
    this.objects = new Array(n).fill(null);
    this.bombs = new Array(n).fill(null);
    this.tileReserved = new Map(); // tile → id do herói que vai plantar ali

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (BALANCE.grid.pillars && x % 2 === 1 && y % 2 === 1) this.pillars[this.idx(x, y)] = 1;
      }
    }
    this.nextId = 1;
    this.total = 0;
    this.remaining = 0;
  }

  idx(x, y) { return y * this.cols + x; }
  xy(i) { return [i % this.cols, Math.floor(i / this.cols)]; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  isPillar(x, y) { return this.pillars[this.idx(x, y)] === 1; }
  objectAt(x, y) { return this.objects[this.idx(x, y)]; }
  bombAt(x, y) { return this.bombs[this.idx(x, y)]; }

  // Pode andar: dentro da grade, sem pilar e sem objeto. Bombas não bloqueiam (simplificação).
  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    return !this.pillars[i] && !this.objects[i];
  }

  toWorld(x, y) {
    return { x: this.originX + x * this.tile + this.tile / 2, y: this.originY + y * this.tile + this.tile / 2 };
  }

  // Cria os objetos de uma fase. Devolve a lista criada.
  // opts.endlessDepth: Abismo · opts.boss: põe o Chefe Cristal · opts.bossOnly: só o chefe (Colosso).
  generate(world, stage, difficulty, opts = {}) {
    const endlessDepth = opts.endlessDepth || 0;
    const S = BALANCE.stage;
    this.objects.fill(null);
    this.bombs.fill(null);
    this.tileReserved.clear();

    const rand = mulberry32(endlessDepth ? seedFor(7, endlessDepth, 9) : seedFor(world, stage, difficulty));
    const spawn = new Set(S.spawn.map(([x, y]) => this.idx(x, y)));
    const types = Object.keys(S.weights);
    const totalWeight = types.reduce((s, t) => s + S.weights[t], 0);
    const gi = world * S.stagesPerWorld + stage; // índice global da fase
    let growth = stageHpGrowth(gi, difficulty);
    const H = S.hardness;
    let armor = Math.min(H.max, gi * H.perStage + world * H.perWorld + difficulty * H.perDifficulty);
    if (endlessDepth) {
      // Abismo: HP cresce de forma exponencial, sem teto.
      const E = BALANCE.endless;
      growth = E.hpStart * Math.pow(E.hpGrowth, endlessDepth - 1);
      armor = Math.min(E.armorMax, E.armorStart + E.armorPerDepth * endlessDepth);
    }
    this.armor = armor;

    const list = [];
    const B = BALANCE.boss;
    const [bx, by] = B.tile;
    // O chefe ocupa várias casas (B.size = largura × altura, com a casa B.tile embaixo no meio):
    // ninguém passa por ele, e a explosão que pega qualquer casa dele acerta o chefe uma vez.
    const [bw, bh] = B.size || [1, 1];
    const x0 = bx - Math.floor(bw / 2), y0 = by - bh + 1;
    const bossTiles = [];
    for (let yy = y0; yy <= by; yy++) for (let xx = x0; xx < x0 + bw; xx++) bossTiles.push([xx, yy]);
    // Um anel de 1 casa em volta fica livre, para os heróis chegarem perto.
    const nearBoss = (x, y) => x >= x0 - 1 && x <= x0 + bw && y >= y0 - 1 && y <= by + 1;
    if (opts.boss || opts.bossOnly) {
      const hp = opts.bossHp ?? Math.max(1, Math.round(B.hp * growth));
      const boss = {
        id: this.nextId++, type: 'boss', x: bx, y: by, tiles: bossTiles, hp, maxHp: hp, armor: opts.bossArmor ?? armor,
        pending: 0, reserved: 0, sprite: null, crack: null,
      };
      bossTiles.forEach(([xx, yy]) => { this.objects[this.idx(xx, yy)] = boss; });
      list.push(boss);
    }
    const fill = opts.bossOnly ? 0 : S.fillChance * (opts.boss ? B.fillMult : 1);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = this.idx(x, y);
        if (this.pillars[i] || spawn.has(i) || this.objects[i]) continue;
        if ((opts.boss || opts.bossOnly) && nearBoss(x, y)) continue;
        if (rand() >= fill) continue;
        let r = rand() * totalWeight;
        let type = types[0];
        for (const t of types) {
          r -= S.weights[t];
          if (r < 0) { type = t; break; }
        }
        const hp = Math.max(1, Math.round(S.baseHp[type] * growth));
        const obj = { id: this.nextId++, type, x, y, hp, maxHp: hp, armor, pending: 0, reserved: 0, sprite: null, crack: null };
        this.objects[i] = obj;
        list.push(obj);
      }
    }
    this.total = list.length;
    this.remaining = list.length;
    return list;
  }

  // Área da explosão em cruz a partir de (x, y).
  // Para no pilar; para no primeiro objeto ou bomba de cada direção (incluindo-o).
  // "pierce" = quantos objetos a explosão atravessa por direção (Especialista).
  cross(x, y, range, pierce = 0) {
    const res = { tiles: [{ x, y }], objects: [], bombs: [] };
    for (const [dx, dy] of DIRS) {
      let hits = 0;
      for (let s = 1; s <= range; s++) {
        const nx = x + dx * s;
        const ny = y + dy * s;
        if (!this.inBounds(nx, ny) || this.isPillar(nx, ny)) break;
        res.tiles.push({ x: nx, y: ny });
        const i = this.idx(nx, ny);
        if (this.objects[i]) {
          // Objeto grande (chefe): várias casas, mas conta uma vez só por explosão.
          if (!res.objects.includes(this.objects[i])) res.objects.push(this.objects[i]);
          hits += 1;
          if (hits > pierce) break;
          continue;
        }
        if (this.bombs[i]) { res.bombs.push(this.bombs[i]); break; }
      }
    }
    return res;
  }

  // Quanto de HP ainda "sobra" depois de bombas plantadas e reservas dos heróis.
  effectiveHp(obj) {
    return obj.hp - obj.pending - obj.reserved;
  }

  // Tiles que vão ser atingidos por bombas já plantadas.
  dangerSet() {
    const set = new Set();
    this.bombs.forEach((b) => {
      if (!b) return;
      for (const t of this.cross(b.x, b.y, b.range, b.pierce).tiles) set.add(this.idx(t.x, t.y));
    });
    return set;
  }
}
