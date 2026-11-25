// Aba Inventário: boneco do herói com os 10 espaços de equipamento + bolsa de itens em páginas.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS, RARITY_TEXT, RARITY_NAMES, PALETTES } from '../data/heroes.js';
import { GEAR_SLOTS } from '../data/items.js';
import { economy } from '../systems/Economy.js';
import { statsOf } from '../systems/Roster.js';
import { itemPower, compareToEquipped } from '../systems/Items.js';
import { CMP_TINT } from './compareText.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card } from './widgets.js';
import { fmt } from './format.js';
import { itemIcon } from './itemText.js';
import { setHeroPortrait, heroAnim } from '../art/hd.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const SLOT = 82;
const SLOT_GAP = 8;
const DOLL_Y = 158;
const BAG_COLS = 7;
const BAG_ROWS = 2 + Math.max(0, Math.floor((BALANCE.layout.tabsY - BALANCE.layout.arenaY - 930) / (86 + 6)));   // a tela alta ganha mais linhas
const CELL = 86;
const BAG_Y = 640;
const SORTS = ['rarity', 'slot', 'power'];

export class InventoryPanel extends Panel {
  constructor(scene, { onClose, onReveal, onItem, onSlot, onSalvageCommons }) {
    super(scene, STR.inventoryTitle, onClose);
    this.heroIdx = 0;
    this.page = 0;
    this.sort = 'rarity';
    const s = scene;

    // Escolha do herói
    this.prevHero = new Button(s, 70, 112, 70, 54, '<', () => this.turnHero(-1), { fontSize: 26, color: COL.card, border: COL.border });
    this.nextHero = new Button(s, W - 70, 112, 70, 54, '>', () => this.turnHero(1), { fontSize: 26, color: COL.card, border: COL.border });
    this.heroName = txt(s, W / 2, 100, '', 24, TXT.main, true).setOrigin(0.5);
    this.heroSub = txt(s, W / 2, 128, '', 17, TXT.dim).setOrigin(0.5);
    this.add([this.prevHero, this.nextHero, this.heroName, this.heroSub]);

    // Boneco: 5 espaços de cada lado, herói grande no meio
    const left = GEAR_SLOTS.slice(0, 5);
    const right = GEAR_SLOTS.slice(5);
    this.slotCells = [];
    [[left, 28], [right, W - 28 - SLOT]].forEach(([list, x]) => {
      list.forEach((sl, i) => {
        const y = DOLL_Y + i * (SLOT + SLOT_GAP);
        const bg = card(s, x, y, SLOT, SLOT, COL.border, 0x120a1e);
        const icon = s.add.image(x + SLOT / 2, y + SLOT / 2 - 4, `item_${sl.type}_empty`).setScale(5);
        const plus = txt(s, x + 6, y + 12, '', 15, TXT.main).setOrigin(0, 0.5).setStroke('#12081c', 4);
        const label = txt(s, x + SLOT / 2, y + SLOT - 9, sl.name, 12, TXT.dim).setOrigin(0.5);
        fit(label, SLOT - 6);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerup', () => { const h = this.hero(); if (h) onSlot(h, sl.key); });
        this.add([bg, icon, plus, label]);
        this.slotCells.push({ key: sl.key, type: sl.type, bg, icon, plus, label });
      });
    });
    const cx = W / 2;
    this.pedestal = s.add.ellipse(cx, DOLL_Y + 300, 200, 40, 0x120a1e, 0.6);
    this.glow = s.add.circle(cx, DOLL_Y + 190, 120, 0xffffff, 0.06);
    // Escala que dá 6 pixels de tela por pixel da arte (fica nítido e preenche o círculo).
    this.portrait = s.add.sprite(cx, DOLL_Y + 196, 'hero0_down_0').setScale(6 / 0.65);
    this.add([this.glow, this.pedestal, this.portrait]);
    // Tocar no herói: ele comemora uma vez e volta a respirar.
    this.portrait.setInteractive({ useHandCursor: true });
    this.portrait.on('pointerup', () => {
      const h = this.hero();
      const cheer = h && heroAnim(h, 'cheer');
      if (!cheer || !s.anims.exists(cheer)) return;
      this.portrait.play({ key: cheer, repeat: 1 });
      this.portrait.once('animationcomplete', () => {
        this.portrait.play({ key: heroAnim(h, 'idle') });
      });
    });
    this.statLines = [0, 1, 2].map((i) => {
      const t = txt(s, cx, DOLL_Y + 336 + i * 24, '', 17, TXT.main).setOrigin(0.5);
      this.add(t);
      return t;
    });
    this.powerText = txt(s, cx, DOLL_Y + 30, '', 22, TXT.gold, true).setOrigin(0.5).setStroke('#12081c', 6);
    this.add(this.powerText);

    // Bolsa
    this.bagTitle = txt(s, 24, BAG_Y - 22, '', 21, TXT.gold).setOrigin(0, 0.5);
    this.pageText = txt(s, W - 140, BAG_Y - 22, '', 18, TXT.dim).setOrigin(0.5);
    this.prevBtn = new Button(s, W - 196, BAG_Y - 22, 50, 40, '<', () => this.turn(-1), { fontSize: 22, color: COL.card, border: COL.border });
    this.nextBtn = new Button(s, W - 84, BAG_Y - 22, 50, 40, '>', () => this.turn(1), { fontSize: 22, color: COL.card, border: COL.border });
    this.sortBtn = new Button(s, 330, BAG_Y - 22, 150, 40, '', () => this.cycleSort(), { fontSize: 16, color: COL.card, border: COL.border });
    this.add([this.bagTitle, this.pageText, this.prevBtn, this.nextBtn, this.sortBtn]);
    const gx = (W - (BAG_COLS * CELL + (BAG_COLS - 1) * 6)) / 2;
    this.cells = [];
    for (let i = 0; i < BAG_COLS * BAG_ROWS; i++) {
      const x = gx + (i % BAG_COLS) * (CELL + 6);
      const y = BAG_Y + Math.floor(i / BAG_COLS) * (CELL + 6);
      const bg = card(s, x, y, CELL, CELL, COL.border, 0x120a1e);
      const icon = s.add.image(x + CELL / 2, y + CELL / 2, 'item_ring_0').setScale(5);
      const plus = txt(s, x + 6, y + 12, '', 15, TXT.main).setOrigin(0, 0.5).setStroke('#12081c', 4);
      const owner = frame(s, x + CELL - 12, y + 12, 12, 12, 0xffffff).setStrokeStyle(2, 0x120a1e);
      const lock = s.add.image(x + 12, y + CELL - 12, 'icon_lock').setScale(2);
      const arrow = s.add.triangle(x + CELL - 14, y + CELL - 14, 0, 14, 7, 0, 14, 14, 0x7fe07a).setStrokeStyle(2, 0x120a1e);
      bg.setInteractive({ useHandCursor: true });
      const cell = { bg, icon, plus, owner, lock, arrow, item: null };
      bg.on('pointerup', () => { if (cell.item) onItem(cell.item, this.hero()); });
      this.add([bg, icon, plus, owner, lock, arrow]);
      this.cells.push(cell);
    }
    const by = BAG_Y + BAG_ROWS * (CELL + 6) + 36;
    this.revealBtn = new Button(s, 190, by, 330, 62, '', onReveal, {
      fontSize: 19, color: COL.active, border: COL.activeBorder,
      onDisabledClick: () => s.toast.show(economy.sealed.length ? STR.inventoryFull : STR.noSealed, 2400),
    });
    this.salvageBtn = new Button(s, 530, by, 330, 62, STR.salvageCommons, onSalvageCommons, {
      fontSize: 17, color: COL.card, border: COL.border,
    });
    this.add([this.revealBtn, this.salvageBtn]);
    this.onOpen = () => this.refresh();
  }

