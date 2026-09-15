let menu = [];
let configuracoes = {};
let acrescimosCatalogo = [];
let carrinho = {}; // { [chave]: { item, quantidade, acrescimos: [{id,nome,preco}] } }
let itemPendenteAcrescimo = null;

const formatarMoeda = (valor) => valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

function renderizarMenu() {
  const grades = { lanche: document.getElementById('grade-lanches'), bebida: document.getElementById('grade-bebidas') };
  grades.lanche.innerHTML = '';
  grades.bebida.innerHTML = '';

  for (const item of menu) {
    const grade = grades[item.categoria];
    if (!grade) continue;

    const card = document.createElement('div');
    card.className = 'card-produto';
    card.innerHTML = `
      <img src="${item.imagem}" alt="Imagem ilustrativa de ${item.nome}" loading="lazy">
      <div class="corpo">
        ${item.pausado ? '<span class="selo-pausado">Indisponível no momento</span>' : ''}
        <h3>${item.nome}</h3>
        <p class="descricao">${item.descricao || ''}</p>
        <div class="rodape">
          <span class="preco">${formatarMoeda(item.preco)}</span>
          <button class="btn" data-id="${item.id}" ${item.pausado ? 'disabled' : ''}>Adicionar</button>
        </div>
      </div>`;
    grade.appendChild(card);
  }

  document.querySelectorAll('.card-produto button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => adicionarAoCarrinho(btn.dataset.id));
  });
}

function adicionarAoCarrinho(id) {
  const item = menu.find((m) => m.id === id);
  if (!item || item.pausado) return;

  if (item.categoria === 'lanche' && acrescimosCatalogo.length > 0) {
    abrirModalAcrescimos(item);
    return;
  }

  incluirNoCarrinho(item, []);
}

function chaveCarrinho(item, acrescimos) {
  const idsAcrescimos = acrescimos.map((a) => a.id).sort().join(',');
  return `${item.id}::${idsAcrescimos}`;
}

function incluirNoCarrinho(item, acrescimos) {
  const chave = chaveCarrinho(item, acrescimos);
  if (!carrinho[chave]) carrinho[chave] = { item, quantidade: 0, acrescimos };
  carrinho[chave].quantidade += 1;
  atualizarBarraCarrinho();
}

function abrirModalAcrescimos(item) {
  itemPendenteAcrescimo = item;
  document.getElementById('nome-item-acrescimo').textContent = item.nome;

  const lista = document.getElementById('lista-selecao-acrescimos');
  lista.innerHTML = acrescimosCatalogo.map((a) => `
    <li>
      <label>
        <input type="checkbox" value="${a.id}" data-preco="${a.preco}">
        <span class="nome-acrescimo">${a.nome}</span>
        <span class="preco-acrescimo">+ ${formatarMoeda(a.preco)}</span>
      </label>
    </li>`).join('');

  lista.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', atualizarTotalModalAcrescimos);
  });

  atualizarTotalModalAcrescimos();
  abrirModal('modal-acrescimos');
}

function atualizarTotalModalAcrescimos() {
  const marcados = document.querySelectorAll('#lista-selecao-acrescimos input:checked');
  const somaAcrescimos = Array.from(marcados).reduce((soma, cb) => soma + Number(cb.dataset.preco), 0);
  const total = (itemPendenteAcrescimo ? itemPendenteAcrescimo.preco : 0) + somaAcrescimos;
  document.getElementById('total-item-acrescimo').textContent = formatarMoeda(total);
}

function confirmarAcrescimos() {
  if (!itemPendenteAcrescimo) return;
  const marcados = document.querySelectorAll('#lista-selecao-acrescimos input:checked');
  const acrescimosEscolhidos = Array.from(marcados).map((cb) => {
    const catalogo = acrescimosCatalogo.find((a) => a.id === cb.value);
    return { id: catalogo.id, nome: catalogo.nome, preco: catalogo.preco };
  });

  incluirNoCarrinho(itemPendenteAcrescimo, acrescimosEscolhidos);
  itemPendenteAcrescimo = null;
  fecharModal('modal-acrescimos');
}

