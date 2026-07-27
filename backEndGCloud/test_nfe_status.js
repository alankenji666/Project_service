const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/nfe/26348219256');
        const nota = getRes.data.data;
        console.log("Status da NFe:", nota.situacao);
    } catch (e) {
        console.log("GET Error:", e.message);
    }
}
test();
