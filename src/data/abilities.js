// 20 habilidades de herói (5 por papel). Cada herói nasce com 2 do seu papel, nível 1 a 10.
// per = valor por nível (frações: 0.06 = 6%). bonus10 = extra no nível 10.
export const ABILITIES = {
  // Atacante
  crusher: { role: 'attacker', name: 'Quebra-Rocha', per: 0.06, desc: (v) => `+${pct(v)} de dano em pedras e veios` },
  double: { role: 'attacker', name: 'Pavio Duplo', per: 0.03, desc: (v) => `${pct(v)} de chance da bomba explodir de novo` },
  fury: { role: 'attacker', name: 'Fúria', per: 0.04, desc: (v) => `+${pct(v)} de Ataque com energia acima de 50%` },
  execute: { role: 'attacker', name: 'Golpe Final', per: 0.08, desc: (v) => `+${pct(v)} de dano em objetos com menos de 35% de HP` },
  blast: { role: 'attacker', name: 'Explosão Larga', per: 0.04, desc: (v) => `${pct(v)} de chance de +1 de alcance na bomba` },

  // Suporte (afetam aliados dentro da aura)
  wideAura: { role: 'support', name: 'Aura Ampliada', per: 0.03, bonus10: 'radius', desc: (v, l) => `+${pct(v)} na aura de Ataque${l >= 10 ? ' e +1 de raio' : ''}` },
  stamina: { role: 'support', name: 'Revigorar', per: 0.03, desc: (v) => `Aliados: ${pct(v)} de chance da bomba não gastar energia` },
  haste: { role: 'support', name: 'Passo Ligeiro', per: 0.03, desc: (v) => `Aliados: +${pct(v)} de velocidade` },
  blessing: { role: 'support', name: 'Bênção', per: 0.005, desc: (v) => `Aliados: +${pct(v)} de Sorte` },
  quickFuse: { role: 'support', name: 'Pavio Curto', per: 0.02, desc: (v) => `Aliados: pavio ${pct(v)} mais curto` },

  // Coletor
  magnet: { role: 'collector', name: 'Ímã', per: 0.04, bonus10: 'radius', desc: (v, l) => `+${pct(v)} de coleta${l >= 10 ? ' e +1 de raio' : ''}` },
  prospector: { role: 'collector', name: 'Garimpo', per: 0.05, desc: (v) => `${pct(v)} de chance de minério dobrado nos veios` },
  treasure: { role: 'collector', name: 'Caça-Tesouro', per: 0.015, desc: (v) => `+${pct(v)} de chance de lacrado e chave nos baús` },
  deepPockets: { role: 'collector', name: 'Bolso Fundo', per: 0.04, desc: (v) => `+${pct(v)} de ouro do que destruir` },
  crystalNose: { role: 'collector', name: 'Faro de Cristal', per: 0.0005, desc: (v) => `${pct(v)} de chance de cristal em qualquer objeto` },

  // Especialista
  drill: { role: 'specialist', name: 'Broca', per: 0.03, bonus10: 'pierce', desc: (v, l) => `+${pct(v)} de Penetração${l >= 10 ? ' e atravessa +1 objeto' : ''}` },
  shrapnel: { role: 'specialist', name: 'Estilhaço', per: 0.03, desc: (v) => `${pct(v)} de chance de atingir as diagonais (40% do dano)` },
  chain: { role: 'specialist', name: 'Reação em Cadeia', per: 0.06, desc: (v) => `+${pct(v)} de dano quando a bomba explode em cadeia` },
  efficient: { role: 'specialist', name: 'Eficiência', per: 0.03, desc: (v) => `${pct(v)} de chance da bomba não gastar energia` },
  critBoom: { role: 'specialist', name: 'Detonação Crítica', per: 0.01, desc: (v) => `+${pct(v)} de Chance crítica` },
};

function pct(v) {
  const n = Math.round(v * 10000) / 100;
  return `${String(n).replace('.', ',')}%`;
}

export const ABILITY_IDS = Object.keys(ABILITIES);
export const abilitiesForRole = (role) => ABILITY_IDS.filter((id) => ABILITIES[id].role === role);

// Habilidades fixas do time inicial.
export const STARTER_ABILITIES = {
  attacker: ['crusher', 'fury'],
  collector: ['deepPockets', 'magnet'],
  support: ['wideAura', 'haste'],
  specialist: ['drill', 'chain'],
};
