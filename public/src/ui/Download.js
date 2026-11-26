// Tela "Baixando o jogo": na primeira vez guarda toda a arte (assets/ e lib/) no aparelho, com barra de progresso.
// Depois o jogo abre direto; quando a arte muda numa versão nova, baixa só o que mudou.
// A lista vem de assets/lista.json (gerada por ferramentas/site/lista_arte.py) e o sw.js entrega os arquivos guardados.
// As imagens ficam só guardadas (não vão para a memória de vídeo): o jogo continua carregando cada mundo quando precisa.

const ART = 'bomba-rural-arte';
const META = '__lista_baixada';
const PARALLEL = 6;

const CSS = `
#dl{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 30%,#3a1d63 0%,#1a0d2e 55%,#0e0716 100%);
  font-family:'Imperial Sans',system-ui,sans-serif;color:#f4ead8}
#dl *{box-sizing:border-box}
#dl .card{width:min(92vw,440px);padding:28px 24px 22px;border-radius:18px;text-align:center;
  background:linear-gradient(180deg,#2c1650,#1d0e36);border:2px solid #c9a24a;
  box-shadow:0 0 0 4px #1a0d2e,0 0 0 6px #5a3408,0 18px 50px rgba(0,0,0,.6)}
#dl h1{margin:0 0 6px;font:34px 'Imperial Title',serif;color:#ffd86a;letter-spacing:2px;text-shadow:0 3px 0 #5a2a00}
#dl .what{font-size:18px;font-weight:600;margin:10px 0 14px}
#dl .bar{height:22px;border-radius:11px;background:#0c0614;border:2px solid #6a4a18;overflow:hidden;position:relative}
#dl .fill{height:100%;width:0;background:linear-gradient(180deg,#ffe58a,#e0a62a);box-shadow:inset 0 -3px 0 rgba(0,0,0,.2);
  transition:width .25s}
#dl .num{margin-top:8px;font-size:15px;color:#ffd86a}
#dl small{display:block;margin-top:14px;color:#c8b8e8;font-size:13px;line-height:1.4}
#dl button{margin-top:16px;width:100%;padding:12px;border-radius:12px;border:1px solid #6a4a9a;background:#241040;
  color:#f4ead8;font-family:inherit;font-weight:600;font-size:15px;cursor:pointer}
`;

const mb = (b) => (b / 1e6).toFixed(b >= 1e7 ? 0 : 1).replace('.', ',');

async function readMeta(cache, base) {
  try {
    const r = await cache.match(new URL(META, base).href);
    return r ? await r.json() : { v: null, files: {} };
  } catch (e) { return { v: null, files: {} }; }
}

function writeMeta(cache, base, meta) {
  return cache.put(new URL(META, base).href, new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }))
    .catch(() => {});
}

function overlay(update, totalBytes) {
  const style = document.createElement('style');
  style.textContent = CSS;
  const el = document.createElement('div');
  el.id = 'dl';
  el.innerHTML = `
    <div class="card">
      <h1>Bomba Rural</h1>
      <div class="what">${update ? 'Atualizando a arte do jogo…' : 'Baixando o jogo…'}</div>
      <div class="bar"><div class="fill"></div></div>
      <div class="num">0%</div>
      <small>${update
    ? 'Só o que mudou nesta versão.'
    : `Só na primeira vez (${mb(totalBytes)} MB; se puder, use Wi-Fi). Depois o jogo abre na hora.`}</small>
      <button type="button">Jogar agora (baixa aos poucos)</button>
    </div>`;
  document.head.appendChild(style);
  document.body.appendChild(el);
  return {
    el,
    set(done, total) {
      const p = total ? Math.min(100, Math.floor((done / total) * 100)) : 100;
      el.querySelector('.fill').style.width = `${p}%`;
      el.querySelector('.num').textContent = `${p}% · ${mb(done)} de ${mb(total)} MB`;
    },
    close() { el.remove(); style.remove(); },
  };
}

// Resolve quando pode abrir o jogo: tudo baixado, nada a baixar, sem suporte, sem rede ou o jogador tocou em "Jogar agora".
export async function ensureDownloaded() {
  if (!('caches' in window) || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  const base = new URL('./', document.baseURI).href;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (e) { return; }
  let list;
  try {
    const r = await fetch('assets/lista.json', { cache: 'no-store' });
    if (!r.ok) return;
    list = await r.json();
  } catch (e) { return; }   // sem internet: abre com o que já está guardado

  let cache;
  try { cache = await caches.open(ART); } catch (e) { return; }
  const meta = await readMeta(cache, base);
  if (meta.v === list.v) { await swReady(); return; }

  // Tira o que saiu da lista e baixa o que falta ou mudou.
  const want = new Map(list.files.map(([p, , h]) => [p, h]));
  for (const p of Object.keys(meta.files)) {
    if (!want.has(p)) { cache.delete(new URL(p, base).href).catch(() => {}); delete meta.files[p]; }
  }
  const need = list.files.filter(([p, , h]) => meta.files[p] !== h);
  if (!need.length) { meta.v = list.v; await writeMeta(cache, base, meta); await swReady(); return; }

  try { navigator.storage?.persist?.(); } catch (e) { /* ok */ }
  const total = need.reduce((s, f) => s + f[1], 0);
  const ui = overlay(meta.v !== null && Object.keys(meta.files).length > 0, total);
  let done = 0;
  let failed = 0;
  let saveTimer = null;
  const saveSoon = () => { if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; writeMeta(cache, base, meta); }, 1500); };
  ui.set(0, total);

  const queue = [...need];
  const one = async ([p, size, h]) => {
    for (let tryN = 0; tryN < 2; tryN++) {
      try {
        const r = await fetch(`${p}?v=${h}`, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        await cache.put(new URL(p, base).href, r);
        meta.files[p] = h;
        saveSoon();
        done += size;
        ui.set(done, total);
        return;
      } catch (e) { /* tenta de novo uma vez */ }
    }
    failed += 1;
    done += size;
    ui.set(done, total);
  };
  const worker = async () => { while (queue.length) await one(queue.shift()); };
  const all = Promise.all(Array.from({ length: PARALLEL }, worker)).then(async () => {
    if (!failed) meta.v = list.v;   // se algo falhou, tenta só o que faltou na próxima vez
    clearTimeout(saveTimer);
    await writeMeta(cache, base, meta);
  });

  // "Jogar agora": abre o jogo e o download continua por trás.
  const skip = new Promise((resolve) => ui.el.querySelector('button').addEventListener('click', resolve, { once: true }));
  await Promise.race([all, skip]);
  ui.close();
  await swReady();
}

// Espera o service worker assumir a página (no 1º acesso), para o jogo já ler a arte guardada.
function swReady() {
  if (navigator.serviceWorker.controller) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}
