// HUD: barra do topo, faixa da fase, dock, abas, painéis e janelas.
import { BALANCE } from '../config/balance.js';
import { setupCamera } from '../config/display.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { WORLDS, DIFFICULTIES, COLOSSI, ZONES } from '../data/worlds.js';
import { MapPanel } from '../ui/MapPanel.js';
import { RewardModal } from '../ui/RewardModal.js';
import { openRewardChest } from '../systems/Rewards.js';
import { RitualPanel } from '../ui/RitualPanel.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import { MarketPanel } from '../ui/MarketPanel.js';
import { ClanPanel, drawShield } from '../ui/ClanPanel.js';
import { MorePanel, ensureMenuIcon, drawFullscreenIcon } from '../ui/MorePanel.js';
import { premiumDaysLeft } from '../systems/Premium.js';
import { SkillTreePanel } from '../ui/SkillTreePanel.js';
import { GoalsPanel } from '../ui/GoalsPanel.js';
import { TitleOverlay, TipsModal } from '../ui/Intro.js';
import { claimableCount, ensureDaily, missionView, bonusReady, msToReset, abyssEssenceLeft } from '../systems/Goals.js';
import { Sfx } from '../systems/Sfx.js';
import { itemIcon } from '../ui/itemText.js';
import { RARITY_NAMES, RARITY_TEXT } from '../data/heroes.js';
import { gemLabel } from '../ui/gemText.js';
import { abilityPointsAvailable } from '../systems/HeroStats.js';
import { gemStacks, canMerge } from '../systems/Gems.js';
import { recipes, canCombine } from '../systems/Altar.js';
import { canBuyNode } from '../systems/SkillTree.js';
import { canOpenChest } from '../systems/Rewards.js';
import {
  JOURNEY, journeyStep, journeyDone, stepComplete, claimStep, tabUnlocked, newlyUnlockedTabs, markTabSeen, nextGoals,
} from '../systems/Journey.js';
import { TREE } from '../data/skilltree.js';
import { ExpeditionPicker } from '../ui/ExpeditionPicker.js';
import { send as sendExpedition, collect as collectExpedition, readyCount } from '../systems/Expeditions.js';
import { ItemDetail } from '../ui/ItemDetail.js';
import { revealSealed, salvageCommons, itemPower } from '../systems/Items.js';
import { economy } from '../systems/Economy.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { Cloud } from '../systems/Cloud.js';
import { GUEST_KEY } from '../ui/AuthGate.js';
import { ONLINE } from '../config/online.js';
import { RankingPanel } from '../ui/RankingPanel.js';
import { summon, buyCage } from '../systems/Gacha.js';
import { Button } from '../ui/Button.js';
import { Panel } from '../ui/Panel.js';
import { Toast } from '../ui/Toast.js';
import { Dock } from '../ui/Dock.js';
import { TeamPicker } from '../ui/TeamPicker.js';
import { HeroesPanel } from '../ui/HeroesPanel.js';
import { HousePanel } from '../ui/HousePanel.js';
import { HeroDetail } from '../ui/HeroDetail.js';
import { SummonModal } from '../ui/SummonModal.js';
import { txt, fit } from '../ui/widgets.js';
import { fmt } from '../ui/format.js';
import { maxEnergy } from '../systems/Energy.js';
import { recommendedPower, teamPower } from '../systems/Difficulty.js';
import { claimLogin, loginAvailable, summonLegend } from '../systems/Login.js';
import { SeasonPassModal } from '../ui/SeasonPassModal.js';
import { claimCell, claimAll as claimAllPass, buyElite, claimableCount as passClaimable, passLevel, ensurePass } from '../systems/SeasonPass.js';
import { LoginModal } from '../ui/LoginModal.js';
import { frame, ironBand } from '../ui/skin.js';
import { PremiumModal } from '../ui/PremiumModal.js';
import { premiumActive, buyPass, premiumDailyAvailable, claimPremiumDaily, canOpenAllChests } from '../systems/Premium.js';

const W = BALANCE.screen.width;
const L = BALANCE.layout;
const HUD = L.hud;
// Barra do topo: ouro (número completo) · cristais (+) · gaiolas · coroa · troféu (Ajustes ficam no ☰ Mais).
const TOP_CY = L.safeTop + (L.topBarH - L.safeTop) / 2;   // meio da linha dos contadores (abaixo do respiro do topo)
const CHIPS = { gold: [10, 232], crystal: [250, 150], cage: [408, 96] };   // [x, largura] dos encaixes
const CROWN_X = 613;
const TROPHY_X = 679;
const GOLD_TEXT_W = CHIPS.gold[0] + CHIPS.gold[1] - 12 - (HUD.gold[0] + 26);
const goldFull = (n) => Math.floor(n).toLocaleString('pt-BR');

