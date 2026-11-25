// Atributos de um herói: papel × raridade × rank × nível × estrelas + pontos distribuídos.
import { BALANCE } from '../config/balance.js';
import { gearBonus } from './Items.js';
import { ABILITIES } from '../data/abilities.js';

// Valores das habilidades do herói: { crusher: 0.18, ... } e quais estão no nível 10.
export function abilityValues(hero) {
  const out = {};
  const maxed = {};
  for (const a of hero.abilities || []) {
    const def = ABILITIES[a.id];
    if (!def) continue;
    out[a.id] = def.per * a.lvl;
    maxed[a.id] = a.lvl >= BALANCE.attributes.abilityMax;
  }
  return { values: out, maxed };
}

const A = BALANCE.attributes;
const PCT = ['luck', 'critChance', 'critDamage', 'penetration', 'cooldown'];

export function emptyAlloc() {
  return Object.fromEntries(A.ids.map((id) => [id, 0]));
}

export function pointsSpent(hero) {
  return A.ids.reduce((s, id) => s + (hero.alloc?.[id] || 0), 0);
}

export function pointsAvailable(hero) {
  return Math.max(0, (hero.level - 1) * A.pointsPerLevel - pointsSpent(hero));
}

const round1 = (v) => Math.round(v * 100) / 100;

// accountLevel = nível da Pólvora reforçada · gear = itens equipados · acct = bônus da árvore.
export function computeStats(hero, accountLevel = 0, gear = [], acct = null) {
  const role = BALANCE.roles[hero.role];
  const rar = BALANCE.rarities[hero.rarity];
  const rank = BALANCE.ranks[hero.rank ?? 2];
  const L = BALANCE.levels;
  const star = 1 + hero.stars * BALANCE.stars.bonusPerStar;
  const pts = (id) => (hero.alloc?.[id] || 0) * A.perPoint[id];
  const b = role.base;

  const gb = gear.length ? gearBonus(gear) : { flat: {}, pct: {} };
  const ac = acct || { flat: {}, pct: {} };
  const eq = (id, v) => (v + (gb.flat[id] || 0) + (ac.flat[id] || 0)) * (1 + (gb.pct[id] || 0) + (ac.pct[id] || 0));

  // Marcos de nível: a cada L.milestoneEvery níveis o Ataque base do herói é multiplicado.
  const milestone = Math.pow(L.milestoneMult || 1, Math.floor(hero.level / (L.milestoneEvery || 1e9)));
  const attackRaw = eq('attack', (b.attack * rar.mult * rank.mult * star * (1 + L.attackPerLevel * (hero.level - 1)) + pts('attack')) * milestone);
  const attack = attackRaw * (1 + accountLevel * BALANCE.upgrades.power.attackPct);
  const energy = eq('energy', b.energy * rar.mult * rank.mult * star * (1 + L.energyPerLevel * (hero.level - 1)) + pts('energy'));
  // Estrela vale menos na velocidade (+6% cada) para o teto não chegar cedo demais.
  const starSpeed = 1 + hero.stars * BALANCE.stars.speedPerStar;
  const speed = eq('speed', b.speed * rar.speedMult * rank.mult * starSpeed * (1 + L.speedPerLevel * (hero.level - 1)) + pts('speed'));

  const s = {
    attack: round1(attack),
    energy: Math.round(energy),
    speed: round1(speed),
  };
  const { values: ab, maxed } = abilityValues(hero);
  const abilFlat = { critChance: (ab.critBoom || 0) * 100, penetration: (ab.drill || 0) * 100 };
  for (const id of PCT) {
    let v = eq(id, b[id] * rar.pctMult * rank.mult * star + pts(id)) + (abilFlat[id] || 0);
    if (A.caps[id] !== undefined) v = Math.min(A.caps[id], v);
    s[id] = round1(v);
  }
  s.abil = ab;

  s.moveSpeed = Math.min(A.maxMoveSpeed, A.moveBase + s.speed / A.moveDiv);
  s.range = rangeOf(hero, role, rar);
  s.bombs = rar.bombs;
  s.maxEnergy = s.energy;

  // Passivas do papel.
  s.collect = role.collect ? round1(role.collect * rar.pctMult * star + (ab.magnet || 0)) : 0;
  s.collectRadius = (role.collectRadius || 0) + (maxed.magnet ? 1 : 0);
  s.auraPct = role.auraPct ? role.auraPct + role.auraPctPerRarity * hero.rarity + (ab.wideAura || 0) : 0;
  s.auraRadius = (role.auraRadius || 0) + (maxed.wideAura ? 1 : 0);
  s.pierce = (role.pierce || 0) + (maxed.drill ? 1 : 0);

  // Nota antiga (soma de atributos × peso): base do ouro das expedições.
  const w = A.powerWeights;
  const base = A.ids.reduce((sum, id) => sum + s[id] * w[id], 0);
  s.score = Math.round(base * (1 + 0.15 * (s.bombs - 1)) * (1 + 0.1 * (s.range - 1)));
  // Poder = dano efetivo do herói (o que de fato derruba os objetos).
  s.power = Math.round(effectivePower(s, ab));
  return s;
}

