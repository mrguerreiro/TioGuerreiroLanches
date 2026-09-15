const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { buildProductSvgDataUri } = require('../utils/productImage');

const MIME_SUPORTADOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024; // 5MB

function gerarId(nome) {
  const slug = nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${Date.now().toString(36)}`;
}

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

    const menu = await db.getMenu();
    const id = gerarId(nome);
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
    menu.push(novoItem);
    await db.saveMenu(menu);
    res.status(201).json(novoItem);
  } catch (err) {
    next(err);
  }
});

// Atualizar item (admin) - também usado para pausar/reativar
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const menu = await db.getMenu();
    const idx = menu.findIndex((item) => item.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }

    const { nome, descricao, preco, imagem, categoria, pausado } = req.body || {};
    const item = menu[idx];

    if (nome !== undefined) item.nome = String(nome).trim();
    if (descricao !== undefined) item.descricao = String(descricao).trim();
    if (categoria !== undefined && ['lanche', 'bebida'].includes(categoria)) item.categoria = categoria;
    if (imagem !== undefined) item.imagem = imagem;
    if (pausado !== undefined) item.pausado = !!pausado;
    if (preco !== undefined) {
      const precoNum = Number(preco);
      if (Number.isNaN(precoNum) || precoNum < 0) {
        return res.status(400).json({ erro: 'Preço inválido.' });
      }
      item.preco = precoNum;
    }

    menu[idx] = item;
    await db.saveMenu(menu);
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

    const menu = await db.getMenu();
    const idx = menu.findIndex((item) => item.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }

    menu[idx].imagem = imagemBase64;
    await db.saveMenu(menu);
    res.json(menu[idx]);
  } catch (err) {
    next(err);
  }
});

// Excluir item (admin)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const menu = await db.getMenu();
    const existe = menu.some((item) => item.id === req.params.id);
    if (!existe) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }
    const novoMenu = menu.filter((item) => item.id !== req.params.id);
    await db.saveMenu(novoMenu);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

