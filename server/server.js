require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');

const db = require('./utils/db');
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const ordersRoutes = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const acrescimosRoutes = require('./routes/acrescimos');
const sachesRoutes = require('./routes/saches');
const entregaRoutes = require('./routes/entrega');
const clientesRoutes = require('./routes/clientes');
const pagamentosRoutes = require('./routes/pagamentos');
const notificacoes = require('./utils/notificacoes');

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
app.disable('x-powered-by');

// Cabeçalhos de segurança em todas as respostas (páginas, arquivos estáticos e API).
// O "upgrade-insecure-requests" só vale no site publicado, para não quebrar o http://localhost.
const emProducao = !!(process.env.RENDER || process.env.SITE_URL);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // O cupom de impressão do painel usa um bloco <style> dentro do iframe.
      styleSrc: ["'self'", "'unsafe-inline'"],
      // Fotos do cardápio podem vir como data: (enviadas pelo painel) ou de um endereço https.
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: emProducao ? [] : null
    }
  },
  // Sem includeSubDomains: o mail. fica na HostGator e não deve ser afetado pelo HSTS deste site.
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false }
}));

// Chamada pelo robô externo (cron-job.org) no horário da loja, para o Render não colocar o site para dormir.
// Fica antes do redirecionamento e da sessão: responde rápido, sem criar sessão nem redirecionar.
app.get('/health', (req, res) => res.json({ ok: true }));

// Com domínio próprio (SITE_URL), quem abrir pelo endereço do Render ou pelo "www" é levado ao endereço oficial,
// para o carrinho, o login e os avisos no celular ficarem sempre no mesmo site. A API não é redirecionada.
const hostOficial = process.env.SITE_URL ? new URL(process.env.SITE_URL).host : null;
app.use((req, res, next) => {
  if (!hostOficial || req.get('host') === hostOficial || req.path.startsWith('/api/')) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.redirect(301, `https://${hostOficial}${req.originalUrl}`);
});

// Avisos do PagBank antes do express.json: a rota precisa do corpo bruto para conferir a assinatura.
app.use('/api/pagamentos', pagamentosRoutes);
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
app.use('/api/saches', sachesRoutes);
app.use('/api/entrega', entregaRoutes);
app.use('/api/clientes', clientesRoutes);

app.get('/api/notificacoes/chave-publica', (req, res) => {
  res.json({ chave: notificacoes.getChavePublica() });
});

// O painel administrativo só abre pelo endereço /tocadachefe (sem link no site); o arquivo direto fica oculto.
app.get('/admin.html', (req, res) => res.sendStatus(404));
app.get('/tocadachefe', (req, res) => {
  // Com barra no final os caminhos relativos do painel (css/, js/) quebrariam.
  if (req.path.endsWith('/')) return res.redirect(301, '/tocadachefe');
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

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
  .then(() => notificacoes.iniciar())
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
