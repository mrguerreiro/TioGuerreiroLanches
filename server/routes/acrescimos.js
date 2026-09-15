const express = require('express');
const router = express.Router();
const acrescimos = require('../data/acrescimos.json');

router.get('/', (req, res) => {
  res.json(acrescimos);
});

module.exports = router;
