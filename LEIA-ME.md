# Bomba Rural: versão para publicar no site

Esta pasta é o jogo pronto. Não precisa compilar nem instalar nada: são arquivos estáticos (HTML, JavaScript e imagens).

```
index.html        página do jogo
lib/phaser.min.js motor do jogo (Phaser 3.90), já incluído
src/              código do jogo
assets/           imagens (cenários, heróis, ícones, fundo do espaço)
```

## Regra importante

O jogo **precisa ser aberto por um endereço http(s)**. Clicar duas vezes no `index.html` não funciona, porque o navegador bloqueia os módulos JavaScript abertos direto do disco.

## Opções para publicar (todas gratuitas)

### Netlify Drop (o mais fácil)
1. Abra https://app.netlify.com/drop
2. Arraste **esta pasta inteira** (ou o .zip) para a página.
3. Pronto: ele gera um link. Dá para trocar o nome do site nas configurações.

### GitHub Pages
1. Crie um repositório no GitHub e envie o conteúdo desta pasta (o `index.html` na raiz).
2. Em *Settings → Pages*, escolha a branch `main` e a pasta `/ (root)`.
3. O jogo fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

### itch.io (bom para divulgar jogos)
1. Crie um projeto e marque **Kind of project: HTML**.
2. Envie o **.zip** (o `index.html` já está na raiz do zip).
3. Marque *This file will be played in the browser*.
4. Tamanho do quadro sugerido: **540 × 960** (vertical), com *Mobile friendly* e *Fullscreen button* ligados.

### Vercel / Cloudflare Pages / hospedagem própria
Envie os arquivos como site estático. Não há etapa de build.

## Testar no computador antes de subir

Com Python instalado, abra um terminal nesta pasta e rode:

```
python -m http.server 8000
```

Depois acesse http://localhost:8000 no navegador.

## Observações

- **Onde fica o save:** o progresso fica salvo no navegador de cada jogador (`localStorage`). Mudar o endereço do site começa um save novo.
- **Fonte:** a fonte pixel (Jersey 10) vem do Google Fonts. Sem internet, o jogo usa uma fonte reserva.
- **Celular:** o jogo foi feito para tela vertical. No celular, "Adicionar à tela inicial" abre como app.
