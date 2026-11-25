// Um bomber em campo e sua máquina de estados:
// PROCURAR → ANDAR → PLANTAR → SE AFASTAR → ESPERAR → (repete).
// Sem energia: CANSADO → anda até a entrada e SAI do campo.
import { BALANCE } from '../config/balance.js';
import { RARITY_COLORS } from '../data/heroes.js';
import { bfs, buildPath } from './Pathfinding.js';
import { statsOf } from './Roster.js';
import { heroSheet, heroAnim } from '../art/hd.js';
import { HD_HEROES } from '../config/hdArt.js';

export const STATE = {
  SEARCH: 'SEARCH', WALK: 'WALK', PLANT: 'PLANT', FLEE: 'FLEE', WAIT: 'WAIT', IDLE: 'IDLE',
  PAUSED: 'PAUSED', TIRED: 'TIRED',
};

const HERO_OFFSET_Y = -8; // o boneco fica um pouco acima do centro do tile
const AURA_COLOR = 0x6ff0ff; // ciano do Engenheiro (área e brilho da aura)

export class Bomber {
  constructor(scene, hero, tx, ty) {
    this.scene = scene;
    this.grid = scene.grid;
    this.hero = hero;
    this.uid = hero.uid;
    this.tx = tx;
    this.ty = ty;
    this.dir = 'down';
    this.state = STATE.PAUSED;
    this.activeBombs = 0;
    this.plan = null;
    this.token = 0; // muda a cada reset, cancela ações antigas
    this.leaving = false;
    this.refreshStats();

    const p = this.grid.toWorld(tx, ty);
    this.body = scene.add.container(p.x, p.y).setDepth(scene.depthFor(ty, 5));
    // Área da aura do Suporte: escondida; aparece por alguns segundos quando o jogador toca no Engenheiro.
    if (this.stats.auraRadius) {
      const r = (this.stats.auraRadius + 0.5) * this.grid.tile;
      this.ring = scene.add.circle(0, 0, r, AURA_COLOR, 0.08).setStrokeStyle(3, AURA_COLOR, 0.6)
        .setVisible(false).setAlpha(0);
      this.body.add(this.ring);
    }
    if (hero.rarity > 0) {
      this.glow = scene.add.ellipse(0, 14, 40, 14, RARITY_COLORS[hero.rarity], 0.55);
      this.body.add(this.glow);
      scene.tweens.add({ targets: this.glow, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    }
    // Brilho de quem está recebendo a aura de um Engenheiro (fica atrás do boneco).
    // Anel ciano no chão + luz em volta do corpo.
    this.buff = scene.add.container(0, 0);
    if (scene.textures.exists('fx_glow')) {
      this.buff.add(scene.add.image(0, HERO_OFFSET_Y, 'fx_glow').setScale(2.6).setTint(AURA_COLOR).setAlpha(0.7));
    }
    this.buff.add(scene.add.ellipse(0, 15, 50, 18, AURA_COLOR, 0.28).setStrokeStyle(3, AURA_COLOR, 1));
    this.buff.setVisible(false).setAlpha(0);
    this.buffed = false;
    this.body.add(this.buff);
    // Arte 32 px: uma folha por cor + raridade, com andar, parado, plantar, comemorar e cansado.
    this.sheet = heroSheet(scene, hero);
    this.sprite = (this.sheet
      ? scene.add.sprite(0, HERO_OFFSET_Y, this.sheet, HD_HEROES.idleFrame)
      : scene.add.sprite(0, HERO_OFFSET_Y, this.tex('down', 0)));
    // Arte 48 px: escala própria para 1 pixel do desenho = 1 pixel do jogo (nítido).
    this.baseScale = this.sheet ? HD_HEROES.fieldScale : BALANCE.grid.spriteScale;
    this.sprite.setScale(this.baseScale);
    this.body.add(this.sprite);
  }

  tex(dir, f) { return `hero${this.hero.palette}_${dir}_${f}`; }

  anim(name) { return heroAnim(this.hero, name); }

  refreshStats() { this.stats = statsOf(this.hero); }

  // Ponto no meio do boneco (para o toque no campo).
  get center() { return { x: this.body.x, y: this.body.y + HERO_OFFSET_Y - 8 }; }

  // Mostra a área da aura por alguns segundos (só Engenheiros têm). Devolve false se não tem aura.
  showAura(ms = 3000) {
    if (!this.ring || this.dead) return false;
    const tw = this.scene.tweens;
    tw.killTweensOf(this.ring);
    this.ring.setVisible(true);
    tw.add({ targets: this.ring, alpha: 1, duration: 180 });
    tw.add({ targets: this.ring, alpha: 0, delay: ms, duration: 450, onComplete: () => this.ring?.setVisible(false) });
    return true;
  }

  // Liga/desliga o brilho de "recebendo aura" (pulsa enquanto estiver ligado).
  setBuffed(on) {
    if (this.dead || on === this.buffed) return;
    this.buffed = on;
    const tw = this.scene.tweens;
    tw.killTweensOf(this.buff);
    if (on) {
      this.buff.setVisible(true).setAlpha(0.35);
      tw.add({ targets: this.buff, alpha: 0.85, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      tw.add({ targets: this.buff, alpha: 0, duration: 250, onComplete: () => this.buff.setVisible(false) });
    }
  }

  // Efeitos de Suportes próximos (o maior de cada tipo vale, não acumula).
  get aura() { return this.scene.auraEffects(this); }

  // Ataque com aura e Fúria (energia acima de 50%).
  get attack() {
    const fury = this.stats.abil.fury && this.hero.energy > this.stats.maxEnergy * 0.5 ? this.stats.abil.fury : 0;
    return this.stats.attack * (1 + this.aura.attackPct + fury);
  }

  get luckNow() { return this.stats.luck + this.aura.luck * 100; }
  get range() { return this.stats.range; }
  get pierce() { return this.stats.pierce; }
  get speed() {
    return Math.min(BALANCE.attributes.maxMoveSpeed, this.stats.moveSpeed * (1 + this.aura.speedPct));
  }
  get maxBombs() { return this.stats.bombs; }
  get hasEnergy() { return this.hero.energy >= BALANCE.hero.energyPerBomb; }

  // Dano esperado (sem crítico) contra um objeto, já descontando a dureza.
  dmgVs(o, attack = this.attack) {
    return attack * (1 - o.armor * (1 - this.stats.penetration / 100));
  }

  setState(s) {
    this.state = s;
    this.scene.game.events.emit('hero-state', this.uid, s);
  }

  // Executa "fn" depois de "ms", só se o herói não foi resetado nesse meio-tempo.
  later(ms, fn) {
    const t = this.token;
    this.scene.time.delayedCall(ms, () => { if (t === this.token) fn(); });
  }

  // ---------- Decisão ----------
  think() {
    if (this.leaving) return;
    if (this.scene.stageClearing) { this.setState(STATE.PAUSED); return; }
    if (!this.hasEnergy) { this.exhaust(); return; }
    if (this.activeBombs >= this.maxBombs) { this.setState(STATE.WAIT); return; }

    this.refreshStats();
    this.setState(STATE.SEARCH);
    const plan = this.choosePlan();
    if (!plan) {
      this.setState(STATE.IDLE);
      this.later(BALANCE.hero.idleRetryMs, () => this.think());
      return;
    }
    this.reserve(plan);
    this.plan = plan;
    this.setState(STATE.WALK);
    this.walk(plan.path, () => this.plant());
  }

  // Valor de um objeto para este herói (papel muda as preferências).
  valueOf(o, eff, dmg) {
    const A = BALANCE.ai;
    let v = A.valueByType[o.type];
    const rb = A.roleBonus[this.hero.role];
    if (rb) {
      if (rb[o.type]) v *= rb[o.type];
      if (rb.highHp) v *= 1 + rb.highHp * Math.max(0, Math.ceil(eff / dmg) - 1);
    }
    if (eff <= dmg) v *= A.finishBonus;
    return v;
  }

  // Escolhe o tile onde plantar: maior valor atingido dividido pela distância.
  choosePlan() {
    const { grid } = this;
    const { dist, prev, start } = bfs(grid, this.tx, this.ty);
    const attack = this.attack;
    let best = null;

    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < 0 || grid.bombs[i]) continue;
      const owner = grid.tileReserved.get(i);
      if (owner !== undefined && owner !== this.uid) continue;

      const [x, y] = grid.xy(i);
      const hit = grid.cross(x, y, this.range, this.pierce);
      let value = 0;
      const targets = [];
      for (const o of hit.objects) {
        const eff = grid.effectiveHp(o);
        if (eff > 0) {
          const dmg = this.dmgVs(o, attack);
          value += this.valueOf(o, eff, dmg);
          targets.push({ o, dmg });
        }
      }
      if (value <= 0) continue;
      const score = value / (dist[i] + BALANCE.ai.distanceBias);
      if (!best || score > best.score) best = { i, x, y, score, targets };
    }
    if (best) best.path = buildPath(prev, start, best.i);
    return best;
  }

  reserve(plan) {
    this.grid.tileReserved.set(plan.i, this.uid);
    plan.targets.forEach((t) => { t.o.reserved += t.dmg; });
  }

  release() {
    const plan = this.plan;
    if (!plan) return;
    if (this.grid.tileReserved.get(plan.i) === this.uid) this.grid.tileReserved.delete(plan.i);
    plan.targets.forEach((t) => { t.o.reserved = Math.max(0, t.o.reserved - t.dmg); });
    this.plan = null;
  }

  // ---------- Ações ----------
  walk(path, done) {
    const t = this.token;
    const step = () => {
      if (t !== this.token) return;
      if (!path.length) {
        this.stand();
        done();
        return;
      }
      const next = path.shift();
      const [nx, ny] = this.grid.xy(next);
      this.face(nx - this.tx, ny - this.ty);
      const p = this.grid.toWorld(nx, ny);
      this.body.setDepth(this.scene.depthFor(Math.max(ny, this.ty), 5));
      this.scene.tweens.add({
        targets: this.body,
        x: p.x,
        y: p.y,
        duration: 1000 / this.speed,
        onComplete: () => {
          if (t !== this.token) return;
          this.tx = nx;
          this.ty = ny;
          this.body.setDepth(this.scene.depthFor(ny, 5));
          step();
        },
      });
    };
    step();
  }

  plant() {
    const { grid } = this;
    this.release();
    if (this.scene.stageClearing) { this.setState(STATE.PAUSED); return; }
    if (!this.hasEnergy) { this.exhaust(); return; }

    // Confere se ainda vale a pena (algo pode ter sido destruído no caminho).
    const stillUseful = !grid.bombAt(this.tx, this.ty)
      && grid.cross(this.tx, this.ty, this.range, this.pierce).objects.some((o) => grid.effectiveHp(o) > 0);
    if (!stillUseful) { this.think(); return; }

    this.setState(STATE.PLANT);
    this.scene.bombs.plant(this);
    this.activeBombs += 1;
    // Eficiência (própria) e Revigorar (aura) podem poupar a energia.
    const save = (this.stats.abil.efficient || 0) + this.aura.energySave;
    if (Math.random() >= save) this.hero.energy = Math.max(0, this.hero.energy - BALANCE.hero.energyPerBomb);
    this.scene.game.events.emit('hero-energy', this.uid);
    if (this.sheet) this.sprite.play(this.anim('plant'));
    else this.scene.tweens.add({ targets: this.sprite, scaleY: BALANCE.grid.spriteScale * 0.8, duration: 90, yoyo: true });
    // Herói mais rápido também planta mais rápido.
    this.later(BALANCE.hero.plantMs * Phaser.Math.Clamp(2.2 / this.speed, 0.5, 1.2), () => this.flee());
  }

  // Vai para o tile seguro mais próximo (fora das cruzes das bombas).
  flee() {
    this.setState(STATE.FLEE);
    const { grid } = this;
    const danger = grid.dangerSet();
    const here = grid.idx(this.tx, this.ty);
    if (!danger.has(here)) { this.afterFlee(); return; }

    const { dist, prev, start } = bfs(grid, this.tx, this.ty);
    let best = -1;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < 0 || danger.has(i) || grid.bombs[i]) continue;
      if (best === -1 || dist[i] < dist[best]) best = i;
    }
    if (best === -1) { this.afterFlee(); return; }
    this.walk(buildPath(prev, start, best), () => this.afterFlee());
  }

