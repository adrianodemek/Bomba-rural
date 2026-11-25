// Servidor do beta (Supabase). A chave publicável pode ficar no jogo: o acesso aos dados é protegido
// pelas regras do banco (cada jogador só lê e grava o próprio save).
export const ONLINE = {
  url: 'https://sskbpynlfvdwhcvcndlm.supabase.co',
  key: 'sb_publishable_f1lpLPk8gzO6M8hgLX7cJQ_w8Six99l',
  pushEveryMs: 45000,     // save na nuvem no máximo a cada 45 s (e sempre ao sair/minimizar)
  beta: true,             // esconde as ferramentas de teste (aparecem com ?teste na URL)
};
