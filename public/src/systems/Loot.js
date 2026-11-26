// Recompensas: ouro (com bônus de Coletores), cristais e gaiolas dos baús.
// Tudo salta do objeto e voa até o contador do topo.
import { BALANCE } from '../config/balance.js';
import { FONT, TXT, fs } from '../config/theme.js';
import { STR } from '../config/strings.js';
import { economy } from './Economy.js';
import { fmt } from '../ui/format.js';
import { currentItemLevel } from './Items.js';
import { addRandomGem } from './Gems.js';

const HUD = BALANCE.layout.hud;

export class LootSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = scene.add.group({ classType: Phaser.GameObjects.Image, maxSize: 140 });
  }

  goldFor(obj, collectMult) {
    const L = BALANCE.loot;
    if (economy.mode === 'endless') {
      // No Abismo o ouro rende metade do HP (o prêmio principal é essência e recorde).
      return Math.max(1, Math.round(L.goldPerHp * obj.maxHp * L.typeMult[obj.type] * 0.5 * collectMult * (1 + economy.treeSum('goldPct'))));
    }
    // O HP já cresce com fase e dificuldade; a recompensa soma um bônus extra por fase.
    const gi = economy.globalIndex();
    const stageMult = 1 + L.rewardGrowthPerStage * (gi - 1) * 0.25;
    const diffMult = BALANCE.difficulties[economy.difficulty].reward / BALANCE.difficulties[economy.difficulty].hp;
    const treeMult = 1 + economy.treeSum('goldPct') + economy.albumGoldPct();
    return Math.max(1, Math.round(L.goldPerHp * obj.maxHp * L.typeMult[obj.type] * stageMult * diffMult * collectMult * treeMult));
  }

  drop(obj, x, y, owner) {
    const collectMult = this.scene.collectMult(obj);
    const luck = owner ? owner.luckNow / 100 : 0;
    const ab = owner ? owner.stats.abil : {};
    const lucky = Math.random() < luck;
    const amount = Math.round(this.goldFor(obj, collectMult) * (lucky ? 2 : 1) * (1 + (ab.deepPockets || 0)));
    economy.addGold(amount);
    this.scene.stageGold += amount;
    this.scene.tickGold += amount;

    const coins = Phaser.Math.Clamp(Math.ceil(amount / 3), 1, BALANCE.loot.maxCoinsPerDrop);
    for (let i = 0; i < coins; i++) this.fly('coin', x, y, i, HUD.gold, 'coin-arrive');
    this.floatText(x, y, `+${fmt(amount)}`, collectMult > 1 ? TXT.good : TXT.gold);
    if (lucky) this.floatText(x, y - 26, STR.lucky, '#8fe07a');

    // Faro de Cristal: chance de cristal em qualquer objeto.
    if (ab.crystalNose && Math.random() < ab.crystalNose) {
      economy.addCrystals(1);
      this.fly('crystal', x, y, 2, HUD.crystal, 'crystal-arrive');
    }

    // Gemas: veios e baús da arena.
    const gemChance = obj.type === 'vein' ? BALANCE.gems.veinChance : obj.type === 'chest' ? BALANCE.gems.chestChance : 0;
    if (gemChance && Math.random() < gemChance + luck * 0.5) {
      const key = addRandomGem();
      this.fly(`gem_${key.split(':')[0]}`, x, y, 5, HUD.gold, 'gem-arrive');
      this.floatText(x, y - 140, STR.plusGem, '#ffa0d8');
    }

    if (obj.type === 'vein' && Math.random() < (BALANCE.loot.veinMineralChance ?? 1) + luck) {
      const dbl = lucky || Math.random() < (ab.prospector || 0); // Garimpo
      const n = BALANCE.loot.veinMineral * (dbl ? 2 : 1);
      economy.addMineral(economy.arenaWorld, n);
      this.fly(`ore_${economy.arenaWorld}`, x, y, 1, HUD.gold, 'ore-arrive');
    }

    if (obj.type === 'chest') {
      const bonus = luck + economy.treeSum('chestPct') + (ab.treasure || 0); // árvore + Caça-Tesouro
      if (Math.random() < BALANCE.items.chestSealedChance + bonus) {
        const ex = economy.mode === 'endless' && Math.random() < BALANCE.items.exclusive.abyssChance;
        economy.addSealed(1, currentItemLevel(), economy.arenaWorld, ex);
        this.fly('sealed', x, y, 4, HUD.gold, 'sealed-arrive');
        this.floatText(x, y - 112, STR.plusSealed, '#e8c890');
      }
      if (Math.random() < BALANCE.loot.chestKeyChance + bonus) {
        economy.addKeys(1);
        this.fly('key', x, y, 3, HUD.gold, 'key-arrive');
        this.floatText(x, y - 84, STR.plusKey, '#ffe066');
      }
      if (Math.random() < BALANCE.loot.chestCrystalChance + luck * BALANCE.loot.chestLuckShare.crystal) {
        economy.addCrystals(1);
        this.fly('crystal', x, y, 1, HUD.crystal, 'crystal-arrive');
        this.floatText(x, y - 28, STR.plusCrystal, '#9fe8ff');
      }
      if (Math.random() < BALANCE.loot.chestCageChance + luck * BALANCE.loot.chestLuckShare.cage) {
        economy.addCages(1);
        this.fly('cage', x, y, 2, HUD.cage, 'cage-arrive');
        this.floatText(x, y - 56, STR.plusCage, TXT.main);
      }
    }
  }

  // Recompensa da fase concluída (voa do centro da arena).
  stageReward(crystals, cages, keys = 0) {
    if (keys > 0) economy.addKeys(keys);
    const L = BALANCE.layout;
    const x = BALANCE.screen.width / 2;
    const y = L.arenaY + L.arenaH / 2 + 60;
    if (crystals > 0) {
      economy.addCrystals(crystals);
      for (let i = 0; i < crystals; i++) this.fly('crystal', x, y, i, HUD.crystal, 'crystal-arrive');
    }
    if (cages > 0) {
      economy.addCages(cages);
      for (let i = 0; i < cages; i++) this.fly('cage', x, y, i + 1, HUD.cage, 'cage-arrive');
    }
  }

  fly(key, x, y, i, target, event) {
    const { scene } = this;
    const img = this.pool.get(x, y, key);
    if (!img) return;
    img.setTexture(key).setActive(true).setVisible(true).setScale(3).setDepth(3000).setAlpha(1);
    const jumpX = x + Phaser.Math.Between(-22, 22);
    scene.tweens.add({
      targets: img,
      x: jumpX,
      y: y - Phaser.Math.Between(24, 40),
      duration: 180,
      ease: 'Quad.easeOut',
      delay: i * 40,
      onComplete: () => {
        scene.tweens.add({
          targets: img,
          x: target[0],
          y: target[1],
          scale: 2,
          duration: BALANCE.loot.coinFlyMs,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.pool.killAndHide(img);
            scene.game.events.emit(event);
          },
        });
      },
    });
  }

  floatText(x, y, text, color = TXT.gold) {
    const t = this.scene.add.text(x, y - 10, text, {
      fontFamily: FONT, fontSize: fs(22), color, stroke: '#12081c', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(3100);
    this.scene.tweens.add({
      targets: t, y: y - 50, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy(),
    });
  }
}
