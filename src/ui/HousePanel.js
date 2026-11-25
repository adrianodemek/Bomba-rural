// Aba Casa: grade 3×3 de cápsulas, liberar cápsulas e melhorar a recuperação.
import { freeArt, restoreArt } from '../art/bigArt.js';
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS } from '../data/heroes.js';
import { economy } from '../systems/Economy.js';
import { maxEnergy } from '../systems/Energy.js';
import { msLeft } from '../systems/Expeditions.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card, ProgressBar, energyColor } from './widgets.js';
import { Sfx } from '../systems/Sfx.js';
import { frame } from './skin.js';
import { fmt } from './format.js';
import { setHeroPortrait } from '../art/hd.js';
import { CORE_PARTS, CORE_ROOM } from '../config/coreArt.js';
import { premiumActive } from '../systems/Premium.js';

const W = BALANCE.screen.width;
const L = BALANCE.layout;
// Centro dos Núcleos: sala ilustrada (ferramentas/icons/core_room.py) que o jogador arrasta com o dedo.
const VIEW_TOP = 104;     // dentro do painel
const VIEW_H = 630 + Math.max(0, (BALANCE.layout.tabsY - BALANCE.layout.arenaY - 930));   // a sala vai até perto dos cartões de baixo
const CARD_H = 72;       // altura dos cartões Recuperação / Alojamento
const ROOM_KEY = 'core_room';
const PARTS_KEY = 'core_parts';
const R = CORE_ROOM;
const [POD_W, POD_H] = R.pod;
const MOTE_PARALLAX = 1.25;   // partículas na frente andam um pouco mais rápido (profundidade)
const HERO_SCALE = 4.2;

export class HousePanel extends Panel {
  constructor(scene, { onClose, onBuyCapsule, onBuyRecovery, onHero, onSend, onCollect }) {
    super(scene, STR.houseTitle, onClose);
    this.view = 'caps';
    const v = scene.add.container(0, 0);
    this.views = { caps: v };
    this.add(v);
    this.onBuyCapsule = onBuyCapsule;
    this.onHero = onHero;
    v.add(txt(scene, 24, 86, STR.coreHint, 17, TXT.dim).setOrigin(0, 0.5));
    this.buildCore(scene, v);
    // Cartões finos (mesmo tamanho de letra) colados embaixo, para a sala ganhar altura.
    const by = VIEW_TOP + VIEW_H;
    this.outsideText = txt(scene, 24, by + 16, '', 19, TXT.dim).setOrigin(0, 0.5);
    v.add(this.outsideText);
    const row = (y, title) => {
      v.add(card(scene, 24, y, W - 48, CARD_H, COL.gold));
      v.add(txt(scene, 44, y + 22, title, 23, TXT.gold, true).setOrigin(0, 0.5));
      return txt(scene, 44, y + 50, '', 18, TXT.good).setOrigin(0, 0.5);
    };
    const ry = by + 30;
    this.recoveryText = row(ry, STR.recoveryTitle);
    this.recoveryBtn = new Button(scene, 565, ry + CARD_H / 2, 230, CARD_H - 14, '', onBuyRecovery, {
      fontSize: 22, onDisabledClick: () => scene.toast.show(STR.notEnoughGold, 1200),
    });
    v.add([this.recoveryText, this.recoveryBtn]);
    const sy = ry + CARD_H + 8;
    this.rosterText = row(sy, STR.rosterSlotsTitle);
    this.rosterBtn = new Button(scene, 565, sy + CARD_H / 2, 230, CARD_H - 14, '', () => {
      if (economy.buyRosterSlots()) scene.toast.show(STR.rosterSlotsBought, 1400);
      else scene.toast.show(STR.notEnoughGold, 1200);
    }, { fontSize: 22 });
    v.add([this.rosterText, this.rosterBtn]);
    this.tabBtns = [['caps', STR.tabCapsules, 200, 140], ['exp', STR.tabExpeditions, 372, 180]].map(([id, label, x, w]) => {
      const b = new Button(scene, x, 44, w, 52, label, () => { this.view = id; this.refresh(); }, {
        fontSize: 19, color: COL.card, border: COL.border,
      });
      b.viewId = id;
      this.add(b);
      return b;
    });
    this.buildExpeditions(scene, onSend, onCollect);
    this.onOpen = () => { this.ensureCore(); this.centerCore(); this.refresh(); };
    this.onClosed = () => freeArt(this.scene, ROOM_KEY, this.roomImg);   // 17 MB: só na memória com a Casa aberta
  }

