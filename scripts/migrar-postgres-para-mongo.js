// Copia todos os dados do PostgreSQL (DATABASE_URL) para o MongoDB (MONGODB_URI).
// Pode ser rodado mais de uma vez: registros já copiados são sobrescritos, nada é duplicado.
//
// Uso:
//   DATABASE_URL="<External Database URL do Render>" MONGODB_URI="mongodb+srv://.../tioguerreiro" \
//     node scripts/migrar-postgres-para-mongo.js
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

if (!process.env.DATABASE_URL || !process.env.MONGODB_URI) {
  console.error('Defina DATABASE_URL (origem) e MONGODB_URI (destino).');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = new MongoClient(process.env.MONGODB_URI);

async function copiar(tabela, colecao, paraDoc) {
  const { rows } = await pool.query(`SELECT * FROM ${tabela}`);
  const docs = rows.map(paraDoc);
  if (docs.length > 0) {
    await colecao.bulkWrite(docs.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
    })));
  }
  console.log(`${tabela}: ${docs.length} registro(s) copiado(s)`);
}

async function main() {
  await client.connect();
  const banco = client.db(new URL(process.env.MONGODB_URI).pathname.slice(1) || 'tioguerreiro');

  await copiar('itens_cardapio', banco.collection('itens_cardapio'), (r) => ({
    _id: r.id, categoria: r.categoria, nome: r.nome, descricao: r.descricao,
    preco: Number(r.preco), imagem: r.imagem, pausado: r.pausado, ordem: r.ordem
  }));
  await copiar('acrescimos', banco.collection('acrescimos'), (r) => ({
    _id: r.id, nome: r.nome, preco: Number(r.preco), pausado: r.pausado, ordem: r.ordem
  }));
  await copiar('pedidos', banco.collection('pedidos'), (r) => ({
    _id: r.id, dados: r.dados, criadoEm: r.criado_em
  }));
  await copiar('configuracoes', banco.collection('configuracoes'), (r) => ({
    _id: r.id, dados: r.dados
  }));
  await copiar('clientes', banco.collection('clientes'), (r) => ({
    _id: r.telefone, nome: r.nome, endereco: r.endereco, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em
  }));
  await copiar('chaves_sistema', banco.collection('chaves_sistema'), (r) => ({
    _id: r.id, dados: r.dados
  }));
}

main()
  .then(() => console.log('Migração concluída.'))
  .catch((err) => { console.error('Falha na migração:', err); process.exitCode = 1; })
  .finally(() => Promise.all([pool.end(), client.close()]));
