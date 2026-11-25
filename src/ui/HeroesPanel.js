// Aba Heróis: invocação, Pólvora reforçada e elenco paginado.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { ROLES, RARITY_NAMES, RARITY_COLORS, RARITY_TEXT } from '../data/heroes.js';
import { economy } from '../systems/Economy.js';
import { maxEnergy } from '../systems/Energy.js';
import { teamLetter, statsOf } from '../systems/Roster.js';
import { Panel } from './Panel.js';
import { Button } from './Button.js';
import { txt, fit, card, ProgressBar, energyColor, Stars } from './widgets.js';
import { fmt } from './format.js';
import { setHeroPortrait } from '../art/hd.js';
import { frame } from './skin.js';

const W = BALANCE.screen.width;
const LIST_Y = 400;
const ROW_H = 104;
// Quantas linhas cabem no painel (a tela alta mostra mais heróis por página).
const PER_PAGE = Math.max(5, Math.floor((BALANCE.layout.tabsY - BALANCE.layout.arenaY - LIST_Y - 20) / ROW_H));

export class HeroesPanel extends Panel {
  constructor(scene, { onClose, onSummon, onBuyCage, onBuyPower, onHero }) {
    super(scene, STR.heroesTitle, onClose);
    this.page = 0;

    // Invocação
    this.add(card(scene, 24, 90, W - 48, 140, COL.gold));
    this.add(scene.add.image(80, 160, 'cage').setScale(5));
    this.cagesText = txt(scene, 136, 132, '', 28, TXT.main, true).setOrigin(0, 0.5);
    this.crystalsText = txt(scene, 136, 176, '', 20, '#9fe8ff').setOrigin(0, 0.5);
    this.summonBtn = new Button(scene, 565, 126, 230, 58, STR.summonBtn, onSummon, {
      fontSize: 24, onDisabledClick: () => scene.toast.show(economy.rosterFull() ? STR.rosterFull : STR.noCages, 2200),
    });
    this.buyBtn = new Button(scene, 565, 194, 230, 52, '', onBuyCage, {
      fontSize: 18, color: COL.royal, border: COL.royalBorder, onDisabledClick: () => scene.toast.show(STR.notEnoughCrystals, 1200),
    });
    this.add([this.cagesText, this.crystalsText, this.summonBtn, this.buyBtn]);

    // Pólvora reforçada
    this.add(card(scene, 24, 245, W - 48, 100));
    this.add(scene.add.image(68, 295, 'ui_bomb').setScale(3));
    this.add(txt(scene, 106, 276, STR.upgradePowerTitle, 24, TXT.gold, true).setOrigin(0, 0.5));
    this.powerPreview = txt(scene, 106, 314, '', 18, TXT.good).setOrigin(0, 0.5);
    this.powerBtn = new Button(scene, 565, 295, 230, 64, '', onBuyPower, {
      fontSize: 22, onDisabledClick: () => scene.toast.show(STR.notEnoughGold, 1200),
    });
    this.add([this.powerPreview, this.powerBtn]);

    // Elenco
    this.rosterTitle = txt(scene, 24, 372, '', 24, TXT.gold, true).setOrigin(0, 0.5);
    this.pageText = txt(scene, 590, 372, '', 20, TXT.dim, true).setOrigin(0.5);
    this.prevBtn = new Button(scene, 520, 372, 64, 48, '<', () => this.turn(-1), { fontSize: 24, color: COL.card, border: COL.border });
    this.nextBtn = new Button(scene, 660, 372, 64, 48, '>', () => this.turn(1), { fontSize: 24, color: COL.card, border: COL.border });
    this.add([this.rosterTitle, this.pageText, this.prevBtn, this.nextBtn]);

    this.rows = [];
    for (let i = 0; i < PER_PAGE; i++) {
      const y = LIST_Y + i * ROW_H;
      const bg = card(scene, 24, y, W - 48, ROW_H - 8);
      const portrait = scene.add.sprite(76, y + 46, 'hero0_down_0').setScale(3);
      const role = scene.add.image(104, y + 76, 'role_attacker').setScale(2.5);
      const name = txt(scene, 128, y + 22, '', 22, TXT.main, true).setOrigin(0, 0.5);
      const line = txt(scene, 128, y + 50, '', 17, TXT.dim).setOrigin(0, 0.5);
      const stars = new Stars(scene, 128, y + 76, 2);
      const bar = new ProgressBar(scene, 210, y + 76, 300, 12);
      const badge = frame(scene, 650, y + 46, 64, 64, COL.panelDark).setStrokeStyle(3, COL.border);
      const badgeText = txt(scene, 650, y + 46, '', 30, TXT.gold, true).setOrigin(0.5);
      const power = txt(scene, 600, y + 22, '', 20, TXT.gold).setOrigin(1, 0.5);
      bg.setInteractive({ useHandCursor: true });
      const row = { bg, portrait, role, name, line, stars, bar, badge, badgeText, power, hero: null };
      bg.on('pointerup', () => { if (row.hero) onHero(row.hero); });
      this.add([bg, portrait, role, name, line, stars, bar, badge, badgeText, power]);
      this.rows.push(row);
    }
    this.onOpen = () => this.refresh();
  }

