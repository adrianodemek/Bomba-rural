// Procurar clã (prévia até o modo online): convite recebido, busca, filtros, clãs sugeridos e "Criar meu clã".
// Os filtros funcionam de verdade sobre a lista de exemplo (CLAN_SEARCH); entrar/pedir só avisa que vem com o online.
import { BALANCE } from '../config/balance.js';
import { COL, TXT } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { CLAN_SEARCH, CLAN_INVITE } from '../data/clanPreview.js';
import { teamPower } from '../systems/Difficulty.js';
import { Button } from './Button.js';
import { txt, fit, card } from './widgets.js';
import { fmtShort as fmt } from './format.js';
import { drawEmblem, paintEmblem } from './clanEmblem.js';

const W = BALANCE.screen.width;
const PER_PAGE = 5;
const CARD_Y = 412, CARD_H = 126, CARD_GAP = 134;

export class ClanSearch extends Phaser.GameObjects.Container {
  constructor(scene, { onAccept, onCreate, soon }) {
    super(scene, 0, 0);
    const s = scene;
    this.soon = soon;
    this.page = 0;
    this.filters = { slots: true, open: true, power: false, lang: true };
    this.add(card(s, 20, 92, W - 40, 44, COL.gold, 0x2a1a08));
    this.add(txt(s, W / 2, 114, STR.clanNoticeSearch, 15, TXT.gold).setOrigin(0.5));

    // Convite recebido
    this.add(card(s, 20, 146, W - 40, 104, COL.gold));
    this.add(drawEmblem(s, 62, 198, 66, CLAN_INVITE.emblem));
    this.add(txt(s, 110, 166, STR.clanInviteTag, 13, TXT.gold, true).setOrigin(0, 0.5));
    this.add(fit(txt(s, 110, 192, STR.clanInviteFrom(CLAN_INVITE.from), 19, TXT.main, true).setOrigin(0, 0.5), 320));
    this.add(fit(txt(s, 110, 222, STR.clanInviteTo(CLAN_INVITE.clan, CLAN_INVITE.league), 13, TXT.dim).setOrigin(0, 0.5), 320));
    this.add(new Button(s, 496, 198, 124, 56, STR.clanAccept, onAccept, { fontSize: 18 }));
    this.add(new Button(s, 626, 198, 116, 56, STR.clanRefuse, soon, { fontSize: 17, color: COL.card, border: COL.border }));

    // Busca pelo nome (o teclado chega com o online)
    const box = s.add.rectangle(20, 262, W - 40, 54, 0x0c0614).setOrigin(0).setStrokeStyle(2, 0x7a5418);
    box.setInteractive({ useHandCursor: true }).on('pointerup', soon);
    const lens = s.add.graphics({ x: 48, y: 289 });
    lens.lineStyle(3, 0xa898c0).strokeCircle(-2, -2, 8).lineBetween(4, 4, 11, 11);
    this.add([box, lens, txt(s, 72, 289, STR.clanSearchHint, 19, '#6a5a80').setOrigin(0, 0.5)]);

    // Filtros
    let fx = 20;
    this.filterBtns = [['slots', 136], ['open', 112], ['power', 214], ['lang', 146]].map(([id, w]) => {
      const b = new Button(s, fx + w / 2, 346, w, 40, '', () => { this.filters[id] = !this.filters[id]; this.page = 0; this.refresh(); }, { fontSize: 15 });
      b.filterId = id;
      fx += w + 10;
      this.add(b);
      return b;
    });
    this.add(txt(s, 24, 390, STR.clanSuggested, 19, TXT.gold, true).setOrigin(0, 0.5));
    this.add(txt(s, W - 24, 390, STR.clanSuggestedNote, 14, TXT.dim).setOrigin(1, 0.5));

    // Cartões dos clãs
    this.cards = Array.from({ length: PER_PAGE }, (_, i) => {
      const y = CARD_Y + i * CARD_GAP;
      const bg = card(s, 20, y, W - 40, CARD_H);
      const emb = drawEmblem(s, 66, y + 52, 72, '0'.repeat(64));
      const name = txt(s, 116, y + 26, '', 21, TXT.main, true).setOrigin(0, 0.5);
      const info = txt(s, 116, y + 54, '', 14, TXT.dim).setOrigin(0, 0.5);
      const chips = [0, 1, 2].map(() => {
        const r = s.add.rectangle(0, y + 90, 10, 28, 0x000000).setOrigin(0, 0.5);
        const t = txt(s, 0, y + 90, '', 13, TXT.main, true).setOrigin(0, 0.5);
        return { r, t };
      });
      const btn = new Button(s, 598, y + 52, 176, 58, '', soon, { fontSize: 17 });
      const c = { bg, emb, name, info, chips, btn, all: [bg, emb, name, info, ...chips.flatMap((k) => [k.r, k.t]), btn] };
      this.add(c.all);
      return c;
    });
    this.empty = txt(s, W / 2, CARD_Y + 60, STR.clanNoResults, 18, TXT.dim).setOrigin(0.5).setVisible(false);
    this.add(this.empty);

    this.createBtn = new Button(s, 232, 1140, 424, 72, STR.clanCreateMine, onCreate, { fontSize: 22 });
    this.createBtn.label.setY(-12);
    this.add([this.createBtn, txt(s, 232, 1158, STR.clanCreateCost(100), 14, TXT.onGold).setOrigin(0.5)]);
    this.moreBtn = new Button(s, 578, 1140, 244, 72, STR.clanMore, () => { this.page += 1; this.refresh(); }, { fontSize: 19, color: COL.card, border: COL.border });
    this.add(this.moreBtn);
  }

