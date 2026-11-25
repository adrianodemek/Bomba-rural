// Aba Ritual: três salas ilustradas — Forja (fortalecer itens), Gemas (fundir gemas) e Altar (subir raridade).
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS, RARITY_TEXT, RARITY_NAMES } from '../data/heroes.js';
import { slotById } from '../data/items.js';
import { WORLDS } from '../data/worlds.js';
import { parseGem, gemKey } from '../data/gems.js';
import { economy } from '../systems/Economy.js';
import { itemPower, forgeCost, forgeChance, forgeBreakChance, canAffordForge, forge } from '../systems/Items.js';
import { gemStacks, canMerge, mergeGem, mergeAll, mergeCost } from '../systems/Gems.js';
import { recipes, canCombine, combine } from '../systems/Altar.js';
import { Sfx } from '../systems/Sfx.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { RoomView } from './RoomView.js';
import { txt, fit, card } from './widgets.js';
import { fmt } from './format.js';
import { itemIcon, itemTitle } from './itemText.js';
import { gemLabel, gemEffect } from './gemText.js';

const W = BALANCE.screen.width;
const ROOM_Y = 92;
const BODY_Y = ROOM_Y + 368;        // começo da parte de baixo (controles)
const ROWS = 4;
const ROW_H = 92;
const STRIP = 6;                    // itens por página na faixa da Forja
const ROOMS = [['forja', 'forge'], ['gemas', 'gems'], ['camara', 'altar']];

export class RitualPanel extends Panel {
  constructor(scene, { onClose, onGemMerged, onCombined, onItem }) {
    super(scene, STR.ritualTitle, onClose);
    this.view = 'forja';
    this.onItem = onItem;
    this.room = new RoomView(scene, 24, ROOM_Y);
    this.add(this.room);
    this.roomName = txt(scene, 40, ROOM_Y + 22, '', 22, TXT.gold, true).setOrigin(0, 0.5).setStroke('#12081c', 6);
    this.add(this.roomName);
    // Botões das salas (no alto, ao lado do título).
    this.roomBtns = ROOMS.map(([id, key], i) => {
      const b = new Button(scene, 236 + i * 118, 44, 112, 52, STR.ritualRooms[id], () => { this.view = id; this.refresh(); }, {
        fontSize: 18, color: COL.card, border: COL.border,
      });
      b.viewId = id;
      this.add(b);
      return b;
    });
    this.views = {};
    this.buildForge(scene);
    this.buildGems(scene, onGemMerged);
    this.buildAltar(scene, onCombined);
    this.onOpen = () => this.refresh();
  }

  // ---------- Forja ----------
  buildForge(s) {
    const v = this.views.forja = s.add.container(0, 0);
    this.add(v);
    this.forgePage = 0;
    this.sel = null;
    v.add(txt(s, 24, BODY_Y + 14, STR.forgePick, 18, TXT.dim).setOrigin(0, 0.5));
    const cw = 98;
    const x0 = (W - (STRIP * cw + (STRIP - 1) * 8) - 2 * 52) / 2 + 52;
    this.stripCells = [];
    for (let i = 0; i < STRIP; i++) {
      const x = x0 + i * (cw + 8);
      const y = BODY_Y + 34;
      const bg = card(s, x, y, cw, cw, COL.border, 0x120a1e);
      const icon = s.add.image(x + cw / 2, y + cw / 2, 'item_ring_0').setScale(5);
      const plus = txt(s, x + 8, y + 14, '', 17, TXT.main).setOrigin(0, 0.5).setStroke('#12081c', 4);
      bg.setInteractive({ useHandCursor: true });
      const c = { bg, icon, plus, item: null };
      bg.on('pointerup', () => { if (c.item) { this.sel = c.item.uid; this.refresh(); } });
      v.add([bg, icon, plus]);
      this.stripCells.push(c);
    }
    this.prevBtn = new Button(s, x0 - 30, BODY_Y + 34 + cw / 2, 46, cw, '<', () => this.turn(-1), { fontSize: 24, color: COL.card, border: COL.border });
    this.nextBtn = new Button(s, x0 + STRIP * (cw + 8) + 22, BODY_Y + 34 + cw / 2, 46, cw, '>', () => this.turn(1), { fontSize: 24, color: COL.card, border: COL.border });
    v.add([this.prevBtn, this.nextBtn]);
    const by = BODY_Y + 150;
    v.add(card(s, 24, by, W - 48, 150, COL.gold));
    this.selIcon = s.add.image(92, by + 75, 'item_ring_0').setScale(8);
    this.selTitle = txt(s, 160, by + 30, '', 24, TXT.main).setOrigin(0, 0.5);
    this.selChance = txt(s, 160, by + 66, '', 19, TXT.dim).setOrigin(0, 0.5);
    this.selCost = txt(s, 160, by + 100, '', 19, TXT.gold).setOrigin(0, 0.5);
    this.selInfo = new Button(s, W - 100, by + 38, 120, 48, STR.itemInfo, () => { const it = this.selected(); if (it) this.onItem(it); }, {
      fontSize: 17, color: COL.card, border: COL.border,
    });
    this.forgeEmpty = txt(s, W / 2, by + 75, STR.forgeEmpty, 20, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 100);
    v.add([this.selIcon, this.selTitle, this.selChance, this.selCost, this.selInfo, this.forgeEmpty]);
    this.forgeBtn = new Button(s, W / 2, by + 196, W - 120, 74, '', () => this.doForge(), {
      fontSize: 24, color: COL.active, border: COL.activeBorder,
      onDisabledClick: () => {
        const it = this.selected();
        s.toast.show(it && it.plus >= BALANCE.forge.maxPlus ? STR.forgeMax : STR.forgeNoRes, 1400);
      },
    });
    v.add(this.forgeBtn);
    // faíscas na bigorna
    this.anvilSparks = s.add.particles(0, 0, 'spark', {
      speed: { min: 90, max: 260 }, angle: { min: 200, max: 340 }, lifespan: 600, gravityY: 500,
      scale: { start: 2.4, end: 0 }, tint: [0xffd060, 0xff8a30, 0xffffff], emitting: false,
    });
    v.add(this.anvilSparks);
  }

