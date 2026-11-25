// Ranking do beta (☰ Mais → Ranking), com a arte pintada do Salão dos Campeões (assets/ui/ranking/):
// faixa de título, pódio com medalhas para os 3 primeiros (coroa flutuando no 1º), lista do 4º ao 12º em molduras
// e a placa com a sua posição. Ordem: fases diferentes vencidas; no empate, poder da equipe (tabela "profiles").
import { BALANCE } from '../config/balance.js';
import { COL, TXT, TITLE_FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit } from './widgets.js';
import { fmtShort } from './format.js';
import { Cloud, sb } from '../systems/Cloud.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { economy } from '../systems/Economy.js';
import { GUEST_KEY } from './AuthGate.js';
import { ProfileModal, fmtDur } from './ProfileModal.js';

const W = BALANCE.screen.width;
const ART = ['bg', 'banner', 'podium', 'medal_gold', 'medal_silver', 'medal_bronze', 'crown', 'row', 'row_me', 'footer'];
const KEY = (n) => `rk_${n}`;
const LIST_Y = 688, ROW_H = 50, LIST_N = 9;          // 4º ao 12º
const POD = { y: 452, w: 600 };                       // pódio (topo e largura na tela)
// Rankings: coluna da tabela profiles e como mostrar o número. No empate, fases e depois poder.
const BOARDS = [
  { id: 'stages', col: 'stages_cleared', show: (n) => STR.rankStagesN(n) },
  { id: 'power', col: 'best_power', show: (n) => fmtShort(n) },
  { id: 'abyss', col: 'abyss_best', show: (n) => STR.rankAbyssN(n) },
  { id: 'level', col: 'max_hero_level', show: (n) => STR.rankLevelN(n) },
  { id: 'colossus', col: 'colossus_week_dmg', week: true, show: (n) => fmtShort(n) },
  { id: 'time', col: 'play_seconds', show: (n) => fmtDur(n) },
];
const STEPS = [                                       // lugar, x relativo e topo do degrau (px da arte, de 326)
  { place: 1, fx: 0.5, top: 4, medal: 'medal_gold' },
  { place: 2, fx: 0.18, top: 78, medal: 'medal_silver' },
  { place: 3, fx: 0.81, top: 99, medal: 'medal_bronze' },
];

export class RankingPanel extends Panel {
  constructor(scene, { onClose }) {
    super(scene, STR.rankTitle, onClose);
    this.built = false;
    this.board = BOARDS[0];
    this.profile = new ProfileModal(scene);
    this.onOpen = () => this.ensureArt(() => { this.build(); this.load(); });
  }