  sorted() {
    const teamKey = (t) => (t === null ? 9 : t);
    return [...economy.heroes].sort((a, b) => teamKey(a.team) - teamKey(b.team)
      || b.rarity - a.rarity || b.stars - a.stars || b.level - a.level || a.uid - b.uid);
  }

  pages() {
    return Math.max(1, Math.ceil(economy.heroes.length / PER_PAGE));
  }

  turn(d) {
    this.page = Phaser.Math.Wrap(this.page + d, 0, this.pages());
    this.refresh();
  }

  refresh() {
    const cagePrice = BALANCE.gacha.cageCrystalPrice;
    this.cagesText.setText(STR.cagesLabel(economy.cages));
    fit(this.crystalsText.setText(STR.crystalsEssence(fmt(economy.crystals), fmt(economy.essence))), 290);
    this.summonBtn.setEnabled(economy.cages > 0 && !economy.rosterFull());
    this.buyBtn.setLabel(STR.buyCageBtn(cagePrice)).setEnabled(economy.crystals >= cagePrice);

    const pct = BALANCE.upgrades.power.attackPct * 100;   // 3,5% por nível: arredonda só o total
    const lvl = economy.powerLevel;
    this.powerPreview.setText(STR.upgradePowerPreview(Math.round(lvl * pct), Math.round((lvl + 1) * pct)));
    const cost = economy.powerCost();
    this.powerBtn.setLabel(STR.upgradePowerButton(fmt(cost))).setEnabled(economy.gold >= cost);

    const list = this.sorted();
    this.page = Math.min(this.page, this.pages() - 1);
    this.rosterTitle.setText(STR.rosterTitle(list.length, economy.heroSlots))
      .setColor(economy.rosterFull() ? TXT.bad : TXT.gold);
    this.pageText.setText(`${this.page + 1}/${this.pages()}`);
    const slice = list.slice(this.page * PER_PAGE, this.page * PER_PAGE + PER_PAGE);

    this.rows.forEach((r, i) => {
      const h = slice[i] || null;
      r.hero = h;
      [r.bg, r.portrait, r.role, r.name, r.line, r.stars, r.bar, r.badge, r.badgeText, r.power].forEach((o) => o.setVisible(!!h));
      if (!h) return;
      r.bg.setStrokeStyle(3, h.rarity > 0 ? RARITY_COLORS[h.rarity] : COL.border);
      setHeroPortrait(r.portrait, h);
      r.role.setTexture(`role_${h.role}`);
      fit(r.name.setText(h.name), 330);
      r.power.setText(STR.powerShort(fmt(statsOf(h).power)));
      fit(r.line.setText(STR.heroLine(RARITY_NAMES[h.rarity], ROLES[h.role].name, h.level, BALANCE.ranks[h.rank].name)), 480)
        .setColor(RARITY_TEXT[h.rarity]);
      r.stars.setCount(h.stars);
      const ratio = h.energy / maxEnergy(h);
      r.bar.setValue(ratio, energyColor(ratio));
      if (economy.onExpedition(h.uid)) r.badgeText.setText('Exp').setColor('#9fe8ff');
      else r.badgeText.setText(teamLetter(h.team)).setColor(h.team === null ? TXT.dim : TXT.gold);
    });
  }
}