  afterFlee() {
    if (!this.hasEnergy) { this.exhaust(); return; }
    if (this.activeBombs < this.maxBombs) this.think();
    else this.setState(STATE.WAIT);
  }

  onBombExploded() {
    if (this.dead) return;   // saiu do campo antes da bomba estourar
    this.activeBombs = Math.max(0, this.activeBombs - 1);
    if (this.state === STATE.WAIT) this.think();
  }

  // Sem energia: volta para a entrada e sai do campo.
  exhaust() {
    if (this.leaving) return;
    this.leaving = true;
    this.release();
    this.setState(STATE.TIRED);
    const { grid } = this;
    const { dist, prev, start } = bfs(grid, this.tx, this.ty);
    let best = -1;
    for (const [x, y] of BALANCE.stage.spawn) {
      const i = grid.idx(x, y);
      if (dist[i] >= 0 && (best === -1 || dist[i] < dist[best])) best = i;
    }
    const path = best === -1 ? [] : buildPath(prev, start, best);
    this.walk(path, () => this.fadeOut());
  }

  fadeOut() {
    const t = this.token;
    this.face(0, 1);
    if (this.sheet) this.sprite.play(this.anim('tired'), true);
    this.scene.tweens.add({
      targets: this.body, y: this.body.y + 24, alpha: 0, duration: 350,
      onComplete: () => { if (t === this.token) this.scene.onBomberLeft(this); },
    });
  }

