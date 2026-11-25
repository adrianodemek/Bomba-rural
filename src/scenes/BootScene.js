// Primeira cena: ajustes gerais e segue para o carregamento.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.input.addPointer(1); // multitoque básico
    this.scene.start('Preload');
  }
}