  sortedItems() {
    return [...economy.items].sort((a, b) => b.rarity - a.rarity || itemPower(b) - itemPower(a) || a.uid - b.uid);
  }

  selected() {
    return this.sel !== null ? economy.itemByUid(this.sel) : null;
  }

  turn(d) {
    const pages = Math.max(1, Math.ceil(economy.items.length / STRIP));
    this.forgePage = Phaser.Math.Wrap(this.forgePage + d, 0, pages);
    this.refresh();
  }

  doForge() {
    const it = this.selected();
    if (!it) return;
    const chance = forgeChance(it);
    if (chance < 1 && !this.armed) {
      this.armed = true;
      this.forgeBtn.setLabel(STR.forgeConfirm(Math.round(chance * 100)));
      this.scene.time.delayedCall(2500, () => { this.armed = false; this.refresh(); });
      return;
    }
    this.armed = false;
    const r = forge(it);
    const cam = this.scene.cameras.main;
    this.anvilSparks.explode(r === 'success' ? 40 : 14, 24 + 330, ROOM_Y + 222);
    if (r === 'success') { Sfx.play('reward'); this.scene.toast.show(STR.forgeSuccess(it.plus), 1400); this.room.cheer(); }
    else if (r === 'fail') { Sfx.play('fail'); this.scene.toast.show(STR.forgeFail, 1600); cam.shake(160, 0.006); }
    else if (r === 'broke') { Sfx.play('fail'); this.scene.toast.show(STR.forgeBroke, 2000); cam.shake(300, 0.012); }
    this.scene.saveSoon?.();
    this.refresh();
  }

  refreshForge() {
    const list = this.sortedItems();
    const pages = Math.max(1, Math.ceil(list.length / STRIP));
    this.forgePage = Math.min(this.forgePage, pages - 1);
    if (!this.selected() && list.length) this.sel = list[0].uid;
    const page = list.slice(this.forgePage * STRIP, (this.forgePage + 1) * STRIP);
    this.stripCells.forEach((c, i) => {
      const it = page[i] || null;
      c.item = it;
      c.icon.setVisible(!!it);
      c.plus.setVisible(!!it && it.plus > 0);
      const on = it && it.uid === this.sel;
      c.bg.setStrokeStyle(on ? 5 : 3, on ? COL.gold : it && it.rarity > 0 ? RARITY_COLORS[it.rarity] : COL.border);
      if (!it) return;
      c.icon.setTexture(itemIcon(it));
      c.plus.setText(`+${it.plus}`);
    });
    this.prevBtn.setVisible(pages > 1);
    this.nextBtn.setVisible(pages > 1);
    const it = this.selected();
    [this.selIcon, this.selTitle, this.selChance, this.selCost, this.selInfo].forEach((o) => o.setVisible(!!it));
    this.forgeEmpty.setVisible(!it);
    if (!it) { this.forgeBtn.setLabel(STR.forgeBtnIdle).setEnabled(false); return; }
    this.selIcon.setTexture(itemIcon(it));
    fit(this.selTitle.setText(itemTitle(it)).setColor(RARITY_TEXT[it.rarity]), 380);
    if (it.plus >= BALANCE.forge.maxPlus) {
      this.selChance.setText(STR.forgeMax);
      this.selCost.setText('');
      this.forgeBtn.setLabel(STR.forgeMax).setEnabled(false);
      return;
    }
    const chance = forgeChance(it);
    const cost = forgeCost(it);
    this.selChance.setText(STR.forgeChance(Math.round(chance * 100), Math.round(forgeBreakChance(it) * 100)))
      .setColor(chance >= 1 ? TXT.good : chance >= 0.5 ? TXT.gold : TXT.bad);
    fit(this.selCost.setText(STR.forgeCostLine(fmt(cost.gold), cost.minerals, WORLDS[cost.world].mineral.name)), 380);
    if (!this.armed) this.forgeBtn.setLabel(STR.forgeBtnShort(it.plus + 1));
    this.forgeBtn.setEnabled(canAffordForge(it));
  }

