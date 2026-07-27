const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        console.log("VendasParcelaDTO:", JSON.stringify(response.data.components.schemas['VendasParcelaDTO'], null, 2));
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
