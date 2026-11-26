// Equipamentos exclusivos de classe: camada especial acima dos itens comuns.
// Só a classe dona equipa; valem mais (BALANCE.items.exclusive.bonus) e formam o conjunto da classe.
// Nome = peça da classe + sobrenome da raridade ("Martelo de Pedreira" … "Martelo do Núcleo").
// Cada sobrenome combina com a cor da raridade: cinza, verde, azul, laranja e vermelho.
// Arte: uma folha 3 × 3 do ChatGPT por classe e raridade (20 folhas, 180 figuras), recortada por
// ferramentas/icons/exclusive_gear.py em texturas ex_<classe>_<espaço>_<raridade>.

export const EX_CLASSES = {
  attacker: {
    name: 'Demolidor',
    color: '#e8705a',
    theme: 'rocha, magma e demolição pesada',
    pieces: {
      weapon: 'Martelo', gloves: 'Manoplas', helm: 'Capacete', armor: 'Couraça', pants: 'Grevas',
      boots: 'Coturnos', ring: 'Anel', necklace: 'Medalhão', flask: 'Cantil',
    },
    tiers: ['de Pedreira', 'de Malaquita', 'de Cobalto', 'de Magma', 'do Núcleo'],
  },
  support: {
    name: 'Engenheira',
    color: '#5fd4e0',
    theme: 'engrenagens, oficina e energia ciano',
    pieces: {
      weapon: 'Lança-Cargas', gloves: 'Luvas Mecânicas', helm: 'Viseira', armor: 'Colete', pants: 'Perneiras',
      boots: 'Botas Magnéticas', ring: 'Anel', necklace: 'Pingente', flask: 'Bateria',
    },
    tiers: ['de Oficina', 'de Circuito', 'de Plasma', 'de Solda', 'da Aurora'],
  },
  collector: {
    name: 'Extrator',
    color: '#f2c14e',
    theme: 'garimpo, ímãs e ouro',
    pieces: {
      weapon: 'Picareta', gloves: 'Garras', helm: 'Capacete-Lanterna', armor: 'Jaqueta', pants: 'Calças de Garimpo',
      boots: 'Botinas', ring: 'Anel', necklace: 'Colar', flask: 'Frasco',
    },
    tiers: ['de Cascalho', 'de Esmeralda', 'de Safira', 'de Ouro Real', 'do Eldorado'],
  },
  specialist: {
    name: 'Técnico',
    color: '#b48cff',
    theme: 'cristais, lentes e feixes de luz',
    pieces: {
      weapon: 'Disparador', gloves: 'Luvas', helm: 'Visor', armor: 'Traje', pants: 'Perneiras',
      boots: 'Botas', ring: 'Anel', necklace: 'Amuleto', flask: 'Ampola',
    },
    tiers: ['de Campo', 'de Fóton', 'de Prisma', 'das Estrelas', 'do Infinito'],
  },
};
export const EX_CLASS_IDS = Object.keys(EX_CLASSES);

// Conjunto de cada classe (2 e 4 peças exclusivas no mesmo herói), no mesmo formato de SETS.
export const EX_SETS = {
  ex_attacker: { name: 'Demolidor', color: '#e8705a', bonus2: { attr: 'attack', pct: 0.1 }, bonus4: { attr: 'penetration', flat: 8 } },
  ex_support: { name: 'Engenheira', color: '#5fd4e0', bonus2: { attr: 'energy', pct: 0.15 }, bonus4: { attr: 'cooldown', flat: 8 } },
  ex_collector: { name: 'Extrator', color: '#f2c14e', bonus2: { attr: 'luck', flat: 4 }, bonus4: { attr: 'speed', pct: 0.1 } },
  ex_specialist: { name: 'Técnico', color: '#b48cff', bonus2: { attr: 'critChance', flat: 5 }, bonus4: { attr: 'critDamage', flat: 50 } },
};

export const exName = (cls, slot, rarity) => {
  const c = EX_CLASSES[cls];
  return c ? `${c.pieces[slot]} ${c.tiers[Math.max(0, Math.min(4, rarity))]}` : null;
};

// Folhas de arte já recortadas (preenchido por ferramentas/icons/exclusive_gear.py): "classe_raridade".
export { EX_ART } from '../config/exclusiveArt.js';
