const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        console.log("Original Order Desconto:", JSON.stringify(order.desconto, null, 2));
    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
