// Energia: recuperação na Casa (cápsulas) e fora dela, e distribuição das cápsulas.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { computeStats } from './HeroStats.js';
import { extraBonus } from './Bonus.js';
import { premiumRecoveryBonus, premiumOfflineHours } from './Premium.js';

export function maxEnergy(hero) {
  return computeStats(hero, 0, economy.gearOf(hero), extraBonus(hero)).maxEnergy;
}

function recoverRate(hero) {
  return (maxEnergy(hero) / BALANCE.house.recoverSecs) * (economy.recoveryMult() + economy.treeSum('recoveryPct') + premiumRecoveryBonus());
}

// Coloca nas cápsulas livres quem mais precisa, priorizando a próxima equipe a jogar.
export function assignCapsules(onField, priorityTeam) {
  const caps = economy.capsules;
  for (let i = 0; i < caps.length; i++) {
    const uid = caps[i];
    if (uid === null) continue;
    const h = economy.heroByUid(uid);
    if (!h || onField.has(uid) || h.energy >= maxEnergy(h) || i >= economy.capsulesUnlocked || economy.onExpedition(uid)) caps[i] = null;
  }
  const inCap = new Set(caps.filter((u) => u !== null));
  const candidates = economy.heroes
    .filter((h) => !onField.has(h.uid) && !inCap.has(h.uid) && h.energy < maxEnergy(h) && !economy.onExpedition(h.uid))
    .sort((a, b) => {
      const pa = a.team === priorityTeam ? 0 : a.team !== null ? 1 : 2;
      const pb = b.team === priorityTeam ? 0 : b.team !== null ? 1 : 2;
      return pa - pb || a.energy / maxEnergy(a) - b.energy / maxEnergy(b);
    });
  for (let i = 0; i < economy.capsulesUnlocked && candidates.length; i++) {
    if (caps[i] === null) caps[i] = candidates.shift().uid;
  }
}

// Recupera "dt" segundos de energia de quem não está em campo.
export function recover(dt, onField) {
  const inCap = new Set(economy.capsules.filter((u) => u !== null));
  for (const h of economy.heroes) {
    if (onField.has(h.uid)) continue;
    const max = maxEnergy(h);
    if (h.energy >= max) continue;
    const mult = inCap.has(h.uid) ? 1 : BALANCE.house.outsideRate;
    h.energy = Math.min(max, h.energy + recoverRate(h) * dt * mult);
  }
}

// Recuperação enquanto o jogo esteve fechado (com teto de horas).
export function applyOfflineRecovery(seconds) {
  const secs = Math.min(Math.max(0, seconds), (BALANCE.house.offlineCapHours + economy.treeSum('offlineHours') + premiumOfflineHours()) * 3600);
  if (secs <= 0) return;
  const none = new Set();
  // Em passos, para as cápsulas irem passando para quem ainda precisa.
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    assignCapsules(none, (economy.activeTeam + 1) % BALANCE.teams.count);
    recover(secs / steps, none);
  }
}