  heroes() {
    const team = new Set(economy.teamMembers(economy.activeTeam).map((h) => h.uid));
    return [...economy.heroes].sort((a, b) => (team.has(b.uid) - team.has(a.uid)) || b.rarity - a.rarity || b.level - a.level);
  }

  hero() {
    const list = this.heroes();
    if (!list.length) return null;
    this.heroIdx = Phaser.Math.Wrap(this.heroIdx, 0, list.length);
    return list[this.heroIdx];
  }

  // Mostra um herói específico (ex.: aberto pela ficha do herói).
  showHero(h) {
    const i = this.heroes().findIndex((x) => x.uid === h.uid);
    if (i >= 0) this.heroIdx = i;
    this.refresh();
  }

  turnHero(d) { this.heroIdx += d; this.refresh(); }

  sorted() {
    const by = {
      rarity: (a, b) => b.rarity - a.rarity || itemPower(b) - itemPower(a),
      slot: (a, b) => GEAR_SLOTS.findIndex((g) => g.type === a.slot) - GEAR_SLOTS.findIndex((g) => g.type === b.slot) || b.rarity - a.rarity,
      power: (a, b) => itemPower(b) - itemPower(a),
    }[this.sort];
    return [...economy.items].sort((a, b) => by(a, b) || a.uid - b.uid);
  }

