const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body || {};
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (usuario === adminUser && senha === adminPassword) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/status', (req, res) => {
  res.json({ autenticado: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