  refresh() {
    for (const [id, c] of Object.entries(this.views)) c.setVisible(id === this.view);
    this.tabBtns.forEach((b) => {
      const on = b.viewId === this.view;
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
    });
    if (this.view === 'exp') { this.refreshExpeditions(); return; }
    this.refreshCore();

    const onField = this.scene.battle.field;
    const inCap = new Set(economy.capsules.filter((u) => u !== null));
    const outside = economy.heroes.filter((h) => !onField.has(h.uid) && !inCap.has(h.uid) && h.energy < maxEnergy(h)).length;
    this.outsideText.setText(STR.outside(outside));
    this.recoveryText.setText(STR.recoveryValue(Math.round(economy.recoveryMult() * 100)));
    const cost = economy.recoveryCost();
    if (cost === null) this.recoveryBtn.setLabel(STR.recoveryMax).setEnabled(false);
    else this.recoveryBtn.setLabel(STR.recoveryBtn(fmt(cost))).setEnabled(economy.gold >= cost);
    this.recoveryText.setText(STR.recoveryValue(Math.round((economy.recoveryMult() + economy.treeSum('recoveryPct')) * 100)));
    this.rosterText.setText(STR.rosterSlotsValue(`${economy.heroes.length}/${economy.heroSlots}`));
    const rc = economy.rosterUpgradeCost();
    this.rosterBtn.setLabel(STR.rosterSlotsBtn(fmt(rc))).setEnabled(economy.gold >= rc);
  }

  // ---------- Centro dos Núcleos ----------
  buildCore(s, v) {
    this.dragZone = s.add.rectangle(0, VIEW_TOP, W, VIEW_H, 0x070b16, 1).setOrigin(0).setInteractive();
    this.room = s.add.container(0, VIEW_TOP);
    this.motes = s.add.container(0, VIEW_TOP);
    this.viewFrame = frame(s, 0, VIEW_TOP - 2, W, VIEW_H + 4, null).setOrigin(0).setStrokeStyle(4, 0xc8962a);
    v.add([this.dragZone, this.room, this.motes, this.viewFrame]);
    this.pods = [];
    this.setupCoreDrag(s);
  }

