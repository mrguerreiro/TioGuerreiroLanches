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

Acesse `http://localhost:3000` para o site do cliente e `http://localhost:3000/tocadachefe` para o painel administrativo (não há link para ele no site).

Login padrão do painel (definido em `.env`):
- Usuário: `admin`
- Senha: `troque-esta-senha`

**Troque `ADMIN_USER`, `ADMIN_PASSWORD` e `SESSION_SECRET` no `.env` antes de publicar o site.**

Se `ADMIN_PASSWORD` não estiver definida, o login do painel fica bloqueado (não existe senha padrão). Se
`SESSION_SECRET` não estiver definido, o servidor usa um segredo aleatório temporário e o login cai a cada reinício.

## Estrutura

- `server/` — API em Node.js/Express.
- `server/utils/db.js` — escolhe automaticamente o armazenamento: PostgreSQL (`dbPostgres.js`) se `DATABASE_URL`
  estiver definida, ou arquivos JSON locais (`dbArquivo.js`, em `server/data`) caso contrário.
- `public/` — site do cliente (`index.html`) e painel administrativo (`admin.html`).
- `public/img/produtos/` — imagens ilustrativas usadas no cardápio inicial do modo local (não são fotos reais).
- `scripts/generate-product-images.js` — regera essas imagens ilustrativas a partir do `server/data/menu.json`.

## Pagamento pelo PagSeguro

Por padrão (sem credenciais configuradas), a opção "Pagar agora" abre uma página de simulação, apenas para fins de
demonstração. Para habilitar cobranças reais:

