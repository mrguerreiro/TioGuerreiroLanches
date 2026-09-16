const formatarMoeda = (valor) => Number(valor).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

const ETAPAS = {
  retirada: [
    ['recebido', 'Pedido recebido'],
    ['preparando', 'Sendo preparado'],
    ['pronto_retirada', 'Pronto para retirada'],
    ['concluido', 'Concluído']
  ],
  entrega: [
    ['recebido', 'Pedido recebido'],
    ['preparando', 'Sendo preparado'],
    ['saiu_para_entrega', 'Saiu para entrega'],
    ['concluido', 'Concluído']
  ]
};

const parametros = new URLSearchParams(window.location.search);
const idPedido = parametros.get('pedido');
const token = parametros.get('token');

function mostrarErro(mensagem) {
  document.getElementById('carregando').hidden = true;
  document.getElementById('dados-pedido').hidden = true;
  const caixa = document.getElementById('erro-acompanhamento');
  caixa.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'mensagem-erro';
  div.textContent = mensagem;
  caixa.appendChild(div);
  caixa.hidden = false;
}

function renderizarLinhaTempo(pedido) {
  const lista = document.getElementById('linha-tempo');
  const etapas = ETAPAS[pedido.tipoEntrega] || ETAPAS.retirada;

  if (pedido.status === 'cancelado') {
    lista.innerHTML = '<li class="feito">Pedido recebido</li><li class="cancelado">Pedido cancelado</li>';
    return;
  }

  // Um status fora do fluxo deste tipo de pedido (ex.: "saiu para entrega" numa retirada) conta como a etapa anterior à conclusão.
  let indiceAtual = etapas.findIndex(([status]) => status === pedido.status);
  if (indiceAtual === -1) indiceAtual = etapas.length - 2;

  lista.innerHTML = etapas.map(([, rotulo], indice) => {
    const classes = [];
    if (indice <= indiceAtual) classes.push('feito');
    if (indice === indiceAtual) classes.push('atual');
    return `<li class="${classes.join(' ')}">${escaparHtml(rotulo)}</li>`;
  }).join('');
}

function renderizarPedido(pedido) {
  document.getElementById('titulo-pedido').textContent = `Pedido ${pedido.id}`;
  document.getElementById('info-pedido').textContent =
    `${new Date(pedido.criadoEm).toLocaleString('pt-br')} · ${pedido.tipoEntrega === 'entrega' ? 'Entrega' : 'Retirada na loja'}`;

  renderizarLinhaTempo(pedido);

  const itens = document.getElementById('itens-pedido');
  itens.innerHTML = pedido.itens.map((it) => {
    const acrescimos = it.acrescimos.length > 0 ? ` <small>(+ ${escaparHtml(it.acrescimos.join(', '))})</small>` : '';
    return `${it.quantidade}x ${escaparHtml(it.nome)}${acrescimos}`;
  }).join('<br>');
  document.getElementById('total-pedido').textContent = formatarMoeda(pedido.total);

  document.getElementById('carregando').hidden = true;
  document.getElementById('erro-acompanhamento').hidden = true;
  document.getElementById('dados-pedido').hidden = false;
}

async function atualizar() {
  try {
    renderizarPedido(await API.acompanharPedido(idPedido, token));
    return true;
  } catch (err) {
    mostrarErro(err.message === 'Pedido não encontrado.'
      ? 'Pedido não encontrado. Confira se o link está completo.'
      : 'Não foi possível carregar o pedido agora. Tente novamente em instantes.');
    return false;
  }
}

async function iniciar() {
  if (!idPedido || !token) {
    mostrarErro('Link de acompanhamento incompleto.');
    return;
  }
  await atualizar();
  setInterval(() => {
    if (!document.hidden) atualizar();
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) atualizar();
  });
}

iniciar();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
