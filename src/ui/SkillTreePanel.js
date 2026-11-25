// Aba Habilidades: árvore da conta. Arraste para explorar; toque num nó para ver e comprar.
import { freeArt, restoreArt } from '../art/bigArt.js';
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { TREE, TREE_BY_ID, EFFECT_TEXT } from '../data/skilltree.js';
import { economy } from '../systems/Economy.js';
import { rankOf, nodeReachable, nodeCost, canBuyNode, buyNode } from '../systems/SkillTree.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card } from './widgets.js';
import { fmt } from './format.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const L = BALANCE.layout;
const VIEW_TOP = 84;     // dentro do painel
const VIEW_H = 690 + Math.max(0, (BALANCE.layout.tabsY - BALANCE.layout.arenaY - 930));   // a tela alta mostra mais da árvore
const NODE_R = 34;
const BRANCH_COLORS = { e: 0xe8b84a, s: 0x6fd36b, c: 0xff6a5a, start: 0xf4ead8 };
// Fundo de espaço (imagem ilustrada) com paralaxe: anda mais devagar que a árvore.
const SPACE_KEY = 'space_bg';
const SPACE_SIZE = 1250;
const PARALLAX = 0.4;
const TWINKLE_PARALLAX = 0.7;

const branchOf = (id) => (id === 'start' ? 'start' : id[0]);

export class SkillTreePanel extends Panel {
  constructor(scene, { onClose }) {
    super(scene, STR.treeTitle, onClose);
    this.selected = 'start';
    this.hint = txt(scene, 24, 76, STR.treeHint, 16, TXT.dim).setOrigin(0, 0.5);
    this.add(this.hint);

    // Área arrastável (o fundo recebe o arrasto).
    this.dragZone = scene.add.rectangle(0, VIEW_TOP, W, VIEW_H, 0x070a18, 1).setOrigin(0).setInteractive();
    this.space = scene.add.container(0, 0);       // imagem do espaço + estrelas piscando (com paralaxe)
    this.twinkles = scene.add.container(0, 0);
    this.canvas = scene.add.container(0, 0);
    this.lines = scene.add.graphics();
    this.canvas.add(this.lines);
    this.viewFrame = frame(scene, 0, VIEW_TOP - 2, W, VIEW_H + 4, null).setOrigin(0).setStrokeStyle(4, 0xc8962a);
    this.add([this.dragZone, this.space, this.twinkles, this.canvas, this.viewFrame]);

    this.nodes = TREE.map((n) => {
      const color = BRANCH_COLORS[branchOf(n.id)];
      const halo = scene.add.circle(n.x, n.y, NODE_R + 22, color, 0.16);
      const ring = scene.add.circle(n.x, n.y, NODE_R + 7, color, 0).setStrokeStyle(4, color, 1);
      const circle = scene.add.circle(n.x, n.y, NODE_R, 0x1b2448).setStrokeStyle(3, 0x9fb0ff, 0.45);
      const label = txt(scene, n.x, n.y, '', 18, TXT.main).setOrigin(0.5).setShadow(0, 2, '#000', 0);
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerup', (p) => this.tapNode(n.id, p));
      this.canvas.add([halo, ring, circle, label]);
      return { n, halo, ring, circle, label };
    });

    // Caixa de informação do nó escolhido.
    const by = VIEW_TOP + VIEW_H + 8;
    this.add(card(scene, 24, by, W - 48, 140, COL.gold));
    this.infoName = txt(scene, 48, by + 28, '', 24, TXT.gold).setOrigin(0, 0.5);
    this.infoRank = txt(scene, W - 48, by + 28, '', 19, TXT.main).setOrigin(1, 0.5);
    this.infoDesc = txt(scene, 48, by + 64, '', 18, TXT.main).setOrigin(0, 0.5).setWordWrapWidth(400);
    this.infoTotal = txt(scene, 48, by + 100, '', 16, TXT.good).setOrigin(0, 0.5).setWordWrapWidth(400);
    this.buyBtn = new Button(scene, 565, by + 88, 230, 70, '', () => this.doBuy(), {
      fontSize: 19,
      onDisabledClick: () => {
        const id = this.selected;
        if (nodeCost(id) === null) return;
        scene.toast.show(nodeReachable(id) ? STR.notEnoughGold : STR.treeLocked, 1600);
      },
    });
    this.add([this.infoName, this.infoRank, this.infoDesc, this.infoTotal, this.buyBtn]);

    this.setupDrag(scene);
    this.onClosed = () => freeArt(this.scene, SPACE_KEY, this.spaceImg);   // 10 MB: só na memória com a aba aberta
    this.onOpen = () => {
      this.ensureSpace();
      this.centerOn(TREE_BY_ID[this.selected]);
      this.refresh();
    };
  }

