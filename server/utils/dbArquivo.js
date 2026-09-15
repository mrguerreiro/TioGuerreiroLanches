// Armazenamento em arquivos JSON (usado apenas em desenvolvimento local, sem banco configurado).
// Não é persistente em plataformas com disco temporário (ex.: plano gratuito do Render).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  async init() {},
  async getMenu() { return readJson(MENU_FILE); },
  async saveMenu(menu) { writeJson(MENU_FILE, menu); },
  async getOrders() { return readJson(ORDERS_FILE); },
  async saveOrders(orders) { writeJson(ORDERS_FILE, orders); },
  async getSettings() { return readJson(SETTINGS_FILE); },
  async saveSettings(settings) { writeJson(SETTINGS_FILE, settings); }
};