function alterarQuantidade(chave, delta) {
  if (!carrinho[chave]) return;
  carrinho[chave].quantidade += delta;
  if (carrinho[chave].quantidade <= 0) delete carrinho[chave];
  atualizarBarraCarrinho();
  renderizarModalCarrinho();
}

function precoUnitario(entrada) {
  const somaAcrescimos = entrada.acrescimos.reduce((soma, a) => soma + a.preco, 0);
  return entrada.item.preco + somaAcrescimos;
}

function totalCarrinho() {
  return Object.values(carrinho).reduce((soma, entrada) => soma + precoUnitario(entrada) * entrada.quantidade, 0);
}

function quantidadeTotalCarrinho() {
  return Object.values(carrinho).reduce((soma, { quantidade }) => soma + quantidade, 0);
}

function atualizarBarraCarrinho() {
  const barra = document.getElementById('barra-carrinho');
  const qtd = quantidadeTotalCarrinho();
  document.getElementById('resumo-carrinho').textContent = `${qtd} ite${qtd === 1 ? 'm' : 'ns'} — ${formatarMoeda(totalCarrinho())}`;
  barra.classList.toggle('oculta', qtd === 0);
}

function renderizarModalCarrinho() {
  const container = document.getElementById('itens-carrinho');
  container.innerHTML = '';
  const entradas = Object.entries(carrinho);

  if (entradas.length === 0) {
    container.innerHTML = '<p>Seu carrinho está vazio.</p>';
  }

  for (const [chave, entrada] of entradas) {
    const { item, quantidade, acrescimos } = entrada;
    const textoAcrescimos = acrescimos.length > 0
      ? `<br><small>+ ${acrescimos.map((a) => a.nome).join(', ')}</small>`
      : '';
    const linha = document.createElement('div');
    linha.className = 'linha-item-carrinho';
    linha.innerHTML = `
      <span class="nome">${item.nome}<br><small>${formatarMoeda(precoUnitario(entrada))}</small>${textoAcrescimos}</span>
      <div class="qtd-controle">
        <button data-acao="menos">−</button>
        <span>${quantidade}</span>
        <button data-acao="mais">+</button>
      </div>`;
    linha.querySelector('[data-acao="menos"]').addEventListener('click', () => alterarQuantidade(chave, -1));
    linha.querySelector('[data-acao="mais"]').addEventListener('click', () => alterarQuantidade(chave, 1));
    container.appendChild(linha);
  }

  document.getElementById('total-carrinho').textContent = formatarMoeda(totalCarrinho());
}

function abrirModal(id) { document.getElementById(id).classList.remove('oculta'); }
function fecharModal(id) { document.getElementById(id).classList.add('oculta'); }

function alternarCamposEndereco() {
  const tipo = document.querySelector('input[name="tipoEntrega"]:checked').value;
  document.getElementById('campos-endereco').style.display = tipo === 'entrega' ? 'block' : 'none';
  document.querySelectorAll('#campos-endereco input').forEach((input) => {
    input.required = tipo === 'entrega';
  });
}

async function enviarPedido(evento) {
  evento.preventDefault();
  const erroBox = document.getElementById('erro-checkout');
  erroBox.innerHTML = '';

  const form = evento.target;
  const tipoEntrega = form.tipoEntrega.value;
  const formaPagamento = form.formaPagamento.value;

  const cliente = {
    nome: form.nome.value.trim(),
    telefone: form.telefone.value.trim()
  };
  if (tipoEntrega === 'entrega') {
    cliente.endereco = {
      rua: form.rua.value.trim(),
      numero: form.numero.value.trim(),
      complemento: form.complemento.value.trim(),
      bairro: form.bairro.value.trim(),
      cidade: form.cidade.value.trim()
    };
  }

  const itens = Object.values(carrinho).map(({ item, quantidade, acrescimos }) => ({
    id: item.id,
    quantidade,
    acrescimos: acrescimos.map((a) => a.id)
  }));

  try {
    const pedido = await API.criarPedido({ itens, tipoEntrega, cliente, formaPagamento });
    carrinho = {};
    atualizarBarraCarrinho();
    fecharModal('modal-checkout');

    if (pedido.pagamento && pedido.pagamento.linkCheckout) {
      window.location.href = pedido.pagamento.linkCheckout;
      return;
    }

    document.getElementById('mensagem-confirmacao').innerHTML = `
      ✅ Pedido <strong>${pedido.id}</strong> recebido!<br>
      Total: <strong>${formatarMoeda(pedido.total)}</strong><br>
      Pagamento: na entrega/retirada.`;
    abrirModal('modal-confirmacao');
  } catch (err) {
    erroBox.innerHTML = `<div class="mensagem-erro">${err.message}</div>`;
  }
}

