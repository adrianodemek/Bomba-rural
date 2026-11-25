// Salva no navegador (localStorage). Se o armazenamento falhar, o jogo segue em memória.
import { NAME_TO_F, NAME_TO_M, FEMALE_ROLES } from '../data/heroes.js';
import { BALANCE } from '../config/balance.js';

function migrate(data) {
  if (!data.version) data.version = 1;
  if (data.version < 2) {
    // v1 → v2: entram elenco, equipes e Casa. Sem "heroes", o fromJSON cria o time inicial.
    data.cages = data.cages ?? BALANCE.gacha.startingCages;
    data.version = 2;
  }
  if (data.version < 3) {
    // v2 → v3: atributos novos. Heróis antigos ficam Rank C, sem pontos distribuídos,
    // e voltam com a energia cheia (a escala de energia mudou).
    (data.heroes || []).forEach((h) => { h.rank = 2; h.alloc = {}; h.energy = 1e9; });
    data.version = 3;
  }
  if (data.version < 4) {
    // v3 → v4: a fase deixa de ser um contador único e vira mundo + fase (20 por mundo).
    const spw = BALANCE.stage.stagesPerWorld;
    const g = Math.max(1, data.stage || 1);
    const world = Math.min(4, Math.floor((g - 1) / spw));
    const stage = g - world * spw > spw ? spw : g - world * spw;
    const progress = [0, 1, 2, 3, 4].map(() => [0, 0, 0, 0, 0]);
    for (let w = 0; w < world; w++) progress[0][w] = spw;
    progress[0][world] = Math.max(0, stage - 1);
    data.world = world;
    data.stage = stage;
    data.difficulty = 0;
    data.progress = progress;
    data.stagesCleared = g - 1;
    data.version = 4;
  }
  if (data.version < 5) {
    // v4 → v5: entram inventário, lacrados e equipamento dos heróis.
    data.items = [];
    data.sealed = [];
    (data.heroes || []).forEach((h) => { h.gear = {}; });
    data.version = 5;
  }
  if (data.version < 6) {
    // v5 → v6: mundos passam de 20 para 24 fases. Mundo concluído continua concluído.
    (data.progress || []).forEach((row) => row.forEach((v, i) => { if (v >= 20) row[i] = 24; }));
    // Heróis ganham Despertar e habilidades (o time inicial recebe as fixas no carregamento).
    const starters = { 'Pavio Curto': ['crusher', 'fury'], 'Dona Dinamite': ['deepPockets', 'magnet'], 'Zé Estopim': ['wideAura', 'haste'] };
    (data.heroes || []).forEach((h) => {
      h.awaken = 0;
      if (starters[h.name]) h.abilities = starters[h.name].map((id) => ({ id, lvl: 1 }));
    });
    data.version = 6;
  }
  if (data.version < 7) {
    // v6 → v7: contadores, missões e conquistas começam do zero (valores padrão no carregamento).
    data.version = 7;
  }
  if (data.version < 8) {
    // v7 → v8: gemas, encaixes e travas. O time inicial fica "não trocável".
    const starters = ['Pavio Curto', 'Dona Dinamite', 'Zé Estopim'];
    (data.heroes || []).forEach((h) => {
      h.gems = [null, null, null];
      if (starters.includes(h.name) && h.tradable === undefined) h.tradable = false;
    });
    data.gems = data.gems || {};
    data.version = 8;
  }
  if (data.version < 9) {
    // v8 → v9: fases já concluídas ganham 1 estrela; refazendo mais rápido dá até 3.
    data.stars = data.stars || {};
    (data.progress || []).forEach((row, d) => row.forEach((n, w) => {
      for (let s = 1; s <= n; s++) data.stars[`${d}-${w}-${s}`] = data.stars[`${d}-${w}-${s}`] || 1;
    }));
    data.starClaims = data.starClaims || {};
    data.version = 9;
  }
  if (data.version < 10) {
    // v9 → v10: álbum (preenchido com o que você já tem), expedições, Colosso e temporadas.
    data.version = 10;
  }
  if (data.version < 12) {
    // v11 → v12: a classe Suporte virou a Engenheira (menina). A Zé Estopim inicial vira Lia Estopim e as outras
    // Engenheiras com primeiro nome masculino ganham o feminino equivalente (o sobrenome continua).
    const used = new Set((data.heroes || []).map((h) => h.name));
    (data.heroes || []).forEach((h) => {
      if (!FEMALE_ROLES.has(h.role) || typeof h.name !== 'string') return;
      const [first, ...rest] = h.name.split(' ');
      const f = h.name === 'Zé Estopim' ? 'Lia' : NAME_TO_F[first];
      if (!f) return;
      let n = [f, ...rest].join(' ');
      if (used.has(n)) n = `${n} ${h.uid ?? ''}`.trim();
      used.delete(h.name); used.add(n);
      h.name = n;
    });
    data.version = 12;
  }
  if (data.version < 13) {
    // v12 → v13: Demolidor, Extrator e Técnico são meninos. A Dona Dinamite inicial (Extrator) vira Zé Dinamite e
    // os outros com primeiro nome feminino ganham o masculino equivalente (o sobrenome continua).
    const used = new Set((data.heroes || []).map((h) => h.name));
    (data.heroes || []).forEach((h) => {
      if (FEMALE_ROLES.has(h.role) || typeof h.name !== 'string') return;
      const [first, ...rest] = h.name.split(' ');
      const m = h.name === 'Dona Dinamite' ? 'Zé' : NAME_TO_M[first];
      if (!m) return;
      let n = [m, ...rest].join(' ');
      if (used.has(n)) n = `${n} ${h.uid ?? ''}`.trim();
      used.delete(h.name); used.add(n);
      h.name = n;
    });
    data.version = 13;
  }
  return data;
}

export const SaveSystem = {
  lastSavedAt: null,
  onSaved: null,

  // Devolve true se carregou. Guarda a hora do último save em lastSavedAt.
  load(economy) {
    try {
      const raw = localStorage.getItem(BALANCE.save.key);
      if (!raw) return false;
      const data = migrate(JSON.parse(raw));
      economy.fromJSON(data);
      this.lastSavedAt = Number.isFinite(data.savedAt) ? data.savedAt : null;
      return true;
    } catch (e) {
      return false;
    }
  },

  save(economy) {
    try {
      const data = { ...economy.toJSON(), version: BALANCE.save.version, savedAt: Date.now() };
      localStorage.setItem(BALANCE.save.key, JSON.stringify(data));
      this.onSaved?.(data, economy);   // save na nuvem (conta do beta)
    } catch (e) {
      // Sem armazenamento: ignora.
    }
  },

  clear() {
    try {
      localStorage.removeItem(BALANCE.save.key);
    } catch (e) {
      // ignora
    }
  },

  start(economy) {
    setInterval(() => this.save(economy), BALANCE.save.intervalMs);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save(economy);
    });
    window.addEventListener('pagehide', () => this.save(economy));
  },
};
