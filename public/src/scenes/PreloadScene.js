// Carrega PNGs do manifesto (se houver), a arte 32 px e gera o resto da arte por código.
import { ASSET_MANIFEST } from '../config/assets.js';
import { loadHd, setupHd } from '../art/hd.js';
import { generateAllTextures, createAnimations } from '../art/sprites.js';
import { loadIcons, setupIcons } from '../art/icons.js';
import { economy } from '../systems/Economy.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    for (const a of ASSET_MANIFEST) {
      if (a.file) this.load.image(a.key, `assets/${a.file}`);
    }
    loadHd(this, economy.arenaScene);
    loadIcons(this);
    this.load.on('loaderror', (file) => console.warn('Arte não encontrada, usando a gerada:', file.key));
  }

  create() {
    setupHd(this);
    generateAllTextures(this);
    setupIcons(this);
    createAnimations(this);
    // Sem a folha pintada (modo Canvas): os ícones novos usam um parecido da arte antiga.
    for (const [key, alt] of [['essence', 'star'], ['icon_ranking', 'icon_trophy'], ['icon_clan', 'icon_trophy']]) {
      if (this.textures.exists(key) || !this.textures.exists(alt)) continue;
      const src = this.textures.get(alt).getSourceImage();
      if (src instanceof HTMLCanvasElement) this.textures.addCanvas(key, src);
      else this.textures.addImage(key, src);
    }
    this.scene.start('Battle');
  }
}
