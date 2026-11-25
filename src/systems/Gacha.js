// Invocação: abre uma Gaiola e sorteia raridade, papel, cor e nome.
import { BALANCE } from '../config/balance.js';
import { PALETTES, ROLE_IDS, NAME_FIRST_M, NAME_FIRST_F, FEMALE_ROLES, NAME_LAST } from '../data/heroes.js';
import { economy } from './Economy.js';
import { rollRank } from './HeroStats.js';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollRarity() {
  const chances = BALANCE.rarities.map((r) => r.summonChance);
  const total = chances.reduce((s, c) => s + c, 0);
  let r = Math.random() * total;
  for (let i = 0; i < chances.length; i++) {
    r -= chances[i];
    if (r < 0) return i;
  }
  return 0;
}

function uniqueName(role) {
  const first = FEMALE_ROLES.has(role) ? NAME_FIRST_F : NAME_FIRST_M;
  const used = new Set(economy.heroes.map((h) => h.name));
  for (let i = 0; i < 30; i++) {
    const n = `${pick(first)} ${pick(NAME_LAST)}`;
    if (!used.has(n)) return n;
  }
  return `${pick(first)} ${pick(NAME_LAST)} ${economy.nextUid}`;
}

// Primeira equipe com vaga livre (ou null).
export function teamWithFreeSlot() {
  for (let t = 0; t < BALANCE.teams.count; t++) {
    if (economy.teamUnlocked(t) && economy.teamMembers(t).length < economy.teamSlots) return t;
  }
  return null;
}

// Cria um herói aleatório (papel, cor, nome e Rank sorteados).
export function createRandomHero(rarity) {
  const role = pick(ROLE_IDS);
  return economy.addHero({
    name: uniqueName(role),
    palette: Math.floor(Math.random() * PALETTES.length),
    role,
    rarity,
    rank: rollRank(),
    team: teamWithFreeSlot(),
  });
}

// Gasta 1 Gaiola e devolve o herói novo (ou null sem Gaiola).
export function summon() {
  if (economy.cages <= 0 || economy.rosterFull()) return null;
  economy.cages -= 1;
  const G = BALANCE.gacha;
  let rarity = rollRarity();
  // Primeira invocação: no mínimo Rara. Garantia: Lendária depois de muitas sem sorte.
  if (economy.stats.summons === 0) rarity = Math.max(rarity, G.firstRarity);
  if (economy.pity >= G.pityEvery - 1) rarity = Math.max(rarity, 3);
  economy.pity = rarity >= 3 ? 0 : economy.pity + 1;
  const hero = createRandomHero(rarity);
  economy.bump('summons');
  economy.emit('currency');
  economy.emit('roster');
  economy.emit('teams');
  return hero;
}

export function buyCage() {
  const price = BALANCE.gacha.cageCrystalPrice;
  if (economy.crystals < price) return false;
  economy.crystals -= price;
  economy.cages += 1;
  economy.emit('currency');
  return true;
}
