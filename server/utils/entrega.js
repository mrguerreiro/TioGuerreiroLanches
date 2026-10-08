// Taxa de entrega por distância: localiza o endereço do cliente no OpenRouteService (mapas do OpenStreetMap),
// calcula a distância de carro a partir da cozinha e aplica a tabela de faixas cadastrada no painel.
// Sem ORS_API_KEY, o site continua cobrando a taxa fixa das Configurações.

// Ponto da cozinha (latitude, longitude). O padrão é o trecho da Av. Dr. Marcos de Paula Raphael com CEP
// 17026-000 no OpenStreetMap; a posição exata é ajustada no painel. A cozinha não é localizada pelo endereço
// porque a numeração de Bauru (quadra-lote, ex.: 21-15) quase nunca existe no OpenStreetMap.
const COORDENADAS_COZINHA_PADRAO = '-22.2931, -49.0475';

// "ate" é o limite da faixa em km: vale de onde a faixa anterior termina até esse valor. Acima da última, não entrega.
const FAIXAS_PADRAO = [
  { ate: 2, taxa: 0 },
  { ate: 2.5, taxa: 5.49 },
  { ate: 3, taxa: 5.99 },
  { ate: 3.5, taxa: 6.49 },
  { ate: 4, taxa: 6.99 },
  { ate: 5, taxa: 8.49 },
  { ate: 6, taxa: 9.99 },
  { ate: 7, taxa: 11.99 },
  { ate: 10, taxa: 16.99 },
  { ate: 20, taxa: 22 }
];

// api.openrouteservice.org foi descontinuado em 2026; os serviços agora ficam em api.heigit.org (sem barra no fim).
const URL_HEIGIT = 'https://api.heigit.org';
const CAMINHO_BUSCA = '/pelias/v1/search';
const CAMINHO_ROTA = '/openrouteservice/v2/directions/driving-car';
// Só aceita resultados no nível de endereço, rua ou local; bairro/cidade daria a distância até o centro deles.
const CAMADAS_ACEITAS = ['address', 'street', 'venue'];
// Busca endereços só perto da cozinha, para não achar uma rua de mesmo nome em outra cidade.
const RAIO_BUSCA_KM = 50;
const TEMPO_LIMITE_MS = 8000;
const VALIDADE_CACHE_MS = 6 * 60 * 60 * 1000;
const MAXIMO_CACHE = 500;

// Erro com mensagem que pode ser mostrada ao cliente (endereço não encontrado, fora da área).
class ErroEntrega extends Error {}

function calculoPorDistanciaAtivo() {
  return !!process.env.ORS_API_KEY;
}

function faixasDaLoja(settings) {
  return Array.isArray(settings.faixasEntrega) && settings.faixasEntrega.length > 0 ? settings.faixasEntrega : FAIXAS_PADRAO;
}

function coordenadasCozinhaTexto(settings) {
  return settings.coordenadasCozinha || COORDENADAS_COZINHA_PADRAO;
}

// "-22.2931, -49.0475" (como o Google Maps mostra ao clicar com o botão direito) -> { latitude, longitude }.
function lerCoordenadas(texto) {
  const partes = String(texto || '').split(',').map((p) => Number(p.trim()));
  if (partes.length !== 2 || partes.some((n) => !Number.isFinite(n))) return null;
  const [latitude, longitude] = partes;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

// Confere a tabela enviada pelo painel e devolve ordenada por distância (ou uma mensagem de erro).
function validarFaixas(faixas) {
  if (!Array.isArray(faixas) || faixas.length === 0 || faixas.length > 30) {
    return { erro: 'Cadastre de 1 a 30 faixas de distância.' };
  }
  const limpas = [];
  for (const f of faixas) {
    const ate = Number(f && f.ate);
    const taxa = Number(f && f.taxa);
    if (!Number.isFinite(ate) || ate <= 0 || ate > 100) return { erro: 'Cada faixa precisa de uma distância entre 0 e 100 km.' };
    if (!Number.isFinite(taxa) || taxa < 0 || taxa > 1000) return { erro: 'Cada faixa precisa de uma taxa válida (R$ 0 ou mais).' };
    limpas.push({ ate: Math.round(ate * 100) / 100, taxa: Math.round(taxa * 100) / 100 });
  }
  limpas.sort((a, b) => a.ate - b.ate);
  if (limpas.some((f, i) => i > 0 && f.ate === limpas[i - 1].ate)) {
    return { erro: 'Há duas faixas com a mesma distância.' };
  }
  return { faixas: limpas };
}

function taxaPorDistancia(faixas, km) {
  const faixa = faixas.find((f) => km <= f.ate);
  return faixa ? faixa.taxa : null;
}

async function chamarOrs(caminho, opcoes = {}) {
  const resp = await fetch(`${URL_HEIGIT}${caminho}`, {
    ...opcoes,
    headers: { Authorization: process.env.ORS_API_KEY, Accept: 'application/json', ...opcoes.headers },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
  });
  const dados = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, dados };
}

