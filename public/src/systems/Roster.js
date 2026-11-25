// Ações sobre heróis: subir nível, fundir estrela, trocar de equipe.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { extraBonus } from './Bonus.js';
import {
  computeStats, levelCost, pointsAvailable, resetCost, emptyAlloc, pointsSpent,
  canAwakenLevel, awakenCost, abilityPointsAvailable, releaseEssence, levelCostAt, levelCap,
} from './HeroStats.js';

export function statsOf(hero) {
  return computeStats(hero, economy.powerLevel, economy.gearOf(hero), extraBonus(hero));
}

export function levelUp(hero) {
  const cost = levelCost(hero);
  if (cost === null || !economy.spendGold(cost)) return false;
  const before = computeStats(hero).maxEnergy;
  hero.level += 1;
  economy.bump('levelUps');
  // Ganha a diferença de energia máxima, para não "perder" energia ao subir.
  hero.energy += computeStats(hero).maxEnergy - before;
  economy.emit('roster');
  return true;
}

// "Subir nível da equipe": sempre o nível mais barato da equipe, até maxLevels ou o ouro acabar.
// Devolve o plano (sem gastar): steps = heróis na ordem, n níveis, cost total, nextCost (se não deu nenhum)
// e capped = primeiro herói travado no teto esperando Despertar.
export function teamLevelPlan(team, maxLevels = 10, gold = economy.gold) {
  const hs = economy.teamMembers(team);
  const lv = new Map(hs.map((h) => [h.uid, h.level]));
  const steps = [];
  let cost = 0;
  let nextCost = null;
  while (steps.length < maxLevels) {
    let best = null;
    let bc = Infinity;
    for (const h of hs) {
      const l = lv.get(h.uid);
      if (l >= levelCap(h)) continue;
      const c = levelCostAt(l, h.rarity);
      if (c < bc) { bc = c; best = h; }
    }
    if (!best) break;
    if (cost + bc > gold) { if (!steps.length) nextCost = bc; break; }
    cost += bc;
    steps.push(best);
    lv.set(best.uid, lv.get(best.uid) + 1);
  }
  const capped = hs.find((h) => canAwakenLevel(h)) || null;
  return { steps, n: steps.length, cost, nextCost, capped };
}

export function levelTeam(team, maxLevels = 10) {
  const plan = teamLevelPlan(team, maxLevels);
  let done = 0;
  for (const h of plan.steps) { if (!levelUp(h)) break; done += 1; }
  return done;
}

// Duplicado = mesma raridade e mesmo papel. "onField" diz quem está em campo agora.
export function fusionCandidates(hero, onField = new Set()) {
  return economy.heroes
    .filter((h) => h.uid !== hero.uid && h.rarity === hero.rarity && h.role === hero.role && !onField.has(h.uid) && !h.locked && !economy.onExpedition(h.uid))
    .sort((a, b) => a.level - b.level || a.stars - b.stars);
}

export function canFuse(hero, onField) {
  return hero.stars < BALANCE.stars.max && fusionCandidates(hero, onField).length > 0;
}

// Consome o duplicado de menor nível e dá +1 estrela.
export function fuse(hero, onField) {
  if (!canFuse(hero, onField)) return null;
  const food = fusionCandidates(hero, onField)[0];
  economy.removeHero(food.uid);
  hero.stars += 1;
  economy.emit('roster');
  economy.emit('teams');
  economy.emit('items');
  economy.emit('gems');
  return food;
}

// team: 0..2 ou null. Falha se a equipe estiver cheia.
export function assignTeam(hero, team) {
  if (team === hero.team) return true;
  if (team !== null && economy.onExpedition(hero.uid)) return false;
  if (team !== null && !economy.teamUnlocked(team)) return false;
  if (team !== null && economy.teamMembers(team).length >= economy.teamSlots) return false;
  hero.team = team;
  economy.emit('roster');
  economy.emit('teams');
  return true;
}

