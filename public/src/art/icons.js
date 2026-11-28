// Ícones ilustrados: uma folha só (assets/icons/icons.png) com moeda, joias, gaiolas, abas, itens etc.
// Depois que a arte gerada por código existe, cada ícone da folha vira uma textura com o mesmo nome
// e o mesmo tamanho lógico da antiga (então setScale e posições continuam valendo), mas com o
// desenho em alta resolução e suavizado (filtro linear, não pixel art).
import { ICON_SHEET, ICON_FRAMES, ICON_SIZES } from '../config/iconArt.js';
import { PAINTED_SHEET, PAINTED_FRAMES, PAINTED_SIZES } from '../config/iconPainted.js';
import { EX_ART, EX_CELL } from '../config/exclusiveArt.js';
import { SLOT_IDS } from '../data/items.js';
import { fitFrame } from './hd.js';

const SHEET = 'icon_sheet';
const PAINTED = 'icon_sheet_painted';   // ícones da interface pintados (ChatGPT): têm prioridade

export function loadIcons(scene) {
  if (scene.sys.game.renderer.type !== Phaser.WEBGL) return; // o ajuste de tamanho só funciona no WebGL
  scene.load.image(SHEET, ICON_SHEET);
  scene.load.image(PAINTED, PAINTED_SHEET);
  // Equipamentos exclusivos: uma folha 3 × 3 por classe e raridade (só as que já têm arte).
  for (const k of EX_ART) scene.load.image(`ex_sheet_${k}`, `assets/icons/ex_${k}.png`);
}

export function setupIcons(scene) {
  cutSheet(scene, SHEET, ICON_FRAMES, ICON_SIZES);
  cutSheet(scene, PAINTED, PAINTED_FRAMES, { ...ICON_SIZES, ...PAINTED_SIZES });
  // Mesmo tamanho lógico dos ícones de item comuns (as telas usam a mesma escala).
  const itemSize = scene.textures.exists('item_weapon_0') ? scene.textures.get('item_weapon_0').get().width : 16;
  for (const k of EX_ART) {
    const [cls, r] = k.split('_');
    const frames = {};
    SLOT_IDS.forEach((slot, i) => { frames[`ex_${cls}_${slot}_${r}`] = [(i % 3) * (EX_CELL + 2), Math.floor(i / 3) * (EX_CELL + 2), EX_CELL, EX_CELL]; });
    const sizes = Object.fromEntries(Object.keys(frames).map((key) => [key, itemSize]));
    cutSheet(scene, `ex_sheet_${k}`, frames, sizes);
  }
  // Espaço vazio do equipamento: silhueta apagada da peça comum pintada (no lugar do ícone antigo).
  if (EX_ART.includes('common_0')) {
    for (const slot of SLOT_IDS) {
      const key = `item_${slot}_empty`;
      const srcKey = `ex_common_${slot}_0`;
      if (!scene.textures.exists(srcKey)) continue;
      const lw = scene.textures.exists(key) ? scene.textures.get(key).get().width : itemSize;
      const src = scene.textures.get(srcKey).getSourceImage();
      const cv = document.createElement('canvas');
      cv.width = src.width; cv.height = src.height;
      const g = cv.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = 'rgba(190, 150, 240, 0.22)';
      g.fillRect(0, 0, cv.width, cv.height);
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.addCanvas(key, cv);
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      fitFrame(tex, lw, lw, 0.5);
    }
  }
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
