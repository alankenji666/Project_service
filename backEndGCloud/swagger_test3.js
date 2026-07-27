const axios = require('axios');

async function test() {
    try {
        const response = await axios.post('https://www.bling.com.br/Api/v3/pedidos/vendas/1/gerar-nfe', {}, {
            headers: { 'Authorization': `Bearer fake` }
        });
        console.log("Success:", response.data);
    } catch (e) {
        console.log("Error:", e.response ? e.response.status + " " + JSON.stringify(e.response.data) : e.message);
    }
}
test();
