// Escolher gema para um encaixe do herói.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { economy } from '../systems/Economy.js';
import { gemStacks, socketGem, unsocketGem } from '../systems/Gems.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { gemLabel, gemEffect } from './gemText.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const PER_PAGE = 7;
const ROW_H = 96;

export class GemPicker extends Modal {
  constructor(scene, onChanged) {
    super(scene, 360);
    const s = scene;
    this.onChanged = onChanged;
    this.page = 0;
    this.panel = frame(s, 40, 150, W - 80, 1000, COL.panel).setOrigin(0).setStrokeStyle(4, COL.gold);
    this.panel.setInteractive();
    this.title = txt(s, 70, 200, '', 28, TXT.gold).setOrigin(0, 0.5);
    this.closeBtn = new Button(s, W - 130, 200, 140, 56, STR.close, () => this.close(), { fontSize: 20, color: COL.card, border: COL.border });
    this.current = txt(s, 70, 262, '', 19, TXT.dim).setOrigin(0, 0.5);
    this.removeBtn = new Button(s, W - 150, 262, 180, 52, STR.socketRemove, () => this.doRemove(), {
      fontSize: 20, color: COL.danger, border: COL.dangerBorder,
    });
    this.empty = txt(s, W / 2, 560, STR.gemsEmpty, 21, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 160);
    this.add([this.panel, this.title, this.closeBtn, this.current, this.removeBtn, this.empty]);
    this.rows = [];
    for (let i = 0; i < PER_PAGE; i++) {
      const y = 300 + i * ROW_H;
      const bg = frame(s, 64, y, W - 128, ROW_H - 8, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
      const icon = s.add.image(108, y + 44, 'gem_ruby').setScale(6);
      const name = txt(s, 150, y + 26, '', 22, TXT.main).setOrigin(0, 0.5);
      const eff = txt(s, 150, y + 58, '', 18, TXT.gold).setOrigin(0, 0.5);
      const row = { bg, icon, name, eff, key: null };
      row.btn = new Button(s, W - 150, y + 44, 150, 60, STR.socketPut, () => this.doPut(row.key), { fontSize: 20 });
      this.add([bg, icon, name, eff, row.btn]);
      this.rows.push(row);
    }
    this.pageText = txt(s, W / 2, 1000 + 95, '', 22, TXT.dim).setOrigin(0.5);
    this.prevBtn = new Button(s, 240, 1095, 120, 54, '<', () => this.turn(-1), { fontSize: 26, color: COL.card, border: COL.border });
    this.nextBtn = new Button(s, 480, 1095, 120, 54, '>', () => this.turn(1), { fontSize: 26, color: COL.card, border: COL.border });
    this.add([this.pageText, this.prevBtn, this.nextBtn]);
  }

  show(hero, i) {
    this.hero = hero;
    this.i = i;
    this.page = 0;
    this.refresh();
    this.open();
  }

  pages() { return Math.max(1, Math.ceil(gemStacks().length / PER_PAGE)); }

  turn(d) {
    this.page = Phaser.Math.Wrap(this.page + d, 0, this.pages());
    this.refresh();
  }

  refresh() {
    const cur = this.hero.gems[this.i];
    this.title.setText(STR.socketTitle(this.i + 1));
    fit(this.current.setText(cur ? `${gemLabel(cur)}: ${gemEffect(cur)}` : STR.socketFree), 380);
    this.removeBtn.setVisible(!!cur);
    const stacks = gemStacks();
    this.page = Math.min(this.page, this.pages() - 1);
    this.empty.setVisible(stacks.length === 0);
    this.pageText.setText(`${this.page + 1}/${this.pages()}`);
    [this.prevBtn, this.nextBtn, this.pageText].forEach((o) => o.setVisible(stacks.length > PER_PAGE));
    const slice = stacks.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.rows.forEach((r, i) => {
      const g = slice[i] || null;
      r.key = g ? g.key : null;
      [r.bg, r.icon, r.name, r.eff, r.btn].forEach((o) => o.setVisible(!!g));
      if (!g) return;
      r.icon.setTexture(`gem_${g.type}`);
      r.name.setText(`${gemLabel(g.key)}  x${g.n}`);
      r.eff.setText(gemEffect(g.key));
    });
  }

  doPut(key) {
    if (key && socketGem(this.hero, this.i, key)) {
      this.onChanged?.();
      this.close();
    }
  }

  doRemove() {
    unsocketGem(this.hero, this.i);
    this.onChanged?.();
    this.refresh();
  }
}
