const crypto = require('crypto');
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();

const MENSAGEM_LIMITE = { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.' };

// Atrás da Cloudflare o IP real do visitante vem no CF-Connecting-IP (o req.ip seria o da Cloudflare).
function ipDoVisitante(req) {
  return ipKeyGenerator(req.get('cf-connecting-ip') || req.ip);
}

// Até 10 senhas erradas a cada 15 minutos por IP. Logins certos não contam.
const limitePorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipDoVisitante,
  message: MENSAGEM_LIMITE
});

// Trava geral do painel: quem trocar de IP (ou forjar o CF-Connecting-IP acessando direto pelo endereço do Render)
// ainda esbarra neste limite de senhas erradas somando todos os visitantes.
const limiteGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: () => 'login-painel',
  message: MENSAGEM_LIMITE
});

// Compara em tempo constante para não vazar informação pelo tempo de resposta.
function iguais(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// Por IP primeiro: quem já foi barrado no seu IP não gasta as tentativas do limite geral.
router.post('/login', limitePorIp, limiteGeral, (req, res) => {
  const { usuario, senha } = req.body || {};
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Sem senha configurada o painel fica bloqueado (nada de senha padrão).
  if (!adminPassword) {
    return res.status(503).json({ erro: 'Login do painel desativado: defina ADMIN_PASSWORD nas variáveis de ambiente do servidor.' });
  }

  const usuarioOk = iguais(usuario || '', adminUser);
  const senhaOk = iguais(senha || '', adminPassword);
  if (!usuarioOk || !senhaOk) {
    return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
  }

  // Nova sessão a cada login, para evitar reaproveitamento de um id de sessão antigo.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ erro: 'Não foi possível iniciar a sessão.' });
    req.session.isAdmin = true;
    res.json({ ok: true });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/status', (req, res) => {
  res.json({ autenticado: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
