// Presente diário: 7 dias de login (não precisa ser seguido). No 7º dia, Gaiola Lendária.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { todayKey } from './Goals.js';
import { createRandomHero } from './Gacha.js';
import { addPassXp, passXp } from './SeasonPass.js';

export const LOGIN_DAYS = () => BALANCE.login.days;

export function loginAvailable() {
  return economy.login.last !== todayKey();
}

// Índice (0 a 6) do presente de hoje, ou do próximo.
export function loginIndex() {
  return economy.login.claimed % LOGIN_DAYS().length;
}

// Ouro do presente acompanha a fase atual (vale a pena em qualquer momento do jogo).
export function goldUnit() {
  const gi = economy.globalIndex();
  return Math.max(BALANCE.login.goldMin, Math.round(BALANCE.rewardChest.goldPerStage * gi * BALANCE.difficulties[economy.difficulty].reward));
}

// O que o dia i dá, já com os números finais.
export function loginReward(i) {
  const r = LOGIN_DAYS()[i];
  return {
    gold: r.gold ? r.gold * goldUnit() : 0,
    crystals: r.crystals || 0,
    cages: r.cages || 0,
    keys: r.keys || 0,
    legend: r.legend || 0,
  };
}

// Coleta o presente de hoje. Devolve { day, reward, hero } (hero = Lendário invocado, se houver).
export function claimLogin() {
  if (!loginAvailable()) return null;
  const i = loginIndex();
  const r = loginReward(i);
  if (r.gold) economy.addGold(r.gold);
  if (r.crystals) economy.addCrystals(r.crystals);
  if (r.cages) economy.addCages(r.cages);
  if (r.keys) economy.addKeys(r.keys);
  let hero = null;
  if (r.legend) {
    if (economy.rosterFull()) economy.legendCages += r.legend;
    else hero = summonLegend();
  }
  economy.login.last = todayKey();
  economy.login.claimed += 1;
  if (economy.login.claimed >= LOGIN_DAYS().length) {
    economy.login.claimed = 0;
    economy.login.cycles += 1;
  }
  addPassXp(passXp('login'));
  economy.emit('currency');
  return { day: i + 1, reward: r, hero };
}

// Invoca um herói Lendário (Gaiola Lendária).
export function summonLegend() {
  if (economy.rosterFull()) return null;
  const hero = createRandomHero(3);
  economy.bump('summons');
  economy.emit('roster');
  economy.emit('teams');
  return hero;
}
