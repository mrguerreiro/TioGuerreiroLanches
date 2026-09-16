const formatarMoeda = (valor) => Number(valor).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

const STATUS_LABEL = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_para_entrega: 'Saiu para entrega',
  pronto_retirada: 'Pronto para retirada',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};

function mostrarPainel(mostrar) {
  document.getElementById('tela-login').style.display = mostrar ? 'none' : 'block';
  document.getElementById('tela-painel').style.display = mostrar ? 'block' : 'none';
}

// Mostra (ou limpa, se mensagem vazia) um erro dentro do elemento indicado, sempre como texto puro.
function mostrarErro(idElemento, mensagem) {
  const caixa = document.getElementById(idElemento);
  caixa.innerHTML = '';
  if (!mensagem) return;
  const div = document.createElement('div');
  div.className = 'mensagem-erro';
  div.textContent = mensagem;
  caixa.appendChild(div);
}

function configurarAbas() {
  document.querySelectorAll('.aba-botoes button[data-aba]').forEach((botao) => {
    botao.addEventListener('click', () => {
      document.querySelectorAll('.aba-botoes button[data-aba]').forEach((b) => b.classList.remove('ativa'));
      document.querySelectorAll('.aba').forEach((a) => a.classList.remove('ativa'));
      botao.classList.add('ativa');
      document.getElementById(botao.dataset.aba).classList.add('ativa');
    });
  });
}

function formatarItemPedido(it) {
  const acrescimos = Array.isArray(it.acrescimos) && it.acrescimos.length > 0
    ? ` (+ ${it.acrescimos.map((a) => a.nome).join(', ')})`
    : '';
  return `${it.quantidade}x ${it.nome}${acrescimos}`;
}

async function carregarPedidos() {
  const pedidos = await API.listarPedidos();
  const tbody = document.getElementById('tabela-pedidos');
  tbody.innerHTML = '';

  for (const pedido of pedidos) {
    const linha = document.createElement('tr');
    const e = pedido.cliente.endereco;
    const endereco = e
      ? `${e.rua}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ''} - ${e.bairro}`
      : '';
    const itensTexto = pedido.itens.map(formatarItemPedido).join(', ');

    linha.innerHTML = `
      <td><strong>${escaparHtml(pedido.id)}</strong><br><small>${new Date(pedido.criadoEm).toLocaleString('pt-br')}</small><br><small>${escaparHtml(itensTexto)}</small></td>
      <td>${escaparHtml(pedido.cliente.nome)}<br><small>${escaparHtml(pedido.cliente.telefone)}</small>${endereco ? `<br><small>${escaparHtml(endereco)}</small>` : ''}</td>
      <td>${pedido.tipoEntrega === 'entrega' ? 'Entrega' : 'Retirada'}</td>
      <td>${formatarMoeda(pedido.total)}</td>
      <td>${pedido.formaPagamento === 'online' ? 'Online (PagSeguro)' : 'Na entrega/retirada'}</td>
      <td>
        <select>
          ${Object.entries(STATUS_LABEL).map(([valor, rotulo]) => `<option value="${valor}" ${pedido.status === valor ? 'selected' : ''}>${rotulo}</option>`).join('')}
        </select>
      </td>
      <td></td>`;

    const select = linha.querySelector('select');
    select.dataset.statusAtual = pedido.status;
    select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        await API.atualizarStatusPedido(pedido.id, select.value);
        select.dataset.statusAtual = select.value;
      } catch (err) {
        select.value = select.dataset.statusAtual;
        alert(`Não foi possível alterar o status do pedido ${pedido.id}: ${err.message}`);
      } finally {
        select.disabled = false;
      }
    });

    tbody.appendChild(linha);
  }
}

