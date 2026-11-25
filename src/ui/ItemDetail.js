// Ficha do item: atributos, conjunto, forja (com aviso de risco), fusão e desmontar.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS, RARITY_TEXT } from '../data/heroes.js';
import { SETS, GEAR_SLOTS } from '../data/items.js';
import { WORLDS } from '../data/worlds.js';
import { economy } from '../systems/Economy.js';
import {
  forgeCost, forgeChance, forgeBreakChance, canAffordForge, forge, canFuseItem, fuseItem, salvageValue, salvage, setCounts, toggleItemLock,
} from '../systems/Items.js';
import { Button } from './Button.js';
import { Modal, txt, fit, Stars } from './widgets.js';
import { fmt } from './format.js';
import { itemTitle, itemSubtitle, itemStatLines, setBonusLines, itemIcon } from './itemText.js';
import { compareToEquipped } from '../systems/Items.js';
import { cmpLong, cmpColor, CMP_TINT } from './compareText.js';
import { frame } from './skin.js';
import { premiumActive } from '../systems/Premium.js';

const W = BALANCE.screen.width;

export class ItemDetail extends Modal {
  constructor(scene) {
    super(scene, 350);
    const s = scene;
    this.item = null;
    this.panel = frame(s, 40, 150, W - 80, 990, COL.panel).setOrigin(0).setStrokeStyle(4, COL.border);
    this.panel.setInteractive();
    this.header = txt(s, 70, 200, '', 26, TXT.gold).setOrigin(0, 0.5);
    this.closeBtn = new Button(s, W - 130, 200, 140, 56, STR.close, () => this.close(), {
      fontSize: 20, color: COL.card, border: COL.border,
    });
    this.glow = s.add.circle(W / 2, 320, 78, 0xffffff, 0.15);
    this.icon = s.add.image(W / 2, 320, 'item_ring_0').setScale(10);
    this.title = txt(s, W / 2, 420, '', 32, TXT.main).setOrigin(0.5);
    this.sub = txt(s, W / 2, 458, '', 20, TXT.main).setOrigin(0.5);
    this.stars = new Stars(s, W / 2 - 41, 490, 3);
    this.lockBtn = new Button(s, W - 290, 200, 150, 56, STR.lock, () => this.doLock(), {
      fontSize: 19, color: COL.card, border: COL.border,
    });
    this.lockIcon = s.add.image(W / 2 + 70, 270, 'icon_lock').setScale(4);
    this.add([this.panel, this.header, this.closeBtn, this.lockBtn, this.glow, this.icon, this.lockIcon, this.title, this.sub, this.stars]);

    // Superior / Inferior ao que o herói já usa
    this.cmpBg = frame(s, W / 2, 530, W - 160, 50, 0x120a1e, 0.85).setStrokeStyle(3, 0xffffff);
    this.cmpArrow = s.add.triangle(118, 530, 0, 18, 9, 0, 18, 18, 0xffffff);
    this.cmpText = txt(s, W / 2 + 10, 520, '', 21, TXT.main, true).setOrigin(0.5);
    this.cmpSub = txt(s, W / 2 + 10, 543, '', 15, TXT.dim).setOrigin(0.5);
    this.add([this.cmpBg, this.cmpArrow, this.cmpText, this.cmpSub]);
    this.statLines = [0, 1, 2, 3].map((i) => {
      const t = txt(s, W / 2, 582 + i * 32, '', 22, TXT.main).setOrigin(0.5);
      this.add(t);
      return t;
    });
    this.setTitle = txt(s, W / 2, 705, '', 20, TXT.main).setOrigin(0.5);
    this.setB2 = txt(s, W / 2, 737, '', 18, TXT.dim).setOrigin(0.5);
    this.setB4 = txt(s, W / 2, 765, '', 18, TXT.dim).setOrigin(0.5);
    this.equipped = txt(s, W / 2, 808, '', 19, TXT.dim).setOrigin(0.5);
    this.chanceText = txt(s, W / 2, 852, '', 18, TXT.dim).setOrigin(0.5);
    this.add([this.setTitle, this.setB2, this.setB4, this.equipped, this.chanceText]);

    this.forgeBtn = new Button(s, W / 2, 912, W - 140, 72, '', () => this.doForge(), {
      fontSize: 21, color: COL.active, border: COL.activeBorder,
      onDisabledClick: () => scene.toast.show(this.item && this.item.plus >= BALANCE.forge.maxPlus ? STR.forgeMax : STR.forgeNoRes, 1400),
    });
    this.fuseBtn = new Button(s, 205, 1010, 270, 62, STR.fuseItemBtn, () => this.doFuse(), {
      fontSize: 21, color: COL.royal, border: COL.royalBorder,
      onDisabledClick: () => scene.toast.show(this.item && this.item.stars >= BALANCE.stars.max ? STR.fuseMax : STR.fuseItemNeed, 2200),
    });
    this.salvageBtn = new Button(s, 515, 1010, 270, 62, '', () => this.doSalvage(), {
      fontSize: 19, color: COL.card, border: COL.border, onDisabledClick: () => scene.toast.show(STR.lockedMsg, 1800),
    });
    this.equipBtn = new Button(s, W / 2, 1088, W - 140, 60, '', () => this.doEquip(), {
      fontSize: 20, color: COL.btn, border: COL.btnBorder,
    });
    // Passe do Minerador: ao revelar um lacrado, abre todos os que faltam de uma vez.
    this.revealAllBtn = new Button(s, W / 2, 1088, W - 140, 60, '', () => this.scene.doRevealAll(), {
      fontSize: 20, color: COL.btn, border: COL.btnBorder,
    });
    this.add([this.forgeBtn, this.fuseBtn, this.salvageBtn, this.equipBtn, this.revealAllBtn]);
  }

