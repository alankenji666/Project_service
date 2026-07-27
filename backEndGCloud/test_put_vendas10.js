const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        console.log("Fetched order OK. Modifying...");
        
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        payloadUpdate.contato = { id: order.contato.id };
        
        payloadUpdate.parcelas = [
            {
                dataVencimento: "2026-07-20",
                valor: 3236.08,
                observacoes: ""
                // No formaPagamento, no id
            }
        ];

        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate);
            console.log("PUT OK", putRes.data);
        } catch (e) {
            console.log("PUT Error (sem ID, sem formaPagamento):", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
