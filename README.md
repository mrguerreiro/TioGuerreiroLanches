# Tio Guerreiro Lanches — Site de Pedidos

Site completo para pedidos online da lanchonete Tio Guerreiro, com cardápio, carrinho, checkout (retirada/entrega),
pagamento na entrega ou online via PagSeguro, painel administrativo e suporte a instalação como aplicativo (PWA)
em Android e iOS.

## Como rodar localmente

```powershell
npm install
copy .env.example .env
npm start
```

Acesse `http://localhost:3000` para o site do cliente e `http://localhost:3000/admin` para o painel administrativo.

Login padrão do painel (definido em `.env`):
- Usuário: `admin`
- Senha: `troque-esta-senha`

**Troque `ADMIN_USER`, `ADMIN_PASSWORD` e `SESSION_SECRET` no `.env` antes de publicar o site.**

## Estrutura

- `server/` — API em Node.js/Express. Dados salvos em arquivos JSON (`server/data`).
- `public/` — site do cliente (`index.html`) e painel administrativo (`admin.html`).
- `public/img/produtos/` — imagens ilustrativas geradas para cada item do cardápio (não são fotos reais).
- `scripts/generate-product-images.js` — regera as imagens ilustrativas iniciais a partir do `server/data/menu.json`.

## Pagamento pelo PagSeguro

Por padrão (sem credenciais configuradas), a opção "Pagar agora" abre uma página de simulação, apenas para fins de
demonstração. Para habilitar cobranças reais:

1. Crie uma conta/aplicação no [PagBank/PagSeguro Developers](https://dev.pagbank.uol.com.br/).
2. Gere um token de API (sandbox ou produção).
3. Preencha no `.env`:
   ```
   PAGSEGURO_TOKEN=seu-token
   PAGSEGURO_SANDBOX=true  (ou false em produção)
   ```
4. Reinicie o servidor. O checkout passará a redirecionar para o link real de pagamento do PagSeguro.

## Painel administrativo

No painel é possível:
- Ver e atualizar o status dos pedidos recebidos.
- Adicionar novos itens ao cardápio (lanches ou bebidas) — se nenhuma imagem for informada, uma imagem ilustrativa
  é gerada automaticamente nas cores da marca.
- Pausar/reativar um item (fica visível mas indisponível para pedido).
- Excluir um item definitivamente.
- Alterar taxa de entrega, horário de funcionamento, WhatsApp e formas de pagamento aceitas.

## Instalar como aplicativo (PWA)

O site pode ser instalado na tela inicial do celular, funcionando como um app:

**Android (Chrome):** acesse o site, toque no menu (⋮) e escolha "Instalar app" ou "Adicionar à tela inicial".
Um botão "📲 Instalar app" também aparece automaticamlente quando o navegador permite.

**iPhone/iPad (Safari):** acesse o site, toque no ícone de compartilhar (□↑) e escolha "Adicionar à Tela de Início".

## Observações importantes

- As fotos dos lanches e bebidas são **imagens meramente ilustrativas**, geradas com as cores da marca — não são
  fotos reais dos produtos. Isso é informado no topo do site e ao lado de cada imagem.
- A taxa de entrega inicial está configurada como R$ 0,00 (gratuita), ajustável em Configurações no painel admin.

## Publicação no GitHub Pages

Este repositório publica automaticamente a pasta `public/` no GitHub Pages a cada push na branch `main`
(workflow em `.github/workflows/deploy-pages.yml`).

**Importante:** o GitHub Pages hospeda apenas arquivos estáticos. Ele **não executa o servidor Node.js**, então
no endereço do GitHub Pages o cardápio, o carrinho, os pedidos e o painel administrativo **não funcionam** —
o site mostra apenas um aviso explicando isso. O GitHub Pages é útil como vitrine/prévia visual, mas o site
completo e funcional precisa rodar em um serviço que suporte Node.js — veja a seção abaixo.

## Publicar o site completo e funcional (Render)

O jeito mais simples de colocar o site no ar **com todas as funções ativas** (cardápio, pedidos, painel admin)
é usar o [Render](https://render.com/), que tem plano gratuito. O repositório já inclui o arquivo `render.yaml`
com a configuração pronta.

Passo a passo:

1. Crie uma conta gratuita em [render.com](https://render.com/) (pode entrar com sua conta do GitHub).
2. No painel do Render, clique em **New +** → **Blueprint**.
3. Selecione o repositório `TioGuerreiroLanches` (autorize o Render a acessar sua conta do GitHub se pedido).
4. O Render vai detectar o `render.yaml` automaticamente. Confirme a criação do serviço.
5. Quando pedir os valores de `ADMIN_PASSWORD`, `PAGSEGURO_EMAIL` e `PAGSEGURO_TOKEN`, preencha (ou deixe em
   branco para configurar depois em **Environment** nas configurações do serviço).
6. Aguarde o build/deploy terminar. O Render vai gerar uma URL pública, algo como
   `https://tio-guerreiro-lanches.onrender.com` — esse link já abre o site completo e funcional.

**Atenção — armazenamento no plano gratuito:** o plano gratuito do Render usa disco temporário. Isso significa
que o cardápio (itens adicionados/pausados/excluídos pelo painel) e os pedidos salvos em `server/data/*.json`
são perdidos a cada novo deploy ou quando o serviço "dorme" por inatividade e reinicia. Para manter os dados
permanentemente, é necessário um plano pago do Render com disco persistente, ou migrar o armazenamento para um
banco de dados externo (ex.: PostgreSQL gratuito do próprio Render, ou similar).

Alternativas ao Render, com o mesmo princípio (Node.js + variáveis de ambiente do `.env.example`):
- [Railway](https://railway.app/)
- [Fly.io](https://fly.io/)
- Uma VPS própria (com Node.js, PM2 e um domínio configurado)

