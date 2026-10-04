const parametros = new URLSearchParams(window.location.search);
document.getElementById('pedido').textContent = parametros.get('pedido') || '-';
const valor = Number(parametros.get('valor'));
document.getElementById('valor').textContent = (Number.isFinite(valor) ? valor : 0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
