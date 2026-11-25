// Botão com relevo (tema Imperial), rótulo e estado ligado/desligado.
// Botão claro (ouro) leva texto escuro; botão escuro leva texto dourado.
import { COL, FONT, TXT, fs } from '../config/theme.js';
import { Sfx } from '../systems/Sfx.js';
import { buttonFace, setButtonFace, luminance } from './skin.js';

export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, label, onClick, opts = {}) {
    super(scene, x, y);
    this.color = opts.color ?? COL.btn;
    this.borderColor = opts.border ?? COL.btnBorder;
    this.enabled = true;
    this.onClick = onClick;
    this.onDisabledClick = opts.onDisabledClick;

    this.w = w; this.h = h;
    this.bg = buttonFace(scene, w, h, this.color, this.borderColor);
    this.label = scene.add.text(0, 0, label, {
      fontFamily: FONT,
      fontStyle: 'bold',
      fontSize: fs(opts.fontSize || 26),
      color: TXT.main,
      align: 'center',
      wordWrap: { width: w - 24 },
    }).setOrigin(0.5, 0.6);
    this.add([this.bg, this.label]);
    this.paintLabel();

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => this.setScale(0.96));
    this.bg.on('pointerout', () => this.setScale(1));
    this.bg.on('pointerup', () => {
      this.setScale(1);
      if (this.enabled) { Sfx.play('click'); this.onClick?.(); }
      else this.onDisabledClick?.();
    });
    scene.add.existing(this);
  }

  // Cor do texto conforme o fundo do botão.
  paintLabel() {
    // Só redesenha o texto se algo mudou (trocar cor/sombra de um texto refaz a imagem dele).
    const state = `${this.enabled}_${this.color}`;
    if (state === this.labelState) return;
    this.labelState = state;
    if (!this.enabled) {
      this.label.setColor(TXT.dim).setShadow(0, 2, 'rgba(0,0,0,0.6)', 0).setAlpha(0.8);
      return;
    }
    const light = luminance(this.color) > 0.5;
    if (light) this.label.setColor(TXT.onGold).setShadow(0, 1, 'rgba(255,240,190,0.6)', 0);
    else this.label.setColor(TXT.gold).setShadow(0, 2, 'rgba(8,2,16,0.75)', 0);
    this.label.setAlpha(1);
  }

  setEnabled(v) {
    this.enabled = v;
    setButtonFace(this.bg, v ? this.color : COL.btnDisabled, v ? this.borderColor : COL.btnDisabledBorder, !v);
    this.paintLabel();
    return this;
  }

  setLabel(text) {
    this.label.setText(text);
    return this;
  }

  setColors(color, border) {
    this.color = color;
    this.borderColor = border;
    return this.setEnabled(this.enabled);
  }
}
