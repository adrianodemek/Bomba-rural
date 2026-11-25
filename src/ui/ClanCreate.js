// Criar clã (prévia até o modo online): nome, emblema em mosaico 8×8 pintado à mão, regras de entrada.
// O editor funciona de verdade e o rascunho fica salvo (economy.clanDraft); "Criar clã" só guarda e avisa que vem com o online.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { economy } from '../systems/Economy.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { Sfx } from '../systems/Sfx.js';
import { Button } from './Button.js';
import { txt, fit, card } from './widgets.js';
import { fmtShort } from './format.js';
import { EMBLEM_COLORS, EMBLEM_MODELS, EMPTY_EMBLEM, cellAt, drawEmblem, paintEmblem } from './clanEmblem.js';

const W = BALANCE.screen.width;
const GX = 26, GY = 306, CELL = 54, GAP = 2, STEP = CELL + GAP;
const TOOLS = ['brush', 'fill', 'eraser', 'mirror', 'undo', 'clear'];
const TOOL_ICON = { brush: '✎', fill: '🪣', eraser: '⌫', mirror: '⇋', undo: '↶', clear: '🗑' };
const POWER_STEPS = [0, 10e3, 20e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 5e6];
const LANGS = ['pt', 'en', 'es'];
const STARTER = EMBLEM_MODELS[1].pattern.replace(/0/g, 'd'); // cristal no roxo

export class ClanCreate extends Phaser.GameObjects.Container {
  constructor(scene, { soon }) {
    super(scene, 0, 0);
    const s = scene;
    this.soon = soon;
    const d = economy.clanDraft;
    this.draft = {
      name: d?.name || STR.clanNameDefault, emblem: d?.emblem || STARTER,
      rule: d?.rule || 'approval', minPower: d?.minPower ?? 50e3, lang: d?.lang || 'pt',
    };
    this.tool = 'brush';
    this.mirror = false;
    this.color = 10;          // ciano
    this.undo = [];

    this.add(card(s, 20, 92, W - 40, 44, COL.gold, 0x2a1a08));
    this.add(txt(s, W / 2, 114, STR.clanNoticeCreate, 15, TXT.gold).setOrigin(0.5));

    // Nome + prévias (grande, ranking e botão do campo)
    this.add(card(s, 20, 146, W - 40, 118, COL.gold));
    this.pvBig = drawEmblem(s, 80, 205, 92, EMPTY_EMBLEM);
    this.add(txt(s, 146, 166, STR.clanNameLabel, 14, TXT.dim).setOrigin(0, 0.5));
    const nameBox = s.add.rectangle(146, 178, 420, 50, 0x0c0614).setOrigin(0).setStrokeStyle(2, 0x7a5418);
    nameBox.setInteractive({ useHandCursor: true }).on('pointerup', () => this.askName());
    this.nameText = txt(s, 160, 203, '', 20, TXT.main, true).setOrigin(0, 0.5);
    this.nameCount = txt(s, 554, 203, '', 13, TXT.dim).setOrigin(1, 0.5);
    this.add([this.pvBig, nameBox, this.nameText, this.nameCount]);
    this.add(txt(s, 146, 243, STR.clanSeenRanking, 14, TXT.dim).setOrigin(0, 0.5));
    this.pvSmall = drawEmblem(s, 352, 243, 30, EMPTY_EMBLEM);
    this.pvSmallName = txt(s, 374, 243, '', 16, TXT.main, true).setOrigin(0, 0.5);
    this.add([this.pvSmall, this.pvSmallName]);
    this.add(txt(s, 630, 162, STR.clanSeenField, 12, TXT.dim).setOrigin(0.5));
    this.add(s.add.circle(630, 210, 32, 0x120a1e, 0.85).setStrokeStyle(2, 0xc8962a));
    this.pvField = drawEmblem(s, 630, 210, 40, EMPTY_EMBLEM);
    this.add(this.pvField);

    // Grade 8×8
    this.add(txt(s, 24, 286, STR.clanEmblemTitle, 19, TXT.gold, true).setOrigin(0, 0.5));
    const side = 8 * STEP - GAP;
    this.add(s.add.rectangle(GX - 8, GY - 8, side + 16, side + 16, 0x0a0612).setOrigin(0).setStrokeStyle(3, 0xc8962a));
    this.cells = Array.from({ length: 64 }, (_, i) => {
      const r = s.add.rectangle(GX + (i % 8) * STEP, GY + Math.floor(i / 8) * STEP, CELL, CELL, 0x000000).setOrigin(0);
      this.add(r);
      return r;
    });
    this.cursor = s.add.rectangle(0, 0, CELL + 6, CELL + 6).setOrigin(0).setStrokeStyle(3, 0xffffff).setVisible(false);
    this.add(this.cursor);
    const zone = s.add.rectangle(GX, GY, side, side, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p, x, y) => this.strokeStart(x, y));
    zone.on('pointermove', (p, x, y) => { if (p.isDown && this.painting) this.strokeAt(x, y); });
    zone.on('pointerup', () => this.strokeEnd());
    zone.on('pointerout', () => this.strokeEnd());
    this.add(zone);

