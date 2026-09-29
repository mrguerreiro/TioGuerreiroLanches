// Armazenamento persistente em MongoDB (usado quando MONGODB_URI está configurado, ex.: MongoDB Atlas gratuito).
// Mesmas funções de dbPostgres.js, para as rotas não precisarem saber qual banco está em uso.
const { MongoClient } = require('mongodb');
const menuInicial = require('../data/menu.json');
const settingsIniciais = require('../data/settings.json');
const acrescimosIniciais = require('../data/acrescimos.json');
const { buildProductSvgDataUri } = require('./productImage');

const client = new MongoClient(process.env.MONGODB_URI);
// Usa o banco indicado na URI (ex.: .../tioguerreiro); sem nome na URI, usa "tioguerreiro".
const banco = client.db(new URL(process.env.MONGODB_URI).pathname.slice(1) || 'tioguerreiro');

const itensCardapio = banco.collection('itens_cardapio');
const pedidos = banco.collection('pedidos');
const configuracoes = banco.collection('configuracoes');
const clientes = banco.collection('clientes');
const acrescimos = banco.collection('acrescimos');
const chavesSistema = banco.collection('chaves_sistema');

async function init() {
  await client.connect();
  await itensCardapio.createIndex({ ordem: 1 });
  await acrescimos.createIndex({ ordem: 1 });
  await pedidos.createIndex({ criadoEm: 1 });
  await clientes.createIndex({ atualizadoEm: -1 });

  if (await itensCardapio.countDocuments() === 0) {
    await itensCardapio.insertMany(menuInicial.map((item, ordem) => ({
      _id: item.id,
      categoria: item.categoria,
      nome: item.nome,
      descricao: item.descricao,
      preco: item.preco,
      imagem: buildProductSvgDataUri(item.nome, item.categoria),
      pausado: !!item.pausado,
      ordem
    })));
  }

  if (await acrescimos.countDocuments() === 0) {
    await acrescimos.insertMany(acrescimosIniciais.map((a, ordem) => ({
      _id: a.id, nome: a.nome, preco: a.preco, pausado: false, ordem
    })));
  }

  await configuracoes.updateOne({ _id: 1 }, { $setOnInsert: { dados: settingsIniciais } }, { upsert: true });
}

function docParaItem(doc) {
  return {
    id: doc._id,
    categoria: doc.categoria,
    nome: doc.nome,
    descricao: doc.descricao,
    preco: Number(doc.preco),
    imagem: doc.imagem,
    pausado: doc.pausado
  };
}

function docParaAcrescimo(doc) {
  return { id: doc._id, nome: doc.nome, preco: Number(doc.preco), pausado: doc.pausado };
}

// Insere no fim da lista (ordem = maior ordem + 1).
async function inserirComOrdem(colecao, doc) {
  const ultimo = await colecao.find().sort({ ordem: -1 }).limit(1).next();
  const novo = { ...doc, ordem: ultimo ? ultimo.ordem + 1 : 0 };
  await colecao.insertOne(novo);
  return novo;
}

// Atualiza apenas os campos permitidos que vieram em "campos".
async function atualizarCampos(colecao, camposPermitidos, id, campos) {
  const set = {};
  for (const campo of camposPermitidos) {
    if (campos[campo] !== undefined) set[campo] = campos[campo];
  }
  if (Object.keys(set).length === 0) return colecao.findOne({ _id: id });
  return colecao.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
}

async function getMenu() {
  const docs = await itensCardapio.find().sort({ ordem: 1 }).toArray();
  return docs.map(docParaItem);
}

async function addMenuItem(item) {
  const doc = await inserirComOrdem(itensCardapio, {
    _id: item.id,
    categoria: item.categoria,
    nome: item.nome,
    descricao: item.descricao || '',
    preco: item.preco,
    imagem: item.imagem,
    pausado: !!item.pausado
  });
  return docParaItem(doc);
}

