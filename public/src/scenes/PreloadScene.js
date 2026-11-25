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
    this.scene.start('Battle');
  }
}
