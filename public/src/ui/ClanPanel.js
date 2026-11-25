// Clã com Colosso cooperativo. PRÉVIA: só ativa com o modo online (BALANCE.clan.enabled).
// Até lá mostra um clã de exemplo (src/data/clanPreview.js) junto com os números reais do jogador
// (melhor dano da semana no Colosso, tentativas do dia) e todos os botões só avisam que o Clã vem com o online.
import { BALANCE } from '../config/balance.js';
import { COL, TXT, TITLE_FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { COLOSSI } from '../data/worlds.js';
import { CLAN_PREVIEW } from '../data/clanPreview.js';
import { economy } from '../systems/Economy.js';
import { statsOf } from '../systems/Roster.js';
import { teamPower } from '../systems/Difficulty.js';
import { setHeroPortrait } from '../art/hd.js';
import { Sfx } from '../systems/Sfx.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card, ProgressBar, Modal } from './widgets.js';
import { frame } from './skin.js';
import { fmt } from './format.js';
import { drawEmblem } from './clanEmblem.js';
import { ClanSearch } from './ClanSearch.js';
import { ClanCreate } from './ClanCreate.js';

const W = BALANCE.screen.width;
const VIEW_Y = 392;

// Escudo do clã (emblema): borda dourada, campo em duas cores e estrela.
const SHIELD = [[0, -46], [38, -35], [37, 4], [31, 22], [19, 36], [0, 45], [-19, 36], [-31, 22], [-37, 4], [-38, -35]];
export function drawShield(scene, x, y, size, colors = [0x3a8ad8, 0x16407a], star = true) {
  const g = scene.add.graphics({ x, y });
  const k = size / 92;
  const pts = (list, s) => list.map(([a, b]) => new Phaser.Math.Vector2(a * k * s, b * k * s));
  g.fillStyle(0x5a3408).fillPoints(pts(SHIELD, 1.1), true);
  g.fillStyle(0xc8962a).fillPoints(pts(SHIELD, 1), true);
  g.fillStyle(colors[0]).fillPoints(pts(SHIELD, 0.82), true);
  g.fillStyle(colors[1], 0.6).fillPoints(pts(SHIELD.slice(0, 6), 0.82), true);
  if (star) {
    const st = [];
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 8 : 19) * k;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      st.push(new Phaser.Math.Vector2(Math.cos(a) * r, 2 * k + Math.sin(a) * r));
    }
    g.fillStyle(0xffe27a).fillPoints(st, true);
    g.lineStyle(Math.max(1, 2 * k), 0x8a5a10).strokePoints(st, true);
  }
  return g;
}