  // A arte da tela só é baixada na primeira vez que o ranking abre.
  ensureArt(cb) {
    const s = this.scene;
    const missing = ART.filter((n) => !s.textures.exists(KEY(n)));
    if (!missing.length) { cb(); return; }
    missing.forEach((n) => s.load.image(KEY(n), `assets/ui/ranking/${n}.${n === 'bg' ? 'jpg' : 'png'}`));
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
    // fundo do salão por baixo de tudo (logo acima da moldura do painel)
    const bg = s.add.image(W / 2, 0, KEY('bg')).setOrigin(0.5, 0);
    bg.setScale(W / bg.width);
    this.addAt(bg, 1);
    this.titleText.setVisible(false);

    // faixa de título
    const ban = s.add.image(W / 2, 30, KEY('banner')).setOrigin(0.5, 0);
    ban.setScale(520 / ban.width);
    const banMid = 30 + ban.displayHeight * 0.6;
    const title = s.add.text(W / 2, banMid, STR.rankTitle, { fontFamily: TITLE_FONT, fontSize: fs(40), color: '#fff3c4' })
      .setOrigin(0.5).setStroke('#3a1060', 7).setShadow(0, 3, 'rgba(0,0,0,0.45)', 4, true, true);
    this.add([ban, title]);
    const slice = (key, x, y, w, h, edge) => {
      const t = s.textures.get(key).getSourceImage();
      const kk = h / t.height;
      return s.add.nineslice(x, y, key, null, w / kk, t.height, edge, edge, 0, 0).setScale(kk);
    };
    this.slice = slice;

    // filtros: um botão por ranking
    this.chips = BOARDS.map((b, i) => {
      const x = 21 + 55 + i * 113, y = 30 + ban.displayHeight + 32;
      const off = slice(KEY('row'), x, y, 110, 50, 60);
      const on = slice(KEY('row_me'), x, y, 116, 50 * 197 / 143, 64).setVisible(false);
      const label = txt(s, x, y, STR.rankBoards[b.id], 17, '#e8d8ff', true).setOrigin(0.5).setStroke('#1a0830', 4);
      fit(label, 96);
      off.setInteractive({ useHandCursor: true });
      off.on('pointerup', () => { if (this.board !== b) { this.board = b; this.paintChips(); this.load(); } });
      this.add([off, on, label]);
      return { b, off, on, label };
    });
    this.paintChips();

    // pódio, medalhas, coroa e nomes
    const pod = s.add.image(W / 2, POD.y, KEY('podium')).setOrigin(0.5, 0);
    const k = POD.w / pod.width;
    pod.setScale(k);
    this.add(pod);
    this.podium = STEPS.map((st) => {
      const x = W / 2 - POD.w / 2 + POD.w * st.fx;
      const topY = POD.y + st.top * k;
      const medal = s.add.image(x, topY - 4, KEY(st.medal)).setOrigin(0.5, 1);
      medal.setScale(98 / medal.width);
      const discY = medal.y - medal.displayHeight * 0.6;
      const num = s.add.text(x, discY, String(st.place), { fontFamily: TITLE_FONT, fontSize: fs(38), color: '#3a1a04' })
        .setOrigin(0.5).setStroke('#fff2c0', 4);
      // placa escura na frente do degrau: nome e número bem legíveis
      const frontY = POD.y + (st.place === 1 ? 0.52 : 0.64) * pod.displayHeight;
      const plate = slice(KEY('row'), x, frontY, st.place === 1 ? 176 : 168, 70, 70);
      const name = txt(s, x, frontY - 11, '', 20, '#ffffff', true).setOrigin(0.5).setStroke('#1a0830', 5);
      const stg = txt(s, x, frontY + 15, '', 15, '#ffd86a', true).setOrigin(0.5).setStroke('#1a0830', 4);
      plate.setInteractive({ useHandCursor: true });
      plate.on('pointerup', () => this.openProfile(st.place - 1));
      this.add([medal, num, plate, name, stg]);
      if (st.place === 1) {
        const crown = s.add.image(x, medal.y - medal.displayHeight - 8, KEY('crown')).setOrigin(0.5, 1);
        crown.setScale(84 / crown.width);
        this.add(crown);
        s.tweens.add({ targets: crown, y: crown.y - 8, angle: { from: -4, to: 4 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        s.tweens.add({ targets: medal, scale: medal.scale * 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return { medal, num, plate, name, stg, place: st.place };
    });

    // lista do 4º ao 12º (moldura esticada só no meio: as pontas com a joia ficam do tamanho certo)
    this.rows = [];
    for (let i = 0; i < LIST_N; i++) {
      const y = LIST_Y + i * ROW_H + ROW_H / 2;
      const fr = slice(KEY('row'), W / 2, y, 676, ROW_H - 4, 90);
      const frMe = slice(KEY('row_me'), W / 2, y, 700, (ROW_H - 4) * 197 / 143, 95).setVisible(false);
      const pos = txt(s, 70, y, '', 22, '#ffe9a8', true).setOrigin(0.5).setStroke('#2a0c40', 4);
      const name = txt(s, 104, y, '', 21, TXT.main, true).setOrigin(0, 0.5).setStroke('#2a0c40', 4);
      const st = txt(s, 612, y, '', 20, TXT.gold, true).setOrigin(1, 0.5).setStroke('#2a0c40', 4);
      const pw = txt(s, 640, y, '›', 26, '#e8d8ff', true).setOrigin(0.5).setStroke('#2a0c40', 4);
      [fr, frMe].forEach((f) => { f.setInteractive({ useHandCursor: true }); f.on('pointerup', () => this.openProfile(i + 3)); });
      this.add([fr, frMe, pos, name, st, pw]);
      this.rows.push({ fr, frMe, pos, name, st, pw });
    }

    // placa da sua posição
    const fy = LIST_Y + LIST_N * ROW_H + 46;
    this.footer = slice(KEY('footer'), W / 2, fy, 690, 84, 130);
    this.me = txt(s, W / 2, fy, '', 21, '#fff3c4', true).setOrigin(0.5).setStroke('#2a0c40', 5);
    this.msg = txt(s, W / 2, LIST_Y + 150, '', 24, '#e8d8ff').setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 120)
      .setStroke('#1a0830', 4);
    this.loginBtn = new Button(s, W / 2, LIST_Y + 290, W - 180, 84, STR.accountLogin, () => {
      SaveSystem.save(economy);
      try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* ok */ }
      window.location.reload();
    }, { fontSize: 24, color: COL.card, border: COL.border });
    this.add([this.footer, this.me, this.msg, this.loginBtn]);
  }

  paintChips() {
    this.chips?.forEach((c) => {
      const on = c.b === this.board;
      c.on.setVisible(on); c.off.setVisible(!on);
      c.label.setColor(on ? '#ffe28a' : '#e8d8ff');
    });
  }

  openProfile(i) {
    const d = this.entries?.[i];
    if (!d) return;
    this.profile.show(d.id, d.nickname, STR.profPos(i + 1, STR.rankBoards[this.board.id]));
  }

  setPodium(list, meId) {
    this.podium.forEach((p) => {
      const d = list[p.place - 1];
      p.medal.setAlpha(d ? 1 : 0.45);
      p.num.setAlpha(d ? 1 : 0.45);
      p.plate.setAlpha(d ? 1 : 0.6);
      fit(p.name.setText(d ? d.nickname : '—').setColor(d && d.id === meId ? '#ffe28a' : '#ffffff'), 150);
      fit(p.stg.setText(d ? this.board.show(d[this.board.col]) : ''), 150);
    });
  }

  setRows(list, meId) {
    this.rows.forEach((r, i) => {
      const d = list[i + 3];
      const vis = !!d;
      const mine = vis && d.id === meId;
      r.fr.setVisible(vis && !mine);
      r.frMe.setVisible(mine);
      [r.pos, r.name, r.st, r.pw].forEach((o) => o.setVisible(vis));
      if (!vis) return;
      r.pos.setText(String(i + 4));
      fit(r.name.setText(d.nickname).setColor(mine ? '#ffe28a' : TXT.main), 330);
      fit(r.st.setText(this.board.show(d[this.board.col])), 200);
    });
  }

  async load() {
    this.loginBtn.setVisible(false);
    this.msg.setVisible(false);
    this.setRows([], null);
    if (!Cloud.online) {
      this.setPodium([], null);
      this.footer.setVisible(false); this.me.setVisible(false);
      this.msg.setText(STR.rankGuest).setVisible(true);
      this.loginBtn.setVisible(true);
      return;
    }
    this.footer.setVisible(true); this.me.setVisible(true).setText(STR.rankLoading);
    SaveSystem.save(economy);
    try { await Cloud.flush(); } catch (e) { /* ok */ }
    try {
      const c = sb();
      const B = this.board;
      const wk = economy.weekIndex();
      let q = c.from('profiles').select('id, nickname, stages_cleared, best_power, play_seconds, abyss_best, max_hero_level, colossus_week, colossus_week_dmg');
      if (B.week) q = q.eq('colossus_week', wk).gt(B.col, 0);
      q = q.order(B.col, { ascending: false });
      if (B.col !== 'stages_cleared') q = q.order('stages_cleared', { ascending: false });
      if (B.col !== 'best_power') q = q.order('best_power', { ascending: false });
      const { data, error } = await q.limit(3 + LIST_N);
      if (error) throw error;
      this.entries = data;
      const meId = Cloud.user?.id;
      let me = data.find((p) => p.id === meId);
      if (!me && meId) {
        const r = await c.from('profiles').select('id, nickname, stages_cleared, best_power, play_seconds, abyss_best, max_hero_level, colossus_week, colossus_week_dmg')
          .eq('id', meId).maybeSingle();
        me = r.data;
      }
      const myVal = me ? (B.week && me.colossus_week !== wk ? 0 : me[B.col]) : 0;
      let pos = data.findIndex((p) => p.id === meId) + 1;
      if (!pos && me) {
        let a = c.from('profiles').select('id', { count: 'exact', head: true }).gt(B.col, myVal);
        if (B.week) a = a.eq('colossus_week', wk);
        pos = ((await a).count || 0) + 1;
      }
      this.setPodium(data, meId);
      this.setRows(data, meId);
      fit(this.me.setText(me ? STR.rankMeBoard(pos, me.nickname, B.show(myVal)) : ''), 600);
      if (!data.length) this.msg.setText(STR.rankEmpty).setVisible(true);
    } catch (e) {
      this.me.setText('');
      this.msg.setText(STR.rankError).setVisible(true);
    }
  }
}
