// Ficha do herói: Poder, atributos com "+", reset, subir nível, fundir estrela e equipe.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { ROLES, RARITY_NAMES, RARITY_COLORS, RARITY_TEXT } from '../data/heroes.js';
import { economy } from '../systems/Economy.js';
import {
  levelCost, pointsAvailable, pointsSpent, resetCost, levelCap, canAwakenLevel, awakenCost, nextRangeLevel,
  abilityPointsAvailable, releaseEssence,
} from '../systems/HeroStats.js';
import {
  statsOf, levelUp, canFuse, fuse, assignTeam, allocate, resetPoints, canAwaken, awaken,
  upgradeAbility, abilityResetCost, resetAbilities, canRelease, releaseHero, toggleHeroLock,
} from '../systems/Roster.js';
import { ABILITIES } from '../data/abilities.js';
import { Button } from './Button.js';
import { Modal, txt, fit, Stars } from './widgets.js';
import { fmt } from './format.js';
import { GEAR_SLOTS, SETS } from '../data/items.js';
import { activeSetBonuses } from '../systems/Items.js';
import { ItemPicker } from './ItemPicker.js';
import { GemPicker } from './GemPicker.js';
import { gemLabel, gemEffect } from './gemText.js';
import { itemIcon, bonusText } from './itemText.js';
import { RARITY_COLORS as RC } from '../data/heroes.js';
import { setHeroPortrait } from '../art/hd.js';
import { Sfx } from '../systems/Sfx.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const ATTR_Y = 592;
const ATTR_H = 42;
const PCT = new Set(['luck', 'critChance', 'critDamage', 'penetration', 'cooldown']);

function fmtNum(v, pct) {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(pct ? 2 : 1);
  return (pct ? `${s}%` : s).replace('.', ',');
}