  // A arte da sala só carrega na primeira vez que a Casa abre.
  ensureCore() {
    const s = this.scene;
    if (this.roomImg) { restoreArt(s, ROOM_KEY, 'assets/ui/core_room.webp', this.roomImg, R.w, R.h); return; }
    const ready = () => s.textures.exists(ROOM_KEY) && s.textures.exists(PARTS_KEY);
    if (!ready()) {
      if (this.coreLoading) return;
      this.coreLoading = true;
      if (!s.textures.exists(ROOM_KEY)) s.load.image(ROOM_KEY, 'assets/ui/core_room.webp');
      if (!s.textures.exists(PARTS_KEY)) s.load.image(PARTS_KEY, 'assets/ui/core_parts.png');
      s.load.once('complete', () => { this.coreLoading = false; if (ready()) { this.ensureCore(); this.centerCore(); this.refresh(); } });
      s.load.start();
      return;
    }
    s.textures.get(ROOM_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const pt = s.textures.get(PARTS_KEY);
    pt.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (const [name, [x, y, w, h]] of Object.entries(CORE_PARTS)) if (!pt.has(name)) pt.add(name, 0, x, y, w, h);

    this.roomImg = s.add.image(0, 0, ROOM_KEY).setOrigin(0).setDisplaySize(R.w, R.h).setAlpha(0);
    this.room.add(this.roomImg);
    s.tweens.add({ targets: this.roomImg, alpha: 1, duration: 350 });
    // Núcleo pulsando (brilho somado por cima da arte).
    const [cx, cy] = R.core;
    const pulse = s.add.image(cx, cy - 210, PARTS_KEY, 'soft_glow').setDisplaySize(260, 260).setTint(0x60e8ff)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    const floor = s.add.image(cx, cy, PARTS_KEY, 'soft_glow').setDisplaySize(620, 420).setTint(0x2aa8ff)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
    this.room.add([floor, pulse]);
    s.tweens.add({ targets: pulse, alpha: 0.85, scaleX: pulse.scaleX * 1.15, scaleY: pulse.scaleY * 1.15, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    s.tweens.add({ targets: floor, alpha: 0.32, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Cápsulas, de trás para a frente (as de baixo ficam na frente).
    const order = R.docks.map((d, i) => i).sort((a, b) => R.docks[a][1] - R.docks[b][1]);
    this.pods = [];
    for (const i of order) {
      const [dx, dy] = R.docks[i];
      const c = s.add.container(dx, dy);
      const top = -POD_H + 12;   // a base da cápsula fica um pouco abaixo do centro da doca
      const glow = s.add.image(0, top, PARTS_KEY, 'pod_glow').setOrigin(0.5, 0).setDisplaySize(POD_W, POD_H)
        .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const back = s.add.image(0, top, PARTS_KEY, 'pod_back').setOrigin(0.5, 0).setDisplaySize(POD_W, POD_H);
      const fill = s.add.rectangle(0, top + 162, 76, 120, 0x6fd36b, 0.22).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD);
      const hero = s.add.sprite(0, top + 98, 'hero0_down_0').setScale(HERO_SCALE).setVisible(false);
      const front = s.add.image(0, top, PARTS_KEY, 'pod_front').setOrigin(0.5, 0).setDisplaySize(POD_W, POD_H);
      const locked = s.add.image(0, top, PARTS_KEY, 'pod_locked').setOrigin(0.5, 0).setDisplaySize(POD_W, POD_H);
      const free = txt(s, 0, top + 96, STR.capsuleFree, 22, '#9fe8ff').setOrigin(0.5).setStroke('#12081c', 5).setAlpha(0.8);
      const name = txt(s, 0, 30, '', 17, TXT.main, true).setOrigin(0.5).setStroke('#12081c', 5);
      const bar = new ProgressBar(s, -50, 50, 100, 10);
      const price = txt(s, 0, 36, '', 18, TXT.gold, true).setOrigin(0.5).setStroke('#12081c', 5);
      c.add([glow, back, fill, hero, front, locked, free, name, bar, price]);
      this.room.add(c);
      s.tweens.add({ targets: hero, y: top + 94, duration: 1500 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.pods[i] = { i, c, glow, back, fill, hero, front, locked, free, name, bar, price, top, uid: null };
    }

    // Partículas de energia subindo do núcleo (camada da frente, com paralaxe).
    const rnd = new Phaser.Math.RandomDataGenerator(['nucleos']);
    for (let k = 0; k < 26; k++) {
      const x = rnd.between(80, R.w - 80), y = rnd.between(120, R.h - 80);
      const m = s.textures.exists('fx_glow') ? s.add.image(x, y, 'fx_glow').setScale(rnd.realInRange(0.2, 0.45)) : s.add.circle(x, y, 2, 0xffffff);
      m.setTint?.(rnd.pick([0x60e8ff, 0xa8f4ff, 0x80c8ff])).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.motes.add(m);
      s.tweens.add({ targets: m, y: y - rnd.between(60, 140), alpha: { from: 0, to: rnd.realInRange(0.4, 0.9) },
        duration: rnd.between(2200, 4200), delay: rnd.between(0, 3000), repeat: -1, yoyo: false, ease: 'Sine.easeOut',
        onRepeat: () => m.setAlpha(0) });
    }
    this.ensureCoreMask();
    this.moveRoom(this.room.x, this.room.y);
  }

  // Máscara: só mostra a sala dentro da área (coordenadas da tela, painel aberto).
  ensureCoreMask() {
    if (this.coreMask) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillRect(0, L.arenaY + VIEW_TOP, W, VIEW_H);
    this.coreMask = g.createGeometryMask();
    this.room.setMask(this.coreMask);
    this.motes.setMask(this.coreMask);
  }

  moveRoom(x, y) {
    this.room.setPosition(Phaser.Math.Clamp(x, W - R.w, 0), Phaser.Math.Clamp(y, VIEW_TOP + VIEW_H - R.h, VIEW_TOP));
    const ox = this.room.x, oy = this.room.y - VIEW_TOP;
    this.motes.setPosition(ox * MOTE_PARALLAX + 40, VIEW_TOP + oy * MOTE_PARALLAX + 40);
  }

  // Abre olhando a próxima cápsula a liberar (ou o núcleo, se já liberou todas).
  centerCore() {
    const next = R.docks[economy.capsulesUnlocked];
    const [cx, cy] = R.core;
    const tx = next ? (cx + next[0]) / 2 : cx;
    const ty = next ? (cy + 100 + next[1] - 80) / 2 : cy + 60;
    this.moveRoom(W / 2 - tx, VIEW_TOP + VIEW_H / 2 - ty);
  }

  setupCoreDrag(s) {
    let start = null;
    this.coreDrag = 0;
    this.dragZone.on('pointerdown', (p) => {
      start = { x: p.worldX, y: p.worldY, rx: this.room.x, ry: this.room.y };
      this.coreDrag = 0;
    });
    s.input.on('pointermove', (p) => {
      if (!start || !p.isDown || !this.isOpen || this.view !== 'caps') return;
      const dx = p.worldX - start.x, dy = p.worldY - start.y;
      this.coreDrag = Math.max(this.coreDrag, Math.abs(dx) + Math.abs(dy));
      this.moveRoom(start.rx + dx, start.ry + dy);
    });
    s.input.on('pointerup', (p) => {
      const was = start; start = null;
      if (!was || this.coreDrag > 12 || !this.isOpen || this.view !== 'caps') return;
      this.tapCore(p.worldX, p.worldY);
    });
  }

  // Toque na sala: acha a cápsula da frente para trás.
  tapCore(wx, wy) {
    const top = this.y + VIEW_TOP;
    if (wy < top || wy > top + VIEW_H) return;
    const rx = wx - this.x - this.room.x, ry = wy - this.y - this.room.y;
    const hit = [...this.pods].filter(Boolean).sort((a, b) => R.docks[b.i][1] - R.docks[a.i][1])
      .find((p) => Math.abs(rx - p.c.x) < POD_W / 2 && ry > p.c.y + p.top - 10 && ry < p.c.y + 60);
    if (!hit) return;
    const s = this.scene;
    s.tweens.add({ targets: hit.c, scale: 0.95, duration: 70, yoyo: true });
    const unlocked = economy.capsulesUnlocked;
    if (hit.i === unlocked) { this.onBuyCapsule(); return; }
    if (hit.i > unlocked) { s.toast.show(STR.capsuleLockedTip, 1800); return; }
    const h = hit.uid !== null ? economy.heroByUid(hit.uid) : null;
    if (h) { Sfx.play('click'); this.onHero(h); return; }
    s.toast.show(STR.capsuleFreeTip, 2200);
  }

  refreshCore() {
    this.ensureCore();
    if (!this.roomImg) return;
    const unlocked = economy.capsulesUnlocked;
    const nextCost = economy.capsuleCost();
    for (const p of this.pods) {
      if (!p) continue;
      const open = p.i < unlocked;
      const uid = open ? economy.capsules[p.i] : null;
      const h = uid !== null && uid !== undefined ? economy.heroByUid(uid) : null;
      p.uid = h ? h.uid : null;
      const isNext = p.i === unlocked && nextCost !== null;
      p.back.setVisible(open); p.front.setVisible(open);
      p.locked.setVisible(!open).setAlpha(isNext ? 1 : 0.7);
      p.free.setVisible(open && !h);
      p.hero.setVisible(!!h); p.fill.setVisible(!!h);
      p.name.setVisible(!!h); p.bar.setVisible(!!h);
      p.price.setVisible(isNext);
      p.glow.setVisible(isNext || !!h);
      if (isNext) {
        p.glow.setTint(0xffc840).setAlpha(economy.gold >= nextCost ? 0.9 : 0.45);
        p.price.setText(STR.unlockCapsule(fmt(nextCost))).setColor(economy.gold >= nextCost ? TXT.gold : TXT.bad);
      }
      if (h) {
        if (p.hero.heroBaseScale === undefined) p.hero.setScale(HERO_SCALE);
        setHeroPortrait(p.hero, h);
        fit(p.name.setText(h.name), 150);
        const ratio = h.energy / maxEnergy(h);
        const col = energyColor(ratio);
        p.bar.setValue(ratio, col);
        p.fill.setFillStyle(col, 0.24).setSize(76, 4 + 118 * ratio);
        p.glow.setTint(h.rarity > 0 ? RARITY_COLORS[h.rarity] : 0x60e8ff).setAlpha(0.35);
      }
    }
  }

  // ---------- Expedições ----------
  buildExpeditions(s, onSend, onCollect) {
    const v = this.views.exp = s.add.container(0, 0);
    this.add(v);
    v.add(txt(s, 24, 100, STR.expHint, 18, TXT.dim).setWordWrapWidth(W - 48));
    // 1 vaga grátis + 2 do Passe do Minerador (trancadas sem o Passe).
    const n = BALANCE.expeditions.slots + BALANCE.premium.expeditionSlots;
    this.expCards = Array.from({ length: n }, (_, i) => {
      // Cartão em 4 linhas: nome · tempo · barra · prêmios; o botão fica embaixo, sem cobrir nada.
      const CH = 214;
      const y = 150 + i * (CH + 12);
      const premiumSlot = i >= BALANCE.expeditions.slots;
      const bg = card(s, 24, y, W - 48, CH, premiumSlot ? COL.gold : COL.border);
      const portrait = s.add.sprite(86, y + 92, 'hero0_down_0').setScale(4.4);
      const name = txt(s, 150, y + 30, '', 23, TXT.main).setOrigin(0, 0.5);
      const time = txt(s, 150, y + 62, '', 19, TXT.gold).setOrigin(0, 0.5);
      const bar = new ProgressBar(s, 150, y + 92, W - 48 - 150, 12, COL.gold);
      const reward = txt(s, 150, y + 120, '', 15, TXT.good).setOrigin(0, 0.5);
      const free = txt(s, W / 2, y + 66, premiumSlot ? '' : STR.expFree, 23, TXT.dim).setOrigin(0.5);
      const crown = premiumSlot ? s.add.image(60, y + 66, 'icon_premium').setScale(3) : null;
      const c = { bg, portrait, name, time, bar, reward, free, crown, premiumSlot };
      c.btn = new Button(s, W / 2 + 40, y + CH - 40, 320, 52, '', () => {
        if (c.locked) { s.premiumModal.show(); return; }
        if (c.done) onCollect(i); else onSend();
      }, { fontSize: 20, onDisabledClick: () => s.toast.show(c.busyMsg || STR.expFull, 1600) });
      v.add([bg, portrait, name, time, bar, reward, free, c.btn]);
      if (crown) v.add(crown);
      return c;
    });
  }

  refreshExpeditions() {
    const fmtMs = (ms) => {
      const m = Math.ceil(ms / 60000);
      return m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`) : `${m} min`;
    };
    this.expCards.forEach((c, i) => {
      const e = economy.expeditions[i];
      const h = e ? economy.heroByUid(e.uid) : null;
      c.done = false;
      c.locked = c.premiumSlot && !premiumActive() && !h;
      [c.portrait, c.name, c.time, c.bar, c.reward].forEach((o) => o.setVisible(!!h));
      c.free.setVisible(!h);
      c.crown?.setVisible(!h);
      if (c.premiumSlot) c.free.setText(c.locked ? STR.expPremiumSlot : STR.expFree);
      if (c.locked) {
        c.btn.setLabel(STR.expPremiumBtn).setColors(0xd89a28, 0x7a4806).setEnabled(true);
        return;
      }
      if (!h) {
        c.btn.setLabel(STR.expSend).setColors(COL.btn, COL.btnBorder).setEnabled(true);
        return;
      }
      const left = msLeft(e);
      c.done = left <= 0;
      setHeroPortrait(c.portrait, h);
      fit(c.name.setText(h.name), 500);
      c.time.setText(c.done ? STR.expDone : STR.expBack(fmtMs(left))).setColor(c.done ? TXT.good : TXT.gold);
      c.bar.setValue(1 - left / (e.hours * 3600000), c.done ? 0x6fd36b : COL.gold);
      const r = e.reward;
      fit(c.reward.setText(STR.expReward(fmt(r.gold), r.crystals, r.essence, r.gems, r.sealed)), W - 48 - 160);
      c.btn.setLabel(c.done ? STR.collect : STR.expBusy).setColors(c.done ? COL.btn : COL.card, c.done ? COL.btnBorder : COL.border)
        .setEnabled(c.done);
      c.busyMsg = STR.expBack(fmtMs(left));
    });
  }
}
