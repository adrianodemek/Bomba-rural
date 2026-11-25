// Janela do Passe de Temporada, no mesmo estilo da janela do Passe do Minerador: a janela inteira é uma arte
// ilustrada (assets/ui/season_window.webp) e as peças da trilha também (assets/ui/season_parts.png),
// geradas por ferramentas/icons/season_window.py. O jogo escreve por cima a temporada, o nível, o XP,
// a trilha de 30 níveis (rola com o dedo) e o texto dos botões.
import { freeArt, restoreArt } from '../art/bigArt.js';
import { BALANCE } from '../config/balance.js';
import { FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { SEASON_PARTS, SEASON_LAYOUT } from '../config/seasonArt.js';
import { Modal, fit } from './widgets.js';
import { fmt } from './format.js';
import {
  passLevel, passDaysLeft, passMonthName, cellState, claimableCount, rewardValue, ensurePass,
} from '../systems/SeasonPass.js';
import { economy } from '../systems/Economy.js';
import { Sfx } from '../systems/Sfx.js';

const W = BALANCE.screen.width;
const CY = 640;
const ART = 'season_window';
const PARTS = 'season_parts';
// Arte 1280×2020 mostrada em 640×1010, centrada em (360, 640): canto em (40, 135).
const ART_W = 640, ART_H = 1010, ART_X = 40, ART_Y = 135;
const at = (px, py) => [ART_X + px / 2, ART_Y + py / 2];
const L = SEASON_LAYOUT;
const ROW_H = 92;
const CELL_W = 200, CELL_H = 82;

// Ícone e texto de cada tipo de prêmio.
const KIND = [
  ['legend', 'cage', 0xf0923a], ['cages', 'cage'], ['crystals', 'crystal'], ['gold', 'coin'], ['keys', 'key'],
  ['essence', 'star'], ['chests', 'ui_chest'], ['sealed', 'sealed'], ['gems', 'gem_sapphire'],
];
function describe(def) {
  const r = rewardValue(def);
  for (const [k, icon, tint] of KIND) {
    if (r[k]) return { icon, tint, text: k === 'legend' ? STR.passReward.legend() : STR.passReward[k](k === 'gold' ? fmt(r[k]) : r[k]), short: k === 'legend' ? 'Lendária' : `×${k === 'gold' ? fmt(r[k]) : r[k]}` };
  }
  return { icon: 'coin', text: '', short: '' };
}

export class SeasonPassModal extends Modal {
  constructor(scene, { onClaim, onClaimAll, onBuy }) {
    super(scene, 430, 0.82);
    this.onClaim = onClaim;
    this.onClaimAll = onClaimAll;
    this.onBuy = onBuy;
    this.scroll = 0;
    this.load();
  }

  load() {
    const s = this.scene;
    const ready = () => s.textures.exists(ART) && s.textures.exists(PARTS);
    if (ready()) { this.build(); return; }
    if (!s.textures.exists(ART)) s.load.image(ART, 'assets/ui/season_window.webp');
    if (!s.textures.exists(PARTS)) s.load.image(PARTS, 'assets/ui/season_parts.png');
    s.load.once('complete', () => { if (ready()) this.build(); });
    s.load.start();
  }

  build() {
    if (this.art) return;
    const s = this.scene;
    s.textures.get(ART).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const pt = s.textures.get(PARTS);
    pt.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (const [name, [x, y, w, h]] of Object.entries(SEASON_PARTS)) if (!pt.has(name)) pt.add(name, 0, x, y, w, h);

    this.art = s.add.image(W / 2, CY, ART).setDisplaySize(ART_W, ART_H).setInteractive();
    this.add(this.art);
    s.time.delayedCall(300, () => { if (!this.visible) freeArt(s, ART, this.art); });   // construída fechada

    const style = (size, color, stroke = '#12081c', st = 6) => ({ fontFamily: FONT, fontSize: fs(size), color, stroke, strokeThickness: st });
    const [sx, sy] = at(...L.season);
    this.seasonText = s.add.text(sx, sy, '', style(20, '#e8dcff')).setOrigin(0.5);
    const [mx, my] = at(L.medal[0], L.medal[1]);
    this.levelText = s.add.text(mx, my + 6, '0', style(34, '#ffe680', '#2a1404', 7)).setOrigin(0.5);
    const [bx, by] = at(L.bar[0], L.bar[1]);
    this.barW = L.bar[2] / 2; this.barH = L.bar[3] / 2;
    this.barFill = s.add.image(bx + 3, by + this.barH / 2, PARTS, 'bar_fill').setOrigin(0, 0.5);
    this.barText = s.add.text(bx + this.barW / 2, by + this.barH / 2, '', style(18, '#ffffff', '#12081c', 5)).setOrigin(0.5);
    this.add([this.seasonText, this.levelText, this.barFill, this.barText]);

    // ---------- trilha ----------
    const [wx, wy] = at(L.well[0], L.well[1]);
    this.well = { x: wx + 6, y: wy + 6, w: L.well[2] / 2 - 12, h: L.well[3] / 2 - 12 };
    const [cf, cm, ce] = L.cols.map((c) => at(c, 0)[0]);
    this.colX = { free: cf, mid: cm, elite: ce };
    this.track = s.add.container(0, 0);
    this.line = s.add.graphics();
    this.track.add(this.line);
    this.rows = [];
    const n = BALANCE.seasonPass.levels;
    for (let i = 0; i < n; i++) {
      const y = this.well.y + ROW_H / 2 + 4 + i * ROW_H;
      const row = { y };
      for (const t of ['free', 'elite']) {
        const def = BALANCE.seasonPass[t][i];
        const d = describe(def);
        const x = this.colX[t];
        const c = {};
        c.glow = s.add.image(x, y, PARTS, 'cell_glow').setDisplaySize(CELL_W + 10, CELL_H + 10).setVisible(false);
        c.card = s.add.image(x, y, PARTS, t === 'free' ? 'cell_free' : 'cell_elite').setDisplaySize(CELL_W, CELL_H);
        c.icon = s.add.image(x - CELL_W / 2 + 46, y, d.icon).setDisplaySize(46, 46);
        if (d.tint) c.icon.setTint(d.tint);
        c.amount = fit(s.add.text(x + 20, y, d.short, style(26, t === 'free' ? '#f4ead8' : '#ffe680', '#0a0820', 6)).setOrigin(0.5), CELL_W - 96);
        c.mark = s.add.image(x + CELL_W / 2 - 18, y - CELL_H / 2 + 16, PARTS, 'check').setDisplaySize(34, 34).setVisible(false);
        c.text = d.text;
        this.track.add([c.glow, c.card, c.icon, c.amount, c.mark]);
        row[t] = c;
      }
      row.medal = s.add.image(cm, y, PARTS, 'medal_off').setDisplaySize(58, 58);
      row.num = s.add.text(cm, y + 1, String(i + 1), style(24, '#ffffff', '#12081c', 5)).setOrigin(0.5);
      this.track.add([row.medal, row.num]);
      this.rows.push(row);
    }
    this.contentH = n * ROW_H + 8;
    const mg = s.make.graphics({ x: 0, y: BALANCE.layout.modalDY || 0 }, false);
    mg.fillStyle(0xffffff).fillRoundedRect(this.well.x, this.well.y, this.well.w, this.well.h, 14);
    this.track.setMask(mg.createGeometryMask());
    this.add(this.track);

    // Toques na trilha: arrastar rola; tocar coleta (ou explica por que não dá).
    const hit = s.add.rectangle(this.well.x, this.well.y, this.well.w, this.well.h, 0x000000, 0).setOrigin(0).setInteractive();
    // worldX/worldY: posição no jogo (p.x/p.y são pixels da tela, que mudam com a escala do celular).
    hit.on('pointerdown', (p) => { this.drag = { y: p.worldY, start: this.scroll, moved: false }; s.tweens.killTweensOf(this.track); });
    hit.on('pointermove', (p) => {
      if (!this.drag || !p.isDown) return;
      const dy = p.worldY - this.drag.y;
      if (Math.abs(dy) > 8) this.drag.moved = true;
      if (this.drag.moved) this.setScroll(this.drag.start - dy);
    });
    hit.on('pointerup', (p) => {
      const d = this.drag; this.drag = null;
      if (!d || d.moved) return;
      this.tapAt(p.worldX, p.worldY);
    });
    hit.on('pointerout', () => { if (this.drag?.moved) this.drag = null; });
    this.add(hit);

    // ---------- botões ----------
    const btn = (rect, color, stroke, cb) => {
      const [x, y] = at(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
      const label = s.add.text(x, y - 3, '', style(26, color, stroke, 4)).setOrigin(0.5);
      const h = s.add.rectangle(x, y, rect[2] / 2, rect[3] / 2 + 8, 0x000000, 0).setInteractive({ useHandCursor: true });
      h.on('pointerdown', () => label.setScale(label.scaleX * 0.94));
      h.on('pointerout', () => this.fitLabels());
      h.on('pointerup', () => { this.fitLabels(); Sfx.play('click'); cb(); });
      this.add([label, h]);
      return label;
    };
    this.allLabel = btn(L.btnAll, '#f0ffe0', '#0a3008', () => this.onClaimAll());
    this.eliteLabel = btn(L.btnElite, '#3a1a04', '#fff0b0', () => this.onBuy());
    const [nx, ny] = at(...L.note);
    this.note = s.add.text(nx, ny, STR.premiumTestNote, { fontFamily: FONT, fontSize: fs(16), color: '#a898c0' }).setOrigin(0.5);
    const [cx, cy] = at(L.close[0], L.close[1]);
    const closeHit = s.add.circle(cx, cy, 34, 0x000000, 0).setInteractive({ useHandCursor: true });
    closeHit.on('pointerup', () => { Sfx.play('click'); this.close(); });
    this.add([this.note, closeHit]);

    // Brilho passando pelo botão do Elite.
    const [ex, ey] = at(L.btnElite[0], L.btnElite[1]);
    const bm = s.make.graphics({ x: 0, y: BALANCE.layout.modalDY || 0 }, false);
    bm.fillStyle(0xffffff).fillRoundedRect(ex, ey, L.btnElite[2] / 2, L.btnElite[3] / 2, L.btnElite[3] / 4);
    this.shine = s.add.rectangle(ex - 40, ey + 36, 40, 160, 0xffffff, 0.3).setAngle(18)
      .setBlendMode(Phaser.BlendModes.ADD).setMask(bm.createGeometryMask());
    this.add(this.shine);
    s.tweens.add({ targets: this.shine, x: ex + L.btnElite[2] / 2 + 40, duration: 1100, ease: 'Sine.easeInOut', repeat: -1, repeatDelay: 2200 });
    // Prêmios prontos pulsando.
    this.pulse = s.tweens.add({ targets: { t: 0 }, t: 1, duration: 700, yoyo: true, repeat: -1, onUpdate: (tw) => {
      const a = 0.55 + 0.45 * tw.getValue();
      for (const r of this.rows) for (const t of ['free', 'elite']) if (r[t].glow.visible) r[t].glow.setAlpha(a);
    } });
    this.refresh();
  }

  fitLabels() {
    fit(this.allLabel, L.btnAll[2] / 2 - 40);
    fit(this.eliteLabel, L.btnElite[2] / 2 - 90);
  }

  maxScroll() { return Math.max(0, this.contentH - this.well.h); }

  setScroll(v) {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll());
    this.track.y = -this.scroll;
  }

  // Coloca o próximo nível (ou o primeiro prêmio pronto) à vista.
  focusCurrent() {
    let i = passLevel().level;
    for (let k = 0; k < this.rows.length; k++) {
      if (cellState('free', k) === 'ready' || cellState('elite', k) === 'ready') { i = k; break; }
    }
    this.setScroll(Math.max(0, i - 1) * ROW_H);
  }

  tapAt(px, py) {
    const ly = py - this.y - this.well.y + this.scroll - 4;   // py é do mundo; a janela está deslocada em this.y
    const i = Math.floor(ly / ROW_H);
    if (i < 0 || i >= this.rows.length) return;
    const row = this.rows[i];
    let t = null;
    if (Math.abs(px - this.colX.free) <= CELL_W / 2) t = 'free';
    else if (Math.abs(px - this.colX.elite) <= CELL_W / 2) t = 'elite';
    if (!t) return;
    const st = cellState(t, i);
    const c = row[t];
    this.scene.tweens.add({ targets: c.card, scaleX: c.card.scaleX * 0.95, scaleY: c.card.scaleY * 0.95, duration: 70, yoyo: true });
    if (st === 'ready') this.onClaim(t, i);
    else if (st === 'elite') this.scene.toast?.show(STR.passEliteNeeded, 2400);
    else if (st === 'locked') this.scene.toast?.show(`${c.text} · ${STR.passLocked(i + 1)}`, 2400);
    else this.scene.toast?.show(c.text, 1600);
  }

  close() {
    super.close();
    this.scene.time.delayedCall(250, () => { if (!this.visible) freeArt(this.scene, ART, this.art); });
  }

  show() {
    ensurePass();
    if (this.art) restoreArt(this.scene, ART, 'assets/ui/season_window.webp', this.art, ART_W, ART_H);
    this.open();
    if (!this.art) return;
    this.refresh();
    this.focusCurrent();
    if (this.art.texture.key !== ART) return;   // arte ainda voltando do cache: aparece sem o "pulo"
    const sx = ART_W / this.art.width, sy = ART_H / this.art.height;
    this.art.setScale(sx * 0.94, sy * 0.94);
    this.scene.tweens.add({ targets: this.art, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.easeOut' });
  }

  refresh() {
    if (!this.art) return;
    const P = BALANCE.seasonPass;
    const lv = passLevel();
    this.seasonText.setText(STR.passSeason(passMonthName(), passDaysLeft()));
    this.levelText.setText(String(lv.level));
    const ratio = lv.max ? 1 : lv.into / lv.need;
    const fw = Math.max(this.barH, (this.barW - 6) * ratio);
    this.barFill.setDisplaySize(fw, this.barH - 6).setVisible(ratio > 0);
    this.barText.setText(lv.max ? STR.passMax : STR.passXp(lv.into, lv.need));

    // linha do caminho: dourada até o nível atual
    const g = this.line.clear();
    const top = this.rows[0].y, bot = this.rows[this.rows.length - 1].y;
    g.fillStyle(0x1e1236, 1).fillRoundedRect(this.colX.mid - 5, top, 10, bot - top, 5);
    if (lv.level > 1) g.fillStyle(0xffc840, 1).fillRoundedRect(this.colX.mid - 5, top, 10, this.rows[lv.level - 1].y - top, 5);

    this.rows.forEach((r, i) => {
      const reached = i < lv.level;
      r.medal.setFrame(reached ? 'medal_on' : 'medal_off').setDisplaySize(58, 58);
      r.num.setColor(reached ? '#ffe680' : '#9a8ab8');
      for (const t of ['free', 'elite']) {
        const c = r[t];
        const st = cellState(t, i);
        c.glow.setVisible(st === 'ready');
        const dim = st === 'claimed' ? 0.45 : st === 'locked' ? 0.75 : 1;
        c.card.setAlpha(st === 'claimed' ? 0.6 : 1);
        c.icon.setAlpha(dim); c.amount.setAlpha(dim);
        c.mark.setVisible(st === 'claimed' || st === 'elite' || (t === 'elite' && !economy.pass.elite));
        c.mark.setFrame(st === 'claimed' ? 'check' : 'lock').setDisplaySize(34, 34);
      }
    });
    const n = claimableCount();
    this.allLabel.setText(STR.passCollectAll(n)).setAlpha(n ? 1 : 0.6);
    this.eliteLabel.setText(economy.pass.elite ? STR.passEliteOn : STR.passBuyElite(P.priceLabel));
    this.shine.setVisible(!economy.pass.elite);
    this.fitLabels();
    this.note.setVisible(P.testMode && !economy.pass.elite);
  }
}
