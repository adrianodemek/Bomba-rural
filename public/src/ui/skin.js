// Pele da interface — tema Imperial: roxo profundo, moldura dupla dourada, arabescos nos cantos e botões com relevo.
// Cada estilo (cor do fundo, cor/espessura da borda) vira UMA textura pequena desenhada aqui no navegador, em 2× de
// detalhe, e o cartão de qualquer tamanho é montado com nine-slice (os cantos não esticam). Assim a memória fica
// pequena mesmo com centenas de cartões, e tudo fica nítido no celular.
import { COL } from '../config/theme.js';

const S = 2;                 // detalhe das texturas (2 px de textura por px do jogo)
const PLAIN = { size: 24, cut: 9 };    // cartão comum: textura 24×24 (px do jogo), cantos de 9
const THIN = { size: 12, cut: 4 };     // peças finas (menos de 26 px de altura ou largura)
const THIN_MAX = 26;
const ORNATE = { size: 64, cut: 28 };  // cartão grande: cantos de 28 com arabesco
const ORNATE_MIN_W = 140, ORNATE_MIN_H = 70;

// ---------- cores ----------
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lit = ([r, g, b], t) => [r + (255 - r) * t, g + (255 - g) * t, b + (235 - b) * t];
const drk = ([r, g, b], t) => [r * (1 - t), g * (1 - t), b * (1 - t * 0.7)];
const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const INK = [14, 7, 22];
const GOLD_LIGHT = [255, 242, 176], GOLD = [224, 168, 48], GOLD_DARK = [138, 90, 16];
export const luminance = (c) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

// Arabesco dourado no canto de cima à esquerda (o de baixo à direita é o mesmo girado).
function arabesque(ctx, u) {
  const g = ctx.createLinearGradient(0, 0, 22 * u, 22 * u);
  g.addColorStop(0, css(GOLD_LIGHT)); g.addColorStop(0.5, css(GOLD)); g.addColorStop(1, css(GOLD_DARK));
  ctx.strokeStyle = g; ctx.fillStyle = g; ctx.lineCap = 'round';
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath(); ctx.moveTo(2 * u, 22 * u); ctx.lineTo(2 * u, 7 * u); ctx.quadraticCurveTo(2 * u, 2 * u, 7 * u, 2 * u); ctx.lineTo(22 * u, 2 * u); ctx.stroke();
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath(); ctx.moveTo(5.5 * u, 17 * u); ctx.quadraticCurveTo(5.5 * u, 5.5 * u, 17 * u, 5.5 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10 * u, 2.6 * u); ctx.quadraticCurveTo(12.5 * u, 7 * u, 16.5 * u, 4 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2.6 * u, 10 * u); ctx.quadraticCurveTo(7 * u, 12.5 * u, 4 * u, 16.5 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6 * u, 3 * u); ctx.lineTo(8.5 * u, 5.5 * u); ctx.lineTo(6 * u, 8 * u); ctx.lineTo(3.5 * u, 5.5 * u); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(19.5 * u, 2 * u, 1.1 * u, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2 * u, 19.5 * u, 1.1 * u, 0, Math.PI * 2); ctx.fill();
}

