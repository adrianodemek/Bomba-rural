// Comprar nós da árvore de habilidades.
import { TREE_BY_ID } from '../data/skilltree.js';
import { economy } from './Economy.js';

export function rankOf(id) {
  return economy.treeRanks[id] || 0;
}

// Um nó pode ser comprado se for o início ou se algum vizinho exigido já foi comprado.
export function nodeReachable(id) {
  const n = TREE_BY_ID[id];
  if (!n) return false;
  if (n.req.length === 0) return true;
  return n.req.some((r) => rankOf(r) > 0);
}

export function nodeCost(id) {
  const n = TREE_BY_ID[id];
  const r = rankOf(id);
  if (r >= n.max) return null;
  return Math.round(n.cost * Math.pow(n.growth, r));
}

export function canBuyNode(id) {
  const c = nodeCost(id);
  return c !== null && nodeReachable(id) && economy.gold >= c;
}

export function buyNode(id) {
  if (!canBuyNode(id)) return false;
  economy.spendGold(nodeCost(id));
  economy.treeRanks[id] = rankOf(id) + 1;
  economy.emit('tree');
  economy.emit('roster');
  economy.emit('teams');
  return true;
}
