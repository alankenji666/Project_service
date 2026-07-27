const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/api/swagger.json');
        const paths = Object.keys(response.data.paths);
        const nfePaths = paths.filter(p => p.toLowerCase().includes('nfe'));
        const pedidoPaths = paths.filter(p => p.toLowerCase().includes('pedido') || p.toLowerCase().includes('venda'));
        console.log("NFe paths:", nfePaths);
        console.log("Pedido paths:", pedidoPaths.filter(p => p.includes('nfe') || p.includes('gerar')));
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