// Cartão / moldura. w, h em px de textura; u = px de textura por px do jogo.
function paintCard(ctx, w, h, o, u, ornate, thin) {
  const fill = o.fill == null ? null : rgb(o.fill);
  const st = o.stroke == null ? null : rgb(o.stroke);
  const r = 5 * u;
  if (thin) {   // peça fina (barras, filetes): só fundo e um filete dourado
    const r2 = 3 * u;
    if (fill && o.fa > 0) {
      ctx.globalAlpha = o.fa; rr(ctx, 0, 0, w, h, r2);
      ctx.fillStyle = vgrad(ctx, 0, h, [[0, css(drk(fill, 0.2))], [1, css(lit(fill, 0.06))]]); ctx.fill();
    }
    if (st) {
      ctx.globalAlpha = o.sa; rr(ctx, 0.6 * u, 0.6 * u, w - 1.2 * u, h - 1.2 * u, r2);
      ctx.strokeStyle = css(st); ctx.lineWidth = 1.2 * u; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (st) {
    const bw = (o.sw >= 5 ? 2.6 : o.sw >= 4 ? 2.2 : 1.8) * u;
    // filete de fora (moldura dupla) + vão escuro
    // (só um anel: o meio fica transparente quando o cartão não tem fundo, ex.: molduras de janelas de vista)
    ctx.globalAlpha = o.sa;
    rr(ctx, 1.7 * u, 1.7 * u, w - 3.4 * u, h - 3.4 * u, r + 0.5 * u);
    ctx.strokeStyle = css(INK, 0.95); ctx.lineWidth = 2.6 * u; ctx.stroke();
    rr(ctx, 0.5 * u, 0.5 * u, w - u, h - u, r + u);
    ctx.strokeStyle = css(lit(st, 0.25), 0.55); ctx.lineWidth = 0.9 * u; ctx.stroke();
    // fundo
    const inset = 3 * u;
    if (fill && o.fa > 0) {
      ctx.globalAlpha = o.fa;
      rr(ctx, inset, inset, w - 2 * inset, h - 2 * inset, r);
      ctx.fillStyle = vgrad(ctx, inset, h - inset, [[0, css(lit(fill, 0.1))], [0.45, css(fill)], [1, css(drk(fill, 0.28))]]);
      ctx.fill();
      ctx.globalAlpha = o.fa * 0.5;
      ctx.fillStyle = 'rgba(255,240,210,0.07)';
      rr(ctx, inset + bw, inset + bw, w - 2 * (inset + bw), Math.min(h * 0.45, 40 * u), r * 0.7); ctx.fill();
    }
    // borda dourada principal
    ctx.globalAlpha = o.sa;
    rr(ctx, inset + bw / 2, inset + bw / 2, w - 2 * inset - bw, h - 2 * inset - bw, r);
    ctx.strokeStyle = vgrad(ctx, inset, h - inset, [[0, css(lit(st, 0.4))], [0.5, css(st)], [1, css(drk(st, 0.35))]]);
    ctx.lineWidth = bw; ctx.stroke();
    if (ornate) {
      ctx.globalAlpha = o.sa;
      ctx.save(); ctx.translate(inset - 0.5 * u, inset - 0.5 * u); arabesque(ctx, u); ctx.restore();
      ctx.save(); ctx.translate(w - inset + 0.5 * u, h - inset + 0.5 * u); ctx.rotate(Math.PI); arabesque(ctx, u); ctx.restore();
    }
  } else if (fill && o.fa > 0) {
    ctx.globalAlpha = o.fa;
    rr(ctx, 0, 0, w, h, r);
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, css(lit(fill, 0.08))], [0.5, css(fill)], [1, css(drk(fill, 0.22))]]);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Botão: aro escuro + filete dourado, face com degradê e brilho, lábio embaixo (relevo).
function paintButton(ctx, w, h, o, u) {
  const face = rgb(o.color);
  const bd = rgb(o.border);
  const r = 8 * u, lip = 3.5 * u, pad = 2.2 * u;
  rr(ctx, 0.5 * u, 0.5 * u, w - u, h - u, r + u);
  ctx.fillStyle = css(INK); ctx.fill();
  ctx.strokeStyle = css(GOLD, o.disabled ? 0.25 : 0.55); ctx.lineWidth = 0.9 * u; ctx.stroke();
  rr(ctx, pad, pad + lip * 0.4, w - 2 * pad, h - 2 * pad - lip * 0.4, r);
  ctx.fillStyle = css(drk(face, 0.6)); ctx.fill();
  const fh = h - 2 * pad - lip;
  rr(ctx, pad, pad, w - 2 * pad, fh, r);
  ctx.fillStyle = vgrad(ctx, pad, pad + fh, [[0, css(lit(face, 0.45))], [0.42, css(face)], [0.58, css(drk(face, 0.12))], [1, css(drk(face, 0.28))]]);
  ctx.fill();
  ctx.strokeStyle = css(bd); ctx.lineWidth = 1.4 * u; ctx.stroke();
  rr(ctx, pad + 3 * u, pad + 1.6 * u, w - 2 * pad - 6 * u, fh * 0.38, r * 0.6);
  ctx.fillStyle = `rgba(255,255,255,${o.disabled ? 0.05 : 0.2})`; ctx.fill();
}

function canvasTex(scene, key, tw, th, paint) {
  if (scene.textures.exists(key)) return key;
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(tw)); cv.height = Math.max(2, Math.round(th));
  paint(cv.getContext('2d'), cv.width, cv.height);
  scene.textures.addCanvas(key, cv).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}

