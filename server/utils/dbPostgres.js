// Armazenamento persistente em PostgreSQL (usado quando DATABASE_URL está configurado).
// Mantém os dados mesmo após reinícios/redeploys (diferente do armazenamento em arquivo local).
const { Pool } = require('pg');
const menuInicial = require('../data/menu.json');
const settingsIniciais = require('../data/settings.json');
const acrescimosIniciais = require('../data/acrescimos.json');
const { buildProductSvgDataUri } = require('./productImage');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS itens_cardapio (
      id TEXT PRIMARY KEY,
      categoria TEXT NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      preco NUMERIC NOT NULL,
      imagem TEXT NOT NULL,
      pausado BOOLEAN NOT NULL DEFAULT false,
      ordem INTEGER NOT NULL DEFAULT 0
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      dados JSONB NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      id INTEGER PRIMARY KEY DEFAULT 1,
      dados JSONB NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      telefone TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      endereco JSONB,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS acrescimos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      preco NUMERIC NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0
    );
  `);

  const { rows: menuRows } = await pool.query('SELECT COUNT(*)::int AS total FROM itens_cardapio');
  if (menuRows[0].total === 0) {
    let ordem = 0;
    for (const item of menuInicial) {
      const imagem = buildProductSvgDataUri(item.nome, item.categoria);
      await pool.query(
        `INSERT INTO itens_cardapio (id, categoria, nome, descricao, preco, imagem, pausado, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [item.id, item.categoria, item.nome, item.descricao, item.preco, imagem, item.pausado, ordem++]
      );
    }
  }

  const { rows: acrescimosRows } = await pool.query('SELECT COUNT(*)::int AS total FROM acrescimos');
  if (acrescimosRows[0].total === 0) {
    let ordem = 0;
    for (const a of acrescimosIniciais) {
      await pool.query('INSERT INTO acrescimos (id, nome, preco, ordem) VALUES ($1,$2,$3,$4)', [a.id, a.nome, a.preco, ordem++]);
    }
  }

  const { rows: configRows } = await pool.query('SELECT COUNT(*)::int AS total FROM configuracoes');
  if (configRows[0].total === 0) {
    await pool.query('INSERT INTO configuracoes (id, dados) VALUES (1, $1)', [settingsIniciais]);
  }
}

function linhaParaItem(row) {
  return {
    id: row.id,
    categoria: row.categoria,
    nome: row.nome,
    descricao: row.descricao,
    preco: Number(row.preco),
    imagem: row.imagem,
    pausado: row.pausado
  };
}

function linhaParaAcrescimo(row) {
  return { id: row.id, nome: row.nome, preco: Number(row.preco) };
}

// Insere no fim da lista (ordem = maior ordem + 1).
async function inserirComOrdem(tabela, colunas, valores) {
  const marcadores = valores.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `INSERT INTO ${tabela} (${colunas.join(', ')}, ordem)
     VALUES (${marcadores}, (SELECT COALESCE(MAX(ordem), -1) + 1 FROM ${tabela}))
     RETURNING *`,
    valores
  );
  return rows[0];
}

// Atualiza apenas as colunas permitidas que vieram em "campos".
async function atualizarColunas(tabela, colunasPermitidas, id, campos) {
  const sets = [];
  const valores = [id];
  for (const coluna of colunasPermitidas) {
    if (campos[coluna] !== undefined) {
      valores.push(campos[coluna]);
      sets.push(`${coluna} = $${valores.length}`);
    }
  }
  const sql = sets.length > 0
    ? `UPDATE ${tabela} SET ${sets.join(', ')} WHERE id = $1 RETURNING *`
    : `SELECT * FROM ${tabela} WHERE id = $1`;
  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
}

async function getMenu() {
  const { rows } = await pool.query('SELECT * FROM itens_cardapio ORDER BY ordem ASC');
  return rows.map(linhaParaItem);
}

async function addMenuItem(item) {
  const row = await inserirComOrdem(
    'itens_cardapio',
    ['id', 'categoria', 'nome', 'descricao', 'preco', 'imagem', 'pausado'],
    [item.id, item.categoria, item.nome, item.descricao || '', item.preco, item.imagem, !!item.pausado]
  );
  return linhaParaItem(row);
}

async function updateMenuItem(id, campos) {
  const row = await atualizarColunas('itens_cardapio', ['categoria', 'nome', 'descricao', 'preco', 'imagem', 'pausado'], id, campos);
  return row ? linhaParaItem(row) : null;
}

async function deleteMenuItem(id) {
  const { rowCount } = await pool.query('DELETE FROM itens_cardapio WHERE id = $1', [id]);
  return rowCount > 0;
}

async function getAcrescimos() {
  const { rows } = await pool.query('SELECT * FROM acrescimos ORDER BY ordem ASC');
  return rows.map(linhaParaAcrescimo);
}

async function addAcrescimo(acrescimo) {
  const row = await inserirComOrdem('acrescimos', ['id', 'nome', 'preco'], [acrescimo.id, acrescimo.nome, acrescimo.preco]);
  return linhaParaAcrescimo(row);
}

async function updateAcrescimo(id, campos) {
  const row = await atualizarColunas('acrescimos', ['nome', 'preco'], id, campos);
  return row ? linhaParaAcrescimo(row) : null;
}

async function deleteAcrescimo(id) {
  const { rowCount } = await pool.query('DELETE FROM acrescimos WHERE id = $1', [id]);
  return rowCount > 0;
}

async function getOrders() {
  const { rows } = await pool.query('SELECT dados FROM pedidos ORDER BY criado_em ASC');
  return rows.map((r) => r.dados);
}

async function addOrder(pedido) {
  await pool.query('INSERT INTO pedidos (id, dados, criado_em) VALUES ($1,$2,$3)', [pedido.id, pedido, pedido.criadoEm]);
  return pedido;
}

async function updateOrderStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE pedidos SET dados = jsonb_set(dados, '{status}', to_jsonb($2::text)) WHERE id = $1 RETURNING dados`,
    [id, status]
  );
  return rows[0] ? rows[0].dados : null;
}

async function getSettings() {
  const { rows } = await pool.query('SELECT dados FROM configuracoes WHERE id = 1');
  return rows[0] ? rows[0].dados : settingsIniciais;
}

async function saveSettings(settings) {
  await pool.query(
    'INSERT INTO configuracoes (id, dados) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET dados = $1',
    [settings]
  );
}

// Grava ou atualiza os dados do cliente (nome/endereço) sempre que ele faz um pedido, seja retirada ou entrega.
async function upsertCliente(cliente) {
  await pool.query(
    `INSERT INTO clientes (telefone, nome, endereco, atualizado_em)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (telefone) DO UPDATE
     SET nome = $2, endereco = COALESCE($3, clientes.endereco), atualizado_em = now()`,
    [cliente.telefone, cliente.nome, cliente.endereco || null]
  );
}

async function getClientes() {
  const { rows } = await pool.query('SELECT telefone, nome, endereco, criado_em, atualizado_em FROM clientes ORDER BY atualizado_em DESC');
  return rows.map((r) => ({
    telefone: r.telefone,
    nome: r.nome,
    endereco: r.endereco,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em
  }));
}

module.exports = {
  init,
  getMenu, addMenuItem, updateMenuItem, deleteMenuItem,
  getAcrescimos, addAcrescimo, updateAcrescimo, deleteAcrescimo,
  getOrders, addOrder, updateOrderStatus,
  getSettings, saveSettings,
  upsertCliente, getClientes
};
