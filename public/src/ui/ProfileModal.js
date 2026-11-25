// Perfil de outro jogador (tocar no nome no Ranking): números de todos os rankings, a equipe principal
// e, ao tocar num herói, os itens dele (tocar no item mostra os atributos). Dados: profiles + vitrine (showcase).
import { BALANCE } from '../config/balance.js';
import { COL, TXT, TITLE_FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Modal, txt, fit, card } from './widgets.js';
import { Button } from './Button.js';
import { fmt, fmtShort } from './format.js';
import { royalGlowKey } from './skin.js';
import { setHeroPortrait } from '../art/hd.js';
import { ROLES, RARITY_NAMES, RARITY_TEXT, RARITY_COLORS } from '../data/heroes.js';
import { GEAR_SLOTS, SETS } from '../data/items.js';
import { itemTitle, itemSubtitle, itemStatLines, itemIcon } from './itemText.js';
import { showcaseItem } from '../systems/Showcase.js';
import { sb } from '../systems/Cloud.js';
import { economy } from '../systems/Economy.js';

const W = BALANCE.screen.width;
const X0 = 24, Y0 = 70, WW = W - 48, WH = 1130;
const GRID_Y = 470;

export const fmtDur = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

export class ProfileModal extends Modal {
  constructor(scene) {
    super(scene, 420, 0.75);
    const s = scene;
    this.add(card(s, X0, Y0, WW, WH, COL.gold, COL.panel));
    this.add(s.add.image(W / 2, Y0, royalGlowKey(s)).setOrigin(0.5, 0).setDisplaySize(WW, 300));
    this.plateY = Y0 + 66;
    this.name = s.add.text(W / 2, this.plateY, '', { fontFamily: TITLE_FONT, fontSize: fs(34), color: '#fff3c4' })
      .setOrigin(0.5).setStroke('#2a0c40', 7);
    this.sub = txt(s, W / 2, Y0 + 124, '', 18, '#e8d8ff').setOrigin(0.5);
    this.add([this.name, this.sub]);

    // números de todos os rankings (3 × 2)
    this.statBoxes = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = X0 + 18 + (i % 3) * 214, y = Y0 + 156 + Math.floor(i / 3) * 78;
      const b = card(s, x, y, 200, 68, COL.border, 0x261440);
      const l = txt(s, x + 100, y + 18, '', 14, TXT.dim).setOrigin(0.5);
      const v = txt(s, x + 100, y + 46, '', 22, TXT.gold, true).setOrigin(0.5);
      this.add([b, l, v]);
      return { l, v };
    });
    this.sectionTitle = txt(s, X0 + 20, GRID_Y - 26, '', 21, TXT.gold, true).setOrigin(0, 0.5);
    this.add(this.sectionTitle);

    // equipe: 6 cartões
    this.team = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = X0 + 18 + (i % 3) * 214, y = GRID_Y + Math.floor(i / 3) * 196;
      const b = card(s, x, y, 200, 186, COL.border, 0x2a1846);
      const glow = s.add.circle(x + 100, y + 72, 54, 0x5a2e8a, 0.45);
      const por = s.add.sprite(x + 100, y + 70, 'hero0_down_0').setScale(4);
      const nm = txt(s, x + 100, y + 136, '', 17, TXT.main, true).setOrigin(0.5);
      const ln = txt(s, x + 100, y + 162, '', 14, TXT.dim).setOrigin(0.5);
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.showHero(i));
      this.add([b, glow, por, nm, ln]);
      return { b, glow, por, nm, ln };
    });

    // herói escolhido: retrato grande, ficha e itens
    this.heroParts = [];
    const hp = (o) => { this.heroParts.push(o); this.add(o); return o; };
    this.backBtn = hp(new Button(s, X0 + 104, GRID_Y - 26, 168, 46, STR.profBack, () => this.showTeam(), { fontSize: 18, color: COL.card, border: COL.border }));
    hp(s.add.circle(X0 + 130, GRID_Y + 110, 86, 0x5a2e8a, 0.45));
    this.bigPor = hp(s.add.sprite(X0 + 130, GRID_Y + 110, 'hero0_down_0').setScale(5.6));
    this.hName = hp(txt(s, X0 + 250, GRID_Y + 40, '', 26, TXT.gold, true).setOrigin(0, 0.5));
    this.hRole = hp(txt(s, X0 + 250, GRID_Y + 78, '', 18, TXT.main).setOrigin(0, 0.5));
    this.hLvl = hp(txt(s, X0 + 250, GRID_Y + 110, '', 18, TXT.main).setOrigin(0, 0.5));
    this.hPow = hp(txt(s, X0 + 250, GRID_Y + 142, '', 20, TXT.gold, true).setOrigin(0, 0.5));
    this.slots = GEAR_SLOTS.map((g, i) => {
      const x = X0 + 18 + (i % 5) * 128, y = GRID_Y + 216 + Math.floor(i / 5) * 128;
      const b = hp(card(s, x, y, 118, 118, COL.border, 0x261440));
      const ic = hp(s.add.image(x + 59, y + 55, `item_${g.type}_empty`).setDisplaySize(92, 92));
      const pl = hp(txt(s, x + 110, y + 104, '', 16, '#ffe28a', true).setOrigin(1, 0.5).setStroke('#12081c', 4));
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.showItem(g.key));
      return { g, b, ic, pl };
    });
    const iy = GRID_Y + 480;
    this.iBox = hp(card(s, X0 + 18, iy, WW - 36, 150, COL.border, 0x1c0e30));
    this.iTitle = hp(txt(s, X0 + 36, iy + 24, '', 20, TXT.main, true).setOrigin(0, 0.5));
    this.iSub = hp(txt(s, X0 + 36, iy + 50, '', 15, TXT.dim).setOrigin(0, 0.5));
    this.iLines = [0, 1, 2, 3, 4, 5].map((k) => hp(txt(s, X0 + 36 + (k % 2) * 310, iy + 80 + Math.floor(k / 2) * 24, '', 16, TXT.main).setOrigin(0, 0.5)));

    this.msg = txt(s, W / 2, GRID_Y + 160, '', 22, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(WW - 80);
    this.add(this.msg);
    this.add(new Button(s, W / 2, Y0 + WH - 52, 260, 70, STR.close, () => this.close(), { fontSize: 24, color: COL.card, border: COL.border }));
  }

  // id do jogador e texto da posição no ranking aberto
  async show(id, nick, posText) {
    this.open();
    this.data = null;
    this.setPlate();
    this.name.setText(nick || '');
    fit(this.name, WW - 220);
    this.sub.setText(posText || '');
    this.statBoxes.forEach((b) => { b.l.setText(''); b.v.setText(''); });
    this.showTeam();
    this.msg.setText(STR.rankLoading).setVisible(true);
    this.team.forEach((t) => [t.b, t.glow, t.por, t.nm, t.ln].forEach((o) => o.setVisible(false)));
    try {
      const { data, error } = await sb().from('profiles')
        .select('nickname, stages_cleared, best_power, play_seconds, abyss_best, max_hero_level, colossus_week, colossus_week_dmg, showcase')
        .eq('id', id).maybeSingle();
      if (error || !data) throw error || new Error('none');
      this.data = data;
      const wk = economy.weekIndex();
      const vals = [
        [STR.rankBoards.stages, fmt(data.stages_cleared)],
        [STR.rankBoards.power, fmtShort(data.best_power)],
        [STR.rankBoards.abyss, String(data.abyss_best)],
        [STR.rankBoards.level, String(data.max_hero_level)],
        [STR.rankBoards.colossus, data.colossus_week === wk ? fmtShort(data.colossus_week_dmg) : '0'],
        [STR.rankBoards.time, fmtDur(data.play_seconds)],
      ];
      this.statBoxes.forEach((b, i) => { b.l.setText(vals[i][0]); fit(b.v.setText(vals[i][1]), 186); });
      this.msg.setVisible(false);
      this.showTeam();
    } catch (e) {
      this.msg.setText(STR.rankError).setVisible(true);
    }
  }

  setPlate() {
    if (this.plate || !this.scene.textures.exists('rk_footer')) return;
    const t = this.scene.textures.get('rk_footer').getSourceImage();
    const k = 96 / t.height;
    this.plate = this.scene.add.nineslice(W / 2, this.plateY, 'rk_footer', null, (WW - 60) / k, t.height, 130, 130, 0, 0).setScale(k);
    this.addAt(this.plate, 3);
  }

  heroes() { return this.data?.showcase?.heroes || []; }

  showTeam() {
    this.heroParts.forEach((o) => o.setVisible(false));
    this.sectionTitle.setVisible(true).setText(STR.profTeam);
    const hs = this.heroes();
    this.team.forEach((t, i) => {
      const h = hs[i];
      [t.b, t.glow, t.por, t.nm, t.ln].forEach((o) => o.setVisible(!!h));
      if (!h) return;
      t.b.setStrokeStyle(4, RARITY_COLORS[h.q] ?? COL.border);
      setHeroPortrait(t.por, { role: h.r, rarity: h.q, palette: h.pa });
      fit(t.nm.setText(h.n).setColor(RARITY_TEXT[h.q] || TXT.main), 188);
      fit(t.ln.setText(STR.profHeroLine(h.l, fmtShort(h.pw))), 188);
    });
    if (this.data && !hs.length) this.msg.setText(STR.profNoTeam).setVisible(true);
  }

  showHero(i) {
    const h = this.heroes()[i];
    if (!h) return;
    this.hero = h;
    this.sectionTitle.setVisible(false);
    this.team.forEach((t) => [t.b, t.glow, t.por, t.nm, t.ln].forEach((o) => o.setVisible(false)));
    this.heroParts.forEach((o) => o.setVisible(true));
    setHeroPortrait(this.bigPor, { role: h.r, rarity: h.q, palette: h.pa });
    fit(this.hName.setText(h.n).setColor(RARITY_TEXT[h.q] || TXT.gold), WW - 260);
    this.hRole.setText(`${RARITY_NAMES[h.q] || ''} · ${ROLES[h.r]?.name || ''}`).setColor(RARITY_TEXT[h.q] || TXT.main);
    this.hLvl.setText(STR.profLevel(h.l, h.aw));
    this.hPow.setText(STR.profPower(fmtShort(h.pw)));
    this.slots.forEach((sl) => {
      const g = h.g?.[sl.g.key];
      const key = g ? itemIcon(showcaseItem(g)) : `item_${sl.g.type}_empty`;
      if (this.scene.textures.exists(key)) sl.ic.setTexture(key).setDisplaySize(92, 92);
      sl.ic.setAlpha(g ? 1 : 0.35);
      sl.b.setStrokeStyle(3, g ? (RARITY_COLORS[g.q] ?? COL.border) : COL.border);
      sl.pl.setText(g && g.p ? `+${g.p}` : '');
    });
    const first = GEAR_SLOTS.find((g) => h.g?.[g.key]);
    this.showItem(first ? first.key : null);
  }

  showItem(key) {
    const g = key && this.hero?.g?.[key];
    this.slots.forEach((sl) => sl.b.setFillStyle(sl.g.key === key && g ? 0x4a2a7a : 0x261440));
    if (!g) {
      this.iTitle.setText(STR.profNoItem).setColor(TXT.dim);
      this.iSub.setText('');
      this.iLines.forEach((t) => t.setText(''));
      return;
    }
    const it = showcaseItem(g);
    fit(this.iTitle.setText(itemTitle(it)).setColor(RARITY_TEXT[it.rarity] || TXT.main), WW - 80);
    const set = it.set && SETS[it.set] ? ` · ${STR.profSet(SETS[it.set].name)}` : '';
    fit(this.iSub.setText(itemSubtitle(it) + set), WW - 80);
    const lines = itemStatLines(it);
    this.iLines.forEach((t, k) => {
      const l = lines[k];
      fit(t.setText(l ? l.text : '').setColor(l?.main ? TXT.gold : TXT.main), 296);
    });
  }
}
