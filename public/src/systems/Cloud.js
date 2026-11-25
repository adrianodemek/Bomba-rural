// Conta e save na nuvem (Supabase). Sem conta (convidado) o jogo funciona igual, só com o save do aparelho.
import { ONLINE } from '../config/online.js';

let client = null;
let user = null;
let profile = null;
let pending = null;      // último save esperando envio
let lastPush = 0;
let timer = null;
let lastShowcase = null;   // última vitrine enviada (evita reenviar igual)

export function sb() {
  if (!client && window.supabase?.createClient) {
    client = window.supabase.createClient(ONLINE.url, ONLINE.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bomba-rural-auth' },
    });
  }
  return client;
}

export const Cloud = {
  get user() { return user; },
  get profile() { return profile; },
  get online() { return !!user; },

  async session() {
    const c = sb();
    if (!c) return null;
    try {
      const { data } = await c.auth.getSession();
      user = data.session?.user || null;
    } catch (e) { user = null; }
    return user;
  },

  // Perfil do jogador; na primeira entrada cria com o apelido escolhido no cadastro.
  async ensureProfile() {
    if (!user) return null;
    const c = sb();
    const { data } = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) { profile = data; return profile; }
    const nick = (user.user_metadata?.nickname || `Explorador${String(Math.floor(Math.random() * 9000) + 1000)}`).slice(0, 16);
    const ins = await c.from('profiles').insert({ id: user.id, nickname: nick }).select().single();
    if (ins.error) {
      // apelido ocupado nesse meio-tempo: usa com número
      const alt = `${nick.slice(0, 12)}${Math.floor(Math.random() * 900) + 100}`;
      const r2 = await c.from('profiles').insert({ id: user.id, nickname: alt }).select().single();
      profile = r2.data || null;
    } else profile = ins.data;
    return profile;
  },

  async nicknameFree(nick) {
    const c = sb();
    if (!c) return true;
    const { data, error } = await c.rpc('nickname_available', { nick });
    return error ? true : !!data;
  },

  async signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user;
    return user;
  },

  // Cria a conta. Se o projeto pedir confirmação por e-mail, volta sem sessão (needsConfirm).
  async signUp(email, password, nickname) {
    const { data, error } = await sb().auth.signUp({
      email, password,
      options: { data: { nickname }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
    user = data.session ? data.user : null;
    return { needsConfirm: !data.session };
  },

  async resetPassword(email) {
    const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },

  async signOut() {
    await this.flush();
    try { await sb()?.auth.signOut(); } catch (e) { /* sem rede: sai mesmo assim */ }
    user = null; profile = null;
  },

  async deleteAccount() {
    const { error } = await sb().rpc('delete_my_account');
    if (error) throw error;
    try { await sb().auth.signOut(); } catch (e) { /* conta já não existe */ }
    user = null; profile = null;
  },

  // Save da nuvem: { data, client_saved_at } ou null.
  async loadSave() {
    if (!user) return null;
    const { data, error } = await sb().from('saves').select('data, client_saved_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // Chamado a cada save local: guarda e envia no máximo a cada pushEveryMs.
  queue(saveObj, stats) {
    if (!user) return;
    pending = { saveObj, stats };
    const wait = lastPush + ONLINE.pushEveryMs - Date.now();
    if (wait <= 0) this.flush();
    else if (!timer) timer = setTimeout(() => { timer = null; this.flush(); }, wait);
  },

  async flush() {
    if (!user || !pending) return;
    const { saveObj, stats } = pending;
    pending = null;
    lastPush = Date.now();
    const c = sb();
    try {
      await c.from('saves').upsert({
        user_id: user.id, data: saveObj, save_version: saveObj.version || 0, client_saved_at: saveObj.savedAt || Date.now(),
      });
      if (profile && stats) {
        const row = {
          stages_cleared: stats.stages, best_power: stats.power, play_seconds: stats.play, abyss_best: stats.abyss,
          max_hero_level: stats.heroLvl, colossus_week: stats.colWeek, colossus_week_dmg: stats.colDmg, stars_total: stats.stars,
        };
        // vitrine (equipe e itens) só vai quando muda
        const sc = JSON.stringify(stats.showcase || null);
        if (sc !== lastShowcase) { row.showcase = stats.showcase; }
        const r = await c.from('profiles').update(row).eq('id', user.id);
        if (!r.error && row.showcase !== undefined) lastShowcase = sc;
      }
    } catch (e) {
      pending = pending || { saveObj, stats };   // sem rede: tenta de novo no próximo save
    }
  },
};
