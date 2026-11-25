// Escolher herói e duração para uma expedição.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS } from '../data/heroes.js';
import { statsOf } from '../systems/Roster.js';
import { eligibleHeroes, previewReward } from '../systems/Expeditions.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { fmt } from './format.js';
import { setHeroPortrait } from '../art/hd.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const PER_PAGE = 6;
const ROW_H = 118;

export class ExpeditionPicker extends Modal {
  constructor(scene, onPick) {
    super(scene, 360);
    const s = scene;
    this.page = 0;
    this.panel = frame(s, 40, 150, W - 80, 1000, COL.panel).setOrigin(0).setStrokeStyle(4, COL.gold);
    this.panel.setInteractive();
    this.title = txt(s, 70, 200, STR.expPickTitle, 28, TXT.gold).setOrigin(0, 0.5);
    this.closeBtn = new Button(s, W - 130, 200, 140, 56, STR.close, () => this.close(), { fontSize: 20, color: COL.card, border: COL.border });
    this.empty = txt(s, W / 2, 560, STR.expNoHeroes, 21, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 160);
    this.add([this.panel, this.title, this.closeBtn, this.empty]);
    this.rows = [];
    for (let i = 0; i < PER_PAGE; i++) {
      const y = 250 + i * ROW_H;
      const bg = frame(s, 64, y, W - 128, ROW_H - 10, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
      const portrait = s.add.sprite(104, y + 40, 'hero0_down_0').setScale(3);
      const name = txt(s, 140, y + 24, '', 20, TXT.main).setOrigin(0, 0.5);
      const power = txt(s, 140, y + 50, '', 16, TXT.gold).setOrigin(0, 0.5);
      const row = { bg, portrait, name, power, hero: null };
      row.btns = BALANCE.expeditions.hours.map((h, k) => {
        const b = new Button(s, 150 + k * 170, y + 84, 156, 38, '', () => { if (row.hero) { onPick(row.hero, h); this.close(); } }, {
          fontSize: 15, color: COL.btn, border: COL.btnBorder,
        });
        b.hours = h;
        return b;
      });
      this.add([bg, portrait, name, power, ...row.btns]);
      this.rows.push(row);
    }
    this.pageText = txt(s, W / 2, 1095, '', 22, TXT.dim).setOrigin(0.5);
    this.prevBtn = new Button(s, 240, 1095, 120, 54, '<', () => this.turn(-1), { fontSize: 26, color: COL.card, border: COL.border });
    this.nextBtn = new Button(s, 480, 1095, 120, 54, '>', () => this.turn(1), { fontSize: 26, color: COL.card, border: COL.border });
    this.add([this.pageText, this.prevBtn, this.nextBtn]);
  }

  show() {
    this.page = 0;
    this.refresh();
    this.open();
  }

  heroListSorted() {
    return eligibleHeroes().sort((a, b) => statsOf(b).power - statsOf(a).power);
  }

  turn(d) {
    const pages = Math.max(1, Math.ceil(this.heroList().length / PER_PAGE));
    this.page = Phaser.Math.Wrap(this.page + d, 0, pages);
    this.refresh();
  }

  heroList() { return this.heroListSorted(); }

  refresh() {
    const all = this.heroList();
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    this.empty.setVisible(all.length === 0);
    this.pageText.setText(`${this.page + 1}/${pages}`);
    [this.prevBtn, this.nextBtn, this.pageText].forEach((o) => o.setVisible(pages > 1));
    const slice = all.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.rows.forEach((r, i) => {
      const h = slice[i] || null;
      r.hero = h;
      [r.bg, r.portrait, r.name, r.power, ...r.btns].forEach((o) => o.setVisible(!!h));
      if (!h) return;
      r.bg.setStrokeStyle(3, h.rarity > 0 ? RARITY_COLORS[h.rarity] : COL.border);
      setHeroPortrait(r.portrait, h);
      fit(r.name.setText(h.name), 440);
      r.power.setText(STR.powerShort(fmt(statsOf(h).power)));
      r.btns.forEach((b) => b.setLabel(`${STR.expHours(b.hours)} · ${fmt(previewReward(h, b.hours).gold)}`));
    });
  }
}
