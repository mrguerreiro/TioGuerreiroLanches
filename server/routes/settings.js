const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { calculoPorDistanciaAtivo, faixasDaLoja, coordenadasCozinhaTexto, lerCoordenadas, validarFaixas } = require('../utils/entrega');

// Completa com a tabela de faixas e a localização da cozinha padrão enquanto a loja não salvar as suas,
// e avisa o site se o cálculo por distância está ligado (chave do OpenRouteService configurada).
function comPadroes(settings) {
  return {
    ...settings,
    faixasEntrega: faixasDaLoja(settings),
    coordenadasCozinha: coordenadasCozinhaTexto(settings),
    calculoPorDistancia: calculoPorDistanciaAtivo()
  };
}

router.get('/', async (req, res, next) => {
  try {
    res.json(comPadroes(await db.getSettings()));
  } catch (err) {
    next(err);
  }
});

router.put('/', requireAdmin, async (req, res, next) => {
  try {
    const atuais = await db.getSettings();
    const {
      taxaEntrega, faixasEntrega, coordenadasCozinha,
      aceitaEntrega, aceitaRetirada, aceitaPagamentoEntrega, aceitaPagamentoOnline, nomeLoja, whatsapp, horarioFuncionamento
    } = req.body || {};

    const novas = { ...atuais };
    delete novas.calculoPorDistancia;
    if (taxaEntrega !== undefined) novas.taxaEntrega = Number(taxaEntrega) || 0;
    if (faixasEntrega !== undefined) {
      const { faixas, erro } = validarFaixas(faixasEntrega);
      if (erro) return res.status(400).json({ erro });
      novas.faixasEntrega = faixas;
    }
    if (coordenadasCozinha !== undefined) {
      const coordenadas = lerCoordenadas(coordenadasCozinha);
      if (!coordenadas) {
        return res.status(400).json({ erro: 'Localização da cozinha inválida. Use latitude e longitude separadas por vírgula, ex.: -22.2931, -49.0475' });
      }
      novas.coordenadasCozinha = `${coordenadas.latitude}, ${coordenadas.longitude}`;
    }
    if (aceitaEntrega !== undefined) novas.aceitaEntrega = !!aceitaEntrega;
    if (aceitaRetirada !== undefined) novas.aceitaRetirada = !!aceitaRetirada;
    if (aceitaPagamentoEntrega !== undefined) novas.aceitaPagamentoEntrega = !!aceitaPagamentoEntrega;
    if (aceitaPagamentoOnline !== undefined) novas.aceitaPagamentoOnline = !!aceitaPagamentoOnline;
    if (nomeLoja !== undefined) novas.nomeLoja = String(nomeLoja);
    if (whatsapp !== undefined) novas.whatsapp = String(whatsapp);
    if (horarioFuncionamento !== undefined) novas.horarioFuncionamento = String(horarioFuncionamento);

    await db.saveSettings(novas);
    res.json(comPadroes(novas));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
