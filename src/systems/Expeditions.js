// Expedições: heróis sem equipe saem por algumas horas (tempo real) e voltam com prêmios.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { statsOf } from './Roster.js';
import { dropGemLevel, addRandomGem } from './Gems.js';
import { currentItemLevel } from './Items.js';
import { expeditionSlots } from './Premium.js';

const X = BALANCE.expeditions;

export function eligibleHeroes() {
  return economy.heroes.filter((h) => h.team === null && !economy.onExpedition(h.uid));
}

export function previewReward(hero, hours) {
  const gi = economy.globalIndex();
  return {
    gold: Math.round(statsOf(hero).score * X.goldPerPowerHour * hours * (1 + gi / 24)),
    crystals: X.crystalsPerHour * hours,
    essence: Math.floor(hours / 2) * X.essencePer2h,
    gems: Math.floor(hours / X.gemEveryHours),
    gemLevel: dropGemLevel(),
    sealed: Math.floor(hours / X.sealedEveryHours),
    ilvl: currentItemLevel(),
  };
}

export function canSend() {
  return economy.expeditions.length < expeditionSlots();
}

export function send(hero, hours) {
  if (!canSend() || hero.team !== null || economy.onExpedition(hero.uid)) return false;
  economy.expeditions.push({ uid: hero.uid, endsAt: Date.now() + hours * 3600000, hours, reward: previewReward(hero, hours) });
  economy.capsules = economy.capsules.map((u) => (u === hero.uid ? null : u));
  economy.emit('expeditions');
  economy.emit('roster');
  return true;
}

export function msLeft(e) {
  return Math.max(0, e.endsAt - Date.now());
}

export function isDone(e) {
  return msLeft(e) <= 0;
}

export function readyCount() {
  return economy.expeditions.filter(isDone).length;
}

export function collect(i) {
  const e = economy.expeditions[i];
  if (!e || !isDone(e)) return null;
  const r = e.reward;
  economy.expeditions.splice(i, 1);
  economy.addGold(r.gold);
  economy.addCrystals(r.crystals);
  if (r.essence) economy.addEssence(r.essence);
  const gems = [];
  for (let k = 0; k < r.gems; k++) gems.push(addRandomGem(r.gemLevel));
  if (r.sealed) economy.addSealed(r.sealed, r.ilvl, economy.world);
  economy.bump('expeditions');
  economy.emit('expeditions');
  economy.emit('roster');
  return { ...r, gemKeys: gems, hero: economy.heroByUid(e.uid) };
}
