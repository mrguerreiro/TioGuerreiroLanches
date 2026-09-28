// Recebe os avisos (webhooks) do PagBank sobre pagamentos e checkouts.
// Nunca confiamos no corpo recebido: o status é sempre reconsultado na API do PagBank com o token da loja,
// então uma chamada falsa a esta rota não consegue marcar pedido nenhum como pago.
const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const notificacoes = require('../utils/notificacoes');
const {
  assinaturaValida,
  consultarPedidoPagBank,
  consultarCheckoutPagBank,
  statusDasCobrancas,
  pagSeguroConfigurado,
  ID_PAGBANK
} = require('../utils/pagseguro');

// Corpo bruto: a assinatura é calculada sobre o texto exatamente como o PagBank enviou.
router.post('/notificacao', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!pagSeguroConfigurado()) return res.sendStatus(404);

  const corpoBruto = typeof req.body === 'string' ? req.body : '';
  if (assinaturaValida(corpoBruto, req.get('x-authenticity-token')) === false) {
    console.warn('Aviso do PagBank com assinatura inválida foi ignorado.');
    return res.sendStatus(401);
  }

  let aviso;
  try {
    aviso = JSON.parse(corpoBruto);
  } catch {
    return res.sendStatus(400);
  }
  const id = aviso && typeof aviso.id === 'string' ? aviso.id : '';
  if (!ID_PAGBANK.test(id)) return res.sendStatus(400);

  try {
    if (id.startsWith('ORDE_')) {
      await processarPagamento(id);
    } else {
      await processarCheckout(id);
    }
    res.sendStatus(200);
  } catch (err) {
    // Erro 5xx faz o PagBank tentar de novo mais tarde.
    console.error(`Falha ao processar aviso do PagBank (${id}):`, err.message);
    res.sendStatus(500);
  }
});

async function processarPagamento(idOrdem) {
  const ordem = await consultarPedidoPagBank(idOrdem);
  const pedido = ordem.reference_id ? await db.getOrder(ordem.reference_id) : null;
  if (!pedido || pedido.formaPagamento !== 'online') {
    console.warn(`Aviso do PagBank para um pedido desconhecido: ${ordem.reference_id} (${idOrdem}).`);
    return;
  }

  let { status, valorPagoCentavos, idCobranca } = statusDasCobrancas(ordem.charges);
  if (status === 'pago' && valorPagoCentavos < Math.round(pedido.total * 100)) {
    console.error(`Pedido ${pedido.id}: valor pago (${valorPagoCentavos}) menor que o total do pedido.`);
    status = 'valor_divergente';
  }

  const anterior = pedido.pagamento || {};
  if (anterior.status === status && anterior.idOrdemPagBank === idOrdem) return;

  const atualizado = await db.updateOrder(pedido.id, {
    pagamento: {
      ...anterior,
      status,
      idOrdemPagBank: idOrdem,
      idCobrancaPagBank: idCobranca || anterior.idCobrancaPagBank,
      atualizadoEm: new Date().toISOString(),
      ...(status === 'pago' && !anterior.pagoEm ? { pagoEm: new Date().toISOString() } : {})
    }
  });

  if (status === 'pago' && anterior.status !== 'pago') {
    notificacoes.notificarPagamento(atualizado).catch((err) => console.error(err));
  }
}

// Avisos do próprio checkout: só interessa saber quando o link expirou sem pagamento.
async function processarCheckout(idCheckout) {
  const checkout = await consultarCheckoutPagBank(idCheckout);
  if (checkout.status !== 'EXPIRED' || !checkout.reference_id) return;

  const pedido = await db.getOrder(checkout.reference_id);
  if (!pedido || !pedido.pagamento || pedido.pagamento.referencia !== idCheckout) return;
  if (!['pendente', 'recusado'].includes(pedido.pagamento.status)) return;

  await db.updateOrder(pedido.id, {
    pagamento: { ...pedido.pagamento, status: 'expirado', atualizadoEm: new Date().toISOString() }
  });
}

module.exports = router;
