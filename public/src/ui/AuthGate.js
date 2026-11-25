// Tela de entrada do beta (HTML por cima do jogo, antes do Phaser): Entrar · Criar conta · Jogar sem conta.
// Teclado de celular e preenchimento automático funcionam melhor em campos HTML do que dentro do canvas.
import { Cloud } from '../systems/Cloud.js';

export const GUEST_KEY = 'bomba-rural-convidado';

const CSS = `
#auth{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 30%,#3a1d63 0%,#1a0d2e 55%,#0e0716 100%);
  font-family:'Imperial Sans',system-ui,sans-serif;color:#f4ead8;touch-action:auto;-webkit-user-select:auto;user-select:auto}
#auth *{box-sizing:border-box}
#auth [hidden]{display:none!important}
#auth button{font-family:inherit}
#auth .card{width:min(92vw,440px);padding:26px 24px 20px;border-radius:18px;
  background:linear-gradient(180deg,#2c1650,#1d0e36);border:2px solid #c9a24a;
  box-shadow:0 0 0 4px #1a0d2e,0 0 0 6px #5a3408,0 18px 50px rgba(0,0,0,.6)}
#auth h1{margin:0 0 4px;text-align:center;font:34px 'Imperial Title',serif;color:#ffd86a;letter-spacing:2px;
  text-shadow:0 3px 0 #5a2a00}
#auth .sub{text-align:center;color:#c8b8e8;font-size:14px;margin-bottom:16px}
#auth .tabs{display:flex;gap:8px;margin-bottom:14px}
#auth .tab{flex:1;padding:10px;border-radius:10px;border:1px solid #6a4a9a;background:#241040;color:#c8b8e8;
  font-weight:600;font-size:16px;cursor:pointer}
#auth .tab.on{background:#4a2a7a;color:#ffd86a;border-color:#c9a24a}
#auth label{display:block;font-size:13px;color:#c8b8e8;margin:10px 0 4px}
#auth input[type=text],#auth input[type=email],#auth input[type=password]{width:100%;padding:12px;border-radius:10px;
  border:1px solid #6a4a9a;background:#140a26;color:#fff;font-size:16px;outline:none}
#auth input:focus{border-color:#ffd86a}
#auth .check{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px;color:#d8cce8}
#auth .check input{margin-top:2px;width:18px;height:18px;accent-color:#c9a24a}
#auth a{color:#ffd86a}
#auth .go{width:100%;margin-top:16px;padding:14px;border-radius:12px;border:none;cursor:pointer;
  background:linear-gradient(180deg,#ffe58a,#e0a62a);color:#3a1a00;font-weight:700;font-size:19px;box-shadow:0 4px 0 #8a5a10}
#auth .go:disabled{opacity:.6}
#auth .link{display:block;width:100%;margin-top:10px;background:none;border:none;color:#c8b8e8;font-size:14px;
  text-decoration:underline;cursor:pointer}
#auth .guest{margin-top:16px;padding-top:12px;border-top:1px solid #4a2a7a;text-align:center}
#auth .guest button{width:100%;padding:12px;border-radius:12px;border:1px solid #6a4a9a;background:#241040;color:#f4ead8;
  font-weight:600;font-size:16px;cursor:pointer}
#auth .guest small{display:block;margin-top:6px;color:#a898c8;font-size:12px}
#auth .msg{min-height:20px;margin-top:10px;font-size:14px;text-align:center}
#auth .msg.err{color:#ff8a7a}#auth .msg.ok{color:#9fe08a}
#auth .beta{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:8px;background:#c9a24a;color:#2a1400;
  font:700 12px system-ui;vertical-align:middle;letter-spacing:1px}
`;

