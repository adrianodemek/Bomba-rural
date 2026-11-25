// Aba Mapa: dificuldades, lista de mundos e o caminho de 20 fases de cada mundo.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { WORLDS, DIFFICULTIES, DIFFICULTY_SHORT, DIFFICULTY_COLORS, ZONES } from '../data/worlds.js';
import { HD_TRAILS } from '../config/hdArt.js';
import { ensureGroup, groupLoaded } from '../art/hd.js';
import { zoneOfStage } from '../systems/Economy.js';
import { economy } from '../systems/Economy.js';
import { canOpenChest } from '../systems/Rewards.js';
import { canOpenAllChests } from '../systems/Premium.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card, ProgressBar } from './widgets.js';
import { fmt } from './format.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const CARD_Y = 145;
const CARD_H = 116;
const NODE_R = 30;
const TRAIL_X = 40;
const TRAIL_Y = 196;
const PER_ZONE = BALANCE.stage.stagesPerWorld / BALANCE.stage.zonesPerWorld;
const COLS = 6;

export class MapPanel extends Panel {
  constructor(scene, { onClose, onTravel, onOpenChest }) {
    super(scene, STR.mapTitle, onClose);
    this.onTravel = onTravel;
    this.viewDiff = economy.difficulty;
    this.viewWorld = null; // null = lista de mundos

    this.worldsView = scene.add.container(0, 0);
    this.stagesView = scene.add.container(0, 0).setVisible(false);
    this.add([this.worldsView, this.stagesView]);

    this.buildWorldsView(scene, onOpenChest);
    this.buildStagesView(scene);
    this.onOpen = () => {
      this.viewDiff = economy.difficulty;
      this.showWorlds();
    };
  }

