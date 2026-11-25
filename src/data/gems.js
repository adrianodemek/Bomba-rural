// Gemas: uma por atributo. Ficam empilhadas por tipo e nível ("ruby:3" = Rubi nível 3).
// Três iguais do mesmo nível viram uma do nível seguinte. O herói tem até 3 encaixes.
export const GEMS = {
  ruby: { name: 'Rubi', attr: 'attack', color: 0xd83a4a, light: 0xffa0a8 },
  sapphire: { name: 'Safira', attr: 'energy', color: 0x3a6ad8, light: 0xa0c0ff },
  quartz: { name: 'Quartzo', attr: 'speed', color: 0xd8d8e8, light: 0xffffff },
  emerald: { name: 'Esmeralda', attr: 'luck', color: 0x3ab85a, light: 0xa8f0b8 },
  tourmaline: { name: 'Turmalina', attr: 'critChance', color: 0xe86fa8, light: 0xffc0dc },
  topaz: { name: 'Topázio', attr: 'critDamage', color: 0xf0a030, light: 0xffe0a0 },
  onyx: { name: 'Ônix', attr: 'penetration', color: 0x4a4a5a, light: 0xa0a0b8 },
  aquamarine: { name: 'Água-marinha', attr: 'cooldown', color: 0x3ac8d0, light: 0xb0f4f8 },
};
export const GEM_IDS = Object.keys(GEMS);

export const gemKey = (type, lvl) => `${type}:${lvl}`;
export function parseGem(key) {
  const [type, lvl] = String(key).split(':');
  return GEMS[type] && Number(lvl) >= 1 ? { type, lvl: Number(lvl) } : null;
}
