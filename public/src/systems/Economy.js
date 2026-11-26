// Estado da conta: moedas, upgrades, elenco de heróis, equipes e Casa.
// Emite eventos quando muda: 'gold', 'currency', 'upgrade', 'roster', 'teams', 'house'.
import { BALANCE } from '../config/balance.js';
import { stageGoldScale } from './Grid.js';
import { STARTER_HEROES, ROLE_IDS } from '../data/heroes.js';
import { computeStats, emptyAlloc } from './HeroStats.js';
import { treeEffectSum } from '../data/skilltree.js';
import { MISSIONS, ACHIEVEMENTS } from '../data/goals.js';
import { parseGem } from '../data/gems.js';
import { WORLDS, DIFFICULTIES, COLOSSI } from '../data/worlds.js';
import { SLOT_IDS, SET_IDS, GEAR_KEYS, gearSlotByKey } from '../data/items.js';
import { ABILITY_IDS, ABILITIES, abilitiesForRole, STARTER_ABILITIES } from '../data/abilities.js';

// Duas habilidades diferentes do papel (sorteadas).
export function rollAbilities(role) {
  const pool = abilitiesForRole(role);
  const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const b = pool[Math.floor(Math.random() * pool.length)];
  return [{ id: a, lvl: 1 }, { id: b, lvl: 1 }];
}

function sanitizeAbilities(h) {
  const list = (Array.isArray(h.abilities) ? h.abilities : [])
    .filter((a) => a && ABILITY_IDS.includes(a.id) && ABILITIES[a.id].role === h.role)
    .map((a) => ({ id: a.id, lvl: Phaser.Math.Clamp(Math.floor(a.lvl) || 1, 1, BALANCE.attributes.abilityMax) }));
  return list.length === 2 ? list : rollAbilities(h.role);
}

function emptyStats() {
  return {
    objects: 0, chestObjects: 0, crits: 0, levelUps: 0, forgeAttempts: 0, forgeSuccess: 0, maxPlus: 0,
    sealedRevealed: 0, summons: 0, chestsOpened: 0, endlessDepths: 0, endlessBest: 0,
    expeditions: 0, colossusRuns: 0, colossusBestEver: 0, colossusWeek: 0, colossusWeekBest: 0,
    seasonKey: 0, seasonBest: 0,
    playSec: 0,                      // tempo de jogo com a tela aberta (ranking "Tempo online")
  };
}

function emptyProgress() {
  return DIFFICULTIES.map(() => WORLDS.map(() => 0));
}

