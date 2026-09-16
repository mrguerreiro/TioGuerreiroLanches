const crypto = require('crypto');

// Gera um id legível a partir do nome (ex.: "x-bacon-lx3k9a2f").
function gerarIdPorNome(nome) {
  const slug = String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${Date.now().toString(36)}`;
}

// O sufixo aleatório evita colisão entre pedidos criados no mesmo milissegundo.
function gerarIdPedido() {
  return `PED-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

module.exports = { gerarIdPorNome, gerarIdPedido };
