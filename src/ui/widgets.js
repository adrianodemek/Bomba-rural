const OFFSCREEN = -10000;

// Peças pequenas de interface: texto, barra de progresso, estrelas, modal.
import { BALANCE } from '../config/balance.js';
import { COL, FONT, TITLE_FONT, TXT, fs } from '../config/theme.js';
import { frame } from './skin.js';

// Títulos grandes em dourado usam a fonte de título (Cinzel); o resto usa a Inter (bold = mais grossa).
export function txt(scene, x, y, str, size, color = TXT.main, bold = false) {
  const title = color === TXT.gold && size >= 30;
  return scene.add.text(x, y, str, {
    fontFamily: title ? TITLE_FONT : FONT, fontStyle: bold && !title ? 'bold' : 'normal', fontSize: fs(size), color,
  });
}

// Encolhe um texto para caber numa largura.
export function fit(text, maxW) {
  text.setScale(1);
  if (text.width > maxW) text.setScale(maxW / text.width);
  return text;
}

export class ProgressBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, color = 0x6fd36b) {
    super(scene, x, y);
    this.w = w;
    // Trilho escuro com filete dourado; o preenchimento leva um brilho em cima.
    this.bg = frame(scene, 0, 0, w, h, 0x0c0614).setOrigin(0, 0.5).setStrokeStyle(2, 0x6a4a18, 0.9);
    this.fill = scene.add.rectangle(2, 0, w - 4, h - 4, color).setOrigin(0, 0.5);
    this.shine = scene.add.rectangle(2, -(h - 4) / 4, w - 4, Math.max(1, (h - 4) / 3), 0xffffff, 0.22).setOrigin(0, 0.5);
    this.add([this.bg, this.fill, this.shine]);
    scene.add.existing(this);
  }

  setValue(ratio, color) {
    this.fill.scaleX = Phaser.Math.Clamp(ratio, 0, 1);
    this.shine.scaleX = this.fill.scaleX;
    if (color !== undefined) this.fill.setFillStyle(color);
    return this;
  }
}

export function energyColor(ratio) {
  if (ratio >= 0.6) return 0x6fd36b;
  if (ratio >= BALANCE.teams.readyRatio) return 0xe8b84a;
  return 0xe0563b;
}

// Fileira de estrelas (preenchidas até "n").
export class Stars extends Phaser.GameObjects.Container {
  constructor(scene, x, y, scale = 2) {
    super(scene, x, y);
    const step = 8 * scale + 2;
    this.icons = [0, 1, 2].map((i) => scene.add.image(i * step, 0, 'star_empty').setScale(scale).setOrigin(0, 0.5));
    this.add(this.icons);
    scene.add.existing(this);
  }

  setCount(n) {
    this.icons.forEach((img, i) => img.setTexture(i < n ? 'star' : 'star_empty'));
    return this;
  }
}

// Fundo escuro de tela cheia que bloqueia toques, com um container por cima.
export class Modal extends Phaser.GameObjects.Container {
  constructor(scene, depth = 300, alpha = 0.72) {
    // As janelas foram desenhadas para 1280 de altura: o container desce modalDY para ficarem no meio da tela.
    const dy = BALANCE.layout.modalDY || 0;
    super(scene, 0, dy);
    const { width, height } = BALANCE.screen;
    this.backdrop = scene.add.rectangle(0, -dy, width, height, 0x000000, alpha).setOrigin(0).setInteractive();
    this.add(this.backdrop);
    this.setDepth(depth).setVisible(false).setX(OFFSCREEN);
    scene.add.existing(this);
  }

  // Fechado, fica fora da tela: botões escondidos dentro de containers ainda recebem toques.
  open() {
    this.setX(0).setVisible(true).setAlpha(0);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 150 });
  }

  close() {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 120, onComplete: () => this.setVisible(false).setX(OFFSCREEN),
    });
  }

  get isOpen() { return this.visible; }
}

// Cartão retangular com borda.
export function card(scene, x, y, w, h, border = COL.border, fill = COL.card) {
  return frame(scene, x, y, w, h, fill).setOrigin(0).setStrokeStyle(3, border);
}

export { TXT };
