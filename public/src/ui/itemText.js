// Textos de item e de bônus de conjunto, usados em várias telas.
import { STR } from '../config/strings.js';
import { RARITY_NAMES } from '../data/heroes.js';
import { slotById, SETS } from '../data/items.js';
import { EX_CLASSES, EX_ART, exName } from '../data/exclusive.js';
import { itemStats, itemMain } from '../systems/Items.js';

const PCT = new Set(['luck', 'critChance', 'critDamage', 'penetration', 'cooldown']);

export function attrText(attr, v) {
  const n = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `+${String(n).replace('.', ',')}${PCT.has(attr) ? '%' : ''} ${STR.attr[attr]}`;
}

export function itemTitle(item) {
  return STR.itemName(item.cls ? exName(item.cls, item.slot, item.rarity) : slotById(item.slot).name, item.plus);
}

export function itemSubtitle(item) {
  if (item.cls) return STR.exLine(RARITY_NAMES[item.rarity], EX_CLASSES[item.cls].name, item.ilvl);
  return STR.itemLine(RARITY_NAMES[item.rarity], item.ilvl);
}

// Classe dona do item exclusivo (null nos itens comuns) e se o herói pode usar.
export const itemClass = (item) => (item?.cls ? EX_CLASSES[item.cls] : null);
export const canWear = (item, hero) => !item?.cls || !hero || item.cls === hero.role;

// [{ text, main }] com o principal primeiro.
export function itemStatLines(item) {
  const st = itemStats(item);
  const main = itemMain(item);
  const lines = [{ text: attrText(main, st[main]), main: true }];
  for (const [a, v] of Object.entries(st)) if (a !== main) lines.push({ text: attrText(a, v), main: false });
  return lines;
}

export function bonusText(b) {
  if (b.pct) return `+${Math.round(b.pct * 100)}% ${STR.attr[b.attr]}`;
  return attrText(b.attr, b.flat);
}

export function setBonusLines(setId) {
  const s = SETS[setId];
  return [STR.setBonus(2, bonusText(s.bonus2)), STR.setBonus(4, bonusText(s.bonus4))];
}

// Exclusivo com arte pronta: figura própria (ex_<classe>_<espaço>_<raridade>); senão o ícone comum do espaço.
export function itemIcon(item) {
  if (item.cls && EX_ART.includes(`${item.cls}_${item.rarity}`)) return `ex_${item.cls}_${item.slot}_${item.rarity}`;
  return `item_${item.slot}_${item.rarity}`;
}
