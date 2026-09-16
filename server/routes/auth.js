const crypto = require('crypto');
const express = require('express');
const router = express.Router();

// Compara em tempo constante para não vazar informação pelo tempo de resposta.
function iguais(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

router.post('/login', (req, res) => {
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
