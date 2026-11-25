// Escolher item para um espaço do herói (lista paginada, melhor primeiro).
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS, RARITY_TEXT } from '../data/heroes.js';
import { gearSlotByKey, SETS } from '../data/items.js';
import { economy } from '../systems/Economy.js';
import { itemPower, compareToEquipped } from '../systems/Items.js';
import { cmpShort, cmpColor } from './compareText.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { itemTitle, itemStatLines, itemIcon } from './itemText.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const PER_PAGE = 6;
const ROW_H = 106;
const LIST_Y = 330;

export class ItemPicker extends Modal {
  constructor(scene, onChanged) {
    super(scene, 360);
    const s = scene;
    this.onChanged = onChanged;
    this.page = 0;
    this.panel = frame(s, 40, 150, W - 80, 1000, COL.panel).setOrigin(0).setStrokeStyle(4, COL.gold);
    this.panel.setInteractive();
    this.title = txt(s, 70, 200, '', 28, TXT.gold).setOrigin(0, 0.5);
    this.closeBtn = new Button(s, W - 130, 200, 140, 56, STR.close, () => this.close(), {
      fontSize: 20, color: COL.card, border: COL.border,
    });
    this.currentText = txt(s, 70, 262, '', 19, TXT.dim).setOrigin(0, 0.5);
    this.removeBtn = new Button(s, W - 150, 262, 180, 52, STR.unequip, () => this.doRemove(), {
      fontSize: 20, color: COL.danger, border: COL.dangerBorder,
    });
    this.empty = txt(s, W / 2, 560, STR.noItemsForSlot, 21, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 160);
    this.add([this.panel, this.title, this.closeBtn, this.currentText, this.removeBtn, this.empty]);

    this.rows = [];
    for (let i = 0; i < PER_PAGE; i++) {
      const y = LIST_Y + i * ROW_H;
      const bg = frame(s, 64, y - 46, W - 128, ROW_H - 10, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
      const icon = s.add.image(112, y + 4, 'item_ring_0').setScale(5);
      const name = txt(s, 160, y - 20, '', 22, TXT.main).setOrigin(0, 0.5);
      const stat = txt(s, 160, y + 8, '', 18, TXT.gold).setOrigin(0, 0.5);
      const extra = txt(s, 160, y + 32, '', 16, TXT.dim).setOrigin(0, 0.5);
      const btn = new Button(s, W - 140, y + 4, 140, 60, STR.equip, () => this.doEquip(row.item), { fontSize: 22 });
      const row = { bg, icon, name, stat, extra, btn, item: null };
      this.add([bg, icon, name, stat, extra, btn]);
      this.rows.push(row);
    }
    this.prevBtn = new Button(s, 240, 1000 + 75, 120, 56, '<', () => this.turn(-1), { fontSize: 26, color: COL.card, border: COL.border });
    this.pageText = txt(s, W / 2, 1075, '', 22, TXT.dim).setOrigin(0.5);
    this.nextBtn = new Button(s, 480, 1075, 120, 56, '>', () => this.turn(1), { fontSize: 26, color: COL.card, border: COL.border });
    this.add([this.prevBtn, this.pageText, this.nextBtn]);
  }

  // key = espaço do herói (ex.: 'ring2'); o tipo do item vem de GEAR_SLOTS.
  show(hero, key) {
    this.hero = hero;
    this.slot = key;
    this.type = gearSlotByKey(key).type;
    this.page = 0;
    this.refresh();
    this.open();
  }

  itemsForSlot() {
    return economy.items.filter((it) => it.slot === this.type && it.uid !== this.hero.gear[this.slot])
      .sort((a, b) => itemPower(b) - itemPower(a));
  }

  pages() { return Math.max(1, Math.ceil(this.itemsForSlot().length / PER_PAGE)); }

  turn(d) {
    this.page = Phaser.Math.Wrap(this.page + d, 0, this.pages());
    this.refresh();
  }

  refresh() {
    const h = this.hero;
    this.title.setText(STR.chooseSlot(gearSlotByKey(this.slot).name));
    const cur = economy.itemByUid(h.gear[this.slot]);
    this.currentText.setText(cur ? `${h.name}: ${itemTitle(cur)}` : `${h.name}: —`);
    fit(this.currentText, 360);
    this.removeBtn.setVisible(!!cur);

    const list = this.itemsForSlot();
    this.page = Math.min(this.page, this.pages() - 1);
    const slice = list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.empty.setVisible(list.length === 0);
    this.pageText.setText(`${this.page + 1}/${this.pages()}`);
    [this.prevBtn, this.nextBtn, this.pageText].forEach((o) => o.setVisible(list.length > PER_PAGE));

    this.rows.forEach((r) => {
      const it = slice.shift() || null;
      r.item = it;
      [r.bg, r.icon, r.name, r.stat, r.extra, r.btn].forEach((o) => o.setVisible(!!it));
      if (!it) return;
      r.bg.setStrokeStyle(3, it.rarity > 0 ? RARITY_COLORS[it.rarity] : COL.border);
      r.icon.setTexture(itemIcon(it));
      fit(r.name.setText(`${itemTitle(it)}${it.stars ? ' ' + '★'.repeat(it.stars) : ''}`), 300).setColor(RARITY_TEXT[it.rarity]);
      r.stat.setText(itemStatLines(it)[0].text);
      const owner = economy.equippedBy(it.uid);
      const c = compareToEquipped(it, h, this.slot);
      const parts = [cmpShort(c)];
      if (it.set) parts.push(SETS[it.set].name);
      if (owner) parts.push(STR.usedBy(owner.name));
      fit(r.extra.setText(parts.filter(Boolean).join(' · ')).setColor(cmpColor(c)), 300);
    });
  }

  doEquip(item) {
    if (!item) return;
    economy.equip(this.hero, item, this.slot);
    this.onChanged?.();
    this.close();
  }

  doRemove() {
    economy.unequip(this.hero, this.slot);
    this.onChanged?.();
    this.refresh();
  }
}