async function carregarClientes() {
  const clientes = await API.listarClientes();
  const tbody = document.getElementById('tabela-clientes');
  tbody.innerHTML = '';

  for (const cliente of clientes) {
    const endereco = cliente.endereco
      ? `${cliente.endereco.rua}, ${cliente.endereco.numero} - ${cliente.endereco.bairro}, ${cliente.endereco.cidade}`
      : '—';
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${escaparHtml(cliente.nome)}</td>
      <td>${escaparHtml(cliente.telefone)}</td>
      <td>${escaparHtml(endereco)}</td>
      <td>${new Date(cliente.atualizadoEm).toLocaleString('pt-br')}</td>`;
    tbody.appendChild(linha);
  }
}

async function carregarCardapio() {
  const menu = await API.getMenu();
  const containers = { lanche: document.getElementById('lista-admin-lanches'), bebida: document.getElementById('lista-admin-bebidas') };
  containers.lanche.innerHTML = '';
  containers.bebida.innerHTML = '';

  for (const item of menu) {
    const container = containers[item.categoria];
    if (!container) continue;

    const div = document.createElement('div');
    div.className = 'form-item';
    div.innerHTML = `
      <div class="linha-item-admin">
        <img src="${escaparHtml(item.imagem)}" alt="" class="foto-item-admin">
        <div class="info-item-admin">
          <strong>${escaparHtml(item.nome)}</strong> — ${formatarMoeda(item.preco)}
          ${item.pausado ? '<span class="status-pausado"> (pausado)</span>' : ''}
          <p class="descricao-item-admin">${escaparHtml(item.descricao)}</p>
          <label class="rotulo-trocar-foto">
            Trocar foto
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="input-trocar-foto">
          </label>
          <span class="erro-foto-item"></span>
        </div>
        <div class="acoes-item">
          <button class="btn-pausar">${item.pausado ? 'Reativar' : 'Pausar'}</button>
          <button class="btn-excluir">Excluir</button>
        </div>
      </div>`;

    const erroSpan = div.querySelector('.erro-foto-item');

    div.querySelector('.btn-pausar').addEventListener('click', async () => {
      erroSpan.textContent = '';
      try {
        await API.atualizarItem(item.id, { pausado: !item.pausado });
        await carregarCardapio();
      } catch (err) {
        erroSpan.textContent = err.message;
      }
    });
    div.querySelector('.btn-excluir').addEventListener('click', async () => {
      if (!confirm(`Excluir "${item.nome}" do cardápio?`)) return;
      erroSpan.textContent = '';
      try {
        await API.excluirItem(item.id);
        await carregarCardapio();
      } catch (err) {
        erroSpan.textContent = err.message;
      }
    });
    div.querySelector('.input-trocar-foto').addEventListener('change', async (evento) => {
      const arquivo = evento.target.files[0];
      if (!arquivo) return;
      erroSpan.textContent = '';
      try {
        const imagemBase64 = await lerArquivoComoBase64(arquivo);
        await API.atualizarImagemItem(item.id, imagemBase64);
        await carregarCardapio();
      } catch (err) {
        erroSpan.textContent = err.message;
      }
    });

    container.appendChild(div);
  }
}

async function carregarAcrescimos() {
  const acrescimos = await API.getAcrescimos();
  const container = document.getElementById('lista-admin-acrescimos');
  container.innerHTML = '';

  if (acrescimos.length === 0) {
    container.innerHTML = '<p class="texto-ajuda">Nenhum acréscimo cadastrado.</p>';
    return;
  }

  for (const acrescimo of acrescimos) {
    container.appendChild(montarLinhaAcrescimo(acrescimo));
  }
}

// Cada linha é um formulário com dois modos: visualização (Editar/Pausar/Excluir) e edição (Salvar/Cancelar).
function montarLinhaAcrescimo(acrescimo) {
  const linha = document.createElement('form');
  linha.className = 'linha-acrescimo-admin';

  function mostrarVisualizacao() {
    linha.innerHTML = `
      <span class="info-item-admin">
        <strong>${escaparHtml(acrescimo.nome)}</strong> — ${formatarMoeda(acrescimo.preco)}
        ${acrescimo.pausado ? '<span class="status-pausado"> (pausado)</span>' : ''}
      </span>
      <div class="acoes-item">
        <button type="button" class="btn-editar">Editar</button>
        <button type="button" class="btn-pausar">${acrescimo.pausado ? 'Reativar' : 'Pausar'}</button>
        <button type="button" class="btn-excluir">Excluir</button>
      </div>`;

    linha.querySelector('.btn-editar').addEventListener('click', () => {
      mostrarErro('erro-acrescimo', '');
      mostrarEdicao();
    });

    const botaoPausar = linha.querySelector('.btn-pausar');
    botaoPausar.addEventListener('click', async () => {
      mostrarErro('erro-acrescimo', '');
      botaoPausar.disabled = true;
      try {
        await API.atualizarAcrescimo(acrescimo.id, { pausado: !acrescimo.pausado });
        await carregarAcrescimos();
      } catch (err) {
        botaoPausar.disabled = false;
        mostrarErro('erro-acrescimo', err.message);
      }
    });

    linha.querySelector('.btn-excluir').addEventListener('click', async () => {
      if (!confirm(`Excluir o acréscimo "${acrescimo.nome}"?`)) return;
      mostrarErro('erro-acrescimo', '');
      try {
        await API.excluirAcrescimo(acrescimo.id);
        await carregarAcrescimos();
      } catch (err) {
        mostrarErro('erro-acrescimo', err.message);
      }
    });
  }

  function mostrarEdicao() {
    linha.innerHTML = `
      <input name="nome" value="${escaparHtml(acrescimo.nome)}" required aria-label="Nome do acréscimo">
      <input name="preco" type="number" step="0.01" min="0" value="${Number(acrescimo.preco)}" required aria-label="Preço do acréscimo (R$)">
      <div class="acoes-item">
        <button type="submit" class="btn-salvar">Salvar</button>
        <button type="button" class="btn-cancelar">Cancelar</button>
      </div>`;

    linha.querySelector('.btn-cancelar').addEventListener('click', () => {
      mostrarErro('erro-acrescimo', '');
      mostrarVisualizacao();
    });
    linha.nome.focus();
  }

  linha.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarErro('erro-acrescimo', '');
    const botaoSalvar = linha.querySelector('.btn-salvar');
    botaoSalvar.disabled = true;
    try {
      await API.atualizarAcrescimo(acrescimo.id, { nome: linha.nome.value, preco: linha.preco.value });
      await carregarAcrescimos();
    } catch (err) {
      botaoSalvar.disabled = false;
      mostrarErro('erro-acrescimo', err.message);
    }
  });

  mostrarVisualizacao();
  return linha;
}

function lerArquivoComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    leitor.readAsDataURL(arquivo);
  });
}

async function carregarConfiguracoes() {
  const config = await API.getConfiguracoes();
  const form = document.getElementById('form-config');
  form.nomeLoja.value = config.nomeLoja || '';
  form.horarioFuncionamento.value = config.horarioFuncionamento || '';
  form.whatsapp.value = config.whatsapp || '';
  form.taxaEntrega.value = config.taxaEntrega || 0;
  form.aceitaRetirada.checked = !!config.aceitaRetirada;
  form.aceitaEntrega.checked = !!config.aceitaEntrega;
  form.aceitaPagamentoEntrega.checked = !!config.aceitaPagamentoEntrega;
  form.aceitaPagamentoOnline.checked = !!config.aceitaPagamentoOnline;
}

// Executa a ação e avisa com alert se algo der errado (usado nos botões "Atualizar" e afins).
function comAvisoDeErro(acao) {
  return async (...args) => {
    try {
      await acao(...args);
    } catch (err) {
      alert(err.message);
    }
  };
}

function configurarFormularios() {
  document.getElementById('form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    mostrarErro('erro-login', '');
    try {
      await API.login(form.usuario.value, form.senha.value);
      await iniciarPainel();
    } catch (err) {
      mostrarErro('erro-login', err.message);
    }
  });

  document.getElementById('btn-logout').addEventListener('click', comAvisoDeErro(async () => {
    await API.logout();
    mostrarPainel(false);
  }));

  document.getElementById('btn-atualizar-pedidos').addEventListener('click', comAvisoDeErro(carregarPedidos));
  document.getElementById('btn-atualizar-clientes').addEventListener('click', comAvisoDeErro(carregarClientes));

  document.getElementById('form-novo-item').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    mostrarErro('erro-novo-item', '');
    try {
      await API.criarItem({
        categoria: form.categoria.value,
        nome: form.nome.value,
        preco: form.preco.value,
        imagem: form.imagem.value || undefined,
        descricao: form.descricao.value
      });
      form.reset();
      await carregarCardapio();
    } catch (err) {
      mostrarErro('erro-novo-item', err.message);
    }
  });

  document.getElementById('form-novo-acrescimo').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    mostrarErro('erro-acrescimo', '');
    try {
      await API.criarAcrescimo({ nome: form.nome.value, preco: form.preco.value });
      form.reset();
      await carregarAcrescimos();
    } catch (err) {
      mostrarErro('erro-acrescimo', err.message);
    }
  });

  document.getElementById('form-config').addEventListener('submit', comAvisoDeErro(async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    await API.salvarConfiguracoes({
      nomeLoja: form.nomeLoja.value,
      horarioFuncionamento: form.horarioFuncionamento.value,
      whatsapp: form.whatsapp.value,
      taxaEntrega: form.taxaEntrega.value,
      aceitaRetirada: form.aceitaRetirada.checked,
      aceitaEntrega: form.aceitaEntrega.checked,
      aceitaPagamentoEntrega: form.aceitaPagamentoEntrega.checked,
      aceitaPagamentoOnline: form.aceitaPagamentoOnline.checked
    });
    alert('Configurações salvas.');
  }));
}

async function iniciarPainel() {
  mostrarPainel(true);
  await Promise.all([carregarPedidos(), carregarCardapio(), carregarAcrescimos(), carregarClientes(), carregarConfiguracoes()]);
}

async function iniciar() {
  configurarAbas();
  configurarFormularios();
  try {
    const { autenticado } = await API.statusAuth();
    if (autenticado) {
      await iniciarPainel();
    } else {
      mostrarPainel(false);
    }
  } catch (err) {
    mostrarPainel(false);
    mostrarErro('erro-login', 'Não foi possível conectar ao servidor. O painel só funciona com o servidor Node.js rodando.');
  }
}

iniciar();
