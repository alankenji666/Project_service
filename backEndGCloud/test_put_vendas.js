const axios = require('axios');
const fs = require('fs');

async function test() {
    try {
        // Fetch order
        const getUrl = 'http://localhost:8080/bling/vendas/26341835107'; // assuming proxy is running locally? No, I need the actual token or I can use the cloud run backend which is already deployed but with the old code? Wait, the cloud run backend HAS the /vendas/:id GET endpoint!
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/bling/vendas/26341835107');
        const order = getRes.data.data;
        
        console.log("Fetched order OK. Modifying...");
        
        // Emulate _saveOrderEdit logic
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        
        payloadUpdate.contato = { id: order.contato.id };
        // just try sending it back as is
        
        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/bling/vendas/26341835107', payloadUpdate);
            console.log("PUT OK", putRes.data);
        } catch (e) {
            console.log("PUT Error:", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }
    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