function configurarEventos() {
  document.getElementById('btn-ver-carrinho').addEventListener('click', () => {
    renderizarModalCarrinho();
    abrirModal('modal-carrinho');
  });
  document.getElementById('btn-fechar-carrinho').addEventListener('click', () => fecharModal('modal-carrinho'));

  document.getElementById('btn-ir-checkout').addEventListener('click', () => {
    if (quantidadeTotalCarrinho() === 0) return;
    document.getElementById('total-checkout').textContent = formatarMoeda(totalCarrinho());
    fecharModal('modal-carrinho');
    abrirModal('modal-checkout');
  });
  document.getElementById('btn-voltar-carrinho').addEventListener('click', () => {
    fecharModal('modal-checkout');
    abrirModal('modal-carrinho');
  });

  document.querySelectorAll('input[name="tipoEntrega"]').forEach((el) => el.addEventListener('change', alternarCamposEndereco));
  document.getElementById('form-checkout').addEventListener('submit', enviarPedido);

  document.getElementById('btn-confirmar-acrescimos').addEventListener('click', confirmarAcrescimos);
  document.getElementById('btn-cancelar-acrescimos').addEventListener('click', () => {
    itemPendenteAcrescimo = null;
    fecharModal('modal-acrescimos');
  });

  document.getElementById('btn-fechar-confirmacao').addEventListener('click', () => {
    fecharModal('modal-confirmacao');
    document.getElementById('form-checkout').reset();
    alternarCamposEndereco();
  });

  document.querySelectorAll('[data-voltar-topo]').forEach((btn) => {
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  });
}

async function iniciar() {
  configurarEventos();
  try {
    [menu, configuracoes, acrescimosCatalogo] = await Promise.all([API.getMenu(), API.getConfiguracoes(), API.getAcrescimos()]);
    renderizarMenu();
    if (configuracoes.horarioFuncionamento) {
      document.getElementById('horario-funcionamento').textContent = configuracoes.horarioFuncionamento;
    }
  } catch (err) {
    console.error('Erro ao carregar cardápio', err);
    // Sem servidor Node disponível (ex.: prévia estática no GitHub Pages) não há cardápio dinâmico nem pedidos.
    document.getElementById('grade-lanches').innerHTML = '';
    document.getElementById('grade-bebidas').innerHTML = '';
    const aviso = document.createElement('p');
    aviso.className = 'mensagem-erro';
    aviso.textContent = 'Esta é uma prévia estática do site. Para ver o cardápio, fazer pedidos e usar o painel administrativo, é necessário rodar o servidor Node.js (veja o README do projeto).';
    document.getElementById('lista-lanches').appendChild(aviso);
  }
}

iniciar();

// PWA: registro do service worker e prompt de instalação
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

let promptInstalacao = null;
window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  promptInstalacao = evento;
  document.getElementById('btn-instalar').classList.remove('oculta');
});

document.getElementById('btn-instalar').addEventListener('click', async () => {
  if (!promptInstalacao) return;
  promptInstalacao.prompt();
  await promptInstalacao.userChoice;
  promptInstalacao = null;
  document.getElementById('btn-instalar').classList.add('oculta');
});
