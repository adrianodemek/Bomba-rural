// Cores e fontes da interface — tema Imperial (roxo profundo + ouro, moldura dupla, arabescos).
// "Imperial Sans" = Inter (normal 600 / bold 800) · "Imperial Title" = Cinzel (títulos). Ver assets/fonts/fonts.css.
export const FONT = '"Imperial Sans", "Segoe UI", Roboto, sans-serif';
export const TITLE_FONT = '"Imperial Title", Georgia, serif';
// Todos os tamanhos passam por aqui (os números do código eram da fonte em pixel; a Inter é mais larga).
export const fs = (n) => `${Math.round(n * 0.98)}px`;

export const COL = {
  bg: 0x0e0716,          // fundo geral
  arena: 0x140a22,
  panel: 0x1e0f32,       // janelas e painéis
  panelDark: 0x140a22,   // faixas (topo, fase, abas, dock)
  card: 0x2a1840,        // cartões e botões secundários
  slot: 0x120a1e,        // encaixes escuros (slots de item, contadores)
  border: 0xa87a20,      // borda dourada escura
  gold: 0xe8b84a,        // ouro claro (destaques)
  btn: 0xf0b830,         // botão principal (ouro)
  btnBorder: 0x6a3a06,
  btnDisabled: 0x2c2238,
  btnDisabledBorder: 0x4a3c5a,
  active: 0x5a2e8a,      // aba/alternador ligado
  activeBorder: 0xffd86a,
  royal: 0x7a3ac8,       // botões roxos (despertar, gemas, Abismo)
  royalBorder: 0xc8962a,
  danger: 0xa82a44,
  dangerBorder: 0x4a0a18,
  tabActive: 0x3a2258,
};

export const TXT = {
  main: '#f4ead8',
  dim: '#a898c0',
  gold: '#ffd86a',
  good: '#b8f08a',
  bad: '#ff8a8a',
  ink: '#12081c',        // contorno escuro de texto
  onGold: '#3a1a04',     // texto em cima de botão dourado
};
