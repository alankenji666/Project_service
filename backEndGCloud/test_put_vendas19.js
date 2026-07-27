const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        payloadUpdate.contato = { id: order.contato.id };
        
        // Original has ONE parcela. Let's send TWO NEW parcelas!
        payloadUpdate.parcelas = [
            {
                dataVencimento: "2026-07-20",
                valor: 1000.00,
                formaPagamento: { id: 6220057 }
            },
            {
                dataVencimento: "2026-08-20",
                valor: 2236.08,
                formaPagamento: { id: 6220057 }
            }
        ];

        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate);
            console.log("PUT OK (2 New Parcelas)", putRes.data);
        } catch (e) {
            console.log("PUT Error (2 New Parcelas):", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
