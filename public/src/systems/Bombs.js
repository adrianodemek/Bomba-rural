// Bombas: plantar, pavio, explosão em cruz, crítico e reação em cadeia.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { Sfx } from './Sfx.js';

export class BombSystem {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.bombPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: 80 });
    this.boomPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: 300 });
  }

  // O herói planta uma bomba no tile onde está.
  plant(hero) {
    const { grid } = this;
    const st = hero.stats;
    const attack = hero.attack; // já com aura
    const ab = st.abil;
    const aura = hero.aura;
    const range = hero.range + (Math.random() < (ab.blast || 0) ? 1 : 0); // Explosão Larga
    const pierce = hero.pierce;
    const hit = grid.cross(hero.tx, hero.ty, range, pierce);
    const planned = hit.objects.map((o) => {
      const dmg = hero.dmgVs(o, attack);
      o.pending += dmg;
      return { o, dmg };
    });

    const p = grid.toWorld(hero.tx, hero.ty);
    const sprite = this.bombPool.get(p.x, p.y, 'bomb_0');
    if (sprite) {
      sprite.setActive(true).setVisible(true).setScale(0).setDepth(this.scene.depthFor(hero.ty, 2));
      sprite.play('bomb_fuse');
      this.scene.tweens.add({ targets: sprite, scale: BALANCE.grid.spriteScale, duration: 120, ease: 'Back.easeOut' });
    }

    const bomb = {
      x: hero.tx, y: hero.ty, attack, range, pierce, owner: hero,
      penetration: st.penetration / 100,
      critChance: st.critChance / 100,
      critDamage: st.critDamage / 100,
      crusher: ab.crusher || 0, execute: ab.execute || 0, chainBonus: ab.chain || 0,
      shrapnel: ab.shrapnel || 0, double: ab.double || 0, chained: false, echo: false,
      planned, sprite, exploded: false, timer: null,
    };
    grid.bombs[grid.idx(bomb.x, bomb.y)] = bomb;
    const fuse = BALANCE.bomb.fuseMs * (1 - st.cooldown / 100) * (1 - aura.fusePct);
    bomb.timer = this.scene.time.delayedCall(fuse, () => this.explode(bomb));
    return bomb;
  }

  // Dano de uma bomba num objeto, com dureza, crítico e habilidades.
  damageFor(bomb, o, mult) {
    let dmg = bomb.attack * (1 - o.armor * (1 - bomb.penetration)) * mult;
    if (bomb.crusher && (o.type === 'rock' || o.type === 'vein')) dmg *= 1 + bomb.crusher;
    if (bomb.execute && o.hp / o.maxHp < 0.35) dmg *= 1 + bomb.execute;
    if (bomb.chained && bomb.chainBonus) dmg *= 1 + bomb.chainBonus;
    return dmg;
  }

  explode(bomb) {
    if (bomb.exploded) return;
    bomb.exploded = true;
    bomb.timer?.remove(false);
    const { grid, scene } = this;
    if (!bomb.echo) {
      grid.bombs[grid.idx(bomb.x, bomb.y)] = null;
      this.hideBomb(bomb);
      // Libera o dano "previsto" e aplica o dano real (a área pode ter mudado).
      bomb.planned.forEach((t) => { t.o.pending = Math.max(0, t.o.pending - t.dmg); });
    }
    if (scene.stageClearing) { if (!bomb.echo) bomb.owner.onBombExploded(); return; }
    const crit = Math.random() < bomb.critChance;
    const mult = crit ? 1 + bomb.critDamage : 1;
    const hit = grid.cross(bomb.x, bomb.y, bomb.range, bomb.pierce);
    hit.tiles.forEach((t) => this.showBoom(t.x, t.y, crit));
    hit.objects.forEach((o) => scene.damageObject(o, this.damageFor(bomb, o, mult), bomb.owner));
    hit.bombs.forEach((b) => scene.time.delayedCall(BALANCE.bomb.chainDelayMs, () => { b.chained = true; this.explode(b); }));

    // Estilhaço: atinge as 4 diagonais com 40% do dano.
    if (bomb.shrapnel && Math.random() < bomb.shrapnel) {
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const x = bomb.x + dx;
        const y = bomb.y + dy;
        if (!grid.inBounds(x, y) || grid.isPillar(x, y)) continue;
        this.showBoom(x, y, false);
        const o = grid.objectAt(x, y);
        if (o) scene.damageObject(o, this.damageFor(bomb, o, mult) * 0.4, bomb.owner);
      }
    }
    // Pavio Duplo: explode de novo no mesmo lugar (uma vez só).
    if (!bomb.echo && bomb.double && Math.random() < bomb.double) {
      const echo = { ...bomb, echo: true, exploded: false, timer: null, chained: false };
      scene.time.delayedCall(320, () => this.explode(echo));
    }
    if (bomb.echo) return;

    Sfx.play(crit ? 'crit' : 'boom');
    if (crit) {
      economy.bump('crits');
      const p = grid.toWorld(bomb.x, bomb.y);
      scene.loot.floatText(p.x, p.y - 20, 'CRÍTICO!', '#ff7a4a');
      scene.cameras.main.shake(BALANCE.juice.shakeMs * 1.5, BALANCE.juice.shakeIntensity * 2);
    } else {
      scene.cameras.main.shake(BALANCE.juice.shakeMs, BALANCE.juice.shakeIntensity);
    }
    bomb.owner.onBombExploded();
  }

  hideBomb(bomb) {
    if (!bomb.sprite) return;
    bomb.sprite.stop();
    this.scene.tweens.killTweensOf(bomb.sprite);
    this.bombPool.killAndHide(bomb.sprite);
    bomb.sprite = null;
  }

  showBoom(x, y, crit) {
    const p = this.grid.toWorld(x, y);
    const s = this.boomPool.get(p.x, p.y, 'boom_0');
    if (!s) return;
    s.setActive(true).setVisible(true).setScale(BALANCE.grid.spriteScale * (crit ? 1.25 : 1))
      .setDepth(this.scene.depthFor(y, 8));
    if (crit) s.setTint(0xffb0a0); else s.clearTint();
    s.play('boom');
    s.once('animationcomplete', () => this.boomPool.killAndHide(s));
  }

  // Some com todas as bombas (fim de fase), sem explodir.
  clearAll() {
    this.grid.bombs.forEach((b) => {
      if (!b) return;
      b.exploded = true;
      b.timer?.remove(false);
      this.hideBomb(b);
    });
    this.grid.bombs.fill(null);
  }
}
