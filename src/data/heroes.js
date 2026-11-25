// Dados fixos dos heróis: cores, papéis, raridades, nomes e o time inicial.

// Paletas de cor do corpo (uma textura gerada por paleta).
export const PALETTES = [
  { color: 0xe0563b, dark: 0x9c2f1d, light: 0xf59a7f }, // vermelho
  { color: 0x4a90d9, dark: 0x2b5c94, light: 0x9cc6f0 }, // azul
  { color: 0x6cc04a, dark: 0x3f7d2a, light: 0xb2e59a }, // verde
  { color: 0x9b6bd6, dark: 0x5f3f94, light: 0xcdb4f0 }, // roxo
  { color: 0xf0923a, dark: 0xa65a1a, light: 0xf8c290 }, // laranja
  { color: 0x3ab8b0, dark: 0x1f7a74, light: 0x9ee3de }, // turquesa
  { color: 0xe86fa8, dark: 0x9e3d6c, light: 0xf5b6d3 }, // rosa
  { color: 0xe8c93a, dark: 0x9e861a, light: 0xf5e59e }, // amarelo
];

// Classes do esquadrão (cada uma tem a sua figura; "func" é a função no time).
export const ROLES = {
  attacker: { name: 'Demolidor', func: 'Atacante', color: 0xc8442e, desc: 'Atacante: mais Ataque. Prefere objetos resistentes.' },
  support: { name: 'Engenheira', func: 'Suporte', color: 0x2aa8b8, desc: 'Suporte: aliados por perto ganham Ataque extra.' },
  collector: { name: 'Extrator', func: 'Coletor', color: 0xe0a828, desc: 'Coletor: mais ouro de objetos por perto. Prefere veios e baús.' },
  specialist: { name: 'Técnico', func: 'Especialista', color: 0x8a52d8, desc: 'Especialista: bomba perfurante, atravessa 1 objeto.' },
};
export const ROLE_IDS = Object.keys(ROLES);

export const RARITY_NAMES = ['Comum', 'Incomum', 'Raro', 'Lendário', 'Mítico'];
export const RARITY_COLORS = [0x9a9a9a, 0x5fc04a, 0x4a90d9, 0xf0923a, 0xd83a5a];
export const RARITY_TEXT = ['#c9c9c9', '#8fe07a', '#8cc2f5', '#ffb66b', '#ff7a94'];
// Cores dos Ranks E, D, C, B, A, S.
export const RANK_TEXT = ['#9a9a9a', '#c8b8d8', '#f4ead8', '#8cc2f5', '#ffb66b', '#ff7a94'];

// Partes para gerar nomes engraçados.
// Demolidor, Extrator e Técnico são meninos; a Engenheira (Suporte) é menina: o primeiro nome segue a figura.
export const NAME_FIRST_M = [
  'Pavio', 'Zé', 'Seu', 'Mestre', 'Cabo', 'Doutor', 'Sargento', 'Mané', 'Tonho', 'Juca', 'Bené', 'Dudu',
];
export const NAME_FIRST_F = [
  'Dona', 'Tia', 'Vó', 'Lili', 'Nina', 'Quica', 'Lia', 'Tina', 'Mestra', 'Doutora', 'Duda', 'Bebel',
];
export const NAME_FIRST = [...NAME_FIRST_M, ...NAME_FIRST_F];
export const FEMALE_ROLES = new Set(['support']);
// Para trocar o primeiro nome masculino de uma Engenheira antiga pelo feminino.
export const NAME_TO_F = {
  Pavio: 'Lili', 'Zé': 'Lia', Seu: 'Dona', Mestre: 'Mestra', Cabo: 'Tina', Doutor: 'Doutora', Sargento: 'Nina',
  'Mané': 'Manu', Tonho: 'Toninha', Juca: 'Juju', 'Bené': 'Bebel', Dudu: 'Duda',
};
// E o contrário, para Demolidor, Extrator e Técnico que tinham primeiro nome feminino.
export const NAME_TO_M = {
  Dona: 'Seu', Tia: 'Tio', 'Vó': 'Vô', Lili: 'Lelo', Nina: 'Nino', Quica: 'Quico', Lia: 'Léo', Tina: 'Tino',
  Mestra: 'Mestre', Doutora: 'Doutor', Duda: 'Dudu', Bebel: 'Bené', Manu: 'Mané', Toninha: 'Tonho', Juju: 'Juca',
};
export const NAME_LAST = [
  'Curto', 'Dinamite', 'Estopim', 'Pólvora', 'Faísca', 'Trovão', 'Bombinha', 'Rojão',
  'Fumaça', 'Chispa', 'Estalo', 'Cratera', 'Pedreira', 'Busca-Pé', 'Traque', 'Petardo',
];

// Time inicial (todo save novo começa com eles na Equipe A).
export const STARTER_HEROES = [
  { name: 'Pavio Curto', palette: 0, role: 'attacker' },
  { name: 'Zé Dinamite', palette: 1, role: 'collector' },
  { name: 'Lia Estopim', palette: 2, role: 'support' },
];
