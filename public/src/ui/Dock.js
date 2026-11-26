// Painel da equipe (embaixo do campo): equipes A/B/C, Poder × recomendado, cartões dos heróis e a faixa "Hoje".
// A barra de objetivo (Jornada) fica no topo deste painel, mas é da UIScene.
// Cartões: até 3 vagas = grandes (nível, classe, boneco, nome, Ataque, energia); 4–6 = médios; 7–9 = compactos.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { RARITY_COLORS } from '../data/heroes.js';
import { economy } from '../systems/Economy.js';
import { maxEnergy } from '../systems/Energy.js';
import { statsOf } from '../systems/Roster.js';
import { teamPower, recommendedPower } from '../systems/Difficulty.js';
import { txt, fit, ProgressBar, energyColor } from './widgets.js';
import { setHeroPortrait } from '../art/hd.js';
import { frame, ironBand } from './skin.js';
import { fmt } from './format.js';

const L = BALANCE.layout;
const W = BALANCE.screen.width;
const PAD = 14;
const ROW_Y = L.dockY + 68;         // equipes + Poder
const CARDS_Y = L.dockY + 128;      // cartões
const CARDS_H = 196;
const ACT_Y = L.dockY + 334;        // faixa "Hoje"
const ACT_H = 80;

export class Dock {
  constructor(scene, statusOf, onTap, actions = {}) {
    this.scene = scene;
    this.statusOf = statusOf;
    this.onTap = onTap;
    this.actions = actions;
    this.viewTeam = null;            // equipe mostrada nos cartões (null = a que está em campo)
    this.band = ironBand(scene, 0, L.dockY, W, L.dockH);
    this.layer = scene.add.container(0, 0);
    this.cards = [];
    this.built = -1;
    this.buildTeamRow();
    this.buildToday();
    this.refresh();
  }

