// A arena: grade, objetos, bombas, quem está em campo, rodízio de equipes e fim de fase.
import { addPassXp, passXp } from '../systems/SeasonPass.js';
import { BALANCE } from '../config/balance.js';
import { setupCamera } from '../config/display.js';
import { mulberry32, earlyEase } from '../systems/Grid.js';
import { COL } from '../config/theme.js';
import { Grid } from '../systems/Grid.js';
import { BombSystem } from '../systems/Bombs.js';
import { LootSystem } from '../systems/Loot.js';
import { Bomber } from '../systems/BomberAI.js';
import { economy } from '../systems/Economy.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { assignCapsules, recover, maxEnergy } from '../systems/Energy.js';
import { WORLDS, COLOSSI, ZONES } from '../data/worlds.js';
import { Sfx } from '../systems/Sfx.js';
import { addRandomGem } from '../systems/Gems.js';
import { grantAbyssEssence, abyssEssenceLeft } from '../systems/Goals.js';
import { currentItemLevel } from '../systems/Items.js';
import { HD_SCENES, HD_BOSSBAR, HD_BOSSES } from '../config/hdArt.js';
import { isHd, ensureGroup, groupLoaded, prefetchGroups, releaseGroups, animSprite } from '../art/hd.js';

const DEBRIS_TYPES = ['rock', 'vein', 'tree', 'chest', 'boss'];
const BOSS_SCALE = 9;   // 16 px de arte × 9 = 144 px: 3 casas de largura (1 pixel da arte = 3 px na tela, nítido)
const BOSS_IMPACT_FRAME = '16';  // quadro da folha do chefe pintado em que os punhos batem no chão (animação "slam")

