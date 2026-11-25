// Selo VIP (arte do ChatGPT em assets/ui/ranking/badge_vip.png): jogador com o Passe do Minerador ativo.
// Aparece ao lado do nome no Ranking e no perfil, com um brilho leve pulsando. O Passe de Temporada não dá selo.
export const BADGE_ART = ['badge_vip'];
export const badgeKey = (n) => `rk_${n}`;

// Quais selos este jogador (linha da tabela profiles) tem agora.
export function badgesOf(p) {
  if (!p) return [];
  const out = [];
  if ((p.premium_until || 0) > Date.now()) out.push('badge_vip');
  return out;
}

// Cria (uma vez) as imagens de selo de um lugar da tela; set(list, x, y) mostra os selos lado a lado a partir de x.
export function badgeSlot(scene, container, h) {
  const items = BADGE_ART.map((n) => {
    const glow = scene.add.image(0, 0, badgeKey(n)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setVisible(false);
    const img = scene.add.image(0, 0, badgeKey(n)).setVisible(false);
    container.add([glow, img]);
    scene.tweens.add({ targets: glow, alpha: 0.12, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return { n, glow, img };
  });
  return {
    set(list, x, y, align = 0) {
      let cx = x;
      const shown = items.filter((it) => list.includes(it.n) && scene.textures.exists(badgeKey(it.n)));
      items.forEach((it) => { it.img.setVisible(false); it.glow.setVisible(false); });
      const widths = shown.map((it) => {
        const t = scene.textures.get(badgeKey(it.n)).getSourceImage();
        return h * t.width / t.height;
      });
      const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, shown.length - 1) * 6;
      if (align === 0.5) cx = x - total / 2;
      shown.forEach((it, i) => {
        const w = widths[i];
        it.img.setVisible(true).setDisplaySize(w, h).setPosition(cx + w / 2, y);
        it.glow.setVisible(true).setDisplaySize(w * 1.25, h * 1.25).setPosition(cx + w / 2, y);
        cx += w + 6;
      });
      return total;
    },
  };
}
