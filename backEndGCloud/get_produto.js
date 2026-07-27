const axios = require('axios');

async function getProduct() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        const getBlingRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/16676777872`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log(JSON.stringify(getBlingRes.data.data, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}

getProduct();
