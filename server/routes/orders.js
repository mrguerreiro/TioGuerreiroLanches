const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { criarCheckoutPagSeguro } = require('../utils/pagseguro');
const catalogoAcrescimos = require('../data/acrescimos.json');

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

    const menu = await db.getMenu();
    const settings = await db.getSettings();
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

      // Os acréscimos e seus preços vêm sempre do catálogo do servidor, nunca do que o cliente enviar.
      const acrescimosPedido = [];
      if (produto.categoria === 'lanche' && Array.isArray(it.acrescimos)) {
        for (const idAcrescimo of it.acrescimos) {
          const acrescimo = catalogoAcrescimos.find((a) => a.id === idAcrescimo);
          if (!acrescimo) {
            return res.status(400).json({ erro: `Acréscimo inválido: ${idAcrescimo}` });
          }
          acrescimosPedido.push({ id: acrescimo.id, nome: acrescimo.nome, preco: acrescimo.preco });
        }
      }

      const precoUnitario = produto.preco + acrescimosPedido.reduce((soma, a) => soma + a.preco, 0);
      itensPedido.push({
        id: produto.id,
        nome: produto.nome,
        preco: precoUnitario,
        acrescimos: acrescimosPedido,
        quantidade
      });
    }

    const subtotal = itensPedido.reduce((soma, it) => soma + it.preco * it.quantidade, 0);
    const taxaEntrega = tipoEntrega === 'entrega' ? Number(settings.taxaEntrega || 0) : 0;
    const total = subtotal + taxaEntrega;

    const orders = await db.getOrders();
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
    await db.saveOrders(orders);

    // Guarda/atualiza o cadastro do cliente (nome, telefone e endereço quando houver) no banco de dados.
    await db.upsertCliente({
      telefone: cliente.telefone.replace(/\D/g, ''),
      nome: pedido.cliente.nome,
      endereco: pedido.cliente.endereco
    });

    res.status(201).json(pedido);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao processar o pedido.' });
  }
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const orders = await db.getOrders();
    res.json(orders.slice().reverse());
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const permitidos = ['recebido', 'preparando', 'saiu_para_entrega', 'pronto_retirada', 'concluido', 'cancelado'];
    if (!permitidos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }
    const orders = await db.getOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }
    orders[idx].status = status;
    await db.saveOrders(orders);
    res.json(orders[idx]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
