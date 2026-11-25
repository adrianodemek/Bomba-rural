// Texto e cor da comparação "Superior / Inferior ao atual".
import { STR } from '../config/strings.js';
import { TXT } from '../config/theme.js';

export const CMP_COLOR = { better: '#7fe07a', empty: '#7fe07a', worse: '#ff6b5a', same: '#d8cce8', equipped: '#ffd86a' };
export const CMP_TINT = { better: 0x7fe07a, empty: 0x7fe07a, worse: 0xff6b5a, same: 0xd8cce8, equipped: 0xe8b84a };

export function cmpLong(c) {
  if (!c) return '';
  return { better: STR.cmpBetter(c.pct), worse: STR.cmpWorse(c.pct), same: STR.cmpSame, empty: STR.cmpEmpty, equipped: STR.cmpEquipped }[c.verdict];
}

export function cmpShort(c) {
  if (!c) return '';
  return { better: STR.cmpShortBetter(c.pct), worse: STR.cmpShortWorse(c.pct), same: STR.cmpShortSame, empty: STR.cmpShortEmpty, equipped: STR.cmpEquipped }[c.verdict];
}

export const cmpColor = (c) => (c ? CMP_COLOR[c.verdict] : TXT.dim);
