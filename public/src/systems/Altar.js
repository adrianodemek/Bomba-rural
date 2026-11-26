// Altar de combinação: 5 itens iguais → 1 da raridade seguinte; 3 heróis → 1 da raridade seguinte.
import { BALANCE } from '../config/balance.js';
import { SLOT_IDS } from '../data/items.js';
import { economy } from './Economy.js';
import { rollItem, itemPower, stageGoldAt, itemStageGold } from './Items.js';
import { computeStats } from './HeroStats.js';
import { createRandomHero } from './Gacha.js';

const A = BALANCE.altar;
const MAX_RARITY = 4;

// Custo em "fases de ouro": itens pela fase onde caíram (o mais alto do grupo); heróis pela fase atual.
export function itemRecipeCost(rarity, items = []) {
  const unit = items.length ? Math.max(...items.map(itemStageGold)) : stageGoldAt(economy.globalIndex(), economy.difficulty);
  return Math.max(Math.round(A.itemMinGold * Math.pow(A.itemMinGrowth, rarity)), Math.round(unit * A.itemStages[rarity]));
}

export function heroRecipeCost(rarity) {
  const unit = stageGoldAt(economy.globalIndex(), economy.difficulty);
  return Math.max(Math.round(A.heroMinGold * Math.pow(A.heroMinGrowth, rarity)), Math.round(unit * A.heroStages[rarity]));
}

function freeItems(slot, rarity) {
  return economy.items
    .filter((it) => it.slot === slot && it.rarity === rarity && !it.cls && !it.locked && !economy.equippedBy(it.uid))   // exclusivos ficam fora
    .sort((a, b) => itemPower(a) - itemPower(b));
}

function freeHeroes(rarity, onField) {
  return economy.heroes
    .filter((h) => h.rarity === rarity && !h.locked && !onField.has(h.uid) && !economy.onExpedition(h.uid))
    .sort((a, b) => computeStats(a).power - computeStats(b).power);
}

// Receitas possíveis agora: [{ kind, slot?, rarity, have, need, cost }].
export function recipes(onField = new Set()) {
  const out = [];
  for (let r = 0; r < MAX_RARITY; r++) {
    const hs = freeHeroes(r, onField).length;
    if (hs > 0) out.push({ kind: 'hero', rarity: r, have: hs, need: A.heroes, cost: heroRecipeCost(r) });
  }
  for (const slot of SLOT_IDS) {
    for (let r = 0; r < MAX_RARITY; r++) {
      const n = freeItems(slot, r).length;
      if (n > 0) out.push({ kind: 'item', slot, rarity: r, have: n, need: A.items, cost: itemRecipeCost(r, freeItems(slot, r).slice(0, A.items)) });
    }
  }
  // Prontas primeiro, depois as mais perto de ficarem prontas.
  return out.sort((a, b) => (b.have >= b.need) - (a.have >= a.need) || b.have / b.need - a.have / a.need || b.rarity - a.rarity);
}

export function canCombine(rec, onField = new Set()) {
  if (economy.gold < rec.cost) return false;
  if (rec.kind === 'item') return freeItems(rec.slot, rec.rarity).length >= A.items;
  return freeHeroes(rec.rarity, onField).length >= A.heroes && economy.heroes.length - (A.heroes - 1) >= 3;
}

// Usa os mais fracos do grupo. Devolve o item ou herói novo.
export function combine(rec, onField = new Set()) {
  if (!canCombine(rec, onField)) return null;
  economy.spendGold(rec.cost);
  if (rec.kind === 'item') {
    const used = freeItems(rec.slot, rec.rarity).slice(0, A.items);
    const best = used.reduce((a, b) => (b.ilvl > a.ilvl ? b : a));
    const ilvl = best.ilvl;
    const world = used[used.length - 1].world;
    used.forEach((it) => economy.removeItem(it.uid));
    const item = economy.addItem(rollItem(ilvl, world, { slot: rec.slot, rarity: rec.rarity + 1, diff: best.diff }));
    economy.emit('items');
    return { item };
  }
  const used = freeHeroes(rec.rarity, onField).slice(0, A.heroes);
  used.forEach((h) => economy.removeHero(h.uid));
  const hero = createRandomHero(rec.rarity + 1);
  economy.emit('roster');
  economy.emit('teams');
  economy.emit('items');
  economy.emit('gems');
  return { hero };
}
