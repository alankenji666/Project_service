const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        
        const path = response.data.paths['/pedidos/vendas/{idPedidoVenda}/gerar-nfe'];
        if (path && path.post) {
            console.log("Responses:", JSON.stringify(path.post.responses, null, 2));
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
