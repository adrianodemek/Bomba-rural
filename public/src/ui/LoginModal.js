// Calendário do presente diário: 7 caixas, a de hoje brilha; o 7º dia é a Gaiola Lendária.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { economy } from '../systems/Economy.js';
import { LOGIN_DAYS, loginIndex, loginReward, loginAvailable } from '../systems/Login.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { fmt } from './format.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const CELL = 140;
const GAP = 12;
const CH = 150;
const LEGEND = 0xf0923a;

export class LoginModal extends Modal {
  constructor(scene, { onClaim }) {
    super(scene, 440, 0.8);
    const s = scene;
    this.onClaim = onClaim;
    this.card = frame(s, W / 2, 640, W - 60, 640, COL.panel).setStrokeStyle(5, COL.gold).setInteractive();
    this.title = txt(s, W / 2, 360, STR.loginTitle, 38, TXT.gold, true).setOrigin(0.5).setStroke('#12081c', 8);
    this.sub = txt(s, W / 2, 410, STR.loginSub, 19, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 120);
    this.add([this.card, this.title, this.sub]);

    // Linha 1: dias 1-4. Linha 2: dias 5-6 e o 7º dia largo.
    const x0 = W / 2 - (4 * CELL + 3 * GAP) / 2;
    const rows = [500, 500 + CH + GAP];
    const n = LOGIN_DAYS().length;
    this.cells = [];
    for (let i = 0; i < n; i++) {
      const big = i === n - 1;
      const col = i < 4 ? i : i - 4;
      const w = big ? CELL * 2 + GAP : CELL;
      const x = x0 + col * (CELL + GAP);
      const y = rows[i < 4 ? 0 : 1];
      const c = this.makeCell(x, y, w, i, big);
      this.cells.push(c);
    }
    this.sparks = s.add.particles(0, 0, 'spark', {
      speed: { min: 120, max: 380 }, lifespan: 850, scale: { start: 3, end: 0 }, gravityY: 300, emitting: false,
      tint: [0xe8b84a, 0xfff1a8, 0xffffff],
    });
    this.btn = new Button(s, W / 2, 890, W - 200, 84, STR.loginCollect, () => this.claim(), { fontSize: 28 });
    this.add([this.sparks, this.btn]);
  }

  makeCell(x, y, w, i, big) {
    const s = this.scene;
    const cx = x + w / 2;
    const bg = frame(s, cx, y + CH / 2, w, CH, big ? 0x3a1430 : COL.card).setStrokeStyle(3, big ? LEGEND : COL.border);
    const rays = big ? s.add.star(cx, y + 78, 10, 22, 70, LEGEND, 0.25) : null;
    const label = txt(s, cx, y + 18, STR.loginDay(i + 1), 18, big ? '#ffc070' : TXT.dim, true).setOrigin(0.5);
    const icon = s.add.image(cx, y + 74, 'coin').setScale(4);
    const icon2 = s.add.image(cx + 30, y + 74, 'key').setScale(4).setVisible(false);
    const amount = txt(s, cx, y + 128, '', 19, TXT.main, true).setOrigin(0.5);
    const shade = s.add.rectangle(cx, y + CH / 2, w, CH, 0x000000, 0.55);
    const check = txt(s, cx, y + 70, '✓', 64, '#7fe07a', true).setOrigin(0.5).setStroke('#123010', 8);
    const parts = [bg, label, icon, icon2, amount, shade, check];
    if (rays) parts.splice(1, 0, rays);
    this.add(parts);
    return { bg, rays, label, icon, icon2, amount, shade, check, cx, cy: y + 74, big };
  }

  // Ícone e texto do prêmio de cada dia.
  fill(c, i) {
    const r = loginReward(i);
    let icon = 'coin'; let scale = 4; let text = fmt(r.gold); let color = TXT.gold;
    if (r.legend) { icon = 'cage'; scale = 6; text = STR.loginLegend; color = '#ffc070'; }
    else if (r.cages) { icon = 'cage'; scale = 3.2; text = `×${r.cages}`; color = TXT.good; }
    else if (r.crystals) { icon = 'crystal'; scale = 4; text = `×${r.crystals}`; color = '#9fe8ff'; }
    c.icon.setTexture(icon).setScale(scale).setX(r.keys ? c.cx - 26 : c.cx);
    c.icon2.setVisible(!!r.keys).setX(c.cx + 30);
    if (r.keys) text = `${text} + ${r.keys}`;
    if (r.legend) c.icon.setTint(LEGEND); else c.icon.clearTint();
    fit(c.amount.setText(text).setColor(color), c.big ? 260 : 130);
  }

  show() {
    const today = loginIndex();
    const avail = loginAvailable();
    this.cells.forEach((c, i) => {
      this.fill(c, i);
      const done = i < today || (!avail && i === today);
      c.shade.setVisible(done);
      c.check.setVisible(done).setScale(1);
      const isToday = avail && i === today;
      c.bg.setStrokeStyle(isToday ? 5 : 3, isToday ? COL.gold : c.big ? LEGEND : COL.border);
      this.scene.tweens.killTweensOf(c.icon);
      c.icon.setAngle(0);
      if (isToday) this.scene.tweens.add({ targets: c.icon, angle: { from: -7, to: 7 }, duration: 260, yoyo: true, repeat: -1 });
      if (c.rays) {
        this.scene.tweens.killTweensOf(c.rays);
        this.scene.tweens.add({ targets: c.rays, angle: 360, duration: 8000, repeat: -1 });
      }
    });
    this.btn.setVisible(avail);
    this.claimed = false;
    this.open();
  }

  claim() {
    if (this.claimed) return;
    this.claimed = true;
    const c = this.cells[loginIndex()];
    const res = this.onClaim();
    if (!res) { this.close(); return; }
    this.scene.tweens.killTweensOf(c.icon);
    c.icon.setAngle(0);
    this.sparks.explode(c.big ? 50 : 28, c.cx, c.cy);
    c.shade.setVisible(true).setAlpha(0);
    c.check.setVisible(true).setScale(0);
    this.scene.tweens.add({ targets: c.shade, alpha: 0.55, duration: 250 });
    this.scene.tweens.add({ targets: c.check, scale: 1, duration: 280, ease: 'Back.easeOut' });
    this.btn.setVisible(false);
    this.scene.time.delayedCall(750, () => { this.close(); this.after?.(res); });
  }
}
