const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107');
        const order = getRes.data.data;
        
        const payloadUpdate = JSON.parse(JSON.stringify(order));
        
        // As per gerenciarPedidos.js:
        payloadUpdate.contato = { id: order.contato.id };
        
        // Emulate itens
        payloadUpdate.itens = [
            {
                ...order.itens[0],
                codigo: "512090127-4",
                descricao: "Mola Gás 80kg #31333 - Intermol",
                quantidade: 16,
                valor: 184.82
            }
        ];
        
        // Emulate transporte
        payloadUpdate.transporte = {
            ...order.transporte,
            fretePorConta: 0, // CIF, AI might have extracted this
            frete: 279,
            quantidadeVolumes: 1,
            pesoBruto: 10,
            pesoLiquido: 10
        };
        // The transportadora might be empty string -> NO contato
        // Or it might be "Selecione a Transportadora"
        // Let's omit contato completely
        if (payloadUpdate.transporte.contato) {
            delete payloadUpdate.transporte.contato;
        }

        // Emulate desconto
        payloadUpdate.desconto = { valor: 0.04, unidade: 'REAL' };
        payloadUpdate.outrasDespesas = 0;

        // Emulate parcelas
        payloadUpdate.parcelas = [
            {
                dataVencimento: "2026-07-16",
                valor: 3236.08,
                observacoes: "",
                // Let's assume formaPagamento mapped to standard
                formaPagamento: { id: 6220057 }
            }
        ];

        try {
            const putRes = await axios.put('https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/vendas/26341835107', payloadUpdate);
            console.log("PUT OK", putRes.data);
        } catch (e) {
            console.log("PUT Error (Full Emulation):", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
