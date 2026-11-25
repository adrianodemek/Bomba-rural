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

const W = BALANCE.screen.width;
const ART = ['bg', 'banner', 'podium', 'medal_gold', 'medal_silver', 'medal_bronze', 'crown', 'row', 'row_me', 'footer'];
const KEY = (n) => `rk_${n}`;
const LIST_Y = 668, ROW_H = 52, LIST_N = 9;          // 4º ao 12º
const POD = { y: 432, w: 600 };                       // pódio (topo e largura na tela)
const STEPS = [                                       // lugar, x relativo e topo do degrau (px da arte, de 326)
  { place: 1, fx: 0.5, top: 4, medal: 'medal_gold' },
  { place: 2, fx: 0.18, top: 78, medal: 'medal_silver' },
  { place: 3, fx: 0.81, top: 99, medal: 'medal_bronze' },
];

export class RankingPanel extends Panel {
  constructor(scene, { onClose }) {
    super(scene, STR.rankTitle, onClose);
    this.built = false;
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
    const sub = txt(s, W / 2, 30 + ban.displayHeight + 14, STR.rankHead, 18, '#e8d8ff').setOrigin(0.5).setStroke('#1a0830', 4);
    this.add([ban, title, sub]);

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
      const frontY = POD.y + (st.place === 1 ? 0.5 : 0.63) * pod.displayHeight;
      const name = txt(s, x, frontY - 12, '', 21, '#3a1660', true).setOrigin(0.5);
      const stg = txt(s, x, frontY + 14, '', 16, '#5a3a80').setOrigin(0.5);
      this.add([medal, num, name, stg]);
      if (st.place === 1) {
        const crown = s.add.image(x, medal.y - medal.displayHeight - 8, KEY('crown')).setOrigin(0.5, 1);
        crown.setScale(84 / crown.width);
        this.add(crown);
        s.tweens.add({ targets: crown, y: crown.y - 8, angle: { from: -4, to: 4 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        s.tweens.add({ targets: medal, scale: medal.scale * 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return { medal, num, name, stg, place: st.place };
    });

    // lista do 4º ao 12º (moldura esticada só no meio: as pontas com a joia ficam do tamanho certo)
    const slice = (key, y, w, h, edge) => {
      const t = s.textures.get(key).getSourceImage();
      const kk = h / t.height;
      return s.add.nineslice(W / 2, y, key, null, w / kk, t.height, edge, edge, 0, 0).setScale(kk);
    };
    this.rows = [];
    for (let i = 0; i < LIST_N; i++) {
      const y = LIST_Y + i * ROW_H + ROW_H / 2;
      const fr = slice(KEY('row'), y, 676, ROW_H - 4, 90);
      const frMe = slice(KEY('row_me'), y, 700, (ROW_H - 4) * 197 / 143, 95).setVisible(false);
      const pos = txt(s, 70, y, '', 22, '#ffe9a8', true).setOrigin(0.5).setStroke('#2a0c40', 4);
      const name = txt(s, 104, y, '', 21, TXT.main, true).setOrigin(0, 0.5).setStroke('#2a0c40', 4);
      const st = txt(s, 520, y, '', 18, '#e8d8ff').setOrigin(1, 0.5).setStroke('#2a0c40', 3);
      const pw = txt(s, 650, y, '', 20, TXT.gold, true).setOrigin(1, 0.5).setStroke('#2a0c40', 4);
      this.add([fr, frMe, pos, name, st, pw]);
      this.rows.push({ fr, frMe, pos, name, st, pw });
    }

    // placa da sua posição
    const fy = LIST_Y + LIST_N * ROW_H + 50;
    this.footer = slice(KEY('footer'), fy, 690, 84, 130);
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

  setPodium(list, meId) {
    this.podium.forEach((p) => {
      const d = list[p.place - 1];
      p.medal.setAlpha(d ? 1 : 0.45);
      p.num.setAlpha(d ? 1 : 0.45);
      fit(p.name.setText(d ? d.nickname : '—').setColor(d && d.id === meId ? '#8a2a00' : '#3a1660'), p.place === 1 ? 128 : 140);
      p.stg.setText(d ? STR.rankStagesN(d.stages_cleared) : '');
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
      fit(r.name.setText(d.nickname).setColor(mine ? '#ffe28a' : TXT.main), 300);
      r.st.setText(STR.rankStagesN(d.stages_cleared));
      r.pw.setText(fmtShort(d.best_power));
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
      const { data, error } = await c.from('profiles').select('id, nickname, stages_cleared, best_power')
        .order('stages_cleared', { ascending: false }).order('best_power', { ascending: false }).limit(3 + LIST_N);
      if (error) throw error;
      const meId = Cloud.user?.id;
      const me = data.find((p) => p.id === meId) || Cloud.profile;
      let pos = data.findIndex((p) => p.id === meId) + 1;
      if (!pos && me) {
        const a = await c.from('profiles').select('id', { count: 'exact', head: true }).gt('stages_cleared', me.stages_cleared);
        const b = await c.from('profiles').select('id', { count: 'exact', head: true })
          .eq('stages_cleared', me.stages_cleared).gt('best_power', me.best_power);
        pos = (a.count || 0) + (b.count || 0) + 1;
      }
      this.setPodium(data, meId);
      this.setRows(data, meId);
      fit(this.me.setText(me ? STR.rankMe(pos, me.nickname, me.stages_cleared) : ''), 600);
      if (!data.length) this.msg.setText(STR.rankEmpty).setVisible(true);
    } catch (e) {
      this.me.setText('');
      this.msg.setText(STR.rankError).setVisible(true);
    }
  }
}
