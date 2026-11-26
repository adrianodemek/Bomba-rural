// Missões diárias e conquistas.
import { BALANCE } from '../config/balance.js';
import { MISSIONS, ACHIEVEMENTS, ACH_REWARD } from '../data/goals.js';
import { economy } from './Economy.js';
import { addPassXp, passXp } from './SeasonPass.js';

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Milissegundos até a meia-noite (quando as missões renovam).
export function msToReset() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next - d;
}

function eligible(m) {
  if (m.needs === 'items') return economy.items.length + economy.sealed.length > 0;
  if (m.needs === 'abyss') return economy.endlessUnlocked();
  return true;
}

// Sorteia as missões do dia (uma vez por dia).
export function ensureDaily() {
  if (economy.daily.day === todayKey() && economy.daily.missions.length) return;
  const pool = MISSIONS.filter(eligible);
  const picks = [];
  while (picks.length < BALANCE.daily.count && pool.length) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  economy.daily = {
    day: todayKey(),
    missions: picks.map((m) => ({ id: m.id, base: economy.getStat(m.stat), claimed: false })),
    bonusClaimed: false,
    colossusTries: 0,
    abyssEssence: 0,
  };
}

export function missionView(i) {
  const m = economy.daily.missions[i];
  if (!m) return null;
  const def = MISSIONS.find((x) => x.id === m.id);
  const progress = Math.min(def.target, Math.max(0, economy.getStat(def.stat) - m.base));
  return { def, progress, target: def.target, done: progress >= def.target, claimed: m.claimed };
}

export function claimMission(i) {
  const v = missionView(i);
  if (!v || !v.done || v.claimed) return false;
  economy.daily.missions[i].claimed = true;
  economy.addCrystals(BALANCE.daily.rewardCrystals);
  economy.addKeys(BALANCE.daily.rewardKeys);
  addPassXp(passXp('mission'));
  return true;
}

export function bonusReady() {
  const ms = economy.daily.missions;
  return ms.length > 0 && ms.every((m) => m.claimed) && !economy.daily.bonusClaimed;
}

export function claimBonus() {
  if (!bonusReady()) return false;
  economy.daily.bonusClaimed = true;
  economy.addCages(BALANCE.daily.bonusCages);
  economy.addEssence(BALANCE.daily.bonusEssence);
  addPassXp(passXp('bonus'));
  return true;
}

export function achView(a) {
  const tier = economy.achClaimed[a.id] || 0;
  const done = tier >= a.tiers.length;
  const target = a.tiers[Math.min(tier, a.tiers.length - 1)];
  const value = economy.getStat(a.stat);
  return { tier, max: a.tiers.length, target, value, done, claimable: !done && value >= target, reward: ACH_REWARD[Math.min(tier, 4)] };
}

export function claimAch(a) {
  const v = achView(a);
  if (!v.claimable) return 0;
  economy.achClaimed[a.id] = v.tier + 1;
  economy.addCrystals(v.reward);
  return v.reward;
}

// Quantas recompensas estão esperando (para o aviso no troféu).
export function claimableCount() {
  let n = 0;
  economy.daily.missions.forEach((_, i) => { const v = missionView(i); if (v.done && !v.claimed) n += 1; });
  if (bonusReady()) n += 1;
  for (const a of ACHIEVEMENTS) if (achView(a).claimable) n += 1;
  if (economy.starSlotNext()?.ready) n += 1;
  return n;
}

// Essência do Abismo com teto por dia (BALANCE.endless.essenceDailyCap). Devolve quanto entrou de fato.
export function abyssEssenceLeft() {
  ensureDaily();
  return Math.max(0, (BALANCE.endless.essenceDailyCap ?? Infinity) - (economy.daily.abyssEssence || 0));
}

export function grantAbyssEssence(n) {
  const g = Math.max(0, Math.min(n, abyssEssenceLeft()));
  economy.daily.abyssEssence = (economy.daily.abyssEssence || 0) + g;
  if (g) economy.addEssence(g);
  return g;
}
