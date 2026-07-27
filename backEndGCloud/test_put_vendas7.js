const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        console.log("VendasDadosDTO:", JSON.stringify(response.data.components.schemas['VendasDadosDTO'], null, 2));
        console.log("VendasParcelaRequestDTO:", JSON.stringify(response.data.components.schemas['VendasParcelaRequestDTO'], null, 2));
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
