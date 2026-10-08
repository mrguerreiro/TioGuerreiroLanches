const { ipKeyGenerator } = require('express-rate-limit');

// Atrás da Cloudflare o IP real do visitante vem no CF-Connecting-IP (o req.ip seria o da Cloudflare).
// Com o endereço .onrender.com desligado, todo acesso passa pela Cloudflare e esse cabeçalho não pode ser forjado.
function ipDoVisitante(req) {
  return ipKeyGenerator(req.get('cf-connecting-ip') || req.ip);
}

module.exports = { ipDoVisitante };
