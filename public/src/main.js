// Ponto de entrada: espera a fonte carregar (com limite de tempo) e inicia o Phaser.
import { BALANCE } from './config/balance.js';
import { RES } from './config/display.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { UIScene } from './scenes/UIScene.js';
import { economy } from './systems/Economy.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { applyOfflineRecovery } from './systems/Energy.js';
import { applyOfflineGains } from './systems/OfflineProgress.js';
import { ensurePass } from './systems/SeasonPass.js';
import { STR } from './config/strings.js';
import { WORLDS } from './data/worlds.js';
import { TAB_UNLOCK, markTabSeen } from './systems/Journey.js';
import { todayKey } from './systems/Goals.js';
import { Cloud } from './systems/Cloud.js';
import { teamPower } from './systems/Difficulty.js';
import { showAuthGate, GUEST_KEY } from './ui/AuthGate.js';

// Modo de teste do chefe (Configurações → Testar o chefe): joga numa CÓPIA do save, na fase do chefe.
// O save real (BALANCE.save.key) não é tocado; "Sair do teste" volta para ele.
export const TEST_MODE_KEY = 'bomba-rural-modo';
// Valor guardado: {"w": mundo, "s": fase} (o antigo 'chefe' = Mundo 1, fase 24).
let testBoss = null;
try {
  const v = localStorage.getItem(TEST_MODE_KEY);
  if (v === 'chefe') testBoss = { w: 0, s: 24 };
  else if (v) testBoss = JSON.parse(v);
} catch (e) { testBoss = null; }
const BASE_KEY = BALANCE.save.key;      // save de convidado (as contas usam BASE_KEY:<id>)
if (testBoss) {
  BALANCE.save.key = BALANCE.save.testKey;
  window.__SKIP_INTRO = 1;
  window.__TEST_BOSS = 1;
}

async function waitForFonts() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('normal 20px "Imperial Sans"'),
        document.fonts.load('bold 20px "Imperial Sans"'),
        document.fonts.load('normal 20px "Imperial Title"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch (e) {
    // Sem a fonte, o jogo usa a fonte reserva.
  }
}

// Conta do beta: entra (ou joga sem conta) e escolhe o save mais novo entre o do aparelho e o da nuvem.
// Cada conta tem o próprio save no aparelho; o save de convidado fica na chave antiga.
async function accountStep() {
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Conectando…';
  let user = await Cloud.session();
  let guest = false;
  try { guest = localStorage.getItem(GUEST_KEY) === '1'; } catch (e) { /* ok */ }
  if (!user && !guest && !testBoss) {
    loading?.remove();
    const r = await showAuthGate();
    user = r === 'user' ? Cloud.user : null;
  }
  if (!user || testBoss) return;   // na cópia de teste não mexe na nuvem
  const guestKey = BASE_KEY;
  const userKey = `${guestKey}:${user.id}`;
  try {
    await Cloud.ensureProfile();
    const cloud = await Cloud.loadSave();
    const localRaw = localStorage.getItem(userKey);
    const localAt = localRaw ? (JSON.parse(localRaw).savedAt || 0) : 0;
    if (cloud?.data && (cloud.client_saved_at || 0) > localAt) {
      localStorage.setItem(userKey, JSON.stringify(cloud.data));           // jogou em outro aparelho
    } else if (!cloud && !localRaw) {
      const guestRaw = localStorage.getItem(guestKey);                      // conta nova: leva o progresso de convidado
      if (guestRaw) localStorage.setItem(userKey, guestRaw);
    }
  } catch (e) {
    // sem rede: segue com o save deste aparelho
  }
  BALANCE.save.key = userKey;
}

waitForFonts().then(accountStep).then(() => {
  document.getElementById('loading')?.remove();

  if (SaveSystem.load(economy) && SaveSystem.lastSavedAt) {
    const away = (Date.now() - SaveSystem.lastSavedAt) / 1000;
    applyOfflineRecovery(away);
    applyOfflineGains(away);
  }
  // Cópia de teste: sem os avisos de "Nova área liberada" (marca antes da interface abrir)
  const quietTest = () => {
    Object.keys(TAB_UNLOCK).forEach(markTabSeen);
    for (let t = 1; t < BALANCE.teams.count; t++) if (!economy.teamsSeen.includes(t)) economy.teamsSeen.push(t);
    economy.login.last = todayKey();   // sem a janela do presente diário na cópia
  };
  if (testBoss) quietTest();
  economy.ensureSeason();
  ensurePass();   // Passe de Temporada: vira o mês (entrega o que ficou para trás)
  SaveSystem.start(economy);
  if (Cloud.online && !testBoss) {
    // Ranking: fases diferentes já vencidas (todas as dificuldades) e o melhor poder de equipe visto.
    const stats = () => ({
      stages: economy.progress.reduce((t, d) => t + d.reduce((a, b) => a + (b || 0), 0), 0),
      power: (() => { try { return Math.max(0, Math.round(teamPower() || 0)); } catch (e) { return 0; } })(),
    });
    SaveSystem.onSaved = (data) => Cloud.queue(data, stats());
    const now = () => { SaveSystem.save(economy); Cloud.flush(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') now(); });
    window.addEventListener('pagehide', now);
    SaveSystem.save(economy);   // primeiro envio já na entrada
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: BALANCE.screen.width * RES,
    height: BALANCE.screen.height * RES,
    backgroundColor: '#0e0716',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, PreloadScene, BattleScene, UIScene],
  });

  // Se o celular derrubar a placa de vídeo do jogo (falta de memória), salva na hora e recarrega quando ela voltar.
  game.events.once('ready', () => {
    game.canvas?.addEventListener('webglcontextlost', () => { SaveSystem.save(economy); }, false);
    game.canvas?.addEventListener('webglcontextrestored', () => { SaveSystem.save(economy); window.location.reload(); }, false);
  });

  if (testBoss) {
    // Espera a arena e a interface ficarem prontas e vai para a fase escolhida (no Normal),
    // liberando na cópia os mundos anteriores e as fases antes dela.
    const go = () => {
      const bt = game.scene.getScene('Battle');
      const ui = game.scene.getScene('UI');
      if (!bt?.grid || !ui?.toast || !game.scene.isActive('UI')) { setTimeout(go, 400); return; }
      const w = Math.max(0, Math.min(WORLDS.length - 1, testBoss.w | 0));
      const s = Math.max(1, Math.min(economy.spw, testBoss.s | 0));
      for (let i = 0; i < w; i++) economy.progress[0][i] = Math.max(economy.progress[0][i] || 0, economy.spw);
      economy.progress[0][w] = Math.max(economy.progress[0][w] || 0, s - 1);
      quietTest();   // a fase liberada na cópia pode abrir abas e equipes: sem comemoração
      bt.goToStage(0, w, s);
      ui.refreshTabLocks?.();
      ui.toast.show(STR.testOn(WORLDS[w].name, s), 5000);
    };
    setTimeout(go, 1500);
  }

  // Acesso para depuração pelo console do navegador.
  window.BombaRural = { game, economy };
});
