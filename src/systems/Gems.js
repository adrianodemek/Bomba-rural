// Gemas: valores, ganho, fusão e encaixe nos heróis.
import { BALANCE } from '../config/balance.js';
import { GEMS, GEM_IDS, gemKey, parseGem } from '../data/gems.js';
import { economy } from './Economy.js';

const G = BALANCE.gems;

export function gemValue(type, lvl) {
  const attr = GEMS[type].attr;
  return Math.round(G.base[attr] * Math.pow(G.growth, lvl - 1) * 100) / 100;
}

export function gemCount(key) {
  return economy.gems[key] || 0;
}

// Nível das gemas que caem no lugar atual.
export function dropGemLevel() {
  if (economy.mode === 'endless') return Math.min(G.maxLevel, 1 + Math.floor(economy.endlessDepth / 15));
  return Math.min(G.maxLevel, 1 + Math.floor(economy.globalIndex() / G.levelPerStages) + economy.difficulty);
}

export function addGem(type, lvl, n = 1) {
  const k = gemKey(type, lvl);
  economy.gems[k] = (economy.gems[k] || 0) + n;
  economy.registerAlbum?.('g', type);
  economy.emit('gems');
}

// Gema aleatória (tipo sorteado) no nível de drop atual. Devolve a chave.
export function addRandomGem(lvl = dropGemLevel()) {
  const type = GEM_IDS[Math.floor(Math.random() * GEM_IDS.length)];
  addGem(type, lvl);
  return gemKey(type, lvl);
}

export function mergeCost(lvl) {
  return Math.round(G.mergeGold * Math.pow(G.mergeGoldGrowth, lvl - 1));
}

export function canMerge(key) {
  const g = parseGem(key);
  return !!g && g.lvl < G.maxLevel && gemCount(key) >= G.mergeCount && economy.gold >= mergeCost(g.lvl);
}

// Funde uma vez (3 → 1). Devolve a chave nova ou null.
export function mergeGem(key) {
  if (!canMerge(key)) return null;
  const g = parseGem(key);
  economy.spendGold(mergeCost(g.lvl));
  economy.gems[key] -= G.mergeCount;
  if (economy.gems[key] <= 0) delete economy.gems[key];
  addGem(g.type, g.lvl + 1);
  return gemKey(g.type, g.lvl + 1);
}

// Funde o máximo possível desta pilha (para no ouro). Devolve quantas fusões fez.
export function mergeAll(key) {
  let n = 0;
  while (canMerge(key) && n < 1000) { mergeGem(key); n += 1; }
  return n;
}

// Lista de pilhas ordenada (nível maior primeiro).
export function gemStacks() {
  return Object.entries(economy.gems)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => ({ key, n, ...parseGem(key) }))
    .filter((g) => g.type)
    .sort((a, b) => b.lvl - a.lvl || GEM_IDS.indexOf(a.type) - GEM_IDS.indexOf(b.type));
}

// ---------- Encaixes ----------
export function socketsOpen(hero) {
  return G.sockets.filter((lv) => hero.level >= lv).length;
}

export function socketGem(hero, i, key) {
  if (i >= socketsOpen(hero) || gemCount(key) <= 0) return false;
  unsocketGem(hero, i, false);
  economy.gems[key] -= 1;
  if (economy.gems[key] <= 0) delete economy.gems[key];
  hero.gems[i] = key;
  economy.emit('gems');
  economy.emit('roster');
  return true;
}

export function unsocketGem(hero, i, emit = true) {
  const key = hero.gems?.[i];
  if (!key) return;
  economy.gems[key] = (economy.gems[key] || 0) + 1;
  hero.gems[i] = null;
  if (emit) { economy.emit('gems'); economy.emit('roster'); }
}

// Atributos somados das gemas encaixadas.
export function heroGemFlat(hero) {
  const flat = {};
  for (const key of hero.gems || []) {
    const g = key && parseGem(key);
    if (!g) continue;
    const attr = GEMS[g.type].attr;
    flat[attr] = (flat[attr] || 0) + gemValue(g.type, g.lvl);
  }
  return flat;
}
