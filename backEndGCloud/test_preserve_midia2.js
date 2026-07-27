const axios = require('axios');

async function testPreserveMidia2() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        // 1. Update the existing product we created (ID 16681136610)
        // Wait, it couldn't be deleted, so it still exists! But it has no images now.
        // Let's create another one.
        const newProduct = {
            nome: "Produto Teste Midia 2",
            tipo: "P",
            codigo: "TESTE-MIDIA-456",
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
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        let getRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log("Midia after create:", JSON.stringify(getRes.data.data.midia, null, 2));
        
        // Update product WITHOUT deleting midia
        const { id, dataCriacao, dataAlteracao, ...payloadKeep } = getRes.data.data;
        payloadKeep.pesoBruto = 3.0;
        payloadKeep.pesoLiquido = 3.0;
        
        console.log("Updating product with midia PRESERVED (as is)...");
        let updateRes = await axios.put(`https://api.bling.com.br/Api/v3/produtos/${productId}`, payloadKeep, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let getRes2 = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Midia after update (kept midia):", JSON.stringify(getRes2.data.data.midia, null, 2));
        
    } catch (e) {
        if (e.response) {
            console.error("API Error:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

testPreserveMidia2();
