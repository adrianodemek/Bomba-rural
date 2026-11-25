// Arte 32 px: carrega os PNGs, ajusta o tamanho lógico das texturas e cria as animações.
import { HD_MANIFEST, HD_ANIMS, HD_HEROES, HD_GROUPS, HD_PAINTED } from '../config/hdArt.js';

// Cenários e objetos pintados à mão: filtro suave (a arte em pixel continua nítida, sem suavizar).
const PAINTED = new Set(HD_PAINTED || []);
function smoothPainted(scene, keys) {
  for (const k of keys) if (PAINTED.has(k) && scene.textures.exists(k)) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
}
import { ASSET_MANIFEST } from '../config/assets.js';

// O quadro do PNG em 32 px passa a "medir" o tamanho da arte antiga (16 px por tile).
// As coordenadas da textura continuam cobrindo a imagem toda, então ela aparece com o dobro de detalhe.
export function fitFrame(texture, lw, lh, pivotY, f = texture.get()) {
  f.cutWidth = lw; f.cutHeight = lh;
  f.width = lw; f.height = lh;
  f.halfWidth = lw / 2; f.halfHeight = lh / 2;
  f.centerX = lw / 2; f.centerY = lh / 2;
  const d = f.data;
  d.cut.w = lw; d.cut.h = lh; d.cut.r = lw; d.cut.b = lh;
  d.sourceSize.w = lw; d.sourceSize.h = lh;
  d.spriteSourceSize.w = lw; d.spriteSourceSize.h = lh;
  if (pivotY !== 0.5) {
    f.customPivot = true;
    f.pivotX = 0.5;
    f.pivotY = pivotY;
  }
  texture.customData = texture.customData || {};
  texture.customData.hd = true;
}

// Arte trocada pelo manifesto (assets/) tem prioridade sobre a arte 32 px.
const custom = new Set(ASSET_MANIFEST.filter((a) => a.file).map((a) => a.key));

// Cada cenário (mundo_zona) é um grupo de arquivos. No início só vem o cenário atual;
// os outros carregam em segundo plano (ou na hora, se o jogador chegar antes).
const grouped = new Set(Object.values(HD_GROUPS || {}).flat());
const MANIFEST = new Map(HD_MANIFEST.map((m) => [m[0], m]));
const loaded = new Set();
let hdEnabled = false;

export function loadHd(scene, firstGroup) {
  // O ajuste de tamanho só funciona no WebGL; no modo Canvas fica a arte antiga.
  scene.hdOn = scene.sys.game.renderer.type === Phaser.WEBGL;
  hdEnabled = scene.hdOn;
  if (!scene.hdOn) return;
  const first = new Set(HD_GROUPS?.[firstGroup] || []);
  for (const m of HD_MANIFEST) {
    const key = m[0];
    if (custom.has(key) || (grouped.has(key) && !first.has(key))) continue;
    loadEntry(scene, m);
  }
  if (first.size) loaded.add(firstGroup);
  // Folhas-base das 4 classes × 5 raridades; as outras cores de pele/cabelo saem delas sob demanda.
  for (const role of HD_HEROES.roles) {
    for (const r of sheetsOf(role)) scene.load.image(baseKey(role, r), `assets/hd/${baseKey(role, r)}.png`);
  }
}

// ---------- Heróis ----------
// Cada classe tem a sua figura (Demolidor, Engenheiro, Extrator, Técnico); a raridade muda a intensidade da cor e os extras.
const ROLES = new Set(HD_HEROES.roles);
const roleOf = (h) => (ROLES.has(h.role) ? h.role : HD_HEROES.roles[0]);
const baseKey = (role, r) => `hc_${role}_r${r}`;
// Raridades com folha própria (a classe pintada à mão pode ter só a r0; as outras raridades usam ela).
function sheetsOf(role) { return HD_HEROES.sheets?.[role] || Array.from({ length: HD_HEROES.rarities }, (_, i) => i); }
const sheetRarity = (role, r) => (sheetsOf(role).includes(r) ? r : 0);
// Classes com folha pintada à mão: sem troca de cor de pele/cabelo e sem cópia da folha — o herói usa a folha
// carregada direto (hc_<classe>_r<N>), uma só na memória para todas as variações.
const paintedRoles = new Set();
export const heroKey = (h) => {
  const role = roleOf(h);
  if (paintedRoles.has(role)) return baseKey(role, sheetRarity(role, h.rarity || 0));
  return `hero_${role}_p${h.palette || 0}_r${h.rarity || 0}`;
};
export const heroAnim = (h, name) => `${heroKey(h)}_${name}`;

