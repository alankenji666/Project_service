const axios = require('axios');

async function checkMidia() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        let getBlingRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/16676777872`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log("Midia:", JSON.stringify(getBlingRes.data.data.midia, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}

checkMidia();