  // Com quem comparar: o herói do Inventário, o dono do item ou o 1º da equipe ativa.
  compareHero(it) {
    if (this.equipHero) return this.equipHero;
    const inv = this.scene.panels?.inventory;
    if (inv?.isOpen) return inv.hero();
    return economy.equippedBy(it.uid) || economy.teamMembers(economy.activeTeam)[0] || economy.heroes[0] || null;
  }

  refreshCompare(it) {
    const h = this.compareHero(it);
    const c = compareToEquipped(it, h);
    const show = !!c;
    [this.cmpBg, this.cmpArrow, this.cmpText, this.cmpSub].forEach((o) => o.setVisible(show));
    if (!show) return;
    const tint = CMP_TINT[c.verdict];
    this.cmpBg.setStrokeStyle(3, tint);
    this.cmpText.setText(cmpLong(c)).setColor(cmpColor(c));
    fit(this.cmpText, W - 260);
    const up = c.verdict === 'better' || c.verdict === 'empty';
    const down = c.verdict === 'worse';
    this.cmpArrow.setVisible(up || down).setFillStyle(tint).setAngle(down ? 180 : 0);
    const sub = c.current ? STR.cmpVs(c.hero.name, itemTitle(c.current)) : STR.cmpFor(c.hero.name);
    fit(this.cmpSub.setText(sub), W - 260);
  }

  // Equipar no herói escolhido no Inventário (no espaço certo; anel vai no espaço livre).
  doEquip() {
    const h = this.equipHero;
    const it = this.item;
    if (!h || !it) return;
    const slots = GEAR_SLOTS.filter((g) => g.type === it.slot);
    const key = (slots.find((g) => !h.gear?.[g.key]) || slots[0])?.key;
    if (!key) return;
    economy.equip(h, it, key);
    this.scene.toast.show(STR.equippedNow(h.name), 1400);
    this.close();
  }

  show(item, header = '', { equipHero = null, fromReveal = false } = {}) {
    this.item = item;
    this.equipHero = equipHero;
    this.fromReveal = fromReveal;
    this.headerLabel = header;
    this.disarm();
    this.refresh();
    this.open();
    const rgb = Phaser.Display.Color.IntegerToRGB(RARITY_COLORS[item.rarity]);
    if (header) this.scene.cameras.main.flash(220, rgb.r, rgb.g, rgb.b);
  }

  disarm() {
    this.forgeArmed = false;
    this.salvageArmed = false;
    this.armTimer?.remove(false);
  }

