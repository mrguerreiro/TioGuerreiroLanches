// Escapa texto antes de inserir em HTML (evita que dados digitados por clientes virem código na página).
function escaparHtml(valor) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor ?? '').replace(/[&<>"']/g, (c) => mapa[c]);
}

const API = {
  async _req(metodo, url, body) {
    const opts = {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(dados.erro || 'Erro inesperado.');
    }
    return dados;
  },

  getMenu: () => API._req('GET', '/api/menu'),
  getConfiguracoes: () => API._req('GET', '/api/configuracoes'),
  salvarConfiguracoes: (dados) => API._req('PUT', '/api/configuracoes', dados),
  getAcrescimos: () => API._req('GET', '/api/acrescimos'),
  criarAcrescimo: (dados) => API._req('POST', '/api/acrescimos', dados),
  atualizarAcrescimo: (id, dados) => API._req('PUT', `/api/acrescimos/${encodeURIComponent(id)}`, dados),
  excluirAcrescimo: (id) => API._req('DELETE', `/api/acrescimos/${encodeURIComponent(id)}`),

  criarItem: (dados) => API._req('POST', '/api/menu', dados),
  atualizarItem: (id, dados) => API._req('PUT', `/api/menu/${encodeURIComponent(id)}`, dados),
  atualizarImagemItem: (id, imagemBase64) => API._req('PUT', `/api/menu/${encodeURIComponent(id)}/imagem`, { imagemBase64 }),
  excluirItem: (id) => API._req('DELETE', `/api/menu/${encodeURIComponent(id)}`),

  criarPedido: (dados) => API._req('POST', '/api/pedidos', dados),
  listarPedidos: () => API._req('GET', '/api/pedidos'),
  acompanharPedido: (id, token) => API._req('GET', `/api/pedidos/${encodeURIComponent(id)}/acompanhamento?token=${encodeURIComponent(token)}`),
  getChavePush: () => API._req('GET', '/api/notificacoes/chave-publica'),
  atualizarStatusPedido: (id, status) => API._req('PUT', `/api/pedidos/${encodeURIComponent(id)}/status`, { status }),

  listarClientes: () => API._req('GET', '/api/clientes'),

  login: (usuario, senha) => API._req('POST', '/api/auth/login', { usuario, senha }),
  logout: () => API._req('POST', '/api/auth/logout'),
  statusAuth: () => API._req('GET', '/api/auth/status')
};