  // ---------- Gemas ----------
  buildGems(s, onGemMerged) {
    const v = this.views.gemas = s.add.container(0, 0);
    this.add(v);
    this.gemPage = 0;
    this.gemsEmpty = txt(s, W / 2, BODY_Y + 180, STR.gemsEmpty, 21, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 120);
    v.add(this.gemsEmpty);
    this.gemRows = [];
    for (let i = 0; i < ROWS; i++) {
      const y = BODY_Y + 6 + i * ROW_H;
      const bg = card(s, 24, y, W - 48, ROW_H - 8);
      const icon = s.add.image(68, y + 42, 'gem_ruby').setScale(5);
      const name = txt(s, 112, y + 20, '', 21, TXT.main).setOrigin(0, 0.5);
      const eff = txt(s, 112, y + 46, '', 17, TXT.gold).setOrigin(0, 0.5);
      const count = txt(s, 112, y + 68, '', 16, TXT.dim).setOrigin(0, 0.5);
      const row = { bg, icon, name, eff, count, key: null };
      row.one = new Button(s, 470, y + 42, 170, 60, '', () => this.doMerge(row.key, false, onGemMerged), {
        fontSize: 16, color: COL.royal, border: COL.royalBorder, onDisabledClick: () => s.toast.show(STR.gemNeed, 1600),
      });
      row.all = new Button(s, 618, y + 42, 116, 60, STR.gemMergeAll, () => this.doMerge(row.key, true, onGemMerged), {
        fontSize: 16, color: COL.card, border: COL.border, onDisabledClick: () => s.toast.show(STR.gemNeed, 1600),
      });
      v.add([bg, icon, name, eff, count, row.one, row.all]);
      this.gemRows.push(row);
    }
    this.gemPager = this.pager(s, v, BODY_Y + ROWS * ROW_H + 30, (d) => this.turnGems(d));
  }

  pager(s, v, y, fn) {
    const t = txt(s, W / 2, y, '', 20, TXT.dim).setOrigin(0.5);
    const a = new Button(s, 250, y, 110, 48, '<', () => fn(-1), { fontSize: 24, color: COL.card, border: COL.border });
    const b = new Button(s, 470, y, 110, 48, '>', () => fn(1), { fontSize: 24, color: COL.card, border: COL.border });
    v.add([t, a, b]);
    return { t, items: [t, a, b] };
  }

  turnGems(d) {
    const pages = Math.max(1, Math.ceil(gemStacks().length / ROWS));
    this.gemPage = Phaser.Math.Wrap(this.gemPage + d, 0, pages);
    this.refresh();
  }

  doMerge(key, all, cb) {
    if (!key) return;
    const g = parseGem(key);
    const n = all ? mergeAll(key) : (mergeGem(key) ? 1 : 0);
    if (n > 0) {
      Sfx.play('reward');
      this.room.cheer();
      this.scene.toast.show(STR.gemMerged(gemLabel(gemKey(g.type, g.lvl + 1))), 1400);
      cb?.();
    }
    this.refresh();
  }

  refreshGems() {
    const stacks = gemStacks();
    const pages = Math.max(1, Math.ceil(stacks.length / ROWS));
    this.gemPage = Math.min(this.gemPage, pages - 1);
    this.gemPager.t.setText(`${this.gemPage + 1}/${pages}`);
    this.gemPager.items.forEach((o) => o.setVisible(pages > 1));
    this.gemsEmpty.setVisible(stacks.length === 0);
    const slice = stacks.slice(this.gemPage * ROWS, (this.gemPage + 1) * ROWS);
    this.gemRows.forEach((r, i) => {
      const g = slice[i] || null;
      r.key = g ? g.key : null;
      [r.bg, r.icon, r.name, r.eff, r.count, r.one, r.all].forEach((o) => o.setVisible(!!g));
      if (!g) return;
      r.icon.setTexture(`gem_${g.type}`);
      r.name.setText(gemLabel(g.key));
      r.eff.setText(gemEffect(g.key));
      r.count.setText(`x${g.n}`);
      const maxed = g.lvl >= BALANCE.gems.maxLevel;
      r.one.setLabel(maxed ? STR.gemMax : STR.gemMerge(fmt(mergeCost(g.lvl)))).setEnabled(canMerge(g.key));
      r.all.setEnabled(canMerge(g.key));
    });
  }