  refresh() {
    const it = this.item;
    if (!it || !economy.itemByUid(it.uid)) { if (this.isOpen) this.close(); return; }
    this.header.setText(this.headerLabel || '');
    this.refreshCompare(it);
    const owner0 = economy.equippedBy(it.uid);
    const canEquip = this.equipHero && (!owner0 || owner0.uid !== this.equipHero.uid);
    this.equipBtn.setVisible(!!canEquip);
    if (canEquip) fit(this.equipBtn.setLabel(STR.equipOn(this.equipHero.name)).label, W - 180);
    const left = economy.sealed.length;
    const showAll = this.fromReveal && !canEquip && left > 0 && premiumActive();
    this.revealAllBtn.setVisible(showAll);
    if (showAll) this.revealAllBtn.setLabel(STR.revealAllBtn(left));
    this.icon.setTexture(itemIcon(it));
    this.glow.setFillStyle(RARITY_COLORS[it.rarity], it.rarity > 0 ? 0.3 : 0.12);
    fit(this.title.setText(itemTitle(it)), W - 140);
    this.sub.setText(itemSubtitle(it)).setColor(RARITY_TEXT[it.rarity]);
    this.stars.setCount(it.stars);

    const lines = itemStatLines(it);
    this.statLines.forEach((t, i) => {
      const l = lines[i];
      t.setText(l ? l.text : '').setColor(l && l.main ? TXT.gold : TXT.main);
    });

    const owner = economy.equippedBy(it.uid);
    if (it.set) {
      const set = SETS[it.set];
      const n = owner ? (setCounts(economy.gearOf(owner))[it.set] || 0) : 0;
      const [b2, b4] = setBonusLines(it.set);
      this.setTitle.setText(STR.setLine(set.name, n)).setColor(set.color);
      this.setB2.setText(b2).setColor(n >= 2 ? TXT.good : TXT.dim);
      this.setB4.setText(b4).setColor(n >= 4 ? TXT.good : TXT.dim);
    } else {
      [this.setTitle, this.setB2, this.setB4].forEach((t) => t.setText(''));
    }
    fit(this.equipped.setText(`${owner ? STR.equippedOn(owner.name) : STR.notEquipped} · ${it.tradable === false ? STR.notTradable : STR.tradable}`), W - 140);
    this.lockBtn.setLabel(it.locked ? STR.unlock : STR.lock)
      .setColors(it.locked ? COL.active : COL.card, it.locked ? COL.activeBorder : COL.border);
    this.lockIcon.setVisible(!!it.locked);
    this.salvageBtn.setEnabled(!it.locked);

    const cost = forgeCost(it);
    if (cost) {
      const chance = forgeChance(it);
      this.chanceText.setText(STR.forgeChance(Math.round(chance * 100), Math.round(forgeBreakChance(it) * 100)))
        .setColor(chance >= 1 ? TXT.good : TXT.bad);
      if (!this.forgeArmed) {
        this.forgeBtn.setLabel(STR.forgeBtn(it.plus + 1, fmt(cost.gold), cost.minerals, WORLDS[cost.world].mineral.name));
      }
      this.forgeBtn.setEnabled(canAffordForge(it));
    } else {
      this.chanceText.setText('');
      this.forgeBtn.setLabel(STR.forgeMax).setEnabled(false);
    }
    this.fuseBtn.setEnabled(canFuseItem(it));
    if (!this.salvageArmed) this.salvageBtn.setLabel(STR.salvageBtn(fmt(salvageValue(it).gold)));
  }

  arm(which, label, btn) {
    this.disarm();
    this[which] = true;
    btn.setLabel(label);
    this.armTimer = this.scene.time.delayedCall(3000, () => { this.disarm(); this.refresh(); });
  }

  doForge() {
    const it = this.item;
    const chance = forgeChance(it);
    // Tentativa arriscada pede um segundo toque.
    if (chance < 1 && !this.forgeArmed) {
      this.arm('forgeArmed', STR.forgeConfirm(Math.round(chance * 100)), this.forgeBtn);
      return;
    }
    this.disarm();
    const r = forge(it);
    const cam = this.scene.cameras.main;
    if (r === 'success') { this.scene.toast.show(STR.forgeSuccess(it.plus), 1400); cam.flash(160, 255, 220, 120); }
    else if (r === 'fail') { this.scene.toast.show(STR.forgeFail, 1600); cam.shake(160, 0.006); }
    else if (r === 'broke') { this.scene.toast.show(STR.forgeBroke, 2000); cam.shake(300, 0.012); cam.flash(200, 200, 40, 40); }
    this.refresh();
  }

  doLock() {
    const locked = toggleItemLock(this.item);
    this.scene.toast.show(locked ? STR.lockedMsg : STR.unlockedMsg, 1800);
    this.refresh();
  }

  doFuse() {
    if (fuseItem(this.item)) {
      this.scene.toast.show(STR.itemFused, 1400);
      this.scene.cameras.main.flash(200, 200, 160, 255);
      this.refresh();
    }
  }

  doSalvage() {
    if (!this.salvageArmed) {
      this.arm('salvageArmed', STR.salvageConfirm, this.salvageBtn);
      return;
    }
    this.disarm();
    const v = salvage(this.item);
    if (!v) return;
    this.scene.toast.show(STR.salvaged(fmt(v.gold), v.minerals, WORLDS[v.world].mineral.name), 1600);
    this.close();
  }
}
