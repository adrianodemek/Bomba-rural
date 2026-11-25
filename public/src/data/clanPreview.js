// Clã de EXEMPLO para a prévia da tela do Clã (BALANCE.clan.enabled = false).
// Quando o servidor online existir, estes dados vêm dele: mesmo formato.
//   emblem = mosaico 8×8 em 64 dígitos hexadecimais (ver src/ui/clanEmblem.js)
import { emblemOf } from '../ui/clanEmblem.js';

//   hero = aparência do avatar (classe, cor, raridade) · damage = dano no Colosso nesta semana · tries = tentativas usadas hoje
export const CLAN_PREVIEW = {
  name: 'Lanterna Azul',
  level: 7,
  emblem: emblemOf('Estrela', 'b'),
  league: 'Liga Ouro', leaguePos: 12, leagueSize: 50,
  goldBonusPct: 8,
  weekDamage: 2.4e9,
  attackedToday: 14,
  chestReward: ['20 cristais', '30 cristais', '40 cristais + 1 gaiola', '40 cristais + 2 gaiolas', '60 cristais + 3 gaiolas'],
  members: [
    { name: 'Tio Pavio', role: 'leader', level: 312, power: '1,8M', seen: 'online', damage: 512e6, tries: 3, hero: { role: 'specialist', palette: 3, rarity: 4 } },
    { name: 'Marina Faísca', role: 'vet', level: 287, power: '1,5M', seen: 'online', damage: 401e6, tries: 2, hero: { role: 'support', palette: 5, rarity: 4 } },
    { name: 'Rafa Rojão', role: 'member', level: 260, power: '1,2M', seen: 'há 1 h', damage: 312e6, tries: 1, hero: { role: 'collector', palette: 1, rarity: 3 } },
    { name: 'Bia Brasa', role: 'vet', level: 251, power: '1,1M', seen: 'há 20 min', damage: 266e6, tries: 2, hero: { role: 'attacker', palette: 4, rarity: 3 } },
    { name: 'Chico Chispa', role: 'member', level: 240, power: '980K', seen: 'há 3 h', damage: 205e6, tries: 0, hero: { role: 'attacker', palette: 2, rarity: 3 } },
    { name: 'Lia Labareda', role: 'member', level: 222, power: '870K', seen: 'online', damage: 171e6, tries: 3, hero: { role: 'support', palette: 6, rarity: 2 } },
    { name: 'Juca Picareta', role: 'member', level: 210, power: '760K', seen: 'há 5 h', damage: 140e6, tries: 1, hero: { role: 'collector', palette: 0, rarity: 2 } },
    { name: 'Nina Néon', role: 'member', level: 198, power: '690K', seen: 'ontem', damage: 118e6, tries: 0, hero: { role: 'specialist', palette: 7, rarity: 2 } },
    { name: 'Téo Turbina', role: 'member', level: 185, power: '610K', seen: 'há 2 h', damage: 96e6, tries: 2, hero: { role: 'attacker', palette: 1, rarity: 2 } },
    { name: 'Rosa Rubi', role: 'member', level: 170, power: '540K', seen: 'há 8 h', damage: 77e6, tries: 1, hero: { role: 'support', palette: 4, rarity: 1 } },
    { name: 'Duda Dínamo', role: 'member', level: 158, power: '470K', seen: 'ontem', damage: 52e6, tries: 0, hero: { role: 'collector', palette: 5, rarity: 1 } },
    { name: 'Caio Cristal', role: 'member', level: 141, power: '390K', seen: 'há 2 dias', damage: 31e6, tries: 0, hero: { role: 'specialist', palette: 2, rarity: 1 } },
  ],
  memberCount: 18,
  ranking: [
    ['Picaretas de Ouro', 20, 9.8e9, emblemOf('Picareta', '7')],
    ['Fundo do Poço', 20, 8.1e9, emblemOf('Cristal', 'd')],
    ['Turma da Faísca', 19, 7.4e9, emblemOf('Chama', '1')],
    ['Cristal Bruto', 20, 6.2e9, emblemOf('Cristal', 'c')],
    ['Os Garimpeiros', 18, 5.5e9, emblemOf('Picareta', 'f')],
    ['Vale do Rubi', 20, 4.9e9, emblemOf('Estrela', '4')],
    ['Estrela Mineira', 17, 4.1e9, emblemOf('Estrela', '9')],
    ['Brasa Viva', 19, 3.6e9, emblemOf('Chama', 'c')],
    ['Rocha Firme', 16, 3.0e9, emblemOf('Bomba', '2')],
    ['Lua de Prata', 18, 2.7e9, emblemOf('Lua', 'c')],
    ['Trem Bala', 15, 2.5e9, emblemOf('Bomba', '9')],
  ],
  requests: [
    { name: 'Bia Brasa', hours: 8, hero: { role: 'attacker', palette: 4, rarity: 3 } },
    { name: 'Nina Néon', hours: 4, hero: { role: 'specialist', palette: 7, rarity: 2 } },
    { name: 'Téo Turbina', hours: 8, hero: { role: 'attacker', palette: 1, rarity: 2 } },
    { name: 'Rosa Rubi', hours: 1, hero: { role: 'support', palette: 4, rarity: 1 } },
  ],
  helpsToday: 3,
};

