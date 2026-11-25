// Janela de recompensas ("Baú do retorno"): fundo roxo com raios dourados girando, ícone grande no alto
// (baú, estrela, coroa, heróis...), moedas e cristais flutuando, faixa colorida com o título, linhas de prêmio
// e o botão Coletar. Serve para ganho offline, baús, Jornada, Passe, presente diário, Colosso, Abismo etc.
// show({ title, subtitle, items: [{ icon, frame?, text, color, note }], top: { icon, frame? }, ribbon, tip }, onClose)
//   ribbon: 'red' (padrão) · 'purple' · 'blue' · 'green' · 'gold' · 'crimson'
//   tip: { icon, text, onTap } — caixinha de dica embaixo dos prêmios (ex.: Passe do Minerador para quem é free)
import { BALANCE } from '../config/balance.js';
import { COL, TXT, TITLE_FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { frame } from './skin.js';

const SW = BALANCE.screen.width;
const MAX_ROWS = 6;
const WIN_W = 600;
const X0 = (SW - WIN_W) / 2;
const CX = SW / 2;
const MID = 640;               // meio da tela no espaço das janelas (1280 de altura; o Modal desce o resto)
const ICON_ZONE = 250;
const ROW_H = 76;
const ROW_GAP = 12;

const RIBBONS = {
  red: [0xc0392b, 0x8a1c22, 0x4a0a10],
  purple: [0x8a4ad8, 0x5a2a9a, 0x2a1040],
  blue: [0x3a7ad8, 0x1f4c9a, 0x0c2450],
  green: [0x3aa84a, 0x1f6a2a, 0x0a3010],
  gold: [0xe8a830, 0xb07010, 0x4a2a04],
  crimson: [0xd83a5a, 0x8a1a30, 0x400818],
};

// Texturas desenhadas uma vez: fundo roxo radial e o leque de raios (com as pontas sumindo).
function ensureTextures(scene) {
  if (!scene.textures.exists('rw_bg')) {
    const c = scene.textures.createCanvas('rw_bg', 300, 540);
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(150, 150, 10, 150, 200, 420);
    g.addColorStop(0, '#7a34c8');
    g.addColorStop(0.42, '#2c1254');
    g.addColorStop(0.8, '#170a2a');
    g.addColorStop(1, '#120820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 300, 540);
    c.refresh();
  }
  if (!scene.textures.exists('rw_rays')) {
    const N = 800;
    const c = scene.textures.createCanvas('rw_rays', N, N);
    const ctx = c.getContext();
    const r = N / 2;
    ctx.fillStyle = 'rgba(255,214,110,0.28)';
    const rays = 16;
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / rays * 0.42;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    // Some para as pontas.
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createRadialGradient(r, r, 0, r, r, r);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.35, 'rgba(0,0,0,0.9)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, N, N);
    c.refresh();
  }
}

export class RewardModal extends Modal {
  constructor(scene) {
    super(scene, 450, 0.8);
    const s = scene;
    ensureTextures(s);

    this.bg = s.add.image(X0, 0, 'rw_bg').setOrigin(0);
    this.rays = s.add.image(CX, 0, 'rw_rays').setDisplaySize(980, 980).setAlpha(0.9);
    this.maskG = s.make.graphics({ x: 0, y: BALANCE.layout.modalDY || 0 }, false);
    this.rays.setMask(this.maskG.createGeometryMask());
    this.win = frame(s, X0, 0, WIN_W, 400, null).setOrigin(0).setStrokeStyle(4, COL.gold);
    this.win.setInteractive();   // toques dentro da janela não fecham nada
    this.add([this.bg, this.rays, this.win]);

    // Ícone grande com brilho, e moedas / cristais / faíscas em volta.
    this.glow = s.add.circle(CX, 0, 110, 0xffd060, 0.22);
    this.top = s.add.image(CX, 0, 'ui_chest');
    this.decor = [
      ['coin', -205, -95, 54], ['coin', 175, -125, 44], ['crystal', -150, 85, 48], ['coin', 200, 70, 48], ['crystal', 120, -80, 38],
    ].map(([k, dx, dy, size]) => ({ img: s.add.image(CX + dx, 0, k), dx, dy, size }));
    this.sparks = [[-170, -10], [205, -20], [-40, -130], [70, 120], [-235, 60]].map(([dx, dy], i) => ({
      img: s.add.rectangle(CX + dx, 0, i % 2 ? 7 : 10, i % 2 ? 7 : 10, 0xfff3b0).setAngle(45), dx, dy,
    }));
    this.add([this.glow, ...this.decor.map((d) => d.img), ...this.sparks.map((p) => p.img), this.top]);

    // Faixa do título.
    this.ribbon = s.add.graphics();
    this.title = s.add.text(CX, 0, '', { fontFamily: TITLE_FONT, fontSize: fs(34), color: '#fff4d0' })
      .setOrigin(0.5).setStroke('#4a0a10', 6);
    this.subtitle = txt(s, CX, 0, '', 20, '#d8c8f0').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(WIN_W - 70);
    this.add([this.ribbon, this.title, this.subtitle]);

    // Linhas de prêmio.
    this.rows = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      const bg = frame(s, X0 + 30, 0, WIN_W - 60, ROW_H, 0x24133c).setOrigin(0).setStrokeStyle(3, 0x7a5418);
      const icon = s.add.image(X0 + 66, 0, 'coin');
      const label = txt(s, X0 + 104, 0, '', 27, TXT.main, true).setOrigin(0, 0.5);
      const note = txt(s, X0 + WIN_W - 48, 0, '', 16, TXT.dim).setOrigin(1, 0.5);
      this.add([bg, icon, label, note]);
      this.rows.push({ bg, icon, label, note });
    }

    // Dica (ex.: Passe do Minerador para quem ainda não tem).
    this.tipBg = frame(s, X0 + 30, 0, WIN_W - 60, 70, 0x3a2410).setOrigin(0).setStrokeStyle(3, 0xffd86a);
    this.tipIcon = s.add.image(X0 + 66, 0, 'icon_premium');
    this.tipText = txt(s, X0 + 102, 0, '', 17, TXT.gold, true).setOrigin(0, 0.5).setWordWrapWidth(WIN_W - 170);
    this.tipArrow = txt(s, X0 + WIN_W - 50, 0, '›', 30, TXT.gold, true).setOrigin(0.5);
    this.tipBg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      const t = this.tip;
      if (!t?.onTap) return;
      this.done();
      t.onTap();
    });
    this.add([this.tipBg, this.tipIcon, this.tipText, this.tipArrow]);

    this.btn = new Button(s, CX, 0, 440, 92, STR.collect, () => this.done(), { fontSize: 32 });
    this.add(this.btn);
  }

  // Ajusta uma imagem para caber num quadrado de "size" (os ícones têm tamanhos de textura diferentes).
  fitIcon(img, key, frameName, size) {
    if (frameName) img.setTexture(key, frameName); else img.setTexture(key);
    const f = img.frame;
    img.setScale(size / Math.max(f.width, f.height));
  }

  drawRibbon(y, w, color) {
    const [main, dark, edge] = RIBBONS[color] || RIBBONS.red;
    const g = this.ribbon.clear();
    const h = 70;
    const x = CX - w / 2;
    // Pontas atrás (com o recorte em V).
    for (const side of [-1, 1]) {
      const bx = side < 0 ? x - 34 : x + w - 22;
      g.fillStyle(dark, 1).lineStyle(4, 0xffd86a, 1);
      const pts = side < 0
        ? [[bx, y + 12], [bx + 56, y + 12], [bx + 56, y + h + 12], [bx, y + h + 12], [bx + 18, y + 12 + (h / 2)]]
        : [[bx, y + 12], [bx + 56, y + 12], [bx + 38, y + 12 + h / 2], [bx + 56, y + h + 12], [bx, y + h + 12]];
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(([px, py]) => g.lineTo(px, py));
      g.closePath();
      g.fillPath();
      g.strokePath();
    }
    // Faixa da frente.
    g.fillStyle(main, 1).fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(dark, 1).fillRoundedRect(x, y + h * 0.62, w, h * 0.38, { tl: 0, tr: 0, bl: 10, br: 10 });
    g.lineStyle(4, 0xffd86a, 1).strokeRoundedRect(x, y, w, h, 10);
    g.fillStyle(edge, 0.9).fillRect(x + 6, y + h + 2, w - 12, 6);
    this.title.setStroke('#' + edge.toString(16).padStart(6, '0'), 6);
  }

  show({ title, subtitle = '', items = [], top = null, ribbon = 'red', tip = null }, onClose) {
    this.onClose = onClose;
    this.tip = tip;
    const n = Math.min(MAX_ROWS, items.length);

    // Textos primeiro (a altura da janela depende deles).
    this.title.setText(title).setScale(1);
    if (this.title.width > WIN_W - 150) this.title.setScale((WIN_W - 150) / this.title.width);
    this.subtitle.setText(subtitle || '');
    const subH = subtitle ? this.subtitle.height + 22 : 8;
    const rowsH = n * (ROW_H + ROW_GAP);
    const tipH = tip ? 84 : 0;
    const H = ICON_ZONE + 86 + subH + rowsH + tipH + 132;
    const y0 = Math.max(16, MID - H / 2);

    this.bg.setPosition(X0, y0).setDisplaySize(WIN_W, H);
    this.win.setPosition(X0, y0);
    this.win.resize(WIN_W, H);
    this.maskG.clear().fillStyle(0xffffff).fillRect(X0 + 4, y0 + 4, WIN_W - 8, H - 8);

    // Ícone no alto e enfeites.
    const iy = y0 + 136;
    this.rays.setY(iy);
    this.glow.setY(iy);
    const t = top || { icon: 'ui_chest' };
    this.fitIcon(this.top, t.icon, t.frame, t.size || 220);
    this.top.setY(iy);
    this.decor.forEach((d) => { this.fitIcon(d.img, d.img.texture.key, null, d.size); d.img.setY(iy + d.dy); });
    this.sparks.forEach((p) => p.img.setY(iy + p.dy));

    // Faixa + subtítulo.
    const ry = y0 + ICON_ZONE;
    const rw = Math.min(WIN_W - 70, Math.max(360, this.title.displayWidth + 110));
    this.drawRibbon(ry, rw, ribbon);
    this.title.setY(ry + 35);
    this.subtitle.setY(ry + 86);

    // Linhas.
    let y = ry + 86 + subH;
    this.rows.forEach((r, i) => {
      const it = items[i];
      const show = i < n;
      [r.bg, r.icon, r.label, r.note].forEach((o) => o.setVisible(show));
      if (!show) return;
      r.bg.setY(y);
      this.fitIcon(r.icon, it.icon, it.frame, 52);
      r.icon.setY(y + ROW_H / 2);
      r.note.setText(it.note || '').setY(y + ROW_H / 2);
      r.label.setText(it.text).setColor(it.color || TXT.main).setY(y + ROW_H / 2);
      fit(r.label, WIN_W - 140 - (it.note ? r.note.width + 16 : 0));
      // Entrada em cascata.
      [r.bg, r.icon, r.label, r.note].forEach((o) => o.setAlpha(0));
      this.scene.tweens.add({ targets: [r.bg, r.icon, r.label, r.note], alpha: 1, duration: 220, delay: 180 + i * 110 });
      y += ROW_H + ROW_GAP;
    });

    // Dica.
    [this.tipBg, this.tipIcon, this.tipText, this.tipArrow].forEach((o) => o.setVisible(!!tip));
    if (tip) {
      this.tipBg.setY(y + 2);
      this.fitIcon(this.tipIcon, tip.icon || 'icon_premium', tip.frame, 44);
      this.tipIcon.setY(y + 37);
      this.tipText.setText(tip.text).setY(y + 37);
      this.tipArrow.setY(y + 35).setVisible(!!tip.onTap);
      y += tipH;
    }
    this.btn.setY(y0 + H - 74);

    this.open();
    this.animate();
  }

  // Raios girando, ícone balançando, moedas flutuando e faíscas piscando (param ao fechar).
  animate() {
    const tw = this.scene.tweens;
    this.stopAnims();
    const add = (cfg) => this.anims.push(tw.add(cfg));
    this.anims = [];
    this.rays.setAngle(0);
    add({ targets: this.rays, angle: 360, duration: 26000, repeat: -1 });
    const baseS = this.top.scale;
    this.top.setScale(baseS * 0.6);
    add({ targets: this.top, scale: baseS, duration: 380, ease: 'Back.easeOut' });
    add({ targets: this.top, y: this.top.y - 8, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 380 });
    add({ targets: this.glow, scale: 1.25, alpha: 0.08, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.decor.forEach((d, i) => add({ targets: d.img, y: d.img.y - 10, angle: i % 2 ? 10 : -10, duration: 1200 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.sparks.forEach((p, i) => { p.img.setAlpha(0.2); add({ targets: p.img, alpha: 1, scale: 1.4, duration: 600 + i * 90, yoyo: true, repeat: -1, delay: i * 140 }); });
  }

  stopAnims() {
    (this.anims || []).forEach((a) => a.stop());
    this.anims = [];
  }

  close() {
    this.stopAnims();
    super.close();
  }

  done() {
    this.close();
    this.onClose?.();
  }
}