const styleKey = (o) => `${o.fill ?? 'n'}_${(o.fa ?? 1).toFixed(2)}_${o.stroke ?? 'n'}_${o.sw || 0}_${(o.sa ?? 1).toFixed(2)}`;
// Cantos menores em peças finas (barras de progresso, filetes).
const cutFor = (T, w, h) => Math.max(1, Math.min(T.cut, Math.floor(Math.min(w, h) / 2)));
const isOrnate = (o, w, h) => o.stroke != null && o.ornate !== false && w >= ORNATE_MIN_W && h >= ORNATE_MIN_H;

// Textura nine-slice de um estilo de cartão.
function kindOf(o, w, h) {
  if (Math.min(w, h) < THIN_MAX) return 't';
  return isOrnate(o, w, h) ? 'o' : 'p';
}
const KIND = { t: THIN, p: PLAIN, o: ORNATE };
function cardTex(scene, o, kind) {
  const T = KIND[kind];
  const key = `skn_${kind}_${styleKey(o)}`;
  return canvasTex(scene, key, T.size * S, T.size * S, (ctx, w, h) => paintCard(ctx, w, h, o, S, kind === 'o', kind === 't'));
}

// Textura nine-slice de um botão.
const BTN = { w: 48, h: 40, cutX: 12, top: 12, bottom: 14 };
function buttonTex(scene, color, border, disabled) {
  const key = `skb_${color}_${border}_${disabled ? 1 : 0}`;
  return canvasTex(scene, key, BTN.w * S, BTN.h * S, (ctx, w, h) => paintButton(ctx, w, h, { color, border, disabled }, S));
}

const nineOK = (scene) => scene.sys.game.renderer.type === Phaser.WEBGL && Phaser.GameObjects.NineSlice;

// ---------- Nine-slice em 2× ----------
// A textura tem 2× de detalhe: o objeto fica com tamanho ×2 e escala ×0,5 (aparece no tamanho pedido).
// Ninguém muda a escala direto destes fundos (só a dos containers em volta), então isso fica escondido aqui.
class LogicalNine extends Phaser.GameObjects.NineSlice {
  constructor(scene, x, y, key, w, h, cut) {
    super(scene, x, y, key, null, w * S, h * S, cut.l * S, cut.r * S, cut.t * S, cut.b * S);
    this.setScale(1 / S);
  }
  setLogicalSize(w, h) { this.setSize(w * S, h * S); return this; }
}

// ---------- Cartão com a mesma API do retângulo do Phaser ----------
// Aceita setStrokeStyle / setFillStyle (troca o desenho) e resize (muda o tamanho).
class SkinNine extends LogicalNine {
  constructor(scene, x, y, w, h, fill, alpha = 1, opts = {}) {
    const o = { fill, fa: fill == null ? 0 : alpha, stroke: null, sw: 0, sa: 1, ornate: opts.ornate };
    const kind = kindOf(o, w, h);
    const key = cardTex(scene, o, kind);
    const c = cutFor(KIND[kind], w, h);
    super(scene, x, y, key, w, h, { l: c, r: c, t: c, b: c });
    this.o = o; this.boxW = w; this.boxH = h; this.kind = kind; this.cut = c;
    scene.add.existing(this);
  }

  redraw() {
    const kind = kindOf(this.o, this.boxW, this.boxH);
    const key = cardTex(this.scene, this.o, kind);
    const c = cutFor(KIND[kind], this.boxW, this.boxH);
    if (this.texture.key !== key || kind !== this.kind || c !== this.cut) {
      this.kind = kind; this.cut = c;
      this.setTexture(key);
      this.setSlices(this.boxW * S, this.boxH * S, c * S, c * S, c * S, c * S);
    }
    return this;
  }

  setStrokeStyle(sw = 1, color = 0xffffff, alpha = 1) {
    this.o.stroke = sw > 0 ? color : null; this.o.sw = sw; this.o.sa = alpha;
    return this.redraw();
  }

  setFillStyle(color, alpha = 1) {
    this.o.fill = color ?? null; this.o.fa = color == null ? 0 : alpha;
    return this.redraw();
  }

  resize(w, h) {
    this.boxW = w; this.boxH = h;
    this.cut = -1;   // força recalcular os cantos
    this.setLogicalSize(w, h);
    this.redraw();
    if (this.input?.hitArea) this.input.hitArea.setSize(this.width, this.height);
    return this;
  }

