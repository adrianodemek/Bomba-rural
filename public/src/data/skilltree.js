// Árvore de habilidades da conta (vale para todos os heróis).
// type = efeito · per = valor por rank · max = ranks · req = precisa de QUALQUER um destes comprado
// cost = ouro do 1º rank · growth = multiplica o custo a cada rank. x/y = posição na tela da árvore.
const N = (id, name, type, per, max, x, y, req, cost, growth = 2) => ({ id, name, type, per, max, x, y, req, cost, growth });

export const TREE = [
  N('start', 'Início', 'none', 0, 1, 700, 700, [], 0),

  // ---------- Economia (esquerda) ----------
  N('e1', 'Bolsa de Couro', 'goldPct', 0.04, 5, 560, 640, ['start'], 500, 2.2),
  N('e2', 'Soneca Longa', 'offlineHours', 1, 4, 420, 580, ['e1'], 3000, 2.5),
  N('e3', 'Olho de Lince', 'chestPct', 0.04, 5, 520, 500, ['e1'], 4000, 2.3),
  N('e4', 'Cofre', 'goldPct', 0.06, 5, 300, 520, ['e2'], 4e4, 2.3),
  N('e5', 'Sonho Produtivo', 'offlineEff', 0.05, 4, 300, 650, ['e2'], 3e4, 2.5),
  N('e6', 'Garimpeiro de Cristal', 'crystalStage', 0.1, 3, 420, 420, ['e3'], 5e4, 4),
  N('e7', 'Alquimia', 'essencePct', 0.1, 5, 180, 450, ['e4'], 2e5, 2.5),
  N('e8', 'Tesouro Real', 'goldPct', 0.08, 5, 180, 590, ['e4', 'e5'], 1e6, 2.5),
  N('e9', 'Hibernação', 'offlineHours', 2, 4, 70, 520, ['e7', 'e8'], 5e6, 3),
  N('e10', 'Mapa do Tesouro', 'chestPct', 0.06, 5, 320, 340, ['e6'], 5e5, 2.5),
  N('e11', 'Mina de Ouro', 'goldPct', 0.1, 10, 190, 320, ['e10', 'e7'], 2e7, 2),

  // ---------- Esquadrão (direita) ----------
  N('s1', 'Comandante I', 'attackPct', 0.02, 1, 840, 640, ['start'], 30000),
  N('s2', 'Fôlego', 'energyPct', 0.05, 5, 980, 600, ['s1', 's3'], 3000, 2.2),
  N('s3', 'Cápsula Turbo', 'recoveryPct', 0.1, 5, 900, 500, ['start', 's1'], 4000, 2.2),
  N('s4', 'Comandante II', 'attackPct', 0.02, 1, 1120, 560, ['s2'], 1e6),
  N('s5', 'Pernas Leves', 'speedPct', 0.03, 5, 1040, 440, ['s3', 's2'], 2e4, 2.3),
  N('s6', 'Alojamento', 'heroSlots', 5, 4, 900, 370, ['s3'], 3e4, 3),
  N('s7', 'Comandante III', 'attackPct', 0.02, 1, 1260, 520, ['s4'], 2e7),
  N('s8', 'Fôlego II', 'energyPct', 0.06, 5, 1180, 420, ['s4', 's5'], 3e5, 2.3),
  N('s9', 'Comandante IV', 'attackPct', 0.02, 1, 1340, 410, ['s7', 's8'], 6e8),
  N('s10', 'Cápsula Turbo II', 'recoveryPct', 0.12, 5, 1040, 310, ['s5', 's6'], 5e5, 2.3),
  N('s11', 'Comandante V', 'attackPct', 0.02, 1, 1300, 290, ['s9'], 1e10),
  N('s12', 'Pernas Leves II', 'speedPct', 0.04, 5, 1170, 270, ['s10', 's8'], 8e6, 2.3),
  N('s13', 'Comandante VI', 'attackPct', 0.02, 1, 1200, 150, ['s11', 's12'], 8e10),

  // ---------- Combate (baixo) ----------
  N('c1', 'Pólvora Fina', 'attackPct', 0.03, 10, 700, 850, ['start'], 400, 2),
  N('c2', 'Mira', 'critChance', 1, 5, 580, 940, ['c1'], 3000, 2.4),
  N('c3', 'Pavio Rápido', 'cooldown', 1, 5, 820, 940, ['c1'], 3000, 2.4),
  N('c4', 'Pólvora Negra', 'attackPct', 0.05, 10, 700, 1030, ['c2', 'c3'], 6e4, 2),
  N('c5', 'Impacto', 'critDamage', 5, 5, 520, 1080, ['c2', 'c4'], 8e4, 2.4),
  N('c6', 'Perfurante', 'penetration', 1, 5, 880, 1080, ['c3', 'c4'], 8e4, 2.4),
  N('c7', 'Trevo', 'luck', 1, 5, 700, 1180, ['c4'], 2e5, 2.5),
  N('c8', 'Pólvora Real', 'attackPct', 0.07, 10, 600, 1260, ['c5', 'c7'], 3e6, 2),
  N('c9', 'Mira Perfeita', 'critChance', 1.5, 5, 800, 1260, ['c6', 'c7'], 2e6, 2.4),
  N('c10', 'Dinamite Pura', 'attackPct', 0.1, 10, 700, 1360, ['c8', 'c9'], 5e8, 1.9),
  N('c11', 'Impacto II', 'critDamage', 8, 5, 460, 1220, ['c5', 'c8'], 1e7, 2.4),
  N('c12', 'Perfurante II', 'penetration', 1.5, 5, 940, 1220, ['c6', 'c9'], 1e7, 2.4),
];

