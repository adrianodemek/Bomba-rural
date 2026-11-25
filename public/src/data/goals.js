// Missões diárias e conquistas. "stat" aponta para economy.stats (contadores da conta).

// Missões: alvo fixo por dia. needs = condição para aparecer (opcional).
export const MISSIONS = [
  { id: 'objects', stat: 'objects', target: 300, text: (n) => `Destrua ${n} objetos` },
  { id: 'stages', stat: 'stagesCleared', target: 8, text: (n) => `Conclua ${n} fases` },
  { id: 'chests', stat: 'chestObjects', target: 12, text: (n) => `Exploda ${n} baús na arena` },
  { id: 'crits', stat: 'crits', target: 60, text: (n) => `Acerte ${n} bombas críticas` },
  { id: 'levels', stat: 'levelUps', target: 10, text: (n) => `Suba ${n} níveis de heróis` },
  { id: 'forge', stat: 'forgeAttempts', target: 3, text: (n) => `Tente forjar ${n} vezes`, needs: 'items' },
  { id: 'reveal', stat: 'sealedRevealed', target: 2, text: (n) => `Revele ${n} lacrados`, needs: 'items' },
  { id: 'summon', stat: 'summons', target: 1, text: (n) => `Invoque ${n} herói` },
  { id: 'abyss', stat: 'endlessDepths', target: 5, text: (n) => `Desça ${n} profundidades no Abismo`, needs: 'abyss' },
  { id: 'colossus', stat: 'colossusRuns', target: 1, text: () => 'Enfrente o Colosso da semana', needs: 'abyss' },
  { id: 'expedition', stat: 'expeditions', target: 2, text: (n) => `Colete ${n} expedições` },
];

// Conquistas com 5 níveis. reward = cristais por nível.
export const ACHIEVEMENTS = [
  { id: 'demolisher', name: 'Demolidor', stat: 'objects', tiers: [100, 1000, 10000, 100000, 1000000], text: (n) => `Destrua ${n} objetos` },
  { id: 'explorer', name: 'Desbravador', stat: 'stagesCleared', tiers: [10, 50, 200, 600, 2000], text: (n) => `Conclua ${n} fases` },
  { id: 'tycoon', name: 'Magnata', stat: 'totalGold', tiers: [1e4, 1e6, 1e8, 1e10, 1e12], text: (n) => `Junte ${n} de ouro no total` },
  { id: 'recruiter', name: 'Recrutador', stat: 'summons', tiers: [5, 25, 100, 300, 1000], text: (n) => `Invoque ${n} heróis` },
  { id: 'smith', name: 'Ferreiro', stat: 'forgeSuccess', tiers: [5, 25, 100, 400, 1000], text: (n) => `Forje com sucesso ${n} vezes` },
  { id: 'master', name: 'Mestre da Forja', stat: 'maxPlus', tiers: [5, 9, 12, 14, 15], text: (n) => `Leve um item até +${n}` },
  { id: 'curious', name: 'Curioso', stat: 'sealedRevealed', tiers: [5, 50, 200, 800, 2000], text: (n) => `Revele ${n} lacrados` },
  { id: 'hunter', name: 'Caçador de Baús', stat: 'chestsOpened', tiers: [1, 10, 50, 150, 500], text: (n) => `Abra ${n} baús de recompensa` },
  { id: 'sniper', name: 'Na Mosca', stat: 'crits', tiers: [50, 500, 5000, 50000, 500000], text: (n) => `Acerte ${n} críticos` },
  { id: 'abyssal', name: 'Abissal', stat: 'endlessBest', tiers: [10, 25, 50, 75, 100], text: (n) => `Chegue à profundidade ${n} do Abismo` },
  { id: 'conqueror', name: 'Conquistador', stat: 'worldsDone', tiers: [1, 5, 10, 18, 25], text: (n) => `Mundos concluídos, em qualquer dificuldade: ${n}` },
  { id: 'veteran', name: 'Veterano', stat: 'maxHeroLevel', tiers: [50, 100, 200, 350, 500], text: (n) => `Leve um herói ao nível ${n}` },
  { id: 'collector', name: 'Colecionador', stat: 'legendaries', tiers: [1, 3, 6, 10, 20], text: (n) => `Tenha ${n} heróis Lendários ou Míticos` },
  { id: 'wanderer', name: 'Andarilho', stat: 'expeditions', tiers: [1, 10, 50, 200, 1000], text: (n) => `Colete ${n} expedições` },
  { id: 'titan', name: 'Matador de Titãs', stat: 'colossusBestEver', tiers: [1e5, 1e7, 1e9, 1e11, 1e13], text: (n) => `Cause ${n} de dano num Colosso` },
  { id: 'album', name: 'Álbum Completo', stat: 'albumCount', tiers: [10, 30, 50, 65, 73], text: (n) => `Descubra ${n} entradas do álbum` },
  { id: 'sage', name: 'Sábio', stat: 'treeRanks', tiers: [5, 20, 50, 100, 150], text: (n) => `Compre ${n} ranks na árvore` },
];
export const ACH_REWARD = [5, 10, 20, 40, 80];