  // ---------- Visual ----------
  face(dx, dy) {
    if (dx > 0) { this.dir = 'side'; this.sprite.setFlipX(false); }
    else if (dx < 0) { this.dir = 'side'; this.sprite.setFlipX(true); }
    else if (dy < 0) { this.dir = 'up'; this.sprite.setFlipX(false); }
    else { this.dir = 'down'; this.sprite.setFlipX(false); }
    this.sprite.play(this.sheet ? this.anim(`walk_${this.dir}`) : `h${this.hero.palette}_walk_${this.dir}`, true);
    // Pernas no ritmo do chão: um ciclo de 4 quadros (2 passos) por casa andada, sem patinar.
    const fps = this.sprite.anims.currentAnim?.frameRate || 9;
    this.sprite.anims.timeScale = Phaser.Math.Clamp((this.speed * 4) / fps, 0.5, 2);
  }

  stand() {
    if (this.sheet) {
      // Parado: sempre de frente, respirando (a arte só tem o "parado" de frente).
      this.sprite.setFlipX(false).play(this.anim('idle'), true);
      this.sprite.anims.timeScale = 1;
      return;
    }
    this.sprite.stop();
    this.sprite.setTexture(this.tex(this.dir, 0));
  }

  celebrate() {
    this.dir = 'down';
    this.sprite.setFlipX(false);
    if (this.sheet) { this.sprite.play(this.anim('cheer'), true); return; }
    this.stand();
    this.scene.tweens.add({
      targets: this.sprite, y: HERO_OFFSET_Y - 14, duration: 160, yoyo: true, repeat: 2, ease: 'Quad.easeOut',
    });
  }