async function updateMenuItem(id, campos) {
  const doc = await atualizarCampos(itensCardapio, ['categoria', 'nome', 'descricao', 'preco', 'imagem', 'pausado'], id, campos);
  return doc ? docParaItem(doc) : null;
}

async function deleteMenuItem(id) {
  const { deletedCount } = await itensCardapio.deleteOne({ _id: id });
  return deletedCount > 0;
}

async function getAcrescimos() {
  const docs = await acrescimos.find().sort({ ordem: 1 }).toArray();
  return docs.map(docParaAcrescimo);
}

async function addAcrescimo(acrescimo) {
  const doc = await inserirComOrdem(acrescimos, {
    _id: acrescimo.id, nome: acrescimo.nome, preco: acrescimo.preco, pausado: !!acrescimo.pausado
  });
  return docParaAcrescimo(doc);
}

async function updateAcrescimo(id, campos) {
  const doc = await atualizarCampos(acrescimos, ['nome', 'preco', 'pausado'], id, campos);
  return doc ? docParaAcrescimo(doc) : null;
}

async function deleteAcrescimo(id) {
  const { deletedCount } = await acrescimos.deleteOne({ _id: id });
  return deletedCount > 0;
}

async function getOrders() {
  const docs = await pedidos.find().sort({ criadoEm: 1 }).toArray();
  return docs.map((d) => d.dados);
}

async function addOrder(pedido) {
  await pedidos.insertOne({ _id: pedido.id, dados: pedido, criadoEm: new Date(pedido.criadoEm) });
  return pedido;
}

async function getOrder(id) {
  const doc = await pedidos.findOne({ _id: id });
  return doc ? doc.dados : null;
}

// Mescla os campos informados no JSON do pedido (apenas as chaves enviadas são alteradas).
async function updateOrder(id, campos) {
  const set = {};
  for (const [chave, valor] of Object.entries(campos)) set[`dados.${chave}`] = valor;
  const doc = Object.keys(set).length > 0
    ? await pedidos.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' })
    : await pedidos.findOne({ _id: id });
  return doc ? doc.dados : null;
}

async function getSettings() {
  const doc = await configuracoes.findOne({ _id: 1 });
  return doc ? doc.dados : settingsIniciais;
}

async function saveSettings(settings) {
  await configuracoes.updateOne({ _id: 1 }, { $set: { dados: settings } }, { upsert: true });
}

// Chaves internas do sistema (ex.: chaves das notificações), guardadas para sobreviver a reinícios.
async function getChave(id) {
  const doc = await chavesSistema.findOne({ _id: id });
  return doc ? doc.dados : null;
}

async function saveChave(id, dados) {
  await chavesSistema.updateOne({ _id: id }, { $set: { dados } }, { upsert: true });
}

// Grava ou atualiza os dados do cliente (nome/endereço) sempre que ele faz um pedido, seja retirada ou entrega.
async function upsertCliente(cliente) {
  const agora = new Date();
  const set = { nome: cliente.nome, atualizadoEm: agora };
  if (cliente.endereco) set.endereco = cliente.endereco;
  await clientes.updateOne(
    { _id: cliente.telefone },
    { $set: set, $setOnInsert: { criadoEm: agora } },
    { upsert: true }
  );
}

async function getClientes() {
  const docs = await clientes.find().sort({ atualizadoEm: -1 }).toArray();
  return docs.map((d) => ({
    telefone: d._id,
    nome: d.nome,
    endereco: d.endereco || null,
    criadoEm: d.criadoEm,
    atualizadoEm: d.atualizadoEm
  }));
}

module.exports = {
  init,
  getMenu, addMenuItem, updateMenuItem, deleteMenuItem,
  getAcrescimos, addAcrescimo, updateAcrescimo, deleteAcrescimo,
  getOrders, getOrder, addOrder, updateOrder,
  getSettings, saveSettings,
  getChave, saveChave,
  upsertCliente, getClientes
};
