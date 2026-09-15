require('dotenv').config();
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo-dev-tio-guerreiro',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/pedidos', ordersRoutes);
app.use('/api/configuracoes', settingsRoutes);
app.use('/api/acrescimos', acrescimosRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
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
