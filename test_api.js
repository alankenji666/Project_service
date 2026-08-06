const axios = require('axios');

async function test() {
    try {
        const res = await axios.get('http://localhost:3000/api/pedidos');
        const pedidos = res.data.data;
        const p = pedidos.find(x => x.numero_pedido == '1641' || x.id_pedido == '1641' || x.id == '1641' || x.numero == '1641');
        if (p) {
            console.log('Pedido 1641 encontrado:', p.id, p.numero);
            console.log('Detalhes produção:', JSON.stringify(p.detalhesProducao, null, 2));
        } else {
            console.log('Pedido 1641 não encontrado');
        }
    } catch (e) {
        console.error(e.message);
    }
}
test();
