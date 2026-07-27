const axios = require('axios');
const fs = require('fs');

async function test() {
    try {
        // Fetch order
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        console.log("Fetched order OK. Modifying...");
        
        // Emulate _saveOrderEdit logic
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        
        // Emulate what gerenciarPedidos.js does:
        payloadUpdate.contato = { id: order.contato.id };
        // Remove or alter some fields that _saveOrderEdit would alter? 
        // Let's just try sending what we fetched to see if Bling accepts a pure identity update.
        // Wait, the frontend code modifies: 
        if (payloadUpdate.desconto && payloadUpdate.desconto.valor === 0) {
            payloadUpdate.desconto = { valor: 0, unidade: 'REAL' };
        }
        
        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate);
            console.log("PUT OK", putRes.data);
        } catch (e) {
            console.log("PUT Error:", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }
    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