const ERR = (e) => {
  const m = String(e?.message || e || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (m.includes('password') && m.includes('6')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão. Verifique a internet.';
  return 'Não foi possível concluir. Tente de novo.';
};

// Mostra a tela e resolve com 'user' (entrou) ou 'guest' (jogar sem conta).
export function showAuthGate() {
  return new Promise((resolve) => {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'auth';
    root.innerHTML = `
      <div class="card">
        <h1>Bomba Rural<span class="beta">BETA</span></h1>
        <div class="sub">Entre para salvar seu progresso na nuvem e jogar em qualquer aparelho.</div>
        <div class="tabs"><button class="tab on" data-t="in">Entrar</button><button class="tab" data-t="up">Criar conta</button></div>
        <form autocomplete="on">
          <div class="only-up" hidden>
            <label for="a-nick">Apelido no jogo (3 a 16 letras ou números)</label>
            <input id="a-nick" type="text" maxlength="16" autocomplete="nickname" placeholder="Ex.: Pavio Curto">
          </div>
          <label for="a-mail">E-mail</label>
          <input id="a-mail" type="email" autocomplete="email" placeholder="seu@email.com" required>
          <label for="a-pass">Senha</label>
          <input id="a-pass" type="password" autocomplete="current-password" placeholder="mínimo 6 caracteres" required minlength="6">
          <div class="only-up check" hidden>
            <input id="a-terms" type="checkbox"><span>Li e aceito a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
          </div>
          <button class="go" type="submit">Entrar</button>
          <button class="link only-in" type="button" data-forgot>Esqueci minha senha</button>
          <div class="msg"></div>
        </form>
        <div class="guest"><button type="button" data-guest>Jogar sem conta</button>
          <small>O progresso fica salvo só neste aparelho. Dá para criar a conta depois nas Configurações e levar o progresso junto.</small></div>
      </div>`;
    document.body.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const msg = (t, ok) => { const m = $('.msg'); m.textContent = t || ''; m.className = 'msg' + (t ? (ok ? ' ok' : ' err') : ''); };
    let mode = 'in';
    const setMode = (m) => {
      mode = m;
      root.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === m));
      root.querySelectorAll('.only-up').forEach((e) => { e.hidden = m !== 'up'; });
      root.querySelectorAll('.only-in').forEach((e) => { e.hidden = m !== 'in'; });
      $('.go').textContent = m === 'up' ? 'Criar conta' : 'Entrar';
      $('#a-pass').autocomplete = m === 'up' ? 'new-password' : 'current-password';
      msg('');
    };
    root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.t)));
    const done = (r) => { root.remove(); st.remove(); resolve(r); };
    $('[data-guest]').addEventListener('click', () => { try { localStorage.setItem(GUEST_KEY, '1'); } catch (e) { /* ok */ } done('guest'); });
    $('[data-forgot]').addEventListener('click', async () => {
      const email = $('#a-mail').value.trim();
      if (!email) { msg('Digite seu e-mail acima e toque de novo em "Esqueci minha senha".'); return; }
      try { await Cloud.resetPassword(email); msg('Enviamos um link para trocar a senha no seu e-mail.', true); } catch (e) { msg(ERR(e)); }
    });
    $('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = $('#a-mail').value.trim();
      const pass = $('#a-pass').value;
      const go = $('.go');
      go.disabled = true;
      try {
        if (mode === 'in') {
          await Cloud.signIn(email, pass);
          try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* ok */ }
          done('user');
          return;
        }
        const nick = $('#a-nick').value.trim().replace(/\s+/g, ' ');
        if (!/^[A-Za-zÀ-ÿ0-9_ ]{3,16}$/.test(nick)) { msg('Apelido: 3 a 16 letras, números, espaço ou _.'); return; }
        if (!$('#a-terms').checked) { msg('Para criar a conta, aceite a Política de Privacidade.'); return; }
        if (pass.length < 6) { msg('A senha precisa ter pelo menos 6 caracteres.'); return; }
        if (!(await Cloud.nicknameFree(nick))) { msg('Esse apelido já está em uso. Escolha outro.'); return; }
        const r = await Cloud.signUp(email, pass, nick);
        if (r.needsConfirm) {
          setMode('in');
          $('#a-mail').value = email;
          msg('Conta criada! Abra o link que enviamos para o seu e-mail e depois toque em Entrar.', true);
          return;
        }
        try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* ok */ }
        done('user');
      } catch (e) {
        msg(ERR(e));
      } finally {
        go.disabled = false;
      }
    });
  });
}