const manhattan = (a, b) => Math.abs(a.tx - b.x) + Math.abs(a.ty - b.y);

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    setupCamera(this);
    // Permite acelerar o jogo para testes (window.__TIME_SCALE = 4).
    const ts = window.__TIME_SCALE || 1;
    this.time.timeScale = ts;
    this.tweens.timeScale = ts;
    this.anims.globalTimeScale = ts;

    this.grid = new Grid();
    this.stageClearing = false;
    this.stageGold = 0;
    this.field = new Map();   // uid → Bomber em campo
    this.benched = new Set(); // quem cansou nesta rodada da equipe
    this.waiting = false;     // nenhuma equipe pronta
    this.tickGold = 0;        // ouro ganho desde o último tique (média para o ganho offline)
    this.themeWorld = -1;
    this.themeKey = null;

    this.drawArena();
    this.bombs = new BombSystem(this, this.grid);
    this.loot = new LootSystem(this);

    this.debris = {};
    for (const type of DEBRIS_TYPES) {
      this.debris[type] = this.add.particles(0, 0, 'debris', {
        speed: { min: 80, max: 200 },
        angle: { min: 200, max: 340 },
        gravityY: 600,
        lifespan: 520,
        scale: { start: 3, end: 1 },
        emitting: false,
      }).setDepth(2900);
    }

    this.buildAmbienceLayers();
    this.buildStage();
    this.scene.launch('UI');
    // Os outros cenários carregam aos poucos (primeiro as próximas zonas do mundo atual).
    this.time.delayedCall(2500, () => prefetchGroups(this, this.prefetchOrder()));

    // Aura dos Engenheiros: quem está dentro brilha (confere 4× por segundo).
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.updateAuraGlow() });
    // Tocar num Engenheiro em campo mostra a área da aura dele por alguns segundos.
    this.input.on('pointerdown', (p) => this.tapField(p));

    // Relógio de energia: recuperação, cápsulas e rodízio.
    this.time.addEvent({
      delay: BALANCE.teams.checkEverySec * 1000,
      loop: true,
      callback: () => this.energyTick(BALANCE.teams.checkEverySec),
    });
    this.time.delayedCall(400, () => this.syncField());

    const onTeams = () => this.queueSync();
    economy.on('teams', onTeams);
    this.events.once('shutdown', () => economy.off('teams', onTeams));
  }

  // Profundidade de desenho: linhas de baixo ficam na frente.
  depthFor(tileY, layer) {
    return 100 + tileY * 10 + layer;
  }

  drawArena() {
    const { grid } = this;
    const w = grid.cols * grid.tile;
    const h = grid.rows * grid.tile;
    const L = BALANCE.layout;
    // Mata em volta da arena (o campo parece aberto, como uma clareira).
    this.surround = this.add.rectangle(0, L.arenaY, BALANCE.screen.width, L.arenaH, 0x2a4a22).setOrigin(0).setDepth(0);
    this.edge = this.add.rectangle(grid.originX - 3, grid.originY - 3, w + 6, h + 6, 0x0e0716, 0.55).setOrigin(0).setDepth(0.5);
    this.tiles = [];
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const p = grid.toWorld(x, y);
        const pillar = grid.isPillar(x, y);
        const img = this.add.image(p.x, p.y, pillar ? 'pillar_w0' : 'floor_w0_0').setScale(BALANCE.grid.spriteScale)
          .setDepth(pillar ? this.depthFor(y, 1) : 1);
        this.tiles.push({ img, pillar, variant: (x * 7 + y * 3) % 5 === 0 ? 1 : 0 });
      }
    }
    this.drawDecor();
  }

  // Árvores e pedras decorativas na borda (não bloqueiam nada; só enfeite).
  drawDecor() {
    const { grid } = this;
    const L = BALANCE.layout;
    const left = grid.originX;
    const right = grid.originX + grid.cols * grid.tile;
    const top = grid.originY;
    const bottom = grid.originY + grid.rows * grid.tile;
    const rand = mulberry32(4242);
    const S = BALANCE.grid.spriteScale;
    this.decor = [];
    const put = (x, y, kind, scale, depth) => {
      // Um pouco mais escuras que os objetos do campo, para não confundir com o que dá para explodir.
      const img = this.add.image(x, y, `${kind}_w0`).setScale(scale).setDepth(depth).setFlipX(rand() < 0.5).setTint(0x9a9a9a);
      this.decor.push({ img, kind });
    };
    // Laterais: árvores alternando com pedras, um pouco desalinhadas.
    for (let y = top + 10; y < bottom + 10; y += 44) {
      for (const cx of [left / 2, right + (BALANCE.screen.width - right) / 2]) {
        const kind = rand() < 0.72 ? 'tree' : 'rock';
        put(cx + (rand() - 0.5) * 10, y + (rand() - 0.5) * 12, kind, S * (kind === 'tree' ? 1.15 + rand() * 0.25 : 0.75 + rand() * 0.2), this.depthFor(Math.round((y - top) / grid.tile), 0.5));
      }
    }
    // Topo: fileira de árvores atrás da arena.
    for (let x = left + 20; x < right; x += 46) {
      put(x + (rand() - 0.5) * 14, Math.max(L.arenaY + 22, top - 14) + (rand() - 0.5) * 6, 'tree', S * (1.05 + rand() * 0.2), 50);
    }
    // Base: pedrinhas baixas (não cobrem a última fileira).
    for (let x = left + 10; x < right; x += 58) {
      put(x + (rand() - 0.5) * 18, bottom + 22 + (rand() - 0.5) * 4, 'rock', S * (0.55 + rand() * 0.15), 2000);
    }
  }

  // Troca chão, blocos e cores dos detritos para o mundo atual.
  applyTheme(world, zone = 2, key = `${world}_${zone}`) {
    if (this.themeKey === key) return;
    const prev = this.themeKey;
    this.themeKey = key;
    this.themeWorld = world;
    this.tiles.forEach((t) => t.img.setTexture(t.pillar ? `pillar_w${world}` : `floor_w${world}_${t.variant}`));
    this.decor.forEach((d) => d.img.setTexture(`${d.kind}_w${world}`));
    this.buildHdScene(key);
    // Cenário ainda não baixado: mostra o chão simples e troca assim que chegar.
    if (!groupLoaded(key)) {
      ensureGroup(this, key, () => {
        if (this.themeKey !== key) return;
        this.buildHdScene(key);
        this.refreshObjectArt();
        this.setAmbience();
      });
    }
    if (prev && prev.split('_')[0] === String(world) && economy.mode === 'campaign') {
      this.game.events.emit('zone-changed', world, zone);
    }
    const th = WORLDS[world].theme;
    this.surround.setFillStyle(Phaser.Display.Color.ValueToColor(th.tree.g).darken(18).color);
    this.debris.rock.setParticleTint(th.debris.rock);
    this.debris.tree.setParticleTint(th.debris.tree);
    this.debris.vein.setParticleTint(WORLDS[world].mineral.color);
    this.debris.chest.setParticleTint(0xa8743c);
    this.debris.boss.setParticleTint(WORLDS[world].mineral.light);
    if (key === 'abyss') {                             // Poço de Cristais: lascas azuladas e ciano
      this.surround.setFillStyle(0x0d1322);
      this.debris.rock.setParticleTint(0x3a5078);
      this.debris.tree.setParticleTint(0x52d0ea);
      this.debris.vein.setParticleTint(0x52d0ea);
    }
  }

  // Cenário desenhado em pixel art 32 px (quando o mundo tem um): fundo inteiro + partes animadas.
  // Sem ele, o mundo usa o chão em tiles antigo.
  buildHdScene(key) {
    (this.hdLayer || []).forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
    this.hdLayer = [];
    this.hdLights = [];
    const sc = HD_SCENES[key];
    const on = !!(sc && this.textures.exists(sc.map));
    this.tiles.forEach((t) => t.img.setVisible(!on));
    this.decor.forEach((d) => d.img.setVisible(!on));
    this.surround.setVisible(!on);
    this.edge.setVisible(!on);
    if (!on) return;
    const S = sc.scale ?? 1.5;                        // 48 px: 1 pixel da arte = 1 do jogo = 2 da tela
    const ox = this.grid.originX - sc.arena.x * S;
    const oy = this.grid.originY - sc.arena.y * S;
    const add = (o) => { this.hdLayer.push(o); return o; };
    this.mapRect = new Phaser.Geom.Rectangle(ox, oy, 720 * S, 801 * S);
    add(this.add.image(ox, oy, sc.map).setOrigin(0).setScale(S / (sc.res || 1)).setDepth(0));   // res: mapa pintado em 2×
    for (const part of [sc.water, sc.hoist]) {
      if (part && this.anims.exists(part.anim)) {
        const spr = add(animSprite(this, ox + part.x * S, oy + part.y * S, part.anim).setOrigin(0).setScale(S / (part.res || 1)).setDepth(0.2).play(part.anim));
        if (part.add) spr.setBlendMode(Phaser.BlendModes.ADD);   // correnteza pintada: só os reflexos, somados à água
      }
    }
    const light = (x, y, r, tint, alpha) => add(this.add.image(ox + x * S, oy + y * S, 'fx_glow')
      .setScale((S * r) / 16).setTint(tint).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.6));
    sc.lamps.forEach(([x, y, r], i) => {
      const g = light(x, y, r, sc.lampTint ?? 0xffb050, 0.9);
      this.hdLights.push(g);
      if (sc.calm) {                                   // cristais: brilho que respira devagar
        this.tweens.add({ targets: g, alpha: 0.45, scale: g.scale * 0.85, duration: 1400 + (i % 5) * 260, delay: (i * 370) % 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        this.tweens.add({ targets: g, alpha: 0.6, scale: g.scale * 0.92, duration: 140 + i * 23, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
      }
    });
    sc.goldGlow.forEach(([x, y, r]) => {
      const g = light(x, y, r, sc.glowTint ?? 0xffe260, 0.8);
      this.tweens.add({ targets: g, alpha: 0.35, scale: g.scale * 1.15, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    const spark = sc.spark || 'fx_spark';
    if (this.anims.exists(spark)) {
      sc.sparks.forEach(([x, y]) => {
        add(animSprite(this, ox + x * S, oy + y * S, spark).setScale(S).setDepth(0.5)
          .play({ key: spark, repeat: -1, repeatDelay: Phaser.Math.Between(1800, 5200), delay: Phaser.Math.Between(0, 4000) }));
      });
    }
    const cartAnim = sc.cart?.anim || 'fx_cart';
    if (sc.cart && this.anims.exists(cartAnim)) {
      const cart = add(animSprite(this, -60, oy + sc.cart.y * S, cartAnim).setOrigin(0).setScale(S).setDepth(0.4).play(cartAnim));
      this.tweens.add({ targets: cart, x: BALANCE.screen.width + 20, duration: 11000, delay: 2500, repeat: -1, repeatDelay: 9000 });
    }
    if (sc.painted) this.paintedLife(add);
  }

  // Cenário pintado: vida por cima da imagem parada — sombras de nuvem passando e borboletas voando pelo campo.
  paintedLife(add) {
    const r = this.mapRect;
    if (!this.textures.exists('soft_blob')) {
      const c = this.textures.createCanvas('soft_blob', 128, 128);
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); c.refresh();
    }
    if (!this.textures.exists('butterfly')) {
      const c = this.textures.createCanvas('butterfly', 20, 16);
      const ctx = c.getContext();
      const wing = (x, y, rx, ry, col) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#4a2030'; ctx.stroke(); };
      wing(5.5, 5.5, 4.5, 4.5, '#ff8ac8'); wing(14.5, 5.5, 4.5, 4.5, '#ff8ac8');
      wing(6.5, 11.5, 3.2, 3, '#ffd35a'); wing(13.5, 11.5, 3.2, 3, '#ffd35a');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(4.5, 4.5, 1.3, 0, Math.PI * 2); ctx.arc(15.5, 4.5, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a1a24'; ctx.fillRect(9, 2, 2, 12);
      c.refresh();
    }
    // Sombras de nuvem atravessando o campo devagar.
    for (let i = 0; i < 2; i++) {
      const sh = add(this.add.image(r.x - 260, r.y + r.height * (0.25 + 0.45 * i), 'soft_blob')
        .setDisplaySize(420, 300).setAlpha(0.18).setDepth(0.3));
      this.tweens.add({ targets: sh, x: r.x + r.width + 260, y: sh.y + 80, duration: 26000 + i * 7000, delay: i * 11000, repeat: -1 });
    }
    // Borboletas: voam de um ponto a outro do campo, batendo as asas.
    // Borboletas só onde faz sentido (não na neve nem no gelo).
    const nb = HD_SCENES[this.themeKey]?.butterflies === false ? 0 : 3;
    for (let i = 0; i < nb; i++) {
      const b = add(this.add.image(r.x + r.width * Math.random(), r.y + 80 + (r.height - 160) * Math.random(), 'butterfly')
        .setScale(1.6).setDepth(2400));
      this.tweens.add({ targets: b, scaleX: 0.4, duration: 110, yoyo: true, repeat: -1, delay: i * 40 });
      const hop = () => {
        if (!b.active) return;
        const tx = Phaser.Math.Clamp(b.x + Phaser.Math.Between(-160, 160), r.x + 60, r.x + r.width - 60);
        const ty = Phaser.Math.Clamp(b.y + Phaser.Math.Between(-120, 120), r.y + 70, r.y + r.height - 60);
        this.tweens.add({ targets: b, x: tx, y: ty, duration: Phaser.Math.Between(2200, 4200), ease: 'Sine.easeInOut',
          onUpdate: (tw) => { b.y += Math.sin(tw.elapsed / 160) * 0.35; }, onComplete: hop });
      };
      hop();
    }
  }

  // Objeto com animação parada (brilho, folhas balançando) quando a arte tem.
  objectSprite(type, x, y) {
    const key = this.objectTexture(type);
    const spr = this.add.sprite(x, y, key);
    const idle = this.anims.get(`${key}_idle`);
    if (idle) spr.play({ key: idle.key, startFrame: Phaser.Math.Between(0, idle.frames.length - 1) });
    // Árvore pintada (sem quadros de animação): balança de leve com o vento.
    else if (type === 'tree' && HD_SCENES[this.themeKey]?.sway) {
      this.tweens.add({ targets: spr, angle: { from: -3.5, to: 3.5 }, duration: Phaser.Math.Between(1500, 2200), yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 1500) });
    }
    return spr;
  }

  objectTexture(type) {
    if (type === 'chest') {
      const ck = HD_SCENES[this.themeKey]?.objects?.chest;   // cenário pintado tem o próprio baú
      return ck && this.textures.exists(ck) ? ck : 'chest';
    }
    const zoneKey = HD_SCENES[this.themeKey]?.objects?.[type];
    if (zoneKey && this.textures.exists(zoneKey)) return zoneKey;
    const legacy = `${type}_w${economy.arenaWorld}`;
    if (this.textures.exists(legacy)) return legacy;
    // Cenário ainda baixando (e o antigo já saiu da memória): usa a arte de outro cenário até a dele chegar.
    for (const sc of Object.values(HD_SCENES)) {
      const k = sc.objects?.[type];
      if (k && this.textures.exists(k)) return k;
    }
    return legacy;
  }

  // Arte da zona chegou depois de a fase começar: troca o desenho dos objetos que já estão em campo.
  refreshObjectArt() {
    this.grid.objects.forEach((o) => {
      if (!o?.sprite || o.type === 'boss') return;
      const key = this.objectTexture(o.type);
      const k = o.dmgStage ? `${key}_d${o.dmgStage}` : key;
      if (!this.textures.exists(k)) return;
      o.sprite.stop();
      o.sprite.setTexture(k);
      const idle = !o.dmgStage && this.anims.get(`${key}_idle`);
      if (idle) o.sprite.play({ key: idle.key, startFrame: Phaser.Math.Between(0, idle.frames.length - 1) });
    });
  }

  // Ordem de download dos cenários: zonas seguintes deste mundo, depois os próximos mundos.
  // Só o mundo atual e o começo do próximo: não enche a memória do celular com cenários longe.
  prefetchOrder() {
    const w = economy.world;
    const out = [0, 1, 2].map((z) => `${w}_${z}`);
    if (w + 1 < WORLDS.length) out.push(`${w + 1}_0`);
    if (economy.endlessUnlocked()) out.push('abyss');
    if (economy.mode === 'endless') out.unshift('abyss');
    return out;
  }

  // ---------- Clima, hora do dia e arena do chefe ----------
  buildAmbienceLayers() {
    const W = BALANCE.screen.width;
    const Hs = BALANCE.screen.height;
    this.tintLayer = this.add.rectangle(0, 0, W, Hs, 0xffffff).setOrigin(0).setDepth(2800)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    if (!this.textures.exists('vignette')) {
      const c = this.textures.createCanvas('vignette', 256, 256);
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      c.refresh();
    }
    const L = BALANCE.layout;
    this.vignette = this.add.image(W / 2, L.arenaY + L.arenaH / 2, 'vignette')
      .setDisplaySize(W * 1.05, L.arenaH * 1.05).setDepth(2810).setAlpha(0).setVisible(false);
    this.weather = null;
  }

  setAmbience() {
    const world = economy.arenaWorld;
    const zone = economy.arenaZone;
    const info = ZONES[world]?.[zone] || {};
    const boss = this.isBossStage();
    const phase = 0;                                   // sempre de dia
    this.dayPhase = phase;
    const tint = boss ? 0xffc4b8 : [0xffffff, 0xffd8b0, 0x8494d0][phase];
    this.tintLayer.setFillStyle(tint).setVisible(tint !== 0xffffff);
    this.tweens.killTweensOf(this.vignette);
    if (boss) {
      this.vignette.setVisible(true).setTint(0x5a0a0a).setAlpha(0.55);
      this.tweens.add({ targets: this.vignette, alpha: 0.8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (phase === 2) {
      this.vignette.setVisible(true).setTint(0x0a1030).setAlpha(0.6);
    } else {
      this.vignette.setVisible(false);
    }
    // À noite as lâmpadas ficam por cima da escuridão e brilham mais.
    (this.hdLights || []).forEach((g) => g.setDepth(phase === 2 || boss ? 2805 : 0.6));
    const sceneWeather = HD_SCENES[economy.arenaScene]?.weather;
    this.setWeather(boss ? 'boss' : economy.mode === 'endless' ? (sceneWeather || 'motes') : info.weather, phase);
  }

  setWeather(kind, phase) {
    this.weather?.destroy();
    this.weather = null;
    if (!kind) return;
    const r = this.mapRect || new Phaser.Geom.Rectangle(0, BALANCE.layout.arenaY, BALANCE.screen.width, BALANCE.layout.arenaH);
    const top = new Phaser.Geom.Rectangle(r.x, r.y - 20, r.width, 10);
    const all = new Phaser.Geom.Rectangle(r.x, r.y, r.width, r.height);
    const left = new Phaser.Geom.Rectangle(r.x - 20, r.y, 10, r.height);
    const bottom = new Phaser.Geom.Rectangle(r.x, r.y + r.height - 10, r.width, 10);
    const zone = (rect) => ({ type: 'random', source: rect });
    const ADD = Phaser.BlendModes.ADD;
    const C = {
      snow: { emitZone: zone(top), speedY: { min: 25, max: 55 }, speedX: { min: -18, max: 18 }, scale: { min: 0.5, max: 1.1 }, lifespan: 26000, frequency: 90, tint: 0xffffff, alpha: { start: 0.95, end: 0.6 } },
      petals: { emitZone: zone(top), speedY: { min: 18, max: 34 }, speedX: { min: 8, max: 30 }, scale: { min: 0.6, max: 0.9 }, lifespan: 30000, frequency: 700, tint: [0xffc0d8, 0xffffff, 0xfff0a0], rotate: { min: 0, max: 360 } },
      leaves: { emitZone: zone(top), speedY: { min: 20, max: 40 }, speedX: { min: -10, max: 30 }, scale: { min: 0.7, max: 1.1 }, lifespan: 26000, frequency: 520, tint: [0xd86a2a, 0xe8a030, 0xb0402a, 0xc8b040], rotate: { start: 0, end: 540 } },
      chaff: { emitZone: zone(left), speedX: { min: 30, max: 60 }, speedY: { min: -6, max: 10 }, scale: { min: 0.4, max: 0.8 }, lifespan: 16000, frequency: 600, tint: [0xe4bc48, 0xf4d878], alpha: 0.85 },
      dust: { emitZone: zone(left), speedX: { min: 40, max: 80 }, speedY: { min: -8, max: 8 }, scale: { min: 0.4, max: 0.9 }, lifespan: 12000, frequency: 420, tint: 0xe8d0a8, alpha: { start: 0.5, end: 0 } },
      sand: { emitZone: zone(left), speedX: { min: 60, max: 120 }, speedY: { min: -6, max: 12 }, scale: { min: 0.4, max: 1 }, lifespan: 9000, frequency: 160, tint: [0xe0a060, 0xc87848], alpha: { start: 0.6, end: 0 } },
      fireflies: { emitZone: zone(all), speed: { min: 4, max: 16 }, scale: { start: 0.9, end: 0.2 }, lifespan: { min: 2200, max: 4200 }, frequency: phase === 2 ? 160 : 520, tint: 0xd8ff78, blendMode: ADD, alpha: { start: 1, end: 0 } },
      spores: { emitZone: zone(bottom), speedY: { min: -14, max: -30 }, speedX: { min: -8, max: 8 }, scale: { min: 0.5, max: 0.9 }, lifespan: 30000, frequency: 450, tint: [0xffd890, 0xc8ff90], blendMode: ADD, alpha: { start: 0.9, end: 0 } },
      glints: { emitZone: zone(all), speed: 0, scale: { start: 1.2, end: 0 }, lifespan: 700, frequency: 260, tint: [0xffffff, 0xa8e8ff], blendMode: ADD },
      embers: { emitZone: zone(bottom), speedY: { min: -30, max: -70 }, speedX: { min: -12, max: 12 }, scale: { start: 0.9, end: 0.2 }, lifespan: 16000, frequency: 260, tint: [0xff8a30, 0xffc040, 0xff5a20], blendMode: ADD, alpha: { start: 1, end: 0 } },
      motes: { emitZone: zone(all), speedY: { min: -8, max: -22 }, speedX: { min: -6, max: 6 }, scale: { start: 0.9, end: 0 }, lifespan: { min: 3000, max: 6000 }, frequency: 220, tint: [0xb48cff, 0x8af0ff, 0xffffff], blendMode: ADD },
      abyss: { emitZone: zone(all), speedY: { min: -6, max: -18 }, speedX: { min: -5, max: 5 }, scale: { start: 0.8, end: 0 }, lifespan: { min: 4000, max: 7000 }, frequency: 300, tint: [0x6ff0ff, 0xaaf0ff, 0x9e72ea], blendMode: ADD, alpha: { start: 0.9, end: 0 } },
      boss: { emitZone: zone(bottom), speedY: { min: -40, max: -90 }, speedX: { min: -14, max: 14 }, scale: { start: 1, end: 0.2 }, lifespan: 12000, frequency: 120, tint: [0xff5a30, 0xff9a40, 0xffd060], blendMode: ADD, alpha: { start: 1, end: 0 } },
    }[kind];
    if (!C) return;
    this.weather = this.add.particles(0, 0, 'spark', C).setDepth(2850);
    // Começa como se já estivesse caindo há um tempo.
    if (C.lifespan > 5000) this.weather.fastForward(Math.min(20000, C.lifespan));
  }

  // Fase de chefe: última fase do mundo, na campanha.
  isBossStage() {
    return economy.mode === 'campaign' && economy.stage === BALANCE.stage.stagesPerWorld;
  }

  // Opções de geração da fase conforme o modo.
  stageOptions() {
    if (economy.mode === 'endless') return { endlessDepth: economy.endlessDepth };
    if (economy.mode === 'colossus') {
      return { bossOnly: true, bossHp: BALANCE.colossus.hp, bossArmor: COLOSSI[economy.colossusVariant()].armor };
    }
    return { boss: this.isBossStage() };
  }

  // Barra de vida acima do objeto (aparece no primeiro dano; no chefe, desde o início).
  ensureBar(o) {
    if (o.bar || economy.mode === 'colossus') return;
    if (o.type === 'boss' && HD_BOSSBAR && this.textures.exists('ui_boss_bar') && this.textures.exists('ui_boss_fill')) {
      this.bossBar(o);
      return;
    }
    const big = o.type === 'boss';
    const w = big ? 150 : 36;
    const y = o.sprite.y - (big ? 9 * BOSS_SCALE + 6 : 28);
    const depth = 2800;
    o.bar = {
      bg: this.add.rectangle(o.sprite.x - w / 2, y, w, big ? 12 : 6, 0x120a1e).setOrigin(0, 0.5).setDepth(depth),
      fill: this.add.rectangle(o.sprite.x - w / 2, y, w, big ? 12 : 6, big ? 0xe0563b : 0x6fd36b).setOrigin(0, 0.5).setDepth(depth + 1),
    };
  }

  // Barra pintada do chefe: um pouco mais estreita que ele, acima do ponto mais alto que ele alcança
  // (punhos levantados no golpe), para não encostar nele. O recheio desce animado de 100% até 5%
  // (a partir daí o próximo golpe destrói o chefe e a barra some junto).
  bossBar(o) {
    const B = HD_BOSSBAR;
    const spr = o.sprite;
    const f = spr.frame;
    const dispW = f.width * BOSS_SCALE;                 // tamanho final na tela (o sprite ainda está crescendo)
    const dispH = f.height * BOSS_SCALE;
    const pivot = f.customPivot ? f.pivotY : 0.5;
    const topFrac = HD_BOSSES?.[spr.texture.key]?.top ?? 0;
    const bodyW = dispW * (HD_BOSSES?.[spr.texture.key] ? 0.94 : 1);   // quadro pintado tem uma pequena sobra dos lados
    const s = (bodyW * 0.88) / B.w;
    const reach = spr.y - (pivot - topFrac) * dispH;    // ponto mais alto do chefe
    const x = spr.x;
    const y = reach - 6 - (B.h * s) / 2;
    const depth = 2800;
    const bg = this.add.image(x, y, 'ui_boss_bar').setScale(s).setDepth(depth);
    const fill = this.add.image(x, y, 'ui_boss_fill').setScale(s).setDepth(depth + 1);
    fill.setCrop(0, 0, B.w, B.h);
    o.bar = { bg, fill, painted: true, shown: 1 };
    bg.setAlpha(0); fill.setAlpha(0);
    this.tweens.add({ targets: [bg, fill], alpha: 1, duration: 400, delay: 300 });
  }

  updateBar(o) {
    if (!o.bar) return;
    const r = Phaser.Math.Clamp(o.hp / o.maxHp, 0, 1);
    if (o.bar.painted) {
      const B = HD_BOSSBAR;
      const to = o.hp > 0 ? Math.max(0.05, r) : 0;
      const setW = (v) => o.bar?.fill.setCrop(0, 0, B.x0 + (B.x1 - B.x0) * v, B.h);
      if (o.bar.tween) o.bar.tween.stop();
      o.bar.tween = this.tweens.addCounter({ from: o.bar.shown, to, duration: 260, ease: 'Sine.easeOut',
        onUpdate: (t) => { o.bar && (o.bar.shown = t.getValue()); setW(t.getValue()); } });
      return;
    }
    o.bar.fill.scaleX = r;
    if (o.type !== 'boss') o.bar.fill.setFillStyle(r > 0.5 ? 0x6fd36b : r > 0.25 ? 0xe8b84a : 0xe0563b);
  }

  clearBar(o) {
    if (!o.bar) return;
    o.bar.tween?.stop();
    o.bar.bg.destroy();
    o.bar.fill.destroy();
    o.bar = null;
  }

  buildStage() {
    this.grid.objects.forEach((o) => {
      if (!o) return;
      if (o.sprite) this.tweens.killTweensOf(o.sprite);
      o.sprite?.destroy();
      o.shadow?.destroy();
      o.crack?.destroy();
      o.fx?.forEach((f) => { this.tweens.killTweensOf(f); f.destroy(); });
      o.fx = null;
      this.clearBar(o);
    });

    this.applyTheme(economy.arenaWorld, economy.arenaZone, economy.arenaScene);
    // Fica na memória só o mundo atual (+ começo do próximo e o Abismo); o resto sai e volta se precisar.
    releaseGroups(this, new Set([this.themeKey, ...this.prefetchOrder()]));
    if (this.stageBuiltOnce) prefetchGroups(this, this.prefetchOrder());   // na abertura, o pré-carregamento espera 2,5 s
    this.stageBuiltOnce = true;
    const objs = this.grid.generate(economy.world, economy.stage, economy.difficulty, this.stageOptions());
    const spawnTile = BALANCE.stage.spawn[0];
    this.boss = null;
    objs.forEach((o) => {
      const p = this.grid.toWorld(o.x, o.y);
      if (o.type === 'boss') {
        // O chefe fica assentado no chão: a base de pedra encosta no pé da linha de baixo das casas dele.
        // (o quadro tem o pivô no meio; a base fica a 8,3 px de arte abaixo do centro, × escala)
        const groundY = p.y + this.grid.tile / 2 - 4;
        const cy = groundY - 8.3 * BOSS_SCALE;
        // Chefe pintado já traz a sombra no desenho.
        if (!this.anims.exists(`${this.objectTexture('boss')}_slam`)) {
          o.shadow = this.add.ellipse(p.x, groundY - 2, 150, 30, 0x000000, 0.38).setDepth(this.depthFor(o.y, 0.5));
        }
        o.groundY = groundY;
        o.sprite = this.objectSprite('boss', p.x, cy).setScale(0).setDepth(this.depthFor(o.y, 9));
        this.tweens.add({ targets: o.sprite, scale: BOSS_SCALE, duration: 500, ease: 'Back.easeOut' });
        this.boss = o;
        if (HD_BOSSES?.[o.sprite.texture.key]?.final) this.finalBossFx(o, p.x, cy, groundY);
        this.ensureBar(o);
        return;
      }
      o.sprite = this.objectSprite(o.type, p.x, p.y).setScale(0).setDepth(this.depthFor(o.y, 1));
      const d = Math.abs(o.x - spawnTile[0]) + Math.abs(o.y - spawnTile[1]);
      this.tweens.add({
        targets: o.sprite, scale: BALANCE.grid.spriteScale, duration: 220, delay: d * 25, ease: 'Back.easeOut',
      });
    });
    this.bossTime = BALANCE.boss.timeSec;
    this.stageStart = this.time.now;
    this.setAmbience();

    this.stageGold = 0;
    this.stageClearing = false;
    this.game.events.emit('stage-start');
    this.emitProgress();
  }

  emitProgress() {
    const { total, remaining } = this.grid;
    this.game.events.emit('stage-progress', total - remaining, total);
  }

  // ---------- Quem está em campo ----------
  onFieldSet() {
    return new Set(this.field.keys());
  }

  freeSpawnTile() {
    const taken = new Set([...this.field.values()].map((b) => this.grid.idx(b.tx, b.ty)));
    for (const [x, y] of BALANCE.stage.spawn) {
      if (!taken.has(this.grid.idx(x, y))) return [x, y];
    }
    return BALANCE.stage.spawn[0];
  }

  spawnBomber(hero, delay = 300) {
    const [x, y] = this.freeSpawnTile();
    const b = new Bomber(this, hero, x, y);
    this.field.set(hero.uid, b);
    b.placeAt(x, y);
    b.later(delay, () => b.think());
    this.game.events.emit('field-changed');
    return b;
  }

  removeBomber(b, bench) {
    this.field.delete(b.uid);
    if (bench) this.benched.add(b.uid);
    b.destroy();
    this.game.events.emit('field-changed');
  }

  // Chamado pelo herói cansado depois de sair do campo.
  onBomberLeft(b) {
    this.removeBomber(b, true);
    this.queueSync();
  }

  queueSync() {
    if (this.syncQueued) return;
    this.syncQueued = true;
    this.time.delayedCall(30, () => {
      this.syncQueued = false;
      this.syncField();
    });
  }

  heroReady(h) {
    return h.energy >= BALANCE.teams.readyRatio * maxEnergy(h);
  }

  // Coloca/tira heróis para bater com a equipe ativa. Sem ninguém em campo, gira a equipe.
  syncField() {
    if (this.stageClearing) return;
    const team = economy.activeTeam;
    for (const b of [...this.field.values()]) {
      const h = economy.heroByUid(b.uid);
      if (!h || h !== b.hero || h.team !== team) this.removeBomber(b, false);
    }
    this.fillFromTeam(team);
    if (this.field.size === 0) this.tryRotate();
    else this.setWaiting(false);
  }

  fillFromTeam(team) {
    for (const h of economy.teamMembers(team)) {
      if (this.field.size >= economy.teamSlots) break;
      if (this.field.has(h.uid) || this.benched.has(h.uid) || !this.heroReady(h)) continue;
      this.spawnBomber(h, 300 + this.field.size * 150);
    }
  }

  // Procura a próxima equipe pronta (A → B → C → A). A atual entra por último.
  tryRotate() {
    const n = BALANCE.teams.count;
    for (let k = 1; k <= n; k++) {
      const t = (economy.activeTeam + k) % n;
      if (!economy.teamUnlocked(t) || !economy.teamMembers(t).some((h) => this.heroReady(h))) continue;
      const changed = t !== economy.activeTeam;
      economy.activeTeam = t;
      this.benched.clear();
      this.fillFromTeam(t);
      if (changed) this.game.events.emit('team-rotated', t);
      this.setWaiting(false);
      return;
    }
    this.setWaiting(true);
  }

  setWaiting(v) {
    if (this.waiting === v) return;
    this.waiting = v;
    this.game.events.emit('waiting', v);
  }

  energyTick(dt) {
    // Chefe Cristal: se não cair no tempo, regenera toda a vida.
    if (this.boss && !this.stageClearing && economy.mode === 'campaign') {
      this.bossTime -= dt;
      if (this.bossTime <= 0) {
        this.boss.hp = this.boss.maxHp;
        this.updateBar(this.boss);
        this.bossTime = BALANCE.boss.timeSec;
        this.game.events.emit('boss-regen');
      }
    }
    // Colosso: 2 minutos para causar o máximo de dano.
    if (economy.mode === 'colossus' && !this.stageClearing) {
      this.colossusTime -= dt;
      if (this.colossusTime <= 0) this.endColossus();
    }
    // Abismo: o relógio da profundidade corre mesmo com as equipes descansando.
    if (economy.mode === 'endless' && !this.stageClearing) {
      this.endlessTime -= dt;
      this.game.events.emit('endless-tick');
      if (this.endlessTime <= 0) this.endEndless();
    }

    // Média móvel do ouro por segundo (base do ganho offline).
    const k = BALANCE.offline.rateSmoothing;
    economy.goldRate = economy.goldRate * (1 - k) + (this.tickGold / dt) * k;
    this.tickGold = 0;

    const onField = this.onFieldSet();
    assignCapsules(onField, (economy.activeTeam + 1) % BALANCE.teams.count);
    recover(dt, onField);
    this.game.events.emit('energy-tick');
    if (!this.stageClearing && (this.field.size === 0 || this.field.size < economy.teamSlots)) this.syncField();
  }

  // ---------- Efeitos de papel ----------
  updateAuraGlow() {
    for (const b of this.field.values()) b.setBuffed(!b.leaving && this.auraEffects(b).attackPct > 0);
  }

  tapField(p) {
    const reach = this.grid.tile * 0.9;
    let best = null;
    let bestD = reach;
    for (const b of this.field.values()) {
      if (!b.ring) continue;
      const c = b.center;
      const d = Math.hypot(p.worldX - c.x, p.worldY - c.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    best?.showAura();
  }


  // Efeitos de aura dos Suportes próximos: o maior de cada tipo vale, não acumula.
  auraEffects(bomber) {
    const fx = { attackPct: 0, energySave: 0, speedPct: 0, luck: 0, fusePct: 0 };
    for (const s of this.field.values()) {
      if (s === bomber || !s.stats.auraRadius) continue;
      if (Math.abs(s.tx - bomber.tx) + Math.abs(s.ty - bomber.ty) > s.stats.auraRadius) continue;
      const ab = s.stats.abil;
      fx.attackPct = Math.max(fx.attackPct, s.stats.auraPct);
      fx.energySave = Math.max(fx.energySave, ab.stamina || 0);
      fx.speedPct = Math.max(fx.speedPct, ab.haste || 0);
      fx.luck = Math.max(fx.luck, ab.blessing || 0);
      fx.fusePct = Math.max(fx.fusePct, ab.quickFuse || 0);
    }
    return fx;
  }

  collectMult(obj) {
    let mult = 1;
    for (const c of this.field.values()) {
      if (c.stats.collect > 0 && manhattan(c, obj) <= c.stats.collectRadius) mult += c.stats.collect;
    }
    return mult;
  }

  // ---------- Dano e destruição ----------
  damageObject(o, dmg, owner) {
    if (o.hp <= 0) return;
    if (economy.mode === 'colossus' && o.type === 'boss') this.colossusDamage += Math.min(dmg, o.hp);
    o.hp -= dmg;
    if (o.hp <= 0.001) {
      o.hp = 0;
      this.destroyObject(o, owner);
      return;
    }
    // Pisca branco ao levar dano; o chefe pintado (grande) só avermelha, para não virar um vulto branco.
    if (o.type === 'boss' && this.anims.exists(`${o.sprite.texture.key}_slam`)) o.sprite.setTint(0xffa890);
    else o.sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => o.sprite?.clearTint());
    this.ensureBar(o);
    this.updateBar(o);
    if (o.type === 'boss') { this.bossSlam(o); return; }
    const ratio = o.hp / o.maxHp;
    // Arte 32 px: o próprio desenho muda (rachado, depois lascado) em vez da rachadura por cima.
    const key = this.objectTexture(o.type);
    if (isHd(this, key)) {
      const stage = ratio <= 0.34 ? 2 : ratio <= 0.67 ? 1 : 0;
      if (stage && o.dmgStage !== stage && this.textures.exists(`${key}_d${stage}`)) {
        o.dmgStage = stage;
        o.sprite.stop();
        o.sprite.setTexture(`${key}_d${stage}`);
      }
      return;
    }
    const crackKey = ratio <= 0.34 ? 'crack_2' : ratio <= 0.67 ? 'crack_1' : null;
    if (crackKey) {
      if (!o.crack) {
        o.crack = this.add.image(o.sprite.x, o.sprite.y, crackKey)
          .setScale(BALANCE.grid.spriteScale).setDepth(o.sprite.depth + 0.5);
      } else {
        o.crack.setTexture(crackKey);
      }
    }
  }

  // Chefe pintado: não sai do lugar. Bate no chão em golpes alternados: um ataque recebido faz o golpe,
  // o seguinte só o faz piscar, o próximo golpeia de novo (os ataques durante o golpe não contam).
  bossSlam(o) {
    const spr = o.sprite;
    const key = spr.texture.key;
    const slam = this.anims.get(`${key}_slam`);
    if (!slam || o.slamming) return;
    if (o.slamRest) { o.slamRest = false; return; }
    o.slamming = true;
    spr.play(slam.key);
    spr.off('animationupdate').on('animationupdate', (anim, frame) => {
      if (anim.key === slam.key && String(frame.textureFrame) === BOSS_IMPACT_FRAME) this.bossImpact(o);
    });
    spr.off('animationcomplete').on('animationcomplete', (anim) => {
      if (anim.key !== slam.key || !o.sprite) return;
      o.slamming = false;
      o.slamRest = true;
      const idle = this.anims.get(`${key}_idle`);
      if (idle) spr.play(idle.key);
    });
  }

  // Chefe final (Soberano de Ametista): aura de luz pulsando atrás dele e brilhos lilases subindo o tempo todo.
  // Só visual: nada disso causa dano.
  finalBossFx(o, x, cy, groundY) {
    o.fx = [];
    const depth = o.sprite.depth - 0.2;
    // brilho redondo suave (centro claro → transparente), desenhado uma vez
    const glow = (key, size) => {
      if (this.textures.exists(key)) return;
      const c = this.textures.createCanvas(key, size, size);
      const g = c.context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.context.fillStyle = g;
      c.context.fillRect(0, 0, size, size);
      c.refresh();
      c.setFilter(Phaser.Textures.FilterMode.LINEAR);
    };
    glow('fx_aura', 256);
    glow('fx_mote', 32);
    {
      const aura = this.add.image(x, cy - 10, 'fx_aura').setDisplaySize(300, 330).setTint(0xb070ff)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(depth);
      this.tweens.add({ targets: aura, alpha: 0.6, duration: 500, delay: 300 });
      this.tweens.add({ targets: aura, scaleX: aura.scaleX * 1.12, scaleY: aura.scaleY * 1.12, duration: 1300,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 800 });
      const floor = this.add.image(x, groundY - 6, 'fx_aura').setDisplaySize(260, 70).setTint(0xd090ff)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(this.depthFor(o.y, 0.6));
      this.tweens.add({ targets: floor, alpha: 0.25, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const motes = this.add.particles(0, 0, 'fx_mote', {
        x: { min: x - 110, max: x + 110 }, y: { min: groundY - 40, max: groundY },
        speedY: { min: -35, max: -70 }, speedX: { min: -8, max: 8 }, lifespan: 2600, frequency: 110,
        scale: { start: 0.55, end: 0 }, alpha: { start: 0.95, end: 0 }, tint: [0xd8a8ff, 0xffe0a0, 0xb070ff],
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(o.sprite.depth + 0.3);
      o.fx.push(aura, floor, motes);
    }
  }

  // Punhos no chão: tremida curta e poeira dos dois lados.
  bossImpact(o) {
    if (!o.sprite) return;
    if (o.fx?.length) {
      // Explosão de luz do chefe final: clarão lilás e uma onda de luz se espalhando pelo chão (sem dano).
      this.cameras.main.flash(220, 200, 150, 255);
      const y = o.groundY ?? o.sprite.y + 60;
      for (let i = 0; i < 2; i++) {
        const ring = this.add.ellipse(o.sprite.x, y - 6, 60, 22).setStrokeStyle(6 - i * 2, i ? 0xffe0a0 : 0xd8a0ff)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depthFor(o.y, 0.7));
        this.tweens.add({ targets: ring, scaleX: 9, scaleY: 9, alpha: 0, duration: 700 + i * 200, delay: i * 120,
          ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      }
    }
    this.cameras.main.shake(140, 0.004);
    const y = o.groundY ?? o.sprite.y + 60;
    this.debris.boss.explode(6, o.sprite.x - 55, y - 6);
    this.debris.boss.explode(6, o.sprite.x + 55, y - 6);
  }

  destroyObject(o, owner) {
    const { grid } = this;
    (o.tiles || [[o.x, o.y]]).forEach(([x, y]) => { grid.objects[grid.idx(x, y)] = null; });
    o.shadow?.destroy();
    grid.remaining -= 1;
    economy.bump('objects');
    if (o.type === 'chest') economy.bump('chestObjects');
    const { x, y } = o.sprite;
    this.debris[o.type].explode(BALANCE.juice.debrisCount, x, y);
    if (o.type === 'boss') {
      this.tweens.killTweensOf(o.sprite);
      o.sprite.off('animationupdate').off('animationcomplete');
      o.fx?.forEach((f) => { this.tweens.killTweensOf(f); f.destroy(); });
      o.fx = null;
      this.cameras.main.shake(400, 0.012);
      this.debris.boss.explode(40, x, y);
      this.boss = null;
    }
    o.sprite.destroy();
    o.sprite = null;
    o.crack?.destroy();
    o.crack = null;
    this.clearBar(o);
    this.loot.drop(o, x, y, owner);
    this.emitProgress();
    if (grid.remaining <= 0) this.stageClear();
  }

  // ---------- Fim de fase ----------
  stageClear() {
    if (this.stageClearing) return;
    this.stageClearing = true;
    this.bombs.clearAll();
    for (const b of [...this.field.values()]) {
      if (b.leaving) this.removeBomber(b, true);
      else { b.halt(); b.celebrate(); }
    }

    Sfx.play('clear');
    if (economy.mode === 'endless') { this.endlessCleared(); return; }

    // Estrelas por tempo (antes de avançar a fase).
    const elapsed = this.stageElapsed();
    const stars = this.starsFor(elapsed);
    const st = economy.recordStars(stars);
    if (st.gained) economy.addCrystals(st.gained * BALANCE.stage.starCrystal);
    if (st.newMilestones) {
      economy.addRewardChests(st.newMilestones);
      economy.addKeys(st.newMilestones);
      for (let i = 0; i < st.newMilestones; i++) addRandomGem();
    }
    const wasBoss = this.isBossStage();
    // Passe de Temporada: XP por fase (e chefe), com limite por dia.
    addPassXp(passXp('stage') + (wasBoss ? passXp('boss') : 0), 'stage');

    const L = BALANCE.loot;
    const rec = economy.recordClear();
    const n = economy.stagesCleared;
    // Cristal e gaiola da fase: só na 1ª vez. A árvore (Garimpeiro) dá uma chance em qualquer vitória.
    const crystals = (rec.first ? L.stageClearCrystals : 0) + (Math.random() < economy.treeSum('crystalStage') ? 1 : 0);
    const cages = (rec.first && economy.stage % L.cageEveryStages === 0 ? 1 : 0) + (wasBoss && rec.first ? BALANCE.boss.cages || 0 : 0);
    const keys = n % L.keyEveryStages === 0 ? 1 : 0;
    const chest = rec.first && economy.stage % L.rewardChestEvery === 0 ? 1 : 0;
    if (chest) economy.addRewardChests(chest);
    if (wasBoss && rec.first) {
      economy.addCrystals(BALANCE.boss.crystals);
      addRandomGem();
    }
    const sealed = Math.random() < BALANCE.items.stageSealedChance ? 1 : 0;
    if (sealed) economy.addSealed(1, currentItemLevel(), economy.world);
    this.loot.stageReward(crystals, cages, keys);
    this.game.events.emit('stage-clear', {
      gold: this.stageGold, crystals, cages, keys, chest, sealed, stars, starsGained: st.gained,
      milestones: st.newMilestones, worldStars: st.total, boss: wasBoss, time: elapsed, ...rec,
    });

    this.stageTimer = this.time.delayedCall(BALANCE.stage.clearPauseMs, () => this.nextStage());
  }

  // Segundos desde o início da fase (no relógio do jogo).
  stageElapsed() {
    return Math.max(0, (this.time.now - (this.stageStart ?? this.time.now)) / 1000);
  }

  // Tempo-alvo das estrelas para a fase atual: [3★, 2★] em segundos.
  starPars() {
    const S = BALANCE.stage;
    const gi = economy.world * S.stagesPerWorld + economy.stage;
    const ease = economy.mode === 'campaign' && economy.difficulty === 0 ? earlyEase(gi, 'parMult') : 1;
    const p3 = (this.grid.total * S.starPar3PerObject + (this.isBossStage() ? S.starBossExtraSec : 0)) * ease;
    return [p3, p3 * 2];
  }

  starsFor(sec) {
    const [p3, p2] = this.starPars();
    return sec <= p3 ? 3 : sec <= p2 ? 2 : 1;
  }

  nextStage() {
    const worldChanged = economy.advance();
    SaveSystem.save(economy);
    if (worldChanged) this.game.events.emit('world-changed', economy.world);
    this.buildStage();
    const bombers = [...this.field.values()];
    bombers.forEach((b) => b.placeAt(...this.spawnTileFor(b, bombers)));
    bombers.forEach((b, i) => b.later(600 + i * 150, () => b.think()));
    this.syncField();
  }

  spawnTileFor(b, list) {
    return BALANCE.stage.spawn[list.indexOf(b) % BALANCE.stage.spawn.length];
  }

  // Recria a arena e recoloca quem está em campo.
  restage() {
    this.buildStage();
    const stay = [...this.field.values()];
    stay.forEach((b) => b.placeAt(...this.spawnTileFor(b, stay)));
    stay.forEach((b, i) => b.later(500 + i * 150, () => b.think()));
    this.syncField();
  }

  // Para a fase atual no meio (troca de modo ou de fase).
  interrupt() {
    this.stageTimer?.remove(false);
    this.stageClearing = true;
    this.bombs.clearAll();
    for (const b of [...this.field.values()]) if (b.leaving) this.removeBomber(b, true);
  }

  // ---------- Colosso da semana ----------
  colossusTriesLeft() {
    return Math.max(0, BALANCE.colossus.attemptsPerDay - (economy.daily.colossusTries || 0));
  }

  startColossus() {
    if (!economy.endlessUnlocked() || economy.mode !== 'campaign' || this.colossusTriesLeft() <= 0) return false;
    economy.ensureColossusWeek();
    economy.daily.colossusTries = (economy.daily.colossusTries || 0) + 1;
    economy.mode = 'colossus';
    this.colossusDamage = 0;
    this.colossusTime = BALANCE.colossus.timeSec;
    this.interrupt();
    this.restage();
    SaveSystem.save(economy);
    return true;
  }

  endColossus() {
    if (economy.mode !== 'colossus') return;
    const C = BALANCE.colossus;
    const damage = Math.round(this.colossusDamage);
    const tier = C.tiers.filter((t) => damage >= t).length;
    const crystals = tier * C.crystalsPerTier;
    const essence = tier * C.essencePerTier;
    const gemKey = tier >= C.gemFromTier ? addRandomGem(Math.min(BALANCE.gems.maxLevel, 1 + Math.floor(tier / 2))) : null;
    if (crystals) economy.addCrystals(crystals);
    if (essence) economy.addEssence(essence);
    economy.ensureColossusWeek();
    const newBest = damage > economy.stats.colossusWeekBest;
    if (newBest) economy.stats.colossusWeekBest = damage;
    economy.stats.colossusBestEver = Math.max(economy.stats.colossusBestEver, damage);
    economy.bump('colossusRuns');
    economy.mode = 'campaign';
    this.interrupt();
    this.restage();
    SaveSystem.save(economy);
    this.game.events.emit('colossus-end', {
      damage, tier, crystals, essence, gemKey, newBest, weekBest: economy.stats.colossusWeekBest,
      nextTier: C.tiers[tier] ?? null,
    });
  }

  // ---------- Abismo Sem Fim ----------
  startEndless() {
    if (!economy.endlessUnlocked() || economy.mode !== 'campaign') return false;
    economy.mode = 'endless';
    economy.endlessDepth = 1;
    this.endlessTime = BALANCE.endless.timeLimitSec;
    this.interrupt();
    this.restage();
    return true;
  }

  endlessCleared() {
    const E = BALANCE.endless;
    const d = economy.endlessDepth;
    economy.bump('endlessDepths');
    const newRecord = d > economy.stats.endlessBest;
    if (newRecord) economy.stats.endlessBest = d;
    economy.ensureSeason();
    if (d > economy.stats.seasonBest) economy.stats.seasonBest = d;
    const wasLeft = abyssEssenceLeft();
    const essence = grantAbyssEssence(Math.round((E.essencePerDepth + Math.floor(d / 5)) * (1 + economy.treeSum('essencePct'))));
    if (wasLeft > 0 && abyssEssenceLeft() === 0) this.game.events.emit('abyss-essence-cap');
    const chest = d % E.chestEvery === 0 ? 1 : 0;
    if (chest) {
      economy.addRewardChests(1);
      economy.addSealed(1, currentItemLevel(), economy.arenaWorld);
    }
    this.game.events.emit('stage-clear', {
      gold: this.stageGold, crystals: 0, cages: 0, keys: 0, chest, sealed: chest, essence, newRecord,
    });
    this.stageTimer = this.time.delayedCall(BALANCE.stage.clearPauseMs, () => {
      economy.endlessDepth += 1;
      this.endlessTime = E.timeLimitSec;
      SaveSystem.save(economy);
      this.restage();
    });
  }

  // Fim da descida (tempo esgotado ou desistência): volta para a campanha.
  endEndless() {
    if (economy.mode !== 'endless') return;
    const reached = economy.endlessDepth - 1;
    economy.mode = 'campaign';
    this.interrupt();
    SaveSystem.save(economy);
    this.restage();
    this.game.events.emit('endless-end', { reached, best: economy.stats.endlessBest });
  }

  // Vai para uma fase escolhida no Mapa.
  goToStage(d, w, s) {
    if (!economy.goTo(d, w, s)) return false;
    this.stageTimer?.remove(false);
    this.stageClearing = true; // impede ações dos heróis enquanto troca
    this.bombs.clearAll();
    const bombers = [...this.field.values()];
    bombers.forEach((b) => { if (b.leaving) this.removeBomber(b, true); });
    SaveSystem.save(economy);
    this.buildStage();
    const stay = [...this.field.values()];
    stay.forEach((b) => b.placeAt(...this.spawnTileFor(b, stay)));
    stay.forEach((b, i) => b.later(500 + i * 150, () => b.think()));
    this.syncField();
    return true;
  }

  // Recomeça do zero (botão "Reiniciar progresso").
  restartRun() {
    this.stageTimer?.remove(false);
    this.bombs.clearAll();
    for (const b of [...this.field.values()]) this.removeBomber(b, false);
    this.benched.clear();
    this.buildStage();
    this.syncField();
  }
}
