// Emblema do clã: mosaico 8×8 com 16 cores (0 = vazio, deixa ver o fundo).
// Guardado como texto de 64 dígitos hexadecimais, linha por linha (é o formato que vai para o servidor).

export const EMBLEM_SIZE = 8;
export const EMBLEM_COLORS = [
  null,      // 0 vazio
  0x120a1e,  // 1 preto
  0x5a5a6a,  // 2 cinza
  0xf4ead8,  // 3 branco
  0xe0453a,  // 4 vermelho
  0xff8a30,  // 5 laranja
  0xffd86a,  // 6 amarelo
  0xc8962a,  // 7 ouro
  0x8fe07a,  // 8 verde-claro
  0x3a9a4a,  // 9 verde
  0x4ad0e0,  // a ciano
  0x3a8ad8,  // b azul
  0x1a2a6a,  // c azul-marinho
  0x7a3ac8,  // d roxo
  0xe050c0,  // e magenta
  0x7a4a20,  // f marrom
];
export const EMPTY_EMBLEM = '0'.repeat(64);

// Modelos para começar (o dono do clã edita por cima).
const M = (rows) => rows.join('');
export const EMBLEM_MODELS = [
  { name: 'Estrela', pattern: M(['00066000', '00066000', '66666666', '06666660', '00666600', '06600660', '66000066', '00000000']) },
  { name: 'Cristal', pattern: M(['00aaaa00', '0a3aaba0', 'a3aaaaba', '0aaaaab0', '00aaab00', '000ab000', '00000000', '00000000']) },
  { name: 'Chama', pattern: M(['00040000', '00440000', '00454040', '04455440', '04566540', '04566540', '00455400', '00044000']) },
  { name: 'Bomba', pattern: M(['00000650', '0000f000', '0011f100', '01211110', '12111111', '11111111', '01111110', '00111100']) },
  { name: 'Picareta', pattern: M(['02222220', '23322332', '000ff000', '000ff000', '000ff000', '000ff000', '000ff000', '00000000']) },
  { name: 'Lua', pattern: M(['00033300', '00330000', '03300000', '03300000', '03300000', '00330000', '00033300', '00000000']) },
];

// Modelo + cor de fundo (os vazios viram a cor de fundo).
export function emblemOf(model, bg) {
  const p = EMBLEM_MODELS.find((m) => m.name === model)?.pattern || EMPTY_EMBLEM;
  return p.replace(/0/g, bg);
}

export const cellAt = (pattern, i) => parseInt(pattern[i], 16) || 0;

// Desenha o emblema num Graphics: moldura dourada + quadrados. size = lado total (com moldura).
export function paintEmblem(g, pattern, size, frame = true) {
  g.clear();
  const pad = frame ? Math.max(2, Math.round(size * 0.07)) : 0;
  const cell = (size - pad * 2) / EMBLEM_SIZE;
  const o = -size / 2;
  if (frame) {
    g.fillStyle(0x5a3408).fillRect(o - 1, o - 1, size + 2, size + 2);
    g.fillStyle(0xc8962a).fillRect(o, o, size, size);
    g.fillStyle(0x1a1228).fillRect(o + pad, o + pad, size - pad * 2, size - pad * 2);
  }
  for (let i = 0; i < 64; i++) {
    const c = EMBLEM_COLORS[cellAt(pattern, i)];
    if (c === null) continue;
    const x = o + pad + (i % 8) * cell, y = o + pad + Math.floor(i / 8) * cell;
    g.fillStyle(c).fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));
  }
  return g;
}

export function drawEmblem(scene, x, y, size, pattern, frame = true) {
  return paintEmblem(scene.add.graphics({ x, y }), pattern, size, frame);
}
