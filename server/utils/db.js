// Usa PostgreSQL (persistente) quando DATABASE_URL está configurado; caso contrário,
// cai para arquivos JSON locais (apenas para desenvolvimento).
module.exports = process.env.DATABASE_URL
  ? require('./dbPostgres')
  : require('./dbArquivo');