  clanList() {
    const f = this.filters;
    const power = teamPower();
    return CLAN_SEARCH.filter((c) => (!f.slots || c.members < BALANCE.clan.maxMembers)
      && (!f.open || c.rule === 'open')
      && (!f.power || c.minPower <= power)
      && (!f.lang || c.lang === 'pt'));
  }

  chip(k, x, label, fill, border, color) {
    k.t.setText(label).setColor(color).setX(x + 8);
    k.r.setX(x).setSize(k.t.width + 16, 28).setFillStyle(fill).setStrokeStyle(2, border);
    return x + k.t.width + 24;
  }

  refresh() {
    this.filterBtns.forEach((b) => {
      const on = this.filters[b.filterId];
      b.setLabel(`${on ? '✓ ' : ''}${STR.clanFilters[b.filterId]}`);
      b.setColors(on ? COL.active : COL.card, on ? COL.activeBorder : COL.border);
    });
    const list = this.clanList();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (this.page >= pages) this.page = 0;
    const shown = list.slice(this.page * PER_PAGE, this.page * PER_PAGE + PER_PAGE);
    const power = teamPower();
    this.empty.setVisible(!shown.length);
    this.moreBtn.setEnabled(pages > 1);
    this.cards.forEach((c, i) => {
      const k = shown[i];
      c.all.forEach((o) => o.setVisible(!!k));
      if (!k) return;
      paintEmblem(c.emb, k.emblem, 72);
      fit(c.name.setText(k.name), 300);
      c.info.setText(STR.clanCardInfo(k.level, k.members, BALANCE.clan.maxMembers, k.active));
      const full = k.members >= BALANCE.clan.maxMembers;
      const weak = k.minPower > power;
      let x = this.chip(c.chips[0], 116, k.league, 0x3a2a08, 0xa87a20, TXT.gold);
      x = this.chip(c.chips[1], x, `💥 ${fmt(k.damage)}`, 0x2a1408, 0x8a4a20, '#ffb070');
      this.chip(c.chips[2], x, k.minPower ? STR.clanRuleMin(fmt(k.minPower)) : STR.clanRuleOpen,
        weak ? 0x2a0e0a : 0x10260e, weak ? 0x8a3a2a : 0x3a7a3a, weak ? '#ff9a8a' : TXT.good);
      if (full) {
        c.btn.setLabel(STR.clanFull).setEnabled(false);
        c.btn.onDisabledClick = () => this.scene.toast.show(STR.clanFullMsg, 1600);
      } else if (weak) {
        c.btn.setLabel(k.rule === 'open' ? STR.clanJoin : STR.clanAskJoin).setEnabled(false);
        c.btn.onDisabledClick = () => this.scene.toast.show(STR.clanWeakMsg(fmt(k.minPower)), 2000);
      } else {
        c.btn.setLabel(k.rule === 'open' ? STR.clanJoin : STR.clanAskJoin).setEnabled(true);
        if (k.rule === 'open') c.btn.setColors(COL.btn, COL.btnBorder); else c.btn.setColors(COL.royal, COL.royalBorder);
      }
    });
  }
}
