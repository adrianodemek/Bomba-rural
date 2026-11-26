// Ícones ilustrados: uma folha só (assets/icons/icons.png) com moeda, joias, gaiolas, abas, itens etc.
// Depois que a arte gerada por código existe, cada ícone da folha vira uma textura com o mesmo nome
// e o mesmo tamanho lógico da antiga (então setScale e posições continuam valendo), mas com o
// desenho em alta resolução e suavizado (filtro linear, não pixel art).
import { ICON_SHEET, ICON_FRAMES, ICON_SIZES } from '../config/iconArt.js';
import { PAINTED_SHEET, PAINTED_FRAMES, PAINTED_SIZES } from '../config/iconPainted.js';
import { fitFrame } from './hd.js';

const SHEET = 'icon_sheet';
const PAINTED = 'icon_sheet_painted';   // ícones da interface pintados (ChatGPT): têm prioridade

export function loadIcons(scene) {
  if (scene.sys.game.renderer.type !== Phaser.WEBGL) return; // o ajuste de tamanho só funciona no WebGL
  scene.load.image(SHEET, ICON_SHEET);
  scene.load.image(PAINTED, PAINTED_SHEET);
}

export function setupIcons(scene) {
  cutSheet(scene, SHEET, ICON_FRAMES, ICON_SIZES);
  cutSheet(scene, PAINTED, PAINTED_FRAMES, { ...ICON_SIZES, ...PAINTED_SIZES });
}

// Recorta cada ícone da folha numa textura própria com o nome do ícone, no tamanho lógico da arte antiga.
function cutSheet(scene, sheet, frames, sizes) {
  if (!scene.textures.exists(sheet)) return;
  const src = scene.textures.get(sheet).getSourceImage();
  for (const [key, [x, y, w, h]] of Object.entries(frames)) {
    let lw = sizes[key] || 8, lh = lw;
    if (scene.textures.exists(key)) {
      const f = scene.textures.get(key).get();
      lw = f.width; lh = f.height;
      scene.textures.remove(key);
    }
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
    const tex = scene.textures.addCanvas(key, cv);
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    fitFrame(tex, lw, lh, 0.5);
  }
  scene.textures.remove(sheet); // libera a folha inteira da memória de vídeo
}
