/*
  Manifesto de arte.

  Todas as texturas do jogo são geradas por código (src/art/sprites.js).
  Para trocar por arte sua, coloque o PNG em assets/ e preencha "file" com o nome do arquivo.
  O jogo carrega o PNG e pula a versão gerada daquela chave.

  Tamanhos (a arte é desenhada pequena e mostrada em escala 3×):
  - Objetos, heróis, bomba, explosão, chão, bloco: 16×16 px
  - Moeda, cristal, chave, minério (ore_*), cadeado, estrela e ícones de papel (role_*): 8×8 px
  - Gaiola (cage, cage_open): 16×16 px
  - Ícones das abas e engrenagem: 12×12 px
  - Rachaduras (crack_1, crack_2): 16×16 px, fundo transparente

  Heróis: uma imagem por quadro.
    hero{N}_{down|up|side}_{0|1}
    N = 0 a 7 (uma por cor de corpo, ver PALETTES em src/data/heroes.js); "side" olha para a DIREITA (o jogo espelha para a esquerda);
    quadros 0 e 1 alternam na caminhada.
  Bomba: bomb_0, bomb_1 (pisca durante o pavio).
  Explosão: boom_0 … boom_3 (em ordem).
*/
const heroKeys = [];
for (let n = 0; n < 8; n++) {
  for (const dir of ['down', 'up', 'side']) {
    for (const f of [0, 1]) heroKeys.push(`hero${n}_${dir}_${f}`);
  }
}

// Por mundo (W = 0 a 4): floor_wW_0, floor_wW_1, pillar_wW, rock_wW, vein_wW, tree_wW, o minério ore_W
// e o Chefe Cristal boss_wW (16×16, mostrado em escala 6, ocupa visualmente 2×2 tiles).
const worldKeys = [];
for (let w = 0; w < 5; w++) {
  worldKeys.push(`floor_w${w}_0`, `floor_w${w}_1`, `pillar_w${w}`, `rock_w${w}`, `vein_w${w}`, `tree_w${w}`, `ore_${w}`, `boss_w${w}`);
}

// Itens: item_SLOT_R (R = raridade 0 a 4) e item_SLOT_empty; SLOT = weapon, gloves, helm, armor, pants, boots, ring, necklace, flask.
// Gemas (8×8): gem_TIPO e gem_empty; TIPO = ruby, sapphire, quartz, emerald, tourmaline, topaz, onyx, aquamarine. 12×12 px.
const itemKeys = ['sealed', 'gem_empty', ...['ruby', 'sapphire', 'quartz', 'emerald', 'tourmaline', 'topaz', 'onyx', 'aquamarine'].map((g) => `gem_${g}`)];
for (const slot of ['weapon', 'gloves', 'helm', 'armor', 'pants', 'boots', 'ring', 'necklace', 'flask']) {
  for (let r = 0; r < 5; r++) itemKeys.push(`item_${slot}_${r}`);
  itemKeys.push(`item_${slot}_empty`);
}

export const ASSET_MANIFEST = [
  ...worldKeys,
  ...itemKeys,
  'chest', 'key',
  'crack_1', 'crack_2',
  'bomb_0', 'bomb_1',
  'boom_0', 'boom_1', 'boom_2', 'boom_3',
  'coin', 'crystal', 'cage', 'cage_open', 'star', 'star_empty', 'debris', 'spark',
  'role_attacker', 'role_support', 'role_collector', 'role_specialist',
  'icon_forge', 'icon_skills', 'icon_map', 'icon_house', 'icon_bag', 'icon_market', 'icon_lock', 'icon_gear', 'icon_trophy',
  ...heroKeys,
].map((key) => ({ key, file: null })); // ex.: { key: 'rock', file: 'rock.png' }
