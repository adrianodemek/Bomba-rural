// Ganho enquanto o jogo esteve fechado: ouro por segundo médio × tempo fora × eficiência.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { premiumOfflineHours } from './Premium.js';

export function applyOfflineGains(seconds) {
  const O = BALANCE.offline;
  if (!(seconds >= O.minSeconds)) return null;
  const capHours = O.capHours + economy.treeSum('offlineHours') + premiumOfflineHours();
  const secs = Math.min(seconds, capHours * 3600);
  const gold = Math.floor(economy.goldRate * secs * (O.efficiency + economy.treeSum('offlineEff')));
  // Minério do mundo atual: valor fixo por hora fora (não cresce com o ouro).
  const minerals = Math.floor((secs / 3600) * O.mineralsPerHour);
  if (gold > 0) economy.addGold(gold);
  if (minerals > 0) economy.addMineral(economy.world, minerals);
  const bonus = comebackBonus(seconds);
  if (bonus.crystals) economy.addCrystals(bonus.crystals);
  if (bonus.cages) economy.addCages(bonus.cages);
  if (bonus.keys) economy.addKeys(bonus.keys);
  const result = { seconds, cappedSeconds: secs, capped: seconds > secs, capHours, gold, minerals, world: economy.world, bonus };
  economy.pendingOffline = result;
  return result;
}

// Baú de retorno: cristais por hora fora, gaiola depois de 12 h, chave depois de 1 dia...
export function comebackBonus(seconds) {
  const C = BALANCE.comeback;
  const hours = Math.min(C.maxHours, seconds / 3600);
  if (hours < C.minHours) return { crystals: 0, cages: 0, keys: 0, hours };
  return {
    hours,
    crystals: Math.min(C.crystalsMax, Math.floor(hours * C.crystalsPerHour)),
    cages: C.cageAt.filter((h) => hours >= h).length,
    keys: hours >= C.keyAt ? 1 : 0,
  };
}
