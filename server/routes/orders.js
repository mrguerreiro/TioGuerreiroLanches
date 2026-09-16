const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { criarCheckoutPagSeguro } = require('../utils/pagseguro');
const { gerarIdPedido } = require('../utils/ids');

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

// Recusa opções que a loja desativou em Configurações.
function validarOpcoesDaLoja(settings, tipoEntrega, formaPagamento) {
  if (tipoEntrega === 'entrega' && settings.aceitaEntrega === false) {
    return 'No momento a loja não está fazendo entregas.';
  }
  if (tipoEntrega === 'retirada' && settings.aceitaRetirada === false) {
    return 'No momento a loja não está aceitando pedidos para retirada.';
  }
  if (formaPagamento === 'entrega_local' && settings.aceitaPagamentoEntrega === false) {
    return 'No momento a loja não aceita pagamento na entrega/retirada.';
  }
  if (formaPagamento === 'online' && settings.aceitaPagamentoOnline === false) {
    return 'No momento a loja não aceita pagamento online.';
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

    const [menu, settings, catalogoAcrescimos] = await Promise.all([db.getMenu(), db.getSettings(), db.getAcrescimos()]);

    const erroOpcoes = validarOpcoesDaLoja(settings, tipoEntrega, formaPagamento);
    if (erroOpcoes) {
      return res.status(400).json({ erro: erroOpcoes });
    }

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
            return res.status(400).json({ erro: 'Um dos acréscimos escolhidos não está mais disponível. Remova o item do carrinho e adicione de novo.' });
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

    const pedido = {
      id: gerarIdPedido(),
      criadoEm: new Date().toISOString(),
      status: 'recebido',
      tipoEntrega,
      cliente: {
        nome: String(cliente.nome).trim(),
        telefone: String(cliente.telefone).trim(),
        endereco: tipoEntrega === 'entrega' ? cliente.endereco : null
      },
      itens: itensPedido,
      subtotal,
      taxaEntrega,
      total,
      formaPagamento,
      pagamento: { status: formaPagamento === 'entrega_local' ? 'pendente_na_entrega' : 'pendente' }
    };

    // Sem link de pagamento o pedido não é gravado, para não ficar um pedido "online" que ninguém consegue pagar.
    if (formaPagamento === 'online') {
      let checkout;
      try {
        checkout = await criarCheckoutPagSeguro(pedido);
      } catch (err) {
        console.error('Falha ao criar checkout no PagSeguro:', err);
      }
      if (!checkout || !checkout.linkCheckout) {
        return res.status(502).json({ erro: 'Não foi possível gerar o link de pagamento online agora. Tente novamente ou escolha pagar na entrega/retirada.' });
      }
      pedido.pagamento.linkCheckout = checkout.linkCheckout;
      pedido.pagamento.referencia = checkout.referencia;
    }

    await db.addOrder(pedido);

    // Guarda/atualiza o cadastro do cliente (nome, telefone e endereço quando houver) no banco de dados.
    await db.upsertCliente({
      telefone: pedido.cliente.telefone.replace(/\D/g, ''),
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
    const pedido = await db.updateOrderStatus(req.params.id, status);
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }
    res.json(pedido);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