    // Ferramentas
    this.toolBtns = TOOLS.map((t, k) => {
      const b = new Button(s, 603, GY - 6 + 29 + k * 75, 194, 58, `${TOOL_ICON[t]}  ${STR.clanTools[t]}`, () => this.useTool(t), {
        fontSize: 18, color: COL.card, border: COL.border,
      });
      b.tool = t;
      this.add(b);
      return b;
    });

    // Paleta
    const py = GY + 8 * STEP + 22;
    this.add(s.add.rectangle(20, py, 96, 100, COL.slot).setOrigin(0).setStrokeStyle(2, 0x7a5418));
    this.curSwatch = s.add.rectangle(68, py + 40, 60, 60, 0x000000).setStrokeStyle(3, 0xffffff);
    this.curX = txt(s, 68, py + 40, '✕', 30, '#ff6a5a', true).setOrigin(0.5);
    this.add([this.curSwatch, this.curX, txt(s, 68, py + 86, STR.clanCurrentColor, 12, TXT.dim).setOrigin(0.5)]);
    this.swatches = EMBLEM_COLORS.map((c, k) => {
      const x = 136 + (k % 8) * 58 + 22, y = py + 2 + Math.floor(k / 8) * 54 + 22;
      const r = s.add.rectangle(x, y, 44, 44, c ?? 0x2a1a3e).setStrokeStyle(2, 0x5a4018);
      r.setInteractive({ useHandCursor: true }).on('pointerup', () => this.pickColor(k));
      this.add(r);
      if (c === null) this.add(txt(s, x, y, '✕', 24, '#ff6a5a', true).setOrigin(0.5));
      return r;
    });
    this.add(txt(s, 610, py + 4, STR.clanEmptyColor, 12, TXT.dim));

