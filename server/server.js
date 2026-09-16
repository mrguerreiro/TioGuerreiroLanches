require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const db = require('./utils/db');
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const ordersRoutes = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const acrescimosRoutes = require('./routes/acrescimos');
const clientesRoutes = require('./routes/clientes');

const app = express();
const PORT = process.env.PORT || 3000;

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('AVISO: SESSION_SECRET não definido. Usando um segredo aleatório temporário (o login do painel cai a cada reinício).');
}
if (!process.env.ADMIN_PASSWORD) {
  console.warn('AVISO: ADMIN_PASSWORD não definido. O login do painel administrativo ficará bloqueado.');
} else if (process.env.ADMIN_PASSWORD === 'troque-esta-senha') {
  console.warn('AVISO: ADMIN_PASSWORD ainda está com o valor de exemplo. Troque antes de publicar o site.');
}

// Necessário atrás do proxy HTTPS do Render para o cookie "secure" funcionar.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/pedidos', ordersRoutes);
app.use('/api/configuracoes', settingsRoutes);
app.use('/api/acrescimos', acrescimosRoutes);
app.use('/api/clientes', clientesRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Erros das rotas da API sempre em JSON, no mesmo formato { erro } que o front-end espera.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  let erro = 'Erro interno do servidor.';
  if (status === 413) erro = 'Arquivo muito grande.';
  else if (status < 500) erro = 'Requisição inválida.';
  res.status(status).json({ erro });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      const modo = process.env.DATABASE_URL ? 'PostgreSQL' : 'arquivos JSON locais';
      console.log(`Tio Guerreiro Lanches rodando em http://localhost:${PORT} (armazenamento: ${modo})`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