export class HeroDetail extends Modal {
  constructor(scene) {
    super(scene, 300);
    this.hero = null;
    const s = scene;

    this.panel = frame(s, 40, 110, W - 80, 1060, COL.panel).setOrigin(0).setStrokeStyle(4, COL.border);
    this.panel.setInteractive();
    this.closeBtn = new Button(s, W - 130, 160, 140, 56, STR.close, () => this.close(), {
      fontSize: 20, color: COL.card, border: COL.border,
    });
    this.glow = s.add.ellipse(W / 2, 280, 120, 26, 0xffffff, 0.5);
    this.portrait = s.add.sprite(W / 2, 240, 'hero0_down_0').setScale(4.2);
    this.nameText = txt(s, W / 2, 305, '', 32, TXT.main).setOrigin(0.5);
    this.rarityText = txt(s, W / 2, 342, '', 21, TXT.main).setOrigin(0.5);
    this.roleIcon = s.add.image(0, 342, 'role_attacker').setScale(3);
    this.stars = new Stars(s, W / 2 - 41, 376, 3);
    this.levelText = txt(s, W / 2, 408, '', 19, TXT.dim).setOrigin(0.5);
    this.powerText = txt(s, W / 2, 448, '', 34, TXT.gold).setOrigin(0.5).setStroke('#12081c', 6);
    this.passiveText = txt(s, W / 2, 490, '', 17, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 140);
    this.add([this.panel, this.closeBtn, this.glow, this.portrait, this.nameText, this.rarityText,
      this.roleIcon, this.stars, this.levelText, this.powerText, this.passiveText]);

    // Alterna entre Atributos e Equipamento.
    // Abas: Atributos · Equipamento · Habilidades.
    this.view = 'attr';
    this.lockBtn = new Button(s, W - 130, 232, 140, 46, STR.lock, () => {
      const locked = toggleHeroLock(this.hero);
      scene.toast.show(locked ? STR.lockedMsg : STR.unlockedMsg, 1800);
      this.refresh();
    }, { fontSize: 18, color: COL.card, border: COL.border });
    this.add(this.lockBtn);
    this.tabBtns = [['attr', STR.attrTab], ['equip', STR.equipShort], ['abil', STR.abilShort]].map(([id, label], i) => {
      const b = new Button(s, 112 + i * 128, 160, 122, 52, label, () => this.setView(id), {
        fontSize: 18, color: COL.card, border: COL.border,
      });
      b.viewId = id;
      this.add(b);
      return b;
    });

    // Pontos e reset
    this.pointsText = txt(s, 80, 540, '', 24, TXT.gold).setOrigin(0, 0.5);
    this.resetBtn = new Button(s, W - 170, 540, 220, 50, '', () => this.doReset(), {
      fontSize: 18, color: COL.card, border: COL.border,
      onDisabledClick: () => scene.toast.show(
        this.hero && pointsSpent(this.hero) === 0 ? STR.resetNothing : STR.notEnoughGold, 1400),
    });
    this.add([this.pointsText, this.resetBtn]);

    // Atributos
    this.attrRows = BALANCE.attributes.ids.map((id, i) => {
      const y = ATTR_Y + i * ATTR_H;
      const stripe = s.add.rectangle(64, y, W - 128, ATTR_H - 4, 0x000000, i % 2 ? 0 : 0.15).setOrigin(0, 0.5);
      const label = txt(s, 80, y, STR.attr[id], 21, TXT.dim).setOrigin(0, 0.5);
      const value = txt(s, W - 160, y, '', 21, TXT.main).setOrigin(1, 0.5);
      const plus = new Button(s, W - 100, y, 68, 36, '+', () => this.doAllocate(id), {
        fontSize: 24, onDisabledClick: () => this.onPlusDisabled(id),
      });
      this.add([stripe, label, value, plus]);
      return { id, value, plus, stripe, label };
    });
    this.extraText = txt(s, W / 2, ATTR_Y + 8 * ATTR_H + 6, '', 19, TXT.dim).setOrigin(0.5);
    this.add(this.extraText);
    this.attrView = [this.pointsText, this.resetBtn, this.extraText,
      ...this.attrRows.flatMap((r) => [r.stripe, r.label, r.value, r.plus])];

    // Equipamento: 6 espaços (toque escolhe o item).
    this.picker = new ItemPicker(scene, () => this.refresh());
    const cw = 112;
    const ch = 126;
    const gx = (W - (5 * cw + 32)) / 2;
    this.slotCells = GEAR_SLOTS.map((sl, i) => {
      const x = gx + (i % 5) * (cw + 8);
      const y = 524 + Math.floor(i / 5) * (ch + 8);
      const bg = frame(s, x, y, cw, ch, 0x120a1e).setOrigin(0).setStrokeStyle(3, COL.border);
      const icon = s.add.image(x + cw / 2, y + 52, `item_${sl.type}_empty`).setScale(5);
      const label = txt(s, x + cw / 2, y + 108, sl.name, 16, TXT.dim).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.picker.show(this.hero, sl.key));
      this.add([bg, icon, label]);
      return { slot: sl.key, type: sl.type, name: sl.name, bg, icon, label };
    });
    // Encaixes de gema (abrem nos níveis 1, 50 e 150).
    this.gemPicker = new GemPicker(scene, () => this.refresh());
    this.socketCells = [0, 1, 2].map((i) => {
      const x = gx + i * 200;
      const y = 802;
      const bg = frame(s, x, y, 192, 72, 0x120a1e).setOrigin(0).setStrokeStyle(3, 0x7a3ac8);
      const icon = s.add.image(x + 34, y + 36, 'gem_empty').setScale(5);
      const label = txt(s, x + 64, y + 22, '', 16, TXT.main).setOrigin(0, 0.5);
      const eff = txt(s, x + 64, y + 50, '', 15, TXT.gold).setOrigin(0, 0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => {
        const need = BALANCE.gems.sockets[i];
        if (this.hero.level < need) scene.toast.show(STR.socketLockedMsg(need), 1600);
        else this.gemPicker.show(this.hero, i);
      });
      this.add([bg, icon, label, eff]);
      return { bg, icon, label, eff };
    });
    this.setsText = txt(s, W / 2, 900, '', 17, TXT.good).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 140);
    this.add(this.setsText);
    this.equipView = [this.setsText, ...this.slotCells.flatMap((c) => [c.bg, c.icon, c.label]),
      ...this.socketCells.flatMap((c) => [c.bg, c.icon, c.label, c.eff])];

    // Habilidades: pontos, reset, 2 cartões e liberar herói.
    this.abilPoints = txt(s, 80, 540, '', 24, TXT.gold).setOrigin(0, 0.5);
    this.abilReset = new Button(s, W - 170, 540, 220, 50, '', () => this.doAbilReset(), {
      fontSize: 18, color: COL.card, border: COL.border,
    });
    this.add([this.abilPoints, this.abilReset]);
    this.abilCards = [0, 1].map((i) => {
      const y = 580 + i * 146;
      const bg = frame(s, 64, y, W - 128, 134, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
      const name = txt(s, 84, y + 24, '', 24, TXT.gold).setOrigin(0, 0.5);
      const lvl = txt(s, W - 170, y + 24, '', 19, TXT.main).setOrigin(1, 0.5);
      const desc = txt(s, 84, y + 62, '', 18, TXT.main).setOrigin(0, 0.5).setWordWrapWidth(W - 280);
      const next = txt(s, 84, y + 104, '', 16, TXT.good).setOrigin(0, 0.5).setWordWrapWidth(W - 280);
      const plus = new Button(s, W - 112, y + 72, 72, 72, '+', () => this.doAbil(i), {
        fontSize: 30, onDisabledClick: () => scene.toast.show(STR.noAbilPoints, 1800),
      });
      this.add([bg, name, lvl, desc, next, plus]);
      return { bg, name, lvl, desc, next, plus };
    });
    this.releaseBtn = new Button(s, W / 2, 900, W - 200, 56, '', () => this.doRelease(), {
      fontSize: 19, color: COL.danger, border: COL.dangerBorder,
      onDisabledClick: () => scene.toast.show(STR.releaseBlocked, 2000),
    });
    this.add(this.releaseBtn);
    this.abilView = [this.abilPoints, this.abilReset, this.releaseBtn,
      ...this.abilCards.flatMap((c) => [c.bg, c.name, c.lvl, c.desc, c.next, c.plus])];

    this.levelBtn = new Button(s, W / 2, 1002, W - 160, 64, '', () => this.doLevelUp(), {
      fontSize: 22,
      onDisabledClick: () => {
        const h = this.hero;
        if (!h) return;
        if (h.level >= BALANCE.levels.max) scene.toast.show(STR.maxLevel, 1400);
        else if (canAwakenLevel(h)) scene.toast.show(STR.awakenNeed, 2200);
        else scene.toast.show(STR.notEnoughGold, 1400);
      },
    });
    this.fuseBtn = new Button(s, W / 2, 1074, W - 160, 54, STR.fuseBtn, () => this.doFuse(), {
      fontSize: 21, color: COL.royal, border: COL.royalBorder,
      onDisabledClick: () => scene.toast.show(this.hero && this.hero.stars >= BALANCE.stars.max ? STR.fuseMax : STR.fuseNeed, 2200),
    });
    this.add([this.levelBtn, this.fuseBtn]);

    this.teamBtns = [0, 1, 2, null].map((t, i) => {
      const w = 128;
      const x = (W - (4 * w + 36)) / 2 + w / 2 + i * (w + 12);
      const b = new Button(s, x, 1136, w, 50, t === null ? STR.noTeam : `${'ABC'[t]}`, () => this.doTeam(t), {
        fontSize: 22, color: COL.card, border: COL.border,
        onDisabledClick: () => s.toast.show(STR.teamLocked(t, BALANCE.teams.unlockWorld[t] + 1), 2200),
      });
      if (t !== null) b.lockIcon = s.add.image(x + w / 2 - 16, 1136 - 14, 'icon_lock').setScale(2.2).setVisible(false);
      b.team = t;
      this.add(b);
      if (b.lockIcon) this.add(b.lockIcon);
      return b;
    });
  }

  show(hero) {
    this.hero = hero;
    this.view = 'attr';
    this.releaseArmed = false;
    this.refresh();
    this.open();
  }

  setView(id) {
    this.view = id;
    this.releaseArmed = false;
    this.refresh();
  }

  refreshAbil(h) {
    const pts = abilityPointsAvailable(h);
    this.abilPoints.setText(STR.abilPoints(pts)).setColor(pts > 0 ? TXT.good : TXT.dim);
    const rc = abilityResetCost(h);
    this.abilReset.setLabel(STR.resetBtn(fmt(rc))).setEnabled(h.abilities.some((a) => a.lvl > 1) && economy.gold >= rc);
    const max = BALANCE.attributes.abilityMax;
    this.abilCards.forEach((c, i) => {
      const a = h.abilities[i];
      const def = ABILITIES[a.id];
      c.name.setText(def.name);
      c.lvl.setText(STR.abilLevel(a.lvl, max));
      c.desc.setText(def.desc(def.per * a.lvl, a.lvl));
      c.next.setText(a.lvl < max ? STR.abilNext(def.desc(def.per * (a.lvl + 1), a.lvl + 1)) : STR.abilMaxed);
      c.plus.setEnabled(pts > 0 && a.lvl < max);
    });
    const ess = releaseEssence(h);
    this.releaseBtn.setLabel(this.releaseArmed ? STR.releaseConfirm : STR.releaseBtn(ess))
      .setEnabled(canRelease(h, this.onField()));
  }

  refreshEquip(h) {
    this.slotCells.forEach((c) => {
      const it = economy.itemByUid(h.gear?.[c.slot]);
      c.icon.setTexture(it ? itemIcon(it) : `item_${c.type}_empty`);
      c.label.setText(it ? (it.plus ? `${c.name} +${it.plus}` : c.name) : c.name).setColor(it ? TXT.main : TXT.dim);
      c.bg.setStrokeStyle(3, it && it.rarity > 0 ? RC[it.rarity] : COL.border);
    });
    this.socketCells.forEach((c, i) => {
      const need = BALANCE.gems.sockets[i];
      const key = h.gems?.[i];
      const open = h.level >= need;
      c.icon.setTexture(key ? `gem_${key.split(':')[0]}` : 'gem_empty').setAlpha(open ? 1 : 0.4);
      fit(c.label.setText(key ? gemLabel(key) : open ? STR.socketFree : STR.socketLocked(need)), 120)
        .setColor(key ? TXT.main : TXT.dim);
      fit(c.eff.setText(key ? gemEffect(key) : ''), 120);
    });
    const bonuses = activeSetBonuses(economy.gearOf(h));
    this.setsText.setText(bonuses.length
      ? STR.setsActive(bonuses.map((b) => `${SETS[b.set].name} ${b.pieces}: ${bonusText(b)}`).join(' · '))
      : STR.noSetsActive).setColor(bonuses.length ? TXT.good : TXT.dim);
  }

  onField() {
    return new Set(this.scene.battle.field.keys());
  }

  passive(h, st) {
    if (st.collect > 0) return STR.passiveCollect(st.collect, st.collectRadius);
    if (st.auraPct > 0) return STR.passiveAura(st.auraPct, st.auraRadius);
    if (st.pierce > 0) return STR.passivePierce(st.pierce);
    return STR.passiveAttacker;
  }

  refresh() {
    const h = this.hero;
    if (!h || !economy.heroByUid(h.uid)) { if (this.isOpen) this.close(); return; }
    const st = statsOf(h);
    this.lockBtn.setLabel(h.locked ? STR.unlock : STR.lock)
      .setColors(h.locked ? COL.active : COL.card, h.locked ? COL.activeBorder : COL.border);
    setHeroPortrait(this.portrait, h);
    this.glow.setFillStyle(RARITY_COLORS[h.rarity], h.rarity > 0 ? 0.55 : 0.25);
    fit(this.nameText.setText(h.name), W - 320);
    const rank = BALANCE.ranks[h.rank].name;
    this.rarityText.setText(STR.rarityRank(RARITY_NAMES[h.rarity], ROLES[h.role].name, rank)).setColor(RARITY_TEXT[h.rarity]);
    this.roleIcon.setTexture(`role_${h.role}`).setX(W / 2 - this.rarityText.width / 2 - 22);
    this.stars.setCount(h.stars);
    const LV = BALANCE.levels;
    const mark = (Math.floor(h.level / LV.milestoneEvery) + 1) * LV.milestoneEvery;
    fit(this.levelText.setText(STR.levelLine(h.level, levelCap(h), h.awaken || 0, mark <= LV.max ? mark : null,
      String(LV.milestoneMult).replace('.', ','))), W - 80);
    this.powerText.setText(STR.powerBig(fmt(st.power)));
    this.passiveText.setText(this.passive(h, st));

    const pts = pointsAvailable(h);
    this.pointsText.setText(STR.pointsAvail(pts)).setColor(pts > 0 ? TXT.good : TXT.dim);
    const rc = resetCost(h);
    this.resetBtn.setLabel(STR.resetBtn(fmt(rc))).setEnabled(pointsSpent(h) > 0 && economy.gold >= rc);

    const caps = BALANCE.attributes.caps;
    this.attrRows.forEach((r) => {
      const v = st[r.id];
      let text = fmtNum(v, PCT.has(r.id));
      if (r.id === 'energy') text = `${Math.floor(h.energy)} / ${v}`;
      const bonus = h.alloc?.[r.id] || 0;
      r.value.setText(bonus ? `${text}  (+${bonus})` : text).setColor(bonus ? TXT.good : TXT.main);
      const capped = caps[r.id] !== undefined && v >= caps[r.id];
      r.plus.setEnabled(pts > 0 && !capped);
    });
    fit(this.extraText.setText(STR.extraLine(st.range, st.bombs, st.moveSpeed.toFixed(1).replace('.', ','), nextRangeLevel(h))), W - 60);

    this.attrView.forEach((o) => o.setVisible(this.view === 'attr'));
    this.equipView.forEach((o) => o.setVisible(this.view === 'equip'));
    this.abilView.forEach((o) => o.setVisible(this.view === 'abil'));
    this.tabBtns.forEach((b) => {
      const on = b.viewId === this.view;
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
    });
    if (this.view === 'equip') this.refreshEquip(h);
    if (this.view === 'abil') this.refreshAbil(h);

    const cost = levelCost(h);
    if (canAwakenLevel(h)) {
      const ac = awakenCost(h);
      this.levelBtn.setLabel(STR.awakenBtn(fmt(ac.gold), fmt(ac.essence))).setColors(COL.royal, COL.royalBorder)
        .setEnabled(canAwaken(h));
    } else {
      this.levelBtn.setLabel(cost === null ? STR.maxLevel : STR.levelUpBtn(fmt(cost))).setColors(COL.btn, COL.btnBorder)
        .setEnabled(cost !== null && economy.gold >= cost);
    }
    this.fuseBtn.setEnabled(canFuse(h, this.onField()));

    this.teamBtns.forEach((b) => {
      const active = b.team === h.team;
      b.setColors(active ? COL.btn : COL.card, active ? COL.btnBorder : COL.border);
      const locked = b.team !== null && !economy.teamUnlocked(b.team);
      b.setEnabled(!locked);
      b.lockIcon?.setVisible(locked);
    });
  }

  onPlusDisabled(id) {
    const h = this.hero;
    if (!h) return;
    if (pointsAvailable(h) <= 0) this.scene.toast.show(STR.noPoints, 1800);
    else this.scene.toast.show(STR.attrCapped, 1400);
  }

  doAllocate(id) {
    if (allocate(this.hero, id)) this.refresh();
  }

  doReset() {
    if (resetPoints(this.hero)) {
      this.scene.toast.show(STR.pointsReset, 1200);
      this.refresh();
    }
  }

  doLevelUp() {
    const h = this.hero;
    if (canAwakenLevel(h)) {
      if (awaken(h)) {
        this.scene.toast.show(STR.awakened(h.name, levelCap(h)), 2000);
        this.scene.cameras.main.flash(260, 180, 120, 255);
        this.refresh();
      }
      return;
    }
    const before = statsOf(h).range;
    if (levelUp(h)) {
      this.levelBurst(h.level);
      const after = statsOf(h).range;
      if (after > before) {
        this.scene.toast.show(STR.rangeUp(h.name, after), 2200);
        this.scene.cameras.main.flash(180, 255, 200, 120);
      } else if (h.level % BALANCE.levels.milestoneEvery === 0) {
        this.scene.toast.show(STR.levelMilestone(h.name, h.level, String(BALANCE.levels.milestoneMult).replace('.', ',')), 2200);
        this.scene.cameras.main.flash(180, 255, 200, 120);
      }
      // A ficha é redesenhada uma vez no próximo quadro (levelUp avisa 'roster'), mesmo tocando várias vezes.
    }
  }

  // Comemoração ao subir de nível: faíscas, "Nível X!" subindo e o retrato pula.
  levelBurst(level) {
    const s = this.scene;
    const x = this.x + W / 2;
    const y = this.y + 226;
    if (!this.burst) {
      this.burst = s.add.particles(0, 0, 'spark', {
        speed: { min: 90, max: 300 }, lifespan: 650, scale: { start: 2.6, end: 0 }, gravityY: 240,
        tint: [0xe8b84a, 0xfff1a8, 0xffffff], emitting: false,
      }).setDepth(this.depth + 1);
      this.once('destroy', () => this.burst?.destroy());
    }
    const big = level % 10 === 0;
    this.burst.explode(big ? 36 : 16, x, y);
    Sfx.play('level');
    // Um texto só, reaproveitado: tocando rápido ele só troca o número e recomeça a subir.
    if (!this.pop) {
      this.pop = txt(s, x, y - 70, '', 32, TXT.gold, true).setOrigin(0.5).setStroke('#12081c', 8).setDepth(this.depth + 2);
      this.once('destroy', () => this.pop?.destroy());
    }
    const pop = this.pop;
    s.tweens.killTweensOf(pop);
    pop.setText(STR.levelPop(level)).setPosition(x, y - 70).setAlpha(1).setVisible(true).setScale(big ? 1.25 : 1);
    s.tweens.add({ targets: pop, y: y - 130, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => pop.setVisible(false) });
    // O retrato pula; se já estava pulando, volta ao tamanho certo antes (não vai crescendo).
    if (this.portraitBase === undefined) this.portraitBase = this.portrait.scale;
    const base = this.portraitBase;
    s.tweens.killTweensOf(this.portrait);
    this.portrait.setScale(base * 1.12);
    s.tweens.add({ targets: this.portrait, scale: base, duration: 220, ease: 'Back.easeOut' });
  }

  doAbil(i) {
    if (upgradeAbility(this.hero, i)) this.refresh();
  }

  doAbilReset() {
    if (resetAbilities(this.hero)) { this.scene.toast.show(STR.pointsReset, 1200); this.refresh(); }
  }

  doRelease() {
    if (!this.releaseArmed) {
      this.releaseArmed = true;
      this.refresh();
      this.scene.time.delayedCall(3000, () => { if (this.releaseArmed) { this.releaseArmed = false; this.refresh(); } });
      return;
    }
    this.releaseArmed = false;
    const name = this.hero.name;
    const ess = releaseHero(this.hero, this.onField());
    if (ess) {
      this.scene.toast.show(STR.released(name, ess), 2000);
      this.close();
    }
  }

  doFuse() {
    const food = fuse(this.hero, this.onField());
    if (food) {
      this.scene.toast.show(STR.fused(food.name), 1800);
      this.scene.cameras.main.flash(200, 200, 160, 255);
      this.refresh();
    }
  }

  doTeam(t) {
    if (!assignTeam(this.hero, t)) {
      this.scene.toast.show(economy.onExpedition(this.hero.uid) ? STR.expTeamBlocked : STR.teamFull, 1400);
      return;
    }
    this.refresh();
  }
}
