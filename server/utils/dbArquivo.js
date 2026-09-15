// Armazenamento em arquivos JSON (usado apenas em desenvolvimento local, sem banco configurado).
// Não é persistente em plataformas com disco temporário (ex.: plano gratuito do Render).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CLIENTES_FILE = path.join(DATA_DIR, 'clientes.json');

function readJson(file, valorPadrao) {
  if (!fs.existsSync(file)) return valorPadrao;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  async init() {},
  async getMenu() { return readJson(MENU_FILE, []); },
  async saveMenu(menu) { writeJson(MENU_FILE, menu); },
  async getOrders() { return readJson(ORDERS_FILE, []); },
  async saveOrders(orders) { writeJson(ORDERS_FILE, orders); },
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