export const TREE_BY_ID = Object.fromEntries(TREE.map((n) => [n.id, n]));

// Textos dos efeitos.
const P = (v) => `${String(Math.round(v * 1000) / 10).replace('.', ',')}%`;
export const EFFECT_TEXT = {
  none: () => 'O começo de tudo',
  goldPct: (v) => `+${P(v)} de ouro`,
  offlineHours: (v) => `+${v} h no limite do ganho offline`,
  offlineEff: (v) => `+${P(v)} de rendimento offline`,
  chestPct: (v) => `+${P(v)} de chance de lacrado e chave nos baús`,
  crystalStage: (v) => `${P(v)} de chance de +1 cristal por fase concluída`,
  essencePct: (v) => `+${P(v)} de essência`,
  energyPct: (v) => `+${P(v)} de Energia`,
  recoveryPct: (v) => `+${P(v)} de recuperação na Casa`,
  speedPct: (v) => `+${P(v)} de Velocidade`,
  heroSlots: (v) => `+${v} vagas no elenco`,
  attackPct: (v) => `+${P(v)} de Ataque`,
  critChance: (v) => `+${v}% de Chance crítica`,
  cooldown: (v) => `+${v}% de Recarga`,
  critDamage: (v) => `+${v}% de Dano crítico`,
  penetration: (v) => `+${v}% de Penetração`,
  luck: (v) => `+${v}% de Sorte`,
};

export function treeEffectSum(ranks, type) {
  let sum = 0;
  for (const n of TREE) if (n.type === type && ranks[n.id]) sum += n.per * ranks[n.id];
  return sum;
}

// Bônus de atributos da árvore, no formato usado pelo cálculo de atributos.
export function treeStatBonus(ranks) {
  return {
    pct: {
      attack: treeEffectSum(ranks, 'attackPct'),
      energy: treeEffectSum(ranks, 'energyPct'),
      speed: treeEffectSum(ranks, 'speedPct'),
    },
    flat: {
      critChance: treeEffectSum(ranks, 'critChance'),
      critDamage: treeEffectSum(ranks, 'critDamage'),
      penetration: treeEffectSum(ranks, 'penetration'),
      cooldown: treeEffectSum(ranks, 'cooldown'),
      luck: treeEffectSum(ranks, 'luck'),
    },
  };
}
