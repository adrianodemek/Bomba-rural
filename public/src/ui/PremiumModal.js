// Janela do Passe do Minerador: a janela inteira é uma arte ilustrada (assets/ui/premium_window.webp,
// gerada por ferramentas/icons/premium_window.py). O jogo só escreve por cima a situação, o texto do
// botão e o aviso de teste. Enquanto a arte carrega, aparece uma versão simples desenhada com a pele da UI.
import { freeArt, restoreArt } from '../art/bigArt.js';
import { BALANCE } from '../config/balance.js';
import { COL, TXT, FONT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { frame } from './skin.js';
import { premiumActive, premiumDaysLeft } from '../systems/Premium.js';
import { Sfx } from '../systems/Sfx.js';

const W = BALANCE.screen.width;
const CY = 640;
const ART = 'premium_window';
// Arte 1280×2020 mostrada em 640×1010, centrada em (360, 640): canto em (40, 135).
// Posição no jogo = pixel da arte ÷ 2 + canto (os mesmos pontos de premium_window.py).
const ART_W = 640, ART_H = 1010, ART_X = 40, ART_Y = 135;
const at = (px, py) => [ART_X + px / 2, ART_Y + py / 2];
const STATUS = at(640, 1592);
const BTN = { x: at(640, 0)[0], y: at(0, 1740)[1], w: 500, h: 80 };
const NOTE = at(640, 1880);
const CLOSE = at(1196, 84);

export class PremiumModal extends Modal {
  constructor(scene, { onBuy }) {
    super(scene, 430, 0.82);
    this.onBuy = onBuy;
    this.buildFallback(scene);
    this.loadArt();
  }

  // Versão simples (só enquanto a arte não carregou).
  buildFallback(s) {
    const P = BALANCE.premium;
    const f = this.fallback = s.add.container(0, 0);
    const cardBg = frame(s, W / 2, CY, W - 80, 1010, COL.panel).setStrokeStyle(5, COL.gold).setInteractive();
    f.add([cardBg, s.add.image(W / 2, CY - 360, 'icon_premium').setScale(9),
      txt(s, W / 2, CY - 240, STR.premiumTitle, 40, TXT.gold).setOrigin(0.5).setStroke('#12081c', 6),
      txt(s, W / 2, CY - 180, STR.premiumSub, 21, TXT.dim).setOrigin(0.5)]);
    const perks = [STR.premiumPerks[0](P.dailyCrystals), STR.premiumPerks[1](Math.round(P.recoveryBonus * 100)),
      STR.premiumPerks[2](P.expeditionSlots), STR.premiumPerks[3](P.offlineHours), STR.premiumPerks[4](), STR.premiumPerks[5]()];
    perks.forEach((p, i) => f.add(fit(txt(s, 90, CY - 110 + i * 60, `• ${p}`, 21, TXT.main).setOrigin(0, 0.5), W - 180)));
    this.fallbackBtn = new Button(s, W / 2, CY + 380, W - 200, 84, '', () => this.onBuy(), { fontSize: 28, color: 0xd89a28, border: 0x7a4806 });
    this.fallbackClose = new Button(s, W - 74, CY - 470, 58, 58, 'X', () => this.close(), { fontSize: 26, color: COL.danger, border: COL.dangerBorder });
    f.add([this.fallbackBtn, this.fallbackClose]);
    this.add(f);
  }

  loadArt() {
    const s = this.scene;
    if (s.textures.exists(ART)) { this.buildArt(); return; }
    s.load.image(ART, 'assets/ui/premium_window.webp');
    s.load.once(`filecomplete-image-${ART}`, () => this.buildArt());
    s.load.start();
  }

  buildArt() {
    if (this.art) return;
    const s = this.scene;
    s.textures.get(ART).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.fallback.setVisible(false);
    this.art = s.add.image(W / 2, CY, ART).setDisplaySize(ART_W, ART_H).setInteractive();
    this.add(this.art);

    // Reflexo de luz passando pela cena do topo e pelo botão.
    const mg = s.make.graphics({ x: 0, y: BALANCE.layout.modalDY || 0 }, false);
    mg.fillStyle(0xffffff).fillRoundedRect(ART_X + 12, ART_Y + 12, ART_W - 24, 290, 20);
    mg.fillRoundedRect(BTN.x - BTN.w / 2, BTN.y - BTN.h / 2, BTN.w, BTN.h, BTN.h / 2);
    this.shine = s.add.rectangle(ART_X - 80, CY - 200, 70, 1100, 0xffffff, 0.22).setAngle(18)
      .setBlendMode(Phaser.BlendModes.ADD).setMask(mg.createGeometryMask());
    this.add(this.shine);
    s.tweens.add({ targets: this.shine, x: ART_X + ART_W + 80, duration: 1300, ease: 'Sine.easeInOut', repeat: -1, repeatDelay: 2000 });

    this.status = s.add.text(STATUS[0], STATUS[1], '', {
      fontFamily: FONT, fontSize: fs(23), color: '#9be37a', stroke: '#120826', strokeThickness: 6,
    }).setOrigin(0.5);
    this.btnLabel = s.add.text(BTN.x, BTN.y - 3, '', {
      fontFamily: FONT, fontSize: fs(30), color: '#3a1a04', stroke: '#fff0b0', strokeThickness: 3,
    }).setOrigin(0.5);
    this.note = s.add.text(NOTE[0], NOTE[1], STR.premiumTestNote, {
      fontFamily: FONT, fontSize: fs(16), color: '#a898d0',
    }).setOrigin(0.5);
    const btnHit = s.add.rectangle(BTN.x, BTN.y, BTN.w, BTN.h + 10, 0x000000, 0).setInteractive({ useHandCursor: true });
    btnHit.on('pointerdown', () => this.btnLabel.setScale(0.94));
    btnHit.on('pointerout', () => this.btnLabel.setScale(1));
    btnHit.on('pointerup', () => { this.btnLabel.setScale(1); Sfx.play('click'); this.onBuy(); });
    const closeHit = s.add.circle(CLOSE[0], CLOSE[1], 34, 0x000000, 0).setInteractive({ useHandCursor: true });
    closeHit.on('pointerup', () => { Sfx.play('click'); this.close(); });
    this.add([this.status, this.btnLabel, this.note, btnHit, closeHit]);
    this.refresh();
    if (!this.visible) freeArt(s, ART, this.art);   // construída fechada: a arte grande só volta ao abrir
  }

  close() {
    super.close();
    this.scene.time.delayedCall(250, () => { if (!this.visible) freeArt(this.scene, ART, this.art); });
  }

  show() {
    if (this.art) restoreArt(this.scene, ART, 'assets/ui/premium_window.webp', this.art, ART_W, ART_H);
    this.refresh();
    this.open();
    if (this.art && this.art.texture.key === ART) {   // entrada com um leve "pulo"
      const sx = ART_W / this.art.width, sy = ART_H / this.art.height;
      this.art.setScale(sx * 0.94, sy * 0.94);
      this.scene.tweens.add({ targets: this.art, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.easeOut' });
    }
  }

  refresh() {
    const P = BALANCE.premium;
    const on = premiumActive();
    const label = on ? STR.premiumRenew(P.priceLabel) : STR.premiumBuy(P.priceLabel);
    this.fallbackBtn.setLabel(label);
    if (!this.art) return;
    this.status.setText(on ? STR.premiumActive(premiumDaysLeft()) : STR.premiumPrice(P.priceLabel, P.days))
      .setColor(on ? '#9be37a' : '#ffe680');
    fit(this.btnLabel.setText(label), BTN.w - 120);
    this.note.setVisible(P.testMode);
  }
}
