// Armazenamento em arquivos JSON (usado apenas em desenvolvimento local, sem banco configurado).
// Não é persistente em plataformas com disco temporário (ex.: plano gratuito do Render).
// As funções leem e gravam de forma síncrona, sem "await" no meio, então cada operação é atômica no processo.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CLIENTES_FILE = path.join(DATA_DIR, 'clientes.json');
const ACRESCIMOS_FILE = path.join(DATA_DIR, 'acrescimos.json');

function readJson(file, valorPadrao) {
  if (!fs.existsSync(file)) return valorPadrao;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function adicionar(file, registro) {
  const lista = readJson(file, []);
  lista.push(registro);
  writeJson(file, lista);
  return registro;
}

function atualizar(file, id, campos) {
  const lista = readJson(file, []);
  const idx = lista.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  lista[idx] = { ...lista[idx], ...campos };
  writeJson(file, lista);
  return lista[idx];
}

function excluir(file, id) {
  const lista = readJson(file, []);
  const novaLista = lista.filter((r) => r.id !== id);
  if (novaLista.length === lista.length) return false;
  writeJson(file, novaLista);
  return true;
}

module.exports = {
  async init() {},

  async getMenu() { return readJson(MENU_FILE, []); },
  async addMenuItem(item) { return adicionar(MENU_FILE, item); },
  async updateMenuItem(id, campos) { return atualizar(MENU_FILE, id, campos); },
  async deleteMenuItem(id) { return excluir(MENU_FILE, id); },

  async getAcrescimos() { return readJson(ACRESCIMOS_FILE, []).map((a) => ({ ...a, pausado: !!a.pausado })); },
  async addAcrescimo(acrescimo) { return adicionar(ACRESCIMOS_FILE, acrescimo); },
  async updateAcrescimo(id, campos) { return atualizar(ACRESCIMOS_FILE, id, campos); },
  async deleteAcrescimo(id) { return excluir(ACRESCIMOS_FILE, id); },

  async getOrders() { return readJson(ORDERS_FILE, []); },
  async addOrder(pedido) { return adicionar(ORDERS_FILE, pedido); },
  async updateOrderStatus(id, status) { return atualizar(ORDERS_FILE, id, { status }); },

  async getSettings() { return readJson(SETTINGS_FILE, {}); },
  async saveSettings(settings) { writeJson(SETTINGS_FILE, settings); },

  // Grava ou atualiza os dados do cliente (nome/endereço) sempre que ele faz um pedido, seja retirada ou entrega.
  async upsertCliente(cliente) {
    const clientes = readJson(CLIENTES_FILE, []);
    const agora = new Date().toISOString();
    const idx = clientes.findIndex((c) => c.telefone === cliente.telefone);
    if (idx === -1) {
      clientes.push({ telefone: cliente.telefone, nome: cliente.nome, endereco: cliente.endereco || null, criadoEm: agora, atualizadoEm: agora });
    } else {
      clientes[idx].nome = cliente.nome;
      if (cliente.endereco) clientes[idx].endereco = cliente.endereco;
      clientes[idx].atualizadoEm = agora;
    }
    writeJson(CLIENTES_FILE, clientes);
  },
  async getClientes() {
    return readJson(CLIENTES_FILE, []).slice().sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));
  }
};
