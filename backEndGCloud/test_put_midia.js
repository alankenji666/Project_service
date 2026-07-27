const axios = require('axios');

async function testPutMidia() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        let getBlingRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/16676777872`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let productData = getBlingRes.data.data;
        const { id, dataCriacao, dataAlteracao, ...payload } = productData;
        
        // Let's modify a field
        payload.pesoBruto = 82;
        payload.pesoLiquido = 82;
        
        // Let's NOT delete midia and just pass it as is.
        // Wait, Bling GET response returns `midia`. Let's see if sending it back works.
        
        console.log("Sending payload with midia...");
        let putRes = await axios.put(`https://api.bling.com.br/Api/v3/produtos/16676777872`, payload, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log("Response:", putRes.status);
        
    } catch (e) {
        if (e.response) {
            console.error("API Error:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

testPutMidia();