  // ---------- Altar (subir raridade) ----------
  buildAltar(s, onCombined) {
    const v = this.views.camara = s.add.container(0, 0);
    this.add(v);
    this.altarPage = 0;
    this.altarEmpty = txt(s, W / 2, BODY_Y + 180, STR.altarEmpty, 21, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 120);
    v.add(this.altarEmpty);
    this.altarRows = [];
    for (let i = 0; i < ROWS; i++) {
      const y = BODY_Y + 6 + i * ROW_H;
      const bg = card(s, 24, y, W - 48, ROW_H - 8);
      const icon = s.add.image(68, y + 42, 'item_ring_0').setScale(5);
      const name = txt(s, 112, y + 26, '', 19, TXT.main).setOrigin(0, 0.5);
      const have = txt(s, 112, y + 58, '', 16, TXT.dim).setOrigin(0, 0.5);
      const row = { bg, icon, name, have, rec: null };
      row.btn = new Button(s, 590, y + 42, 196, 62, '', () => this.doCombine(row.rec, onCombined), {
        fontSize: 17, color: COL.royal, border: COL.royalBorder, onDisabledClick: () => s.toast.show(STR.altarNeed, 2000),
      });
      v.add([bg, icon, name, have, row.btn]);
      this.altarRows.push(row);
    }
    this.altarPager = this.pager(s, v, BODY_Y + ROWS * ROW_H + 30, (d) => this.turnAltar(d));
  }

  onField() {
    return new Set(this.scene.battle.field.keys());
  }

  turnAltar(d) {
    const pages = Math.max(1, Math.ceil(recipes(this.onField()).length / ROWS));
    this.altarPage = Phaser.Math.Wrap(this.altarPage + d, 0, pages);
    this.refresh();
  }

  doCombine(rec, cb) {
    if (!rec) return;
    const r = combine(rec, this.onField());
    if (r) { this.room.cheer(); cb?.(r); }
    this.refresh();
  }

  refreshAltar() {
    const list = recipes(this.onField());
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.altarPage = Math.min(this.altarPage, pages - 1);
    this.altarPager.t.setText(`${this.altarPage + 1}/${pages}`);
    this.altarPager.items.forEach((o) => o.setVisible(pages > 1));
    this.altarEmpty.setVisible(list.length === 0);
    const slice = list.slice(this.altarPage * ROWS, (this.altarPage + 1) * ROWS);
    const field = this.onField();
    this.altarRows.forEach((r, i) => {
      const rec = slice[i] || null;
      r.rec = rec;
      [r.bg, r.icon, r.name, r.have, r.btn].forEach((o) => o.setVisible(!!rec));
      if (!rec) return;
      const from = RARITY_NAMES[rec.rarity];
      const to = RARITY_NAMES[rec.rarity + 1];
      if (rec.kind === 'item') {
        r.icon.setTexture(`item_${rec.slot}_${rec.rarity + 1}`).setScale(5);
        fit(r.name.setText(STR.altarItem(rec.need, slotById(rec.slot).name, from, to)), 360);
      } else {
        r.icon.setTexture('ui_heroes').setScale(3);
        fit(r.name.setText(STR.altarHero(rec.need, from, to)), 360);
      }
      r.name.setColor(RARITY_TEXT[rec.rarity + 1]);
      const ready = rec.have >= rec.need;
      r.have.setText(STR.altarHave(Math.min(rec.have, rec.need), rec.need)).setColor(ready ? TXT.good : TXT.dim);
      r.bg.setStrokeStyle(3, ready ? RARITY_COLORS[rec.rarity + 1] : COL.border);
      r.btn.setLabel(STR.altarBtn(fmt(rec.cost))).setEnabled(canCombine(rec, field));
    });
  }

  refresh() {
    for (const [id, c] of Object.entries(this.views)) c.setVisible(id === this.view);
    this.roomBtns.forEach((b) => {
      const on = b.viewId === this.view;
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
    });
    this.room.setRoom(this.view);
    this.roomName.setText(STR.ritualRoomNames[this.view]);
    if (this.view === 'forja') this.refreshForge();
    else if (this.view === 'gemas') this.refreshGems();
    else this.refreshAltar();
  }
}
