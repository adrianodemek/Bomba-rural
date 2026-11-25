// Textos de gemas.
import { STR } from '../config/strings.js';
import { GEMS, parseGem } from '../data/gems.js';
import { gemValue } from '../systems/Gems.js';
import { attrText } from './itemText.js';

export function gemLabel(key) {
  const g = parseGem(key);
  return g ? STR.gemName(GEMS[g.type].name, g.lvl) : '';
}

export function gemEffect(key) {
  const g = parseGem(key);
  return g ? attrText(GEMS[g.type].attr, gemValue(g.type, g.lvl)) : '';
}