// Menu de baixo: 5 abas. "Itens" e "Base" juntam painéis (com sub-abas na faixa da fase).
// "Mais" (☰) abre a grade de atalhos; Mapa, Clã e Ajustes abrem a partir dela (a aba fica acesa, sem sub-abas).
const NAV = [
  { id: 'heroes', icon: 'ui_heroes', scale: 3.6, kids: ['heroes'] },
  { id: 'items', icon: 'icon_bag', scale: 4.6, kids: ['inventory', 'forge'] },
  { id: 'battle', icon: 'ui_bomb', scale: 4.2, kids: ['battle'], center: true },
  { id: 'base', icon: 'icon_house', scale: 4.6, kids: ['house', 'skills', 'market'] },
  { id: 'more', icon: 'icon_menu', scale: 3.4, kids: ['more', 'map', 'clan', 'ranking', 'settings'], noSub: true },
];
const PARENT = {};
NAV.forEach((n) => n.kids.forEach((k) => { PARENT[k] = n.id; }));
// Ícones de cada painel (sub-abas e comemoração de aba nova).
const KID_ICON = {
  heroes: ['ui_heroes', 3], inventory: ['icon_bag', 4], forge: ['icon_forge', 4], skills: ['icon_skills', 4],
  map: ['icon_map', 4], house: ['icon_house', 4], market: ['icon_market', 4], battle: ['ui_bomb', 3], more: ['icon_menu', 3],
};
const RAIL_X = W - 44;   // coluna de atalhos dentro do campo, à direita
const DIFF_CHIP = [0x8fe07a, 0x8cc2f5, 0xffb66b, 0xff7a94, 0xc8a0ff];   // cor da etiqueta de cada dificuldade

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    setupCamera(this);
    this.battle = this.scene.get('Battle');
    this.activeTab = 'battle';

    this.buildTopBar();
    this.buildStageBar();
    // Toque num cartão da equipe: escolher quem ocupa aquela vaga (ou ver a ficha de quem está lá).
    this.dock = new Dock(this, (h) => this.statusOf(h), (team, slot, h) => this.teamPicker.show(team, slot, h), {
      today: () => this.todayInfo(),
      onMissionTap: () => { this.showTab('goals'); this.panels.goals.showView('missions'); },
      onChallengeTap: (kind) => {
        if (kind === 'pass') { this.passModal.show(); return; }
        this.showTab('goals');
        this.panels.goals.showView('abyss');
      },
      onTeamLocked: (t) => this.toast.show(STR.teamLocked(t, (BALANCE.teams.unlockWorld[t] ?? 0) + 1), 2400),
      onPowerTap: (st) => { if (st === 'hard') this.toast.show(STR.hardStage, 2600); },
    });
    this.buildTabs();
    this.buildBanner();
    this.waitingText = txt(this, W / 2, L.arenaY + L.arenaH / 2, STR.waiting, 26, TXT.main, true)
      .setOrigin(0.5).setStroke('#12081c', 8).setDepth(40).setVisible(false);

    this.toast = new Toast(this, W / 2, L.dockY - 60);
    this.panels = {
      heroes: new HeroesPanel(this, {
        onClose: () => this.showTab('battle'),
        onSummon: () => this.doSummon(),
        onBuyCage: () => this.doBuyCage(),
        onBuyPower: () => this.doBuyPower(),
        onHero: (h) => this.detail.show(h),
      }),
      house: new HousePanel(this, {
        onClose: () => this.showTab('battle'),
        onBuyCapsule: () => this.doBuyCapsule(),
        onBuyRecovery: () => this.doBuyRecovery(),
        onHero: (h) => this.detail.show(h),
        onSend: () => this.expPicker.show(),
        onCollect: (i) => this.doCollectExpedition(i),
      }),
      map: new MapPanel(this, {
        onClose: () => this.showTab('battle'),
        onTravel: (d, w, s) => this.doTravel(d, w, s),
        onOpenChest: () => this.doOpenChest(),
      }),
      inventory: new InventoryPanel(this, {
        onClose: () => this.showTab('battle'),
        onReveal: () => this.doReveal(),
        onItem: (it, h) => this.itemDetail.show(it, '', { equipHero: h }),
        onSlot: (h, key) => this.detail.picker.show(h, key),
        onSalvageCommons: () => this.doSalvageCommons(),
      }),
      market: new MarketPanel(this, { onClose: () => this.showTab('battle') }),
      clan: new ClanPanel(this, { onClose: () => this.showTab('battle') }),
      ranking: new RankingPanel(this, { onClose: () => this.showTab('battle') }),
      more: this.buildMorePanel(),
      forge: new RitualPanel(this, {
        onClose: () => this.showTab('battle'),
        onItem: (it) => this.itemDetail.show(it),
        onGemMerged: () => SaveSystem.save(economy),
        onCombined: (r) => {
          SaveSystem.save(economy);
          Sfx.play('reward');
          if (r.item) this.itemDetail.show(r.item, STR.altarDone);
          else if (r.hero) this.summonModal.play(r.hero);
        },
      }),
      skills: new SkillTreePanel(this, { onClose: () => this.showTab('battle') }),
      goals: new GoalsPanel(this, {
        onClose: () => this.showTab('battle'),
        onDescend: () => { if (this.battle.startEndless()) this.showTab('battle'); },
        onQuit: () => { this.battle.endEndless(); },
        onColossus: () => { if (this.battle.startColossus()) this.showTab('battle'); },
      }),
      settings: this.buildSettingsPanel(),
    };
    this.rewardModal = new RewardModal(this);
    this.expPicker = new ExpeditionPicker(this, (h, hours) => {
      if (sendExpedition(h, hours)) {
        SaveSystem.save(economy);
        this.toast.show(STR.expSent(h.name, hours), 1600);
      }
    });
    this.itemDetail = new ItemDetail(this);
    this.teamPicker = new TeamPicker(this, {
      onDetail: (h) => this.detail.show(h),
      onDone: (msg) => { SaveSystem.save(economy); Sfx.play('click'); this.toast.show(msg, 1600); this.refreshAll(); },
    });
    this.detail = new HeroDetail(this);
    this.summonModal = new SummonModal(this, { onAgain: () => this.doSummon() });
    this.loginModal = new LoginModal(this, {
      onClaim: () => { const r = claimLogin(); SaveSystem.save(economy); return r; },
    });
    this.loginModal.after = (res) => this.afterLogin(res);
    this.premiumModal = new PremiumModal(this, { onBuy: () => this.doBuyPremium() });
    this.passModal = new SeasonPassModal(this, {
      onClaim: (t, i) => this.doPassClaim(t, i),
      onClaimAll: () => this.doPassClaimAll(),
      onBuy: () => this.doPassBuy(),
    });
    this.buildPassBadge();
    this.buildFullscreenButton();
    this.buildChestButton();
    this.applyPremiumLook();
    this.toast.setDepth(500);

    this.wireEvents();
    this.onStageStart();
    this.onProgress(this.battle.grid.total - this.battle.grid.remaining, this.battle.grid.total);
    this.onCurrency();
    this.refreshAll();
    // Abertura: tela inicial → dicas (só na primeira vez) → resumo do tempo fora.
    Sfx.setMuted(economy.muted);
    this.input.on('pointerdown', () => Sfx.unlock());
    ensureDaily();
    this.updateTrophyDot();
    this.tips = new TipsModal(this);
    const afterTitle = () => {
      if (economy.tutorialSeen) { this.showOffline(); return; }
      this.tips.show(STR.tips, () => {
        economy.tutorialSeen = true;
        SaveSystem.save(economy);
        this.toast.show(STR.journeyStart, 2600);
        this.showOffline();
      });
    };
    if (window.__SKIP_INTRO) {
      this.time.delayedCall(700, () => this.showOffline());
    } else {
      this.title = new TitleOverlay(this, afterTitle);
      this.title.open();
    }
  }

  updateTrophyDot() {
    this.trophyDot.setVisible(claimableCount() > 0);
  }

  // Medalhão do Passe como ícone grande das janelas do Passe.
  passTop() {
    const ok = this.textures.exists('season_parts') && this.textures.get('season_parts').has('badge');
    return ok ? { icon: 'season_parts', frame: 'badge', size: 200 } : { icon: 'star', size: 190 };
  }

  // Popup "Enquanto você estava fora…".
  showSeason() {
    const r = economy.pendingSeason;
    if (!r) { this.showPassEnd(); return; }
    economy.pendingSeason = null;
    const items = [
      { icon: 'crystal', text: STR.rewardCrystals(r.crystals), color: '#9fe8ff' },
      { icon: 'star', text: `${r.essence} essência`, color: '#c8b0ff' },
    ];
    if (r.cages) items.push({ icon: 'cage', scale: 3, text: `${r.cages} gaiola`, color: TXT.good });
    this.rewardModal.show({ top: { icon: 'star' }, ribbon: 'purple', title: STR.seasonTitle, subtitle: STR.seasonResult(r.best), items }, () => this.showPassEnd());
  }

  // Virada do mês do Passe de Temporada: mostra o que foi entregue dos níveis que ficaram para trás.
  showPassEnd() {
    ensurePass();
    const r = economy.pendingPassEnd;
    if (!r) { this.showLogin(); return; }
    economy.pendingPassEnd = null;
    SaveSystem.save(economy);
    this.rewardModal.show({ top: this.passTop(), ribbon: 'purple', title: STR.passEndTitle, subtitle: STR.passEndSub(r.level), items: this.passItems(r.rewards) }, () => this.showLogin());
  }

  // ---------- Coluna de atalhos à direita do campo (Passe · Baús · Tela cheia) ----------
  buildChestButton() {
    const x = RAIL_X, y = L.arenaY + 128;
    const c = this.chestBtn = this.add.container(x, y).setDepth(45);
    const bg = this.add.circle(0, 0, 30, 0x120a1e, 0.78).setStrokeStyle(2, 0xc8962a, 0.95);
    const icon = this.add.image(0, 1, 'ui_chest').setScale(1.55);
    const badge = this.add.circle(22, -22, 13, 0xe0563b).setStrokeStyle(2, 0x120a1e);
    this.chestCount = txt(this, 22, -23, '', 15, '#ffffff', true).setOrigin(0.5);
    c.add([bg, icon, badge, this.chestCount]);
    this.chestHit = this.add.circle(x, y, 34, 0x000000, 0).setDepth(46).setInteractive({ useHandCursor: true });
    this.chestHit.on('pointerdown', () => c.setScale(0.9));
    this.chestHit.on('pointerout', () => c.setScale(1));
    this.chestHit.on('pointerup', () => {
      c.setScale(1);
      if (!canOpenChest()) { this.toast.show(STR.chestRailNoKey, 2600); return; }
      Sfx.play('click');
      this.doOpenChest();
    });
    this.updateRail();
  }

  // Baú só aparece quando há baú guardado; a Tela cheia sobe para o lugar dele quando não há.
  updateRail() {
    if (!this.chestBtn) return;
    const n = economy.rewardChests;
    const show = n > 0;
    this.chestBtn.setVisible(show);
    this.chestHit.setVisible(show);
    if (show) this.chestHit.setInteractive(); else this.chestHit.disableInteractive();
    this.chestCount.setText(n > 9 ? '9+' : String(n));
    if (this.fsBtn) {
      const y = L.arenaY + (show ? 198 : 128);
      this.fsBtn.setY(y);
      this.fsHit.setY(y);
    }
  }

  // ---------- Tela cheia ----------
  // Botãozinho discreto embaixo do medalhão do Passe (e um botão nos Ajustes). No iPhone o navegador
  // não deixa sites ficarem em tela cheia: lá o botão some e os Ajustes explicam (vem com o app instalado).
  fullscreenAvailable() {
    return !!this.scale.fullscreen?.available;
  }

  buildFullscreenButton() {
    const x = RAIL_X, y = L.arenaY + 198;
    const c = this.fsBtn = this.add.container(x, y).setDepth(45);
    const bg = this.add.circle(0, 0, 28, 0x120a1e, 0.78).setStrokeStyle(2, 0xc8962a, 0.95);
    const g = this.fsIcon = this.add.graphics();
    c.add([bg, g]);
    const hit = this.add.circle(x, y, 32, 0x000000, 0).setDepth(46).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => c.setScale(0.9));
    hit.on('pointerout', () => c.setScale(1));
    hit.on('pointerup', () => { c.setScale(1); this.toggleFullscreen(); });
    this.fsHit = hit;
    const avail = this.fullscreenAvailable();
    c.setVisible(avail);
    hit.setVisible(avail);
    if (!avail) hit.disableInteractive();
    this.scale.on('enterfullscreen', () => this.updateFullscreenUI());
    this.scale.on('leavefullscreen', () => this.updateFullscreenUI());
    this.scale.on('fullscreenunsupported', () => this.toast.show(STR.fullscreenNo, 3200));
    this.scale.on('fullscreenfailed', () => this.toast.show(STR.fullscreenFailed, 3600));
    this.updateFullscreenUI();
  }

  // Desenha os 4 cantos: para fora (entrar) ou para dentro (sair).
  updateFullscreenUI() {
    const on = this.scale.isFullscreen;
    const g = this.fsIcon;
    if (g) {
      g.clear().lineStyle(3, 0xffd86a, 1);
      const a = 11, l = 7;   // distância do centro e tamanho de cada perna
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = sx * a, cy = sy * a;
        // Entrar: a quina aponta para fora. Sair: aponta para dentro.
        const dx = on ? sx * l : -sx * l, dy = on ? sy * l : -sy * l;
        const px = on ? cx - sx * l : cx, py = on ? cy - sy * l : cy;
        g.beginPath();
        g.moveTo(px + dx, py); g.lineTo(px, py); g.lineTo(px, py + dy);
        g.strokePath();
      }
    }
    this.fsSettingsBtn?.setLabel(on ? STR.fullscreenOff : STR.fullscreenOn);
  }

  toggleFullscreen() {
    Sfx.play('click');
    if (!this.fullscreenAvailable()) { this.toast.show(STR.fullscreenNo, 3200); return; }
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  // ---------- Passe de Temporada ----------
  // Medalhão no canto do campo: abre o passe, mostra o nível e avisa quando há prêmio.
  buildPassBadge() {
    const x = RAIL_X, y = L.arenaY + 52;
    const c = this.passBadge = this.add.container(x, y).setDepth(45);
    const glow = this.add.circle(0, -2, 34, 0xffc840, 0.25);
    const img = this.add.image(0, 0, 'star').setDisplaySize(70, 70);
    const lvlBg = this.add.circle(25, -27, 14, 0x1a0c30).setStrokeStyle(3, 0xffc840);
    const lvl = txt(this, 25, -28, '', 18, '#ffe680').setOrigin(0.5).setStroke('#12081c', 4);
    const dot = this.add.circle(-26, -28, 9, 0xe0563b).setStrokeStyle(2, 0x120a1e).setVisible(false);
    c.add([glow, img, lvlBg, lvl, dot]);
    this.passBadgeParts = { img, lvl, dot, glow };
    this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.05, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const setArt = () => {
      if (this.textures.exists('season_parts') && this.textures.get('season_parts').has('badge')) img.setTexture('season_parts', 'badge').setDisplaySize(72, 72);
      else this.time.delayedCall(300, setArt);
    };
    setArt();
    const hit = this.add.circle(x, y, 40, 0x000000, 0).setDepth(46).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => c.setScale(0.92));
    hit.on('pointerout', () => c.setScale(1));
    hit.on('pointerup', () => { c.setScale(1); Sfx.play('click'); this.passModal.show(); });
    this.passBadgeHit = hit;
    this.updatePassBadge();
  }

  updatePassBadge() {
    if (!this.passBadgeParts) return;
    const { lvl, dot } = this.passBadgeParts;
    lvl.setText(String(passLevel().level));
    dot.setVisible(passClaimable() > 0);
  }

  // Linhas da janela de recompensa (no máximo 5).
  passItems(r) {
    const items = [];
    if (r.heroes?.length || r.legendStored) items.push({ icon: 'cage', scale: 3, text: STR.legendCageTitle, color: '#ffc070' });
    if (r.cages) items.push({ icon: 'cage', scale: 3, text: STR.rewardCages(r.cages), color: TXT.good });
    if (r.crystals) items.push({ icon: 'crystal', text: STR.rewardCrystals(r.crystals), color: '#9fe8ff' });
    if (r.gold) items.push({ icon: 'coin', text: STR.rewardGold(fmt(r.gold)), color: TXT.gold });
    if (r.keys) items.push({ icon: 'key', text: STR.rewardKeys(r.keys), color: TXT.gold });
    if (r.essence) items.push({ icon: 'star', text: `${r.essence} essência`, color: '#c8b0ff' });
    if (r.chests) items.push({ icon: 'ui_chest', scale: 4, text: STR.passReward.chests(r.chests), color: TXT.gold });
    if (r.sealed) items.push({ icon: 'sealed', scale: 4, text: STR.passReward.sealed(r.sealed), color: '#e8c890' });
    if (r.gemKeys?.length === 1) items.push({ icon: `gem_${r.gemKeys[0].split(':')[0]}`, text: gemLabel(r.gemKeys[0]), color: '#ffa0d8' });
    else if (r.gemKeys?.length) items.push({ icon: `gem_${r.gemKeys[0].split(':')[0]}`, text: STR.passReward.gems(r.gemKeys.length), color: '#ffa0d8' });
    if (items.length > 5) {   // junta o resto numa linha só
      const rest = items.splice(4);
      items.push({ icon: rest[0].icon, scale: rest[0].scale, text: rest.map((x) => x.text).join(' · '), color: TXT.main });
    }
    return items;
  }

  showPassResult(r) {
    SaveSystem.save(economy);
    this.passModal.refresh();
    this.updatePassBadge();
    if (r.heroes.length) {   // Gaiola Lendária: invocação com festa
      this.passModal.close();
      Sfx.play('fanfare');
      this.summonModal.play(r.heroes[0], { title: STR.legendCageTitle, cageTint: 0xf0923a });
      return;
    }
    if (r.legendStored) this.time.delayedCall(400, () => this.toast.show(STR.legendStored, 3200));
    Sfx.play('reward');
    this.rewardModal.show({ top: this.passTop(), ribbon: 'purple', title: STR.passGot, items: this.passItems(r) });
  }

  doPassClaim(t, i) {
    const r = claimCell(t, i);
    if (r) this.showPassResult(r);
  }

  doPassClaimAll() {
    const r = claimAllPass();
    if (r) this.showPassResult(r);
  }

  doPassBuy() {
    if (economy.pass.elite) return;
    if (!buyElite()) return;
    SaveSystem.save(economy);
    Sfx.play('fanfare');
    this.cameras.main.flash(260, 120, 220, 255);
    this.toast.show(STR.passEliteDone, 2600);
    this.passModal.refresh();
    this.updatePassBadge();
  }

  // ---------- Presente diário ----------
  showLogin() {
    this.welcomeDone = true;
    if (loginAvailable()) this.loginModal.show();
  }

  afterLogin(res) {
    const r = res.reward;
    if (res.hero) {
      Sfx.play('fanfare');
      this.summonModal.play(res.hero, { title: STR.legendCageTitle, cageTint: 0xf0923a });
      return;
    }
    const items = [];
    if (r.gold) items.push({ icon: 'coin', text: STR.rewardGold(fmt(r.gold)), color: TXT.gold });
    if (r.crystals) items.push({ icon: 'crystal', text: STR.rewardCrystals(r.crystals), color: '#9fe8ff' });
    if (r.cages) items.push({ icon: 'cage', scale: 3, text: STR.rewardCages(r.cages), color: TXT.good });
    if (r.keys) items.push({ icon: 'key', text: STR.rewardKeys(r.keys), color: TXT.gold });
    if (r.legend) {
      // Equipe cheia: a gaiola ficou guardada.
      items.push({ icon: 'cage', scale: 3, text: STR.legendCageTitle, color: '#ffc070' });
      this.time.delayedCall(400, () => this.toast.show(STR.legendStored, 3200));
    }
    Sfx.play('reward');
    this.rewardModal.show({ ribbon: 'gold', title: STR.loginGot(res.day), subtitle: STR.loginNext, items });
  }

  showOffline() {
    const r = economy.pendingOffline;
    if (!r) { this.showSeason(); return; }
    economy.pendingOffline = null;
    const items = [];
    const b = r.bonus || {};
    const pct = Math.round((BALANCE.offline.efficiency + economy.treeSum('offlineEff')) * 100);
    if (r.gold > 0) items.push({ icon: 'coin', text: STR.offlineGold(goldFull(r.gold)), color: TXT.gold, note: STR.offlineGoldNote(pct) });
    if (r.minerals > 0) {
      items.push({ icon: `ore_${r.world}`, text: STR.offlineOre(fmt(r.minerals), WORLDS[r.world].mineral.name), note: STR.offlineOreNote });
    }
    if (b.crystals) items.push({ icon: 'crystal', text: STR.offlineCrystals(b.crystals), color: '#9fe8ff', note: STR.comebackNote });
    if (b.cages) items.push({ icon: 'cage', text: STR.rewardCages(b.cages), color: TXT.good, note: STR.comebackNote });
    if (b.keys) items.push({ icon: 'key', text: STR.rewardKeys(b.keys), color: TXT.gold, note: STR.comebackNote });
    const comeback = b.crystals || b.cages || b.keys;
    const away = STR.offlineAway(formatDuration(r.seconds), formatDuration(r.cappedSeconds));
    const subtitle = `${away}\n${items.length ? STR.offlineEnergy : STR.offlineNothing}`;
    // Quem ainda não tem o Passe do Minerador vê a dica (mais horas de ganho offline).
    const tip = premiumActive() ? null : {
      icon: 'icon_premium', text: STR.offlinePremiumTip(BALANCE.premium.offlineHours), onTap: () => this.premiumModal.show(),
    };
    Sfx.play(comeback ? 'fanfare' : 'reward');
    this.rewardModal.show({ top: { icon: 'ui_chest' }, title: STR.comebackTitle, subtitle, items, tip }, () => this.showSeason());
  }

  wireEvents() {
    const ge = this.game.events;
    const on = (emitter, name, fn) => {
      emitter.on(name, fn, this);
      this.events.once('shutdown', () => emitter.off(name, fn, this));
    };
    on(economy, 'gold', this.onGold);
    on(economy, 'currency', this.onCurrency);
    on(economy, 'upgrade', this.refreshAll);
    on(economy, 'roster', this.refreshAll);
    on(economy, 'teams', this.refreshAll);
    on(economy, 'house', this.refreshAll);
    on(economy, 'map', this.refreshAll);
    on(economy, 'items', this.refreshAll);
    on(economy, 'tree', this.refreshAll);
    on(economy, 'gems', this.refreshAll);
    on(ge, 'gem-arrive', () => this.pop(this.coinIcon));
    on(ge, 'coin-arrive', () => Sfx.play('coin'));
    on(ge, 'endless-tick', () => this.updateTeamLabel());
    on(ge, 'endless-end', this.onEndlessEnd);
    // Depois do aviso de recorde/fase, para um não cobrir o outro.
    on(ge, 'abyss-essence-cap', () => this.time.delayedCall(1800, () => this.toast.show(STR.abyssEssCap(BALANCE.endless.essenceDailyCap), 3600)));
    on(economy, 'expeditions', this.refreshAll);
    on(economy, 'pass', () => { this.updatePassBadge(); if (this.passModal?.isOpen) this.passModal.refresh(); });
    on(economy, 'pass-level', (n) => { Sfx.play('reward'); this.toast.show(STR.passLevelUp(n), 2000);
      if (this.passBadge) this.tweens.add({ targets: this.passBadge, scale: 1.25, duration: 160, yoyo: true, ease: 'Sine.easeOut' }); });
    on(economy, 'album', () => { if (this.panels.goals.isOpen) this.panels.goals.refresh(); });
    on(ge, 'colossus-end', this.onColossusEnd);
    on(ge, 'boss-regen', () => { Sfx.play('fail'); this.toast.show(STR.bossRegen, 2400); });
    on(ge, 'sealed-arrive', () => this.pop(this.coinIcon));
    on(ge, 'ore-arrive', () => this.pop(this.coinIcon));
    on(ge, 'key-arrive', () => this.pop(this.coinIcon));
    on(ge, 'world-changed', this.onWorldChanged);
    on(ge, 'zone-changed', this.onZoneChanged);
    on(ge, 'coin-arrive', () => this.pop(this.coinIcon));
    on(ge, 'crystal-arrive', () => this.pop(this.crystalIcon));
    on(ge, 'cage-arrive', () => this.pop(this.cageIcon));
    on(ge, 'hero-state', () => this.dock.refresh());
    on(ge, 'hero-energy', () => this.dock.refresh());
    on(ge, 'field-changed', () => this.dock.refresh());
    on(ge, 'energy-tick', this.onEnergyTick);
    on(ge, 'team-rotated', this.onRotated);
    on(ge, 'waiting', (v) => this.waitingText.setVisible(v));
    on(ge, 'stage-progress', this.onProgress);
    on(ge, 'stage-start', this.onStageStart);
    on(ge, 'stage-clear', this.onStageClear);
  }

  // Estado de um herói para mostrar na interface.
  statusOf(h) {
    const b = this.battle.field.get(h.uid);
    if (b) return b.state;
    if (this.battle.benched.has(h.uid)) return 'BENCHED';
    if (economy.capsules.includes(h.uid)) return 'CAPSULE';
    if (h.energy < BALANCE.teams.readyRatio * maxEnergy(h)) return 'RESTING';
    return 'READY';
  }

  // ---------- Topo ----------
  buildTopBar() {
    const cy = TOP_CY;
    this.topBand = ironBand(this, 0, 0, W, L.topBarH);
    // Encaixes escuros atrás dos contadores.
    Object.values(CHIPS).forEach(([x, w]) => frame(this, x, cy - 26, w, 52, 0x120a1e, 0.9).setOrigin(0).setStrokeStyle(3, COL.border));
    this.coinIcon = this.add.image(HUD.gold[0], HUD.gold[1], 'coin').setScale(4.4);
    this.goldText = txt(this, HUD.gold[0] + 26, cy, goldFull(economy.gold), 32, TXT.gold, true).setOrigin(0, 0.5);
    fit(this.goldText, GOLD_TEXT_W);
    this.crystalIcon = this.add.image(HUD.crystal[0], HUD.crystal[1], 'crystal').setScale(4.4);
    this.crystalText = txt(this, HUD.crystal[0] + 24, cy, '', 28, '#9fe8ff', true).setOrigin(0, 0.5);
    // "+" dourado: atalho para comprar gaiolas com cristais (aba Heróis).
    const px = CHIPS.crystal[0] + CHIPS.crystal[1] - 20;
    this.add.circle(px, cy, 14, 0xf0b830).setStrokeStyle(2, 0x6a3a06);
    txt(this, px, cy - 1, '+', 22, '#3a1a04', true).setOrigin(0.5);
    this.cageIcon = this.add.image(HUD.cage[0], HUD.cage[1], 'cage').setScale(3.2);
    this.cageText = txt(this, HUD.cage[0] + 26, cy, '', 28, TXT.main, true).setOrigin(0, 0.5);

    // Tocar em cristais/gaiolas abre a aba Heróis (onde se invoca).
    const shortcut = this.add.rectangle(CHIPS.crystal[0], cy - 30, CHIPS.cage[0] + CHIPS.cage[1] - CHIPS.crystal[0], 60, 0x000000, 0).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    shortcut.on('pointerup', () => this.showTab('heroes'));

    // Coroa: Passe do Minerador (Premium).
    this.crownGlow = this.add.circle(CROWN_X, cy, 26, 0xffd060, 0.22);
    this.crownIcon = this.add.image(CROWN_X, cy, 'icon_premium').setScale(3.6);
    const crownHit = this.add.rectangle(CROWN_X, cy, 60, 70, 0x000000, 0).setInteractive({ useHandCursor: true });
    crownHit.on('pointerup', () => this.premiumModal.show());
    this.tweens.add({ targets: this.crownGlow, scale: 1.35, alpha: 0.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Troféu: missões, conquistas e Abismo. A bolinha vermelha avisa que há prêmio para coletar.
    const trophy = this.add.rectangle(TROPHY_X, cy, 62, 70, 0x000000, 0).setInteractive({ useHandCursor: true });
    this.add.image(TROPHY_X, cy, 'icon_trophy').setScale(4);
    this.trophyDot = this.add.circle(TROPHY_X + 22, cy - 22, 9, 0xe0563b).setStrokeStyle(2, 0x120a1e).setVisible(false);
    trophy.on('pointerup', () => this.showTab(this.activeTab === 'goals' ? 'battle' : 'goals'));
  }

  pop(icon) {
    const base = icon === this.cageIcon ? 3.2 : 4.4;
    this.tweens.killTweensOf(icon);
    icon.setScale(base * 1.2);
    this.tweens.add({ targets: icon, scale: base, duration: 120 });
  }

  // ---------- Faixa da fase ----------
  // Lugar e fase à esquerda, barra de objetos no meio, estrelas e cronômetro à direita.
  buildStageBar() {
    const y0 = L.stageBarY;
    frame(this, 0, y0, W, L.stageBarH, 0x160b24).setOrigin(0).setStrokeStyle(2, 0x5a3408);
    // Tocar no lugar/fase abre o Mapa (o Mapa saiu da barra fixa e foi para o ☰ Mais).
    this.add.image(27, y0 + 18, 'icon_map').setScale(1.5);
    this.zoneText = txt(this, 42, y0 + 18, '', 15, TXT.dim).setOrigin(0, 0.5);
    const mapHit = this.add.rectangle(0, y0, 246, L.stageBarH, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    mapHit.on('pointerup', () => {
      if (this.subGroup) return;              // sub-abas por cima da faixa
      Sfx.play('click');
      this.showTab(this.activeTab === 'map' ? 'battle' : 'map');
    });
    this.stageText = txt(this, 18, y0 + 46, '', 25, TXT.main, true).setOrigin(0, 0.5);
    this.diffBg = this.add.rectangle(0, y0 + 47, 60, 24, DIFF_CHIP[0]).setOrigin(0, 0.5);
    this.diffText = txt(this, 0, y0 + 47, '', 14, '#12081c', true).setOrigin(0, 0.5);
    // Barra de objetos destruídos.
    const bx = 252, bw = 250;
    frame(this, bx, y0 + 18, bw, 30, 0x0c0614, 1).setOrigin(0).setStrokeStyle(2, 0x7a5418);
    this.progressFill = this.add.rectangle(bx + 3, y0 + 21, bw - 6, 24, COL.gold).setOrigin(0);
    this.progressFill.scaleX = 0;
    this.progressText = txt(this, bx + bw / 2, y0 + 33, '', 15, TXT.main, true).setOrigin(0.5).setStroke('#12081c', 4);
    // Estrelas + cronômetro (ou o relógio do Chefe / Colosso / Abismo).
    this.starIcons = [0, 1, 2].map((k) => this.add.image(W - 120 + k * 22, y0 + 22, 'star').setScale(2.2));
    this.timerText = txt(this, W - 16, y0 + 22, '', 22, TXT.main, true).setOrigin(1, 0.5);
    this.timerSub = txt(this, W - 16, y0 + 48, '', 14, TXT.dim).setOrigin(1, 0.5);
    this.buildSubTabs();
  }

  // Sub-abas (Itens: Inventário · Ritual / Base: Casa · Habilidades · Mercado): cobrem a faixa da fase.
  buildSubTabs() {
    this.subBar = this.add.container(0, L.stageBarY).setDepth(150).setVisible(false);
    this.subBar.add(frame(this, 0, 0, W, L.stageBarH, 0x160b24).setOrigin(0).setStrokeStyle(2, 0x5a3408));
    this.subChips = [];
  }

  showSubTabs(group) {
    const nav = NAV.find((n) => n.id === group);
    const kids = nav && !nav.noSub && nav.kids.length > 1 ? nav.kids : null;
    if (!kids) { this.subBar.setVisible(false); this.subGroup = null; return; }
    if (this.subGroup !== group) {
      this.subGroup = group;
      this.subChips.forEach((c) => c.parts.forEach((o) => o.destroy()));
      const gap = 10, n = kids.length;
      const cw = (W - 28 - gap * (n - 1)) / n;
      this.subChips = kids.map((id, i) => {
        const x = 14 + i * (cw + gap);
        const bg = frame(this, x, 10, cw, 48, 0x120a1e).setOrigin(0).setStrokeStyle(3, 0x7a5418);
        const [ic, sc] = KID_ICON[id];
        const icon = this.add.image(x + 30, 34, ic).setScale(sc * 0.62);
        const label = txt(this, x + 54, 34, STR.tabs[id], 19, TXT.main, true).setOrigin(0, 0.5);
        fit(label, cw - 70);
        const lock = this.add.image(x + cw - 16, 16, 'icon_lock').setScale(2.4);
        const dot = this.add.circle(x + cw - 10, 14, 8, 0xe0563b).setStrokeStyle(2, 0x120a1e).setVisible(false);
        bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (!tabUnlocked(id)) { this.toast.show(STR.tabLocked(STR.tabs[id], BALANCE.unlocks[id]), 2000); return; }
          if (this.activeTab !== id) { Sfx.play('click'); this.showTab(id); }
        });
        const parts = [bg, icon, label, lock, dot];
        this.subBar.add(parts);
        return { id, bg, icon, label, lock, dot, parts };
      });
    }
    this.subBar.setVisible(true);
    this.refreshSubTabs();
  }

  refreshSubTabs() {
    if (!this.subGroup) return;
    for (const c of this.subChips) {
      const open = tabUnlocked(c.id);
      const on = this.activeTab === c.id;
      c.bg.setFillStyle(on ? 0xf0b830 : 0x120a1e).setStrokeStyle(3, on ? 0x6a3a06 : 0x7a5418);
      c.label.setColor(on ? '#3a1a04' : open ? TXT.main : TXT.dim);
      c.icon.setAlpha(open ? 1 : 0.4);
      c.lock.setVisible(!open);
      c.dot.setVisible(!!this.badgeState?.[c.id] && !on);
    }
  }

  // ---------- Menu de baixo (5 abas) ----------
  buildTabs() {
    ensureMenuIcon(this);
    // O menu fica fixo por cima dos painéis (eles sobem por trás dele) e abaixo das janelas.
    // É um painel separado (com margem), e tudo dentro fica centrado; o botão da Batalha não sai para fora.
    const TAB_DEPTH = 200;
    const y0 = L.tabsY;
    const T = y0 + 10;                       // topo do painel
    const H = L.tabsH - 10 - 18;             // altura (sobra embaixo para a barra de gestos do celular)
    const C = T + H / 2;                     // meio do painel
    this.add.rectangle(0, y0, W, L.tabsH, 0x0e0716).setOrigin(0).setDepth(TAB_DEPTH);
    this.navPanel = frame(this, 8, T, W - 16, H, COL.panel).setOrigin(0).setStrokeStyle(4, 0xa87a20).setDepth(TAB_DEPTH);
    const tw = (W - 16) / NAV.length;
    this.tabViews = {};
    this.lastKid = { items: 'inventory', base: 'house' };
    NAV.forEach((t, i) => {
      const x0 = 8 + tw * i;
      const cx = x0 + tw / 2;
      const parts = [];
      let icon, hl = null, bar = null, ring = null;
      const hasSub = !!STR.tabSub[t.id];
      if (t.center) {
        // Batalha: botão redondo, inteiro dentro do painel.
        ring = this.add.circle(cx, C - 14, 46, 0x4a1a88).setStrokeStyle(5, 0xffd86a);
        const glow = this.add.circle(cx, C - 20, 32, 0x8a4ad8, 0.55);
        icon = this.add.image(cx, C - 16, t.icon).setScale(t.scale * 0.85);
        parts.push(ring, glow);
        this.battleGlow = glow;
      } else {
        hl = this.add.rectangle(x0 + 5, T + 7, tw - 10, H - 14, COL.tabActive, 0.55).setOrigin(0).setVisible(false);
        bar = this.add.rectangle(x0 + 16, T + 5, tw - 32, 5, 0xffd86a).setOrigin(0).setVisible(false);
        icon = this.add.image(cx, C - (hasSub ? 22 : 16), t.icon).setScale(t.scale);
        parts.push(hl, bar);
      }
      const ly = t.center ? C + 48 : C + (hasSub ? 30 : 36);
      const label = txt(this, cx, ly, STR.tabs[t.id], 19, TXT.main, true).setOrigin(0.5);
      fit(label, tw - 10);
      const sub = hasSub ? txt(this, cx, C + 52, STR.tabSub[t.id], 11, TXT.dim).setOrigin(0.5) : null;
      if (sub) fit(sub, tw - 8);
      const lock = this.add.image(cx + 28, C - 44, 'icon_lock').setScale(3).setVisible(false);
      const hit = this.add.rectangle(x0, T, tw, H, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.tapNav(t));
      const dot = this.add.circle(cx + (t.center ? 38 : 30), C - (t.center ? 52 : 44), 10, 0xe0563b).setStrokeStyle(2, 0x120a1e).setVisible(false);
      [...parts, icon, label, sub, lock, hit, dot].filter(Boolean).forEach((o) => o.setDepth(TAB_DEPTH));
      this.tabViews[t.id] = { hl, bar, ring, dot, icon, label, sub, lock, cx, center: !!t.center };
    });
    // Seta que aponta a aba da tarefa atual da Jornada (ou a aba recém-liberada).
    this.tabArrow = this.add.triangle(0, y0 - 14, 0, 0, 36, 0, 18, 22, COL.gold).setStrokeStyle(3, 0x120a1e)
      .setDepth(TAB_DEPTH + 1).setVisible(false);
    this.tweens.add({ targets: this.tabArrow, y: y0 - 28, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.refreshTabLocks();
    this.highlightTab('battle');
  }

  navUnlocked(navId) {
    const n = NAV.find((x) => x.id === navId);
    return !n || n.kids.some((k) => k === 'battle' || tabUnlocked(k));
  }

  tapNav(t) {
    if (t.id === 'battle') { this.showTab('battle'); return; }
    if (PARENT[this.activeTab] === t.id) { this.showTab(t.id === 'more' && this.activeTab !== 'more' ? 'more' : 'battle'); return; }   // tocar de novo fecha (no ☰, volta à grade)
    if (t.id === 'more') { this.showTab('more'); return; }
    const open = t.kids.filter((k) => tabUnlocked(k));
    if (!open.length) {
      const k = t.kids[0];
      this.toast.show(STR.tabLocked(STR.tabs[k], BALANCE.unlocks[k]), 2000);
      return;
    }
    const last = this.lastKid[t.id];
    this.showTab(last && tabUnlocked(last) ? last : open[0]);
  }

  // Cadeado e cor das abas que ainda não abriram.
  refreshTabLocks() {
    for (const [id, v] of Object.entries(this.tabViews)) {
      const open = this.navUnlocked(id);
      v.icon.setAlpha(open ? 1 : 0.35);
      if (!v.center) v.label.setColor(open ? TXT.main : TXT.dim);
      v.lock.setVisible(!open);
    }
    this.refreshSubTabs();
  }

  pointTab(id) {
    const nav = id && PARENT[id];
    const v = nav && this.tabViews[nav];
    if (!v || !tabUnlocked(id) || this.activeTab === id) { this.tabArrow.setVisible(false); return; }
    this.tabArrow.setX(v.cx - 18).setVisible(true);
  }

  highlightTab(id) {
    const nav = id ? PARENT[id] ?? id : null;
    for (const [tid, v] of Object.entries(this.tabViews)) {
      const on = tid === nav;
      if (v.center) {
        v.ring.setStrokeStyle(5, on ? 0xffd86a : 0x9a7a40).setFillStyle(on ? 0x5a2aa8 : 0x2a1846);
        this.battleGlow.setAlpha(on ? 0.55 : 0.15);
        v.icon.setAlpha(on ? 1 : 0.8);
        v.label.setColor(on ? TXT.gold : TXT.main);
      } else {
        v.hl.setVisible(on);
        v.bar.setVisible(on);
        if (this.navUnlocked(tid)) v.label.setColor(on ? TXT.gold : TXT.main);
      }
    }
  }

  // 'battle' fecha todos os painéis. Painéis de um grupo (Itens/Base) mostram as sub-abas na faixa da fase.
  showTab(id) {
    if (PARENT[id] && id !== 'battle' && !tabUnlocked(id)) return;
    this.activeTab = id;
    for (const [pid, p] of Object.entries(this.panels)) {
      if (pid === id) p.open();
      else p.close();
    }
    const nav = PARENT[id];
    if (nav && this.lastKid[nav] !== undefined) this.lastKid[nav] = id;
    this.showSubTabs(nav);
    this.highlightTab(nav ? id : id === 'battle' ? 'battle' : null);
  }

  // ---------- Banner de fim de fase ----------
  buildBanner() {
    const cy = L.arenaY + L.arenaH / 2;
    this.banner = this.add.container(W / 2, cy).setDepth(50).setVisible(false);
    const bg = frame(this, 0, 0, 560, 290, 0x120a1e, 0.92).setStrokeStyle(5, COL.gold);
    this.bannerTitle = txt(this, 0, -92, STR.stageClear, 48, TXT.gold, true).setOrigin(0.5).setStroke('#12081c', 8);
    this.bannerStars = [-64, 0, 64].map((x) => this.add.image(x, -26, 'star_empty').setScale(6));
    this.bannerGold = txt(this, 0, 34, '', 32, TXT.main, true).setOrigin(0.5);
    this.bannerExtra = txt(this, 0, 86, '', 24, '#9fe8ff', true).setOrigin(0.5);
    this.banner.add([bg, this.bannerTitle, ...this.bannerStars, this.bannerGold, this.bannerExtra]);

    // Objetos, estrelas e cronômetro ficam na faixa da fase (o campo fica limpo).
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.updateArenaInfo() });
    this.buildObjectiveBar();
  }

  // ---------- Jornada do Mineiro / próximo objetivo ----------
  buildObjectiveBar() {
    // Fica no topo do painel da equipe, logo abaixo do campo. Toque leva à tarefa (ou coleta o prêmio).
    const y = L.dockY + 12 + L.objH / 2;
    const bw = W - 28;
    this.objBar = this.add.container(W / 2, y).setDepth(45);
    this.objBg = frame(this, 0, 0, bw, L.objH, 0x120a1e, 0.92).setStrokeStyle(3, COL.border);
    this.objIcon = this.add.image(-bw / 2 + 28, 0, 'star').setScale(3.2);
    this.objText = txt(this, -bw / 2 + 54, 0, '', 19, TXT.main, true).setOrigin(0, 0.5);
    this.objCount = txt(this, bw / 2 - 40, 0, '', 18, TXT.gold, true).setOrigin(1, 0.5);
    this.objArrow = txt(this, bw / 2 - 16, -1, '›', 28, TXT.gold, true).setOrigin(0.5);
    this.objBar.add([this.objBg, this.objIcon, this.objText, this.objCount, this.objArrow]);
    this.objBg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onObjectiveTap());
    this.goalIdx = 0;
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.safeObjective() });
    this.time.addEvent({ delay: 6000, loop: true, callback: () => { this.goalIdx += 1; } });
    this.time.delayedCall(0, () => this.safeObjective());
  }

  // Um erro na barra de objetivo nunca pode travar o jogo (o laço do Phaser para no primeiro erro).
  safeObjective() {
    try { this.updateObjective(); }
    catch (e) { if (!this.objErrLogged) { this.objErrLogged = true; console.error(e); } }
  }

  updateObjective() {
    if (!this.objBar) return;
    const step = journeyStep();
    const busy = this.rewardModal?.isOpen || this.summonModal?.isOpen || this.loginModal?.isOpen || this.premiumModal?.isOpen || this.passModal?.isOpen
      || this.tips?.isOpen || this.title?.visible;
    if (this.premiumOn !== premiumActive()) this.applyPremiumLook();
    // Cristais do dia do Passe do Minerador.
    if (!busy && this.welcomeDone && !this.detail?.isOpen && !loginAvailable() && premiumDailyAvailable()) {
      const n = claimPremiumDaily();
      SaveSystem.save(economy);
      Sfx.play('reward');
      this.rewardModal.show({ top: { icon: 'icon_premium', size: 200 }, ribbon: 'gold', title: STR.premiumDailyTitle, subtitle: STR.premiumDailySub,
        items: [{ icon: 'crystal', text: STR.premiumDailyItem(n), color: '#9fe8ff' }] });
      return;
    }
    // Aba nova: comemora assim que a tela estiver livre.
    if (!busy && this.welcomeDone && !this.detail?.isOpen && loginAvailable()) {
      this.loginModal.show();
      return;
    }
    if (!busy) {
      const fresh = newlyUnlockedTabs();
      if (fresh.length) { this.celebrateUnlock(fresh[0]); return; }
      const team = economy.freshTeams()[0];
      if (team) { this.celebrateTeam(team); return; }
    }
    if (step) {
      const done = stepComplete(step);
      const [cur, target] = step.count();
      const task = STR.journeyTasks[step.id];
      fit(this.objText.setText(done ? STR.journeyReady : STR.journeyBar(economy.journeyStep + 1, JOURNEY.length, task)), W - 190);
      this.objText.setColor(done ? TXT.gold : TXT.main);
      this.objCount.setText(done ? '' : target > 1 ? `${Math.min(cur, target)}/${target}` : '');
      this.objIcon.setTexture(done ? 'ui_chest' : 'star').setScale(done ? 1.7 : 3);
      if (done && !this.objPulse) {
        this.objPulse = this.tweens.add({ targets: this.objBar, scale: 1.025, duration: 380, yoyo: true, repeat: -1 });
        this.objBg.setStrokeStyle(3, COL.gold);
      } else if (!done && this.objPulse) {
        this.objPulse.stop(); this.objPulse = null; this.objBar.setScale(1); this.objBg.setStrokeStyle(3, COL.border);
      }
      if (!this.arrowHold) this.pointTab(done ? null : step.hint);
      return;
    }
    if (this.objPulse) { this.objPulse.stop(); this.objPulse = null; this.objBar.setScale(1); this.objBg.setStrokeStyle(3, COL.border); }
    const goals = nextGoals();
    this.objIcon.setTexture('star');
    this.objText.setColor(TXT.main);
    this.objCount.setText('');
    fit(this.objText.setText(goals.length ? goals[this.goalIdx % goals.length] : ''), W - 130);
    if (!this.arrowHold) this.tabArrow.setVisible(false);
  }

  onObjectiveTap() {
    const step = journeyStep();
    if (!step) return;
    if (!stepComplete(step)) {
      if (step.hint && tabUnlocked(step.hint)) this.showTab(step.hint);
      return;
    }
    const r = claimStep();
    if (!r) return;
    SaveSystem.save(economy);
    Sfx.play('reward');
    this.cameras.main.flash(160, 255, 220, 120);
    const items = [];
    if (r.reward.gold) items.push({ icon: 'coin', text: STR.rewardGold(fmt(r.reward.gold)), color: TXT.gold });
    if (r.reward.crystals) items.push({ icon: 'crystal', text: STR.rewardCrystals(r.reward.crystals), color: '#9fe8ff' });
    if (r.reward.cages) items.push({ icon: 'cage', scale: 3, text: `${r.reward.cages} gaiola${r.reward.cages > 1 ? 's' : ''}`, color: TXT.good });
    if (r.reward.sealed) items.push({ icon: 'sealed', scale: 4, text: STR.rewardSealed(r.reward.sealed), color: '#e8c890' });
    const next = journeyStep();
    const sub = next ? STR.journeyNext(STR.journeyTasks[next.id]) : STR.journeyDoneSub;
    const title = next ? STR.journeyClaimTitle(r.index, JOURNEY.length) : STR.journeyDoneTitle;
    this.rewardModal.show({ top: { icon: 'star', size: 190 }, ribbon: 'blue', title, subtitle: sub, items });
  }

  // Equipe nova liberada (Chefe vencido): comemora uma vez.
  celebrateTeam(t) {
    economy.teamsSeen.push(t);
    SaveSystem.save(economy);
    Sfx.play('fanfare');
    this.cameras.main.flash(220, 255, 230, 150);
    this.rewardModal.show({
      top: { icon: 'ui_heroes', size: 190 }, ribbon: 'blue',
      title: STR.teamUnlockTitle,
      subtitle: STR.teamUnlockDesc(t),
      items: [{ icon: 'ui_heroes', scale: 4, text: STR.teamUnlockItem(t), color: TXT.gold }],
    });
  }

  celebrateUnlock(id) {
    markTabSeen(id);
    SaveSystem.save(economy);
    this.refreshTabLocks();
    Sfx.play('reward');
    this.cameras.main.flash(220, 255, 230, 150);
    this.rewardModal.show({
      top: { icon: KID_ICON[id]?.[0] ?? 'star', size: 190 }, ribbon: 'blue',
      title: STR.unlockTitle,
      subtitle: STR.unlockDesc[id],
      items: [{ icon: KID_ICON[id]?.[0] ?? 'star', scale: (KID_ICON[id]?.[1] ?? 3) + 1, text: STR.tabs[id], color: TXT.gold }],
    }, () => {
      // A seta fica apontando a aba nova por alguns segundos.
      this.arrowHold = true;
      this.pointTab(id);
      this.time.delayedCall(6000, () => { this.arrowHold = false; });
    });
  }

  updateArenaInfo() {
    this.updatePowerInfo();
    const b = this.battle;
    const g = b.grid;
    const clock = (sec) => {
      const t = Math.max(0, Math.floor(sec));
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };
    const stars = (n) => this.starIcons.forEach((st, k) => st.setVisible(n > 0).setTexture(k < n ? 'star' : 'star_empty'));
    const right = (title, color, sub) => {
      this.timerText.setText(title).setColor(color);
      this.timerSub.setText(sub || '');
      // As estrelas ficam logo à esquerda do relógio.
      const x = this.timerText.x - this.timerText.displayWidth - 14;
      this.starIcons.forEach((st, k) => st.setX(x - (2 - k) * 22));
    };
    this.progressText.setText(STR.progressObjects(g.total - g.remaining, g.total));
    if (economy.mode === 'colossus') {
      stars(0);
      this.progressText.setText(STR.colossusDmgShort(fmt(Math.round(b.colossusDamage || 0))));
      const t = Math.max(0, Math.ceil(b.colossusTime ?? 0));
      right(clock(t), t <= 20 ? TXT.bad : '#ff9aa8', STR.colossusWeekBest(fmt(economy.stats.colossusWeekBest)));
      return;
    }
    if (economy.mode === 'endless') {
      stars(0);
      const t = Math.max(0, Math.ceil(b.endlessTime ?? 0));
      right(clock(t), t <= 20 ? TXT.bad : '#c8b0ff', STR.modeTimerSub);
      return;
    }
    if (economy.mode !== 'campaign') { stars(0); right('', TXT.main, ''); return; }
    if (b.boss) {
      stars(0);
      right(STR.bossClockTitle(clock(b.bossTime)), b.bossTime <= 30 ? TXT.bad : '#ffa0d8', STR.bossClockSub);
      return;
    }
    if (b.stageClearing) return;
    const e = b.stageElapsed();
    const [p3, p2] = b.starPars();
    if (e <= p3) { stars(3); right(clock(e), TXT.main, STR.starGoal(3, clock(p3))); }
    else if (e <= p2) { stars(2); right(clock(e), TXT.main, STR.starGoal(2, clock(p2))); }
    else { stars(1); right(clock(e), TXT.dim, STR.starGoal(1)); }
  }

  // Bolinhas vermelhas nas abas quando há algo para fazer.
  updateBadges() {
    if (!this.tabViews) return;
    const field = new Set(this.battle.field.keys());
    const has = {
      heroes: (economy.cages > 0 && !economy.rosterFull()) || economy.heroes.some((h) => abilityPointsAvailable(h) > 0),
      inventory: economy.sealed.length > 0,
      forge: gemStacks().some((g) => canMerge(g.key))
        || recipes(field).some((r) => r.have >= r.need && canCombine(r, field)),
      skills: TREE.some((n) => canBuyNode(n.id)),
      map: canOpenChest(),
      house: readyCount() > 0,
    };
    for (const k of Object.keys(has)) if (!tabUnlocked(k)) has[k] = false;
    this.badgeState = has;
    for (const n of NAV) this.tabViews[n.id]?.dot.setVisible(n.kids.some((k) => has[k]));
    this.refreshSubTabs();
    this.updateRail();
  }

  // ---------- ☰ Mais: atalhos para o resto do jogo ----------
  buildMorePanel() {
    const premTxt = () => (premiumActive() ? STR.moreSub.premiumOn(premiumDaysLeft()) : STR.moreSub.premiumOff);
    const tiles = [
      { id: 'map', icon: 'icon_map', scale: 5.2, label: STR.tabs.map, sub: () => STR.moreSub.map, dot: () => !!this.badgeState?.map, onTap: () => this.showTab('map') },
      { id: 'clan', draw: (s, x, y) => drawShield(s, x, y, 72), label: STR.clanTitle, sub: () => STR.moreSub.clan, onTap: () => this.showTab('clan') },
      { id: 'goals', icon: 'icon_trophy', scale: 5.2, label: STR.moreGoals, sub: () => STR.moreSub.goals, dot: () => claimableCount() > 0, onTap: () => this.showTab('goals') },
      { id: 'pass', icon: 'star', draw: (s, x, y) => {
        const img = s.add.image(x, y, 'star').setDisplaySize(84, 84);
        if (s.textures.exists('season_parts') && s.textures.get('season_parts').has('badge')) img.setTexture('season_parts', 'badge').setDisplaySize(86, 86);
        return img;
      }, label: STR.morePass, sub: () => STR.moreSub.pass(passLevel().level), dot: () => passClaimable() > 0, onTap: () => this.passModal.show() },
      { id: 'premium', icon: 'icon_premium', scale: 4.8, label: STR.morePremium, sub: premTxt, onTap: () => this.premiumModal.show() },
      { id: 'records', icon: 'icon_trophy', scale: 4.2, draw: (s, x, y) => s.add.image(x, y, 'star').setScale(4.4), label: STR.moreRecords, sub: () => STR.moreSub.records,
        onTap: () => { this.showTab('goals'); this.panels.goals.showView('abyss'); } },
      { id: 'settings', icon: 'icon_gear', scale: 5, label: STR.settingsTitle, sub: () => STR.moreSub.settings, onTap: () => this.showTab('settings') },
      { id: 'fullscreen', draw: (s, x, y) => drawFullscreenIcon(s, x, y, 1.1), label: STR.moreFullscreen,
        sub: () => (this.scale.isFullscreen ? STR.moreSub.fsOff : STR.moreSub.fsOn), onTap: () => this.toggleFullscreen() },
      { id: 'friends', icon: 'ui_heroes', scale: 4.4, label: STR.moreFriends, soon: true },
      { id: 'events', icon: 'ui_chest', scale: 4.8, label: STR.moreEvents, soon: true },
      { id: 'shop', icon: 'crystal', scale: 5.2, label: STR.moreShop, soon: true },
      { id: 'ranking', icon: 'icon_trophy', scale: 5, label: STR.moreRanking, sub: () => STR.moreSub.ranking, onTap: () => this.showTab('ranking') },
    ];
    return new MorePanel(this, { onClose: () => this.showTab('battle'), tiles });
  }

  // ---------- Configurações ----------
  buildSettingsPanel() {
    const panel = new Panel(this, STR.settingsTitle, () => this.showTab('battle'));
    const info = txt(this, 24, 120, STR.autosaveInfo, 22, TXT.dim).setWordWrapWidth(W - 48);
    let armed = false;
    let disarmTimer = null;
    let soundBtn = null;
    const resetBtn = new Button(this, W / 2, 260, W - 120, 100, STR.resetButton, () => {
      if (!armed) {
        armed = true;
        resetBtn.setLabel(STR.resetConfirm).setColors(COL.danger, COL.dangerBorder);
        disarmTimer = this.time.delayedCall(3000, () => {
          armed = false;
          resetBtn.setLabel(STR.resetButton).setColors(COL.card, COL.border);
        });
        return;
      }
      armed = false;
      disarmTimer?.remove(false);
      resetBtn.setLabel(STR.resetButton).setColors(COL.card, COL.border);
      SaveSystem.clear();
      economy.reset();
      Sfx.setMuted(false);
      soundBtn?.setLabel(STR.soundOn);
      ensureDaily();
      SaveSystem.save(economy);
      this.battle.restartRun();
      this.showTab('battle');
      this.toast.show(STR.resetDone);
    }, { fontSize: 26, color: COL.card, border: COL.border });
    soundBtn = new Button(this, W / 2, 400, W - 120, 84, economy.muted ? STR.soundOff : STR.soundOn, () => {
      economy.muted = !economy.muted;
      Sfx.setMuted(economy.muted);
      soundBtn.setLabel(economy.muted ? STR.soundOff : STR.soundOn);
      SaveSystem.save(economy);
    }, { fontSize: 26, color: COL.card, border: COL.border });
    this.fsSettingsBtn = new Button(this, W / 2, 520, W - 120, 84, this.scale.isFullscreen ? STR.fullscreenOff : STR.fullscreenOn,
      () => this.toggleFullscreen(), {
        fontSize: 26, color: COL.card, border: COL.border,
        onDisabledClick: () => this.toast.show(STR.fullscreenNo, 3200),
      });
    if (!this.fullscreenAvailable()) this.fsSettingsBtn.setEnabled(false);
    // Conta do beta: sair / excluir, ou entrar para levar o progresso para a nuvem.
    const accItems = [];
    if (Cloud.online) {
      accItems.push(txt(this, W / 2, 632, STR.account(Cloud.profile?.nickname || '—'), 20, TXT.dim).setOrigin(0.5));
      accItems.push(new Button(this, W / 2 - 150, 700, 280, 76, STR.accountLogout, async () => {
        SaveSystem.save(economy);
        await Cloud.signOut();
        window.location.reload();
      }, { fontSize: 22, color: COL.card, border: COL.border }));
      let armedDel = false;
      const delBtn = new Button(this, W / 2 + 150, 700, 280, 76, STR.accountDelete, async () => {
        if (!armedDel) {
          armedDel = true;
          delBtn.setLabel(STR.accountDeleteConfirm).setColors(COL.danger, COL.dangerBorder);
          this.time.delayedCall(3000, () => { armedDel = false; delBtn.setLabel(STR.accountDelete).setColors(COL.card, COL.border); });
          return;
        }
        const key = BALANCE.save.key;
        try { await Cloud.deleteAccount(); } catch (e) { this.toast.show(STR.accountDeleteFail, 3000); return; }
        try { localStorage.removeItem(key); } catch (e) { /* ok */ }
        window.location.reload();
      }, { fontSize: 20, color: COL.card, border: COL.border });
      accItems.push(delBtn);
    } else {
      accItems.push(txt(this, W / 2, 632, STR.accountGuest, 20, TXT.dim).setOrigin(0.5));
      accItems.push(new Button(this, W / 2, 700, W - 120, 76, STR.accountLogin, () => {
        SaveSystem.save(economy);
        try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* ok */ }
        window.location.reload();
      }, { fontSize: 24, color: COL.card, border: COL.border }));
    }
    panel.add(accItems);
    // Teste de fase: recarrega o jogo numa cópia do save, já na fase escolhida (o save real fica intacto).
    // Uma linha por mundo: começo de cada zona (fases 1, 9, 17) e o chefe (24).
    const MODE = 'bomba-rural-modo';
    const startTest = (w, st) => {
      try {
        if (!window.__TEST_BOSS) {
          SaveSystem.save(economy);
          const real = localStorage.getItem(BALANCE.save.key);
          if (real) localStorage.setItem(BALANCE.save.testKey, real);
        }
        localStorage.setItem(MODE, JSON.stringify({ w, s: st }));
      } catch (e) { return; }
      window.location.reload();
    };
    const testItems = [];
    let ty = 790;
    // No beta as ferramentas de teste ficam escondidas (aparecem com ?teste na URL).
    const showTests = !ONLINE.beta || /[?&]teste\b/.test(window.location.search) || window.__TEST_BOSS;
    if (window.__TEST_BOSS) {
      testItems.push(new Button(this, W / 2, ty, W - 120, 80, STR.testBossExit, () => {
        try { localStorage.removeItem(MODE); } catch (e) { return; }
        window.location.reload();
      }, { fontSize: 24, color: COL.danger, border: COL.dangerBorder }));
      ty += 90;
    }
    testItems.push(txt(this, W / 2, ty, STR.testTitle, 20, TXT.dim).setOrigin(0.5).setWordWrapWidth(W - 80).setAlign('center'));
    ty += 50;
    const per = economy.spw / BALANCE.stage.zonesPerWorld;
    WORLDS.forEach((wd, w) => {
      const y = ty + w * 92;
      testItems.push(txt(this, 60, y, wd.name, 21, TXT.main).setOrigin(0, 0.5).setWordWrapWidth(190));
      const opts = [...ZONES[w].map((z, zi) => [z.name, zi * per + 1]), [STR.testBoss, economy.spw]];
      opts.forEach(([label, st], k) => {
        const b = new Button(this, 300 + k * 104, y, 98, 76, label, () => startTest(w, st),
          { fontSize: label.length > 9 ? 14 : 16, color: k === 3 ? COL.danger : COL.card, border: k === 3 ? COL.dangerBorder : COL.border });
        testItems.push(b);
      });
    });
    if (!showTests) testItems.forEach((o) => o.destroy());
    panel.add([info, resetBtn, soundBtn, this.fsSettingsBtn, ...(showTests ? testItems : [])]);
    return panel;
  }

  // ---------- Ações ----------
  doSummon() {
    if (economy.legendCages > 0 && !economy.rosterFull()) {
      const legend = summonLegend();
      if (legend) {
        economy.legendCages -= 1;
        SaveSystem.save(economy);
        this.summonModal.play(legend, { title: STR.legendCageTitle, cageTint: 0xf0923a });
        return;
      }
    }
    const hero = summon();
    if (!hero) { this.toast.show(STR.noCages); return; }
    SaveSystem.save(economy);
    this.summonModal.play(hero);
  }

  // Faixa "Hoje" do painel da equipe: missão do dia e desafios (Colosso, Abismo, Passe).
  todayInfo() {
    ensureDaily();
    const ms = economy.daily.missions;
    const views = ms.map((m, i) => missionView(i));
    let idx = views.findIndex((v) => v && v.done && !v.claimed);
    if (idx < 0) idx = views.findIndex((v) => v && !v.claimed);
    let mission;
    if (idx >= 0) {
      const v = views[idx];
      const title = STR.todayMission(idx + 1, ms.length);
      mission = v.done
        ? { icon: 'ui_chest', scale: 1.6, title, main: STR.todayReady, count: `${v.target}/${v.target}`, ratio: 1, ready: true }
        : { icon: 'icon_trophy', scale: 3.2, title, main: v.def.text(v.target), count: `${v.progress}/${v.target}`, ratio: v.progress / v.target };
    } else if (bonusReady()) {
      mission = { icon: 'ui_chest', scale: 1.6, title: STR.todayBonusTitle, main: STR.todayBonusReady, ratio: 1, ready: true };
    } else {
      const m = Math.ceil(msToReset() / 60000);
      mission = { icon: 'icon_trophy', scale: 3.2, title: STR.todayDone, main: STR.todayRenew(m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`), ratio: 1 };
    }
    const challenges = [];
    if (economy.endlessUnlocked()) {
      const C = BALANCE.colossus.attemptsPerDay;
      const left = this.battle.colossusTriesLeft();
      challenges.push({ kind: 'colossus', icon: 'ui_bomb', scale: 2.6, title: STR.colossusZone, main: STR.todayTries(left), ratio: left / C });
      const cap = BALANCE.endless.essenceDailyCap;
      const used = cap - abyssEssenceLeft();
      challenges.push({ kind: 'abyss', icon: 'star', scale: 3.2, title: STR.abyssName, main: STR.todayEssence(used, cap), ratio: used / cap });
    }
    const pl = passLevel();
    const n = passClaimable();
    const badge = this.textures.exists('season_parts') && this.textures.get('season_parts').has('badge');
    challenges.push({
      kind: 'pass', icon: badge ? 'season_parts' : 'star', iconFrame: badge ? 'badge' : null, scale: 3.2,
      title: STR.todayPass, main: STR.todayPassLine(pl.level, n), ratio: pl.max ? 1 : pl.into / Math.max(1, pl.need), ready: n > 0,
    });
    return { mission, challenges };
  }

  doBuyCage() {
    if (buyCage()) { SaveSystem.save(economy); this.toast.show(STR.cageBought, 1200); }
  }

  doBuyPower() {
    if (economy.buyPower()) { SaveSystem.save(economy); this.toast.show(STR.upgraded(economy.powerLevel), 1200); }
  }

  doBuyCapsule() {
    const cost = economy.capsuleCost();
    if (cost === null) return;
    if (economy.buyCapsule()) { SaveSystem.save(economy); this.toast.show(STR.capsuleUnlocked, 1200); }
    else this.toast.show(STR.notEnoughGold, 1200);
  }

  doReveal() {
    const r = revealSealed();
    if (r.error === 'full') { this.toast.show(STR.inventoryFull, 2000); return; }
    if (r.error) { this.toast.show(STR.noSealed, 2400); return; }
    SaveSystem.save(economy);
    this.itemDetail.show(r.item, STR.newItem, { fromReveal: true });
  }

  // Passe do Minerador: revela todos os lacrados que couberem no inventário e mostra um resumo por raridade.
  doRevealAll() {
    if (!premiumActive()) return;
    const got = [];
    for (let k = 0; k < 500; k++) {
      const r = revealSealed();
      if (!r.item) break;
      got.push(r.item);
    }
    this.itemDetail.close();
    if (!got.length) { this.toast.show(economy.sealed.length ? STR.inventoryFull : STR.noSealed, 2000); return; }
    SaveSystem.save(economy);
    Sfx.play('reward');
    const items = [];
    for (let rar = RARITY_NAMES.length - 1; rar >= 0 && items.length < 5; rar--) {
      const list = got.filter((it) => it.rarity === rar);
      if (!list.length) continue;
      const best = list.reduce((a, b) => (itemPower(b) > itemPower(a) ? b : a));
      items.push({ icon: itemIcon(best), scale: 4, text: STR.revealAllRow(list.length, RARITY_NAMES[rar]), color: RARITY_TEXT[rar] });
    }
    const left = economy.sealed.length;
    const subtitle = STR.revealAllCount(got.length) + (left ? `\n${STR.revealAllLeft(left)}` : '');
    this.rewardModal.show({ top: { icon: 'sealed', size: 200 }, title: STR.revealAllTitle, subtitle, items });
  }

  doSalvageCommons() {
    const r = salvageCommons();
    if (!r.count) { this.toast.show(STR.noCommons, 1400); return; }
    SaveSystem.save(economy);
    this.toast.show(STR.salvagedCommons(r.count, fmt(r.gold)), 1800);
  }

  doCollectExpedition(i) {
    const r = collectExpedition(i);
    if (!r) return;
    SaveSystem.save(economy);
    Sfx.play('reward');
    const items = [
      { icon: 'coin', text: STR.rewardGold(fmt(r.gold)), color: TXT.gold },
      { icon: 'crystal', text: STR.rewardCrystals(r.crystals), color: '#9fe8ff' },
    ];
    if (r.essence) items.push({ icon: 'star', text: `${r.essence} essência`, color: '#c8b0ff' });
    r.gemKeys.forEach((k) => items.push({ icon: `gem_${k.split(':')[0]}`, text: gemLabel(k), color: '#ffa0d8' }));
    if (r.sealed) items.push({ icon: 'sealed', scale: 4, text: `${r.sealed} lacrado`, color: '#e8c890' });
    this.rewardModal.show({ top: { icon: 'icon_map', size: 190 }, ribbon: 'green', title: STR.expCollected(r.hero?.name ?? ''), items: items.slice(0, 5) });
  }

  doTravel(d, w, s) {
    if (economy.mode !== 'campaign') { this.toast.show(STR.busyChallenge, 1800); return; }
    if (this.battle.goToStage(d, w, s)) {
      this.showTab('battle');
      this.toast.show(STR.goingTo(WORLDS[w].name, s), 1600);
    }
  }

  // Passe do Minerador: compra (modo de teste) e visual dourado.
  doBuyPremium() {
    if (!buyPass()) return;
    SaveSystem.save(economy);
    Sfx.play('fanfare');
    this.cameras.main.flash(260, 255, 220, 120);
    this.toast.show(STR.premiumBought, 1800);
    this.premiumModal.refresh();
    this.applyPremiumLook();
    this.refreshAll();
  }

  applyPremiumLook() {
    const on = premiumActive();
    this.premiumOn = on;
    this.topBand?.setStrokeStyle(4, on ? COL.gold : 0xa87a20);
    this.dock?.band?.setStrokeStyle?.(4, on ? COL.gold : 0xa87a20);
    this.crownGlow?.setVisible(!on);
    this.crownIcon?.setAlpha(on ? 1 : 0.9);
  }

  doOpenChest() {
    if (canOpenAllChests()) { this.doOpenAllChests(); return; }
    const r = openRewardChest();
    if (!r) return;
    SaveSystem.save(economy);
    const items = [
      { icon: 'coin', text: STR.rewardGold(fmt(r.gold)), color: TXT.gold },
      { icon: 'crystal', text: STR.rewardCrystals(r.crystals), color: '#9fe8ff' },
      { icon: `ore_${r.world}`, text: STR.rewardMineral(r.minerals, WORLDS[r.world].mineral.name) },
    ];
    if (r.cage) items.push({ icon: 'cage', scale: 3, text: STR.rewardCage, color: TXT.good });
    if (r.gem) items.push({ icon: `gem_${r.gem.split(':')[0]}`, text: gemLabel(r.gem), color: '#ffa0d8' });
    this.rewardModal.show({ title: STR.chestTitle, items }, () => this.panels.map.refresh());
  }

  // Passe: abre todos os baús que der (baú + chave) e mostra um resumo só.
  doOpenAllChests() {
    let n = 0; let gold = 0; let crystals = 0; let cages = 0; const minerals = {}; const gems = [];
    for (let r = openRewardChest(); r; r = openRewardChest()) {
      n++; gold += r.gold; crystals += r.crystals; cages += r.cage ? 1 : 0;
      minerals[r.world] = (minerals[r.world] || 0) + r.minerals;
      if (r.gem) gems.push(r.gem);
    }
    if (!n) return;
    SaveSystem.save(economy);
    const items = [
      { icon: 'coin', text: STR.rewardGold(fmt(gold)), color: TXT.gold },
      { icon: 'crystal', text: STR.rewardCrystals(crystals), color: '#9fe8ff' },
      ...Object.entries(minerals).map(([w, m]) => ({ icon: `ore_${w}`, text: STR.rewardMineral(m, WORLDS[w].mineral.name) })),
    ];
    if (cages) items.push({ icon: 'cage', scale: 3, text: `${STR.rewardCage} ×${cages}`, color: TXT.good });
    if (gems.length) items.push({ icon: `gem_${gems[0].split(':')[0]}`, text: gems.length > 1 ? `${gemLabel(gems[0])} +${gems.length - 1}` : gemLabel(gems[0]), color: '#ffa0d8' });
    this.rewardModal.show({ title: STR.chestsAllTitle(n), items: items.slice(0, 5) }, () => this.panels.map.refresh());
  }

  doBuyRecovery() {
    if (economy.buyRecovery()) { SaveSystem.save(economy); this.toast.show(STR.recoveryUpgraded, 1200); }
  }

  // ---------- Reações a eventos ----------
  // Os eventos do jogo (ouro, elenco, itens…) podem chegar muitas vezes no mesmo quadro — por exemplo,
  // tocando rápido em "Subir nível". Em vez de redesenhar tudo a cada evento, marca e redesenha UMA vez
  // no próximo quadro.
  refreshAll() {
    this.dirtyAll = true;
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.flushQueued) return;
    this.flushQueued = true;
    this.time.delayedCall(0, () => {
      this.flushQueued = false;
      const all = this.dirtyAll, gold = this.dirtyGold;
      this.dirtyAll = false; this.dirtyGold = false;
      if (all) this.refreshAllNow();
      else if (gold) this.refreshGoldPanels();
    });
  }

  refreshAllNow() {
    this.dock.refresh();
    if (this.panels?.heroes.isOpen) this.panels.heroes.refresh();
    if (this.panels?.house.isOpen) this.panels.house.refresh();
    if (this.panels?.map.isOpen) this.panels.map.refresh();
    if (this.panels?.forge.isOpen) this.panels.forge.refresh();
    if (this.panels?.inventory.isOpen) this.panels.inventory.refresh();
    if (this.panels?.skills.isOpen) this.panels.skills.refresh();
    if (this.panels?.goals.isOpen) this.panels.goals.refresh();
    if (this.detail?.isOpen) this.detail.refresh();
    if (this.itemDetail?.isOpen) this.itemDetail.refresh();
    if (this.detail?.picker.isOpen) this.detail.picker.refresh();
    if (this.detail?.gemPicker.isOpen) this.detail.gemPicker.refresh();
    this.updateTeamLabel();
    this.updateBadges();
  }

  onGold(gold) {
    fit(this.goldText.setText(goldFull(gold)), GOLD_TEXT_W);
    this.dirtyGold = true;
    this.scheduleFlush();
  }

  // Painéis que mostram preços em ouro (botões ficam liberados/bloqueados conforme o saldo).
  refreshGoldPanels() {
    this.dock.refreshActions();
    if (this.panels.heroes.isOpen) this.panels.heroes.refresh();
    if (this.panels.house.isOpen) this.panels.house.refresh();
    if (this.detail.isOpen) this.detail.refresh();
    if (this.itemDetail.isOpen) this.itemDetail.refresh();
    if (this.panels.forge.isOpen) this.panels.forge.refresh();
  }

  saveSoon() { SaveSystem.save(economy); }

  onCurrency() {
    fit(this.crystalText.setText(fmt(economy.crystals)), CHIPS.crystal[0] + CHIPS.crystal[1] - 40 - (HUD.crystal[0] + 24));
    fit(this.cageText.setText(fmt(economy.cages)), CHIPS.cage[0] + CHIPS.cage[1] - 8 - (HUD.cage[0] + 26));
    this.dock?.refreshActions();
    this.updateRail();
    if (this.panels?.heroes.isOpen) this.panels.heroes.refresh();
    if (this.panels?.map.isOpen) this.panels.map.refresh();
    if (this.panels?.forge.isOpen) this.panels.forge.refresh();
    if (this.panels?.inventory.isOpen) this.panels.inventory.refresh();
    if (this.panels?.skills.isOpen) this.panels.skills.refresh();
    if (this.itemDetail?.isOpen) this.itemDetail.refresh();
  }

  onColossusEnd({ damage, crystals, essence, gemKey, newBest, weekBest, nextTier }) {
    Sfx.play(newBest ? 'reward' : 'fail');
    const items = [];
    if (crystals) items.push({ icon: 'crystal', text: STR.rewardCrystals(crystals), color: '#9fe8ff' });
    if (essence) items.push({ icon: 'star', text: `${essence} essência`, color: '#c8b0ff' });
    if (gemKey) items.push({ icon: `gem_${gemKey.split(':')[0]}`, text: gemLabel(gemKey), color: '#ffa0d8' });
    let sub = STR.colossusEnd(fmt(damage), fmt(weekBest));
    if (nextTier) sub += `\n${STR.colossusNext(fmt(nextTier))}`;
    this.rewardModal.show({ top: { icon: 'ui_bomb', size: 190 }, ribbon: 'crimson', title: newBest ? STR.colossusNewBest : STR.colossusEndTitle, subtitle: sub, items });
  }

  onEndlessEnd({ reached, best }) {
    Sfx.play('fail');
    this.rewardModal.show({ top: { icon: 'star', size: 190 }, ribbon: 'purple', title: STR.abyssEndTitle, subtitle: STR.abyssEnd(reached, best), items: [] });
  }

  onEnergyTick() {
    this.dock.refresh();
    this.updateTrophyDot();
    this.updateBadges();
    if (this.panels.goals.isOpen) this.panels.goals.refresh();
    if (this.panels.house.isOpen) this.panels.house.refresh();
    if (this.panels.heroes.isOpen) this.panels.heroes.refresh();
    if (this.detail.isOpen) this.detail.refresh();
  }

  onRotated(team) {
    this.updateTeamLabel();
    this.dock.viewTeam = null;
    this.dock.refresh();
    this.toast.show(STR.rotated(team), 1600);
  }

  // Etiqueta da dificuldade ao lado da fase (some no Colosso e no Abismo, que têm relógio próprio).
  updateTeamLabel() {
    const campaign = economy.mode === 'campaign';
    this.diffBg.setVisible(campaign);
    this.diffText.setVisible(campaign);
    if (!campaign) return;
    const d = economy.difficulty;
    this.diffText.setText(DIFFICULTIES[d] ?? '');
    const x = this.stageText.x + this.stageText.displayWidth + 10;
    this.diffBg.setX(x).setFillStyle(DIFF_CHIP[d] ?? DIFF_CHIP[0]).setSize(this.diffText.width + 16, 24);
    this.diffText.setX(x + 8);
  }

  // Poder recomendado: o painel da equipe mostra (verde / amarelo / vermelho). Aqui só devolve o estado.
  updatePowerInfo() {
    if (economy.mode !== 'campaign') { this.powerState = null; return null; }
    const have = teamPower();
    const need = recommendedPower();
    const state = have >= need ? 'good' : have >= need * BALANCE.power.warn ? 'close' : 'hard';
    this.powerState = state;
    return state;
  }

  // ---------- Grandes anúncios (chefe, mundo novo, perfeito) ----------
  showBigBanner(title, sub, color = 0xe8b84a, { y = L.arenaY + L.arenaH * 0.42, hold = 1500 } = {}) {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const c = this.add.container(0, y).setDepth(210);
    const band = this.add.rectangle(W / 2, 0, W, 150, 0x0e0716, 0.88);
    const lineT = this.add.rectangle(W / 2, -75, W, 6, color);
    const lineB = this.add.rectangle(W / 2, 75, W, 6, color);
    const t = txt(this, W / 2, sub ? -16 : 0, title, 58, hex, true).setOrigin(0.5).setStroke('#0e0716', 10);
    fit(t, W - 60);
    const parts = [band, lineT, lineB, t];
    if (sub) parts.push(fit(txt(this, W / 2, 40, sub, 24, TXT.main, true).setOrigin(0.5), W - 80));
    c.add(parts);
    // Faixa abre pelo meio; título entra deslizando.
    band.scaleY = 0; lineT.scaleX = 0; lineB.scaleX = 0;
    t.x = -W / 2;
    this.tweens.add({ targets: band, scaleY: 1, duration: 180, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: [lineT, lineB], scaleX: 1, duration: 260, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, x: W / 2, duration: 320, delay: 80, ease: 'Back.easeOut' });
    // Faíscas nas pontas do título.
    const sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 120, max: 360 }, lifespan: 800, scale: { start: 3, end: 0 }, gravityY: 260, emitting: false,
      tint: [color, 0xffffff],
    }).setDepth(211);
    this.time.delayedCall(260, () => {
      sparks.explode(18, W / 2 - 200, y);
      sparks.explode(18, W / 2 + 200, y);
    });
    this.tweens.add({
      targets: c, alpha: 0, delay: hold, duration: 320,
      onComplete: () => { c.destroy(); this.time.delayedCall(900, () => sparks.destroy()); },
    });
    return c;
  }

  onWorldChanged(w) {
    const first = (economy.progress[economy.difficulty]?.[w] ?? 0) === 0;
    if (!first) { this.toast.show(STR.worldEntered(WORLDS[w].name), 2000); return; }
    Sfx.play('fanfare');
    this.showBigBanner(STR.worldIntro(WORLDS[w].name), STR.worldIntroSub(w + 1), WORLDS[w].mineral.color, { hold: 2200 });
  }

  // Zona nova dentro do mesmo mundo: faixa menor com o nome da zona.
  onZoneChanged(w, z) {
    const name = ZONES[w]?.[z]?.name;
    if (!name) return;
    Sfx.play('reward');
    this.showBigBanner(name.toUpperCase(), STR.zoneIntroSub(WORLDS[w].name, z + 1, BALANCE.stage.zonesPerWorld), WORLDS[w].mineral.color, { hold: 1800 });
  }

  onProgress(done, total) {
    this.progressFill.scaleX = total > 0 ? done / total : 0;
  }

  onStageStart() {
    const world = WORLDS[economy.world]?.name ?? '';
    const spw = BALANCE.stage.stagesPerWorld;
    let zone = STR.stageZone(world, ZONES[economy.world]?.[economy.arenaZone]?.name);
    let label = STR.stageNum(economy.stage, spw);
    if (economy.mode === 'endless') { zone = STR.abyssName; label = STR.abyssLabel(economy.endlessDepth).split('·').pop().trim(); }
    if (economy.mode === 'colossus') { zone = STR.colossusZone; label = COLOSSI[economy.colossusVariant()].name; }
    fit(this.zoneText.setText(zone), 200);
    fit(this.stageText.setText(label), economy.mode === 'campaign' ? 150 : 225);
    this.updateTeamLabel();

    this.banner.setVisible(false);
    const campaign = economy.mode === 'campaign';
    if (this.battle.boss && campaign) {
      // Chefe: faixa vermelha grande e o chão treme.
      this.time.delayedCall(250, () => {
        Sfx.play('boss');
        this.battle.cameras.main.shake(450, 0.006);
        this.showBigBanner(STR.bossIntro, STR.bossIntroSub(WORLDS[economy.world]?.name ?? ''), 0xd83a5a, { hold: 1700 });
      });
    }
    // Aviso quando a equipe está bem abaixo do recomendado (no máx. uma vez por fase).
    const key = `${economy.difficulty}-${economy.world}-${economy.stage}`;
    if (campaign && this.updatePowerInfo() === 'hard' && this.warnedStage !== key) {
      this.warnedStage = key;
      this.time.delayedCall(this.battle.boss ? 2400 : 400, () => this.toast.show(STR.hardStage, 2600));
    }
  }

  onStageClear({
    gold, crystals, cages, keys, chest, sealed, essence, newRecord, unlockedWorld, unlockedDifficulty,
    stars, starsGained, milestones,
  }) {
    this.bannerGold.setText(STR.goldGained(fmt(gold)));
    const showStars = !!stars;
    this.bannerStars.forEach((img, i) => {
      img.setVisible(showStars).setTexture(i < (stars || 0) ? 'star' : 'star_empty').setScale(6);
      if (showStars && i < stars) {
        img.setScale(0);
        this.tweens.add({ targets: img, scale: 6, duration: 220, delay: 200 + i * 160, ease: 'Back.easeOut' });
      }
    });
    if (starsGained) this.time.delayedCall(700, () => this.toast.show(STR.starsNew(starsGained), 1200));
    if (milestones) this.time.delayedCall(1200, () => this.toast.show(STR.starMilestone(BALANCE.stage.starMilestones[0]), 2600));
    fit(this.bannerExtra.setText(STR.stageExtras(crystals, cages, keys, chest, sealed, essence)), 500);
    if (newRecord) this.toast.show(STR.abyssNewRecord, 1400);
    if (unlockedDifficulty !== null && unlockedDifficulty !== undefined) {
      this.toast.show(STR.difficultyUnlocked(DIFFICULTIES[unlockedDifficulty], WORLDS[economy.world].name), 2600);
    } else if (unlockedWorld !== null && unlockedWorld !== undefined) {
      this.toast.show(STR.worldUnlocked(WORLDS[unlockedWorld].name), 2600);
    }
    this.banner.setVisible(true).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.banner, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1500, duration: 300 });
    // 3 estrelas: "PERFEITO!" com chuva de faíscas douradas.
    if (stars === 3) {
      this.time.delayedCall(720, () => {
        Sfx.play('perfect');
        const t = txt(this, W / 2, L.arenaY + L.arenaH / 2 - 190, STR.perfect, 54, TXT.gold, true)
          .setOrigin(0.5).setStroke('#12081c', 10).setDepth(55).setScale(0).setAngle(-6);
        this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 1100, duration: 400, onComplete: () => t.destroy() });
        const p = this.add.particles(0, 0, 'spark', {
          speed: { min: 160, max: 440 }, lifespan: 1000, scale: { start: 3.5, end: 0 }, gravityY: 380,
          tint: [0xe8b84a, 0xfff1a8, 0xffffff], emitting: false,
        }).setDepth(56);
        p.explode(40, W / 2, t.y);
        this.time.delayedCall(1300, () => p.destroy());
      });
    }
  }
}

// 3725 s → "1 h 2 min"
function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${Math.floor(secs)} s`;
}
