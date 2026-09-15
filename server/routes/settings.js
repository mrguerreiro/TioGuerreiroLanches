const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.getSettings());
  } catch (err) {
    next(err);
  }
});

router.put('/', requireAdmin, async (req, res, next) => {
  try {
    const atuais = await db.getSettings();
    const { taxaEntrega, aceitaEntrega, aceitaRetirada, aceitaPagamentoEntrega, aceitaPagamentoOnline, nomeLoja, whatsapp, horarioFuncionamento } = req.body || {};

    const novas = { ...atuais };
    if (taxaEntrega !== undefined) novas.taxaEntrega = Number(taxaEntrega) || 0;
    if (aceitaEntrega !== undefined) novas.aceitaEntrega = !!aceitaEntrega;
    if (aceitaRetirada !== undefined) novas.aceitaRetirada = !!aceitaRetirada;
    if (aceitaPagamentoEntrega !== undefined) novas.aceitaPagamentoEntrega = !!aceitaPagamentoEntrega;
    if (aceitaPagamentoOnline !== undefined) novas.aceitaPagamentoOnline = !!aceitaPagamentoOnline;
    if (nomeLoja !== undefined) novas.nomeLoja = String(nomeLoja);
    if (whatsapp !== undefined) novas.whatsapp = String(whatsapp);
    if (horarioFuncionamento !== undefined) novas.horarioFuncionamento = String(horarioFuncionamento);

    await db.saveSettings(novas);
    res.json(novas);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
