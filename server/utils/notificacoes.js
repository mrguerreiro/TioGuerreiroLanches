// Notificações no celular do cliente (Web Push) a cada mudança de status do pedido.
// As chaves VAPID vêm do .env ou, se não existirem, são geradas uma vez e guardadas no banco.
const webpush = require('web-push');
const db = require('./db');

const MENSAGENS_STATUS = {
  recebido: { titulo: 'Pedido recebido! ✅', texto: 'Recebemos seu pedido e ele já está na fila.' },
  preparando: { titulo: 'Pedido sendo preparado 👨‍🍳', texto: 'Seu pedido está sendo preparado.' },
  saiu_para_entrega: { titulo: 'Pedido saiu para entrega 🛵', texto: 'Seu pedido está a caminho.' },
  pronto_retirada: { titulo: 'Pedido pronto para retirada 🏠', texto: 'Seu pedido já pode ser retirado na loja.' },
  concluido: { titulo: 'Pedido concluído ❤️', texto: 'Obrigado pela preferência! Bom apetite.' },
  cancelado: { titulo: 'Pedido cancelado', texto: 'Seu pedido foi cancelado. Em caso de dúvida, fale com a loja.' }
};

// Só aceitamos endereços dos serviços de push dos navegadores, para o servidor não
// ser usado para enviar requisições a endereços quaisquer.
const HOSTS_PUSH_PERMITIDOS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com'
];
const SUFIXOS_PUSH_PERMITIDOS = ['.push.apple.com', '.notify.windows.com'];

let chavePublica = null;

async function iniciar() {
  let publica = process.env.VAPID_PUBLIC_KEY;
  let privada = process.env.VAPID_PRIVATE_KEY;

  if (!publica || !privada) {
    let chaves = await db.getChave('vapid');
    if (!chaves) {
      chaves = webpush.generateVAPIDKeys();
      await db.saveChave('vapid', chaves);
    }
    publica = chaves.publicKey;
    privada = chaves.privateKey;
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@example.com', publica, privada);
  chavePublica = publica;
}

function getChavePublica() {
  return chavePublica;
}

// Valida a inscrição enviada pelo navegador. Retorna a inscrição limpa ou null se for inválida.
function validarInscricao(inscricao) {
  if (!inscricao || typeof inscricao !== 'object') return null;
  const { endpoint, keys } = inscricao;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const hostPermitido = HOSTS_PUSH_PERMITIDOS.includes(host) || SUFIXOS_PUSH_PERMITIDOS.some((s) => host.endsWith(s));
  if (url.protocol !== 'https:' || !hostPermitido) return null;

  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function linkAcompanhamento(pedido) {
  return `/acompanhar.html?pedido=${encodeURIComponent(pedido.id)}&token=${encodeURIComponent(pedido.tokenAcompanhamento)}`;
}

// Envia a notificação do status atual do pedido. Nunca lança erro: falhas só vão para o log.
async function notificarStatus(pedido) {
  const mensagem = MENSAGENS_STATUS[pedido.status];
  if (!pedido.pushInscricao || !mensagem || !chavePublica) return false;

  const payload = JSON.stringify({
    titulo: mensagem.titulo,
    texto: `${mensagem.texto}\nPedido ${pedido.id}`,
    url: linkAcompanhamento(pedido),
    tag: pedido.id
  });

  try {
    await webpush.sendNotification(pedido.pushInscricao, payload, { TTL: 60 * 60 * 24, timeout: 10000 });
    return true;
  } catch (err) {
    // 404/410: o cliente desativou as notificações ou a inscrição expirou; não adianta tentar de novo.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await db.updateOrder(pedido.id, { pushInscricao: null }).catch(() => {});
    } else {
      console.error(`Falha ao enviar notificação do pedido ${pedido.id}:`, err.statusCode || '', err.body || err.message);
    }
    return false;
  }
}

module.exports = { iniciar, getChavePublica, validarInscricao, notificarStatus, linkAcompanhamento, MENSAGENS_STATUS };
