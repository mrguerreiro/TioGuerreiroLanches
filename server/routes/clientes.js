const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');

// Lista de clientes cadastrados (dados salvos automaticamente a cada pedido) - somente admin.
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    res.json(await db.getClientes());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
