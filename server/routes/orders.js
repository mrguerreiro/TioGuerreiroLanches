const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { criarCheckoutPagSeguro } = require('../utils/pagseguro');

function validarCliente(tipoEntrega, cliente) {
  if (!cliente || !cliente.nome || !cliente.telefone) {
    return 'Nome e telefone são obrigatórios.';
  }
  if (tipoEntrega === 'entrega') {
    const e = cliente.endereco || {};
    if (!e.rua || !e.numero || !e.bairro || !e.cidade) {
      return 'Endereço completo (rua, número, bairro e cidade) é obrigatório para entrega.';
    }
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const { itens, tipoEntrega, cliente, formaPagamento } = req.body || {};

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'O pedido precisa ter ao menos um item.' });
    }
    if (!['retirada', 'entrega'].includes(tipoEntrega)) {
      return res.status(400).json({ erro: 'Tipo de entrega inválido.' });
    }
    if (!['entrega_local', 'online'].includes(formaPagamento)) {
      return res.status(400).json({ erro: 'Forma de pagamento inválida.' });
    }

    const erroCliente = validarCliente(tipoEntrega, cliente);
    if (erroCliente) {
      return res.status(400).json({ erro: erroCliente });
    }

    const menu = db.getMenu();
    const settings = db.getSettings();
    const itensPedido = [];

    for (const it of itens) {
      const produto = menu.find((m) => m.id === it.id);
      if (!produto) {
        return res.status(400).json({ erro: `Item não encontrado: ${it.id}` });
      }
      if (produto.pausado) {
        return res.status(400).json({ erro: `Item indisponível no momento: ${produto.nome}` });
      }
      const quantidade = Math.max(1, parseInt(it.quantidade, 10) || 1);
      itensPedido.push({
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        quantidade
      });
    }

    const subtotal = itensPedido.reduce((soma, it) => soma + it.preco * it.quantidade, 0);
    const taxaEntrega = tipoEntrega === 'entrega' ? Number(settings.taxaEntrega || 0) : 0;
    const total = subtotal + taxaEntrega;

    const orders = db.getOrders();
    const pedido = {
      id: `PED-${Date.now()}`,
      criadoEm: new Date().toISOString(),
      status: 'recebido',
      tipoEntrega,
      cliente: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        endereco: tipoEntrega === 'entrega' ? cliente.endereco : null
      },
      itens: itensPedido,
      subtotal,
      taxaEntrega,
      total,
      formaPagamento,
      pagamento: { status: formaPagamento === 'entrega_local' ? 'pendente_na_entrega' : 'pendente' }
    };

    if (formaPagamento === 'online') {
      const checkout = await criarCheckoutPagSeguro(pedido);
      pedido.pagamento.linkCheckout = checkout.linkCheckout;
      pedido.pagamento.referencia = checkout.referencia;
    }

    orders.push(pedido);
    db.saveOrders(orders);

    res.status(201).json(pedido);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao processar o pedido.' });
  }
});

router.get('/', requireAdmin, (req, res) => {
  const orders = db.getOrders().slice().reverse();
  res.json(orders);
});

router.put('/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const permitidos = ['recebido', 'preparando', 'saiu_para_entrega', 'pronto_retirada', 'concluido', 'cancelado'];
  if (!permitidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }
  const orders = db.getOrders();
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ erro: 'Pedido não encontrado.' });
  }
  orders[idx].status = status;
  db.saveOrders(orders);
  res.json(orders[idx]);
});

module.exports = router;