// Tempo até a segunda-feira (a semana do Colosso vira junto).
function weekLeft() {
  const tz = new Date().getTimezoneOffset() * 60000;
  const next = ((economy.weekIndex() + 1) * 7 - 3) * 86400000 + tz;
  const ms = Math.max(0, next - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

export class ClanPanel extends Panel {
  constructor(scene, { onClose }) {
    // Fechar: na criação volta para a procura; nas outras páginas fecha o painel.
    super(scene, STR.clanTitle, () => (this.page === 'create' ? this.setPage('search') : onClose()));
    const s = scene;
    this.view = 'colossus';
    this.soon = () => { Sfx.play('click'); s.toast.show(STR.clanSoon, 2200); };
    // Páginas: 'search' (sem clã: procurar/convites) · 'create' (criar clã) · 'clan' (dentro do clã).
    // Na prévia o jogador ainda não tem clã: abre na procura; "Aceitar" o convite mostra a tela de dentro do clã.
    this.pc = s.add.container(0, 0);
    this.add(this.pc);
    this.search = new ClanSearch(s, {
      soon: this.soon,
      onAccept: () => { this.setPage('clan'); s.toast.show(STR.clanPreviewInside, 2400); },
      onCreate: () => this.setPage('create'),
    });
    this.create = new ClanCreate(s, { soon: this.soon });
    this.add([this.search, this.create]);
    this.page = 'search';
    this.leaveModal = new ClanLeaveModal(s, () => { this.setPage('search'); s.toast.show(STR.clanLeftPreview, 2400); });
    this.buildHeader(s);
    const ids = ['colossus', 'members', 'ranking', 'requests'];
    this.tabBtns = ids.map((id, i) => {
      const b = new Button(s, 105 + i * 170, 352, 162, 56, STR.clanTabs[i], () => { this.view = id; this.refresh(); }, {
        fontSize: 21, color: COL.card, border: COL.border,
      });
      b.viewId = id;
      this.pc.add(b);
      return b;
    });
    this.views = Object.fromEntries(ids.map((id) => [id, s.add.container(0, 0)]));
    this.pc.add(Object.values(this.views));
    this.buildColossus(s);
    this.buildMembers(s);
    this.buildRanking(s);
    this.buildRequests(s);
    this.onOpen = () => this.refresh();
  }

  avatar(s, x, y, hero, scale = 2.4) {
    const img = s.add.sprite(x, y, 'hero0_down_0').setScale(scale);
    img.heroData = hero;
    return img;
  }

  // ---------- Cabeçalho: emblema, nome, liga e bônus ----------
  buildHeader(s) {
    const C = CLAN_PREVIEW;
    const y = 92;
    this.pc.add(card(s, 20, y, W - 40, 160));
    this.pc.add(drawEmblem(s, 76, y + 76, 96, C.emblem));
    this.pc.add(txt(s, 136, y + 34, C.name, 28, TXT.main, true).setOrigin(0, 0.5));
    this.pc.add(txt(s, 136, y + 70, STR.clanInfo(C.level, C.memberCount, BALANCE.clan.maxMembers, C.members[0].name), 17, TXT.dim).setOrigin(0, 0.5));
    const chip = (x, label, fill, border, color) => {
      const t = txt(s, x + 12, y + 114, label, 16, color, true).setOrigin(0, 0.5);
      const bg = s.add.rectangle(x, y + 114, t.width + 24, 34, fill).setOrigin(0, 0.5).setStrokeStyle(2, border);
      this.pc.add([bg, t]);
      return x + t.width + 34;
    };
    const nx = chip(136, STR.clanLeague(C.league, C.leaguePos, C.leagueSize), 0x3a2a08, 0xe8b84a, TXT.gold);
    chip(nx, STR.clanBonus(C.goldBonusPct), 0x0e2a3a, 0x4ab0e0, '#9fe8ff');
    // Aviso: tudo aqui é prévia até o modo online.
    this.pc.add(card(s, 20, 262, W - 40, 50, COL.gold, 0x2a1a08));
    this.pc.add(txt(s, W / 2, 287, STR.clanNotice, 16, TXT.gold).setOrigin(0.5).setWordWrapWidth(W - 80).setAlign('center'));
  }

  // ---------- Colosso do clã ----------
  buildColossus(s) {
    const v = this.views.colossus;
    const y = VIEW_Y;
    v.add(card(s, 20, y, W - 40, 360, COL.gold));
    // Quadro do Colosso da semana
    v.add(s.add.rectangle(36, y + 14, 200, 200, 0x120a1e).setOrigin(0).setStrokeStyle(2, 0x5a3408));
    const glow = s.add.circle(136, y + 130, 80, 0xff5a28, 0.22);
    v.add(glow);
    s.tweens.add({ targets: glow, alpha: 0.08, scale: 1.15, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.boss = s.add.image(136, y + 118, 'boss_w0');
    this.boss.setScale(160 / this.boss.width);   // 160 px no quadro (chefe em pixel 16 px ou pintado 20)
    v.add(this.boss);
    this.cName = txt(s, 254, y + 30, '', 26, '#ffb070').setOrigin(0, 0.5);
    this.cName.setFontFamily(TITLE_FONT).setStroke('#3a1404', 5);
    this.cTip = txt(s, 254, y + 70, '', 15, TXT.dim).setOrigin(0, 0.5).setWordWrapWidth(410);
    v.add([this.cName, this.cTip]);
    v.add(txt(s, 254, y + 110, STR.clanWeekDamage, 16, TXT.dim).setOrigin(0, 0.5));
    this.cDmg = txt(s, 254, y + 144, '', 32, TXT.gold, true).setOrigin(0, 0.5);
    v.add(this.cDmg);
    this.cEnds = txt(s, 254, y + 192, '', 16, TXT.main, true).setOrigin(0, 0.5);
    this.cAtt = txt(s, 0, y + 192, '', 16, TXT.main, true).setOrigin(0, 0.5);
    this.cEndsBg = s.add.rectangle(244, y + 192, 10, 34, COL.slot).setOrigin(0, 0.5).setStrokeStyle(2, 0x7a5418);
    this.cAttBg = s.add.rectangle(0, y + 192, 10, 34, COL.slot).setOrigin(0, 0.5).setStrokeStyle(2, 0x7a5418);
    v.add([this.cEndsBg, this.cAttBg, this.cEnds, this.cAtt]);
    // Trilha de baús: cada marco de dano libera um baú para todos os membros.
    const BX = 60, BW = 600, by = y + 262;
    this.trail = new ProgressBar(s, BX, by, BW, 22, 0xe0703a);
    v.add(this.trail);
    this.chests = BALANCE.clan.milestones.map((m, i) => {
      const x = BX + (BW / (BALANCE.clan.milestones.length - 1)) * i;
      const ring = s.add.circle(x, by, 23, 0x1a0d2c).setStrokeStyle(3, 0x8a6420);
      const icon = s.add.image(x, by, 'ui_chest').setScale(1.3);
      const ok = s.add.circle(x + 17, by + 17, 10, 0x3a9a3a).setStrokeStyle(2, 0x120a1e);
      const okT = txt(s, x + 17, by + 16, '✓', 13, '#ffffff', true).setOrigin(0.5);
      const lbl = txt(s, x, by + 40, fmt(m), 13, TXT.dim).setOrigin(0.5);
      v.add([ring, icon, ok, okT, lbl]);
      ring.setInteractive({ useHandCursor: true }).on('pointerup', this.soon);
      return { ring, icon, ok, okT, lbl, x };
    });
    this.cNext = txt(s, W / 2, y + 334, '', 15, TXT.good).setOrigin(0.5);
    v.add(this.cNext);

    // Sua parte
    const py = y + 372;
    v.add(card(s, 20, py, W - 40, 104));
    v.add(txt(s, 40, py + 22, STR.clanYourBest, 15, TXT.dim).setOrigin(0, 0.5));
    this.myDmg = txt(s, 40, py + 52, '', 26, '#ffb070', true).setOrigin(0, 0.5);
    this.myRank = txt(s, 0, py + 56, '', 16, TXT.dim).setOrigin(0, 0.5);
    v.add([this.myDmg, this.myRank]);
    v.add(txt(s, 40, py + 84, STR.clanTriesToday, 14, TXT.dim).setOrigin(0, 0.5));
    this.myTries = [0, 1, 2].map((i) => s.add.circle(168 + i * 16, py + 84, 6, 0xff8a40).setStrokeStyle(1, 0x3a1a04));
    v.add(this.myTries);
    this.attackBtn = new Button(s, 500, py + 52, 330, 70, STR.clanAttack, this.soon, { fontSize: 23 });
    this.attackSub = txt(s, 500, py + 72, '', 14, TXT.onGold).setOrigin(0.5);
    v.add([this.attackBtn, this.attackSub]);

    // Quem mais causou dano (3 primeiros + você)
    const ty = py + 120;
    v.add(txt(s, 24, ty, STR.clanTopTitle, 19, TXT.gold, true).setOrigin(0, 0.5));
    v.add(txt(s, W - 24, ty, STR.clanTopTries, 14, TXT.dim).setOrigin(1, 0.5));
    this.topRows = [0, 1, 2, 3].map((i) => {
      const ry = ty + 40 + i * 54;
      const bg = s.add.rectangle(20, ry, W - 40, 50, 0xffffff, i % 2 ? 0 : 0.03).setOrigin(0, 0.5);
      const rk = txt(s, 46, ry, '', 19, TXT.dim, true).setOrigin(0.5);
      const av = this.avatar(s, 90, ry, null, 2.2);
      const nm = txt(s, 120, ry - 9, '', 18, TXT.main, true).setOrigin(0, 0.5);
      const role = txt(s, 120, ry + 13, '', 12, TXT.dim).setOrigin(0, 0.5);
      const bar = new ProgressBar(s, 290, ry, 230, 14, 0xe0703a);
      const dv = txt(s, 610, ry, '', 17, '#ffb070', true).setOrigin(1, 0.5);
      const dots = [0, 1, 2].map((k) => s.add.circle(632 + k * 16, ry, 6, 0xff8a40).setStrokeStyle(1, 0x3a1a04));
      v.add([bg, rk, av, nm, role, bar, dv, ...dots]);
      return { bg, rk, av, nm, role, bar, dv, dots };
    });

    // Pedido de ajuda em destaque
    const hy = ty + 40 + 4 * 54 + 4;
    v.add(card(s, 20, hy, W - 40, 84));
    const r = CLAN_PREVIEW.requests[0];
    v.add(this.avatar(s, 60, hy + 42, r.hero, 2.2));
    v.add(txt(s, 96, hy + 26, STR.clanAsked(r.name), 18, TXT.main, true).setOrigin(0, 0.5));
    v.add(txt(s, 96, hy + 56, STR.clanAskWhat(r.hours, CLAN_PREVIEW.helpsToday, BALANCE.clan.helpsPerDay, BALANCE.clan.helpCrystals), 14, TXT.dim).setOrigin(0, 0.5));
    v.add(new Button(s, 594, hy + 42, 196, 54, STR.clanHelp(BALANCE.clan.helpMinutes), this.soon, { fontSize: 17, color: 0x3a9ae0, border: 0x0e3a66 }));
  }

  // Jogador + membros de exemplo, do maior dano para o menor.
  roster() {
    const mine = economy.stats.colossusWeek === economy.weekIndex() ? economy.stats.colossusWeekBest : 0;
    const best = [...economy.heroes].sort((a, b) => statsOf(b).power - statsOf(a).power)[0];
    const tries = Math.min(3, economy.daily.colossusTries || 0);
    const me = { name: STR.clanYou, role: 'member', damage: mine, tries, hero: best, me: true };
    return [...CLAN_PREVIEW.members, me].sort((a, b) => b.damage - a.damage);
  }

  refreshColossus() {
    const col = COLOSSI[economy.colossusVariant()];
    if (this.scene.textures.exists(`boss_w${col.world}`)) { this.boss.setTexture(`boss_w${col.world}`); this.boss.setScale(160 / this.boss.width); }
    this.cName.setText(col.name);
    this.cTip.setText(col.tip);
    const list = this.roster();
    const me = list.find((m) => m.me);
    const total = CLAN_PREVIEW.weekDamage + me.damage;
    const M = BALANCE.clan.milestones;
    this.cDmg.setText(`${fmt(total)} / ${fmt(M[M.length - 1])}`);
    this.cEnds.setText(STR.clanEnds(weekLeft()));
    this.cEndsBg.setSize(this.cEnds.width + 20, 34);
    this.cEnds.setX(254);
    const ax = 254 + this.cEnds.width + 30;
    this.cAttBg.setX(ax - 10);
    this.cAtt.setText(STR.clanAttacked(CLAN_PREVIEW.attackedToday)).setX(ax);
    this.cAttBg.setSize(this.cAtt.width + 20, 34);
    // Trilha: posição proporcional entre os marcos
    const seg = 1 / (M.length - 1);
    let p = 0;
    for (let i = 0; i < M.length; i++) {
      if (total >= M[i]) { p = i * seg; continue; }
      const lo = i ? M[i - 1] : 0;
      p = i ? (i - 1) * seg + ((total - lo) / (M[i] - lo)) * seg : 0;
      break;
    }
    this.trail.setValue(Math.min(1, p));
    const next = M.findIndex((m) => total < m);
    this.chests.forEach((c, i) => {
      const done = total >= M[i];
      c.ring.setStrokeStyle(3, done ? 0x6fd36b : i === next ? 0xffd86a : 0x8a6420).setFillStyle(done ? 0x1e3a22 : 0x1a0d2c);
      c.icon.setAlpha(done || i === next ? 1 : 0.45);
      c.ok.setVisible(done); c.okT.setVisible(done);
      c.lbl.setColor(i === next ? TXT.gold : TXT.dim);
    });
    this.cNext.setText(next < 0 ? STR.clanAllChests : STR.clanNextChest(fmt(M[next] - total), CLAN_PREVIEW.chestReward[next]));
    // Sua parte
    this.myDmg.setText(fmt(me.damage));
    this.myRank.setText(`· ${STR.clanYourRank(list.indexOf(me) + 1)}`).setX(48 + this.myDmg.width);
    const left = Math.max(0, BALANCE.colossus.attemptsPerDay - (economy.daily.colossusTries || 0));
    this.myTries.forEach((d, i) => d.setFillStyle(i < me.tries ? 0xff8a40 : 0x2a1a3a).setStrokeStyle(1, i < me.tries ? 0x3a1a04 : 0x4a3a5a));
    this.attackBtn.label.setY(-12);
    this.attackSub.setText(STR.clanTriesLeft(left, BALANCE.colossus.attemptsPerDay));
    // Top 3 + você
    const myPos = list.indexOf(me);
    const show = myPos < 4 ? list.slice(0, 4) : [...list.slice(0, 3), me];
    const top = list[0].damage || 1;
    this.topRows.forEach((r, i) => {
      const m = show[i];
      const pos = list.indexOf(m) + 1;
      r.rk.setText(String(pos)).setColor(pos === 1 ? '#ffd86a' : pos === 2 ? '#d8e0f0' : pos === 3 ? '#e0985a' : TXT.dim);
      r.bg.setFillStyle(m.me ? 0xffd86a : 0xffffff, m.me ? 0.12 : i % 2 ? 0 : 0.03).setStrokeStyle(m.me ? 2 : 0, 0xc8962a);
      if (m.hero) setHeroPortrait(r.av.setVisible(true), m.hero); else r.av.setVisible(false);
      fit(r.nm.setText(m.name), 165);
      r.role.setText(STR.clanRoles[m.role]);
      r.bar.setValue(m.damage / top);
      r.dv.setText(fmt(m.damage));
      r.dots.forEach((d, k) => d.setFillStyle(k < m.tries ? 0xff8a40 : 0x2a1a3a).setStrokeStyle(1, k < m.tries ? 0x3a1a04 : 0x4a3a5a));
    });
  }

  // ---------- Membros ----------
  buildMembers(s) {
    const v = this.views.members;
    this.memberRows = Array.from({ length: 10 }, (_, i) => {
      const y = VIEW_Y + 30 + i * 70;
      const bg = s.add.rectangle(20, y, W - 40, 64, 0xffffff, i % 2 ? 0 : 0.04).setOrigin(0, 0.5);
      const av = this.avatar(s, 60, y, null, 2.4);
      const nm = txt(s, 100, y - 13, '', 20, TXT.main, true).setOrigin(0, 0.5);
      const role = txt(s, 0, y - 12, '', 13, TXT.gold).setOrigin(0, 0.5);
      const line = txt(s, 100, y + 15, '', 14, TXT.dim).setOrigin(0, 0.5);
      const dv = txt(s, W - 36, y - 8, '', 18, '#ffb070', true).setOrigin(1, 0.5);
      const dl = txt(s, W - 36, y + 15, 'Colosso', 12, TXT.dim).setOrigin(1, 0.5);
      v.add([bg, av, nm, role, line, dv, dl]);
      return { bg, av, nm, role, line, dv };
    });
    const by = VIEW_Y + 30 + 10 * 70 + 30;
    v.add(new Button(s, W / 2 - 170, by, 320, 60, STR.clanInvite, this.soon, { fontSize: 20 }));
    v.add(new Button(s, W / 2 + 170, by, 320, 60, STR.clanLeave, () => this.leaveModal.show(), { fontSize: 20, color: COL.danger, border: COL.dangerBorder }));
  }

  refreshMembers() {
    const list = this.roster();
    this.memberRows.forEach((r, i) => {
      const m = list[i];
      Object.values(r).forEach((o) => o.setVisible?.(!!m));
      if (!m) return;
      r.bg.setFillStyle(m.me ? 0xffd86a : 0xffffff, m.me ? 0.12 : i % 2 ? 0 : 0.04);
      if (m.hero) setHeroPortrait(r.av, m.hero); else r.av.setVisible(false);
      fit(r.nm.setText(m.name), 260);
      r.role.setText(STR.clanRoles[m.role]).setX(108 + r.nm.displayWidth);
      r.line.setText(m.me ? STR.clanMemberLine(economy.heroes.reduce((a, h) => Math.max(a, h.level), 0), fmt(teamPower()), 'online')
        : STR.clanMemberLine(m.level, m.power, m.seen));
      r.line.setColor(m.me || m.seen === 'online' ? TXT.good : TXT.dim);
      r.dv.setText(fmt(m.damage));
    });
  }

  // ---------- Ranking da liga ----------
  buildRanking(s) {
    const v = this.views.ranking;
    this.rankTitle = txt(s, 24, VIEW_Y + 10, '', 18, TXT.gold, true).setOrigin(0, 0.5);
    v.add(this.rankTitle);
    this.rankRows = Array.from({ length: 12 }, (_, i) => {
      const y = VIEW_Y + 56 + i * 60;
      const bg = s.add.rectangle(20, y, W - 40, 56, 0xffffff, i % 2 ? 0 : 0.04).setOrigin(0, 0.5);
      const rk = txt(s, 48, y, '', 20, TXT.dim, true).setOrigin(0.5);
      const sh = s.add.container(100, y);
      const nm = txt(s, 136, y - 10, '', 19, TXT.main, true).setOrigin(0, 0.5);
      const line = txt(s, 136, y + 14, '', 13, TXT.dim).setOrigin(0, 0.5);
      const dv = txt(s, W - 36, y, '', 18, '#ffb070', true).setOrigin(1, 0.5);
      v.add([bg, rk, sh, nm, line, dv]);
      return { bg, rk, sh, nm, line, dv };
    });
    v.add(txt(s, W / 2, VIEW_Y + 56 + 12 * 60, STR.clanRankFoot, 15, TXT.dim).setOrigin(0.5));
  }

  refreshRanking() {
    const C = CLAN_PREVIEW;
    const me = this.roster().find((m) => m.me);
    this.rankTitle.setText(STR.clanRankTitle(C.league, weekLeft()));
    const rows = [...C.ranking.map(([name, n, dmg, emblem]) => ({ name, n, dmg, emblem })),
      { name: C.name, n: C.memberCount, dmg: C.weekDamage + me.damage, emblem: C.emblem, mine: true }]
      .sort((a, b) => b.dmg - a.dmg);
    this.rankRows.forEach((r, i) => {
      const c = rows[i];
      Object.values(r).forEach((o) => o.setVisible(!!c));
      if (!c) return;
      r.rk.setText(String(i + 1)).setColor(i === 0 ? '#ffd86a' : i === 1 ? '#d8e0f0' : i === 2 ? '#e0985a' : TXT.dim);
      r.bg.setFillStyle(c.mine ? 0xffd86a : 0xffffff, c.mine ? 0.12 : i % 2 ? 0 : 0.04);
      r.sh.removeAll(true);
      r.sh.add(drawEmblem(this.scene, 0, 0, 40, c.emblem));
      fit(r.nm.setText(c.name), 300);
      r.line.setText(STR.clanRankLine(c.n));
      r.dv.setText(fmt(c.dmg));
    });
  }

  // ---------- Pedidos de ajuda ----------
  buildRequests(s) {
    const v = this.views.requests;
    const C = CLAN_PREVIEW;
    v.add(txt(s, 24, VIEW_Y + 10, STR.clanHelpsToday(C.helpsToday, BALANCE.clan.helpsPerDay, BALANCE.clan.helpCrystals), 17, TXT.gold, true).setOrigin(0, 0.5));
    C.requests.forEach((r, i) => {
      const y = VIEW_Y + 40 + i * 100;
      v.add(card(s, 20, y, W - 40, 90));
      const av = this.avatar(s, 62, y + 45, r.hero, 2.4);
      av.heroData = r.hero;
      v.add(av);
      v.add(txt(s, 100, y + 28, STR.clanAsked(r.name), 19, TXT.main, true).setOrigin(0, 0.5));
      v.add(txt(s, 100, y + 60, STR.clanAskShort(r.hours, BALANCE.clan.helpCrystals), 14, TXT.dim).setOrigin(0, 0.5));
      v.add(new Button(s, 594, y + 45, 196, 56, STR.clanHelp(BALANCE.clan.helpMinutes), this.soon, { fontSize: 17, color: 0x3a9ae0, border: 0x0e3a66 }));
    });
    const by = VIEW_Y + 40 + C.requests.length * 100 + 50;
    v.add(new Button(s, W / 2, by, W - 120, 66, STR.clanAskHelp, this.soon, { fontSize: 21 }));
  }

  setPage(p) {
    this.page = p;
    this.refresh();
  }

  refresh() {
    const p = this.page;
    this.pc.setVisible(p === 'clan');
    this.search.setVisible(p === 'search');
    this.create.setVisible(p === 'create');
    this.titleText.setText(p === 'create' ? STR.clanCreateTitle : STR.clanTitle);
    this.closeBtn.setLabel(p === 'create' ? STR.clanBack : STR.close);
    if (p === 'search') { this.search.refresh(); return; }
    if (p === 'create') { this.create.refresh(); return; }
    for (const [id, c] of Object.entries(this.views)) c.setVisible(id === this.view);
    this.tabBtns.forEach((b) => {
      const on = b.viewId === this.view;
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
    });
    // Retratos dos pedidos (criados antes de as folhas dos heróis existirem)
    Object.values(this.views).forEach((v) => v.each((o) => { if (o.heroData) setHeroPortrait(o, o.heroData); }));
    if (this.view === 'colossus') this.refreshColossus();
    else if (this.view === 'members') this.refreshMembers();
    else if (this.view === 'ranking') this.refreshRanking();
  }
}

// Confirmação para sair do clã (o que o jogador perde e a espera para entrar em outro).
class ClanLeaveModal extends Modal {
  constructor(scene, onLeave) {
    super(scene, 360);
    const s = scene;
    const C = CLAN_PREVIEW;
    const panel = frame(s, 60, 400, W - 120, 470, COL.panel).setOrigin(0).setStrokeStyle(4, COL.gold);
    panel.setInteractive();
    const title = txt(s, W / 2, 450, STR.clanLeaveTitle, 34, TXT.gold).setOrigin(0.5);
    const emb = drawEmblem(s, W / 2 - 110, 510, 52, C.emblem);
    const name = txt(s, W / 2 - 74, 510, C.name, 24, TXT.main, true).setOrigin(0, 0.5);
    const lines = txt(s, 96, 552, STR.clanLeaveLines(BALANCE.clan.rejoinHours).join('\n'), 17, TXT.dim)
      .setWordWrapWidth(W - 192).setLineSpacing(10);
    const stay = new Button(s, W / 2 - 140, 806, 240, 66, STR.clanStay, () => this.close(), { fontSize: 22 });
    const leave = new Button(s, W / 2 + 140, 806, 240, 66, STR.clanLeaveConfirm, () => { this.close(); onLeave(); }, {
      fontSize: 21, color: COL.danger, border: COL.dangerBorder,
    });
    this.add([panel, title, emb, name, lines, stay, leave]);
    this.backdrop.on('pointerup', () => this.close());
  }

  show() { this.open(); }
}
