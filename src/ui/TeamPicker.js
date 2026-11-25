// Escolher quem ocupa uma vaga da equipe (toque num cartão do painel da equipe, na tela de batalha).
// Com alguém na vaga: "Ver ficha" e "Tirar da equipe" no alto. Embaixo, a lista dos outros heróis
// (mais fortes primeiro); tocar num deles coloca na vaga (se vier de outra equipe, os dois trocam).
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS, RARITY_NAMES, RARITY_TEXT, ROLES } from '../data/heroes.js';
import { economy } from '../systems/Economy.js';
import { statsOf, placeInTeam, assignTeam } from '../systems/Roster.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { fmt } from './format.js';
import { setHeroPortrait } from '../art/hd.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const PER_PAGE = 6;
const ROW_H = 104;
const LIST_Y = 420;

export class TeamPicker extends Modal {
  constructor(scene, { onDetail, onDone }) {
    super(scene, 360);
    const s = scene;
    this.onDetail = onDetail;
    this.onDone = onDone;
    this.page = 0;
    this.panel = frame(s, 40, 120, W - 80, 1060, COL.panel).setOrigin(0).setStrokeStyle(4, COL.gold);
    this.panel.setInteractive();
    this.title = txt(s, 70, 170, '', 28, TXT.gold).setOrigin(0, 0.5);
    this.closeBtn = new Button(s, W - 130, 170, 140, 56, STR.close, () => this.close(), { fontSize: 20, color: COL.card, border: COL.border });
    this.add([this.panel, this.title, this.closeBtn]);

    // Quem está na vaga agora.
    this.curBg = frame(s, 64, 214, W - 128, 120, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
    this.curPortrait = s.add.sprite(112, 276, 'hero0_down_0').setScale(3.2);
    this.curName = txt(s, 160, 250, '', 22, TXT.main, true).setOrigin(0, 0.5);
    this.curInfo = txt(s, 160, 280, '', 16, TXT.dim).setOrigin(0, 0.5);
    this.curPower = txt(s, 160, 306, '', 16, TXT.gold).setOrigin(0, 0.5);
    this.detailBtn = new Button(s, 560, 248, 170, 50, STR.pickerDetail, () => { const h = this.current; this.close(); if (h) this.onDetail(h); }, {
      fontSize: 18, color: COL.royal, border: COL.royalBorder,
    });
    this.removeBtn = new Button(s, 560, 304, 170, 46, STR.pickerRemove, () => this.removeCurrent(), {
      fontSize: 16, color: COL.card, border: COL.border,
    });
    this.emptyCur = txt(s, W / 2, 274, STR.pickerEmptySlot, 22, TXT.dim).setOrigin(0.5);
    this.curParts = [this.curPortrait, this.curName, this.curInfo, this.curPower, this.detailBtn, this.removeBtn];
    this.add([this.curBg, ...this.curParts, this.emptyCur]);

    this.listTitle = txt(s, 70, 380, STR.pickerListTitle, 21, TXT.main, true).setOrigin(0, 0.5);
    this.none = txt(s, W / 2, 640, STR.pickerNone, 20, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 160);
    this.add([this.listTitle, this.none]);
    this.rows = [];
    for (let i = 0; i < PER_PAGE; i++) {
      const y = LIST_Y + i * ROW_H;
      const bg = frame(s, 64, y, W - 128, ROW_H - 10, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
      const portrait = s.add.sprite(108, y + 46, 'hero0_down_0').setScale(2.7);
      const name = txt(s, 150, y + 26, '', 20, TXT.main, true).setOrigin(0, 0.5);
      const info = txt(s, 150, y + 52, '', 15, TXT.dim).setOrigin(0, 0.5);
      const power = txt(s, 150, y + 74, '', 15, TXT.gold).setOrigin(0, 0.5);
      const tagBg = frame(s, W - 84, y + 30, 120, 34, 0x120a1e).setOrigin(1, 0.5).setStrokeStyle(2, 0x7a5418);
      const tag = txt(s, W - 144, y + 30, '', 15, TXT.dim, true).setOrigin(0.5);
      const go = txt(s, W - 96, y + 68, STR.pickerPut, 16, TXT.good, true).setOrigin(1, 0.5);
      const row = { bg, portrait, name, info, power, tagBg, tag, go, hero: null };
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { if (row.hero) this.pick(row.hero); });
      this.add([bg, portrait, name, info, power, tagBg, tag, go]);
      this.rows.push(row);
    }
    this.pageText = txt(s, W / 2, 1110, '', 22, TXT.dim).setOrigin(0.5);
    this.prevBtn = new Button(s, 240, 1110, 120, 54, '<', () => this.turn(-1), { fontSize: 26, color: COL.card, border: COL.border });
    this.nextBtn = new Button(s, 480, 1110, 120, 54, '>', () => this.turn(1), { fontSize: 26, color: COL.card, border: COL.border });
    this.add([this.pageText, this.prevBtn, this.nextBtn]);
  }

  // team: 0..2 · slot: posição do cartão · current: herói da vaga (ou null)
  show(team, slot, current) {
    this.team = team;
    this.slot = slot;
    this.current = current || null;
    this.page = 0;
    this.refresh();
    this.open();
  }

  candidates() {
    return economy.heroes
      .filter((h) => h.team !== this.team && !economy.onExpedition(h.uid))
      .map((h) => ({ h, p: statsOf(h).power }))
      .sort((a, b) => b.p - a.p)
      .map((x) => x.h);
  }

  turn(d) {
    const pages = Math.max(1, Math.ceil(this.candidates().length / PER_PAGE));
    this.page = Phaser.Math.Wrap(this.page + d, 0, pages);
    this.refresh();
  }

  pick(h) {
    if (!placeInTeam(h, this.team, this.current)) { this.scene.toast.show(STR.pickerFull, 1600); return; }
    this.close();
    this.onDone?.(STR.pickerPlaced(h.name, this.team));
  }

  removeCurrent() {
    const h = this.current;
    if (!h) return;
    assignTeam(h, null);
    this.close();
    this.onDone?.(STR.pickerRemoved(h.name));
  }

  heroInfo(h) {
    return `${RARITY_NAMES[h.rarity]} · ${ROLES[h.role]?.name ?? ''} · ${STR.levelShort(h.level)}`;
  }

  refresh() {
    this.title.setText(STR.pickerTitle('ABC'[this.team], this.slot + 1));
    const cur = this.current;
    this.curParts.forEach((o) => o.setVisible(!!cur));
    this.emptyCur.setVisible(!cur);
    if (cur) {
      setHeroPortrait(this.curPortrait, cur);
      fit(this.curName.setText(cur.name), 300);
      this.curInfo.setText(this.heroInfo(cur)).setColor(RARITY_TEXT[cur.rarity]);
      this.curPower.setText(STR.pickerPower(fmt(statsOf(cur).power)));
      this.curBg.setStrokeStyle(3, cur.rarity > 0 ? RARITY_COLORS[cur.rarity] : COL.border);
    } else this.curBg.setStrokeStyle(3, COL.border);

    const all = this.candidates();
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    this.none.setVisible(all.length === 0);
    this.pageText.setText(`${this.page + 1}/${pages}`);
    [this.prevBtn, this.nextBtn, this.pageText].forEach((o) => o.setVisible(pages > 1));
    const slice = all.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.rows.forEach((r, i) => {
      const h = slice[i] || null;
      r.hero = h;
      [r.bg, r.portrait, r.name, r.info, r.power, r.tagBg, r.tag, r.go].forEach((o) => o.setVisible(!!h));
      if (!h) return;
      setHeroPortrait(r.portrait, h);
      r.bg.setStrokeStyle(3, h.rarity > 0 ? RARITY_COLORS[h.rarity] : COL.border);
      fit(r.name.setText(h.name), 300);
      r.info.setText(this.heroInfo(h)).setColor(RARITY_TEXT[h.rarity]);
      r.power.setText(STR.pickerPower(fmt(statsOf(h).power)));
      r.tag.setText(h.team === null || h.team === undefined ? STR.pickerNoTeam : STR.pickerInTeam('ABC'[h.team]));
      r.tag.setColor(h.team === null || h.team === undefined ? TXT.dim : TXT.gold);
      r.go.setText(cur ? STR.pickerSwap : STR.pickerPut);
    });
  }
}
