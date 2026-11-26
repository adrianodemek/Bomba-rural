// Aba Mercado: a barraca do Mascate Tião já está montada, mas só abre com o modo online.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { RoomView } from './RoomView.js';
import { txt, card, fit } from './widgets.js';
import { RARITY_COLORS, RARITY_TEXT } from '../data/heroes.js';
import { itemTitle, itemSubtitle, itemIcon } from './itemText.js';

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

    // Vitrine (prévia): como vão aparecer os exclusivos de classe à venda. Tudo desligado até o servidor.
    const vy = y + 340;
    const SAMPLE = [
      { item: { slot: 'weapon', rarity: 3, ilvl: 120, plus: 7, stars: 0, cls: 'attacker', affixes: [] }, price: 480, seller: 'Pavio_Real' },
      { item: { slot: 'helm', rarity: 2, ilvl: 88, plus: 3, stars: 0, cls: 'support', affixes: [] }, price: 150, seller: 'Engrenagem' },
      { item: { slot: 'boots', rarity: 4, ilvl: 210, plus: 0, stars: 1, cls: 'collector', affixes: [] }, price: 1200, seller: 'Garimpeira' },
    ];
    this.add(txt(s, 24, vy, STR.marketShowcase, 22, TXT.gold, true).setOrigin(0, 0.5));
    SAMPLE.forEach((o, i) => {
      const ry = vy + 30 + i * 92;
      const bg = card(s, 24, ry, W - 48, 84, RARITY_COLORS[o.item.rarity], 0x120a1e);
      const icon = s.add.image(70, ry + 42, itemIcon(o.item)).setDisplaySize(70, 70);
      const name = fit(txt(s, 118, ry + 26, itemTitle(o.item), 20, RARITY_TEXT[o.item.rarity], true).setOrigin(0, 0.5), 360);
      const sub = fit(txt(s, 118, ry + 56, `${itemSubtitle(o.item)} · ${o.seller}`, 15, TXT.dim).setOrigin(0, 0.5), 360);
      const price = new Button(s, W - 110, ry + 42, 150, 56, `    ${o.price}`, () => s.toast.show(STR.marketLocked, 2200), {
        fontSize: 18, color: COL.card, border: COL.border,
      });
      price.setAlpha(0.7);
      const gem = s.add.image(W - 160, ry + 42, 'crystal').setDisplaySize(30, 30).setAlpha(0.85);
      this.add([bg, icon, name, sub, price, gem]);
    });
    this.add(txt(s, W / 2, vy + 316, STR.marketShowcaseNote, 16, TXT.dim).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 80));
    this.onOpen = () => this.room.setRoom('mercado');
  }

  refresh() {}
}
