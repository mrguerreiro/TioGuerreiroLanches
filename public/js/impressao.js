// Impressão dos pedidos em impressora térmica (bobina de 58 mm) pelo próprio navegador.
// Com o navegador aberto pelo atalho com --kiosk-printing, o cupom sai direto na impressora padrão, sem janela.

const CHAVE_IMPRESSAO_AUTOMATICA = 'impressaoAutomatica';
const CHAVE_PEDIDOS_IMPRESSOS = 'pedidosImpressos';
const LIMITE_PEDIDOS_IMPRESSOS = 500;

// A escolha de imprimir automaticamente vale só para este computador (é o que fica ligado à impressora).
function lerPreferencia(chave, padrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
}

function gravarPreferencia(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (ex.: janela anônima) a impressão automática só vale enquanto a página estiver aberta.
  }
}

function textoPagamentoCupom(pedido) {
  if (pedido.formaPagamento !== 'online') return 'COBRAR NA ENTREGA/RETIRADA';
  if (pedido.pagamento && pedido.pagamento.status === 'pago') return 'PAGO ONLINE - NÃO COBRAR';
  return situacaoPagamento(pedido).texto.replace(/[✅⚠]\s*/g, '');
}

function montarCupom(pedido) {
  const e = pedido.cliente.endereco;
  const endereco = e
    ? [
      `${e.rua}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ''}`,
      `${e.bairro} - ${e.cidade}`
    ].map((linha) => `<div>${escaparHtml(linha)}</div>`).join('')
    : '';

  const itens = pedido.itens.map((it) => {
    const acrescimos = (it.acrescimos || []).map((a) => `<div class="sub">+ ${escaparHtml(a.nome)}</div>`).join('');
    const saches = (it.saches || []).length > 0 ? `<div class="sub">Sachês: ${escaparHtml(it.saches.join(', '))}</div>` : '';
    const observacao = it.observacao ? `<div class="obs">OBS: ${escaparHtml(it.observacao)}</div>` : '';
    return `
      <div class="item">
        <div class="linha"><span class="nome">${it.quantidade}x ${escaparHtml(it.nome)}</span><span>${formatarMoeda(it.preco * it.quantidade)}</span></div>
        ${acrescimos}${saches}${observacao}
      </div>`;
  }).join('');

  const subtotal = pedido.subtotal !== undefined ? pedido.subtotal : pedido.total - (pedido.taxaEntrega || 0);

  return `<!DOCTYPE html>
<html lang="pt-br"><head><meta charset="UTF-8"><title>Pedido ${escaparHtml(pedido.id)}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  /* Bobina de 58 mm tem cerca de 48 mm de área impressa. */
  body { width: 48mm; margin: 0 auto; padding: 2mm 0 6mm; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.25; color: #000; }
  h1 { margin: 0; font-size: 15px; text-align: center; }
  .centro { text-align: center; }
  .tipo { margin: 4px 0; padding: 2px; border: 2px solid #000; font-size: 15px; font-weight: bold; text-align: center; }
  hr { margin: 4px 0; border: 0; border-top: 1px dashed #000; }
  .item { margin: 3px 0; }
  .linha { display: flex; justify-content: space-between; gap: 4px; }
  .nome { font-weight: bold; }
  .sub { padding-left: 8px; }
  .obs { padding-left: 8px; font-weight: bold; text-transform: uppercase; }
  .total { font-size: 14px; font-weight: bold; }
  .pagamento { margin-top: 4px; font-weight: bold; text-align: center; }
</style></head>
<body>
  <h1>TIO GUERREIRO LANCHES</h1>
  <div class="centro">${new Date(pedido.criadoEm).toLocaleString('pt-br')}</div>
  <div class="centro">Pedido ${escaparHtml(pedido.id)}</div>
  <div class="tipo">${pedido.tipoEntrega === 'entrega' ? 'ENTREGA' : 'RETIRADA NA LOJA'}</div>
  <div class="nome">${escaparHtml(pedido.cliente.nome)}</div>
  <div>${escaparHtml(pedido.cliente.telefone)}</div>
  ${endereco}
  <hr>
  ${itens}
  <hr>
  <div class="linha"><span>Subtotal</span><span>${formatarMoeda(subtotal)}</span></div>
  ${pedido.taxaEntrega ? `<div class="linha"><span>Entrega</span><span>${formatarMoeda(pedido.taxaEntrega)}</span></div>` : ''}
  <div class="linha total"><span>TOTAL</span><span>${formatarMoeda(pedido.total)}</span></div>
  <div class="pagamento">${escaparHtml(textoPagamentoCupom(pedido))}</div>
</body></html>`;
}

// Imprime por um iframe escondido, para não sair do painel. Os cupons vão em fila, um de cada vez.
let filaImpressao = Promise.resolve();

function imprimirPedido(pedido) {
  filaImpressao = filaImpressao
    .then(() => new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(montarCupom(pedido));
      doc.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => { iframe.remove(); resolve(); }, 1000);
      }, 100);
    }))
    .catch((err) => console.error('Falha ao imprimir o pedido', err));
  return filaImpressao;
}

function impressaoAutomaticaAtiva() {
  return lerPreferencia(CHAVE_IMPRESSAO_AUTOMATICA, false);
}

function marcarComoImpressos(ids) {
  const impressos = lerPreferencia(CHAVE_PEDIDOS_IMPRESSOS, []);
  const todos = [...new Set([...impressos, ...ids])];
  gravarPreferencia(CHAVE_PEDIDOS_IMPRESSOS, todos.slice(-LIMITE_PEDIDOS_IMPRESSOS));
}

// Ao ligar, os pedidos que já estão na lista não são impressos: só os que chegarem depois.
function definirImpressaoAutomatica(ativa, pedidosAtuais) {
  gravarPreferencia(CHAVE_IMPRESSAO_AUTOMATICA, ativa);
  if (ativa) marcarComoImpressos(pedidosAtuais.map((p) => p.id));
}

// Chamado a cada atualização da lista (que vem do mais novo para o mais antigo).
function imprimirPedidosNovos(pedidos) {
  if (!impressaoAutomaticaAtiva()) return;

  // Sem histórico (ex.: dados do navegador apagados) não reimprime o dia inteiro: só considera o que chegar depois.
  if (lerPreferencia(CHAVE_PEDIDOS_IMPRESSOS, []).length === 0) {
    marcarComoImpressos(pedidos.map((p) => p.id));
    return;
  }

  const impressos = new Set(lerPreferencia(CHAVE_PEDIDOS_IMPRESSOS, []));
  const novos = pedidos.filter((p) => !impressos.has(p.id) && p.status !== 'cancelado').reverse();
  if (novos.length === 0) return;

  marcarComoImpressos(novos.map((p) => p.id));
  novos.forEach(imprimirPedido);
}
