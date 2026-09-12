// Integração com o PagSeguro (PagBank) - Checkout API.
// Documentação: https://dev.pagbank.uol.com.br/reference/criar-checkout
// Configure PAGSEGURO_TOKEN no .env para habilitar cobranças reais.
const https = require('https');

function chamarApiPagSeguro(payload, token, sandbox) {
  const host = sandbox ? 'sandbox.api.pagseguro.com' : 'api.pagseguro.com';
  const data = JSON.stringify(payload);

  const options = {
    hostname: host,
    path: '/checkouts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
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
    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

async function criarCheckoutPagSeguro(pedido) {
  const token = process.env.PAGSEGURO_TOKEN;
  const sandbox = (process.env.PAGSEGURO_SANDBOX || 'true') === 'true';

  // Sem credenciais configuradas: retorna um link de simulação para uso em desenvolvimento.
  if (!token) {
    return {
      referencia: pedido.id,
      linkCheckout: `/pagamento-simulado.html?pedido=${encodeURIComponent(pedido.id)}&valor=${pedido.total.toFixed(2)}`
    };
  }

  const payload = {
    reference_id: pedido.id,
    customer: {
      name: pedido.cliente.nome,
      phones: [{ country: '55', area: pedido.cliente.telefone.replace(/\D/g, '').slice(0, 2), number: pedido.cliente.telefone.replace(/\D/g, '').slice(2), type: 'MOBILE' }]
    },
    items: pedido.itens.map((it) => ({
      name: it.nome,
      quantity: it.quantidade,
      unit_amount: Math.round(it.preco * 100)
    })),
    additional_amount: pedido.taxaEntrega ? Math.round(pedido.taxaEntrega * 100) : undefined,
    payment_methods: [{ type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }, { type: 'PIX' }],
    redirect_url: undefined
  };

  const resultado = await chamarApiPagSeguro(payload, token, sandbox);
  const linkPagamento = (resultado.links || []).find((l) => l.rel === 'PAY');

  return {
    referencia: resultado.id || pedido.id,
    linkCheckout: linkPagamento ? linkPagamento.href : null
  };
}

module.exports = { criarCheckoutPagSeguro };