// Endereço em texto -> coordenadas, ou null se não achar no nível de rua.
async function localizar(textoEndereco, cozinha) {
  const params = new URLSearchParams({
    api_key: process.env.ORS_API_KEY,
    text: textoEndereco,
    size: '1',
    'boundary.country': 'BR',
    'boundary.circle.lat': String(cozinha.latitude),
    'boundary.circle.lon': String(cozinha.longitude),
    'boundary.circle.radius': String(RAIO_BUSCA_KM),
    'focus.point.lat': String(cozinha.latitude),
    'focus.point.lon': String(cozinha.longitude),
    layers: CAMADAS_ACEITAS.join(',')
  });
  const { ok, status, dados } = await chamarOrs(`${CAMINHO_BUSCA}?${params}`);
  if (!ok) throw new Error(`OpenRouteService (geocode) respondeu ${status}: ${JSON.stringify(dados).slice(0, 300)}`);

  const resultado = dados.features && dados.features[0];
  if (!resultado || !CAMADAS_ACEITAS.includes(resultado.properties.layer)) return null;
  const [longitude, latitude] = resultado.geometry.coordinates;
  return { latitude, longitude };
}

async function distanciaDeCarroKm(origem, destino) {
  const { ok, status, dados } = await chamarOrs(CAMINHO_ROTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [[origem.longitude, origem.latitude], [destino.longitude, destino.latitude]]
    })
  });
  // 404 = não há rua de carro perto de um dos pontos (ex.: endereço achado no meio de um terreno).
  if (status === 404) return null;
  if (!ok) throw new Error(`OpenRouteService (rota) respondeu ${status}: ${JSON.stringify(dados).slice(0, 300)}`);

  const rota = dados.routes && dados.routes[0];
  if (!rota) return null;
  return Math.round((rota.summary.distance || 0) / 10) / 100;
}

// Cache em memória: o mesmo endereço consultado no checkout e de novo ao fechar o pedido não gasta outra chamada.
const cache = new Map();

function lerCache(chave) {
  const item = cache.get(chave);
  if (!item || Date.now() - item.em > VALIDADE_CACHE_MS) return null;
  return item.valor;
}

function gravarCache(chave, valor) {
  if (cache.size >= MAXIMO_CACHE) cache.delete(cache.keys().next().value);
  cache.set(chave, { valor, em: Date.now() });
}

function textoDoEndereco(endereco) {
  const e = endereco || {};
  const parte = (v) => String(v || '').trim().slice(0, 120);
  return `${parte(e.rua)}, ${parte(e.numero)}, ${parte(e.bairro)}, ${parte(e.cidade)}`;
}

// Devolve { distanciaKm, taxa } ou lança ErroEntrega com a mensagem para o cliente.
async function cotarEntrega(settings, endereco) {
  const textoCozinha = coordenadasCozinhaTexto(settings);
  const cozinha = lerCoordenadas(textoCozinha);
  if (!cozinha) throw new Error(`Coordenadas da cozinha inválidas: ${textoCozinha}`);

  const texto = textoDoEndereco(endereco);
  const chave = `${textoCozinha}|${texto.toLowerCase()}`;

  let distanciaKm = lerCache(chave);
  if (distanciaKm === null) {
    const destino = await localizar(texto, cozinha);
    if (!destino) {
      throw new ErroEntrega('Não encontramos esse endereço no mapa. Confira rua, número, bairro e cidade.');
    }
    distanciaKm = await distanciaDeCarroKm(cozinha, destino);
    if (distanciaKm === null) {
      throw new ErroEntrega('Não encontramos um caminho de carro até esse endereço. Confira os dados ou fale com a loja.');
    }
    gravarCache(chave, distanciaKm);
  }

  const taxa = taxaPorDistancia(faixasDaLoja(settings), distanciaKm);
  if (taxa === null) {
    throw new ErroEntrega(`Esse endereço fica a ${distanciaKm.toLocaleString('pt-BR')} km da loja, fora da nossa área de entrega. Você pode escolher retirar na loja.`);
  }
  return { distanciaKm, taxa };
}

module.exports = {
  ErroEntrega,
  calculoPorDistanciaAtivo,
  faixasDaLoja,
  coordenadasCozinhaTexto,
  lerCoordenadas,
  validarFaixas,
  taxaPorDistancia,
  cotarEntrega
};
