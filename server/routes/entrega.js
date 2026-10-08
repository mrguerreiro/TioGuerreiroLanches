const express = require('express');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const db = require('../utils/db');
const { ipDoVisitante } = require('../utils/ip');
const { ErroEntrega, calculoPorDistanciaAtivo, cotarEntrega } = require('../utils/entrega');

// Cada consulta gasta a cota diária grátis do OpenRouteService: limita por IP para ninguém esgotá-la.
const limiteCotacoes = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipDoVisitante,
  message: { erro: 'Muitas consultas de taxa de entrega. Aguarde alguns minutos e tente de novo.' }
});

// Prévia da taxa no checkout. O valor cobrado de verdade é recalculado ao criar o pedido.
router.post('/taxa', limiteCotacoes, async (req, res, next) => {
  try {
    const { endereco } = req.body || {};
    const e = endereco || {};
    if (!e.rua || !e.numero || !e.bairro || !e.cidade) {
      return res.status(400).json({ erro: 'Preencha rua, número, bairro e cidade para calcular a entrega.' });
    }

    const settings = await db.getSettings();
    if (!calculoPorDistanciaAtivo()) {
      return res.json({ distanciaKm: null, taxa: Number(settings.taxaEntrega || 0) });
    }
    res.json(await cotarEntrega(settings, e));
  } catch (err) {
    if (err instanceof ErroEntrega) return res.status(422).json({ erro: err.message });
    console.error('Falha ao calcular a taxa de entrega:', err);
    res.status(502).json({ erro: 'Não foi possível calcular a taxa de entrega agora. Tente novamente em instantes ou escolha retirar na loja.' });
  }
});

module.exports = router;
