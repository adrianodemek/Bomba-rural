// Perfil de outro jogador (tocar no nome no Ranking): números de todos os rankings, a equipe principal
// e, ao tocar num herói, os itens dele (tocar no item mostra os atributos). Dados: profiles + vitrine (showcase).
// Arte do ChatGPT (assets/ui/profile/): janela, caixas de número, cartões de herói, espaços de item, caixa de
// descrição e o pedestal do retrato. A tela é montada na primeira vez que abre (depois de baixar a arte).
import { BALANCE } from '../config/balance.js';
import { COL, TXT, TITLE_FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Modal, txt, fit } from './widgets.js';
import { Button } from './Button.js';
import { fmt, fmtShort } from './format.js';
import { setHeroPortrait } from '../art/hd.js';
import { ROLES, RARITY_NAMES, RARITY_TEXT, RARITY_COLORS } from '../data/heroes.js';
import { GEAR_SLOTS, SETS } from '../data/items.js';
import { itemTitle, itemSubtitle, itemStatLines, itemIcon } from './itemText.js';
import { showcaseItem } from '../systems/Showcase.js';
import { sb } from '../systems/Cloud.js';
import { economy } from '../systems/Economy.js';
import { badgeSlot } from './badges.js';

const W = BALANCE.screen.width;
const X0 = 24, Y0 = 18, WW = W - 48, WH = 1214;
const PLATE_Y = Y0 + 172, SUB_Y = Y0 + 230, STAT_Y = Y0 + 256;
const GRID_Y = 498, CARD_W = 200, CARD_H = 246;
const ART = ['window', 'stat', 'card', 'slot', 'desc', 'pedestal'];
const KEY = (n) => `pf_${n}`;

export const fmtDur = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

// Moldura esticada só no meio (cantos e enfeites do tamanho certo). Origem no canto de cima à esquerda.
function nine(s, key, x, y, w, h, l, r, t, b, k = 1) {
  return s.add.nineslice(x, y, key, null, w / k, h / k, l, r, t, b).setOrigin(0).setScale(k);
}

export class ProfileModal extends Modal {
  constructor(scene) {
    super(scene, 420, 0.75);
    this.built = false;
  }

  ensureArt(cb) {
    const s = this.scene;
    const missing = ART.filter((n) => !s.textures.exists(KEY(n)));
    if (!missing.length) { cb(); return; }
    missing.forEach((n) => s.load.image(KEY(n), `assets/ui/profile/${n}.png`));
    s.load.once('complete', () => {
      ART.forEach((n) => s.textures.exists(KEY(n)) && s.textures.get(KEY(n)).setFilter(Phaser.Textures.FilterMode.LINEAR));
      cb();
    });
    s.load.start();
  }

