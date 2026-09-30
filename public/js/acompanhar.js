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

function textoPagamento(pedido) {
  if (pedido.formaPagamento !== 'online') return 'Pagamento: na entrega/retirada.';
  const TEXTOS = {
    pago: 'Pagamento: ✅ confirmado online.',
    em_analise: 'Pagamento: em análise pelo PagBank. Assim que for aprovado, esta página mostra.',
    recusado: 'Pagamento: recusado. Tente de novo ou pague na entrega/retirada.',
    cancelado: 'Pagamento: cancelado. Em caso de dúvida, fale com a loja.',
    valor_divergente: 'Pagamento: recebido, mas a loja precisa conferir. Em caso de dúvida, fale com a loja.'
  };
  if (TEXTOS[pedido.pagamento.status]) return TEXTOS[pedido.pagamento.status];
  return pedido.pagamento.linkCheckout
    ? 'Pagamento: aguardando. Se você já pagou, a confirmação pode levar alguns instantes.'
    : 'Pagamento: o link de pagamento online expirou. O pagamento será feito na entrega/retirada.';
}

function renderizarPagamento(pedido) {
  document.getElementById('pagamento-pedido').textContent = textoPagamento(pedido);
  const botao = document.getElementById('btn-pagar-agora');
  const link = pedido.pagamento && pedido.pagamento.linkCheckout;
  // Só aceita links https ou do próprio site, para o endereço nunca virar código (ex.: "javascript:").
  const linkSeguro = link && /^(https:\/\/|\/)/.test(link) ? link : null;
  botao.hidden = !linkSeguro || pedido.status === 'cancelado';
  if (linkSeguro) botao.href = linkSeguro;
}

function renderizarPedido(pedido) {
  document.getElementById('titulo-pedido').textContent = `Pedido ${pedido.id}`;
  document.getElementById('info-pedido').textContent =
    `${new Date(pedido.criadoEm).toLocaleString('pt-br')} · ${pedido.tipoEntrega === 'entrega' ? 'Entrega' : 'Retirada na loja'}`;

  renderizarLinhaTempo(pedido);

  const itens = document.getElementById('itens-pedido');
  itens.innerHTML = pedido.itens.map((it) => {
    const acrescimos = it.acrescimos.length > 0 ? ` <small>(+ ${escaparHtml(it.acrescimos.join(', '))})</small>` : '';
    const observacao = it.observacao ? `<br><small class="observacao-item">Obs.: ${escaparHtml(it.observacao)}</small>` : '';
    return `${it.quantidade}x ${escaparHtml(it.nome)}${acrescimos}${observacao}`;
  }).join('<br>');
  document.getElementById('total-pedido').textContent = formatarMoeda(pedido.total);
  renderizarPagamento(pedido);

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
