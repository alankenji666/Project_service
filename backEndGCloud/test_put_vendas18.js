const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        
        payloadUpdate.contato = { id: order.contato.id };
        
        // Don't change parcelas! Leave it exactly as it came from GET (with id: ..., formaPagamento: { id: 0 })
        
        // But what if something else changed? Like the total?
        // Wait, if the user didn't change anything, the total is the same.
        // Let's just send the exact original parcelas, but with NO other changes.

        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate);
            console.log("PUT OK (Original Parcelas)", putRes.data);
        } catch (e) {
            console.log("PUT Error (Original Parcelas):", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
