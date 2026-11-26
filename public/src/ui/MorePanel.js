// Aba "Mais" (☰ na barra fixa): grade de atalhos para as outras partes do jogo.
// Novas funções entram aqui (e não na barra nem no campo). "Em breve" = chegam com o modo online.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Sfx } from '../systems/Sfx.js';
import { Panel } from './Panel.js';
import { txt, fit, card } from './widgets.js';
import { drawShield } from './ClanPanel.js';

const W = BALANCE.screen.width;
const COLS = 3, TW = 212, TH = 196, GAP = 12, TOP = 100;

export class MorePanel extends Panel {
  // tiles: [{ id, icon | draw(scene, x, y), label, sub(): string, dot(): bool, onTap(), soon }]
  constructor(scene, { onClose, tiles }) {
    super(scene, STR.moreTitle, onClose);
    const s = scene;
    this.tiles = tiles.map((t, i) => {
      const x = 20 + (i % COLS) * (TW + GAP), y = TOP + Math.floor(i / COLS) * (TH + GAP);
      const bg = card(s, x, y, TW, TH, t.soon ? COL.border : COL.gold, t.soon ? 0x1e1230 : COL.card);
      const cx = x + TW / 2;
      const glow = s.add.circle(cx, y + 74, 46, t.soon ? 0x3a2a50 : 0x5a2e8a, t.soon ? 0.35 : 0.45);
      // Ícones pintados: todos do mesmo tamanho na tela (80 px), cabendo no círculo de fundo.
      const icon = t.draw ? t.draw(s, cx, y + 74) : s.add.image(cx, y + 74, t.icon).setDisplaySize(t.size ?? 80, t.size ?? 80);
      if (t.soon) icon.setAlpha(0.45);
      const label = fit(txt(s, cx, y + 140, t.label, 21, t.soon ? TXT.dim : TXT.main, true).setOrigin(0.5), TW - 20);
      const sub = txt(s, cx, y + 168, '', 14, t.soon ? TXT.gold : TXT.dim).setOrigin(0.5);
      const dot = s.add.circle(x + TW - 22, y + 22, 11, 0xe0563b).setStrokeStyle(2, 0x120a1e).setVisible(false);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.press(parts, 0.95));
      bg.on('pointerout', () => this.press(parts, 1));
      bg.on('pointerup', () => {
        this.press(parts, 1);
        Sfx.play('click');
        if (t.soon) { s.toast.show(STR.moreSoon, 2000); return; }
        t.onTap();
      });
      const parts = [glow, icon, label, sub];
      this.add([bg, ...parts, dot]);
      return { t, sub, dot };
    });
    this.onOpen = () => this.refresh();
  }

  press(parts, k) {
    parts.forEach((o) => { o.baseScale ??= o.scale; o.setScale(o.baseScale * k); });
  }

  refresh() {
    this.tiles.forEach(({ t, sub, dot }) => {
      fit(sub.setText(t.soon ? STR.moreSoonTag : t.sub?.() ?? ''), TW - 16);
      dot.setVisible(!!t.dot?.());
    });
  }
}

// Ícone dos três riscos (☰) em pixel art, para a barra fixa.
export function ensureMenuIcon(scene) {
  if (scene.textures.exists('icon_menu')) return;
  const c = scene.textures.createCanvas('icon_menu', 18, 16);
  const g = c.getContext();
  for (const y of [1, 6, 11]) {
    g.fillStyle = '#3a1a04'; g.fillRect(0, y, 18, 5);
    g.fillStyle = '#e8a830'; g.fillRect(1, y + 1, 16, 3);
    g.fillStyle = '#ffe08a'; g.fillRect(1, y + 1, 16, 1);
    g.fillStyle = '#b87818'; g.fillRect(1, y + 3, 16, 1);
  }
  c.refresh();
}

// Ícone de tela cheia (quatro cantos) desenhado.
export function drawFullscreenIcon(scene, x, y, k = 1) {
  const g = scene.add.graphics({ x, y });
  g.lineStyle(6 * k, 0xffd86a);
  const a = 24 * k, b = 12 * k;
  g.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.moveTo(sx * a, sy * (a - b)); g.lineTo(sx * a, sy * a); g.lineTo(sx * (a - b), sy * a);
  }
  g.strokePath();
  return g;
}

export { drawShield };
