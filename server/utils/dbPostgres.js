// Armazenamento persistente em PostgreSQL (usado quando DATABASE_URL está configurado).
// Mantém os dados mesmo após reinícios/redeploys (diferente do armazenamento em arquivo local).
const { Pool } = require('pg');
const menuInicial = require('../data/menu.json');
const settingsIniciais = require('../data/settings.json');
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

async function getMenu() {
  const { rows } = await pool.query('SELECT * FROM itens_cardapio ORDER BY ordem ASC');
  return rows.map(linhaParaItem);
}

// Substitui a tabela inteira para manter compatibilidade com o formato de array usado nas rotas.
async function saveMenu(menu) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM itens_cardapio');
    let ordem = 0;
    for (const item of menu) {
      await client.query(
        `INSERT INTO itens_cardapio (id, categoria, nome, descricao, preco, imagem, pausado, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [item.id, item.categoria, item.nome, item.descricao || '', item.preco, item.imagem, !!item.pausado, ordem++]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrders() {
  const { rows } = await pool.query('SELECT dados FROM pedidos ORDER BY criado_em ASC');
  return rows.map((r) => r.dados);
}

async function saveOrders(orders) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pedidos');
    for (const pedido of orders) {
      await client.query(
        'INSERT INTO pedidos (id, dados, criado_em) VALUES ($1,$2,$3)',
        [pedido.id, pedido, pedido.criadoEm]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

module.exports = { init, getMenu, saveMenu, getOrders, saveOrders, getSettings, saveSettings };
