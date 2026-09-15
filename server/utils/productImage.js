// Gera imagens SVG ilustrativas para os produtos do cardápio, usando as cores da marca.
// As imagens são apenas ilustrativas (não fotos reais dos produtos).

const ICONES = {
  hamburguer: `<g transform="translate(60,70)">
    <ellipse cx="90" cy="30" rx="90" ry="28" fill="#FDC70C"/>
    <path d="M0 30 Q90 -10 180 30 L180 45 L0 45 Z" fill="#F7941D"/>
    <rect x="0" y="55" width="180" height="18" rx="9" fill="#2E7D32"/>
    <rect x="0" y="75" width="180" height="24" fill="#8B4513"/>
    <rect x="0" y="101" width="180" height="16" rx="6" fill="#FFD54F"/>
    <rect x="0" y="119" width="180" height="26" rx="13" fill="#F4A300"/>
  </g>`,
  cachorroQuente: `<g transform="translate(50,90)">
    <path d="M0 40 Q100 -10 200 40 L200 70 Q100 110 0 70 Z" fill="#E8B87A"/>
    <rect x="20" y="30" width="160" height="30" rx="15" fill="#C1272D"/>
    <path d="M20 35 Q100 55 180 35" stroke="#FDC70C" stroke-width="4" fill="none"/>
  </g>`,
  frango: `<g transform="translate(90,80)">
    <path d="M50 0 C90 0 110 40 90 80 C80 110 20 110 10 80 C-10 40 10 0 50 0 Z" fill="#F7941D"/>
    <rect x="35" y="90" width="30" height="40" rx="10" fill="#FDC70C"/>
  </g>`,
  ovo: `<g transform="translate(90,90)">
    <ellipse cx="60" cy="60" rx="70" ry="55" fill="#FFFFFF"/>
    <circle cx="60" cy="60" r="26" fill="#FDC70C"/>
  </g>`,
  vegetariano: `<g transform="translate(70,80)">
    <circle cx="70" cy="60" r="55" fill="#2E7D32"/>
    <circle cx="45" cy="45" r="14" fill="#66BB6A"/>
    <circle cx="95" cy="50" r="10" fill="#66BB6A"/>
  </g>`,
  agua: `<g transform="translate(120,60)">
    <path d="M40 0 C70 45 80 65 80 90 A40 40 0 1 1 0 90 C0 65 10 45 40 0 Z" fill="#4FC3F7"/>
  </g>`,
  refrigerante: `<g transform="translate(120,60)">
    <rect x="0" y="0" width="70" height="150" rx="14" fill="#C1272D"/>
    <rect x="0" y="0" width="70" height="35" rx="14" fill="#8a1a1f"/>
    <rect x="10" y="45" width="50" height="18" fill="#FDC70C"/>
  </g>`,
  suco: `<g transform="translate(110,60)">
    <path d="M10 0 H80 L70 130 H20 Z" fill="#FDC70C" opacity="0.95"/>
    <circle cx="45" cy="40" r="20" fill="#F7941D"/>
  </g>`
};

function escolherIcone(nome) {
  const n = nome.toLowerCase();
  if (n.includes('dog')) return ICONES.cachorroQuente;
  if (n.includes('frango')) return ICONES.frango;
  if (n.includes('ovo') || n.includes('egg') || n.includes('omelete')) return ICONES.ovo;
  if (n.includes('vegetarian')) return ICONES.vegetariano;
  if (n.includes('água') || n.includes('agua')) return ICONES.agua;
  if (n.includes('refrigerante')) return ICONES.refrigerante;
  if (n.includes('suco')) return ICONES.suco;
  return ICONES.hamburguer;
}

function buildProductSvg(nome, categoria) {
  const icone = escolherIcone(nome || '');
  const corFundoInicio = categoria === 'bebida' ? '#7a0d12' : '#8a1a1f';
  const corFundoFim = '#B5121B';
  const nomeEscapado = String(nome || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${corFundoInicio}"/>
      <stop offset="1" stop-color="${corFundoFim}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#bg)"/>
  ${icone}
  <text x="200" y="245" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF">${nomeEscapado}</text>
  <text x="200" y="270" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="12" fill="#FFE0B2">Imagem meramente ilustrativa</text>
</svg>`;
}

function buildProductSvgDataUri(nome, categoria) {
  const svg = buildProductSvg(nome, categoria);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

module.exports = { buildProductSvg, buildProductSvgDataUri };