  pages() { return Math.max(1, Math.ceil(economy.items.length / (BAG_COLS * BAG_ROWS))); }

  turn(d) { this.page = Phaser.Math.Wrap(this.page + d, 0, this.pages()); this.refresh(); }

  cycleSort() {
    this.sort = SORTS[(SORTS.indexOf(this.sort) + 1) % SORTS.length];
    this.page = 0;
    this.refresh();
  }

  refresh() {
    const h = this.hero();
    this.prevHero.setVisible(this.heroes().length > 1);
    this.nextHero.setVisible(this.heroes().length > 1);
    if (h) {
      const st = statsOf(h);
      fit(this.heroName.setText(h.name).setColor(RARITY_TEXT[h.rarity]), 420);
      this.heroSub.setText(STR.invHeroSub(RARITY_NAMES[h.rarity], h.level));
      setHeroPortrait(this.portrait, h);
      this.glow.setFillStyle(RARITY_COLORS[h.rarity], 0.12);
      this.powerText.setText(STR.invPower(fmt(st.power)));
      this.statLines[0].setText(STR.invStats1(fmt(st.attack), Math.round(st.maxEnergy)));
      this.statLines[1].setText(STR.invStats2(Math.round(st.critChance), Math.round(st.critDamage)));
      this.statLines[2].setText(STR.invStats3(st.range, st.bombs));
      this.slotCells.forEach((c) => {
        const it = economy.itemByUid(h.gear?.[c.key]);
        c.icon.setTexture(it ? itemIcon(it) : `item_${c.type}_empty`);
        c.plus.setText(it && it.plus ? `+${it.plus}` : '');
        c.bg.setStrokeStyle(3, it && it.rarity > 0 ? RARITY_COLORS[it.rarity] : COL.border);
        c.label.setColor(it ? TXT.main : TXT.dim);
      });
    }
    // bolsa
    this.bagTitle.setText(STR.itemsTitle(economy.items.length, BALANCE.items.inventoryMax));
    this.page = Math.min(this.page, this.pages() - 1);
    this.pageText.setText(`${this.page + 1}/${this.pages()}`);
    this.sortBtn.setLabel(STR.sortBy[this.sort]);
    const per = BAG_COLS * BAG_ROWS;
    const list = this.sorted().slice(this.page * per, (this.page + 1) * per);
    this.cells.forEach((c, i) => {
      const it = list[i] || null;
      c.item = it;
      c.icon.setVisible(!!it);
      c.plus.setVisible(!!it && it.plus > 0);
      const owner = it ? economy.equippedBy(it.uid) : null;
      c.owner.setVisible(!!owner);
      c.lock.setVisible(!!it && it.locked);
      c.bg.setStrokeStyle(3, it && it.rarity > 0 ? RARITY_COLORS[it.rarity] : COL.border);
      const cmp = it && h ? compareToEquipped(it, h) : null;
      const v = cmp?.verdict;
      c.arrow.setVisible(v === 'better' || v === 'empty' || v === 'worse');
      if (c.arrow.visible) c.arrow.setFillStyle(CMP_TINT[v]).setAngle(v === 'worse' ? 180 : 0);
      if (!it) return;
      c.icon.setTexture(itemIcon(it));
      c.plus.setText(`+${it.plus}`);
      if (owner) c.owner.setFillStyle(PALETTES[owner.palette].color);
    });
    this.revealBtn.setLabel(STR.revealN(economy.sealed.length))
      .setEnabled(economy.sealed.length > 0 && economy.items.length < BALANCE.items.inventoryMax);
  }
}
