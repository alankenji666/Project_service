const axios = require('axios');
const APPS_SCRIPT_TOKEN_URL = 'https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec';

async function testBling() {
    try {
        const tokenRes = await axios.get(APPS_SCRIPT_TOKEN_URL);
        const token = tokenRes.data.access_token || tokenRes.data.accessToken;
        
        const res = await axios.get('https://www.bling.com.br/Api/v3/contatos/18226177807', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(JSON.stringify(res.data.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
testBling();
