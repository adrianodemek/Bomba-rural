// Vitrine pública do jogador (vai para a nuvem junto do ranking): a equipe principal com níveis, poder e itens.
// Formato curto para ocupar pouco espaço; o perfil (ProfileModal) monta a tela a partir dele.
import { economy } from './Economy.js';
import { statsOf } from './Roster.js';

const itemOut = (it) => ({
  s: it.slot, q: it.rarity, i: it.ilvl, p: it.plus || 0, t: it.stars || 0, set: it.set || null, ...(it.cls ? { c: it.cls } : {}),
  a: (it.affixes || []).map((x) => [x.attr, x.roll]),
});

export function buildShowcase() {
  const team = economy.heroes.filter((h) => h.team === economy.activeTeam);
  // Equipe principal; se estiver vazia, os 6 heróis de maior nível.
  const list = (team.length ? team : [...economy.heroes].sort((a, b) => b.level - a.level)).slice(0, 6);
  return {
    v: 1,
    heroes: list.map((h) => {
      let power = 0;
      try { power = Math.round(statsOf(h).power || 0); } catch (e) { /* ok */ }
      const gear = {};
      for (const [k, uid] of Object.entries(h.gear || {})) {
        const it = economy.itemByUid(uid);
        if (it) gear[k] = itemOut(it);
      }
      return {
        n: h.name, r: h.role, q: h.rarity, pa: h.palette || 0, l: h.level, s: h.stars || 0, rk: h.rank || 0,
        aw: h.awaken || 0, pw: power, g: gear,
      };
    }),
  };
}

// Item da vitrine de volta no formato do jogo (para usar os textos de item).
export const showcaseItem = (g) => ({
  slot: g.s, rarity: g.q, ilvl: g.i, plus: g.p, stars: g.t, set: g.set, ...(g.c ? { cls: g.c } : {}),
  affixes: (g.a || []).map(([attr, roll]) => ({ attr, roll })),
});