// Procura de clã (exemplos). rule: 'open' entra direto · 'approval' o líder aprova · minPower = poder mínimo da equipe.
export const CLAN_INVITE = { from: 'Marina Faísca', clan: 'Lanterna Azul', league: 'Liga Ouro', emblem: CLAN_PREVIEW.emblem };
export const CLAN_SEARCH = [
  { name: 'Cristal Bruto', level: 9, members: 17, active: 'ativo hoje', league: 'Liga Ouro', damage: 6.2e9, rule: 'open', minPower: 0, lang: 'pt', emblem: emblemOf('Cristal', 'c') },
  { name: 'Turma da Faísca', level: 8, members: 19, active: 'ativo hoje', league: 'Liga Ouro', damage: 7.4e9, rule: 'approval', minPower: 50e3, lang: 'pt', emblem: emblemOf('Chama', '1') },
  { name: 'Estrela Mineira', level: 6, members: 12, active: 'ativo hoje', league: 'Liga Prata', damage: 1.9e9, rule: 'open', minPower: 0, lang: 'pt', emblem: emblemOf('Estrela', '9') },
  { name: 'Lua de Prata', level: 5, members: 9, active: 'ativo ontem', league: 'Liga Prata', damage: 8.2e8, rule: 'open', minPower: 0, lang: 'pt', emblem: emblemOf('Lua', 'c') },
  { name: 'Picaretas de Ouro', level: 12, members: 20, active: 'ativo hoje', league: 'Liga Diamante', damage: 9.8e9, rule: 'approval', minPower: 2e6, lang: 'pt', emblem: emblemOf('Picareta', '7') },
  { name: 'Rocha Firme', level: 4, members: 16, active: 'ativo hoje', league: 'Liga Bronze', damage: 3.0e8, rule: 'open', minPower: 0, lang: 'pt', emblem: emblemOf('Bomba', '2') },
  { name: 'Os Garimpeiros', level: 7, members: 18, active: 'ativo hoje', league: 'Liga Prata', damage: 1.2e9, rule: 'approval', minPower: 20e3, lang: 'pt', emblem: emblemOf('Picareta', 'f') },
  { name: 'Brasa Viva', level: 6, members: 14, active: 'ativo há 2 dias', league: 'Liga Prata', damage: 6.4e8, rule: 'open', minPower: 0, lang: 'pt', emblem: emblemOf('Chama', 'c') },
  { name: 'Deep Miners', level: 10, members: 18, active: 'ativo hoje', league: 'Liga Ouro', damage: 5.1e9, rule: 'open', minPower: 100e3, lang: 'en', emblem: emblemOf('Cristal', 'b') },
  { name: 'Trem Bala', level: 3, members: 8, active: 'ativo hoje', league: 'Liga Bronze', damage: 1.1e8, rule: 'open', minPower: 0, lang: 'pt', emblem: emblemOf('Bomba', '9') },
];
