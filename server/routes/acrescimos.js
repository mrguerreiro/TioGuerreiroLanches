const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { gerarIdPorNome } = require('../utils/ids');

function validarPreco(preco) {
  const precoNum = Number(preco);
  return Number.isNaN(precoNum) || precoNum < 0 ? null : precoNum;
}

// Lista pública dos acréscimos
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.getAcrescimos());
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nome, preco } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Nome do acréscimo é obrigatório.' });
    }
    const precoNum = validarPreco(preco);
    if (preco === undefined || preco === null || preco === '' || precoNum === null) {
      return res.status(400).json({ erro: 'Preço inválido.' });
    }
    const novo = await db.addAcrescimo({ id: gerarIdPorNome(nome), nome: String(nome).trim(), preco: precoNum });
    res.status(201).json(novo);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nome, preco } = req.body || {};
    const campos = {};
    if (nome !== undefined) {
      if (!String(nome).trim()) return res.status(400).json({ erro: 'Nome do acréscimo é obrigatório.' });
      campos.nome = String(nome).trim();
    }
    if (preco !== undefined) {
      const precoNum = validarPreco(preco);
      if (preco === '' || precoNum === null) return res.status(400).json({ erro: 'Preço inválido.' });
      campos.preco = precoNum;
    }
    const atualizado = await db.updateAcrescimo(req.params.id, campos);
    if (!atualizado) return res.status(404).json({ erro: 'Acréscimo não encontrado.' });
    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const excluido = await db.deleteAcrescimo(req.params.id);
    if (!excluido) return res.status(404).json({ erro: 'Acréscimo não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