  // ---------- Equipes A/B/C e Poder ----------
  buildTeamRow() {
    const s = this.scene;
    this.teamChips = [0, 1, 2].map((t) => {
      const x = PAD + t * 70;
      const bg = frame(s, x, ROW_Y, 62, 48, 0x120a1e).setOrigin(0).setStrokeStyle(3, 0x4a3418);
      const label = txt(s, x + 31, ROW_Y + 24, 'ABC'[t], 24, TXT.main, true).setOrigin(0.5);
      const lock = s.add.image(x + 56, ROW_Y + 4, 'icon_lock').setScale(2.6);
      const field = s.add.circle(x + 8, ROW_Y + 8, 6, 0x6fd36b).setStrokeStyle(2, 0x120a1e);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tapTeam(t));
      return { bg, label, lock, field };
    });
    const px = PAD + 3 * 70 + 6;          // logo depois de A/B/C
    const pw = W - PAD - px;
    this.powerBg = frame(s, px, ROW_Y, pw, 48, 0x120a1e).setOrigin(0).setStrokeStyle(3, 0x7a5418);
    this.powerLabel = txt(s, px + 18, ROW_Y + 24, STR.teamPowerLabel, 17, TXT.dim).setOrigin(0, 0.5);
    this.powerNeed = txt(s, px + pw - 14, ROW_Y + 25, '', 18, TXT.dim, true).setOrigin(1, 0.5);
    this.powerHave = txt(s, px + pw - 14, ROW_Y + 24, '', 24, TXT.good, true).setOrigin(1, 0.5);
    this.powerBg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.actions.onPowerTap?.(this.powerState));
  }

  tapTeam(t) {
    if (!economy.teamUnlocked(t)) { this.actions.onTeamLocked?.(t); return; }
    this.viewTeam = t === economy.activeTeam ? null : t;
    this.refresh();
  }

  shownTeam() {
    const t = this.viewTeam ?? economy.activeTeam;
    return economy.teamUnlocked(t) ? t : economy.activeTeam;
  }

  refreshTeamRow() {
    const shown = this.shownTeam();
    this.teamChips.forEach((c, t) => {
      const open = economy.teamUnlocked(t);
      const onField = t === economy.activeTeam;
      const viewing = t === shown;
      c.lock.setVisible(!open);
      c.field.setVisible(open && onField && economy.mode !== 'idle');
      if (viewing) c.bg.setFillStyle(0xf0b830).setStrokeStyle(3, 0x6a3a06);
      else c.bg.setFillStyle(0x120a1e).setStrokeStyle(3, open ? 0x7a5418 : 0x3a2a18);
      c.label.setColor(viewing ? '#3a1a04' : open ? TXT.main : '#6a5a80');
    });
    // Poder da equipe mostrada × recomendado da fase (só na campanha).
    const have = teamPower(shown);
    if (economy.mode === 'campaign') {
      const need = recommendedPower();
      const state = have >= need ? 'good' : have >= need * BALANCE.power.warn ? 'close' : 'hard';
      this.powerState = state;
      this.powerNeed.setText(`/ ${fmt(need)}`).setVisible(true);
      this.powerHave.setText(fmt(have)).setColor({ good: '#7fe07a', close: '#ffd34d', hard: '#ff6b5a' }[state]);
      this.powerHave.setX(this.powerNeed.x - this.powerNeed.displayWidth - 8);
    } else {
      this.powerState = null;
      this.powerNeed.setVisible(false);
      this.powerHave.setText(fmt(have)).setColor(TXT.gold).setX(this.powerNeed.x);
    }
  }

  // ---------- Faixa "Hoje" ----------
  // Esquerda: missão do dia em andamento (dourada quando o prêmio está pronto). Direita: desafios do dia,
  // trocando sozinho entre Colosso, Abismo e Passe. Só mostra e leva ao lugar: nada é feito por aqui.
  buildToday() {
    const s = this.scene;
    const gap = 10;
    const w = (W - PAD * 2 - gap) / 2;
    this.todayMission = this.todayChip(PAD, w, () => this.actions.onMissionTap?.());
    this.todayChallenge = this.todayChip(PAD + w + gap, w, () => this.actions.onChallengeTap?.(this.challengeKind));
    this.dots = [0, 1, 2].map(() => s.add.circle(0, ACT_Y + 16, 5, 0x5a4678));
    this.page = 0;
    s.time.addEvent({ delay: 4000, loop: true, callback: () => { this.page += 1; this.refreshToday(); } });
  }

  todayChip(x, w, onTap) {
    const s = this.scene;
    const c = { x, w };
    c.glow = s.add.rectangle(x + w / 2, ACT_Y + ACT_H / 2, w + 10, ACT_H + 10, 0xffc850, 0.25).setVisible(false);
    c.bg = frame(s, x, ACT_Y, w, ACT_H, COL.card).setOrigin(0).setStrokeStyle(3, 0x7a5418);
    c.icon = s.add.image(x + 38, ACT_Y + ACT_H / 2, 'icon_trophy').setScale(3.4);
    c.title = txt(s, x + 72, ACT_Y + 17, '', 15, TXT.dim).setOrigin(0, 0.5);
    c.main = txt(s, x + 72, ACT_Y + 40, '', 19, TXT.main, true).setOrigin(0, 0.5);
    c.count = txt(s, x + w - 14, ACT_Y + 40, '', 17, TXT.gold, true).setOrigin(1, 0.5);
    c.bar = new ProgressBar(s, x + 72, ACT_Y + 63, w - 86, 11);
    c.bg.setInteractive({ useHandCursor: true }).on('pointerup', onTap);
    return c;
  }

  setChip(c, { icon, iconFrame, scale = 3.4, title, main, count = '', ratio = 0, ready = false }) {
    if (iconFrame) c.icon.setTexture(icon, iconFrame).setDisplaySize(54, 54);
    else c.icon.setTexture(icon).setScale(scale * 1.2);
    fit(c.title.setText(title).setColor(ready ? TXT.gold : TXT.dim), c.w - 120);
    c.count.setText(count);
    fit(c.main.setText(main).setColor(ready ? TXT.gold : TXT.main), c.w - 86 - (count ? c.count.width + 10 : 0));
    c.bar.setValue(ratio, ready ? 0xffc846 : 0x6fd36b);
    c.bg.setFillStyle(ready ? 0x46290f : COL.card).setStrokeStyle(3, ready ? 0xffd86a : 0x7a5418);
    c.glow.setVisible(ready);
    if (ready && !c.pulse) c.pulse = this.scene.tweens.add({ targets: c.glow, alpha: 0.05, duration: 700, yoyo: true, repeat: -1 });
    else if (!ready && c.pulse) { c.pulse.stop(); c.pulse = null; }
  }

  refreshToday() {
    const t = this.actions.today?.();
    if (!t) return;
    this.setChip(this.todayMission, t.mission);
    const list = t.challenges;
    const cur = list[this.page % list.length];
    this.challengeKind = cur.kind;
    this.setChip(this.todayChallenge, cur);
    // Bolinhas de página (só quando há mais de um desafio para mostrar).
    const c = this.todayChallenge;
    this.dots.forEach((d, k) => {
      d.setVisible(k < list.length && list.length > 1);
      d.setPosition(c.x + c.w - 16 - (list.length - 1 - k) * 13, ACT_Y + 16);
      d.setFillStyle(k === this.page % list.length ? 0xffd86a : 0x5a4678);
    });
  }

  // ---------- Cartões ----------
  build(n) {
    this.layer.removeAll(true);
    this.cards = [];
    this.built = n;
    const s = this.scene;
    const kind = n <= 3 ? 'big' : n <= 6 ? 'mid' : 'small';
    const gap = kind === 'big' ? 10 : 6;
    const cols = n <= 3 ? 3 : n;
    const cw = (W - PAD * 2 - (cols - 1) * gap) / cols;
    for (let i = 0; i < n; i++) {
      const x0 = PAD + i * (cw + gap);
      const y0 = CARDS_Y;
      const ch = CARDS_H;
      const bg = frame(s, x0, y0, cw, ch, COL.card).setOrigin(0).setStrokeStyle(3, COL.border);
      const c = { bg, hero: null, kind };
      // Cartão: nível no alto, herói no centro, Ataque embaixo e a barra de energia.
      // Sem etiqueta de estado: quem foi descansar fica apagado com a casinha na frente até voltar.
      const cx = x0 + cw / 2;
      const big = kind === 'big';
      const mid = kind === 'mid';
      const scale = big ? 4.1 : mid ? 3.8 : Math.min(3.1, (cw - 10) / 16);
      const H = 20 * scale;                        // altura do boneco (pivô a 70% da altura)
      const top = big ? 36 : 36 + Math.max(0, (112 - H) / 2);   // cabeça abaixo do nível (médio/compacto: centrado no espaço)
      const py = y0 + top + 0.7 * H;
      const footY = top + H;
      c.lvBg = frame(s, cx, y0 + 18, big ? 70 : Math.min(60, cw - 10), 26, 0x120a1e).setStrokeStyle(2, 0x7a5418);
      c.lv = txt(s, cx, y0 + 18, '', big ? 15 : 13, TXT.gold, true).setOrigin(0.5);
      c.shadow = s.add.ellipse(cx, y0 + footY - 2, big ? 64 : cw * 0.5, big ? 12 : 10, 0x000000, 0.35);
      c.portrait = s.add.sprite(cx, py, 'hero0_down_0').setScale(scale);
      c.home = s.add.image(cx, y0 + footY - H * 0.3, 'icon_house').setDisplaySize(big ? 62 : mid ? 46 : 38, big ? 62 : mid ? 46 : 38);
      c.parts = [c.shadow, c.portrait, c.home, c.lvBg, c.lv];
      if (big) {
        c.role = s.add.image(x0 + 22, y0 + 20, 'role_attacker').setScale(2.4);
        c.name = txt(s, cx, y0 + 140, '', 16, TXT.main, true).setOrigin(0.5);
        c.parts.push(c.role, c.name);
      }
      c.atk = txt(s, cx, y0 + (big ? 162 : 160), '', big ? 15 : mid ? 14 : 12, '#ffb66b', true).setOrigin(0.5);
      c.bar = new ProgressBar(s, x0 + 10, y0 + 180, cw - 20, big ? 12 : 10);
      c.empty = txt(s, cx, y0 + ch / 2, big ? STR.emptySlot : '–', big ? 18 : 22, TXT.dim).setOrigin(0.5);
      c.parts.push(c.atk, c.bar);
      c.nameW = cw - 16;
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.onTap(this.shownTeam(), i, c.hero));
      this.layer.add([bg, ...c.parts, c.empty]);
      this.cards.push(c);
    }
  }

  refresh() {
    const slots = economy.teamSlots;
    if (slots !== this.built) this.build(slots);
    if (this.viewTeam === economy.activeTeam) this.viewTeam = null;
    const team = this.shownTeam();
    const members = economy.teamMembers(team);
    this.refreshTeamRow();
    this.cards.forEach((c, i) => {
      const h = members[i] || null;
      c.hero = h;
      c.parts.forEach((o) => o.setVisible(!!h));
      c.empty.setVisible(!h);
      if (!h) {
        c.bg.setStrokeStyle(3, COL.border).setAlpha(0.6);
        return;
      }
      c.bg.setStrokeStyle(3, h.rarity > 0 ? RARITY_COLORS[h.rarity] : COL.border).setAlpha(1);
      setHeroPortrait(c.portrait, h);
      const ratio = h.energy / maxEnergy(h);
      c.bar.setValue(ratio, energyColor(ratio));
      // Fora de campo (na Casa / cápsula / esperando energia) na equipe que está jogando: apagado + casinha.
      const away = team === economy.activeTeam && !this.scene.battle.field.has(h.uid) && economy.mode !== 'idle';
      c.portrait.setAlpha(away ? 0.4 : 1);
      c.shadow.setAlpha(away ? 0.15 : 0.35);
      c.home.setVisible(away);
      c.lv.setText(STR.levelShort(h.level));
      c.atk.setText(STR.cardAtk(fmt(statsOf(h).attack)));
      fit(c.atk, c.nameW);
      if (c.kind === 'big') {
        fit(c.name.setText(h.name), c.nameW);
        c.role.setTexture(`role_${h.role}`);
      }
    });
    this.refreshToday();
  }

  // Compatível com quem chamava os botões antigos (ouro e gaiolas mudaram).
  refreshActions() { this.refreshToday(); }
}