  get fillColor() { return this.o.fill; }
  get strokeColor() { return this.o.stroke; }
}

// Reserva para o modo Canvas (sem nine-slice): uma textura no tamanho exato.
class SkinImage extends Phaser.GameObjects.Image {
  constructor(scene, x, y, w, h, fill, alpha = 1, opts = {}) {
    super(scene, x, y, '__DEFAULT');
    this.boxW = w; this.boxH = h;
    this.o = { fill, fa: fill == null ? 0 : alpha, stroke: null, sw: 0, sa: 1, ornate: opts.ornate };
    this.redraw();
    scene.add.existing(this);
  }

  redraw() {
    const kind = kindOf(this.o, this.boxW, this.boxH);
    const tw = Math.max(4, Math.round(this.boxW)), th = Math.max(4, Math.round(this.boxH));
    const key = canvasTex(this.scene, `ski_${tw}x${th}_${kind}_${styleKey(this.o)}`, tw, th, (ctx, w, h) => paintCard(ctx, w, h, this.o, 1, kind === 'o', kind === 't'));
    if (this.texture.key !== key) {
      this.setTexture(key);
      if (this.input?.hitArea) this.input.hitArea.setSize(this.frame.width, this.frame.height);
    }
    this.setDisplaySize(this.boxW, this.boxH);
    return this;
  }

  setStrokeStyle(sw = 1, color = 0xffffff, alpha = 1) { this.o.stroke = sw > 0 ? color : null; this.o.sw = sw; this.o.sa = alpha; return this.redraw(); }
  setFillStyle(color, alpha = 1) { this.o.fill = color ?? null; this.o.fa = color == null ? 0 : alpha; return this.redraw(); }
  resize(w, h) { this.boxW = w; this.boxH = h; return this.redraw(); }
  get fillColor() { return this.o.fill; }
  get strokeColor() { return this.o.stroke; }
}

// Atalho com a mesma ordem de argumentos de scene.add.rectangle.
export function frame(scene, x, y, w, h, fill, alpha = 1, opts) {
  return nineOK(scene) ? new SkinNine(scene, x, y, w, h, fill, alpha, opts) : new SkinImage(scene, x, y, w, h, fill, alpha, opts);
}

// Fundo de botão (nine-slice): mesma API usada por Button.
export function buttonFace(scene, w, h, color, border, disabled = false) {
  const key = buttonTex(scene, color, border, disabled);
  if (nineOK(scene)) return new LogicalNine(scene, 0, 0, key, w, h, { l: BTN.cutX, r: BTN.cutX, t: BTN.top, b: BTN.bottom });
  return scene.add.image(0, 0, key).setDisplaySize(w, h);
}

export function setButtonFace(img, color, border, disabled = false) {
  const key = buttonTex(img.scene, color, border, disabled);
  if (img.texture.key === key) return img;
  img.setTexture(key);
  if (img.setSlices) img.setSlices(img.width, img.height, BTN.cutX * S, BTN.cutX * S, BTN.top * S, BTN.bottom * S);
  return img;
}

// Faixa da interface (barra do topo, faixa da fase, abas, dock): roxo escuro com filete de ouro.
export function ironBand(scene, x, y, w, h, fill = COL.panelDark) {
  return frame(scene, x, y, w, h, fill, 1, { ornate: false }).setOrigin(0).setStrokeStyle(4, COL.border);
}

// Faixa de luz dourada (topo dos painéis) e brilho roxo (fundo dos painéis): texturas que podem esticar.
export function goldBandKey(scene) {
  return canvasTex(scene, 'sk_goldband', 256, 8, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(200,150,42,0)'); g.addColorStop(0.15, 'rgba(200,150,42,1)'); g.addColorStop(0.5, 'rgba(255,240,168,1)');
    g.addColorStop(0.85, 'rgba(200,150,42,1)'); g.addColorStop(1, 'rgba(200,150,42,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 2, w, 4);
    ctx.fillStyle = 'rgba(255,200,80,0.25)'; ctx.fillRect(0, 0, w, 8);
  });
}

export function royalGlowKey(scene) {
  return canvasTex(scene, 'sk_royalglow', 256, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, 0, 4, w / 2, 0, w * 0.6);
    g.addColorStop(0, 'rgba(120,50,170,0.55)'); g.addColorStop(1, 'rgba(120,50,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}
