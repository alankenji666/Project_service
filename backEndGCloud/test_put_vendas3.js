const axios = require('axios');
const fs = require('fs');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        console.log("Fetched order OK. Modifying...");
        
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        
        payloadUpdate.contato = { id: order.contato.id };
        
        // Emulate some changes
        payloadUpdate.transporte = payloadUpdate.transporte || {};
        payloadUpdate.transporte.quantidadeVolumes = 1;
        payloadUpdate.transporte.pesoBruto = 10;
        payloadUpdate.transporte.pesoLiquido = 10;
        if (payloadUpdate.transporte.contato) {
            delete payloadUpdate.transporte.contato; // try without transportadora
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