// Monta (uma vez) a folha do herói: copia a folha-base, troca as cores de pele/cabelo/olhos
// pela variação dele, recorta os quadros e cria as animações.
function buildHero(scene, h) {
  const key = heroKey(h);
  const H = HD_HEROES;
  if (paintedRoles.has(roleOf(h))) return setupPainted(scene, key);
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.exists(baseKey(roleOf(h), h.rarity || 0)) && scene.textures.get(baseKey(roleOf(h), h.rarity || 0)).getSourceImage();
  if (!src || !src.width) return null;
  // Folha pintada à mão (quadros maiores que os de pixel art): desenha com filtro suave e sem troca de cores de pixel.
  const fw = Math.round(src.width / H.frames), fh = src.height;
  const painted = fw > H.fw;
  const map = painted ? [] : H.recolor[h.palette || 0] || [];
  const canvas = document.createElement('canvas');
  canvas.width = src.width; canvas.height = src.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  if (map.length) {
    const lut = new Map(map);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const to = lut.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (to !== undefined) { d[i] = to >> 16; d[i + 1] = (to >> 8) & 255; d[i + 2] = to & 255; }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = scene.textures.addCanvas(key, canvas);
  tex.setFilter(painted ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
  for (let i = 0; i < H.frames; i++) {
    tex.add(i, 0, i * fw, 0, fw, fh);
    fitFrame(tex, H.lw, H.lh, H.pivot, tex.get(i));
  }
  for (const [name, [start, count, rate, order]] of Object.entries(H.anims)) {
    const ids = order ? order.map((i) => start + i) : Array.from({ length: count }, (_, i) => start + i);
    scene.anims.create({ key: `${key}_${name}`, frames: ids.map((frame) => ({ key, frame })), frameRate: rate, repeat: name === 'plant' ? 0 : -1 });
  }
  return key;
}

// Folha pintada à mão: recorta os quadros e cria as animações na própria textura carregada (uma vez).
function setupPainted(scene, key) {
  if (!scene.textures.exists(key)) return null;
  const tex = scene.textures.get(key);
  if (tex.has(0)) return key;
  const H = HD_HEROES;
  const src = tex.getSourceImage();
  const fw = Math.round(src.width / H.frames), fh = src.height;
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (let i = 0; i < H.frames; i++) {
    tex.add(i, 0, i * fw, 0, fw, fh);
    fitFrame(tex, H.lw, H.lh, H.pivot, tex.get(i));
  }
  for (const [name, [start, count, rate, order]] of Object.entries(H.anims)) {
    const ids = order ? order.map((i) => start + i) : Array.from({ length: count }, (_, i) => start + i);
    if (!scene.anims.exists(`${key}_${name}`)) scene.anims.create({ key: `${key}_${name}`, frames: ids.map((frame) => ({ key, frame })), frameRate: rate, repeat: name === 'plant' ? 0 : -1 });
  }
  return key;
}

// Folha do herói, ou null se não carregou (aí usa a arte antiga).
export function heroSheet(scene, h) {
  return hdEnabled ? buildHero(scene, h) : null;
}

// Retrato do herói em qualquer imagem da interface. Se for um Sprite, ele fica respirando
// (animação 'idle') enquanto está na tela; cada retrato começa num ponto diferente do ciclo.
export function setHeroPortrait(img, h) {
  const key = heroSheet(img.scene, h);
  if (key) {
    // O desenho ocupa só o meio do quadro: amplia um pouco os retratos (sem acumular a cada atualização).
    if (img.heroBaseScale === undefined) img.heroBaseScale = img.scaleX;
    const anim = heroAnim(h, 'idle');
    if (img.play && !img.portraitOrigin) {
      // Cada quadro da folha traz o pivô dos pés (para o campo) e a animação o reaplica a cada troca;
      // no retrato a origem fica travada no meio do corpo.
      const base = img.setOrigin;
      img.setOrigin = function (x, y) { return this.portraitOrigin ? base.call(this, ...this.portraitOrigin) : base.call(this, x, y); };
    }
    if (img.play) img.portraitOrigin = [0.5, 0.55];
    if (img.play && img.scene.anims.exists(anim)) {
      // Já animando este mesmo herói (respirando ou comemorando)? Deixa seguir.
      if (!img.anims.isPlaying || !img.anims.currentAnim?.key.startsWith(heroAnim(h, ''))) {
        img.setTexture(key, HD_HEROES.idleFrame);
        img.play({ key: anim, startFrame: Math.floor(Math.random() * 8) });
      }
    } else img.setTexture(key, HD_HEROES.idleFrame);
    img.setOrigin(0.5, 0.55);
    if (img.heroBaseScale > 0) img.setScale(img.heroBaseScale * 1.3);
  } else {
    if (img.anims) { img.stop(); img.portraitOrigin = null; }
    img.setTexture(`hero${h.palette}_down_0`).setOrigin(0.5);
  }
  return img;
}

export function setupHd(scene) {
  if (!scene.hdOn) return;
  for (const role of HD_HEROES.roles) {
    const k = baseKey(role, 0);
    const w = scene.textures.exists(k) && scene.textures.get(k).getSourceImage().width;
    if (w && w / HD_HEROES.frames > HD_HEROES.fw) paintedRoles.add(role);
  }
  for (const m of HD_MANIFEST) {
    if (custom.has(m[0]) || !scene.textures.exists(m[0])) continue;
    fitEntry(scene, m);
  }
  smoothPainted(scene, PAINTED);
  createAnims(scene);
}

// Tamanho lógico de uma entrada do manifesto; folha com quadros (m[4] = largura do quadro) ajusta todos eles.
function fitEntry(scene, [key, lw, lh, pivotY, fw]) {
  if (!lw) return;
  const tex = scene.textures.get(key);
  if (!fw) { fitFrame(tex, lw, lh, pivotY); return; }
  for (const name of tex.getFrameNames()) fitFrame(tex, lw, lh, pivotY, tex.get(name));
}

export const isHd = (scene, key) => !!scene.textures.get(key)?.customData?.hd;

// Sprite já no primeiro quadro de uma animação (serve para tiras e quadros soltos).
export function animSprite(scene, x, y, animKey) {
  const f = scene.anims.get(animKey).frames[0].frame;
  return scene.add.sprite(x, y, f.texture.key, f.name);
}

// Imagem simples ou tira de animação (m[4], m[5] = largura e altura de cada quadro).
function loadEntry(scene, m, as = m[0]) {
  const [key, , , , fw, fh] = m;
  if (fw) scene.load.spritesheet(as, `assets/hd/${key}.png`, { frameWidth: fw, frameHeight: fh });
  else scene.load.image(as, `assets/hd/${key}.png`);
}

// Já existe só a arte provisória (16 px) com este nome? Então a 48 px precisa entrar no lugar dela.
const isLegacy = (scene, k) => scene.textures.exists(k) && !!scene.textures.get(k).customData?.legacy;

const frameKey = (f) => (Array.isArray(f) ? f[0] : f);
const frameDef = (f) => (Array.isArray(f) ? { key: f[0], frame: f[1] } : { key: f });

// ---------- Cenários sob demanda ----------
export const groupLoaded = (g) => !hdEnabled || !HD_GROUPS?.[g] || loaded.has(g);

const queue = [];          // grupos esperando, o primeiro é o próximo
const waiters = new Map(); // grupo → callbacks
let busy = false;

// Garante que o grupo esteja carregado; cb() roda quando estiver (na hora, se já está).
export function ensureGroup(scene, g, cb) {
  if (groupLoaded(g)) { cb?.(); return; }
  if (cb) waiters.set(g, [...(waiters.get(g) || []), cb]);
  const i = queue.indexOf(g);
  if (i > 0) queue.splice(i, 1);
  if (i !== 0) queue.unshift(g);
  pump(scene);
}

// Carrega os outros cenários aos poucos, um de cada vez, começando pelos mais próximos.
export function prefetchGroups(scene, order) {
  for (const g of order) if (!groupLoaded(g) && !queue.includes(g)) queue.push(g);
  pump(scene);
}

function pump(scene) {
  if (busy || !queue.length || !scene.sys.isActive()) return;
  const g = queue[0];
  // As do mesmo nome da arte provisória (rock_wN, tree_wN da 3ª zona) carregam com outro nome e trocam no fim:
  // antes, a provisória (árvore verde, pedra simples) bloqueava a 48 px e ficava para sempre.
  const keys = (HD_GROUPS[g] || []).filter((k) => !custom.has(k) && (!scene.textures.exists(k) || isLegacy(scene, k)));
  const swap = keys.filter((k) => isLegacy(scene, k));
  busy = true;
  const done = () => {
    busy = false;
    queue.shift();
    const swapped = new Set();
    for (const k of swap) {
      if (!scene.textures.exists(`${k}@hd`)) continue;
      const old = scene.textures.get(k);
      scene.textures.renameTexture(k, `${k}@old`);
      scene.textures.renameTexture(`${k}@hd`, k);
      swapped.add(old);
    }
    for (const k of HD_GROUPS[g] || []) {
      const m = MANIFEST.get(k);
      if (m && scene.textures.exists(k) && !scene.textures.get(k).customData?.hd) fitEntry(scene, m);
    }
    if (swapped.size) {
      // Quem ainda mostra a provisória passa para a nova; depois a provisória sai da memória.
      const walk = (list) => list.forEach((o) => {
        if (o.list) walk(o.list);
        if (o.texture && swapped.has(o.texture)) {
          const fk = o.texture.key.replace('@old', '');
          o.setTexture(fk);
        }
      });
      walk(scene.children.list);
      swapped.forEach((t) => scene.textures.remove(t));
    }
    smoothPainted(scene, HD_GROUPS[g] || []);
    createAnims(scene);
    loaded.add(g);
    const cbs = waiters.get(g) || [];
    waiters.delete(g);
    cbs.forEach((f) => f());
    scene.time.delayedCall(queue.length && waiters.size ? 0 : 400, () => pump(scene));
  };
  if (!keys.length) { done(); return; }
  for (const k of keys) loadEntry(scene, MANIFEST.get(k) || [k], swap.includes(k) ? `${k}@hd` : k);
  scene.load.once('complete', done);
  scene.load.start();
}

// Libera da memória os cenários longe de onde o jogador está (mapa, água, objetos e animações deles).
// Sem isso, cada mundo visitado ficava na memória até fechar o jogo; no celular a aba podia fechar sozinha.
export function releaseGroups(scene, keep) {
  if (!hdEnabled) return;
  for (const g of [...loaded]) {
    if (keep.has(g) || g.startsWith('trails_') || !HD_GROUPS?.[g]) continue;
    const keys = new Set(HD_GROUPS[g].filter((k) => !custom.has(k)));
    for (const a of HD_ANIMS) {
      if (scene.anims.exists(a.key) && a.frames.some((f) => keys.has(frameKey(f)))) scene.anims.remove(a.key);
    }
    keys.forEach((k) => { if (scene.textures.exists(k)) scene.textures.remove(k); });
    loaded.delete(g);
  }
}

function createAnims(scene) {
  for (const a of HD_ANIMS) {
    if (scene.anims.exists(a.key) || !a.frames.every((f) => scene.textures.exists(frameKey(f)))) continue;
    scene.anims.create({ key: a.key, frames: a.frames.map(frameDef), frameRate: a.rate, repeat: a.repeat ?? -1 });
  }
}
