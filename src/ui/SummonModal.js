// Animação de invocação: a gaiola treme, abre num clarão da cor da raridade e o herói aparece.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { ROLES, RARITY_NAMES, RARITY_COLORS, RARITY_TEXT, RANK_TEXT } from '../data/heroes.js';
import { statsOf } from '../systems/Roster.js';
import { economy } from '../systems/Economy.js';
import { Button } from './Button.js';
import { Modal, txt, fit } from './widgets.js';
import { setHeroPortrait } from '../art/hd.js';

const W = BALANCE.screen.width;
const CY = 520;

export class SummonModal extends Modal {
  constructor(scene, { onAgain, onView }) {
    super(scene, 400, 0.9);
    const s = scene;
    this.onAgain = onAgain;
    this.onView = onView;
    this.title = txt(s, W / 2, 230, '', 40, TXT.gold, true).setOrigin(0.5).setStroke('#12081c', 8);
    this.rays = s.add.star(W / 2, CY, 12, 90, 260, 0xffffff, 0.18);
    this.cage = s.add.image(W / 2, CY, 'cage').setScale(12);
    this.heroImg = s.add.sprite(W / 2, CY, 'hero0_down_0').setScale(0);
    this.sparks = s.add.particles(0, 0, 'spark', {
      speed: { min: 150, max: 420 }, lifespan: 900, scale: { start: 3, end: 0 }, gravityY: 300, emitting: false,
    });
    this.rarityText = txt(s, W / 2, 740, '', 46, TXT.main, true).setOrigin(0.5).setStroke('#12081c', 8);
    this.nameText = txt(s, W / 2, 805, '', 32, TXT.main, true).setOrigin(0.5);
    this.roleText = txt(s, W / 2, 850, '', 22, TXT.dim).setOrigin(0.5);
    this.teamText = txt(s, W / 2, 895, '', 22, TXT.good).setOrigin(0.5);
    this.continueBtn = new Button(s, W / 2, 1000, W - 200, 84, STR.continue, () => this.finish(false), { fontSize: 28 });
    this.againBtn = new Button(s, W / 2, 1105, W - 200, 76, '', () => this.finish(true), {
      fontSize: 24, color: COL.card, border: COL.gold,
    });
    this.add([this.title, this.rays, this.cage, this.sparks, this.heroImg, this.rarityText, this.nameText,
      this.roleText, this.teamText, this.continueBtn, this.againBtn]);
  }

  play(hero, { title = STR.summonNew, cageTint = null } = {}) {
    const s = this.scene;
    this.hero = hero;
    this.open();
    s.tweens.killTweensOf([this.cage, this.heroImg, this.rays, this.rarityText]);
    this.title.setText(title).setAlpha(cageTint ? 1 : 0);
    this.cage.setTexture('cage').setScale(12).setAngle(0).setAlpha(1).setVisible(true);
    if (cageTint) this.cage.setTint(cageTint); else this.cage.clearTint();
    setHeroPortrait(this.heroImg, hero).setScale(0);
    this.rays.setVisible(false).setFillStyle(RARITY_COLORS[hero.rarity], 0.22);
    [this.rarityText, this.nameText, this.roleText, this.teamText].forEach((t) => t.setAlpha(0));
    this.continueBtn.setVisible(false);
    this.againBtn.setVisible(false);

    // Quanto mais rara, mais a gaiola treme.
    const shakes = 4 + hero.rarity * 2;
    s.tweens.add({
      targets: this.cage, angle: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: shakes,
      onComplete: () => this.reveal(),
    });
  }

  reveal() {
    const s = this.scene;
    const h = this.hero;
    const color = RARITY_COLORS[h.rarity];
    const rgb = Phaser.Display.Color.IntegerToRGB(color);
    s.cameras.main.flash(280, rgb.r, rgb.g, rgb.b);
    this.cage.setTexture('cage_open').setAngle(0);
    s.tweens.add({ targets: this.cage, alpha: 0, scale: 14, duration: 400 });
    this.sparks.setParticleTint(color);
    this.sparks.explode(18 + h.rarity * 14, W / 2, CY);
    this.rays.setVisible(true).setScale(0.3);
    s.tweens.add({ targets: this.rays, scale: 1, duration: 400, ease: 'Back.easeOut' });
    s.tweens.add({ targets: this.rays, angle: 360, duration: 9000, repeat: -1 });
    s.tweens.add({ targets: this.heroImg, scale: 9, duration: 420, ease: 'Back.easeOut' });

    this.title.setAlpha(1);
    this.rarityText.setText(RARITY_NAMES[h.rarity]).setColor(RARITY_TEXT[h.rarity]).setScale(0.5);
    fit(this.nameText.setText(h.name), W - 120);
    this.roleText.setText(`${ROLES[h.role].name} · Rank ${BALANCE.ranks[h.rank].name} · Poder ${statsOf(h).power}`)
      .setColor(RANK_TEXT[h.rank]);
    this.teamText.setText(STR.joinedTeam(h.team)).setColor(h.team === null ? TXT.bad : TXT.good);
    s.tweens.add({ targets: this.rarityText, alpha: 1, scale: 1, duration: 300, delay: 250, ease: 'Back.easeOut' });
    s.tweens.add({ targets: [this.nameText, this.roleText, this.teamText], alpha: 1, duration: 300, delay: 450 });

    s.time.delayedCall(600, () => {
      this.continueBtn.setVisible(true);
      this.againBtn.setVisible(economy.cages > 0).setLabel(STR.summonAgain(economy.cages));
    });
  }

  finish(again) {
    this.scene.tweens.killTweensOf(this.rays);
    this.close();
    if (again) this.scene.time.delayedCall(160, () => this.onAgain());
  }
}
