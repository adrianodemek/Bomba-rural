// Sala ilustrada (Ritual, Mercado, Casa): fundo em pixel art, efeito animado, personagem e luzes piscando.
import { HD_ROOMS } from '../config/hdArt.js';
import { animSprite } from '../art/hd.js';

export class RoomView extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.parts = [];
    this.name = null;
    scene.add.existing(this);
  }

  // Troca a sala mostrada. Retorna false se a arte não existe (modo Canvas): aí fica vazio.
  setRoom(name) {
    if (this.name === name) return true;
    this.name = name;
    this.parts.forEach((p) => { this.scene.tweens.killTweensOf(p); p.destroy(); });
    this.parts = [];
    const r = HD_ROOMS?.[name];
    const s = this.scene;
    if (!r || !s.textures.exists(r.key)) return false;
    const add = (o) => { this.add(o); this.parts.push(o); return o; };
    add(s.add.image(0, 0, r.key).setOrigin(0));
    if (r.fx && s.anims.exists(r.fx.anim)) add(animSprite(s, r.fx.x, r.fx.y, r.fx.anim).setOrigin(0).play(r.fx.anim));
    if (r.npc && s.anims.exists(r.npc.anim)) {
      this.npc = add(animSprite(s, r.npc.x, r.npc.y, r.npc.anim).setOrigin(0).play(r.npc.anim));
    } else this.npc = null;
    if (r.fg && s.textures.exists(r.fg.key)) add(s.add.image(r.fg.x, r.fg.y, r.fg.key).setOrigin(0));
    (r.lamps || []).forEach(([lx, ly, rad, tint], i) => {
      const g = add(s.add.image(lx, ly, 'fx_glow').setScale(rad / 16).setTint(tint).setAlpha(0.75)
        .setBlendMode(Phaser.BlendModes.ADD));
      s.tweens.add({ targets: g, alpha: 0.5, duration: 160 + i * 37, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
    });
    this.info = r;
    return true;
  }

  // Pulinho do personagem (ao forjar, combinar...).
  cheer() {
    if (!this.npc) return;
    const y = this.info.npc.y;
    this.scene.tweens.killTweensOf(this.npc);
    this.npc.y = y;
    this.scene.tweens.add({ targets: this.npc, y: y - 14, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }

  get width() { return this.info?.w ?? 672; }
  get height() { return this.info?.h ?? 360; }
}
