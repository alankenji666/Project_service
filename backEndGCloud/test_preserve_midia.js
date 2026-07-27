const axios = require('axios');

async function testPreserveMidia() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        // Let's create a test product
        const newProduct = {
            nome: "Produto Teste Midia",
            tipo: "P",
            codigo: "TESTE-MIDIA-123",
            situacao: "A",
            formato: "S",
            pesoLiquido: 1.0,
            pesoBruto: 1.0,
            midia: {
                imagens: {
                    imagensURL: [
                        { link: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" }
                    ]
                }
            }
        };

        console.log("Creating product...");
        let createRes = await axios.post(`https://api.bling.com.br/Api/v3/produtos`, newProduct, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const productId = createRes.data.data.id;
        console.log("Created Product ID:", productId);
        
        // Wait a bit for Bling to process the image
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get the product to see its internal images
        let getRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const midiaAfterCreate = getRes.data.data.midia;
        console.log("Midia after create:", JSON.stringify(midiaAfterCreate, null, 2));
        
        // Now update the product weight, but do what I did (delete midia)
        const { id, dataCriacao, dataAlteracao, ...payloadDelete } = getRes.data.data;
        payloadDelete.pesoBruto = 2.0;
        payloadDelete.pesoLiquido = 2.0;
        delete payloadDelete.midia;
        
        console.log("Updating product with midia DELETED...");
        let updateRes = await axios.put(`https://api.bling.com.br/Api/v3/produtos/${productId}`, payloadDelete, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        // Check midia again
        let getRes2 = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Midia after update (delete midia):", JSON.stringify(getRes2.data.data.midia, null, 2));
        
        // Clean up
        await axios.delete(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Deleted test product.");
        
    } catch (e) {
        if (e.response) {
            console.error("API Error:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

testPreserveMidia();
