let menu = [];
let configuracoes = {};
let acrescimosCatalogo = [];
let carrinho = {}; // { [chave]: { item, quantidade, acrescimos: [{id,nome,preco}] } }
let itemPendenteAcrescimo = null;

const suportaAvisos = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ehIphoneForaDoApp = /iphone|ipad|ipod/i.test(navigator.userAgent)
  && !navigator.standalone
  && !window.matchMedia('(display-mode: standalone)').matches;

const formatarMoeda = (valor) => valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

function renderizarMenu() {
  const grades = { lanche: document.getElementById('grade-lanches'), bebida: document.getElementById('grade-bebidas') };
  grades.lanche.innerHTML = '';
  grades.bebida.innerHTML = '';

  for (const item of menu) {
    const grade = grades[item.categoria];
    if (!grade) continue;

    const card = document.createElement('div');
    card.className = 'card-produto';
    card.innerHTML = `
      <img src="${escaparHtml(item.imagem)}" alt="Imagem ilustrativa de ${escaparHtml(item.nome)}" loading="lazy">
      <div class="corpo">
        ${item.pausado ? '<span class="selo-pausado">Indisponível no momento</span>' : ''}
        <h3>${escaparHtml(item.nome)}</h3>
        <p class="descricao">${escaparHtml(item.descricao)}</p>
        <div class="rodape">
          <span class="preco">${formatarMoeda(item.preco)}</span>
          <button class="btn" data-id="${escaparHtml(item.id)}" ${item.pausado ? 'disabled' : ''}>Adicionar</button>
        </div>
      </div>`;
    grade.appendChild(card);
  }

  document.querySelectorAll('.card-produto button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => adicionarAoCarrinho(btn.dataset.id));
  });
}

function adicionarAoCarrinho(id) {
  const item = menu.find((m) => m.id === id);
  if (!item || item.pausado) return;

  if (item.categoria === 'lanche' && acrescimosCatalogo.some((a) => !a.pausado)) {
    abrirModalAcrescimos(item);
    return;
  }

  incluirNoCarrinho(item, []);
}

function chaveCarrinho(item, acrescimos) {
  const idsAcrescimos = acrescimos.map((a) => a.id).sort().join(',');
  return `${item.id}::${idsAcrescimos}`;
}

function incluirNoCarrinho(item, acrescimos) {
  const chave = chaveCarrinho(item, acrescimos);
  if (!carrinho[chave]) carrinho[chave] = { item, quantidade: 0, acrescimos };
  carrinho[chave].quantidade += 1;
  atualizarBarraCarrinho();
}

function abrirModalAcrescimos(item) {
  itemPendenteAcrescimo = item;
  document.getElementById('nome-item-acrescimo').textContent = item.nome;

  const lista = document.getElementById('lista-selecao-acrescimos');
  lista.innerHTML = acrescimosCatalogo.map((a) => `
    <li>
      <label>
        <input type="checkbox" value="${escaparHtml(a.id)}" data-preco="${Number(a.preco)}" ${a.pausado ? 'disabled' : ''}>
        <span class="nome-acrescimo">${escaparHtml(a.nome)}${a.pausado ? ' <small>(indisponível)</small>' : ''}</span>
        <span class="preco-acrescimo">+ ${formatarMoeda(a.preco)}</span>
      </label>
    </li>`).join('');

  lista.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', atualizarTotalModalAcrescimos);
  });

  atualizarTotalModalAcrescimos();
  abrirModal('modal-acrescimos');
}

function atualizarTotalModalAcrescimos() {
  const marcados = document.querySelectorAll('#lista-selecao-acrescimos input:checked');
  const somaAcrescimos = Array.from(marcados).reduce((soma, cb) => soma + Number(cb.dataset.preco), 0);
  const total = (itemPendenteAcrescimo ? itemPendenteAcrescimo.preco : 0) + somaAcrescimos;
  document.getElementById('total-item-acrescimo').textContent = formatarMoeda(total);
}

