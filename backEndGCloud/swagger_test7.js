const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        
        const path = response.data.paths['/pedidos/vendas/{idPedidoVenda}/gerar-nfe'];
        if (path && path.post) {
            console.log("POST /pedidos/vendas/{idPedidoVenda}/gerar-nfe exists!");
            if (path.post.requestBody) {
                console.log("Request Body Schema:", JSON.stringify(path.post.requestBody, null, 2));
            } else {
                console.log("No request body expected.");
            }
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
