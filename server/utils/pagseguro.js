// Integração com o PagSeguro (PagBank) - Checkout API.
// Documentação: https://developer.pagbank.com.br/reference/criar-checkout
// Configure PAGSEGURO_TOKEN no .env para habilitar cobranças reais.
const crypto = require('crypto');
const https = require('https');

// Tempo que o link de pagamento fica válido. Depois disso o pedido continua valendo,
// mas o pagamento passa a ser cobrado na entrega/retirada.
const MINUTOS_VALIDADE_CHECKOUT = 60;

function getToken() {
  return process.env.PAGSEGURO_TOKEN;
}

function chamarApiPagSeguro(metodo, caminho, payload) {
  const sandbox = (process.env.PAGSEGURO_SANDBOX || 'true') === 'true';
  const data = payload === undefined ? null : JSON.stringify(payload);

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(data);
  }

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: sandbox ? 'sandbox.api.pagseguro.com' : 'api.pagseguro.com',
      path: caminho,
      method: metodo,
      headers,
      timeout: 15000
    }, (response) => {
      let corpo = '';
      response.on('data', (chunk) => { corpo += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(corpo || '{}');
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error_messages ? JSON.stringify(json.error_messages) : `Erro PagSeguro (HTTP ${response.statusCode})`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Tempo esgotado ao falar com o PagSeguro.')));
    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

// Data no formato ISO-8601 com o fuso de Brasília, como nos exemplos da API.
function dataIsoBrasilia(data) {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

function nomeItemCheckout(it) {
  const acrescimos = Array.isArray(it.acrescimos) && it.acrescimos.length > 0
    ? ` (+ ${it.acrescimos.map((a) => a.nome).join(', ')})`
    : '';
  return `${it.nome}${acrescimos}`.slice(0, 64);
}

// urlBase: endereço público do site (https). Sem ele não dá para receber avisos nem devolver o cliente ao site.
async function criarCheckoutPagSeguro(pedido, urlBase) {
  const expiraEm = new Date(Date.now() + MINUTOS_VALIDADE_CHECKOUT * 60 * 1000);

  // Sem credenciais configuradas: retorna um link de simulação para uso em desenvolvimento.
  if (!getToken()) {
    return {
      referencia: pedido.id,
      expiraEm: expiraEm.toISOString(),
      linkCheckout: `/pagamento-simulado.html?pedido=${encodeURIComponent(pedido.id)}&valor=${pedido.total.toFixed(2)}`
    };
  }

  // Os dados do comprador (nome, e-mail, CPF, telefone) são preenchidos pelo próprio cliente no checkout:
  // a API exige todos eles quando "customer" é enviado, e a loja não coleta e-mail nem CPF.
  const payload = {
    reference_id: pedido.id,
    expiration_date: dataIsoBrasilia(expiraEm),
    customer_modifiable: true,
    items: pedido.itens.map((it) => ({
      reference_id: it.id,
      name: nomeItemCheckout(it),
      quantity: it.quantidade,
      unit_amount: Math.round(it.preco * 100)
    })),
    additional_amount: pedido.taxaEntrega ? Math.round(pedido.taxaEntrega * 100) : undefined,
    payment_methods: [{ type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }, { type: 'PIX' }]
  };

  // O PagBank só aceita endereços públicos; rodando localmente (http) o checkout é criado sem avisos/retorno.
  if (urlBase && urlBase.startsWith('https://')) {
    const urlAcompanhar = `${urlBase}/acompanhar.html?pedido=${encodeURIComponent(pedido.id)}&token=${encodeURIComponent(pedido.tokenAcompanhamento)}`;
    const urlNotificacao = `${urlBase}/api/pagamentos/notificacao`;
    payload.redirect_url = urlAcompanhar;
    payload.return_url = urlAcompanhar;
    payload.notification_urls = [urlNotificacao];
    payload.payment_notification_urls = [urlNotificacao];
  }

  const resultado = await chamarApiPagSeguro('POST', '/checkouts', payload);
  const linkPagamento = (resultado.links || []).find((l) => l.rel === 'PAY');

  return {
    referencia: resultado.id || pedido.id,
    expiraEm: expiraEm.toISOString(),
    linkCheckout: linkPagamento ? linkPagamento.href : null
  };
}

// Confere o cabeçalho x-authenticity-token: sha256("<token>-<corpo exatamente como recebido>").
// No sandbox o PagBank às vezes não envia o cabeçalho; por isso a confirmação principal é reconsultar a API.
function assinaturaValida(corpoBruto, assinatura) {
  if (!assinatura) return null;
  const esperado = crypto.createHash('sha256').update(`${getToken()}-${corpoBruto}`).digest('hex');
  const a = Buffer.from(String(assinatura).toLowerCase());
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ID_PAGBANK = /^(ORDE|CHEC)_[A-Za-z0-9-]{1,80}$/;

function consultarPedidoPagBank(id) {
  if (!ID_PAGBANK.test(id) || !id.startsWith('ORDE_')) throw new Error('Id de pedido PagBank inválido.');
  return chamarApiPagSeguro('GET', `/orders/${id}`);
}

function consultarCheckoutPagBank(id) {
  if (!ID_PAGBANK.test(id) || !id.startsWith('CHEC_')) throw new Error('Id de checkout PagBank inválido.');
  return chamarApiPagSeguro('GET', `/checkouts/${id}`);
}

// Resume as cobranças de um pedido PagBank em um status nosso. Um pedido pode ter várias
// tentativas (ex.: cartão recusado e depois Pix pago); vale a paga, senão a mais recente.
function statusDasCobrancas(cobrancas) {
  const lista = Array.isArray(cobrancas) ? cobrancas : [];
  const paga = lista.find((c) => c.status === 'PAID');
  const cobranca = paga || lista[lista.length - 1];
  if (!cobranca) return { status: 'pendente', valorPagoCentavos: 0 };

  const MAPA = {
    PAID: 'pago',
    AUTHORIZED: 'em_analise',
    IN_ANALYSIS: 'em_analise',
    WAITING: 'pendente',
    DECLINED: 'recusado',
    CANCELED: 'cancelado'
  };
  const valorPagoCentavos = paga
    ? Number((paga.amount && paga.amount.summary && paga.amount.summary.paid) || (paga.amount && paga.amount.value) || 0)
    : 0;
  return { status: MAPA[cobranca.status] || 'pendente', valorPagoCentavos, idCobranca: cobranca.id };
}

module.exports = {
  criarCheckoutPagSeguro,
  assinaturaValida,
  consultarPedidoPagBank,
  consultarCheckoutPagBank,
  statusDasCobrancas,
  pagSeguroConfigurado: () => !!getToken(),
  ID_PAGBANK
};
