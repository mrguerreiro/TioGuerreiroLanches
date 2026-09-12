const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const { buildProductSvg } = require('../utils/productImage');

const PRODUTOS_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'produtos');
const MIME_PARA_EXTENSAO = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};
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
router.get('/', (req, res) => {
  res.json(db.getMenu());
});

// Criar item (admin)
router.post('/', requireAdmin, (req, res) => {
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

  const menu = db.getMenu();
  const id = gerarId(nome);
  let caminhoImagem = imagem;

  if (!caminhoImagem) {
    // Gera uma imagem ilustrativa automaticamente quando o admin não envia uma imagem própria.
    const svg = buildProductSvg(nome, categoria);
    fs.mkdirSync(PRODUTOS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PRODUTOS_DIR, `${id}.svg`), svg, 'utf-8');
    caminhoImagem = `/img/produtos/${id}.svg`;
  }

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
  db.saveMenu(menu);
  res.status(201).json(novoItem);
});

// Atualizar item (admin) - também usado para pausar/reativar
router.put('/:id', requireAdmin, (req, res) => {
  const menu = db.getMenu();
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
  db.saveMenu(menu);
  res.json(item);
});

// Trocar a imagem de um item já existente (admin)
router.put('/:id/imagem', requireAdmin, (req, res) => {
  const { imagemBase64 } = req.body || {};
  if (!imagemBase64 || typeof imagemBase64 !== 'string') {
    return res.status(400).json({ erro: 'Imagem não enviada.' });
  }

  const match = imagemBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ erro: 'Formato de imagem inválido.' });
  }

  const [, mime, base64] = match;
  const extensao = MIME_PARA_EXTENSAO[mime];
  if (!extensao) {
    return res.status(400).json({ erro: 'Tipo de imagem não suportado. Use PNG, JPG, WEBP ou SVG.' });
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > TAMANHO_MAXIMO_IMAGEM) {
    return res.status(400).json({ erro: 'Imagem muito grande. O tamanho máximo é 5MB.' });
  }

  const menu = db.getMenu();
  const idx = menu.findIndex((item) => item.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ erro: 'Item não encontrado.' });
  }

  fs.mkdirSync(PRODUTOS_DIR, { recursive: true });
  const nomeArquivo = `${req.params.id}-${Date.now()}.${extensao}`;
  fs.writeFileSync(path.join(PRODUTOS_DIR, nomeArquivo), buffer);

  menu[idx].imagem = `/img/produtos/${nomeArquivo}`;
  db.saveMenu(menu);
  res.json(menu[idx]);
});

// Excluir item (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const menu = db.getMenu();
  const existe = menu.some((item) => item.id === req.params.id);
  if (!existe) {
    return res.status(404).json({ erro: 'Item não encontrado.' });
  }
  const novoMenu = menu.filter((item) => item.id !== req.params.id);
  db.saveMenu(novoMenu);
  res.json({ ok: true });
});

module.exports = router;
