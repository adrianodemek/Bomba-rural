// TODOS os números de balanceamento ficam aqui. Ajuste à vontade.
export const BALANCE = {
  // 720×1600 ≈ formato dos celulares de hoje (9:20). Em telas mais largas sobram faixas nas laterais.
  screen: { width: 720, height: 1600 },

  // Faixas verticais da tela (em pixels da resolução base).
  layout: {
    safeTop: 36,        // respiro no topo (câmera / entalhe do celular)
    topBarH: 108,
    stageBarY: 108, stageBarH: 68,
    arenaY: 176, arenaH: 800,
    dockY: 976, dockH: 436,   // painel da equipe: meta, equipes, Poder, cartões e ações rápidas
    objH: 46,           // barra da Jornada / próximo objetivo, no topo do painel da equipe
    tabsY: 1412, tabsH: 188,
    modalDY: 160,       // janelas (desenhadas para 1280 de altura) descem isso para ficar no meio da tela
    hud: { gold: [36, 72], crystal: [276, 72], cage: [430, 72] }, // ícones da barra do topo (ouro · cristais · gaiolas · coroa · troféu · ajustes)
  },

  // pillars: false = mapa livre, sem blocos fixos (os heróis só desviam dos objetos).
  grid: { cols: 13, rows: 15, tile: 48, spriteScale: 3, pillars: false, offsetY: 57 }, // offsetY: distância do topo da área da arena até a 1ª linha (casa com o cenário desenhado)

  stage: {
    fillChance: 0.39,                                  // chance de um tile livre ter objeto (0,39 sem blocos fixos ≈ mesma quantidade de antes)
    weights: { rock: 60, tree: 22, vein: 14, chest: 4 }, // sorteio do tipo de objeto
    baseHp: { rock: 10, tree: 8, vein: 20, chest: 30 },
    // Vida dos objetos: (1 + 0,35 × fase) × 1,015^fase (conta mundos anteriores). A parte composta faz os
    // mundos finais exigirem mais preparo; o ouro acompanha a vida, então farmar sempre rende.
    hpGrowthPerStage: 0.35,
    hpCompound: 1.015,
    stagesPerWorld: 24,
    worldsPerDifficulty: 5,          // mundos em cada dificuldade (igual a WORLDS.length)
    difficultyStart: 0.3,            // cada dificuldade nova começa com ~30% da vida do fim da anterior
    zonesPerWorld: 3,                                  // 3 zonas de 8 fases (cenários diferentes)
    // Estrelas por tempo: 3★ até (objetos × par3 + extra do chefe) segundos; 2★ até o dobro.
    starPar3PerObject: 0.9,          // ~1 bomba por objeto = 3★; no nível certo da fase (2 a 3 bombas) dá 2★
    // Começo mais suave (alcance 1): nas primeiras fases do jogo os objetos têm menos vida
    // e o tempo das estrelas é mais folgado. O efeito some aos poucos até a fase 'stages'.
    earlyEase: { stages: 10, hpMult: 0.65, parMult: 1.6 },
    starBossExtraSec: 45,
    starCrystal: 1,                  // cristais por estrela nova
    starMilestones: [24, 48, 72],    // estrelas num mundo (por dificuldade) que dão prêmio
    // Dureza dos objetos (% do dano bloqueado). A Penetração ignora parte dela.
    hardness: { perStage: 0.0035, perWorld: 0.06, perDifficulty: 0.06, max: 0.6 },
    clearPauseMs: 2200,                                // pausa da tela "Fase concluída!"
    // Tiles sempre livres (onde os heróis entram em campo).
    spawn: [[6, 14], [5, 14], [7, 14], [6, 13], [4, 14], [8, 14], [3, 14], [9, 14], [6, 12]],
  },

  bomb: { fuseMs: 1500, chainDelayMs: 70 },

  // Chefe Cristal: última fase de cada mundo.
  boss: {
    hp: 500,                         // × o crescimento de HP da fase
    timeSec: 180,                    // se não cair nesse tempo, regenera toda a vida
    fillMult: 0.5,                   // metade dos objetos comuns na fase do chefe
    tile: [6, 7],                    // casa de baixo, no meio
    size: [3, 2],                    // ocupa 3 casas de largura × 2 de altura (ninguém passa por ele)
    crystals: 15,                    // prêmio na 1ª vitória (+ 1 gema, 1 baú e 1 gaiola)
    cages: 1,
  },

  hero: {
    idleRetryMs: 450,
    plantMs: 180,
    energyPerBomb: 1,
  },

  // ---------- Atributos ----------
  // Ataque = dano da bomba · Energia = estamina (cada bomba gasta energyPerBomb)
  // Velocidade → tiles/s = moveBase + velocidade / moveDiv
  // Sorte (%) = chance de loot dobrado; também soma nas chances dos baús
  // Crítico (%) e Dano crítico (%) · Penetração (%) ignora parte da dureza
  // Recarga (%) encurta o pavio das bombas
  attributes: {
    ids: ['attack', 'energy', 'speed', 'luck', 'critChance', 'critDamage', 'penetration', 'cooldown'],
    perPoint: {           // quanto cada ponto distribuído soma
      attack: 0.3, energy: 2, speed: 1, luck: 0.25,   // Ataque por ponto é baixo: o forte do Ataque vem do nível
      critChance: 0.25, critDamage: 2, penetration: 0.25, cooldown: 0.25,
    },
    caps: { luck: 100, critChance: 75, penetration: 80, cooldown: 50 },
    moveBase: 0.9,        // herói inicial (Velocidade 40) ≈ 2,2 casas/s; antes 3,2 parecia correr com os heróis pintados
    moveDiv: 30,
    maxMoveSpeed: 4.2,    // teto de casas por segundo (antes 6,5)
    // Alcance da bomba (em casas): papel + raridade + marcos de evolução.
    // +1 ao chegar em cada nível de levelSteps e +1 com starStep estrelas (fusão). Nunca passa de max.
    range: { levelSteps: [10, 30, 100, 250], starStep: 3, max: 7 },
    pointsPerLevel: 3,
    abilityPointEvery: 25, // 1 ponto de habilidade no nível 1 e mais 1 a cada 25 níveis
    abilityMax: 10,
    abilityResetCost: 2000, // ouro × despertar+1
    resetCostPerLevel: 50, // reset dos pontos = 50 ouro × nível
    // Poder (nota geral) = soma de atributo × peso.
    powerWeights: {
      attack: 4, energy: 1.5, speed: 1, luck: 6,
      critChance: 5, critDamage: 1, penetration: 5, cooldown: 6,
    },
  },

  // Atributos base por papel (Comum, Rank C, nível 1) + passiva do papel.
  roles: {
    attacker: {
      base: { attack: 12, energy: 30, speed: 40, luck: 1, critChance: 5, critDamage: 50, penetration: 2, cooldown: 0 },
      range: 1,
    },
    support: {
      base: { attack: 8, energy: 40, speed: 42, luck: 2, critChance: 3, critDamage: 40, penetration: 1, cooldown: 4 },
      range: 1, auraPct: 0.15, auraPctPerRarity: 0.05, auraRadius: 3,
    },
    collector: {
      base: { attack: 7, energy: 35, speed: 48, luck: 6, critChance: 3, critDamage: 40, penetration: 0, cooldown: 2 },
      range: 1, collect: 0.5, collectRadius: 3,
    },
    specialist: {
      base: { attack: 9, energy: 30, speed: 40, luck: 2, critChance: 4, critDamage: 50, penetration: 5, cooldown: 2 },
      range: 1, pierce: 1,
    },
  },

  // Raridades, da mais comum à mais rara (índice 0 a 4).
  // mult: Ataque e Energia · pctMult: atributos em % · speedMult: Velocidade
  rarities: [
    { mult: 1.0, pctMult: 1.0, speedMult: 1.0, bombs: 1, rangeBonus: 0, summonChance: 60 },
    { mult: 1.3, pctMult: 1.15, speedMult: 1.05, bombs: 1, rangeBonus: 0, summonChance: 25 },
    { mult: 1.7, pctMult: 1.3, speedMult: 1.1, bombs: 2, rangeBonus: 0, summonChance: 11 },
    { mult: 2.3, pctMult: 1.5, speedMult: 1.15, bombs: 2, rangeBonus: 1, summonChance: 3.5 },
    { mult: 3.2, pctMult: 1.75, speedMult: 1.2, bombs: 3, rangeBonus: 1, summonChance: 0.5 },
  ],

  // Rank = qualidade da rolagem na invocação, separada da raridade (E pior, S melhor).
  ranks: [
    { name: 'E', mult: 0.85, weight: 25 },
    { name: 'D', mult: 0.92, weight: 25 },
    { name: 'C', mult: 1.0, weight: 22 },
    { name: 'B', mult: 1.08, weight: 15 },
    { name: 'A', mult: 1.16, weight: 9 },
    { name: 'S', mult: 1.25, weight: 4 },
  ],

  levels: {
    max: 500,
    attackPerLevel: 0.06,  // +6% de Ataque por nível
    milestoneEvery: 25,    // marco de nível: a cada 25 níveis o Ataque do herói × milestoneMult
    milestoneMult: 1.4,
    energyPerLevel: 0.03,  // +3% de Energia por nível
    speedPerLevel: 0.006,  // +0,6% de Velocidade por nível (nível 100 ≈ +60%)
    baseCost: 20,          // custo do nível 1→2, multiplicado por (1 + raridade)
    costGrowth: 1.16,      // até o nível 60: base × 1.16^(nível-1)
    softCapLevel: 60,      // depois: × (nível / 60)^3 × lateGrowth^(nível − 60)
    lateGrowth: 1.014,     // +1,4% por nível depois do 60 (1.013 antes do Poder efetivo: equipes mais bem montadas avançavam ~15% mais rápido)
    // Despertar: a cada 100 níveis o herói trava até despertar (gasta ouro + essência).
    awakenEvery: 100,
    awakenLevels: 5,       // ouro do despertar = custo de 5 níveis naquele ponto (um marco, não só um clique)
    awakenEssence: 10,     // essência = 10 × (despertar+1)² × (1 + raridade): Lendário 40/160/360/640 (1.200 até o nv 500)
  },

  // Liberar herói devolve essência (por raridade), × (1 + estrelas).
  release: { essence: [1, 2, 5, 15, 50] },

  roster: {
    startSlots: 15,        // limite de heróis no elenco
    slotsPerUpgrade: 5,
    upgradeCost: 60000,    // piso: 60 mil × 4^compras
    upgradeGrowth: 4,
    stageCost: 30,         // ...ou 30 × 3^compras fases de ouro do ponto mais avançado (30 · 90 · 270 · 810…)
    stageGrowth: 3,
  },

  stars: { max: 3, bonusPerStar: 0.15, speedPerStar: 0.06 }, // +15% em Ataque, Energia e atributos em %; +6% em Velocidade

  ai: {
    valueByType: { rock: 1, tree: 1, vein: 3, chest: 5, boss: 6 }, // o quanto a IA "quer" cada objeto
    distanceBias: 1.5,                                    // maior = liga menos para distância
    finishBonus: 2,                                       // multiplica o valor se a bomba destrói o objeto
    roleBonus: {                                          // preferências extras por papel
      attacker: { highHp: 0.25 },                         // +25% de valor por HP restante acima de 1
      collector: { vein: 2, chest: 2 },                   // dobra o valor de veios e baús
    },
  },

  loot: {
    goldPerHp: 0.05,
    typeMult: { rock: 1, tree: 1, vein: 3, chest: 8, boss: 1 },
    rewardGrowthPerStage: 0.12,
    coinFlyMs: 550,
    maxCoinsPerDrop: 4,
    // Cristais e gaiolas vêm sobretudo de conquistas de 1ª vez (fase nova, estrela, chefe), missões e presentes.
    // Farmar uma fase repetida rende ouro; cristal e gaiola ali são raros.
    chestCrystalChance: 0.05,  // baú da arena solta 1 cristal (+ 20% da Sorte)
    chestCageChance: 0.0025,   // baú da arena solta 1 gaiola (+ 5% da Sorte) — ~1 por dia de farm
    chestLuckShare: { crystal: 0.2, cage: 0.05 },
    chestKeyChance: 0.25,      // baú solta 1 chave
    veinMineral: 1,            // veio solta minério do mundo…
    veinMineralChance: 0.4,    // …com esta chance (Sorte e Garimpo dobram)
    stageClearCrystals: 1,     // cristais na 1ª vez que conclui a fase (repetir não dá)
    cageEveryStages: 6,        // 1 gaiola na 1ª vez que conclui as fases 6, 12, 18 e 24
    keyEveryStages: 5,         // 1 chave a cada N fases concluídas
    rewardChestEvery: 6,       // baú de recompensa na 1ª vez que conclui a fase 6, 12, 18, 24
  },

  // Multiplicadores por dificuldade (Fácil → Inferno).
  difficulties: [
    // hp = vida no FIM da dificuldade (× fim do Fácil); o começo é stage.difficultyStart (30%) do fim da anterior.
    // reward = ouro. Calibrado no simulador de 60 dias (ferramentas/balanceamento/semana.mjs): quem joga 3 h/dia
    // chega ao Normal no dia 2, Difícil ~12, Pesadelo ~31, Inferno ~57 (com a Pólvora 1500 × 1,2^nível).
    { hp: 1, reward: 1 },
    { hp: 50, reward: 35 },
    { hp: 700, reward: 350 },
    { hp: 6500, reward: 2600 },
    { hp: 55000, reward: 16000 },
  ],

  // Baú de recompensa (abre com 1 chave).
  rewardChest: {
    goldPerStage: 40,          // ouro = 40 × índice da fase × recompensa da dificuldade
    crystals: [2, 4],
    minerals: [8, 15],
    cageChance: 0.3,
  },

  // ---------- Equipamento ----------
  items: {
    inventoryMax: 100,
    rarityWeights: [50, 28, 15, 6, 1],         // Comum → Mítico
    rarityMult: [1, 1.4, 1.9, 2.6, 3.5],
    affixCount: [1, 1, 2, 2, 3],               // atributos extras por raridade
    affixMult: 0.6,                            // extra vale 60% do principal (×0,7 a 1,0 sorteado)
    setChance: 0.4,                            // Raro ou melhor: chance de ser peça de conjunto
    setMinRarity: 2,
    // Valor base de cada atributo num item de nível 1.
    base: { attack: 3, energy: 6, speed: 3, luck: 1, critChance: 1, critDamage: 6, penetration: 1.5, cooldown: 1.5 },
    flatPerLevel: 0.05,                        // Ataque/Energia/Velocidade: +5% por nível de item
    pctPerLevel: 0.01,                         // atributos em %: +1% por nível de item
    plusBonus: 0.08,                           // +8% por +1 de forja
    starBonus: 0.15,                           // +15% por estrela
    // Nível do item = índice da fase + 50 por dificuldade (máx. 300).
    levelPerDifficulty: 50,
    // Drops lacrados
    chestSealedChance: 0.15,
    stageSealedChance: 0.1,
    rewardChestSealed: 1,
    // Equipamentos exclusivos de classe (src/data/exclusive.js): só a classe dona equipa, valem mais e são negociáveis.
    exclusive: {
      bonus: 0.2,              // +20% em todos os atributos do item
      revealChance: 0.03,      // qualquer lacrado comum: chance de sair exclusivo
      bossFirst: 1,            // 1ª vitória em cada chefe: 1 lacrado exclusivo garantido
      bossChance: 0.3,         // vitórias seguintes no chefe: chance de 1 lacrado exclusivo
      rewardChestChance: 0.1,  // baú de recompensa: o lacrado sai exclusivo
      abyssChance: 0.12,       // baú da arena no Abismo: o lacrado sai exclusivo
    },
  },

  // ---------- Gemas ----------
  gems: {
    maxLevel: 15,
    mergeCount: 3,                 // 3 iguais → 1 do nível seguinte
    mergeGold: 200,                // ouro por fusão = 200 × 2,5^(nível-1)
    mergeGoldGrowth: 2.5,
    growth: 1.4,                   // valor × 1,4 a cada nível
    base: { attack: 4, energy: 8, speed: 3, luck: 0.5, critChance: 0.5, critDamage: 5, penetration: 0.75, cooldown: 0.75 },
    sockets: [1, 50, 150],         // nível do herói que libera cada encaixe
    veinChance: 0.03,              // veio solta gema (+ Sorte)
    chestChance: 0.08,             // baú da arena solta gema (+ Sorte)
    rewardChest: 1,                // baú de recompensa sempre dá 1
    levelPerStages: 100,           // nível da gema que cai = 1 + índice da fase / 100 + dificuldade
  },

  // ---------- Altar de combinação ----------
  altar: {
    items: 5,                      // 5 itens iguais (espaço e raridade) → 1 da raridade seguinte
    heroes: 3,                     // 3 heróis da mesma raridade → 1 aleatório da seguinte
    // Custo em "fases de ouro" (ouro de uma fase): itens pela fase onde caíram, heróis pela fase atual.
    // Comum→Incomum · Incomum→Raro · Raro→Lendário · Lendário→Mítico
    itemStages: [1, 3, 10, 30],
    heroStages: [3, 10, 40, 150],
    stageGold: 94,                 // ouro de uma fase no nível 1 (a escala da fase multiplica)
    // Piso = preço antigo (vale no começo, para não sair fazendo heróis e itens de graça):
    itemMinGold: 500, itemMinGrowth: 4,     // itens: 500 · 2 mil · 8 mil · 32 mil
    heroMinGold: 2000, heroMinGrowth: 5,    // heróis: 2 mil · 10 mil · 50 mil · 250 mil
  },

  forge: {
    maxPlus: 15,
    // Chance de sucesso para chegar em +1 … +15.
    chance: [1, 1, 1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22, 0.15],
    breakFrom: 7,                              // a partir do +7, falhar pode quebrar o item
    breakOnFail: 0.3,                          // chance de quebrar quando falha (do +7 em diante)
    // Ouro = base × escala da fase onde o item caiu (fase + dificuldade) × 1,25^plus × (1 + raridade × 0,3).
    // O +1 de um item Comum ≈ 1/3 do ouro de uma fase; levar um Raro até +10 ≈ 25 fases de ouro
    // (em qualquer dificuldade). Minério até +10 de um Raro ≈ 220 (≈ 55 fases de veios do mundo).
    goldBase: 30,
    goldGrowth: 1.25,
    rarityGold: 0.3,
    // Minério = (2 + 1,5 × plus) × (1 + raridade × 0,4)
    mineralBase: 2,
    mineralPerPlus: 1.5,
    rarityMineral: 0.4,
    salvageGold: 5,
  },

  // ---------- Abismo Sem Fim (modo infinito competitivo) ----------
  endless: {
    unlockWorld: 0,            // libera ao concluir este mundo no Fácil
    hpStart: 12,               // multiplicador de HP na profundidade 1 (≈ fim do Mundo 1)
    hpGrowth: 1.12,            // +12% de HP a cada profundidade
    armorStart: 0.05,
    armorPerDepth: 0.006,
    armorMax: 0.75,
    timeLimitSec: 120,         // tempo para limpar cada profundidade; estourou = fim da descida
    essencePerDepth: 1,        // essência = 1 + profundidade / 5
    essenceDailyCap: 120,      // essência do Abismo por dia (descer horas não quebra o Despertar; ~15 min já enchem)
    chestEvery: 10,            // baú de recompensa + lacrado a cada 10 profundidades
    itemLevelStart: 100,       // nível de item = 100 + profundidade × 2 (máx. 300)
  },

  // ---------- Expedições ----------
  expeditions: {
    slots: 1,                      // grátis: 1 vaga · Passe do Minerador: + premium.expeditionSlots
    hours: [1, 4, 8],
    goldPerPowerHour: 3,           // ouro = Poder × 3 × horas × (1 + índice da fase / 24)
    crystalsPerHour: 1,
    essencePer2h: 1,
    gemEveryHours: 4,
    sealedEveryHours: 4,
  },

  // ---------- Clã (Colosso cooperativo) ----------
  // DESLIGADO até o servidor online existir: a tela mostra uma prévia com um clã de exemplo e os botões só avisam.
  // Para ativar: enabled = true e trocar os dados de src/data/clanPreview.js pelos do servidor.
  clan: {
    enabled: false,
    maxMembers: 20,
    milestones: [1e8, 5e8, 1e9, 2.5e9, 5e9],   // dano do clã na semana → baús para todos os membros
    helpsPerDay: 5,                            // ajudas por dia (cada uma: −15 min na expedição do colega, +1 cristal)
    helpMinutes: 15,
    helpCrystals: 1,
    rejoinHours: 24,                           // depois de sair, espera para entrar em outro clã
  },

  // ---------- Colosso da semana ----------
  colossus: {
    attemptsPerDay: 3,
    timeSec: 120,
    hp: 1e15,                      // não cai: o objetivo é causar o máximo de dano
    // Prêmio por faixa de dano: faixa = quantas destas metas você passou.
    tiers: [1e3, 1e4, 5e4, 2e5, 1e6, 5e6, 2e7, 1e8, 5e8, 2e9, 1e10, 1e11],
    crystalsPerTier: 1,
    essencePerTier: 2,
    gemFromTier: 3,                // a partir desta faixa vem 1 gema (nível 1 + faixa/2)
  },

  // ---------- Temporadas do Abismo (mensais) ----------
  season: {
    crystalsPerDepth: 2,
    essencePerDepth: 1,
    cageEveryDepth: 10,
  },

  // ---------- Álbum ----------
  album: { attackPerEntry: 0.0025, goldPerEntry: 0.0025 },

  // ---------- Missões diárias ----------
  daily: {
    count: 3,
    rewardCrystals: 5,
    rewardKeys: 1,
    bonusCages: 1,             // completar as 3 do dia
    bonusEssence: 15,          // essência: base para quem joga pouco o Abismo (Despertar)
  },

  offline: {
    capHours: 8,
    efficiency: 0.25,          // fora do jogo rende 25% do ritmo da última sessão (50% dava ~3,4× o ouro do jogo ativo)
    minSeconds: 60,            // só mostra o popup se ficou fora mais que isso
    rateSmoothing: 0.02,       // média móvel do ouro por segundo (≈ último minuto)
    mineralsPerHour: 40,       // minério do mundo atual por hora fora do jogo
  },

  upgrades: {
    // Pólvora reforçada: +3,5% de Ataque de todos por nível; custo 1500 × 1,2^nível.
    // Começa mais cara (antes: 60 × 1,3^nível dava +132% de Ataque já no 1º dia) e sobe mais devagar,
    // para continuar valendo no fim (simulador: nível ~27 no dia 1, ~86 no dia 30, ~100 no dia 60).
    power: { baseCost: 1500, growth: 1.2, attackPct: 0.035 },
  },

  // Passe do Minerador (Premium). testMode: a compra ativa na hora, sem pagamento (até ligar o modo online).
  premium: {
    testMode: true,
    priceLabel: 'R$ 9,90',
    days: 30,
    dailyCrystals: 30,       // cristais por dia (ao entrar no jogo)
    offlineHours: 4,         // + horas no limite do ganho offline
    expeditionSlots: 2,      // + vagas de expedição (total 3 com o Passe)
    recoveryBonus: 0.2,      // + velocidade de recuperação na Casa
  },

  // Passe de Temporada (1 por mês, junto com a temporada do Abismo): 30 níveis com trilha Grátis e trilha Elite.
  // XP vem de jogar todo dia (até 900 por dia); quem joga quase todo dia completa os 30 níveis antes do fim do mês.
  // Prêmios: gold = × ouro de um baú da fase atual · gems/sealed = do nível atual · legend = Gaiola Lendária.
  seasonPass: {
    testMode: true,
    priceLabel: 'R$ 14,90',
    levels: 30,
    xpBase: 500, xpStep: 15,   // XP do nível n (1..30) = 500 + 15 × (n − 1) → 21.525 no total (≈ 24 dias jogando tudo)
    xp: {
      mission: 100,            // cada missão diária coletada
      bonus: 150,              // as 3 missões do dia
      login: 50,               // presente diário
      stage: 10,               // fase concluída
      boss: 40,                // chefe vencido (além da fase)
      stageDailyCap: 400,      // máximo por dia vindo de fases e chefes
    },
    free: [
      { gold: 3 }, { keys: 1 }, { crystals: 10 }, { essence: 5 }, { sealed: 1 },
      { gold: 4 }, { keys: 1 }, { gems: 1 }, { crystals: 10 }, { cages: 1 },
      { gold: 5 }, { essence: 6 }, { keys: 2 }, { sealed: 1 }, { crystals: 15 },
      { gold: 6 }, { gems: 1 }, { essence: 8 }, { keys: 2 }, { cages: 1 },
      { gold: 8 }, { crystals: 15 }, { sealed: 2 }, { essence: 10 }, { gems: 1 },
      { keys: 2 }, { gold: 10 }, { crystals: 20 }, { chests: 1 }, { cages: 2 },
    ],
    elite: [
      { crystals: 20 }, { cages: 1 }, { gold: 6 }, { gems: 2 }, { crystals: 25 },
      { sealed: 2 }, { essence: 10 }, { chests: 1 }, { crystals: 25 }, { cages: 2 },
      { gems: 2 }, { gold: 10 }, { crystals: 30 }, { sealed: 3 }, { cages: 2 },
      { essence: 15 }, { chests: 2 }, { crystals: 30 }, { gems: 3 }, { cages: 2 },
      { gold: 15 }, { sealed: 3 }, { crystals: 35 }, { essence: 25 }, { cages: 3 },
      { gems: 3 }, { chests: 2 }, { crystals: 40 }, { cages: 3 }, { legend: 1 },
    ],
  },

  gacha: {
    cageCrystalPrice: 60,  // cristais vêm sobretudo de fases novas, estrelas e conquistas (crescem com o avanço)
    startingCages: 2,
    firstRarity: 2,        // a primeira invocação da conta vem no mínimo Rara
    pityEvery: 50,         // a cada 50 invocações sem Lendário, a próxima é Lendária garantida
  },

  teams: {
    count: 3,
    startSlots: 3,       // vagas por equipe no começo
    // Comando do Esquadrão (Metas → Missões): total de estrelas da conta que libera +1 herói em campo por equipe.
    // Calibrado no simulador (dedicado 3 h/dia): 4ª vaga na 1ª sessão, 5ª ~dia 2, 6ª ~dia 6, 7ª ~dia 20, 8ª ~dia 50.
    starSlots: [30, 250, 400, 650, 950, 1250],
    unlockWorld: [null, 0, 2], // Equipe B: vencer o Chefe do Mundo 1 (Fácil) · Equipe C: Chefe do Mundo 3
    readyRatio: 0.5,     // herói entra em campo com pelo menos 50% de energia
    checkEverySec: 1,
  },

  house: {
    capsules: 9,
    startUnlocked: 3,
    // Cápsulas: 4ª ≈ fim do Mundo 1 · 5ª ≈ Mundo 2 · 6ª ≈ Mundo 3 · 7ª ≈ Mundo 4 · 8ª ≈ Mundo 5 · 9ª ≈ Normal.
    // Cada uma custa ~20–35% de todo o ouro ganho até o ponto em que ela faz falta (conferido no simulador):
    // 6 mil · 39 mil · 254 mil · 1,65 mi · 10,7 mi · 69,6 mi.
    capsuleBaseCost: 6000,  // custo da 4ª cápsula
    capsuleCostGrowth: 6.5,
    recoverSecs: 60,        // tempo para encher a energia numa cápsula
    outsideRate: 0.25,      // fora da cápsula recupera a 25% da velocidade
    // Recuperação: +15% de velocidade por nível, até o nível 20 (+300%). Custo = o maior entre 2500 × 2^nível
    // e 25 × 1,1^nível fases de ouro do ponto mais avançado da conta (Economy.bestStageGold): continua pesando
    // o jogo todo. Simulador (3 h/dia): nível ~4 no dia 3, ~9 no dia 7, ~13 no dia 14, ~16 no dia 60.
    recoveryUpgrade: { baseCost: 2500, growth: 2, bonus: 0.15, maxLevel: 20, stageCost: 25, stageGrowth: 1.1 },
    offlineCapHours: 8,     // recuperação de energia com o jogo fechado
  },

  // Presente diário (7 dias, não precisa ser seguido). gold = × (ouro de um baú da fase atual).
  login: {
    goldMin: 150,
    days: [
      { gold: 3 },
      { crystals: 30 },
      { cages: 1 },
      { gold: 6, keys: 2 },
      { crystals: 60 },
      { cages: 2 },
      { legend: 1 },
    ],
  },

  // Baú de retorno: além do ouro offline, quem volta depois de um tempo ganha um bônus.
  comeback: {
    minHours: 2,
    crystalsPerHour: 2, crystalsMax: 60,
    cageAt: [12, 72],          // 1 gaiola a partir de 12 h fora, outra a partir de 3 dias
    keyAt: 24,                 // 1 chave a partir de 1 dia fora
    maxHours: 168,             // conta no máximo 7 dias
  },

  // Poder recomendado por fase (ver systems/Difficulty.js).
  // Por herói: otherBase × peso^otherExp + attackWeight × attackBase × peso × slack. × heroes. Chefe × bossMult.
  // Verde: Poder da equipe ≥ recomendado · Amarelo: ≥ warn × recomendado · Vermelho: abaixo.
  // Poder = dano efetivo (multiplica Ataque, crítico, penetração, bombas, alcance, ritmo e habilidades de dano;
  // a equipe soma a aura e as habilidades da Engenheira). Recomendado = need × fator da fase (vida ÷ dureza) × heróis.
  // Calibrado no jogo: equipe com 100% do recomendado limpa a fase perto do tempo de 3★ (2★ garantidas).
  power: {
    heroes: 3, bossMult: 1.25, warn: 0.8,
    k: 4, need: 9,                       // need = Ataque efetivo por herói na fase de fator 1
    refArmor: 0.3,                       // dureza de referência para o valor da Penetração no Poder do herói
    bombStep: 0.08, rangeStep: 0.08,     // bomba extra: o herói quase sempre foge da 1ª antes de plantar outra (+8%) · +8% por casa de alcance
    speedRef: 2.3, speedExp: 0.3,        // andar mais rápido ajuda pouco (o tempo é mais das bombas)
    fuseCut: 0.5,                        // Recarga (pavio mais curto)
    auraCover: 0.4,                      // fração do tempo em que os aliados estão dentro da aura
  },

  // Abas que abrem aos poucos: fase do Mundo 1 (Fácil) que precisa estar concluída.
  unlocks: { inventory: 2, forge: 2, skills: 5, house: 9 },

  save: { key: 'bomba-rural-save', testKey: 'bomba-rural-teste', version: 13, intervalMs: 10000 },

  juice: { shakeIntensity: 0.0025, shakeMs: 80, debrisCount: 6 },
};
