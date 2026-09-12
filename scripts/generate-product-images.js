// Script utilitário (uso único/manual) para gerar as imagens ilustrativas iniciais do cardápio.
const fs = require('fs');
const path = require('path');
const { buildProductSvg } = require('../server/utils/productImage');

const menu = require('../server/data/menu.json');
const outDir = path.join(__dirname, '..', 'public', 'img', 'produtos');
fs.mkdirSync(outDir, { recursive: true });

for (const item of menu) {
  const arquivo = path.basename(item.imagem);
  const svg = buildProductSvg(item.nome, item.categoria);
  fs.writeFileSync(path.join(outDir, arquivo), svg, 'utf-8');
  console.log('Gerado:', arquivo);
}

console.log('Concluído.');