  // ---------- Lista de mundos ----------
  buildWorldsView(s, onOpenChest) {
    const v = this.worldsView;
    const bw = 126;
    const x0 = (W - (5 * bw + 4 * 6)) / 2 + bw / 2;
    this.diffBtns = DIFFICULTY_SHORT.map((name, d) => {
      const b = new Button(s, x0 + d * (bw + 6), 100, bw, 56, name, () => this.pickDiff(d), {
        fontSize: 19, color: COL.card, border: COL.border,
        onDisabledClick: () => s.toast.show(STR.diffLocked(DIFFICULTIES[d - 1]), 2000),
      });
      v.add(b);
      return b;
    });

    this.worldCards = WORLDS.map((wd, w) => {
      const y = CARD_Y + w * (CARD_H + 10);
      const bg = card(s, 24, y, W - 48, CARD_H);
      const ore = s.add.image(74, y + 46, `ore_${w}`).setScale(5);
      const oreCount = txt(s, 74, y + 92, '', 16, TXT.dim).setOrigin(0.5);
      const name = txt(s, 124, y + 28, wd.name, 24, TXT.main).setOrigin(0, 0.5);
      const prog = txt(s, 124, y + 60, '', 18, TXT.dim).setOrigin(0, 0.5);
      const bar = new ProgressBar(s, 124, y + 90, 330, 12, COL.gold);
      const status = txt(s, 590, y + 58, '', 17, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(200);
      const lock = s.add.image(590, y + 34, 'icon_lock').setScale(4);
      const play = new Button(s, 590, y + 58, 170, 64, STR.play, () => this.showStages(w), { fontSize: 24 });
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => { if (economy.worldAvailable(this.viewDiff, w)) this.showStages(w); });
      v.add([bg, ore, oreCount, name, prog, bar, status, lock, play]);
      return { bg, ore, oreCount, name, prog, bar, status, lock, play };
    });

    const by = 790;
    v.add(card(s, 24, by, W - 48, 126, COL.gold));
    v.add(s.add.image(66, by + 34, 'ui_chest').setScale(3));
    this.chestText = txt(s, 100, by + 34, '', 22, TXT.main).setOrigin(0, 0.5);
    this.openBtn = new Button(s, 190, by + 88, 300, 52, STR.openChest, onOpenChest, {
      fontSize: 21, color: 0x36204e, border: 0xa87a20,
      onDisabledClick: () => s.toast.show(economy.rewardChests <= 0 ? STR.needChest : STR.needKey, 2400),
    });
    this.autoBtn = new Button(s, 530, by + 46, 280, 60, '', () => this.toggleAuto(), {
      fontSize: 21, color: COL.card, border: COL.border,
    });
    this.autoInfo = txt(s, 530, by + 100, '', 15, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(290);
    v.add([this.chestText, this.openBtn, this.autoBtn, this.autoInfo]);
  }

  pickDiff(d) {
    if (!economy.difficultyAvailable(d)) return;
    this.viewDiff = d;
    this.refresh();
  }

  toggleAuto() {
    economy.autoAdvance = !economy.autoAdvance;
    this.refresh();
  }

  showWorlds() {
    this.viewWorld = null;
    this.worldsView.setVisible(true);
    this.stagesView.setVisible(false);
    this.titleText.setText(STR.mapTitle);
    this.refresh();
  }

  // ---------- Trilha de fases (uma ilustração por zona) ----------
  buildStagesView(s) {
    const v = this.stagesView;
    this.backBtn = new Button(s, 100, 104, 150, 56, STR.back, () => this.showWorlds(), {
      fontSize: 21, color: COL.card, border: COL.border,
    });
    this.stageHeader = txt(s, 420, 104, '', 24, TXT.gold).setOrigin(0.5);
    v.add([this.backBtn, this.stageHeader]);
    this.viewZone = 0;
    this.zoneBtns = [0, 1, 2].map((z) => {
      const b = new Button(s, 132 + z * 228, 160, 218, 52, '', () => { this.viewZone = z; this.refresh(); }, {
        fontSize: 18, color: COL.card, border: COL.border,
      });
      v.add(b);
      return b;
    });
    this.trailBg = frame(s, TRAIL_X, TRAIL_Y, 640, 560, 0x120a1e).setOrigin(0).setStrokeStyle(3, COL.border);
    this.trailImg = s.add.image(TRAIL_X, TRAIL_Y, '__DEFAULT').setOrigin(0).setVisible(false);
    v.add([this.trailBg, this.trailImg]);
    this.nodes = [];
    for (let i = 0; i < PER_ZONE; i++) {
      const ring = s.add.circle(0, 0, NODE_R + 8, 0xffffff, 0).setStrokeStyle(4, 0xffffff, 0.9).setVisible(false);
      const circle = s.add.circle(0, 0, NODE_R, COL.card).setStrokeStyle(4, 0x120a1e);
      const label = txt(s, 0, 0, '', 22, TXT.main, true).setOrigin(0.5);
      const lock = s.add.image(0, 0, 'icon_lock').setScale(2);
      const chest = s.add.image(0, 0, 'ui_chest').setScale(2);
      const stars = [-16, 0, 16].map(() => s.add.image(0, 0, 'star_empty').setScale(2));
      circle.setInteractive({ useHandCursor: true });
      const node = { ring, circle, label, lock, chest, stars, stage: 0 };
      circle.on('pointerup', () => this.tapStage(node.stage));
      v.add([ring, circle, label, lock, chest, ...stars]);
      this.nodes.push(node);
    }
    s.tweens.add({ targets: this.nodes.map((n) => n.ring), scale: 1.12, duration: 600, yoyo: true, repeat: -1 });

    this.stageFooter = txt(s, W / 2, 790, '', 20, TXT.dim).setOrigin(0.5);
    this.stageOre = s.add.image(0, 790, 'ore_0').setScale(3);
    v.add([this.stageFooter, this.stageOre]);
  }

  placeNodes(w, z) {
    const tr = HD_TRAILS?.[`${w}_${z}`];
    this.nodes.forEach((n, i) => {
      const p = tr ? tr.nodes[i] : [80 + (i % 4) * 160, 500 - Math.floor(i / 4) * 260 - (i % 2) * 60];
      const x = TRAIL_X + p[0];
      const y = TRAIL_Y + p[1];
      n.pos = { x, y };
      n.ring.setPosition(x, y);
      n.circle.setPosition(x, y);
      n.lock.setPosition(x, y + 18);
      n.chest.setPosition(x + 26, y - 26);
      n.stars.forEach((st, k) => st.setPosition(x + (k - 1) * 16, y + 40));
    });
  }

  showStages(w) {
    if (!economy.worldAvailable(this.viewDiff, w)) return;
    this.viewWorld = w;
    const here = economy.difficulty === this.viewDiff && economy.world === w;
    const next = Math.min(BALANCE.stage.stagesPerWorld, economy.progress[this.viewDiff][w] + 1);
    this.viewZone = zoneOfStage(here ? economy.stage : next);
    const g = `trails_${w}`;
    if (!groupLoaded(g)) ensureGroup(this.scene.battle, g, () => { if (this.viewWorld === w) this.refresh(); });
    this.worldsView.setVisible(false);
    this.stagesView.setVisible(true);
    this.titleText.setText('');
    this.refresh();
  }

  tapStage(s) {
    const d = this.viewDiff;
    const w = this.viewWorld;
    if (!economy.stageAvailable(d, w, s)) {
      this.scene.toast.show(STR.stageLocked, 1400);
      return;
    }
    this.onTravel(d, w, s);
  }

  // ---------- Atualização ----------
  refresh() {
    if (this.viewWorld === null) this.refreshWorlds();
    else this.refreshStages();
  }

  refreshWorlds() {
    const d = this.viewDiff;
    const spw = BALANCE.stage.stagesPerWorld;
    this.diffBtns.forEach((b, i) => {
      const ok = economy.difficultyAvailable(i);
      b.setEnabled(ok);
      if (ok) b.setColors(i === d ? COL.btn : COL.card, i === d ? COL.btnBorder : COL.border);
      b.label.setColor(ok ? DIFFICULTY_COLORS[i] : TXT.dim);
      if (i === d && ok) b.label.setColor(TXT.main);
    });

    this.worldCards.forEach((c, w) => {
      const ok = economy.worldAvailable(d, w);
      const done = economy.progress[d][w];
      const here = economy.difficulty === d && economy.world === w;
      c.oreCount.setText(`x${fmt(economy.minerals[w])}`);
      fit(c.prog.setText(STR.worldProgress(done, spw, economy.worldStars(d, w), spw * 3)), 330);
      c.bar.setValue(done / spw);
      c.bg.setStrokeStyle(here ? 4 : 3, here ? COL.gold : COL.border).setAlpha(ok ? 1 : 0.55);
      c.name.setColor(ok ? TXT.main : TXT.dim);
      c.lock.setVisible(!ok);
      c.play.setVisible(ok);
      c.status.setVisible(!ok || here);
      if (!ok) {
        const prevWorldOk = w === 0 || economy.progress[d][w - 1] >= spw;
        c.status.setText(prevWorldOk ? STR.worldLockedDiff(DIFFICULTIES[d - 1]) : STR.worldLockedPrev(WORLDS[w - 1].name))
          .setY(CARD_Y + w * (CARD_H + 10) + 84);
      } else if (here) {
        c.status.setText(STR.worldCurrent).setColor(TXT.gold).setY(CARD_Y + w * (CARD_H + 10) + 104);
      }
      if (!ok) c.status.setColor(TXT.dim);
      c.play.setY(CARD_Y + w * (CARD_H + 10) + (here ? 48 : 58));
    });

    this.chestText.setText(STR.chestsLine(economy.rewardChests, economy.keys));
    const many = Math.min(economy.rewardChests, economy.keys);
    this.openBtn.setLabel(canOpenAllChests() && many > 1 ? STR.openAllChests(many) : STR.openChest).setEnabled(canOpenChest());
    this.autoBtn.setLabel(economy.autoAdvance ? STR.autoAdvanceOn : STR.autoAdvanceOff)
      .setColors(economy.autoAdvance ? COL.btn : COL.card, economy.autoAdvance ? COL.btnBorder : COL.border);
    this.autoInfo.setText(economy.autoAdvance ? STR.autoAdvanceInfoOn : STR.autoAdvanceInfoOff);
  }

  refreshStages() {
    const d = this.viewDiff;
    const w = this.viewWorld;
    const z = this.viewZone;
    const done = economy.progress[d][w];
    const every = BALANCE.loot.rewardChestEvery;
    fit(this.stageHeader.setText(`${WORLDS[w].name} · ${DIFFICULTIES[d]}`), 440);
    this.zoneBtns.forEach((b, i) => {
      const first = i * PER_ZONE + 1;
      const open = economy.stageAvailable(d, w, first);
      const on = i === z;
      b.setLabel(open ? ZONES[w][i].name : `${ZONES[w][i].name}`);
      b.setColors(on ? COL.btn : COL.card, on ? COL.btnBorder : COL.border);
      b.setAlpha(open ? 1 : 0.5);
      fit(b.label, 200);
    });
    const tr = HD_TRAILS?.[`${w}_${z}`];
    const has = tr && this.scene.textures.exists(tr.key);
    this.trailImg.setVisible(!!has);
    if (has) this.trailImg.setTexture(tr.key);
    this.placeNodes(w, z);

    this.nodes.forEach((n, i) => {
      const s = z * PER_ZONE + i + 1;
      n.stage = s;
      const cleared = s <= done;
      const available = economy.stageAvailable(d, w, s);
      const here = economy.difficulty === d && economy.world === w && economy.stage === s;
      const fill = cleared ? COL.gold : available ? COL.btn : 0x2c2238;
      n.circle.setFillStyle(fill).setStrokeStyle(4, s === BALANCE.stage.stagesPerWorld ? 0xd83a5a : 0x120a1e);
      n.label.setText(String(s)).setColor(cleared ? '#12081c' : available ? TXT.main : TXT.dim)
        .setPosition(n.pos.x, n.pos.y - (available ? 0 : 7));
      n.lock.setVisible(!available);
      n.ring.setVisible(here);
      n.chest.setVisible(s % every === 0 && s > done);
      const st = economy.starsOf(d, w, s);
      n.stars.forEach((img, k) => img.setVisible(cleared).setTexture(k < st ? 'star' : 'star_empty'));
    });

    this.stageFooter.setText(`${WORLDS[w].mineral.name}: ${fmt(economy.minerals[w])}`);
    this.stageOre.setTexture(`ore_${w}`).setX(W / 2 - this.stageFooter.width / 2 - 24);
  }
}
