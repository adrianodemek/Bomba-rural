// Aba Mercado: a barraca do Mascate Tião já está montada, mas só abre com o modo online.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { RoomView } from './RoomView.js';
import { txt, card } from './widgets.js';

const W = BALANCE.screen.width;
const ROOM_Y = 92;

export class MarketPanel extends Panel {
  constructor(scene, { onClose }) {
    super(scene, STR.marketTitle, onClose);
    const s = scene;
    this.room = new RoomView(s, 24, ROOM_Y);
    this.add(this.room);
    this.room.setRoom('mercado');
    const sign = this.room.info?.sign || [336, 118];
    this.sign = txt(s, 24 + sign[0], ROOM_Y + sign[1], STR.marketSoon, 28, '#fff1c8', true).setOrigin(0.5).setStroke('#3a2410', 8);
    this.add(this.sign);
    s.tweens.add({ targets: this.sign, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const y = ROOM_Y + 380;
    this.add(card(s, 24, y, W - 48, 150, COL.gold));
    this.add(txt(s, 48, y + 30, STR.marketNpc, 22, TXT.gold, true).setOrigin(0, 0.5));
    this.add(txt(s, 48, y + 62, STR.marketInfo, 18, TXT.main).setOrigin(0, 0).setWordWrapWidth(W - 96));
    // Prévia do que vai ter (desligado)
    const opts = STR.marketFeatures;
    opts.forEach((label, i) => {
      const bx = 24 + (W - 48) / opts.length * (i + 0.5);
      const b = new Button(s, bx, y + 220, (W - 48) / opts.length - 12, 70, label, () => s.toast.show(STR.marketLocked, 2200), {
        fontSize: 18, color: COL.card, border: COL.border,
      });
      b.setAlpha(0.55);
      this.add(b);
    });
    this.add(txt(s, W / 2, y + 296, STR.marketFoot, 17, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 80));
    this.onOpen = () => this.room.setRoom('mercado');
  }

  refresh() {}
}
