// Painel que sobe por cima da arena (a batalha continua por trás).
import { BALANCE } from '../config/balance.js';
import { COL, TITLE_FONT, TXT, fs } from '../config/theme.js';
import { Button } from './Button.js';
import { STR } from '../config/strings.js';
import { frame, goldBandKey, royalGlowKey } from './skin.js';

export class Panel extends Phaser.GameObjects.Container {
  constructor(scene, title, onClose) {
    const L = BALANCE.layout;
    super(scene, 0, L.tabsY);
    this.openY = L.arenaY;
    this.closedY = L.tabsY;
    this.w = BALANCE.screen.width;
    this.h = L.tabsY - L.arenaY;
    this.isOpen = false;

    const bg = frame(scene, 0, 0, this.w, this.h, COL.panel, 0.98).setOrigin(0);
    bg.setInteractive(); // bloqueia toques na arena
    // Brilho roxo no alto e faixa de luz dourada na borda (tema Imperial).
    const glow = scene.add.image(this.w / 2, 0, royalGlowKey(scene)).setOrigin(0.5, 0).setDisplaySize(this.w, 320);
    const edge = scene.add.image(this.w / 2, 0, goldBandKey(scene)).setOrigin(0.5, 0.25).setDisplaySize(this.w, 10);
    this.titleText = scene.add.text(24, 44, title, {
      fontFamily: TITLE_FONT, fontSize: fs(38), color: TXT.gold,
    }).setOrigin(0, 0.5).setStroke(TXT.ink, 6).setShadow(0, 0, 'rgba(255,176,42,0.55)', 14, false, true);
    const close = new Button(scene, this.w - 90, 44, 150, 64, STR.close, onClose, {
      fontSize: 22, color: COL.card, border: COL.border,
    });
    this.closeBtn = close;
    this.add([bg, glow, edge, this.titleText, close]);

    this.setVisible(false).setDepth(100).setX(-10000); // fechado fica fora da tela (não recebe toques)
    scene.add.existing(this);
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.setVisible(true).setX(0);
    this.scene.tweens.killTweensOf(this);
    this.y = this.closedY;
    this.scene.tweens.add({ targets: this, y: this.openY, duration: 220, ease: 'Cubic.easeOut' });
    this.onOpen?.();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, y: this.closedY, duration: 180, ease: 'Cubic.easeIn',
      onComplete: () => { this.setVisible(false).setX(-10000); this.onClosed?.(); },
    });
  }
}
