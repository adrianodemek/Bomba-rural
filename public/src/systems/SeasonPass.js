// Passe de Temporada: 30 níveis por mês, com trilha Grátis e trilha Elite.
// O XP vem de jogar (missões diárias, presente diário, fases e chefes). Cada nível alcançado libera
// o prêmio Grátis e, para quem comprou o Elite do mês, também o prêmio Elite.
// Em modo de teste o Elite é liberado na hora; com o modo online, buyElite() passa a chamar o pagamento.
import { BALANCE } from '../config/balance.js';
import { economy, emptyPass } from './Economy.js';
import { todayKey } from './Goals.js';
import { goldUnit, summonLegend } from './Login.js';
import { addRandomGem, dropGemLevel } from './Gems.js';
import { currentItemLevel } from './Items.js';

const SP = () => BALANCE.seasonPass;

// XP para passar do nível n para o n+1 (n começa em 0).
export const xpForLevel = (n) => SP().xpBase + SP().xpStep * n;

// Nível atual (0 a 30), XP dentro do nível e XP que falta para o próximo.
export function passLevel() {
  let xp = economy.pass.xp;
  let lvl = 0;
  while (lvl < SP().levels && xp >= xpForLevel(lvl)) { xp -= xpForLevel(lvl); lvl++; }
  const need = lvl < SP().levels ? xpForLevel(lvl) : 0;
  return { level: lvl, into: lvl < SP().levels ? xp : 0, need, max: lvl >= SP().levels };
}

// Dias que faltam para a temporada acabar (vira no 1º dia do mês).
export function passDaysLeft() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - now) / 86400000));
}

export const passMonthName = () => new Date().toLocaleDateString('pt-BR', { month: 'long' });

// Virada do mês: entrega o que ficou para trás (já alcançado e não coletado) e começa a temporada nova.
// Devolve { level, rewards } para o popup, ou null.
export function ensurePass() {
  const cur = economy.seasonIndex();
  const p = economy.pass;
  if (p.key === cur) return null;
  let leftover = null;
  if (p.key) {
    const { level } = passLevel();
    const got = [];
    for (let i = 0; i < level; i++) {
      if (!p.free.includes(i)) got.push(grant(SP().free[i]));
      if (p.elite && !p.eliteClaimed.includes(i)) got.push(grant(SP().elite[i]));
    }
    if (got.length) leftover = { level, rewards: merge(got) };
  }
  economy.pass = emptyPass(cur);
  economy.pendingPassEnd = leftover;
  economy.emit('pass');
  return leftover;
}

// Soma XP. src = 'stage' / 'boss' respeitam o limite diário de fases.
export function addPassXp(n, src) {
  ensurePass();
  const p = economy.pass;
  if (src === 'stage' || src === 'boss') {
    const today = todayKey();
    if (p.day !== today) { p.day = today; p.dayXp = 0; }
    n = Math.max(0, Math.min(n, SP().xp.stageDailyCap - p.dayXp));
    p.dayXp += n;
  }
  if (n <= 0) return 0;
  const before = passLevel().level;
  p.xp += n;
  const after = passLevel().level;
  economy.emit('pass');
  if (after > before) economy.emit('pass-level', after);
  return n;
}

export const passXp = (key) => SP().xp[key];

// Situação de um prêmio: 'claimed' (já pego), 'ready' (pode pegar), 'locked' (nível não alcançado),
// 'elite' (nível alcançado, mas falta comprar o Elite).
export function cellState(track, i) {
  const p = economy.pass;
  const reached = i < passLevel().level;
  if (track === 'free') return p.free.includes(i) ? 'claimed' : reached ? 'ready' : 'locked';
  if (p.eliteClaimed.includes(i)) return 'claimed';
  if (!reached) return 'locked';
  return p.elite ? 'ready' : 'elite';
}

export function claimableCount() {
  let n = 0;
  for (let i = 0; i < SP().levels; i++) {
    if (cellState('free', i) === 'ready') n++;
    if (cellState('elite', i) === 'ready') n++;
  }
  return n;
}

// Coleta um prêmio. Devolve o resultado (para mostrar) ou null.
export function claimCell(track, i) {
  ensurePass();
  if (cellState(track, i) !== 'ready') return null;
  const p = economy.pass;
  (track === 'free' ? p.free : p.eliteClaimed).push(i);
  const r = grant((track === 'free' ? SP().free : SP().elite)[i]);
  economy.emit('pass');
  economy.emit('currency');
  return r;
}

// Coleta tudo que está liberado. Devolve um resultado somado ou null.
export function claimAll() {
  ensurePass();
  const got = [];
  for (let i = 0; i < SP().levels; i++) {
    for (const t of ['free', 'elite']) {
      const r = claimCell(t, i);
      if (r) got.push(r);
    }
  }
  return got.length ? merge(got) : null;
}

// Compra o Elite do mês (prêmios Elite dos níveis já alcançados ficam liberados na hora).
export function buyElite() {
  if (!SP().testMode) return false; // pagamento real ainda não ligado
  ensurePass();
  if (economy.pass.elite) return false;
  economy.pass.elite = true;
  economy.passBought = (economy.passBought || 0) + 1;
  economy.emit('pass');
  return true;
}

// Valor final de um prêmio (o ouro acompanha a fase atual).
export function rewardValue(r) {
  return { ...r, gold: r.gold ? r.gold * goldUnit() : 0 };
}

// Entrega um prêmio e devolve o que foi dado.
function grant(def) {
  const r = rewardValue(def);
  const out = { gold: 0, crystals: 0, keys: 0, essence: 0, cages: 0, chests: 0, sealed: 0, gemKeys: [], heroes: [], legendStored: 0 };
  if (r.gold) { economy.addGold(r.gold); out.gold = r.gold; }
  if (r.crystals) { economy.addCrystals(r.crystals); out.crystals = r.crystals; }
  if (r.keys) { economy.addKeys(r.keys); out.keys = r.keys; }
  if (r.essence) { economy.addEssence(r.essence); out.essence = r.essence; }
  if (r.cages) { economy.addCages(r.cages); out.cages = r.cages; }
  if (r.chests) { economy.addRewardChests(r.chests); out.chests = r.chests; }
  if (r.sealed) { economy.addSealed(r.sealed, currentItemLevel(), economy.world); out.sealed = r.sealed; }
  for (let k = 0; k < (r.gems || 0); k++) out.gemKeys.push(addRandomGem(dropGemLevel()));
  for (let k = 0; k < (r.legend || 0); k++) {
    const h = summonLegend();
    if (h) out.heroes.push(h);
    else { economy.legendCages += 1; out.legendStored++; }
  }
  return out;
}

function merge(list) {
  const out = { gold: 0, crystals: 0, keys: 0, essence: 0, cages: 0, chests: 0, sealed: 0, gemKeys: [], heroes: [], legendStored: 0 };
  for (const r of list) {
    for (const k of ['gold', 'crystals', 'keys', 'essence', 'cages', 'chests', 'sealed', 'legendStored']) out[k] += r[k];
    out.gemKeys.push(...r.gemKeys);
    out.heroes.push(...r.heroes);
  }
  return out;
}