// Dano efetivo: Ataque × crítico × penetração × bombas × alcance × ritmo × habilidades de dano.
export function effectivePower(s, ab = s.abil || {}) {
  const P = BALANCE.power;
  const crit = 1 + Math.min(100, s.critChance) / 100 * (s.critDamage / 100);
  const pen = (1 - P.refArmor * (1 - Math.min(80, s.penetration) / 100)) / (1 - P.refArmor);
  const bombs = 1 + P.bombStep * (s.bombs - 1);
  const range = 1 + P.rangeStep * (s.range - 1 + (ab.blast || 0));
  const pace = Math.pow(s.moveSpeed / P.speedRef, P.speedExp) * (1 + (s.cooldown / 100) * P.fuseCut);
  // Pesos medidos no jogo (o efeito real no tempo da fase é menor que o número da habilidade).
  const abil = (1 + 0.37 * (ab.crusher || 0)) * (1 + 0.3 * (ab.fury || 0)) * (1 + 0.5 * (ab.double || 0))
    * (1 + 0.15 * (ab.execute || 0)) * (1 + 0.15 * (ab.shrapnel || 0)) * (1 + 0.15 * (ab.chain || 0));
  return P.k * s.attack * crit * pen * bombs * range * pace * abil;
}

// Alcance evolui: papel + raridade + 1 por marco de nível + 1 com estrelas.
function rangeOf(hero, role, rar) {
  const R = A.range;
  const fromLevel = R.levelSteps.filter((lv) => hero.level >= lv).length;
  const fromStars = hero.stars >= R.starStep ? 1 : 0;
  return Math.min(R.max, role.range + rar.rangeBonus + fromLevel + fromStars);
}

// Próximo nível que aumenta o alcance (ou null se não há mais marcos).
export function nextRangeLevel(hero) {
  const role = BALANCE.roles[hero.role];
  const rar = BALANCE.rarities[hero.rarity];
  if (rangeOf(hero, role, rar) >= A.range.max) return null;
  return A.range.levelSteps.find((lv) => hero.level < lv) ?? null;
}

// Nível máximo atual (trava a cada 100 até despertar).
export function levelCap(hero) {
  const L = BALANCE.levels;
  return Math.min(L.max, L.awakenEvery * ((hero.awaken || 0) + 1));
}

// Custo de subir do nível lv para lv+1 (sem olhar o teto).
export function levelCostAt(lv, rarity = 0) {
  const L = BALANCE.levels;
  const early = Math.pow(L.costGrowth, Math.min(lv, L.softCapLevel) - 1);
  // Depois do nível 60: (nível/60)³ × lateGrowth^(nível−60) — acompanha o ouro, que cresce rápido no fim do jogo.
  const late = lv > L.softCapLevel ? Math.pow(lv / L.softCapLevel, 3) * Math.pow(L.lateGrowth ?? 1, lv - L.softCapLevel) : 1;
  return Math.round(L.baseCost * (1 + rarity) * early * late);
}

export function levelCost(hero) {
  if (hero.level >= levelCap(hero)) return null;
  return levelCostAt(hero.level, hero.rarity);
}

// Despertar disponível quando chegou no teto e ainda não está no máximo.
export function canAwakenLevel(hero) {
  return hero.level >= levelCap(hero) && hero.level < BALANCE.levels.max;
}

export function awakenCost(hero) {
  const L = BALANCE.levels;
  const a = hero.awaken || 0;
  return {
    // Ouro = o que custariam awakenLevels níveis naquele ponto (acompanha o resto do jogo).
    gold: Math.round(levelCostAt(Math.max(hero.level, (a + 1) * L.awakenEvery), hero.rarity) * L.awakenLevels),
    essence: Math.round(L.awakenEssence * (a + 1) * (a + 1) * (1 + hero.rarity)),
  };
}

export function abilityPointsTotal(hero) {
  return 1 + Math.floor(hero.level / A.abilityPointEvery);
}

export function abilityPointsAvailable(hero) {
  const spent = (hero.abilities || []).reduce((s, a) => s + (a.lvl - 1), 0);
  return Math.max(0, abilityPointsTotal(hero) - 1 - spent);
}

export function releaseEssence(hero) {
  return BALANCE.release.essence[hero.rarity] * (1 + hero.stars);
}

export function resetCost(hero) {
  return A.resetCostPerLevel * hero.level;
}

// Rank sorteado pelos pesos do balance.
export function rollRank() {
  const ranks = BALANCE.ranks;
  const total = ranks.reduce((s, r) => s + r.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ranks.length; i++) {
    r -= ranks[i].weight;
    if (r < 0) return i;
  }
  return 2;
}
