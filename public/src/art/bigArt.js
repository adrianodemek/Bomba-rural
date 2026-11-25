// Artes grandes (janelas e salas ilustradas, 10–17 MB cada na memória de vídeo): ficam na memória só
// enquanto a tela delas está aberta. Ao fechar, a imagem passa a usar uma textura vazia e a grande sai;
// ao abrir de novo, ela volta do cache do navegador (rápido) e a imagem retoma o tamanho certo.

export function freeArt(scene, key, img) {
  if (!scene.textures.exists(key)) return;
  if (img && img.texture?.key === key) img.setTexture('__DEFAULT');
  scene.textures.remove(key);
}

// Devolve true se já estava pronta; senão carrega e chama done() quando chegar.
export function restoreArt(scene, key, url, img, w, h, done) {
  const apply = () => {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (img && img.texture?.key !== key) img.setTexture(key).setDisplaySize(w, h);
    done?.();
  };
  if (scene.textures.exists(key)) { apply(); return true; }
  scene.load.image(key, url);
  scene.load.once(`filecomplete-image-${key}`, apply);
  scene.load.start();
  return false;
}
