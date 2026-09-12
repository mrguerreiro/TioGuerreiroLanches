const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');

router.get('/', (req, res) => {
  res.json(db.getSettings());
});

router.put('/', requireAdmin, (req, res) => {
  const atuais = db.getSettings();
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

  db.saveSettings(novas);
  res.json(novas);
});

module.exports = router;