    // Modelos
    const my = py + 112;
    this.add(txt(s, 24, my + 12, STR.clanModels, 19, TXT.gold, true).setOrigin(0, 0.5));
    EMBLEM_MODELS.forEach((m, k) => {
      const x = 20 + k * 80 + 33, y = my + 30 + 33;
      const box = s.add.rectangle(x, y, 66, 66, 0x3a2a50).setStrokeStyle(2, 0x5a4018);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.applyModel(m.pattern));
      this.add([box, drawEmblem(s, x, y, 50, m.pattern, false), txt(s, x, y + 46, m.name, 12, TXT.dim).setOrigin(0.5)]);
    });

    // Regras, poder mínimo, idioma
    const ry = my + 136;
    this.ruleBtns = ['open', 'approval', 'invite'].map((r, k) => {
      const b = new Button(s, 20 + 113 + k * 227, ry + 25, 224, 50, STR.clanRules[r], () => { this.draft.rule = r; this.changed(); }, {
        fontSize: 17, color: COL.card, border: COL.border,
      });
      b.rule = r;
      this.add(b);
      return b;
    });
    const pyy = ry + 86;
    this.add(txt(s, 20, pyy, STR.clanMinPower, 16, TXT.main, true).setOrigin(0, 0.5));
    this.add(new Button(s, 150, pyy, 44, 44, '−', () => this.stepPower(-1), { fontSize: 24, color: COL.card, border: COL.border }));
    this.powerText = txt(s, 205, pyy, '', 20, TXT.gold, true).setOrigin(0.5);
    this.add(this.powerText);
    this.add(new Button(s, 260, pyy, 44, 44, '+', () => this.stepPower(1), { fontSize: 24, color: COL.card, border: COL.border }));
    this.add(txt(s, 470, pyy, STR.clanLang, 15, TXT.dim).setOrigin(1, 0.5));
    this.langBtn = new Button(s, 595, pyy, 210, 46, '', () => {
      this.draft.lang = LANGS[(LANGS.indexOf(this.draft.lang) + 1) % LANGS.length];
      this.changed();
    }, { fontSize: 17, color: COL.card, border: COL.border });
    this.add(this.langBtn);
    this.createBtn = new Button(s, W / 2, ry + 151, W - 40, 70, STR.clanCreate, () => {
      this.save();
      this.scene.toast.show(STR.clanDraftSaved, 2600);
    }, { fontSize: 24 });
    this.createBtn.label.setY(-12);
    this.add([this.createBtn, txt(s, W / 2, ry + 169, STR.clanCreateCost(100), 14, TXT.onGold).setOrigin(0.5)]);
  }

  // ---------- Pintura ----------
  cellFrom(x, y) {
    const c = Math.floor(x / STEP), r = Math.floor(y / STEP);
    if (c < 0 || c > 7 || r < 0 || r > 7) return -1;
    return r * 8 + c;
  }

  setCell(pattern, i, v) {
    return pattern.slice(0, i) + v.toString(16) + pattern.slice(i + 1);
  }

  pushUndo() {
    this.undo.push(this.draft.emblem);
    if (this.undo.length > 40) this.undo.shift();
  }

  strokeStart(x, y) {
    const i = this.cellFrom(x, y);
    if (i < 0) return;
    this.pushUndo();
    if (this.tool === 'fill') { this.flood(i); this.changed(); return; }
    this.painting = true;
    this.strokeAt(x, y);
  }

  strokeAt(x, y) {
    const i = this.cellFrom(x, y);
    if (i < 0) return;
    const v = this.tool === 'eraser' ? 0 : this.color;
    let p = this.setCell(this.draft.emblem, i, v);
    if (this.mirror) p = this.setCell(p, Math.floor(i / 8) * 8 + (7 - (i % 8)), v);
    this.cursor.setPosition(GX + (i % 8) * STEP - 3, GY + Math.floor(i / 8) * STEP - 3).setVisible(true);
    if (p !== this.draft.emblem) { this.draft.emblem = p; this.changed(false); }
  }

  strokeEnd() {
    if (!this.painting) return;
    this.painting = false;
    this.cursor.setVisible(false);
    if (this.undo[this.undo.length - 1] === this.draft.emblem) this.undo.pop();   // não mudou nada
    this.saveSoon();
  }

  // Balde: pinta a área da mesma cor ligada ao quadrado tocado (e o espelho dela, se ligado).
  flood(start) {
    const v = this.tool === 'fill' ? this.color : 0;
    let p = this.draft.emblem;
    const fillFrom = (st) => {
      const from = cellAt(p, st);
      if (from === v) return;
      const stack = [st], seen = new Set();
      while (stack.length) {
        const i = stack.pop();
        if (seen.has(i) || cellAt(p, i) !== from) continue;
        seen.add(i);
        p = this.setCell(p, i, v);
        const r = Math.floor(i / 8), c = i % 8;
        if (c > 0) stack.push(i - 1);
        if (c < 7) stack.push(i + 1);
        if (r > 0) stack.push(i - 8);
        if (r < 7) stack.push(i + 8);
      }
    };
    fillFrom(start);
    if (this.mirror) fillFrom(Math.floor(start / 8) * 8 + (7 - (start % 8)));
    this.draft.emblem = p;
  }

  useTool(t) {
    if (t === 'mirror') { this.mirror = !this.mirror; this.refresh(); return; }
    if (t === 'undo') {
      if (!this.undo.length) return;
      this.draft.emblem = this.undo.pop();
      this.changed();
      return;
    }
    if (t === 'clear') { this.pushUndo(); this.draft.emblem = EMPTY_EMBLEM; this.changed(); return; }
    this.tool = t;
    this.refresh();
  }

  pickColor(k) {
    Sfx.play('click');
    this.color = k;
    if (k === 0) this.tool = 'eraser';
    else if (this.tool === 'eraser') this.tool = 'brush';
    this.refresh();
  }

  applyModel(pattern) {
    Sfx.play('click');
    this.pushUndo();
    this.draft.emblem = pattern;
    this.changed();
  }

  stepPower(dir) {
    const i = POWER_STEPS.findIndex((v) => v >= this.draft.minPower);
    const k = Math.max(0, Math.min(POWER_STEPS.length - 1, (i < 0 ? POWER_STEPS.length - 1 : i) + dir));
    this.draft.minPower = POWER_STEPS[k];
    this.changed();
  }

  askName() {
    const v = window.prompt(STR.clanNamePrompt, this.draft.name);
    if (typeof v !== 'string') return;
    const name = v.replace(/\s+/g, ' ').trim().slice(0, 18);
    if (name) { this.draft.name = name; this.changed(); }
  }

  // ---------- Estado ----------
  changed(save = true) {
    this.refresh();
    if (save) this.saveSoon();
  }

  saveSoon() {
    economy.clanDraft = { ...this.draft };
  }

  save() {
    this.saveSoon();
    SaveSystem.save(economy);
  }

  refresh() {
    const e = this.draft.emblem;
    this.cells.forEach((r, i) => {
      const c = EMBLEM_COLORS[cellAt(e, i)];
      r.setFillStyle(c ?? (((i % 8) + Math.floor(i / 8)) % 2 ? 0x241a36 : 0x1a1228));
    });
    paintEmblem(this.pvBig, e, 92);
    paintEmblem(this.pvSmall, e, 30);
    paintEmblem(this.pvField, e, 40);
    fit(this.nameText.setText(this.draft.name), 370);
    this.nameCount.setText(`${this.draft.name.length}/18`);
    fit(this.pvSmallName.setText(this.draft.name), 180);
    this.toolBtns.forEach((b) => {
      const on = b.tool === this.tool || (b.tool === 'mirror' && this.mirror);
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
      if (b.tool === 'mirror') b.setLabel(`${TOOL_ICON.mirror}  ${STR.clanTools.mirror}${this.mirror ? ' ✓' : ''}`);
    });
    const c = EMBLEM_COLORS[this.color];
    this.curSwatch.setFillStyle(c ?? 0x2a1a3e);
    this.curX.setVisible(c === null);
    this.swatches.forEach((r, k) => r.setStrokeStyle(k === this.color ? 4 : 2, k === this.color ? 0xffd86a : 0x5a4018));
    this.ruleBtns.forEach((b) => {
      const on = b.rule === this.draft.rule;
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
    });
    this.powerText.setText(this.draft.minPower ? fmtShort(this.draft.minPower) : '0');
    this.langBtn.setLabel(STR.clanLangs[this.draft.lang]);
  }
}
