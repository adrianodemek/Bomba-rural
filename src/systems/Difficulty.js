// Poder recomendado por fase: quanto a equipe precisa ter para a fase andar bem.
// Usa a mesma conta de vida e dureza dos objetos (Grid.generate) e converte em "Poder".
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { statsOf } from './Roster.js';
import { stageHpGrowth } from './Grid.js';

// Quanto a fase é "pesada" comparada à primeira (vida × dureza).
export function stageWeight(world, stage, difficulty) {
  const S = BALANCE.stage;
  const H = S.hardness;
  const gi = world * S.stagesPerWorld + stage;
  const growth = stageHpGrowth(gi, difficulty);
  const armor = Math.min(H.max, gi * H.perStage + world * H.perWorld + difficulty * H.perDifficulty);
  return growth / (1 - armor);
}

// Poder recomendado: o Ataque necessário cresce com a fase; o resto do Poder cresce bem devagar.
export function recommendedPower(world = economy.world, stage = economy.stage, difficulty = economy.difficulty) {
  const P = BALANCE.power;
  const w = stageWeight(world, stage, difficulty);
  const boss = stage === BALANCE.stage.stagesPerWorld ? P.bossMult : 1;
  return Math.round(P.k * P.need * w * P.heroes * boss);
}

// Poder da equipe: soma dos heróis + o que a Engenheira dá aos aliados (aura de Ataque, Passo Ligeiro, Pavio Curto).
export function teamPower(team = economy.activeTeam) {
  const P = BALANCE.power;
  const list = economy.teamMembers(team).map((h) => ({ h, s: statsOf(h) }));
  let total = 0;
  for (const { h, s } of list) {
    // Melhor apoio vindo de outra Engenheira da equipe (a aura não vale para ela mesma).
    let aura = 0, haste = 0, fuse = 0;
    for (const o of list) {
      if (o.h === h) continue;
      aura = Math.max(aura, o.s.auraPct || 0);
      haste = Math.max(haste, o.s.abil?.haste || 0);
      fuse = Math.max(fuse, o.s.abil?.quickFuse || 0);
    }
    const boost = 1 + P.auraCover * (aura + 0.3 * haste + 0.5 * fuse);
    total += s.power * boost;
  }
  return Math.round(total);
}

// 'good' (verde), 'close' (amarelo) ou 'hard' (vermelho).
export function powerVerdict(team = economy.activeTeam) {
  const have = teamPower(team);
  const need = recommendedPower();
  if (have >= need) return 'good';
  if (have >= need * BALANCE.power.warn) return 'close';
  return 'hard';
}
