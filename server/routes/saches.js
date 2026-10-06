const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { gerarIdPorNome } = require('../utils/ids');

// Sachês gratuitos que o cliente escolhe na segunda etapa do lanche (ex.: catchup, mostarda).

// Lista pública dos sachês
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.getSaches());
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nome } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Nome do sachê é obrigatório.' });
    }
    const novo = await db.addSache({ id: gerarIdPorNome(nome), nome: String(nome).trim(), pausado: false });
    res.status(201).json(novo);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nome, pausado } = req.body || {};
    const campos = {};
    if (pausado !== undefined) campos.pausado = !!pausado;
    if (nome !== undefined) {
      if (!String(nome).trim()) return res.status(400).json({ erro: 'Nome do sachê é obrigatório.' });
      campos.nome = String(nome).trim();
    }
    const atualizado = await db.updateSache(req.params.id, campos);
    if (!atualizado) return res.status(404).json({ erro: 'Sachê não encontrado.' });
    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const excluido = await db.deleteSache(req.params.id);
    if (!excluido) return res.status(404).json({ erro: 'Sachê não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