  stopAll() {
    this.token += 1;
    this.scene.tweens.killTweensOf(this.body);
    this.scene.tweens.killTweensOf(this.sprite);
    this.release();
    this.activeBombs = 0;
    this.sprite.setY(HERO_OFFSET_Y).setScale(this.baseScale);
  }

  // Coloca num tile (entrada em campo ou nova fase).
  placeAt(tx, ty) {
    this.stopAll();
    this.leaving = false;
    this.tx = tx;
    this.ty = ty;
    const p = this.grid.toWorld(tx, ty);
    this.dir = 'down';
    this.sprite.setFlipX(false);
    this.body.setPosition(p.x, p.y).setDepth(this.scene.depthFor(ty, 5)).setAlpha(0);
    this.stand();
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 250 });
    this.setState(STATE.PAUSED);
  }

  // Para tudo (fim de fase) sem mudar de lugar.
  halt() {
    if (this.leaving) return;
    this.stopAll();
    const p = this.grid.toWorld(this.tx, this.ty);
    this.body.setPosition(p.x, p.y).setAlpha(1);
    this.setState(STATE.PAUSED);
  }

  destroy() {
    this.dead = true;
    this.stopAll();
    if (this.glow) this.scene.tweens.killTweensOf(this.glow);
    if (this.ring) this.scene.tweens.killTweensOf(this.ring);
    this.scene.tweens.killTweensOf(this.buff);
    this.body.destroy();
  }
}
