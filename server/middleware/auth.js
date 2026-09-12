function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ erro: 'Não autenticado.' });
}

module.exports = { requireAdmin };