  build() {
    if (this.built) return;
    this.built = true;
    const s = this.scene;
    // janela (brasão em cima)
    this.add(nine(s, KEY('window'), X0, Y0, WW, WH, 90, 90, 150, 90, 1.07));
    // placa do nome (a mesma do ranking) e posição
    if (s.textures.exists('rk_footer')) {
      const t = s.textures.get('rk_footer').getSourceImage();
      const k = 92 / t.height;
      this.add(s.add.nineslice(W / 2, PLATE_Y, 'rk_footer', null, (WW - 70) / k, t.height, 130, 130, 0, 0).setScale(k));
    }
    this.name = s.add.text(W / 2, PLATE_Y, '', { fontFamily: TITLE_FONT, fontSize: fs(34), color: '#fff3c4' })
      .setOrigin(0.5).setStroke('#2a0c40', 7);
    this.sub = txt(s, W / 2, SUB_Y, '', 18, '#e8d8ff').setOrigin(0.5).setStroke('#1a0830', 4);
    this.add([this.name, this.sub]);
    this.badges = badgeSlot(s, this, 36);

    // números de todos os rankings (3 × 2)
    this.statBoxes = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = X0 + 18 + (i % 3) * 214, y = STAT_Y + Math.floor(i / 3) * 86;
      const b = nine(s, KEY('stat'), x, y, 200, 80, 60, 60, 40, 30, 0.5);
      const l = txt(s, x + 100, y + 33, '', 14, '#e8dcff', true).setOrigin(0.5).setStroke('#1a0830', 3);
      const v = txt(s, x + 100, y + 56, '', 22, TXT.gold, true).setOrigin(0.5).setStroke('#1a0830', 4);
      this.add([b, l, v]);
      return { l, v };
    });
    this.sectionTitle = txt(s, X0 + 22, GRID_Y - 24, '', 20, TXT.gold, true).setOrigin(0, 0.5).setStroke('#1a0830', 4);
    this.add(this.sectionTitle);

    // equipe: 6 cartões (retrato no medalhão, nome na faixa)
    this.team = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = X0 + 18 + (i % 3) * 214, y = GRID_Y + Math.floor(i / 3) * (CARD_H + 10);
      const b = s.add.image(x, y, KEY('card')).setOrigin(0).setDisplaySize(CARD_W, CARD_H);
      const glow = s.add.circle(x + CARD_W / 2, y + CARD_H * 0.36, 52, 0xffffff, 0.18);
      const por = s.add.sprite(x + CARD_W / 2, y + CARD_H * 0.37, 'hero0_down_0').setScale(3.6);
      const ln = txt(s, x + CARD_W / 2, y + CARD_H * 0.77, '', 12, '#f0e4ff', true).setOrigin(0.5).setStroke('#1a0830', 4);
      const nm = txt(s, x + CARD_W / 2, y + CARD_H * 0.862, '', 17, TXT.main, true).setOrigin(0.5).setStroke('#1a0830', 5);
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.showHero(i));
      this.add([b, glow, por, ln, nm]);
      return { parts: [b, glow, por, ln, nm], b, glow, por, ln, nm };
    });

    // herói escolhido: pedestal, retrato grande, ficha e itens
    this.heroParts = [];
    const hp = (o) => { this.heroParts.push(o); this.add(o); return o; };
    this.backBtn = hp(new Button(s, X0 + 104, GRID_Y - 24, 168, 46, STR.profBack, () => this.showTeam(), { fontSize: 18, color: COL.card, border: COL.border }));
    const pcx = X0 + 132, feet = GRID_Y + 176;
    const ped = hp(s.add.image(pcx, feet, KEY('pedestal')).setOrigin(0.5, 0.5));
    ped.setScale(230 / ped.width);
    this.bigPor = hp(s.add.sprite(pcx, feet - 84, 'hero0_down_0').setScale(6.4));
    this.hName = hp(txt(s, X0 + 262, GRID_Y + 40, '', 26, TXT.gold, true).setOrigin(0, 0.5).setStroke('#1a0830', 5));
    this.hRole = hp(txt(s, X0 + 262, GRID_Y + 78, '', 18, TXT.main, true).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.hLvl = hp(txt(s, X0 + 262, GRID_Y + 110, '', 18, TXT.main).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.hPow = hp(txt(s, X0 + 262, GRID_Y + 144, '', 21, TXT.gold, true).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.slots = GEAR_SLOTS.map((g, i) => {
      const x = X0 + 18 + (i % 5) * 128, y = GRID_Y + 226 + Math.floor(i / 5) * 126;
      const b = hp(s.add.image(x, y, KEY('slot')).setOrigin(0).setDisplaySize(118, 116));
      const tint = hp(s.add.circle(x + 59, y + 58, 40, 0xffffff, 0));
      const ic = hp(s.add.image(x + 59, y + 56, `item_${g.type}_empty`).setDisplaySize(84, 84));
      const pl = hp(txt(s, x + 104, y + 100, '', 16, '#ffe28a', true).setOrigin(1, 0.5).setStroke('#12081c', 4));
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.showItem(g.key));
      return { g, b, tint, ic, pl };
    });
    const iy = GRID_Y + 474;
    hp(nine(s, KEY('desc'), X0 + 14, iy, WW - 28, 160, 150, 150, 40, 40, 0.78));
    this.iTitle = hp(txt(s, X0 + 128, iy + 34, '', 20, TXT.main, true).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.iSub = hp(txt(s, X0 + 128, iy + 60, '', 15, '#d8c8f0').setOrigin(0, 0.5));
    this.iLines = [0, 1, 2, 3, 4, 5].map((k) => hp(txt(s, X0 + 128 + (k % 2) * 228, iy + 88 + Math.floor(k / 2) * 23, '', 15, TXT.main).setOrigin(0, 0.5)));

    this.msg = txt(s, W / 2, GRID_Y + 200, '', 22, '#d8c8f0').setOrigin(0.5).setAlign('center').setWordWrapWidth(WW - 100);
    this.add(this.msg);
    this.add(new Button(s, W / 2, Y0 + WH - 58, 260, 68, STR.close, () => this.close(), { fontSize: 24, color: COL.card, border: COL.border }));
  }

  // id do jogador, apelido, texto da posição no ranking aberto e os selos dele
  show(id, nick, posText, badges = []) {
    this.open();
    this.ensureArt(() => { this.build(); this.fill(id, nick, posText, badges); });
  }

  async fill(id, nick, posText, badges) {
    this.data = null;
    this.name.setText(nick || '').setX(W / 2);
    fit(this.name, WW - 220 - badges.length * 70);
    const bw = this.badges.set(badges, 0, 0);
    this.name.setX(W / 2 - (bw ? (bw + 12) / 2 : 0));
    this.badges.set(badges, this.name.x + this.name.displayWidth / 2 + 12, PLATE_Y);
    this.sub.setText(posText || '');
    this.statBoxes.forEach((b) => { b.l.setText(''); b.v.setText(''); });
    this.showTeam();
    this.msg.setText(STR.rankLoading).setVisible(true);
    this.team.forEach((t) => t.parts.forEach((o) => o.setVisible(false)));
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
      this.statBoxes.forEach((b, i) => { b.l.setText(vals[i][0]); fit(b.v.setText(vals[i][1]), 180); });
      this.msg.setVisible(false);
      this.showTeam();
    } catch (e) {
      this.msg.setText(STR.rankError).setVisible(true);
    }
  }

  heroes() { return this.data?.showcase?.heroes || []; }

  showTeam() {
    this.heroParts.forEach((o) => o.setVisible(false));
    this.sectionTitle.setVisible(true).setText(STR.profTeam);
    const hs = this.heroes();
    this.team.forEach((t, i) => {
      const h = hs[i];
      t.parts.forEach((o) => o.setVisible(!!h));
      if (!h) return;
      t.glow.setFillStyle(RARITY_COLORS[h.q] ?? 0xffffff, 0.32);
      setHeroPortrait(t.por, { role: h.r, rarity: h.q, palette: h.pa });
      fit(t.nm.setText(h.n).setColor(RARITY_TEXT[h.q] || TXT.main), CARD_W - 44);
      fit(t.ln.setText(STR.profHeroLine(h.l, fmtShort(h.pw))), CARD_W - 24);
    });
    if (this.data && !hs.length) this.msg.setText(STR.profNoTeam).setVisible(true);
  }

  showHero(i) {
    const h = this.heroes()[i];
    if (!h) return;
    this.hero = h;
    this.sectionTitle.setVisible(false);
    this.team.forEach((t) => t.parts.forEach((o) => o.setVisible(false)));
    this.heroParts.forEach((o) => o.setVisible(true));
    setHeroPortrait(this.bigPor, { role: h.r, rarity: h.q, palette: h.pa });
    fit(this.hName.setText(h.n).setColor(RARITY_TEXT[h.q] || TXT.gold), WW - 280);
    this.hRole.setText(`${RARITY_NAMES[h.q] || ''} · ${ROLES[h.r]?.name || ''}`).setColor(RARITY_TEXT[h.q] || TXT.main);
    this.hLvl.setText(STR.profLevel(h.l, h.aw));
    this.hPow.setText(STR.profPower(fmtShort(h.pw)));
    this.slots.forEach((sl) => {
      const g = h.g?.[sl.g.key];
      const key = g ? itemIcon(showcaseItem(g)) : `item_${sl.g.type}_empty`;
      if (this.scene.textures.exists(key)) sl.ic.setTexture(key).setDisplaySize(84, 84);
      sl.ic.setAlpha(g ? 1 : 0.3);
      // brilho da cor da raridade atrás do item
      sl.tint.setFillStyle(g ? (RARITY_COLORS[g.q] ?? 0xffffff) : 0xffffff, g ? 0.38 : 0);
      sl.pl.setText(g && g.p ? `+${g.p}` : '');
    });
    const first = GEAR_SLOTS.find((g) => h.g?.[g.key]);
    this.showItem(first ? first.key : null);
  }

  showItem(key) {
    const g = key && this.hero?.g?.[key];
    this.slots.forEach((sl) => sl.b.setTint(sl.g.key === key && g ? 0xfff0b0 : 0xffffff));
    if (!g) {
      this.iTitle.setText(STR.profNoItem).setColor('#d8c8f0');
      this.iSub.setText('');
      this.iLines.forEach((t) => t.setText(''));
      return;
    }
    const it = showcaseItem(g);
    fit(this.iTitle.setText(itemTitle(it)).setColor(RARITY_TEXT[it.rarity] || TXT.main), WW - 260);
    const set = it.set && SETS[it.set] ? ` · ${STR.profSet(SETS[it.set].name)}` : '';
    fit(this.iSub.setText(itemSubtitle(it) + set), WW - 260);
    const lines = itemStatLines(it);
    this.iLines.forEach((t, k) => {
      const l = lines[k];
      fit(t.setText(l ? l.text : '').setColor(l?.main ? TXT.gold : TXT.main), 220);
    });
  }
}