function confirmarAcrescimos() {
  if (!itemPendenteAcrescimo) return;
  const marcados = document.querySelectorAll('#lista-selecao-acrescimos input:checked');
  const acrescimosEscolhidos = Array.from(marcados).map((cb) => {
    const catalogo = acrescimosCatalogo.find((a) => a.id === cb.value);
    return { id: catalogo.id, nome: catalogo.nome, preco: catalogo.preco };
  });

  incluirNoCarrinho(itemPendenteAcrescimo, acrescimosEscolhidos);
  itemPendenteAcrescimo = null;
  fecharModal('modal-acrescimos');
}

function alterarQuantidade(chave, delta) {
  if (!carrinho[chave]) return;
  carrinho[chave].quantidade += delta;
  if (carrinho[chave].quantidade <= 0) delete carrinho[chave];
  atualizarBarraCarrinho();
  renderizarModalCarrinho();
}

function precoUnitario(entrada) {
  const somaAcrescimos = entrada.acrescimos.reduce((soma, a) => soma + a.preco, 0);
  return entrada.item.preco + somaAcrescimos;
}

function totalCarrinho() {
  return Object.values(carrinho).reduce((soma, entrada) => soma + precoUnitario(entrada) * entrada.quantidade, 0);
}

function quantidadeTotalCarrinho() {
  return Object.values(carrinho).reduce((soma, { quantidade }) => soma + quantidade, 0);
}

function atualizarBarraCarrinho() {
  const barra = document.getElementById('barra-carrinho');
  const qtd = quantidadeTotalCarrinho();
  document.getElementById('resumo-carrinho').textContent = `${qtd} ite${qtd === 1 ? 'm' : 'ns'} — ${formatarMoeda(totalCarrinho())}`;
  barra.classList.toggle('oculta', qtd === 0);
}

function renderizarModalCarrinho() {
  const container = document.getElementById('itens-carrinho');
  container.innerHTML = '';
  const entradas = Object.entries(carrinho);

  if (entradas.length === 0) {
    container.innerHTML = '<p>Seu carrinho está vazio.</p>';
  }

  for (const [chave, entrada] of entradas) {
    const { item, quantidade, acrescimos } = entrada;
    const textoAcrescimos = acrescimos.length > 0
      ? `<br><small>+ ${escaparHtml(acrescimos.map((a) => a.nome).join(', '))}</small>`
      : '';
    const linha = document.createElement('div');
    linha.className = 'linha-item-carrinho';
    linha.innerHTML = `
      <span class="nome">${escaparHtml(item.nome)}<br><small>${formatarMoeda(precoUnitario(entrada))}</small>${textoAcrescimos}</span>
      <div class="qtd-controle">
        <button data-acao="menos">−</button>
        <span>${quantidade}</span>
        <button data-acao="mais">+</button>
      </div>`;
    linha.querySelector('[data-acao="menos"]').addEventListener('click', () => alterarQuantidade(chave, -1));
    linha.querySelector('[data-acao="mais"]').addEventListener('click', () => alterarQuantidade(chave, 1));
    container.appendChild(linha);
  }

  document.getElementById('total-carrinho').textContent = formatarMoeda(totalCarrinho());
}

function abrirModal(id) { document.getElementById(id).classList.remove('oculta'); }
function fecharModal(id) { document.getElementById(id).classList.add('oculta'); }

function tipoEntregaSelecionado() {
  const marcado = document.querySelector('input[name="tipoEntrega"]:checked');
  return marcado ? marcado.value : null;
}

function taxaEntregaAtual() {
  return tipoEntregaSelecionado() === 'entrega' ? Number(configuracoes.taxaEntrega || 0) : 0;
}

