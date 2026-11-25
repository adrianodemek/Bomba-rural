// Ranking do beta (☰ Mais → Ranking): os 20 melhores por fases vencidas (todas as dificuldades) e, no empate,
// pelo poder da equipe. Mostra também a sua posição. Os dados vêm da tabela "profiles" do Supabase.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card } from './widgets.js';
import { fmt, fmtShort } from './format.js';
import { Cloud, sb } from '../systems/Cloud.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { economy } from '../systems/Economy.js';
import { GUEST_KEY } from './AuthGate.js';

const W = BALANCE.screen.width;
const TOP = 104, ROW = 50, N = 20;
const MEDAL = [0xffd24a, 0xd8dde8, 0xe0904a];

export class RankingPanel extends Panel {
  constructor(scene, { onClose }) {
    super(scene, STR.rankTitle, onClose);
    const s = scene;
    this.head = txt(s, 24, TOP, STR.rankHead, 18, TXT.dim);
    this.cols = [
      txt(s, W - 250, TOP, STR.rankStages, 16, TXT.dim).setOrigin(0.5, 0),
      txt(s, W - 96, TOP, STR.rankPower, 16, TXT.dim).setOrigin(0.5, 0),
    ];
    this.add([this.head, ...this.cols]);
    this.rows = [];
    for (let i = 0; i < N; i++) {
      const y = TOP + 34 + i * ROW;
      const bg = s.add.rectangle(20, y, W - 40, ROW - 6, i % 2 ? 0x1e1232 : 0x241640, 0.9).setOrigin(0);
      const pos = txt(s, 58, y + (ROW - 6) / 2, '', 22, TXT.main, true).setOrigin(0.5);
      const medal = s.add.circle(58, y + (ROW - 6) / 2, 19, 0xffd24a).setStrokeStyle(3, 0x5a3408).setVisible(false);
      const name = txt(s, 96, y + (ROW - 6) / 2, '', 22, TXT.main, true).setOrigin(0, 0.5);
      const st = txt(s, W - 250, y + (ROW - 6) / 2, '', 22, TXT.main).setOrigin(0.5);
      const pw = txt(s, W - 96, y + (ROW - 6) / 2, '', 22, TXT.gold).setOrigin(0.5);
      this.add([bg, medal, pos, name, st, pw]);
      this.rows.push({ bg, pos, medal, name, st, pw });
    }
    const fy = TOP + 34 + N * ROW + 10;
    this.meBg = card(s, 20, fy, W - 40, 70, COL.gold, 0x3a1f66);
    this.me = txt(s, W / 2, fy + 35, '', 22, TXT.main, true).setOrigin(0.5);
    this.msg = txt(s, W / 2, TOP + 300, '', 24, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 100);
    this.loginBtn = new Button(s, W / 2, TOP + 420, W - 160, 84, STR.accountLogin, () => {
      SaveSystem.save(economy);
      try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* ok */ }
      window.location.reload();
    }, { fontSize: 24, color: COL.card, border: COL.border });
    this.add([this.meBg, this.me, this.msg, this.loginBtn]);
    this.onOpen = () => this.load();
  }

  show(rowsVisible) {
    this.rows.forEach((r, i) => [r.bg, r.pos, r.name, r.st, r.pw].forEach((o) => o.setVisible(rowsVisible && i < (this.count || 0))));
    this.rows.forEach((r, i) => r.medal.setVisible(rowsVisible && i < (this.count || 0) && i < 3));
    [this.head, ...this.cols, this.meBg, this.me].forEach((o) => o.setVisible(rowsVisible));
  }

  async load() {
    this.loginBtn.setVisible(false);
    if (!Cloud.online) {
      this.count = 0; this.show(false);
      this.msg.setText(STR.rankGuest).setVisible(true);
      this.loginBtn.setVisible(true);
      return;
    }
    this.count = 0; this.show(false);
    this.msg.setText(STR.rankLoading).setVisible(true);
    SaveSystem.save(economy);
    try { await Cloud.flush(); } catch (e) { /* ok */ }
    try {
      const c = sb();
      const { data, error } = await c.from('profiles').select('id, nickname, stages_cleared, best_power')
        .order('stages_cleared', { ascending: false }).order('best_power', { ascending: false }).limit(N);
      if (error) throw error;
      const meId = Cloud.user?.id;
      const me = data.find((p) => p.id === meId) || Cloud.profile;
      // posição: quantos estão na frente (mais fases, ou empate com mais poder)
      let pos = data.findIndex((p) => p.id === meId) + 1;
      if (!pos && me) {
        const a = await c.from('profiles').select('id', { count: 'exact', head: true }).gt('stages_cleared', me.stages_cleared);
        const b = await c.from('profiles').select('id', { count: 'exact', head: true })
          .eq('stages_cleared', me.stages_cleared).gt('best_power', me.best_power);
        pos = (a.count || 0) + (b.count || 0) + 1;
      }
      this.count = data.length;
      data.forEach((p, i) => {
        const r = this.rows[i];
        const mine = p.id === meId;
        r.bg.setFillStyle(mine ? 0x5a2e8a : i % 2 ? 0x1e1232 : 0x241640, 0.95);
        r.pos.setText(String(i + 1)).setColor(i < 3 ? '#3a1a04' : TXT.main);
        if (i < 3) r.medal.setFillStyle(MEDAL[i]);
        fit(r.name.setText(p.nickname), W - 470).setColor(mine ? TXT.gold : TXT.main);
        r.st.setText(fmt(p.stages_cleared));
        r.pw.setText(fmtShort(p.best_power));
      });
      this.msg.setVisible(false);
      this.show(true);
      fit(this.me.setText(me ? STR.rankMe(pos, me.nickname, me.stages_cleared) : ''), W - 80);
      if (!data.length) { this.msg.setText(STR.rankEmpty).setVisible(true); }
    } catch (e) {
      this.msg.setText(STR.rankError).setVisible(true);
    }
  }
}
