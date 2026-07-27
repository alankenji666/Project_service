const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        console.log("Fetched order OK. Modifying...");
        
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        payloadUpdate.contato = { id: order.contato.id };
        
        // Remove `id` from parcelas
        payloadUpdate.parcelas = payloadUpdate.parcelas.map(p => {
            delete p.id;
            return p;
        });

        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate);
            console.log("PUT sem ID nas parcelas OK", putRes.data);
        } catch (e) {
            console.log("PUT Error (sem ID):", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

        // Now remove `formaPagamento` from parcelas
        const payloadUpdate2 = JSON.parse(JSON.stringify(order));
        payloadUpdate2.contato = { id: order.contato.id };
        payloadUpdate2.parcelas = payloadUpdate2.parcelas.map(p => {
            delete p.formaPagamento;
            return p;
        });

        try {
            const putRes2 = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate2);
            console.log("PUT sem formaPagamento OK", putRes2.data);
        } catch (e) {
            console.log("PUT Error (sem formaPagamento):", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