1. Crie uma conta no [Portal do Desenvolvedor PagBank](https://developer.pagbank.com.br/) e gere o token de sandbox
   (testes). O token de produção é gerado na sua conta PagBank, na área de integrações.
2. Preencha no `.env` (ou em **Environment** no Render):
   ```
   PAGSEGURO_TOKEN=seu-token
   PAGSEGURO_SANDBOX=true  (ou false em produção, com o token de produção)
   ```
3. Reinicie o servidor. O checkout passará a redirecionar para o link real de pagamento do PagSeguro.

Como funciona:
- O pedido entra na hora no painel, mesmo antes de ser pago. A coluna **Pagamento** mostra se ele está
  aguardando, pago, recusado ou se o link expirou.
- O link de pagamento vale 60 minutos. Se o cliente não pagar nesse tempo, o pedido continua valendo e o painel
  avisa para cobrar na entrega/retirada.
- O PagBank avisa o site em `/api/pagamentos/notificacao` sempre que o pagamento muda. O site não confia no
  conteúdo do aviso: ele reconsulta o pagamento na API do PagBank antes de marcar o pedido como pago.
- Depois de pagar, o cliente volta para a página de acompanhamento do pedido, que também tem o botão
  "Pagar agora" enquanto o link estiver válido.
- Os avisos e o retorno só funcionam com o site publicado em https (ex.: Render). Rodando localmente, o checkout
  é criado, mas o status do pagamento não é atualizado.

## Painel administrativo

No painel é possível:
- Ver e atualizar o status dos pedidos recebidos.
- Consultar a aba **Clientes**: nome, telefone e endereço (quando informado) de cada cliente que já fez pedido,
  salvos automaticamente tanto na retirada quanto na entrega.
- Adicionar novos itens ao cardápio (lanches ou bebidas) — se nenhuma imagem for informada, uma imagem ilustrativa
  é gerada automaticamente nas cores da marca.
- Editar um item (categoria, nome, preço e descrição) pelo botão **Editar**; a foto é trocada em "Trocar foto".
- Pausar/reativar um item (fica visível mas indisponível para pedido).
- Cadastrar, editar (nome e preço), pausar/reativar e excluir **acréscimos** (eles aparecem só na janela que abre ao escolher um
  lanche; um acréscimo pausado aparece como indisponível e não pode ser escolhido).
- Cadastrar, renomear, pausar/reativar e excluir **sachês** (gratuitos), escolhidos pelo cliente depois dos acréscimos.
- Excluir um item definitivamente.
- Alterar a tabela de taxa de entrega por distância, localização da cozinha, horário de funcionamento, WhatsApp e
  formas de entrega/pagamento aceitas. As opções desativadas somem do checkout e também são recusadas pelo servidor.

## Taxa de entrega por distância

Com `ORS_API_KEY` configurada, ao digitar o endereço no checkout o servidor localiza o endereço e calcula a
distância de carro a partir da localização da cozinha pelo [OpenRouteService](https://openrouteservice.org/)
(mapas do OpenStreetMap, plano grátis sem cartão), e aplica a tabela de faixas das Configurações. Endereço não
encontrado no nível de rua ou acima da última faixa não pode pedir entrega. O valor é sempre recalculado no
servidor ao criar o pedido. Sem a chave, vale a taxa fixa das Configurações.

A cozinha é cadastrada por latitude e longitude (não pelo endereço), porque a numeração quadra-lote de Bauru
quase nunca existe no OpenStreetMap. Endereços de clientes sem número no mapa são medidos a partir do meio da rua.

## Avisos de andamento do pedido (notificações no celular)

A cada mudança de status do pedido, o cliente recebe uma notificação no celular. A primeira é sempre
**Pedido recebido**, enviada assim que o pedido é feito; depois vêm "sendo preparado", "saiu para entrega" ou
"pronto para retirada", "concluído" e "cancelado", conforme o status é alterado na aba Pedidos do painel.

- No checkout, a opção "🔔 Quero receber no celular os avisos" vem marcada. Ao confirmar o pedido, o navegador
  pede permissão para enviar notificações. Se o cliente recusar, o pedido é feito normalmente, só sem avisos.
- Tocar na notificação abre a página **Acompanhar pedido** (`acompanhar.html`), que mostra o andamento e se
  atualiza sozinha. O link também aparece na confirmação do pedido e no rodapé do site ("Acompanhar meu último pedido").
- Na aba Pedidos do painel, o ícone 🔔 indica que aquele cliente está recebendo os avisos.
- **iPhone/iPad:** só funciona com o site instalado na Tela de Início (iOS 16.4 ou mais recente). Fora do app, o
  checkout mostra essa orientação ao cliente.
- As notificações usam Web Push (gratuito, sem conta em serviço externo). As chaves são geradas automaticamente
  na primeira execução e guardadas no banco. Opcionalmente, defina `VAPID_SUBJECT` (e-mail ou site de contato da
  loja, ex.: `mailto:contato@sualoja.com.br`) nas variáveis de ambiente do Render.

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
5. Quando pedir os valores de `ADMIN_PASSWORD` e `PAGSEGURO_TOKEN`, preencha (ou deixe em
   branco para configurar depois em **Environment** nas configurações do serviço).
6. Aguarde o build/deploy terminar. O Render vai gerar uma URL pública, algo como
   `https://tio-guerreiro-lanches.onrender.com` — esse link já abre o site completo e funcional.

**Armazenamento persistente com PostgreSQL:** o `render.yaml` já provisiona automaticamente um banco de dados
PostgreSQL gratuito do próprio Render (`tio-guerreiro-db`) e conecta o site a ele pela variável `DATABASE_URL`.
Assim, o cardápio (itens adicionados/pausados/excluídos/fotos trocadas pelo painel) e os pedidos ficam salvos
permanentemente no banco, e não se perdem quando o serviço reinicia ou é atualizado.

Se rodar o site localmente **sem** configurar `DATABASE_URL` no `.env`, ele volta a usar os arquivos JSON em
`server/data/` (só para facilitar o desenvolvimento) — nesse modo local sem banco, os dados não são persistentes.

Alternativas ao Render, com o mesmo princípio (Node.js + PostgreSQL + variáveis de ambiente do `.env.example`):
- [Railway](https://railway.app/)
- [Fly.io](https://fly.io/)
- Uma VPS própria (com Node.js, PM2, PostgreSQL e um domínio configurado)

## Domínio próprio (tioguerreirolanches.com.br)

O site continua rodando no Render; o domínio registrado na HostGator só aponta para ele (a hospedagem
compartilhada da HostGator não mantém um servidor Node.js ligado).

1. No Render, em **Settings → Custom Domains**, adicione `tioguerreirolanches.com.br` e `www.tioguerreirolanches.com.br`.
2. No cPanel da HostGator, em **Editor de Zona DNS**, aponte o registro **A** de `tioguerreirolanches.com.br` para o
   IP informado pelo Render e troque o **CNAME** de `www` para `tio-guerreiro-lanches.onrender.com`.
3. Quando o Render mostrar os dois domínios como verificados (com certificado HTTPS emitido), defina
   `SITE_URL=https://tioguerreirolanches.com.br` em **Environment**. A partir daí quem abrir pelo endereço do Render
   ou pelo `www` é redirecionado ao domínio oficial, e os links de retorno e aviso enviados ao PagBank passam a
   usar o domínio.
