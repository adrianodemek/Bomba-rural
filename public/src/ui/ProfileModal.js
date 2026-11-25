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
// Tudo dentro da área do painel (sem cobrir a barra de cima nem a de baixo) e com margem nas laterais.
const X0 = 36, Y0 = 40, WW = W - 72, WH = 1196;
const IX = X0 + 40, IW = WW - 80;                  // área interna (dentro da borda dourada)
const PLATE_Y = Y0 + 166, SUB_Y = Y0 + 220, STAT_Y = Y0 + 238;
const STAT_W = (IW - 24) / 3, STAT_H = 98;
const GRID_Y = 540, CARD_W = STAT_W, CARD_H = 224;
const SLOT = 106, SLOT_STEP = (IW - SLOT) / 4;
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
    this.add(nine(s, KEY('window'), X0, Y0, WW, WH, 90, 90, 150, 90, 1));
    // placa do nome (a mesma do ranking) e posição
    if (s.textures.exists('rk_footer')) {
      const t = s.textures.get('rk_footer').getSourceImage();
      const k = 92 / t.height;
      this.add(s.add.nineslice(W / 2, PLATE_Y, 'rk_footer', null, (WW - 60) / k, t.height, 130, 130, 0, 0).setScale(k));
    }
    this.name = s.add.text(W / 2, PLATE_Y, '', { fontFamily: TITLE_FONT, fontSize: fs(34), color: '#fff3c4' })
      .setOrigin(0.5).setStroke('#2a0c40', 7);
    this.sub = txt(s, W / 2, SUB_Y, '', 18, '#e8d8ff').setOrigin(0.5).setStroke('#1a0830', 4);
    this.add([this.name, this.sub]);
    this.badges = badgeSlot(s, this, 46);

    // números de todos os rankings (3 × 2)
    this.statBoxes = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = IX + (i % 3) * (STAT_W + 12), y = STAT_Y + Math.floor(i / 3) * (STAT_H + 4);
      // caixa alta o bastante para o rótulo ficar abaixo da joia e o número dentro da moldura
      const b = nine(s, KEY('stat'), x, y, STAT_W, STAT_H, 60, 60, 44, 30, 0.56);
      const l = txt(s, x + STAT_W / 2, y + 47, '', 14, '#e8dcff', true).setOrigin(0.5).setStroke('#1a0830', 3);
      const v = txt(s, x + STAT_W / 2, y + 72, '', 21, TXT.gold, true).setOrigin(0.5).setStroke('#1a0830', 4);
      this.add([b, l, v]);
      return { l, v };
    });
    this.sectionTitle = txt(s, IX, GRID_Y - 26, '', 20, TXT.gold, true).setOrigin(0, 0.5).setStroke('#1a0830', 4);
    this.add(this.sectionTitle);

    // equipe: 6 cartões (retrato no medalhão, nome na faixa)
    this.team = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = IX + (i % 3) * (CARD_W + 12), y = GRID_Y + Math.floor(i / 3) * (CARD_H + 32);
      const b = s.add.image(x, y, KEY('card')).setOrigin(0).setDisplaySize(CARD_W, CARD_H);
      const glow = s.add.circle(x + CARD_W / 2, y + CARD_H * 0.36, 50, 0xffffff, 0.18);
      const por = s.add.sprite(x + CARD_W / 2, y + CARD_H * 0.37, 'hero0_down_0').setScale(3.4);
      // nome dentro da faixa; nível e poder embaixo do cartão (fora da moldura)
      const nm = txt(s, x + CARD_W / 2, y + CARD_H * 0.86, '', 16, TXT.main, true).setOrigin(0.5).setStroke('#1a0830', 5);
      const ln = txt(s, x + CARD_W / 2, y + CARD_H + 14, '', 14, '#f0e4ff', true).setOrigin(0.5).setStroke('#1a0830', 4);
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.showHero(i));
      this.add([b, glow, por, ln, nm]);
      return { parts: [b, glow, por, ln, nm], b, glow, por, ln, nm };
    });

    // herói escolhido: pedestal, retrato grande, ficha e itens
    this.heroParts = [];
    const hp = (o) => { this.heroParts.push(o); this.add(o); return o; };
    this.backBtn = hp(new Button(s, IX + 80, GRID_Y - 26, 160, 44, STR.profBack, () => this.showTeam(), { fontSize: 18, color: COL.card, border: COL.border }));
    // pedestal e herói à esquerda; os itens começam abaixo da base do pedestal
    const pcx = IX + 104, feet = GRID_Y + 150;
    const ped = hp(s.add.image(pcx, feet, KEY('pedestal')).setOrigin(0.5, 0.5));
    ped.setScale(208 / ped.width);
    this.bigPor = hp(s.add.sprite(pcx, feet - 76, 'hero0_down_0').setScale(5.8));
    const tx = IX + 226;
    this.tx0 = tx;
    this.hName = hp(txt(s, tx, GRID_Y + 40, '', 26, TXT.gold, true).setOrigin(0, 0.5).setStroke('#1a0830', 5));
    this.hRole = hp(txt(s, tx, GRID_Y + 76, '', 18, TXT.main, true).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.hLvl = hp(txt(s, tx, GRID_Y + 106, '', 18, TXT.main).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.hPow = hp(txt(s, tx, GRID_Y + 138, '', 21, TXT.gold, true).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.slots = GEAR_SLOTS.map((g, i) => {
      const x = IX + (i % 5) * SLOT_STEP, y = GRID_Y + 232 + Math.floor(i / 5) * (SLOT + 8);
      const b = hp(s.add.image(x, y, KEY('slot')).setOrigin(0).setDisplaySize(SLOT, SLOT));
      const tint = hp(s.add.circle(x + SLOT / 2, y + SLOT / 2, SLOT * 0.33, 0xffffff, 0));
      const ic = hp(s.add.image(x + SLOT / 2, y + SLOT / 2, `item_${g.type}_empty`).setDisplaySize(SLOT * 0.68, SLOT * 0.68));
      const pl = hp(txt(s, x + SLOT - 16, y + SLOT - 20, '', 15, '#ffe28a', true).setOrigin(1, 0.5).setStroke('#12081c', 4));
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.showItem(g.key));
      return { g, b, tint, ic, pl };
    });
    // caixa do item: texto só no miolo, entre os louros
    const iy = GRID_Y + 232 + 2 * (SLOT + 8) + 6, IH = 134;
    hp(nine(s, KEY('desc'), IX - 12, iy, IW + 24, IH, 150, 150, 40, 40, IH / 172));
    const tl = IX + 92;
    this.textW = IW - 184;
    this.iTitle = hp(txt(s, tl, iy + 30, '', 19, TXT.main, true).setOrigin(0, 0.5).setStroke('#1a0830', 4));
    this.iSub = hp(txt(s, tl, iy + 53, '', 14, '#d8c8f0').setOrigin(0, 0.5));
    this.iLines = [0, 1, 2, 3, 4, 5].map((k) => hp(txt(s, tl + (k % 2) * (this.textW / 2 + 6), iy + 77 + Math.floor(k / 2) * 21, '', 14, TXT.main).setOrigin(0, 0.5)));

    this.msg = txt(s, W / 2, GRID_Y + 200, '', 22, '#d8c8f0').setOrigin(0.5).setAlign('center').setWordWrapWidth(IW - 40);
    this.add(this.msg);
    // Fechar na borda de baixo, entre as joias dos cantos
    this.add(new Button(s, W / 2, Y0 + WH - 44, 240, 62, STR.close, () => this.close(), { fontSize: 23, color: COL.card, border: COL.border }));
  }

  // id do jogador, apelido, texto da posição no ranking aberto e os selos dele
  show(id, nick, posText, badges = []) {
    this.open();
    this.ensureArt(() => { this.build(); this.fill(id, nick, posText, badges); });
  }

  async fill(id, nick, posText, badges) {
    this.data = null;
    this.name.setText(nick || '').setX(W / 2);
    fit(this.name, WW - 240 - badges.length * 100);
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
      this.statBoxes.forEach((b, i) => { fit(b.l.setText(vals[i][0]), STAT_W - 50); fit(b.v.setText(vals[i][1]), STAT_W - 46); });
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
      fit(t.nm.setText(h.n).setColor(RARITY_TEXT[h.q] || TXT.main), CARD_W * 0.66);
      fit(t.ln.setText(STR.profHeroLine(h.l, fmtShort(h.pw))), CARD_W - 6);
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
    fit(this.hName.setText(h.n).setColor(RARITY_TEXT[h.q] || TXT.gold), IX + IW - this.tx0);
    fit(this.hRole.setText(`${RARITY_NAMES[h.q] || ''} · ${ROLES[h.r]?.name || ''}`).setColor(RARITY_TEXT[h.q] || TXT.main), IX + IW - this.tx0);
    this.hLvl.setText(STR.profLevel(h.l, h.aw));
    this.hPow.setText(STR.profPower(fmtShort(h.pw)));
    this.slots.forEach((sl) => {
      const g = h.g?.[sl.g.key];
      const key = g ? itemIcon(showcaseItem(g)) : `item_${sl.g.type}_empty`;
      if (this.scene.textures.exists(key)) sl.ic.setTexture(key).setDisplaySize(SLOT * 0.68, SLOT * 0.68);
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
    fit(this.iTitle.setText(itemTitle(it)).setColor(RARITY_TEXT[it.rarity] || TXT.main), this.textW);
    const set = it.set && SETS[it.set] ? ` · ${STR.profSet(SETS[it.set].name)}` : '';
    fit(this.iSub.setText(itemSubtitle(it) + set), this.textW);
    const lines = itemStatLines(it);
    this.iLines.forEach((t, k) => {
      const l = lines[k];
      fit(t.setText(l ? l.text : '').setColor(l?.main ? TXT.gold : TXT.main), this.textW / 2 - 6);
    });
  }
}
