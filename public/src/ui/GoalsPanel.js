// Painel Metas (troféu no topo): missões diárias, conquistas e o Abismo Sem Fim com os recordes.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { ACHIEVEMENTS } from '../data/goals.js';
import { COLOSSI } from '../data/worlds.js';
import { ROLE_IDS, RARITY_COLORS } from '../data/heroes.js';
import { SLOT_IDS } from '../data/items.js';
import { GEMS, GEM_IDS } from '../data/gems.js';
import { economy } from '../systems/Economy.js';
import { statsOf } from '../systems/Roster.js';
import {
  ensureDaily, missionView, claimMission, bonusReady, claimBonus, achView, claimAch, msToReset, abyssEssenceLeft,
} from '../systems/Goals.js';
import { Sfx } from '../systems/Sfx.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card, ProgressBar } from './widgets.js';
import { fmt } from './format.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const PER_PAGE = 5;

function duration(ms) {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export class GoalsPanel extends Panel {
  constructor(scene, { onClose, onDescend, onQuit, onColossus }) {
    super(scene, STR.goalsTitle, onClose);
    const s = scene;
    this.view = 'missions';
    this.page = 0;
    this.tabBtns = [['missions', STR.tabMissions], ['ach', STR.tabAch], ['abyss', STR.tabChallenges], ['album', STR.tabAlbum]].map(([id, label], i) => {
      const b = new Button(s, 105 + i * 170, 104, 162, 56, label, () => { this.view = id; this.refresh(); }, {
        fontSize: 21, color: COL.card, border: COL.border,
      });
      b.viewId = id;
      // Bolinha vermelha: tem prêmio para coletar nesta categoria.
      b.dot = s.add.circle(105 + i * 170 + 70, 80, 10, 0xe0563b).setStrokeStyle(2, 0x120a1e).setVisible(false);
      this.add([b, b.dot]);
      return b;
    });
    this.views = {
      missions: s.add.container(0, 0), ach: s.add.container(0, 0), abyss: s.add.container(0, 0), album: s.add.container(0, 0),
    };
    this.add(Object.values(this.views));
    this.buildMissions(s);
    this.buildAch(s);
    this.buildAbyss(s, onDescend, onQuit, onColossus);
    this.buildAlbum(s);
    this.onOpen = () => this.refresh();
  }

  toast(msg) {
    Sfx.play('reward');
    this.scene.toast.show(msg, 1600);
    this.refresh();
  }

  // ---------- Missões ----------
  buildMissions(s) {
    const v = this.views.missions;
    const D = BALANCE.daily;
    this.resetText = txt(s, 24, 162, '', 19, TXT.dim).setOrigin(0, 0.5);
    v.add(this.resetText);
    this.mRows = [0, 1, 2].map((i) => {
      const y = 190 + i * 128;
      const bg = card(s, 24, y, W - 48, 116);
      const text = txt(s, 48, y + 28, '', 22, TXT.main).setOrigin(0, 0.5);
      const bar = new ProgressBar(s, 48, y + 62, 370, 12, COL.gold);
      const prog = txt(s, 430, y + 62, '', 17, TXT.dim).setOrigin(0, 0.5);
      const reward = txt(s, 48, y + 92, STR.missionReward(D.rewardCrystals, D.rewardKeys), 16, '#9fe8ff').setOrigin(0, 0.5);
      const btn = new Button(s, 590, y + 58, 180, 64, STR.collect, () => {
        if (claimMission(i)) this.toast(STR.missionClaimed);
      }, { fontSize: 22 });
      v.add([bg, text, bar, prog, reward, btn]);
      return { bg, text, bar, prog, reward, btn };
    });
    const y = 190 + 3 * 128 + 6;
    v.add(card(s, 24, y, W - 48, 110, COL.gold));
    v.add(txt(s, 48, y + 34, STR.bonusTitle, 24, TXT.gold).setOrigin(0, 0.5));
    v.add(txt(s, 48, y + 76, STR.bonusDesc(D.bonusCages, D.bonusEssence), 17, TXT.main).setOrigin(0, 0.5).setWordWrapWidth(420));
    this.bonusBtn = new Button(s, 590, y + 55, 180, 64, STR.collect, () => {
      if (claimBonus()) this.toast(STR.bonusClaimed);
    }, { fontSize: 22 });
    v.add(this.bonusBtn);
  }

  refreshMissions() {
    ensureDaily();
    this.resetText.setText(STR.missionsReset(duration(msToReset())));
    this.mRows.forEach((r, i) => {
      const m = missionView(i);
      Object.values(r).forEach((o) => o.setVisible(!!m));
      if (!m) return;
      fit(r.text.setText(m.def.text(m.target)), 430);
      r.bar.setValue(m.progress / m.target, m.done ? 0x6fd36b : COL.gold);
      r.prog.setText(STR.missionProgress(m.progress, m.target));
      r.btn.setLabel(m.claimed ? STR.claimed : STR.collect).setEnabled(m.done && !m.claimed);
    });
    this.bonusBtn.setLabel(economy.daily.bonusClaimed ? STR.claimed : STR.collect).setEnabled(bonusReady());
  }

  // ---------- Conquistas ----------
  buildAch(s) {
    const v = this.views.ach;
    this.aRows = [];
    for (let i = 0; i < PER_PAGE; i++) {
      const y = 150 + i * 126;
      const bg = card(s, 24, y, W - 48, 116);
      const name = txt(s, 48, y + 26, '', 23, TXT.gold).setOrigin(0, 0.5);
      const tier = txt(s, 470, y + 26, '', 17, TXT.dim).setOrigin(1, 0.5);
      const text = txt(s, 48, y + 58, '', 18, TXT.main).setOrigin(0, 0.5);
      const bar = new ProgressBar(s, 48, y + 92, 340, 12, COL.gold);
      const prog = txt(s, 400, y + 92, '', 16, TXT.dim).setOrigin(0, 0.5);
      const row = { bg, name, tier, text, bar, prog, ach: null };
      row.btn = new Button(s, 590, y + 58, 180, 64, '', () => {
        const c = row.ach && claimAch(row.ach);
        if (c) this.toast(STR.achClaimed(row.ach.name, c));
      }, { fontSize: 20 });
      v.add([bg, name, tier, text, bar, prog, row.btn]);
      this.aRows.push(row);
    }
    const py = 150 + PER_PAGE * 126 + 30;
    this.pageText = txt(s, W / 2, py, '', 22, TXT.dim).setOrigin(0.5);
    v.add([
      new Button(s, 240, py, 120, 54, '<', () => this.turn(-1), { fontSize: 26, color: COL.card, border: COL.border }),
      this.pageText,
      new Button(s, 480, py, 120, 54, '>', () => this.turn(1), { fontSize: 26, color: COL.card, border: COL.border }),
    ]);
  }

  // Coletáveis primeiro, completas por último.
  achSorted() {
    const key = (a) => { const v = achView(a); return v.claimable ? 0 : v.done ? 2 : 1; };
    return [...ACHIEVEMENTS].sort((a, b) => key(a) - key(b));
  }

  turn(d) {
    this.page = Phaser.Math.Wrap(this.page + d, 0, Math.ceil(ACHIEVEMENTS.length / PER_PAGE));
    this.refresh();
  }

  refreshAch() {
    const pages = Math.ceil(ACHIEVEMENTS.length / PER_PAGE);
    this.pageText.setText(`${this.page + 1}/${pages}`);
    const list = this.achSorted().slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.aRows.forEach((r, i) => {
      const a = list[i] || null;
      r.ach = a;
      [r.bg, r.name, r.tier, r.text, r.bar, r.prog, r.btn].forEach((o) => o.setVisible(!!a));
      if (!a) return;
      const v = achView(a);
      r.name.setText(a.name);
      r.tier.setText(STR.achTier(v.tier, v.max));
      fit(r.text.setText(a.text(fmt(v.target))), 430);
      r.bar.setValue(v.done ? 1 : v.value / v.target, v.done || v.claimable ? 0x6fd36b : COL.gold);
      r.prog.setText(v.done ? '' : `${fmt(Math.min(v.value, v.target))}/${fmt(v.target)}`);
      r.btn.setLabel(v.done ? STR.achDone : STR.achBtn(v.reward)).setEnabled(v.claimable);
    });
  }

  // ---------- Desafios: Abismo (temporada), Colosso e recordes ----------
  buildAbyss(s, onDescend, onQuit, onColossus) {
    const v = this.views.abyss;
    v.add(card(s, 24, 146, W - 48, 268, 0x7a3ac8));
    v.add(txt(s, 48, 174, STR.abyssName, 27, '#c8b0ff').setOrigin(0, 0.5));
    this.abyssEssText = txt(s, W - 48, 174, '', 17, '#c8b0ff').setOrigin(1, 0.5);
    v.add(this.abyssEssText);
    v.add(txt(s, 48, 196, STR.abyssDesc, 17, TXT.main).setWordWrapWidth(W - 96));
    this.seasonText = txt(s, 48, 260, '', 18, TXT.gold).setOrigin(0, 0.5);
    this.seasonBestText = txt(s, 48, 288, '', 18, TXT.main).setOrigin(0, 0.5);
    this.seasonPrizeText = txt(s, 48, 316, '', 16, TXT.good).setOrigin(0, 0.5);
    this.goBtn = new Button(s, W / 2, 368, W - 120, 64, STR.abyssGo, () => {
      if (economy.mode === 'endless') onQuit(); else onDescend();
    }, {
      fontSize: 24, color: COL.royal, border: COL.royalBorder,
      onDisabledClick: () => s.toast.show(economy.mode !== 'campaign' ? STR.busyChallenge : STR.abyssLocked, 2200),
    });
    v.add([this.seasonText, this.seasonBestText, this.seasonPrizeText, this.goBtn]);

    v.add(card(s, 24, 428, W - 48, 268, 0xd83a5a));
    this.colTitle = txt(s, 48, 456, '', 24, '#ff9aa8').setOrigin(0, 0.5);
    v.add(txt(s, 48, 478, STR.colossusDesc, 17, TXT.main).setWordWrapWidth(W - 96));
    this.colTip = txt(s, 48, 540, '', 16, TXT.good).setOrigin(0, 0.5);
    this.colTries = txt(s, 48, 570, '', 18, TXT.main).setOrigin(0, 0.5);
    this.colBest = txt(s, 48, 598, '', 18, TXT.gold).setOrigin(0, 0.5);
    this.colBtn = new Button(s, W / 2, 650, W - 120, 64, STR.colossusGo, () => onColossus(), {
      fontSize: 24, color: COL.danger, border: COL.dangerBorder,
      onDisabledClick: () => {
        if (!economy.endlessUnlocked()) s.toast.show(STR.abyssLocked, 2200);
        else if (economy.mode !== 'campaign') s.toast.show(STR.busyChallenge, 2000);
        else s.toast.show(STR.colossusNoTries, 2000);
      },
    });
    v.add([this.colTitle, this.colTip, this.colTries, this.colBest, this.colBtn]);

    v.add(card(s, 24, 710, W - 48, 200, COL.gold));
    v.add(txt(s, 48, 734, STR.recordsTitle, 21, TXT.gold).setOrigin(0, 0.5));
    this.recLines = [0, 1, 2, 3].map((i) => {
      const t = txt(s, 48, 766 + i * 30, '', 17, TXT.main).setOrigin(0, 0.5);
      v.add(t);
      return t;
    });
    v.add(txt(s, 48, 888, STR.recordsNote, 14, TXT.dim).setOrigin(0, 0.5));
  }

  refreshAbyss() {
    const unlocked = economy.endlessUnlocked();
    const inRun = economy.mode === 'endless';
    economy.ensureSeason();
    economy.ensureColossusWeek();
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const days = Math.max(1, Math.ceil((end - now) / 86400000));
    const month = now.toLocaleDateString('pt-BR', { month: 'long' });
    this.seasonText.setText(STR.seasonLine(month, days));
    const sb = economy.stats.seasonBest;
    this.seasonBestText.setText(STR.seasonBest(sb, economy.stats.endlessBest));
    const S = BALANCE.season;
    this.seasonPrizeText.setText(STR.seasonPrize(sb * S.crystalsPerDepth, sb * S.essencePerDepth, Math.floor(sb / S.cageEveryDepth)));
    const cap = BALANCE.endless.essenceDailyCap;
    this.abyssEssText.setText(unlocked && cap ? STR.abyssEssToday(cap - abyssEssenceLeft(), cap) : '')
      .setColor(abyssEssenceLeft() === 0 ? TXT.good : '#c8b0ff');
    this.goBtn.setLabel(inRun ? STR.abyssQuit : STR.abyssGo)
      .setEnabled(unlocked && (inRun || economy.mode === 'campaign'))
      .setColors(inRun ? COL.danger : COL.royal, inRun ? COL.dangerBorder : COL.royalBorder);

    const col = COLOSSI[economy.colossusVariant()];
    const left = this.scene.battle.colossusTriesLeft();
    const C = BALANCE.colossus;
    this.colTitle.setText(STR.colossusTitle(col.name));
    fit(this.colTip.setText(col.tip), W - 96);
    const best = economy.stats.colossusWeekBest;
    const next = C.tiers.find((t) => t > best);
    this.colTries.setText(`${STR.colossusTries(left, C.attemptsPerDay)}  ·  ${next ? STR.colossusNext(fmt(next)) : ''}`);
    fit(this.colTries, W - 96);
    this.colBest.setText(STR.colossusWeekBest(fmt(best)));
    this.colBtn.setEnabled(unlocked && economy.mode === 'campaign' && left > 0);

    const powers = economy.heroes.map((h) => statsOf(h).power).sort((a, b) => b - a);
    const squad = powers.slice(0, 9).reduce((sum, p) => sum + p, 0);
    const lines = [
      `${STR.recDepth(economy.stats.endlessBest)} · ${STR.recStages(fmt(economy.stagesCleared))}`,
      STR.recColossus(fmt(economy.stats.colossusBestEver)),
      STR.recPower(fmt(powers[0] || 0)),
      STR.recSquad(fmt(squad)),
    ];
    this.recLines.forEach((t, i) => fit(t.setText(lines[i]), W - 96));
  }

  // ---------- Álbum ----------
  buildAlbum(s) {
    const v = this.views.album;
    const cell = 56;
    // Heróis: linhas = papéis, colunas = raridades.
    this.albHeroTitle = txt(s, 30, 162, '', 21, TXT.gold).setOrigin(0, 0.5);
    v.add(this.albHeroTitle);
    this.albHero = [];
    ROLE_IDS.forEach((role, r) => {
      for (let k = 0; k < 5; k++) {
        const x = 30 + k * (cell + 6);
        const y = 186 + r * (cell + 6);
        const bg = frame(s, x, y, cell, cell, COL.panelDark).setOrigin(0).setStrokeStyle(3, RARITY_COLORS[k]);
        const icon = s.add.image(x + cell / 2, y + cell / 2, `role_${role}`).setScale(4);
        v.add([bg, icon]);
        this.albHero.push({ key: `${role}:${k}`, bg, icon });
      }
    });
    // Gemas: 2 colunas × 4 linhas à direita.
    this.albGemTitle = txt(s, 400, 162, '', 21, TXT.gold).setOrigin(0, 0.5);
    v.add(this.albGemTitle);
    this.albGem = GEM_IDS.map((g, i) => {
      const x = 400 + (i % 2) * 150;
      const y = 186 + Math.floor(i / 2) * (cell + 6);
      const bg = frame(s, x, y, 142, cell, COL.panelDark).setOrigin(0).setStrokeStyle(2, COL.border);
      const icon = s.add.image(x + 28, y + cell / 2, `gem_${g}`).setScale(4);
      const name = txt(s, x + 54, y + cell / 2, GEMS[g].name, 15, TXT.main).setOrigin(0, 0.5);
      fit(name, 84);
      v.add([bg, icon, name]);
      return { key: g, bg, icon, name };
    });
    // Itens: linhas = raridades, colunas = espaços.
    this.albItemTitle = txt(s, 30, 448, '', 21, TXT.gold).setOrigin(0, 0.5);
    v.add(this.albItemTitle);
    const ic = 64;
    this.albItem = [];
    for (let k = 0; k < 5; k++) {
      SLOT_IDS.forEach((slot, j) => {
        const x = 30 + j * (ic + 4);
        const y = 472 + k * (ic + 4);
        const bg = frame(s, x, y, ic, ic, COL.panelDark).setOrigin(0).setStrokeStyle(2, RARITY_COLORS[k]);
        const icon = s.add.image(x + ic / 2, y + ic / 2, `item_${slot}_${k}`).setScale(4);
        v.add([bg, icon]);
        this.albItem.push({ key: `${slot}:${k}`, bg, icon });
      });
    }
    this.albBonus = txt(s, W / 2, 836, '', 18, TXT.good).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 60);
    v.add(this.albBonus);
  }

  refreshAlbum() {
    const A = economy.album;
    const mark = (c, found) => {
      c.icon.setTintFill?.(0x120a1e);
      if (found) c.icon.clearTint();
      c.icon.setAlpha(found ? 1 : 0.35);
      c.bg.setAlpha(found ? 1 : 0.5);
    };
    this.albHero.forEach((c) => mark(c, A.h.has(c.key)));
    this.albGem.forEach((c) => { mark(c, A.g.has(c.key)); c.name.setAlpha(A.g.has(c.key) ? 1 : 0.4); });
    this.albItem.forEach((c) => mark(c, A.i.has(c.key)));
    this.albHeroTitle.setText(STR.albumHeroes(A.h.size, this.albHero.length));
    this.albGemTitle.setText(STR.albumGems(A.g.size, this.albGem.length));
    this.albItemTitle.setText(STR.albumItems(A.i.size, this.albItem.length));
    const pct = (v) => String(Math.round(v * 1000) / 10).replace('.', ',');
    this.albBonus.setText(STR.albumBonus(pct(economy.albumAttackPct()), pct(economy.albumGoldPct())));
  }

  // Abre direto numa categoria (atalhos da faixa "Hoje").
  showView(id) { this.view = id; this.page = 0; this.refresh(); }

  refresh() {
    for (const [id, c] of Object.entries(this.views)) c.setVisible(id === this.view);
    ensureDaily();
    const ready = {
      missions: economy.daily.missions.some((m, i) => { const v = missionView(i); return v && v.done && !v.claimed; }) || bonusReady(),
      ach: ACHIEVEMENTS.some((a) => achView(a).claimable),
    };
    this.tabBtns.forEach((b) => {
      const on = b.viewId === this.view;
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
      b.dot.setVisible(!!ready[b.viewId]);
    });
    if (this.view === 'missions') this.refreshMissions();
    else if (this.view === 'ach') this.refreshAch();
    else if (this.view === 'album') this.refreshAlbum();
    else this.refreshAbyss();
  }
}
