// Equipamento: sorteio de itens, atributos, forja, fusão, desmontar e conjuntos.
import { BALANCE } from '../config/balance.js';
import { SLOTS, SLOT_IDS, SETS, SET_IDS, slotById, GEAR_SLOTS } from '../data/items.js';
import { economy } from './Economy.js';
import { stageGoldScale } from './Grid.js';

const I = BALANCE.items;
const F = BALANCE.forge;
const PCT = new Set(['luck', 'critChance', 'critDamage', 'penetration', 'cooldown']);
const ATTRS = BALANCE.attributes.ids;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const round2 = (v) => Math.round(v * 100) / 100;

function weighted(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}

// Nível de item da posição atual no mapa.
export function currentItemLevel() {
  if (economy.mode === 'endless') return Math.min(300, BALANCE.endless.itemLevelStart + economy.endlessDepth * 2);
  return Math.min(300, economy.globalIndex() + economy.difficulty * I.levelPerDifficulty);
}

// Cria um item novo (ainda não adicionado ao inventário).
// Dificuldade em que um item de nível ilvl caiu (o nível sobe 50 por dificuldade e as faixas se sobrepõem):
// a atual, desde que caiba no nível do item. Usada em itens novos e para estimar a de itens de saves antigos.
export function itemDiffFor(ilvl, difficulty = economy.difficulty) {
  if (economy.mode === 'endless') return 0;
  return Math.max(0, Math.min(difficulty || 0, Math.floor((ilvl - 1) / I.levelPerDifficulty), BALANCE.difficulties.length - 1));
}

export function rollItem(ilvl, world, force = {}) {
  const slot = force.slot ?? pick(SLOT_IDS);
  const rarity = force.rarity ?? weighted(I.rarityWeights);
  const main = slotById(slot).main;
  const pool = ATTRS.filter((a) => a !== main);
  const affixes = [];
  for (let i = 0; i < I.affixCount[rarity] && pool.length; i++) {
    const attr = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    affixes.push({ attr, roll: round2(0.7 + Math.random() * 0.3) });
  }
  const set = rarity >= I.setMinRarity && Math.random() < I.setChance ? pick(SET_IDS) : null;
  const diff = force.diff ?? itemDiffFor(ilvl);
  return { uid: 0, slot, rarity, ilvl, world, diff, plus: 0, stars: 0, affixes, set, locked: false, tradable: true };
}

function levelMult(attr, ilvl) {
  return 1 + (PCT.has(attr) ? I.pctPerLevel : I.flatPerLevel) * (ilvl - 1);
}

function qualityMult(item) {
  return I.rarityMult[item.rarity] * (1 + I.plusBonus * item.plus) * (1 + I.starBonus * item.stars);
}

// Atributos que o item dá: { attack: 12.5, luck: 1.2, ... } e qual é o principal.
export function itemStats(item) {
  const q = qualityMult(item);
  const main = slotById(item.slot).main;
  const out = { [main]: round2(I.base[main] * levelMult(main, item.ilvl) * q) };
  for (const a of item.affixes) {
    const v = I.base[a.attr] * levelMult(a.attr, item.ilvl) * q * I.affixMult * a.roll;
    out[a.attr] = round2((out[a.attr] || 0) + v);
  }
  return out;
}

export function itemMain(item) {
  return slotById(item.slot).main;
}

// Nota do item, com os mesmos pesos do Poder do herói.
export function itemPower(item) {
  const w = BALANCE.attributes.powerWeights;
  const st = itemStats(item);
  return Math.round(Object.entries(st).reduce((s, [a, v]) => s + v * w[a], 0));
}

// Soma dos atributos de vários itens + bônus de conjunto ativos.
export function gearBonus(items) {
  const flat = {};
  const pct = {};
  for (const it of items) {
    for (const [a, v] of Object.entries(itemStats(it))) flat[a] = (flat[a] || 0) + v;
  }
  for (const b of activeSetBonuses(items)) {
    if (b.flat) flat[b.attr] = (flat[b.attr] || 0) + b.flat;
    if (b.pct) pct[b.attr] = (pct[b.attr] || 0) + b.pct;
  }
  return { flat, pct };
}

export function setCounts(items) {
  const counts = {};
  for (const it of items) if (it.set) counts[it.set] = (counts[it.set] || 0) + 1;
  return counts;
}

export function activeSetBonuses(items) {
  const out = [];
  for (const [id, n] of Object.entries(setCounts(items))) {
    if (n >= 2) out.push({ set: id, pieces: 2, ...SETS[id].bonus2 });
    if (n >= 4) out.push({ set: id, pieces: 4, ...SETS[id].bonus4 });
  }
  return out;
}

// ---------- Lacrados ----------
export function revealSealed() {
  if (economy.sealed.length === 0) return { error: 'none' };
  if (economy.items.length >= I.inventoryMax) return { error: 'full' };
  const s = economy.sealed.shift();
  const item = economy.addItem(rollItem(s.ilvl, s.world, { diff: s.diff }));
  economy.bump('sealedRevealed');
  economy.emit('items');
  return { item };
}

// ---------- Forja ----------
// O ouro acompanha o ouro de uma fase do lugar onde o item caiu (fase + dificuldade): assim forjar pesa
// igual no Fácil, no Normal e acima. Mesma régua do ouro da arena (Grid.stageGoldScale).
// Ouro aproximado de uma fase (índice gi, dificuldade d) — régua usada pelo Altar e pela forja.
export function stageGoldAt(gi, d = 0) {
  return BALANCE.altar.stageGold * stageGoldScale(Math.max(1, gi), d);
}