function atualizarTotalCheckout() {
  const subtotal = totalCarrinho();
  const taxa = taxaEntregaAtual();
  document.getElementById('subtotal-checkout').textContent = formatarMoeda(subtotal);
  document.getElementById('taxa-checkout').textContent = taxa > 0 ? formatarMoeda(taxa) : 'Grátis';
  document.getElementById('linha-taxa-entrega').hidden = tipoEntregaSelecionado() !== 'entrega';
  document.getElementById('total-checkout').textContent = formatarMoeda(subtotal + taxa);
}

function alternarCamposEndereco() {
  const tipo = tipoEntregaSelecionado();
  document.getElementById('campos-endereco').style.display = tipo === 'entrega' ? 'block' : 'none';
  document.querySelectorAll('#campos-endereco input').forEach((input) => {
    input.required = tipo === 'entrega' && input.name !== 'complemento';
  });
  atualizarTotalCheckout();
}

// Mostra só as opções que a loja aceita (Configurações do painel) e marca a primeira disponível.
function aplicarOpcaoDaLoja(nomeGrupo, opcoes) {
  let algumaVisivel = false;
  for (const { idRotulo, aceita } of opcoes) {
    const rotulo = document.getElementById(idRotulo);
    const input = rotulo.querySelector('input');
    rotulo.hidden = !aceita;
    input.disabled = !aceita;
    if (!aceita) input.checked = false;
    algumaVisivel = algumaVisivel || aceita;
  }
  const marcado = document.querySelector(`input[name="${nomeGrupo}"]:checked`);
  if (!marcado) {
    const primeiro = document.querySelector(`input[name="${nomeGrupo}"]:not(:disabled)`);
    if (primeiro) primeiro.checked = true;
  }
  return algumaVisivel;
}

function aplicarOpcoesDaLoja() {
  const temEntrega = aplicarOpcaoDaLoja('tipoEntrega', [
    { idRotulo: 'opcao-retirada', aceita: configuracoes.aceitaRetirada !== false },
    { idRotulo: 'opcao-entrega', aceita: configuracoes.aceitaEntrega !== false }
  ]);
  const temPagamento = aplicarOpcaoDaLoja('formaPagamento', [
    { idRotulo: 'opcao-pagamento-local', aceita: configuracoes.aceitaPagamentoEntrega !== false },
    { idRotulo: 'opcao-pagamento-online', aceita: configuracoes.aceitaPagamentoOnline !== false }
  ]);

  const podePedir = temEntrega && temPagamento;
  document.getElementById('btn-confirmar-pedido').disabled = !podePedir;
  const erroBox = document.getElementById('erro-checkout');
  erroBox.innerHTML = '';
  if (!podePedir) {
    erroBox.innerHTML = '<div class="mensagem-erro">No momento a loja não está aceitando pedidos pelo site.</div>';
  }
  alternarCamposEndereco();
}

// ---------- Avisos no celular (Web Push) ----------

function configurarBlocoAvisos() {
  const disponivel = suportaAvisos && Notification.permission !== 'denied';
  document.getElementById('bloco-avisos').hidden = !disponivel;
  document.getElementById('dica-avisos-iphone').hidden = suportaAvisos || !ehIphoneForaDoApp;
}

function base64UrlParaBytes(base64Url) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function mesmaChave(inscricao, chave) {
  const atual = inscricao.options && inscricao.options.applicationServerKey;
  if (!atual) return true;
  const bytes = new Uint8Array(atual);
  return bytes.length === chave.length && bytes.every((b, i) => b === chave[i]);
}

