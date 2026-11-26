// Baú de recompensa: gasta 1 chave e devolve a lista do que saiu.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { currentItemLevel } from './Items.js';
import { addRandomGem } from './Gems.js';

const between = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));

export function canOpenChest() {
  return economy.rewardChests > 0 && economy.keys > 0;
}

export function openRewardChest() {
  if (!canOpenChest()) return null;
  const R = BALANCE.rewardChest;
  economy.rewardChests -= 1;
  economy.keys -= 1;
  economy.bump('chestsOpened');
  const gi = economy.globalIndex();
  const gold = Math.round(R.goldPerStage * gi * BALANCE.difficulties[economy.difficulty].reward);
  const crystals = between(R.crystals);
  const minerals = between(R.minerals);
  const cage = Math.random() < R.cageChance ? 1 : 0;
  economy.addGold(gold);
  economy.addCrystals(crystals);
  economy.addMineral(economy.world, minerals);
  if (cage) economy.addCages(cage);
  const sealed = BALANCE.items.rewardChestSealed;
  economy.addSealed(sealed, currentItemLevel(), economy.world, Math.random() < BALANCE.items.exclusive.rewardChestChance);
  const gem = addRandomGem();
  economy.emit('currency');
  return { gold, crystals, minerals, cage, sealed, gem, world: economy.world };
}
