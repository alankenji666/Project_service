const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        const schema = response.data.components.schemas['VendasParcela'];
        console.log("VendasParcela Schema:", JSON.stringify(schema, null, 2));
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