function comLimiteDeTempo(promessa, ms) {
  return Promise.race([promessa, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Pede permissão e inscreve este navegador para receber avisos. Retorna null se não for possível.
function obterInscricaoAvisos() {
  // A permissão precisa ser pedida antes de qualquer "await" para contar como ação do usuário (Safari).
  const permissao = new Promise((resolve) => {
    const retorno = Notification.requestPermission(resolve);
    if (retorno && retorno.then) retorno.then(resolve);
  });

  return (async () => {
    try {
      if (await permissao !== 'granted') return null;
      const [registro, { chave }] = await Promise.all([navigator.serviceWorker.ready, API.getChavePush()]);
      if (!chave) return null;

      const applicationServerKey = base64UrlParaBytes(chave);
      let inscricao = await registro.pushManager.getSubscription();
      if (inscricao && !mesmaChave(inscricao, applicationServerKey)) {
        await inscricao.unsubscribe();
        inscricao = null;
      }
      if (!inscricao) {
        inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      }
      return inscricao.toJSON();
    } catch (err) {
      console.warn('Não foi possível ativar os avisos no celular', err);
      return null;
    } finally {
      configurarBlocoAvisos();
    }
  })();
}

function linkAcompanhamento(id, token) {
  return `acompanhar.html?pedido=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
}

function guardarUltimoPedido(pedido) {
  try {
    localStorage.setItem('ultimoPedido', JSON.stringify({ id: pedido.id, token: pedido.tokenAcompanhamento }));
  } catch (err) { /* navegador sem armazenamento local: só não mostra o atalho */ }
  mostrarLinkUltimoPedido();
}

function mostrarLinkUltimoPedido() {
  let ultimo = null;
  try {
    ultimo = JSON.parse(localStorage.getItem('ultimoPedido'));
  } catch (err) { /* ignora */ }
  const paragrafo = document.getElementById('link-ultimo-pedido');
  if (!ultimo || !ultimo.id || !ultimo.token) {
    paragrafo.hidden = true;
    return;
  }
  paragrafo.querySelector('a').href = linkAcompanhamento(ultimo.id, ultimo.token);
  paragrafo.hidden = false;
}

async function enviarPedido(evento) {
  evento.preventDefault();
  const erroBox = document.getElementById('erro-checkout');
  erroBox.innerHTML = '';

  const form = evento.target;
  const botao = document.getElementById('btn-confirmar-pedido');
  const tipoEntrega = form.tipoEntrega.value;
  const formaPagamento = form.formaPagamento.value;

  const cliente = {
    nome: form.nome.value.trim(),
    telefone: form.telefone.value.trim()
  };
  if (tipoEntrega === 'entrega') {
    cliente.endereco = {
      rua: form.rua.value.trim(),
      numero: form.numero.value.trim(),
      complemento: form.complemento.value.trim(),
      bairro: form.bairro.value.trim(),
      cidade: form.cidade.value.trim()
    };
  }

  const itens = Object.values(carrinho).map(({ item, quantidade, acrescimos }) => ({
    id: item.id,
    quantidade,
    acrescimos: acrescimos.map((a) => a.id)
  }));

  botao.disabled = true;
  const querAvisos = suportaAvisos && !document.getElementById('bloco-avisos').hidden
    && document.getElementById('campo-avisos').checked;
  const promessaInscricao = querAvisos ? obterInscricaoAvisos() : null;

  try {
    const inscricao = promessaInscricao ? await comLimiteDeTempo(promessaInscricao, 60000) : null;
    const pedido = await API.criarPedido({ itens, tipoEntrega, cliente, formaPagamento, notificacoes: inscricao || undefined });
    guardarUltimoPedido(pedido);
    carrinho = {};
    atualizarBarraCarrinho();
    fecharModal('modal-checkout');

    if (pedido.pagamento && pedido.pagamento.linkCheckout) {
      window.location.href = pedido.pagamento.linkCheckout;
      return;
    }

    const textoPagamento = pedido.formaPagamento === 'online'
      ? 'online (a loja entrará em contato para concluir o pagamento).'
      : 'na entrega/retirada.';
    document.getElementById('mensagem-confirmacao').innerHTML = `
      ✅ Pedido <strong>${escaparHtml(pedido.id)}</strong> recebido!<br>
      Total: <strong>${formatarMoeda(pedido.total)}</strong><br>
      Pagamento: ${textoPagamento}<br><br>
      ${pedido.avisosAtivos ? '🔔 Você receberá um aviso no celular a cada mudança no pedido.<br>' : ''}
      <a href="${escaparHtml(linkAcompanhamento(pedido.id, pedido.tokenAcompanhamento))}">Acompanhar pedido</a>`;
    abrirModal('modal-confirmacao');
  } catch (err) {
    const mensagem = document.createElement('div');
    mensagem.className = 'mensagem-erro';
    mensagem.textContent = err.message;
    erroBox.appendChild(mensagem);
  } finally {
    botao.disabled = false;
  }
}

function configurarEventos() {
  document.getElementById('btn-ver-carrinho').addEventListener('click', () => {
    renderizarModalCarrinho();
    abrirModal('modal-carrinho');
  });
  document.getElementById('btn-fechar-carrinho').addEventListener('click', () => fecharModal('modal-carrinho'));

  document.getElementById('btn-ir-checkout').addEventListener('click', () => {
    if (quantidadeTotalCarrinho() === 0) return;
    aplicarOpcoesDaLoja();
    fecharModal('modal-carrinho');
    abrirModal('modal-checkout');
  });
  document.getElementById('btn-voltar-carrinho').addEventListener('click', () => {
    fecharModal('modal-checkout');
    abrirModal('modal-carrinho');
  });

  document.querySelectorAll('input[name="tipoEntrega"]').forEach((el) => el.addEventListener('change', alternarCamposEndereco));
  document.getElementById('form-checkout').addEventListener('submit', enviarPedido);

  document.getElementById('btn-confirmar-acrescimos').addEventListener('click', confirmarAcrescimos);
  document.getElementById('btn-cancelar-acrescimos').addEventListener('click', () => {
    itemPendenteAcrescimo = null;
    fecharModal('modal-acrescimos');
  });

  document.getElementById('btn-fechar-confirmacao').addEventListener('click', () => {
    fecharModal('modal-confirmacao');
    document.getElementById('form-checkout').reset();
    aplicarOpcoesDaLoja();
  });

  document.querySelectorAll('[data-voltar-topo]').forEach((btn) => {
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  });
}

async function iniciar() {
  configurarEventos();
  configurarBlocoAvisos();
  mostrarLinkUltimoPedido();
  try {
    [menu, configuracoes, acrescimosCatalogo] = await Promise.all([API.getMenu(), API.getConfiguracoes(), API.getAcrescimos()]);
    renderizarMenu();
    aplicarOpcoesDaLoja();
    if (configuracoes.horarioFuncionamento) {
      document.getElementById('horario-funcionamento').textContent = configuracoes.horarioFuncionamento;
    }
  } catch (err) {
    console.error('Erro ao carregar cardápio', err);
    // Sem servidor Node disponível (ex.: prévia estática no GitHub Pages) não há cardápio dinâmico nem pedidos.
    document.getElementById('grade-lanches').innerHTML = '';
    document.getElementById('grade-bebidas').innerHTML = '';
    const aviso = document.createElement('p');
    aviso.className = 'mensagem-erro';
    aviso.textContent = 'Esta é uma prévia estática do site. Para ver o cardápio, fazer pedidos e usar o painel administrativo, é necessário rodar o servidor Node.js (veja o README do projeto).';
    document.getElementById('lista-lanches').appendChild(aviso);
  }
}

iniciar();

// PWA: registro do service worker e prompt de instalação
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

let promptInstalacao = null;
window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  promptInstalacao = evento;
  document.getElementById('btn-instalar').classList.remove('oculta');
});

document.getElementById('btn-instalar').addEventListener('click', async () => {
  if (!promptInstalacao) return;
  promptInstalacao.prompt();
  await promptInstalacao.userChoice;
  promptInstalacao = null;
  document.getElementById('btn-instalar').classList.add('oculta');
});
