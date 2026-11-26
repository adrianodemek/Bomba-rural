// Espaços de equipamento e conjuntos (nomes originais do Bomba Rural).
import { EX_SETS } from './exclusive.js';

// main = atributo principal do espaço.
export const SLOTS = [
  { id: 'weapon', name: 'Detonador', main: 'attack' },
  { id: 'gloves', name: 'Luvas', main: 'luck' },
  { id: 'helm', name: 'Elmo', main: 'penetration' },
  { id: 'armor', name: 'Peitoral', main: 'energy' },
  { id: 'pants', name: 'Calças', main: 'critChance' },
  { id: 'boots', name: 'Botas', main: 'speed' },
  { id: 'ring', name: 'Anel', main: 'attack' },
  { id: 'necklace', name: 'Colar', main: 'critDamage' },
  { id: 'flask', name: 'Frasco', main: 'cooldown' },
];
export const SLOT_IDS = SLOTS.map((s) => s.id);
export const slotById = (id) => SLOTS.find((s) => s.id === id);

// Espaços do herói (10): o tipo diz qual item cabe. Dois espaços de Anel.
export const GEAR_SLOTS = [
  { key: 'weapon', type: 'weapon', name: 'Detonador' },
  { key: 'gloves', type: 'gloves', name: 'Luvas' },
  { key: 'helm', type: 'helm', name: 'Elmo' },
  { key: 'armor', type: 'armor', name: 'Peitoral' },
  { key: 'pants', type: 'pants', name: 'Calças' },
  { key: 'boots', type: 'boots', name: 'Botas' },
  { key: 'ring', type: 'ring', name: 'Anel' },
  { key: 'ring2', type: 'ring', name: 'Anel 2' },
  { key: 'necklace', type: 'necklace', name: 'Colar' },
  { key: 'flask', type: 'flask', name: 'Frasco' },
];
export const GEAR_KEYS = GEAR_SLOTS.map((g) => g.key);
export const gearSlotByKey = (k) => GEAR_SLOTS.find((g) => g.key === k);

// Bônus de conjunto: com 2 e 4 peças equipadas no mesmo herói.
// flat = soma no atributo · pct = multiplica o atributo (0.15 = +15%).
export const SETS = {
  miner: {
    name: 'Minerador',
    color: '#ffd86a',
    bonus2: { attr: 'luck', flat: 3 },
    bonus4: { attr: 'energy', pct: 0.15 },
  },
  spark: {
    name: 'Faísca',
    color: '#ff9a4a',
    bonus2: { attr: 'critChance', flat: 5 },
    bonus4: { attr: 'critDamage', flat: 40 },
  },
  thunder: {
    name: 'Trovão',
    color: '#8cc2f5',
    bonus2: { attr: 'attack', pct: 0.15 },
    bonus4: { attr: 'penetration', flat: 10 },
  },
};
// Conjuntos que caem nos itens comuns (os exclusivos de classe usam o conjunto da própria classe).
export const SET_IDS = Object.keys(SETS);
Object.assign(SETS, EX_SETS);
export const ALL_SET_IDS = Object.keys(SETS);
