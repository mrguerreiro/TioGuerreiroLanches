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

async function carregarPedidos() {
  const pedidos = await API.listarPedidos();
  const tbody = document.getElementById('tabela-pedidos');
  tbody.innerHTML = '';

  for (const pedido of pedidos) {
    const linha = document.createElement('tr');
    const endereco = pedido.cliente.endereco
      ? `${pedido.cliente.endereco.rua}, ${pedido.cliente.endereco.numero} - ${pedido.cliente.endereco.bairro}`
      : '';
    const itensTexto = pedido.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(', ');

    linha.innerHTML = `
      <td><strong>${pedido.id}</strong><br><small>${new Date(pedido.criadoEm).toLocaleString('pt-br')}</small><br><small>${itensTexto}</small></td>
      <td>${pedido.cliente.nome}<br><small>${pedido.cliente.telefone}</small>${endereco ? `<br><small>${endereco}</small>` : ''}</td>
      <td>${pedido.tipoEntrega === 'entrega' ? 'Entrega' : 'Retirada'}</td>
      <td>${formatarMoeda(pedido.total)}</td>
      <td>${pedido.formaPagamento === 'online' ? 'Online (PagSeguro)' : 'Na entrega/retirada'}</td>
      <td>
        <select data-id="${pedido.id}">
          ${Object.entries(STATUS_LABEL).map(([valor, rotulo]) => `<option value="${valor}" ${pedido.status === valor ? 'selected' : ''}>${rotulo}</option>`).join('')}
        </select>
      </td>
      <td></td>`;
    tbody.appendChild(linha);
  }

  tbody.querySelectorAll('select[data-id]').forEach((select) => {
    select.addEventListener('change', async () => {
      await API.atualizarStatusPedido(select.dataset.id, select.value);
    });
  });
}

async function carregarCardapio() {
  const menu = await API.getMenu();
  const containers = { lanche: document.getElementById('lista-admin-lanches'), bebida: document.getElementById('lista-admin-bebidas') };
  containers.lanche.innerHTML = '';
  containers.bebida.innerHTML = '';

  for (const item of menu) {
    const div = document.createElement('div');
    div.className = 'form-item';
    div.innerHTML = `
      <div class="linha-item-admin">
        <img src="${item.imagem}" alt="" class="foto-item-admin">
        <div class="info-item-admin">
          <strong>${item.nome}</strong> — ${formatarMoeda(item.preco)}
          ${item.pausado ? '<span class="status-pausado"> (pausado)</span>' : ''}
          <p class="descricao-item-admin">${item.descricao || ''}</p>
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

    div.querySelector('.btn-pausar').addEventListener('click', async () => {
      await API.atualizarItem(item.id, { pausado: !item.pausado });
      carregarCardapio();
    });
    div.querySelector('.btn-excluir').addEventListener('click', async () => {
      if (!confirm(`Excluir "${item.nome}" do cardápio?`)) return;
      await API.excluirItem(item.id);
      carregarCardapio();
    });
    div.querySelector('.input-trocar-foto').addEventListener('change', async (evento) => {
      const arquivo = evento.target.files[0];
      if (!arquivo) return;
      const erroSpan = div.querySelector('.erro-foto-item');
      erroSpan.textContent = '';
      try {
        const imagemBase64 = await lerArquivoComoBase64(arquivo);
        await API.atualizarImagemItem(item.id, imagemBase64);
        carregarCardapio();
      } catch (err) {
        erroSpan.textContent = err.message;
      }
    });

    containers[item.categoria].appendChild(div);
  }
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

function configurarFormularios() {
  document.getElementById('form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    const erroBox = document.getElementById('erro-login');
    erroBox.innerHTML = '';
    try {
      await API.login(form.usuario.value, form.senha.value);
      await iniciarPainel();
    } catch (err) {
      erroBox.innerHTML = `<div class="mensagem-erro">${err.message}</div>`;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await API.logout();
    mostrarPainel(false);
  });

  document.getElementById('btn-atualizar-pedidos').addEventListener('click', carregarPedidos);

  document.getElementById('form-novo-item').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    await API.criarItem({
      categoria: form.categoria.value,
      nome: form.nome.value,
      preco: form.preco.value,
      imagem: form.imagem.value || undefined,
      descricao: form.descricao.value
    });
    form.reset();
    carregarCardapio();
  });

  document.getElementById('form-config').addEventListener('submit', async (evento) => {
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
  });
}

async function iniciarPainel() {
  mostrarPainel(true);
  await Promise.all([carregarPedidos(), carregarCardapio(), carregarConfiguracoes()]);
}

async function iniciar() {
  configurarAbas();
  configurarFormularios();
  const { autenticado } = await API.statusAuth();
  if (autenticado) {
    await iniciarPainel();
  } else {
    mostrarPainel(false);
  }
}

iniciar();
