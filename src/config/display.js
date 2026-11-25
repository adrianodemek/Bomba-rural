// Resolução de desenho: o jogo pensa em 720×1600 e desenha em 720×1600 × RES.
// RES acompanha os pixels reais da tela (até 2): desenhar mais pixels do que a tela mostra só gasta memória
// (no celular, faltar memória faz o navegador fechar a aba). Celular com pouca memória usa um pouco menos.
import { BALANCE } from './balance.js';

function pickRes() {
  try {
    const dpr = window.devicePixelRatio || 1;
    const tall = Math.max(window.screen?.height || 0, window.screen?.width || 0, window.innerHeight || 0) * dpr;
    let r = Math.round((tall / BALANCE.screen.height) * 4) / 4;   // em passos de 0,25
    r = Math.min(2, Math.max(1, r || 2));
    const mem = navigator.deviceMemory;                            // GB (Chrome/Android; no iPhone não existe)
    if (mem && mem <= 2) r = Math.min(r, 1.25);
    else if (mem && mem <= 4) r = Math.min(r, 1.5);
    return r;
  } catch (e) {
    return 2;
  }
}

export const RES = pickRes();

// Câmera de cada cena: zoom RES centrado na área do jogo.
export function setupCamera(scene) {
  scene.cameras.main.setZoom(RES).centerOn(BALANCE.screen.width / 2, BALANCE.screen.height / 2);
}

// Todos os textos nascem na resolução RES (senão ficariam borrados com o zoom).
const factory = Phaser.GameObjects.GameObjectFactory.prototype;
const originalText = factory.text;
factory.text = function text(x, y, value, style) {
  return originalText.call(this, x, y, value, { resolution: RES, ...(style || {}) });
};
