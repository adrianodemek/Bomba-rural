// Bônus que vêm de fora do herói: árvore da conta, gemas encaixadas e álbum.
import { economy } from './Economy.js';
import { treeStatBonus } from '../data/skilltree.js';
import { heroGemFlat } from './Gems.js';

export function extraBonus(hero) {
  const t = treeStatBonus(economy.treeRanks);
  const flat = { ...t.flat };
  for (const [a, v] of Object.entries(heroGemFlat(hero))) flat[a] = (flat[a] || 0) + v;
  const pct = { ...t.pct };
  const album = economy.albumAttackPct ? economy.albumAttackPct() : 0;
  if (album) pct.attack = (pct.attack || 0) + album;
  return { flat, pct };
}
