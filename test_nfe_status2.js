const axios = require('axios');

async function test() {
    try {
        const getRes = await axios.get('https://bling-proxy-api-255108547424.southamerica-east1.run.app/nfe/26352935371');
        const nota = getRes.data.data;
        console.log("Nota fetched via proxy:");
        console.log("ID:", nota.id);
        console.log("Situação:", nota.situacao);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