  // Máscara: só mostra a árvore dentro da área (em coordenadas da tela, painel aberto).
  ensureMask() {
    if (this.maskGfx) return;
    this.maskGfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(0, L.arenaY + VIEW_TOP, W, VIEW_H);
    const m = this.maskGfx.createGeometryMask();
    this.canvas.setMask(m);
    this.space.setMask(m);
    this.twinkles.setMask(m);
  }

  // A imagem do espaço só carrega na primeira vez que a árvore abre.
  ensureSpace() {
    const s = this.scene;
    if (this.spaceImg) { restoreArt(s, SPACE_KEY, 'assets/ui/space_bg.jpg', this.spaceImg, SPACE_SIZE, SPACE_SIZE); return; }
    if (!s.textures.exists(SPACE_KEY)) {
      if (this.spaceLoading) return;
      this.spaceLoading = true;
      s.load.image(SPACE_KEY, 'assets/ui/space_bg.jpg');
      s.load.once(`filecomplete-image-${SPACE_KEY}`, () => { this.spaceLoading = false; this.ensureSpace(); });
      s.load.start();
      return;
    }
    s.textures.get(SPACE_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.spaceImg = s.add.image(0, 0, SPACE_KEY).setOrigin(0).setDisplaySize(SPACE_SIZE, SPACE_SIZE).setAlpha(0);
    this.space.add(this.spaceImg);
    s.tweens.add({ targets: this.spaceImg, alpha: 1, duration: 400 });
    // Estrelas que piscam numa camada intermediária (dá profundidade ao arrastar).
    const rnd = new Phaser.Math.RandomDataGenerator(['arvore']);
    const tint = [0xffffff, 0xbfd4ff, 0xfff0c8, 0xd8c0ff];
    for (let i = 0; i < 34; i++) {
      const glow = s.textures.exists('fx_glow');
      const st = glow
        ? s.add.image(rnd.between(0, 1200), rnd.between(0, 1250), 'fx_glow').setScale(rnd.realInRange(0.25, 0.6))
        : s.add.circle(rnd.between(0, 1200), rnd.between(0, 1250), rnd.realInRange(1.5, 3), 0xffffff);
      st.setTint?.(rnd.pick(tint));
      st.setBlendMode(Phaser.BlendModes.ADD).setAlpha(rnd.realInRange(0.2, 0.9));
      this.twinkles.add(st);
      s.tweens.add({ targets: st, alpha: rnd.realInRange(0.05, 0.3), duration: rnd.between(900, 2600),
        yoyo: true, repeat: -1, delay: rnd.between(0, 2000), ease: 'Sine.easeInOut' });
    }
    this.moveCanvas(this.canvas.x, this.canvas.y);
  }

  setupDrag(scene) {
    let start = null;
    this.dragDist = 0;
    this.dragZone.on('pointerdown', (p) => {
      start = { x: p.worldX, y: p.worldY, cx: this.canvas.x, cy: this.canvas.y };
      this.dragDist = 0;
    });
    scene.input.on('pointermove', (p) => {
      if (!start || !p.isDown || !this.isOpen) return;
      const dx = p.worldX - start.x;
      const dy = p.worldY - start.y;
      this.dragDist = Math.max(this.dragDist, Math.abs(dx) + Math.abs(dy));
      this.moveCanvas(start.cx + dx, start.cy + dy);
    });
    scene.input.on('pointerup', () => { start = null; });
    // Arrastar começando em cima de um nó também move.
    this.nodes.forEach((v) => v.circle.on('pointerdown', (p) => {
      start = { x: p.worldX, y: p.worldY, cx: this.canvas.x, cy: this.canvas.y };
      this.dragDist = 0;
    }));
  }

  moveCanvas(x, y) {
    const minX = W - 1420;
    const minY = VIEW_TOP + VIEW_H - 1440;
    this.canvas.setPosition(Phaser.Math.Clamp(x, minX, 0), Phaser.Math.Clamp(y, minY, VIEW_TOP));
    const cx = this.canvas.x, cy = this.canvas.y - VIEW_TOP;
    this.space.setPosition(-215 + cx * PARALLAX, VIEW_TOP - 40 + cy * PARALLAX);
    this.twinkles.setPosition(-60 + cx * TWINKLE_PARALLAX, VIEW_TOP - 60 + cy * TWINKLE_PARALLAX);
  }

  centerOn(n) {
    this.moveCanvas(W / 2 - n.x, VIEW_TOP + VIEW_H / 2 - n.y);
  }

  tapNode(id, p) {
    if (this.dragDist > 12) return; // foi arrasto, não toque
    // Ignora toques fora da área visível (a máscara não bloqueia toques).
    const top = L.arenaY + VIEW_TOP;
    if (p.worldY < top || p.worldY > top + VIEW_H) return;
    this.selected = id;
    this.refresh();
  }

  doBuy() {
    const n = TREE_BY_ID[this.selected];
    if (buyNode(n.id)) {
      this.scene.toast.show(STR.treeBought(n.name), 1200);
      this.scene.cameras.main.flash(120, 255, 230, 150);
      this.refresh();
    }
  }

  refresh() {
    this.ensureMask();
    const g = this.lines;
    g.clear();
    for (const n of TREE) {
      for (const r of n.req) {
        const a = TREE_BY_ID[r];
        const lit = rankOf(r) > 0 && rankOf(n.id) > 0;
        const c = BRANCH_COLORS[branchOf(n.id)];
        if (lit) {   // constelação acesa: brilho largo + traço claro
          g.lineStyle(14, c, 0.22); g.lineBetween(a.x, a.y, n.x, n.y);
          g.lineStyle(4, Phaser.Display.Color.ValueToColor(c).lighten(25).color, 0.95); g.lineBetween(a.x, a.y, n.x, n.y);
        } else {
          g.lineStyle(3, 0x9fb0ff, 0.3); g.lineBetween(a.x, a.y, n.x, n.y);
        }
      }
    }
    this.nodes.forEach((v) => {
      const r = rankOf(v.n.id);
      const reach = nodeReachable(v.n.id);
      const full = r >= v.n.max;
      const color = BRANCH_COLORS[branchOf(v.n.id)];
      v.circle.setFillStyle(full ? color : r > 0 ? 0x3a2f6e : reach ? 0x1b2448 : 0x0c1024);
      v.circle.setStrokeStyle(3, r > 0 ? color : 0x9fb0ff, r > 0 ? 0.9 : reach ? 0.55 : 0.25);
      v.halo.setVisible(r > 0).setAlpha(full ? 0.3 : 0.16);
      v.label.setText(v.n.max > 1 || !r ? `${r}/${v.n.max}` : '✓').setColor(full ? '#1a1430' : reach ? TXT.main : '#8a90b0');
      v.ring.setStrokeStyle(4, color, v.n.id === this.selected ? 1 : 0);
      v.circle.setAlpha(reach || r > 0 ? 1 : 0.6);
    });

    const n = TREE_BY_ID[this.selected];
    const r = rankOf(n.id);
    fit(this.infoName.setText(n.name), 420);
    this.infoRank.setText(STR.treeRank(r, n.max));
    this.infoDesc.setText(EFFECT_TEXT[n.type](n.per));
    this.infoTotal.setText(r > 0 && n.max > 1 ? STR.treeTotal(EFFECT_TEXT[n.type](n.per * r)) : '');
    const cost = nodeCost(n.id);
    this.buyBtn.setLabel(cost === null ? STR.treeMaxed : STR.treeBuy(fmt(cost))).setEnabled(canBuyNode(n.id));
  }
}
