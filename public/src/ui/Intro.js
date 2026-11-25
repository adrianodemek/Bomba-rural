// Tela inicial e dicas do primeiro acesso.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { Button } from './Button.js';
import { Modal, txt } from './widgets.js';
import { setHeroPortrait } from '../art/hd.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;

export class TitleOverlay extends Modal {
  constructor(scene, onPlay) {
    super(scene, 600, 0.78);
    const s = scene;
    const title = txt(s, W / 2, 360, STR.gameTitle, 76, TXT.gold).setOrigin(0.5).setStroke('#12081c', 14);
    const sub = txt(s, W / 2, 440, STR.gameSubtitle, 22, TXT.main).setOrigin(0.5);
    const heroes = [0, 1, 2].map((i) => setHeroPortrait(s.add.sprite(W / 2 + (i - 1) * 130, 590, 'hero0_down_0'), { palette: [0, 5, 1][i], rarity: 2, role: ['support', 'attacker', 'collector'][i] }).setScale(9));
    const bomb = s.add.image(W / 2, 735, 'ui_bomb').setScale(6);
    const btn = new Button(s, W / 2, 900, 380, 110, STR.playBtn, () => { this.close(); onPlay(); }, { fontSize: 40 });
    this.add([title, sub, ...heroes, bomb, btn]);
    heroes.forEach((h, i) => s.tweens.add({
      targets: h, y: 574, duration: 420, yoyo: true, repeat: -1, delay: i * 140, ease: 'Sine.easeInOut',
    }));
    s.tweens.add({ targets: bomb, scale: 6.6, duration: 300, yoyo: true, repeat: -1 });
    this.anim = [...heroes, bomb];
  }

  close() {
    this.anim.forEach((o) => this.scene.tweens.killTweensOf(o));
    super.close();
  }
}

// Sequência de dicas: título, texto e botão "Próxima".
export class TipsModal extends Modal {
  constructor(scene) {
    super(scene, 590, 0.7);
    const s = scene;
    this.card = frame(s, W / 2, 640, W - 100, 420, COL.panel).setStrokeStyle(5, COL.gold);
    this.card.setInteractive();
    this.step = txt(s, W / 2, 470, '', 18, TXT.dim).setOrigin(0.5);
    this.title = txt(s, W / 2, 520, '', 32, TXT.gold).setOrigin(0.5);
    this.body = txt(s, W / 2, 630, '', 21, TXT.main).setOrigin(0.5).setAlign('center').setWordWrapWidth(W - 180);
    this.btn = new Button(s, W / 2, 780, 320, 76, '', () => this.next(), { fontSize: 26 });
    this.add([this.card, this.step, this.title, this.body, this.btn]);
  }

  show(tips, onDone) {
    this.tips = tips;
    this.onDone = onDone;
    this.i = 0;
    this.render();
    this.open();
  }

  render() {
    const [t, b] = this.tips[this.i];
    this.step.setText(`${this.i + 1}/${this.tips.length}`);
    this.title.setText(t);
    this.body.setText(b);
    this.btn.setLabel(this.i === this.tips.length - 1 ? STR.tipDone : STR.tipNext);
  }

  next() {
    this.i += 1;
    if (this.i >= this.tips.length) { this.close(); this.onDone?.(); return; }
    this.render();
  }
}
