// Mensagem curta que aparece e some sozinha.
import { FONT, TXT, fs } from '../config/theme.js';
import { frame } from './skin.js';

export class Toast extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.bg = frame(scene, 0, 0, 100, 64, 0x120a1e, 0.92).setStrokeStyle(3, 0xa87a20);
    this.text = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: fs(22), color: TXT.main, align: 'center', wordWrap: { width: 620 },
    }).setOrigin(0.5);
    this.add([this.bg, this.text]);
    this.setDepth(500).setAlpha(0).setVisible(false);
    scene.add.existing(this);
  }

  show(message, ms = 1800) {
    this.text.setText(message);
    this.bg.resize(this.text.width + 48, this.text.height + 28);
    this.scene.tweens.killTweensOf(this);
    this.setVisible(true).setAlpha(0).setScale(0.9);
    this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 150 });
    this.scene.tweens.add({
      targets: this, alpha: 0, delay: ms, duration: 250, onComplete: () => this.setVisible(false),
    });
  }
}
