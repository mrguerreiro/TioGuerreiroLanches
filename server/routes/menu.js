const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { buildProductSvgDataUri } = require('../utils/productImage');
const { gerarIdPorNome } = require('../utils/ids');

const MIME_SUPORTADOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024; // 5MB

// Lista pública do cardápio
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.getMenu());
  } catch (err) {
    next(err);
  }
});

// Criar item (admin)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { categoria, nome, descricao, preco, imagem } = req.body || {};

    if (!nome || !categoria || preco === undefined || preco === null) {
      return res.status(400).json({ erro: 'Nome, categoria e preço são obrigatórios.' });
    }
    if (!['lanche', 'bebida'].includes(categoria)) {
      return res.status(400).json({ erro: 'Categoria inválida.' });
    }
    const precoNum = Number(preco);
    if (Number.isNaN(precoNum) || precoNum < 0) {
      return res.status(400).json({ erro: 'Preço inválido.' });
    }

    const id = gerarIdPorNome(nome);
    // Gera uma imagem ilustrativa automaticamente quando o admin não envia uma imagem própria.
    const caminhoImagem = imagem || buildProductSvgDataUri(nome, categoria);

    const novoItem = {
      id,
      categoria,
      nome: String(nome).trim(),
      descricao: String(descricao || '').trim(),
      preco: precoNum,
      imagem: caminhoImagem,
      pausado: false
    };
    res.status(201).json(await db.addMenuItem(novoItem));
  } catch (err) {
    next(err);
  }
});

// Atualizar item (admin) - também usado para pausar/reativar
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nome, descricao, preco, imagem, categoria, pausado } = req.body || {};
    const campos = {};

    if (nome !== undefined) campos.nome = String(nome).trim();
    if (descricao !== undefined) campos.descricao = String(descricao).trim();
    if (categoria !== undefined && ['lanche', 'bebida'].includes(categoria)) campos.categoria = categoria;
    if (imagem !== undefined) campos.imagem = imagem;
    if (pausado !== undefined) campos.pausado = !!pausado;
    if (preco !== undefined) {
      const precoNum = Number(preco);
      if (Number.isNaN(precoNum) || precoNum < 0) {
        return res.status(400).json({ erro: 'Preço inválido.' });
      }
      campos.preco = precoNum;
    }

    const item = await db.updateMenuItem(req.params.id, campos);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Trocar a imagem de um item já existente (admin) - a imagem fica salva junto com os dados do item.
router.put('/:id/imagem', requireAdmin, async (req, res, next) => {
  try {
    const { imagemBase64 } = req.body || {};
    if (!imagemBase64 || typeof imagemBase64 !== 'string') {
      return res.status(400).json({ erro: 'Imagem não enviada.' });
    }

    const match = imagemBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ erro: 'Formato de imagem inválido.' });
    }

    const [, mime, base64] = match;
    if (!MIME_SUPORTADOS.includes(mime)) {
      return res.status(400).json({ erro: 'Tipo de imagem não suportado. Use PNG, JPG, WEBP ou SVG.' });
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > TAMANHO_MAXIMO_IMAGEM) {
      return res.status(400).json({ erro: 'Imagem muito grande. O tamanho máximo é 5MB.' });
    }

    const item = await db.updateMenuItem(req.params.id, { imagem: imagemBase64 });
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Excluir item (admin)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const excluido = await db.deleteMenuItem(req.params.id);
    if (!excluido) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

