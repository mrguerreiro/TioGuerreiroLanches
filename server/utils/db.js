// Usa MongoDB (MONGODB_URI) ou PostgreSQL (DATABASE_URL) quando configurados; caso contrário,
// cai para arquivos JSON locais (apenas para desenvolvimento).
if (process.env.MONGODB_URI) {
  module.exports = require('./dbMongo');
} else if (process.env.DATABASE_URL) {
  module.exports = require('./dbPostgres');
} else {
  module.exports = require('./dbArquivo');
}
