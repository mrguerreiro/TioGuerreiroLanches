const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  getMenu: () => readJson(MENU_FILE),
  saveMenu: (menu) => writeJson(MENU_FILE, menu),
  getOrders: () => readJson(ORDERS_FILE),
  saveOrders: (orders) => writeJson(ORDERS_FILE, orders),
  getSettings: () => readJson(SETTINGS_FILE),
  saveSettings: (settings) => writeJson(SETTINGS_FILE, settings)
};
