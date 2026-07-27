const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        
        const path = response.data.paths['/pedidos/vendas/{idPedidoVenda}'];
        if (path && path.put) {
            console.log("PUT requestBody:", JSON.stringify(path.put.requestBody, null, 2));
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
