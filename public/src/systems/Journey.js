// Jornada do Mineiro: as primeiras tarefas guiadas do jogo, abas liberadas aos poucos
// e o "próximo objetivo" que aparece na barra de baixo da arena.
import { BALANCE } from '../config/balance.js';
import { STR } from '../config/strings.js';
import { economy } from './Economy.js';
import { statsOf } from './Roster.js';
import { nextRangeLevel } from './HeroStats.js';

// Maior fase concluída no Mundo 1, modo Fácil (a Jornada acontece toda nele).
const cleared = () => economy.progress[0][0];
const maxLevel = () => economy.heroes.reduce((m, h) => Math.max(m, h.level), 0);
const hasGear = () => economy.heroes.some((h) => Object.values(h.gear || {}).some(Boolean));

// hint = aba que a seta aponta enquanto a tarefa não termina.
// count() devolve [atual, alvo] para mostrar o progresso (opcional).
export const JOURNEY = [
  { id: 'stage1', count: () => [cleared(), 1], reward: { gold: 40 } },
  { id: 'level2', count: () => [maxLevel(), 2], reward: { gold: 60 }, hint: 'heroes' },
  { id: 'stage3', count: () => [cleared(), 3], reward: { cages: 1 } },
  { id: 'summon', count: () => [economy.stats.summons, 1], reward: { crystals: 5, sealed: 1 }, hint: 'heroes' },
  { id: 'reveal', count: () => [economy.stats.sealedRevealed, 1], reward: { gold: 100 }, hint: 'inventory' },
  { id: 'equip', count: () => [hasGear() ? 1 : 0, 1], reward: { gold: 120 }, hint: 'inventory' },
  { id: 'level10', count: () => [maxLevel(), 10], reward: { crystals: 10 }, hint: 'heroes' },
  { id: 'stage6', count: () => [cleared(), 6], reward: { gold: 300 } },
  { id: 'tree', count: () => [economy.getStat('treeRanks'), 1], reward: { crystals: 10 }, hint: 'skills' },
  { id: 'stage10', count: () => [cleared(), 10], reward: { cages: 1 } },
  { id: 'expedition', count: () => [economy.expeditions.length || economy.stats.expeditions ? 1 : 0, 1], reward: { gold: 500 }, hint: 'house' },
  { id: 'boss', count: () => [cleared(), BALANCE.stage.stagesPerWorld], reward: { crystals: 30, cages: 2 } },
];

export function journeyStep() {
  return JOURNEY[economy.journeyStep] || null;
}

export function journeyDone() {
  return economy.journeyStep >= JOURNEY.length;
}

export function stepComplete(step = journeyStep()) {
  if (!step) return false;
  const [cur, target] = step.count();
  return cur >= target;
}

// Paga o prêmio da tarefa atual e avança. Devolve o prêmio (ou null).
export function claimStep() {
  const step = journeyStep();
  if (!step || !stepComplete(step)) return null;
  const r = step.reward;
  if (r.gold) economy.addGold(r.gold);
  if (r.crystals) economy.addCrystals(r.crystals);
  if (r.cages) economy.addCages(r.cages);
  if (r.sealed) economy.addSealed(r.sealed, 1, 0);
  economy.journeyStep += 1;
  economy.emit('currency');
  economy.emit('items');
  return { step, index: economy.journeyStep, reward: r };
}

// ---------- Abas liberadas aos poucos ----------
// Fase do Mundo 1 (Fácil) que precisa estar concluída para a aba abrir.
export const TAB_UNLOCK = BALANCE.unlocks;

export function tabUnlocked(id) {
  const need = TAB_UNLOCK[id];
  return need === undefined || cleared() >= need;
}

// Abas que abriram e ainda não foram comemoradas.
export function newlyUnlockedTabs() {
  return Object.keys(TAB_UNLOCK).filter((id) => tabUnlocked(id) && !economy.unlockSeen.includes(id));
}

export function markTabSeen(id) {
  if (!economy.unlockSeen.includes(id)) economy.unlockSeen.push(id);
}

// ---------- Próximo objetivo (depois da Jornada) ----------
// Lista curta de metas próximas; a barra alterna entre elas.
export function nextGoals() {
  const out = [];
  // Herói mais forte: quanto falta para o alcance subir.
  const best = [...economy.heroes].sort((a, b) => b.level - a.level)[0];
  if (best) {
    const lv = nextRangeLevel(best);
    if (lv) out.push(STR.goalRange(best.name, statsOf(best).range + 1, lv, lv - best.level));
  }
  // Chefe do mundo atual.
  if (economy.mode === 'campaign') {
    const left = BALANCE.stage.stagesPerWorld - economy.stage;
    if (left > 0) out.push(STR.goalBoss(left));
    else out.push(STR.goalBossNow);
  }
  // Próxima equipe ainda fechada.
  for (let t = 1; t < BALANCE.teams.count; t++) {
    if (!economy.teamUnlocked(t)) { out.push(STR.goalTeam(t, BALANCE.teams.unlockWorld[t] + 1)); break; }
  }
  // Abismo ainda fechado.
  if (!economy.endlessUnlocked()) out.push(STR.goalAbyss);
  return out;
}