export class Economy extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.reset(false);
  }

  reset(emit = true) {
    this.gold = 0;
    this.totalGold = 0;
    this.crystals = 0;
    this.cages = BALANCE.gacha.startingCages;
    this.powerLevel = 0;
    this.world = 0;
    this.stage = 1;
    this.difficulty = 0;
    this.activeTeam = 0;
    this.capsulesUnlocked = BALANCE.house.startUnlocked;
    this.recoveryLevel = 0;
    this.nextUid = 1;
    this.heroes = [];
    this.capsules = new Array(BALANCE.house.capsules).fill(null); // uid do herói em cada cápsula (não é salvo)
    this.progress = emptyProgress();  // [dificuldade][mundo] = maior fase concluída
    this.keys = 0;
    this.rewardChests = 0;
    this.minerals = new Array(WORLDS.length).fill(0);
    this.goldRate = 0;                 // ouro por segundo (média), usado no ganho offline
    this.stagesCleared = 0;
    this.autoAdvance = true;
    this.pendingOffline = null;        // resultado do ganho offline para o popup (não é salvo)
    this.items = [];                   // inventário de equipamentos
    this.sealed = [];                  // drops lacrados: [{ ilvl, world }]
    this.nextItemUid = 1;
    this.stats = emptyStats();         // contadores para missões, conquistas e recordes
    this.daily = { day: '', missions: [], bonusClaimed: false };
    this.achClaimed = {};              // conquista → nível já coletado
    this.muted = false;
    this.tutorialSeen = false;
    this.mode = 'campaign';            // 'campaign' | 'endless' (não é salvo)
    this.endlessDepth = 0;
    this.gems = {};                    // pilhas de gemas: "ruby:3" → quantidade
    this.album = { h: new Set(), i: new Set(), g: new Set() }; // coleção descoberta
    this.expeditions = [];             // [{ uid, endsAt, hours, reward }]
    this.pendingSeason = null;         // prêmio de temporada para o popup (não é salvo)
    this.stars = {};                   // estrelas por fase: "d-w-s" → 1 a 3
    this.starClaims = {};              // marcos de estrelas já pagos: "d-w" → quantos
    this.essence = 0;                  // essência de despertar
    this.rosterUpgrades = 0;           // compras de vagas de herói
    this.starSlots = 0;                // vagas do Comando do Esquadrão já liberadas
    this.treeRanks = { start: 1 };     // árvore de habilidades: nó → rank (o início é grátis)
    this.journeyStep = 0;              // Jornada do Mineiro: tarefa atual (passa do fim = concluída)
    this.unlockSeen = [];              // abas liberadas que já tiveram comemoração
    this.teamsGranted = [];            // equipes liberadas por save antigo (já tinham heróis)
    this.teamsSeen = [];               // equipes novas que já tiveram comemoração
    this.premium = { until: 0, lastDaily: '', bought: 0 }; // Passe do Minerador
    this.clanDraft = null;     // rascunho do clã (nome, emblema 8×8, regras) — prévia até o modo online
    this.pity = 0;                     // invocações seguidas sem Lendário/Mítico
    this.login = { claimed: 0, last: '', cycles: 0 }; // presente diário
    this.legendCages = 0;              // Gaiolas Lendárias guardadas (equipe cheia)
    this.pass = emptyPass();           // Passe de Temporada do mês
    this.passBought = 0;               // quantos Elites já comprou
    this.pendingPassEnd = null;        // prêmios entregues na virada do mês, para o popup (não é salvo)
    this.addStarterHeroes();
    if (emit) this.emitAll();
  }

  emitAll() {
    this.emit('gold', this.gold, 0);
    this.emit('currency');
    this.emit('upgrade', 'power', this.powerLevel);
    this.emit('roster');
    this.emit('teams');
    this.emit('house');
    this.emit('map');
  }

  addStarterHeroes() {
    STARTER_HEROES.forEach((s) => {
      const h = this.addHero({ name: s.name, palette: s.palette, role: s.role, rarity: 0, rank: 2, team: 0 });
      h.abilities = STARTER_ABILITIES[s.role].map((id) => ({ id, lvl: 1 }));
      h.tradable = false; // o time inicial não vai para o mercado
    });
  }

  // Cria e adiciona um herói ao elenco. Devolve o herói.
  addHero({ name, palette, role, rarity, rank = 2, team = null }) {
    const hero = {
      uid: this.nextUid++, name, palette, role, rarity, rank,
      level: 1, stars: 0, energy: 0, team, alloc: emptyAlloc(), gear: {},
      awaken: 0, abilities: rollAbilities(role), gems: [null, null, null], locked: false, tradable: true,
    };
    hero.energy = computeStats(hero).maxEnergy; // chega com energia cheia
    this.heroes.push(hero);
    this.registerAlbum('h', `${role}:${rarity}`);
    return hero;
  }

  // ---------- Equipamento ----------
  addItem(item) {
    item.uid = this.nextItemUid++;
    this.items.push(item);
    this.registerAlbum('i', `${item.slot}:${item.rarity}`);
    return item;
  }

  itemByUid(uid) {
    return this.items.find((it) => it.uid === uid) || null;
  }

  // Herói que está usando o item (ou null).
  equippedBy(itemUid) {
    return this.heroes.find((h) => Object.values(h.gear || {}).includes(itemUid)) || null;
  }

  gearOf(hero) {
    return Object.values(hero.gear || {}).map((u) => this.itemByUid(u)).filter(Boolean);
  }

  // Equipa no espaço "key" (padrão: o tipo do item), tirando de quem estiver usando.
  equip(hero, item, key = item.slot) {
    if (gearSlotByKey(key)?.type !== item.slot) return;
    const before = computeStats(hero, 0, this.gearOf(hero)).maxEnergy;
    const owner = this.equippedBy(item.uid);
    if (owner) {
      for (const [slot, u] of Object.entries(owner.gear)) if (u === item.uid) delete owner.gear[slot];
      owner.energy = Math.min(owner.energy, computeStats(owner, 0, this.gearOf(owner)).maxEnergy);
    }
    hero.gear[key] = item.uid;
    hero.energy += Math.max(0, computeStats(hero, 0, this.gearOf(hero)).maxEnergy - before);
    this.emit('roster');
    this.emit('items');
  }

  unequip(hero, slot) {
    if (!hero.gear[slot]) return;
    delete hero.gear[slot];
    hero.energy = Math.min(hero.energy, computeStats(hero, 0, this.gearOf(hero)).maxEnergy);
    this.emit('roster');
    this.emit('items');
  }

  // Tira o herói do elenco: devolve gemas, solta itens e libera a cápsula.
  removeHero(uid) {
    const h = this.heroByUid(uid);
    if (!h) return;
    for (const key of h.gems || []) if (key) this.gems[key] = (this.gems[key] || 0) + 1;
    h.gems = [null, null, null];
    h.gear = {};
    this.heroes = this.heroes.filter((x) => x.uid !== uid);
    this.capsules = this.capsules.map((u) => (u === uid ? null : u));
  }

  removeItem(uid) {
    const owner = this.equippedBy(uid);
    if (owner) {
      for (const [slot, u] of Object.entries(owner.gear)) if (u === uid) delete owner.gear[slot];
      owner.energy = Math.min(owner.energy, computeStats(owner, 0, this.gearOf(owner)).maxEnergy);
    }
    this.items = this.items.filter((it) => it.uid !== uid);
  }

  // ---------- Equipes liberadas aos poucos ----------
  // A Equipe A existe desde o início; B e C abrem ao vencer o Chefe de um mundo no Fácil.
  teamUnlocked(t) {
    if (t === 0 || t === null || t === undefined) return true;
    if (this.teamsGranted.includes(t)) return true;
    const w = BALANCE.teams.unlockWorld[t];
    return w !== undefined && w !== null && this.progress[0][w] >= this.spw;
  }

  get teamsOpen() {
    let n = 0;
    for (let t = 0; t < BALANCE.teams.count; t++) if (this.teamUnlocked(t)) n++;
    return n;
  }

  // Equipes que abriram e ainda não foram comemoradas.
  freshTeams() {
    const out = [];
    for (let t = 1; t < BALANCE.teams.count; t++) if (this.teamUnlocked(t) && !this.teamsSeen.includes(t)) out.push(t);
    return out;
  }

  // Vagas por equipe: base + vagas do Comando do Esquadrão (liberadas por estrelas em Metas; máx. 9).
  get teamSlots() {
    return Math.min(9, BALANCE.teams.startSlots + this.starSlots);
  }

  // Próxima vaga do Comando: quantas estrelas pede e se já pode liberar. null = todas liberadas.
  starSlotNext() {
    const list = BALANCE.teams.starSlots;
    if (this.starSlots >= list.length) return null;
    const target = list[this.starSlots];
    const have = this.totalStars();
    return { target, have, ready: have >= target, index: this.starSlots };
  }

  claimStarSlot() {
    const n = this.starSlotNext();
    if (!n || !n.ready) return false;
    this.starSlots += 1;
    this.emit('teams');
    return true;
  }

  // ---------- Elenco ----------
  get heroSlots() {
    const R = BALANCE.roster;
    return R.startSlots + this.rosterUpgrades * R.slotsPerUpgrade + this.treeSum('heroSlots');
  }

  rosterFull() {
    return this.heroes.length >= this.heroSlots;
  }

  rosterUpgradeCost() {
    const R = BALANCE.roster;
    const n = this.rosterUpgrades;
    return Math.round(Math.max(R.upgradeCost * Math.pow(R.upgradeGrowth, n), this.bestStageGold() * (R.stageCost || 0) * Math.pow(R.stageGrowth || 1, n)));
  }

  buyRosterSlots() {
    if (!this.spendGold(this.rosterUpgradeCost())) return false;
    this.rosterUpgrades += 1;
    this.emit('roster');
    this.emit('house');
    return true;
  }

  addEssence(n) { this.essence += n; this.emit('currency'); }

  // Soma dos ranks de nós da árvore com um tipo de efeito (definido em SkillTree).
  treeSum(type) {
    return treeEffectSum(this.treeRanks, type);
  }

  addSealed(n, ilvl, world) {
    const diff = this.mode === 'endless' ? 0 : Math.min(this.difficulty, Math.floor((ilvl - 1) / BALANCE.items.levelPerDifficulty));
    for (let i = 0; i < n; i++) this.sealed.push({ ilvl, world, diff });
    this.emit('items');
  }

  heroByUid(uid) {
    return this.heroes.find((h) => h.uid === uid) || null;
  }

  teamMembers(team) {
    return this.heroes.filter((h) => h.team === team);
  }

  // ---------- Moedas ----------
  addGold(amount) {
    this.gold += amount;
    this.totalGold += amount;
    this.emit('gold', this.gold, amount);
  }

  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.emit('gold', this.gold, -amount);
    return true;
  }

  addCrystals(n) {
    this.crystals += n;
    this.emit('currency');
  }

  addCages(n) {
    this.cages += n;
    this.emit('currency');
  }

  // ---------- Contadores e recordes ----------
  bump(name, n = 1) { this.stats[name] = (this.stats[name] || 0) + n; }

  getStat(name) {
    switch (name) {
      case 'stagesCleared': return this.stagesCleared;
      case 'totalGold': return this.totalGold;
      case 'worldsDone': return this.progress.flat().filter((v) => v >= this.spw).length;
      case 'maxHeroLevel': return this.heroes.reduce((m, h) => Math.max(m, h.level), 0);
      case 'legendaries': return this.heroes.filter((h) => h.rarity >= 3).length;
      case 'albumCount': return this.albumCount();
      case 'treeRanks': return Object.values(this.treeRanks).reduce((s, v) => s + v, 0) - 1;
      default: return this.stats[name] || 0;
    }
  }

  // ---------- Abismo Sem Fim ----------
  endlessUnlocked() {
    return this.progress[0][BALANCE.endless.unlockWorld] >= this.spw;
  }

  // Mundo que a arena mostra (no Abismo, o visual troca a cada 5 profundidades).
  get arenaWorld() {
    if (this.mode === 'colossus') return COLOSSI[this.colossusVariant()].world;
    if (this.mode !== 'endless') return this.world;
    return Math.floor((this.endlessDepth - 1) / 5) % WORLDS.length;
  }

  // Cenário desenhado da arena (chave de HD_SCENES): o Abismo tem o seu próprio (Poço de Cristais).
  get arenaScene() {
    if (this.mode === 'endless') return 'abyss';
    return `${this.arenaWorld}_${this.arenaZone}`;
  }

  // Zona (0 a 2) que a arena mostra. Campanha: pela fase. Abismo: troca a cada volta nos mundos.
  get arenaZone() {
    if (this.mode === 'colossus') return 2;
    if (this.mode === 'endless') return Math.floor((this.endlessDepth - 1) / (5 * WORLDS.length)) % BALANCE.stage.zonesPerWorld;
    return zoneOfStage(this.stage);
  }

  // ---------- Mapa e progressão ----------
  get spw() { return BALANCE.stage.stagesPerWorld; }

  // Índice global da fase (mundo 2, fase 3 = 43). Usado no HP e nas recompensas.
  globalIndex(world = this.world, stage = this.stage) {
    return world * this.spw + stage;
  }

  worldAvailable(d, w) {
    if (d < 0 || w < 0 || d >= DIFFICULTIES.length || w >= WORLDS.length) return false;
    const prevDiffOk = d === 0 || this.progress[d - 1][w] >= this.spw;
    const prevWorldOk = w === 0 || this.progress[d][w - 1] >= this.spw;
    return prevDiffOk && prevWorldOk;
  }

  difficultyAvailable(d) {
    return this.worldAvailable(d, 0);
  }

  stageAvailable(d, w, s) {
    return this.worldAvailable(d, w) && s >= 1 && s <= Math.min(this.spw, this.progress[d][w] + 1);
  }

  // Registra a fase atual como concluída. Diz se foi a primeira vez e o que liberou.
  recordClear() {
    const { world: w, difficulty: d, stage: s } = this;
    const first = s > this.progress[d][w];
    if (first) this.progress[d][w] = s;
    this.stagesCleared += 1;
    const worldDone = first && s === this.spw;
    return {
      first,
      worldDone,
      unlockedWorld: worldDone && w + 1 < WORLDS.length && this.worldAvailable(d, w + 1) ? w + 1 : null,
      unlockedDifficulty: worldDone && d + 1 < DIFFICULTIES.length && this.worldAvailable(d + 1, w) ? d + 1 : null,
    };
  }

  // Próxima fase com "avançar automaticamente". Devolve true se mudou de mundo.
  advance() {
    if (!this.autoAdvance) return false;
    const { world: w, difficulty: d, stage: s } = this;
    if (s < this.spw && this.stageAvailable(d, w, s + 1)) { this.stage = s + 1; return false; }
    if (s >= this.spw && this.worldAvailable(d, w + 1)) { this.world = w + 1; this.stage = 1; return true; }
    return false;
  }

  goTo(d, w, s) {
    if (!this.stageAvailable(d, w, s)) return false;
    this.mode = 'campaign';
    this.difficulty = d;
    this.world = w;
    this.stage = s;
    this.emit('map');
    return true;
  }

  // ---------- Álbum ----------
  registerAlbum(cat, key) {
    if (!this.album || this.album[cat].has(key)) return;
    this.album[cat].add(key);
    this.emit('album');
  }

  albumCount() {
    return this.album.h.size + this.album.i.size + this.album.g.size;
  }

  albumAttackPct() { return this.albumCount() * BALANCE.album.attackPerEntry; }
  albumGoldPct() { return this.albumCount() * BALANCE.album.goldPerEntry; }

  // Garante que tudo que você já tem está no álbum.
  backfillAlbum() {
    this.heroes.forEach((h) => this.album.h.add(`${h.role}:${h.rarity}`));
    this.items.forEach((it) => this.album.i.add(`${it.slot}:${it.rarity}`));
    const gemKeys = [...Object.keys(this.gems), ...this.heroes.flatMap((h) => h.gems || [])];
    gemKeys.forEach((k) => { const g = k && parseGem(k); if (g) this.album.g.add(g.type); });
  }

  // ---------- Expedições ----------
  onExpedition(uid) {
    return this.expeditions.some((e) => e.uid === uid);
  }

  // ---------- Colosso e temporadas ----------
  // Semana local que começa na segunda-feira.
  weekIndex() {
    const days = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    return Math.floor((days + 3) / 7);
  }

  colossusVariant() {
    return this.weekIndex() % COLOSSI.length;
  }

  // Zera o melhor dano quando a semana muda.
  ensureColossusWeek() {
    const w = this.weekIndex();
    if (this.stats.colossusWeek !== w) {
      this.stats.colossusWeek = w;
      this.stats.colossusWeekBest = 0;
    }
  }

  seasonIndex() {
    const d = new Date();
    return d.getFullYear() * 12 + d.getMonth();
  }

  // Na virada do mês, paga o prêmio pelo melhor da temporada anterior e zera.
  ensureSeason() {
    const cur = this.seasonIndex();
    if (this.stats.seasonKey === cur) return null;
    const best = this.stats.seasonKey ? this.stats.seasonBest : 0;
    this.stats.seasonKey = cur;
    this.stats.seasonBest = 0;
    if (best <= 0) return null;
    const S = BALANCE.season;
    const reward = {
      best,
      crystals: best * S.crystalsPerDepth,
      essence: best * S.essencePerDepth,
      cages: Math.floor(best / S.cageEveryDepth),
    };
    this.addCrystals(reward.crystals);
    this.addEssence(reward.essence);
    if (reward.cages) this.addCages(reward.cages);
    this.pendingSeason = reward;
    return reward;
  }

  // ---------- Estrelas ----------
  starsOf(d, w, s) { return this.stars[`${d}-${w}-${s}`] || 0; }

  worldStars(d, w) {
    let n = 0;
    for (let s = 1; s <= this.spw; s++) n += this.starsOf(d, w, s);
    return n;
  }

  totalStars() {
    return Object.values(this.stars).reduce((a, b) => a + b, 0);
  }

  // Grava as estrelas da fase atual. Devolve quantas novas e quantos marcos foram alcançados agora.
  recordStars(n) {
    const { difficulty: d, world: w, stage: s } = this;
    const key = `${d}-${w}-${s}`;
    const gained = Math.max(0, n - (this.stars[key] || 0));
    if (gained) this.stars[key] = n;
    const total = this.worldStars(d, w);
    const ms = BALANCE.stage.starMilestones;
    const reached = ms.filter((m) => total >= m).length;
    const claimed = this.starClaims[`${d}-${w}`] || 0;
    const newMilestones = Math.max(0, reached - claimed);
    if (newMilestones) this.starClaims[`${d}-${w}`] = reached;
    return { gained, total, newMilestones };
  }

  addKeys(n) { this.keys += n; this.emit('currency'); }
  addRewardChests(n) { this.rewardChests += n; this.emit('currency'); }
  addMineral(w, n) { this.minerals[w] += n; this.emit('currency'); }

  // ---------- Pólvora reforçada (Poder da conta) ----------
  powerCost() {
    const u = BALANCE.upgrades.power;
    return Math.round(u.baseCost * Math.pow(u.growth, this.powerLevel));
  }

  buyPower() {
    if (!this.spendGold(this.powerCost())) return false;
    this.powerLevel += 1;
    this.emit('upgrade', 'power', this.powerLevel);
    return true;
  }

  // ---------- Casa ----------
  capsuleCost() {
    const H = BALANCE.house;
    if (this.capsulesUnlocked >= H.capsules) return null;
    return Math.round(H.capsuleBaseCost * Math.pow(H.capsuleCostGrowth, this.capsulesUnlocked - H.startUnlocked));
  }

  buyCapsule() {
    const cost = this.capsuleCost();
    if (cost === null || !this.spendGold(cost)) return false;
    this.capsulesUnlocked += 1;
    this.emit('house');
    return true;
  }

  // Ouro de uma fase no ponto mais avançado da conta: régua de preço da Casa (voltar ao Fácil não barateia).
  bestStageGold() {
    for (let d = DIFFICULTIES.length - 1; d >= 0; d--) {
      const p = this.progress[d];
      for (let w = p.length - 1; w >= 0; w--) {
        if (p[w] > 0) return BALANCE.altar.stageGold * stageGoldScale(w * this.spw + p[w], d);
      }
    }
    return BALANCE.altar.stageGold;
  }

  // Preço = o maior entre o valor fixo (começo do jogo) e N fases de ouro do ponto mais avançado.
  recoveryCost() {
    const u = BALANCE.house.recoveryUpgrade;
    if (this.recoveryLevel >= (u.maxLevel ?? Infinity)) return null;   // no máximo
    const n = this.recoveryLevel;
    return Math.round(Math.max(u.baseCost * Math.pow(u.growth, n), this.bestStageGold() * (u.stageCost || 0) * Math.pow(u.stageGrowth || 1, n)));
  }

  recoveryMult() {
    return 1 + this.recoveryLevel * BALANCE.house.recoveryUpgrade.bonus;
  }

  buyRecovery() {
    const cost = this.recoveryCost();
    if (cost === null || !this.spendGold(cost)) return false;
    this.recoveryLevel += 1;
    this.emit('house');
    return true;
  }

  // ---------- Save ----------
  toJSON() {
    return {
      gold: this.gold,
      totalGold: this.totalGold,
      crystals: this.crystals,
      cages: this.cages,
      powerLevel: this.powerLevel,
      world: this.world,
      stage: this.stage,
      difficulty: this.difficulty,
      activeTeam: this.activeTeam,
      capsulesUnlocked: this.capsulesUnlocked,
      recoveryLevel: this.recoveryLevel,
      nextUid: this.nextUid,
      heroes: this.heroes.map((h) => ({ ...h, alloc: { ...h.alloc }, gear: { ...h.gear }, gems: [...h.gems] })),
      items: this.items.map((it) => ({ ...it, affixes: it.affixes.map((a) => ({ ...a })) })),
      gems: { ...this.gems },
      stars: { ...this.stars },
      starClaims: { ...this.starClaims },
      sealed: this.sealed.map((s) => ({ ...s })),
      nextItemUid: this.nextItemUid,
      stats: { ...this.stats },
      daily: { ...this.daily, missions: this.daily.missions.map((m) => ({ ...m })) },
      album: { h: [...this.album.h], i: [...this.album.i], g: [...this.album.g] },
      expeditions: this.expeditions.map((e) => ({ ...e, reward: { ...e.reward } })),
      achClaimed: { ...this.achClaimed },
      muted: this.muted,
      tutorialSeen: this.tutorialSeen,
      essence: this.essence,
      rosterUpgrades: this.rosterUpgrades,
      treeRanks: { ...this.treeRanks },
      starSlots: this.starSlots,
      progress: this.progress.map((r) => [...r]),
      keys: this.keys,
      rewardChests: this.rewardChests,
      minerals: [...this.minerals],
      goldRate: this.goldRate,
      stagesCleared: this.stagesCleared,
      autoAdvance: this.autoAdvance,
      journeyStep: this.journeyStep,
      unlockSeen: [...this.unlockSeen],
      teamsGranted: [...this.teamsGranted],
      teamsSeen: [...this.teamsSeen],
      premium: { ...this.premium },
      clanDraft: this.clanDraft ? { ...this.clanDraft } : null,
      pity: this.pity,
      login: { ...this.login },
      legendCages: this.legendCages,
      pass: { ...this.pass, free: [...this.pass.free], eliteClaimed: [...this.pass.eliteClaimed] },
      passBought: this.passBought,
    };
  }

  fromJSON(d) {
    const num = (v, def) => (Number.isFinite(v) && v >= 0 ? v : def);
    const int = (v, def) => Math.floor(num(v, def));
    this.gold = num(d.gold, 0);
    this.totalGold = num(d.totalGold, this.gold);
    this.crystals = int(d.crystals, 0);
    this.cages = int(d.cages, BALANCE.gacha.startingCages);
    this.powerLevel = int(d.powerLevel, 0);
    this.world = int(d.world, 0);
    this.stage = Math.max(1, int(d.stage, 1));
    this.difficulty = int(d.difficulty, 0);
    this.activeTeam = int(d.activeTeam, 0) % BALANCE.teams.count;
    this.capsulesUnlocked = Phaser.Math.Clamp(int(d.capsulesUnlocked, BALANCE.house.startUnlocked), 1, BALANCE.house.capsules);
    this.recoveryLevel = Math.min(int(d.recoveryLevel, 0), BALANCE.house.recoveryUpgrade.maxLevel ?? Infinity);
    this.capsules = new Array(BALANCE.house.capsules).fill(null);
    this.progress = emptyProgress();
    if (Array.isArray(d.progress)) {
      for (let di = 0; di < DIFFICULTIES.length; di++) {
        for (let wi = 0; wi < WORLDS.length; wi++) {
          this.progress[di][wi] = Phaser.Math.Clamp(int(d.progress?.[di]?.[wi], 0), 0, this.spw);
        }
      }
    }
    this.keys = int(d.keys, 0);
    this.rewardChests = int(d.rewardChests, 0);
    this.minerals = WORLDS.map((_, i) => int(d.minerals?.[i], 0));
    this.goldRate = num(d.goldRate, 0);
    this.stagesCleared = int(d.stagesCleared, 0);
    this.autoAdvance = d.autoAdvance !== false;
    this.pendingOffline = null;
    // Saves antigos não guardavam a dificuldade do item: estima pela dificuldade salva e pelo nível do item.
    const oldDiff = (ilvl) => Math.max(0, Math.min(int(d.difficulty, 0), Math.floor((int(ilvl, 1) - 1) / BALANCE.items.levelPerDifficulty)));
    this.items = (Array.isArray(d.items) ? d.items : [])
      .filter((it) => it && Number.isFinite(it.uid) && SLOT_IDS.includes(it.slot))
      .map((it) => ({
        uid: it.uid,
        slot: it.slot,
        rarity: Phaser.Math.Clamp(int(it.rarity, 0), 0, 4),
        ilvl: Phaser.Math.Clamp(int(it.ilvl, 1), 1, 300),
        world: Phaser.Math.Clamp(int(it.world, 0), 0, WORLDS.length - 1),
        diff: Phaser.Math.Clamp(int(it.diff, oldDiff(it.ilvl)), 0, BALANCE.difficulties.length - 1),
        plus: Phaser.Math.Clamp(int(it.plus, 0), 0, BALANCE.forge.maxPlus),
        stars: Phaser.Math.Clamp(int(it.stars, 0), 0, BALANCE.stars.max),
        affixes: (Array.isArray(it.affixes) ? it.affixes : [])
          .filter((a) => a && BALANCE.attributes.ids.includes(a.attr))
          .map((a) => ({ attr: a.attr, roll: Phaser.Math.Clamp(num(a.roll, 0.85), 0.7, 1) })),
        set: SET_IDS.includes(it.set) ? it.set : null,
        locked: !!it.locked,
        tradable: it.tradable !== false,
      }));
    const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
    this.album = { h: new Set(arr(d.album?.h)), i: new Set(arr(d.album?.i)), g: new Set(arr(d.album?.g)) };
    this.expeditions = (Array.isArray(d.expeditions) ? d.expeditions : [])
      .filter((e) => e && Number.isFinite(e.uid) && Number.isFinite(e.endsAt) && e.reward)
      .slice(0, BALANCE.expeditions.slots + BALANCE.premium.expeditionSlots)
      .map((e) => ({
        uid: e.uid, endsAt: e.endsAt, hours: num(e.hours, 1),
        reward: {
          gold: num(e.reward.gold, 0), crystals: int(e.reward.crystals, 0), essence: int(e.reward.essence, 0),
          gems: int(e.reward.gems, 0), gemLevel: Math.max(1, int(e.reward.gemLevel, 1)), sealed: int(e.reward.sealed, 0),
          ilvl: Math.max(1, int(e.reward.ilvl, 1)),
        },
      }));
    this.pendingSeason = null;
    this.stars = {};
    for (const [k, v] of Object.entries(d.stars || {})) if (/^\d-\d-\d+$/.test(k) && v >= 1) this.stars[k] = Math.min(3, Math.floor(v));
    this.starClaims = {};
    for (const [k, v] of Object.entries(d.starClaims || {})) if (/^\d-\d$/.test(k) && v >= 1) this.starClaims[k] = Math.min(3, Math.floor(v));
    this.gems = {};
    for (const [k, v] of Object.entries(d.gems || {})) {
      if (parseGem(k) && Number.isFinite(v) && v > 0) this.gems[k] = Math.floor(v);
    }
    this.sealed = (Array.isArray(d.sealed) ? d.sealed : []).map((s) => ({
      ilvl: Phaser.Math.Clamp(int(s?.ilvl, 1), 1, 300), world: Phaser.Math.Clamp(int(s?.world, 0), 0, WORLDS.length - 1),
      diff: Phaser.Math.Clamp(int(s?.diff, oldDiff(s?.ilvl)), 0, BALANCE.difficulties.length - 1),
    }));
    this.nextItemUid = Math.max(int(d.nextItemUid, 1), this.items.reduce((m, it) => Math.max(m, it.uid), 0) + 1);
    this.stats = emptyStats();
    for (const k of Object.keys(this.stats)) this.stats[k] = num(d.stats?.[k], 0);
    const dm = Array.isArray(d.daily?.missions) ? d.daily.missions : [];
    this.daily = {
      day: String(d.daily?.day || ''),
      missions: dm.filter((m) => m && MISSIONS.some((x) => x.id === m.id))
        .map((m) => ({ id: m.id, base: num(m.base, 0), claimed: !!m.claimed })),
      bonusClaimed: !!d.daily?.bonusClaimed,
      colossusTries: int(d.daily?.colossusTries, 0),
      abyssEssence: int(d.daily?.abyssEssence, 0),
    };
    this.achClaimed = {};
    for (const a of ACHIEVEMENTS) this.achClaimed[a.id] = Phaser.Math.Clamp(int(d.achClaimed?.[a.id], 0), 0, a.tiers.length);
    this.muted = !!d.muted;
    this.tutorialSeen = !!d.tutorialSeen;
    this.mode = 'campaign';
    this.endlessDepth = 0;
    this.essence = int(d.essence, 0);
    this.rosterUpgrades = int(d.rosterUpgrades, 0);
    this.treeRanks = { start: 1 };
    if (d.treeRanks && typeof d.treeRanks === 'object') {
      for (const [k, v] of Object.entries(d.treeRanks)) if (Number.isFinite(v) && v > 0) this.treeRanks[k] = Math.floor(v);
    }
    // Saves antigos: as vagas compradas na árvore (nós s1, s4, s7, s9, s11, s13) viram vagas do Comando já liberadas.
    const legacy = d.starSlots === undefined ? ['s1', 's4', 's7', 's9', 's11', 's13'].filter((k) => this.treeRanks[k] > 0).length : 0;
    this.starSlots = Phaser.Math.Clamp(d.starSlots === undefined ? legacy : int(d.starSlots, 0), 0, BALANCE.teams.starSlots.length);
    this.world = Math.min(this.world, WORLDS.length - 1);
    this.difficulty = Math.min(this.difficulty, DIFFICULTIES.length - 1);
    this.stage = Math.min(this.stage, this.spw);
    // Garante que a posição salva é jogável.
    if (!this.stageAvailable(this.difficulty, this.world, this.stage)) {
      this.difficulty = 0; this.world = 0; this.stage = Math.min(this.spw, this.progress[0][0] + 1);
    }

    if (Array.isArray(d.heroes) && d.heroes.length) {
      this.heroes = d.heroes
        .filter((h) => h && Number.isFinite(h.uid))
        .map((h) => ({
          uid: h.uid,
          name: String(h.name || 'Bomber'),
          palette: int(h.palette, 0),
          role: ROLE_IDS.includes(h.role) ? h.role : 'attacker',
          rarity: Phaser.Math.Clamp(int(h.rarity, 0), 0, BALANCE.rarities.length - 1),
          rank: Phaser.Math.Clamp(int(h.rank, 2), 0, BALANCE.ranks.length - 1),
          alloc: Object.fromEntries(BALANCE.attributes.ids.map((id) => [id, int(h.alloc?.[id], 0)])),
          gear: Object.fromEntries(Object.entries(h.gear || {})
            .filter(([key, u]) => GEAR_KEYS.includes(key) && Number.isFinite(u))),
          level: Phaser.Math.Clamp(int(h.level, 1), 1, BALANCE.levels.max),
          awaken: Phaser.Math.Clamp(int(h.awaken, 0), 0, 4),
          abilities: sanitizeAbilities(h),
          gems: [0, 1, 2].map((i) => (h.gems?.[i] && parseGem(h.gems[i]) ? h.gems[i] : null)),
          locked: !!h.locked,
          tradable: h.tradable !== false,
          stars: Phaser.Math.Clamp(int(h.stars, 0), 0, BALANCE.stars.max),
          energy: num(h.energy, 0),
          team: Number.isInteger(h.team) && h.team >= 0 && h.team < BALANCE.teams.count ? h.team : null,
        }));
      const used = new Set();
      this.heroes.forEach((h) => {
        // Pontos distribuídos a mais (ex.: save editado) voltam a zero.
        const spent = Object.values(h.alloc).reduce((s, v) => s + v, 0);
        if (spent > (h.level - 1) * BALANCE.attributes.pointsPerLevel) h.alloc = emptyAlloc();
        // Remove itens que não existem mais ou que estão em dois heróis.
        for (const [slot, u] of Object.entries(h.gear)) {
          const it = this.itemByUid(u);
          if (!it || gearSlotByKey(slot)?.type !== it.slot || used.has(u)) delete h.gear[slot];
          else used.add(u);
        }
        h.energy = Math.min(h.energy, computeStats(h, 0, this.gearOf(h)).maxEnergy);
      });
      const maxUid = this.heroes.reduce((m, h) => Math.max(m, h.uid), 0);
      this.nextUid = Math.max(int(d.nextUid, 1), maxUid + 1);
    } else {
      this.heroes = [];
      this.nextUid = 1;
      this.addStarterHeroes();
    }
    // Expedições de heróis que não existem mais são descartadas; herói em expedição fica sem equipe.
    this.expeditions = this.expeditions.filter((e) => this.heroByUid(e.uid));
    this.expeditions.forEach((e) => { this.heroByUid(e.uid).team = null; });
    this.backfillAlbum();
    this.ensureColossusWeek();
    // Jornada, abas comemoradas e garantia de invocação. Save antigo de quem já jogou bastante
    // pula a Jornada e não repete as comemorações das abas que já usava.
    const veteran = this.stagesCleared >= 15;
    this.journeyStep = Number.isFinite(d.journeyStep) ? int(d.journeyStep, 0) : (veteran ? 999 : 0);
    const unlockedNow = Object.entries(BALANCE.unlocks).filter(([, need]) => this.progress[0][0] >= need).map(([id]) => id);
    this.unlockSeen = Array.isArray(d.unlockSeen) ? d.unlockSeen.filter((id) => id in BALANCE.unlocks) : unlockedNow;
    // Equipes: save antigo mantém as equipes que já tinham heróis (e não comemora de novo).
    const valid = (a) => (Array.isArray(a) ? a.filter((t) => Number.isInteger(t) && t > 0 && t < BALANCE.teams.count) : null);
    this.teamsGranted = valid(d.teamsGranted) ?? [...new Set(this.heroes.filter((h) => h.team > 0).map((h) => h.team))];
    this.teamsSeen = valid(d.teamsSeen) ?? [1, 2].filter((t) => this.teamUnlocked(t));
    // Herói numa equipe ainda fechada volta para o banco; a equipe ativa precisa estar aberta.
    this.heroes.forEach((h) => { if (h.team !== null && !this.teamUnlocked(h.team)) h.team = null; });
    if (!this.teamUnlocked(this.activeTeam)) this.activeTeam = 0;
    const cd = d.clanDraft;
    this.clanDraft = cd && typeof cd.emblem === 'string' && /^[0-9a-f]{64}$/.test(cd.emblem) ? {
      name: typeof cd.name === 'string' ? cd.name.slice(0, 18) : '', emblem: cd.emblem,
      rule: ['open', 'approval', 'invite'].includes(cd.rule) ? cd.rule : 'approval',
      minPower: num(cd.minPower, 0), lang: typeof cd.lang === 'string' ? cd.lang.slice(0, 2) : 'pt',
    } : null;
    const pm = d.premium || {};
    this.premium = { until: num(pm.until, 0), lastDaily: typeof pm.lastDaily === 'string' ? pm.lastDaily : '', bought: int(pm.bought, 0) };
    this.pity = int(d.pity, 0);
    const lg = d.login || {};
    this.login = { claimed: int(lg.claimed, 0) % BALANCE.login.days.length, last: typeof lg.last === 'string' ? lg.last : '', cycles: int(lg.cycles, 0) };
    this.legendCages = int(d.legendCages, 0);
    const ps = d.pass || {};
    const idx = (a) => (Array.isArray(a) ? [...new Set(a.filter((i) => Number.isInteger(i) && i >= 0 && i < BALANCE.seasonPass.levels))] : []);
    this.pass = {
      key: int(ps.key, 0), xp: int(ps.xp, 0), elite: !!ps.elite, free: idx(ps.free), eliteClaimed: idx(ps.eliteClaimed),
      day: typeof ps.day === 'string' ? ps.day : '', dayXp: int(ps.dayXp, 0),
    };
    this.passBought = int(d.passBought, 0);
  }
}

export function zoneOfStage(stage) {
  const per = BALANCE.stage.stagesPerWorld / BALANCE.stage.zonesPerWorld;
  return Math.min(BALANCE.stage.zonesPerWorld - 1, Math.floor((stage - 1) / per));
}

// Passe de Temporada vazio (key = mês da temporada).
export const emptyPass = (key = 0) => ({ key, xp: 0, elite: false, free: [], eliteClaimed: [], day: '', dayXp: 0 });

export const economy = new Economy();
