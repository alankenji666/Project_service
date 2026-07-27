const axios = require('axios');

async function updateProduct() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        // Let's first fetch it to get all fields
        let getBlingRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/16676777872`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let productData = getBlingRes.data.data;
        const { id, dataCriacao, dataAlteracao, ...payload } = productData;
        
        // Update both to a specific test value
        payload.pesoBruto = 81.5;
        payload.pesoLiquido = 81.5;
        
        // Clean media just like our code does
        delete payload.midia;
        
        console.log("Sending Payload:", JSON.stringify({
            pesoBruto: payload.pesoBruto,
            pesoLiquido: payload.pesoLiquido
        }));

        let putRes = await axios.put(`https://api.bling.com.br/Api/v3/produtos/16676777872`, payload, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log("Response:", putRes.status);
        
        // Verify
        let checkRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/16676777872`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("After update:", checkRes.data.data.pesoLiquido, checkRes.data.data.pesoBruto);
        
    } catch (e) {
        if (e.response) {
            console.error(JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

updateProduct();