// Põe "hero" numa vaga da equipe. Se a vaga tinha alguém (replace), os dois trocam de lugar: o herói da vaga
// vai para a equipe de onde o outro veio (ou fica sem equipe) e assume a mesma posição na lista.
export function placeInTeam(hero, team, replace = null) {
  if (!hero || economy.onExpedition(hero.uid) || !economy.teamUnlocked(team)) return false;
  if (replace && replace.uid === hero.uid) return true;
  if (replace) {
    const from = hero.team;
    const a = economy.heroes.indexOf(replace);
    const b = economy.heroes.indexOf(hero);
    if (a >= 0 && b >= 0) { economy.heroes[a] = hero; economy.heroes[b] = replace; }
    hero.team = team;
    replace.team = from === team ? team : from;
  } else {
    if (hero.team === team) return true;
    if (economy.teamMembers(team).length >= economy.teamSlots) return false;
    hero.team = team;
  }
  economy.emit('roster');
  economy.emit('teams');
  return true;
}

export function teamLetter(team) {
  return team === null || team === undefined ? '–' : 'ABC'[team];
}

// Gasta 1 ponto num atributo.
export function allocate(hero, attr) {
  if (pointsAvailable(hero) <= 0) return false;
  const cap = BALANCE.attributes.caps[attr];
  if (cap !== undefined && statsOf(hero)[attr] >= cap) return false;
  const before = computeStats(hero).maxEnergy;
  hero.alloc[attr] = (hero.alloc[attr] || 0) + 1;
  if (attr === 'energy') hero.energy += computeStats(hero).maxEnergy - before;
  economy.emit('roster');
  return true;
}

// Devolve todos os pontos (custa ouro).
export function resetPoints(hero) {
  if (pointsSpent(hero) === 0) return false;
  if (!economy.spendGold(resetCost(hero))) return false;
  hero.alloc = emptyAlloc();
  hero.energy = Math.min(hero.energy, computeStats(hero).maxEnergy);
  economy.emit('roster');
  return true;
}

// ---------- Despertar ----------
export function canAwaken(hero) {
  if (!canAwakenLevel(hero)) return false;
  const c = awakenCost(hero);
  return economy.gold >= c.gold && economy.essence >= c.essence;
}

export function awaken(hero) {
  if (!canAwaken(hero)) return false;
  const c = awakenCost(hero);
  economy.spendGold(c.gold);
  economy.essence -= c.essence;
  hero.awaken = (hero.awaken || 0) + 1;
  economy.emit('currency');
  economy.emit('roster');
  return true;
}

// ---------- Habilidades ----------
export function upgradeAbility(hero, index) {
  const a = hero.abilities?.[index];
  if (!a || a.lvl >= BALANCE.attributes.abilityMax || abilityPointsAvailable(hero) <= 0) return false;
  a.lvl += 1;
  economy.emit('roster');
  return true;
}

export function abilityResetCost(hero) {
  return BALANCE.attributes.abilityResetCost * ((hero.awaken || 0) + 1);
}

export function resetAbilities(hero) {
  if (!hero.abilities.some((a) => a.lvl > 1)) return false;
  if (!economy.spendGold(abilityResetCost(hero))) return false;
  hero.abilities.forEach((a) => { a.lvl = 1; });
  economy.emit('roster');
  return true;
}

// ---------- Liberar herói ----------
export function canRelease(hero, onField = new Set()) {
  return economy.heroes.length > 3 && !onField.has(hero.uid) && !hero.locked && !economy.onExpedition(hero.uid);
}

export function releaseHero(hero, onField) {
  if (!canRelease(hero, onField)) return 0;
  const ess = Math.round(releaseEssence(hero) * (1 + economy.treeSum('essencePct')));
  economy.removeHero(hero.uid);
  economy.addEssence(ess);
  economy.emit('gems');
  economy.emit('roster');
  economy.emit('teams');
  economy.emit('items');
  return ess;
}

export function toggleHeroLock(hero) {
  hero.locked = !hero.locked;
  economy.emit('roster');
  return hero.locked;
}
