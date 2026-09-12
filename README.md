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
completo e funcional precisa rodar em um serviço que suporte Node.js, por exemplo:

- [Render](https://render.com/) ou [Railway](https://railway.app/) (planos gratuitos disponíveis)
- [Fly.io](https://fly.io/)
- Uma VPS própria (com Node.js, PM2 e um domínio configurado)

Nesses serviços, configure as variáveis de ambiente do `.env.example` e rode `npm install && npm start`.