// Fase e dificuldade de onde um item caiu (pelo nível do item).
export function itemStageGold(item) {
  const d = item.diff ?? 0;
  return stageGoldAt(item.ilvl - d * I.levelPerDifficulty, d);
}

export function forgeCost(item) {
  if (item.plus >= F.maxPlus) return null;
  const d = item.diff ?? 0;
  const scale = stageGoldScale(Math.max(1, item.ilvl - d * I.levelPerDifficulty), d);
  const gold = Math.round(F.goldBase * scale * Math.pow(F.goldGrowth, item.plus) * (1 + item.rarity * F.rarityGold));
  const minerals = Math.round((F.mineralBase + F.mineralPerPlus * item.plus) * (1 + item.rarity * F.rarityMineral));
  return { gold, minerals, world: item.world };
}

export function forgeChance(item) {
  return F.chance[item.plus] ?? 0;
}

// Chance de o item quebrar se a tentativa falhar (0 antes do +7).
export function forgeBreakChance(item) {
  return item.plus >= F.breakFrom ? F.breakOnFail : 0;
}

export function canAffordForge(item) {
  const c = forgeCost(item);
  return !!c && economy.gold >= c.gold && economy.minerals[c.world] >= c.minerals;
}

// Tenta +1. Devolve 'success' | 'fail' | 'broke' | null (sem recursos).
export function forge(item) {
  const c = forgeCost(item);
  if (!c || !canAffordForge(item)) return null;
  economy.spendGold(c.gold);
  economy.minerals[c.world] -= c.minerals;
  economy.bump('forgeAttempts');
  let result;
  if (Math.random() < forgeChance(item)) {
    item.plus += 1;
    economy.bump('forgeSuccess');
    economy.stats.maxPlus = Math.max(economy.stats.maxPlus, item.plus);
    result = 'success';
  } else if (Math.random() < forgeBreakChance(item)) {
    economy.removeItem(item.uid);
    result = 'broke';
  } else {
    result = 'fail';
  }
  economy.emit('currency');
  economy.emit('items');
  economy.emit('roster');
  return result;
}

// ---------- Fusão ----------
// Duplicado = mesmo espaço, raridade e conjunto. Usa o de menor valor que não esteja equipado.
export function fusionFood(item) {
  return economy.items
    .filter((o) => o.uid !== item.uid && o.slot === item.slot && o.rarity === item.rarity
      && o.set === item.set && !economy.equippedBy(o.uid) && !o.locked)
    .sort((a, b) => itemPower(a) - itemPower(b))[0] || null;
}

export function canFuseItem(item) {
  return item.stars < BALANCE.stars.max && !!fusionFood(item);
}

export function fuseItem(item) {
  if (!canFuseItem(item)) return null;
  const food = fusionFood(item);
  economy.removeItem(food.uid);
  item.stars += 1;
  economy.emit('items');
  economy.emit('roster');
  return food;
}

// ---------- Desmontar ----------
export function salvageValue(item) {
  return {
    gold: Math.round(F.salvageGold * (1 + item.ilvl * 0.1) * (1 + item.rarity) * (1 + item.plus * 0.3)),
    minerals: 1 + item.rarity + Math.floor(item.plus / 2),
    world: item.world,
  };
}

export function salvage(item) {
  if (item.locked) return null;
  const v = salvageValue(item);
  economy.removeItem(item.uid);
  economy.addGold(v.gold);
  economy.addMineral(v.world, v.minerals);
  economy.emit('items');
  economy.emit('roster');
  return v;
}

// Desmonta todos os Comuns que não estão equipados.
export function salvageCommons() {
  const list = economy.items.filter((it) => it.rarity === 0 && !economy.equippedBy(it.uid) && !it.locked);
  const total = { gold: 0, count: list.length };
  list.forEach((it) => { total.gold += salvage(it).gold; });
  return total;
}

export { SLOTS };

export function toggleItemLock(item) {
  item.locked = !item.locked;
  economy.emit('items');
  return item.locked;
}

// Compara um item com o que o herói usa no mesmo espaço (Anel: o espaço vazio ou o anel mais fraco).
// verdict: 'equipped' (já usa este) · 'empty' (espaço vazio) · 'better' · 'worse' · 'same'.
export function compareToEquipped(item, hero, slotKey = null) {
  if (!item || !hero) return null;
  const slots = GEAR_SLOTS.filter((g) => g.type === item.slot && (!slotKey || g.key === slotKey));
  if (!slots.length) return null;
  if (slots.some((g) => hero.gear?.[g.key] === item.uid)) return { verdict: 'equipped', hero };
  const cur = slots.map((g) => economy.itemByUid(hero.gear?.[g.key]));
  if (cur.some((c) => !c)) return { verdict: 'empty', hero, pct: 100 };
  const weakest = cur.reduce((a, b) => (itemPower(b) < itemPower(a) ? b : a));
  const a = itemPower(item);
  const b = itemPower(weakest);
  const pct = Math.round(((a - b) / Math.max(1, b)) * 100);
  return { verdict: a > b ? 'better' : a < b ? 'worse' : 'same', pct, current: weakest, hero };
}
