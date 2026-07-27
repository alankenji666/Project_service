const axios = require('axios');

async function testGerarNfe(idPedido, peso) {
    try {
        const tokenRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/');
        // I can't just get the token directly if auth is not exposed.
        console.log("I should test it from within the backend code.");
    } catch (e) {
        console.error(e.message);
    }
}
