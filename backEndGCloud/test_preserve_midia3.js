const axios = require('axios');

async function testPreserveMidia3() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        const newProduct = {
            nome: "Produto Teste Midia 3",
            tipo: "P",
            codigo: "TESTE-MIDIA-789",
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
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        let getRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const originalMidia = getRes.data.data.midia;
        console.log("Midia after create:", JSON.stringify(originalMidia, null, 2));
        
        const { id, dataCriacao, dataAlteracao, ...payloadUpdate } = getRes.data.data;
        payloadUpdate.pesoBruto = 4.0;
        payloadUpdate.pesoLiquido = 4.0;
        
        // NOW map existing URLs to imagensURL
        const existingLinks = [];
        if (originalMidia && originalMidia.imagens) {
            if (originalMidia.imagens.externas) {
                existingLinks.push(...originalMidia.imagens.externas.map(img => img.link));
            }
            if (originalMidia.imagens.internas) {
                // For internal images, linkOriginal might be present, else we fall back to link or linkMiniatura
                existingLinks.push(...originalMidia.imagens.internas.map(img => img.linkOriginal || img.link));
            }
        }
        
        const validLinks = existingLinks.filter(url => url && url.startsWith('http'));
        
        if (validLinks.length > 0) {
            payloadUpdate.midia = {
                imagens: {
                    imagensURL: validLinks.map(link => ({ link }))
                }
            };
        } else {
            delete payloadUpdate.midia;
        }
        
        console.log("Payload midia being sent:", JSON.stringify(payloadUpdate.midia, null, 2));
        
        let updateRes = await axios.put(`https://api.bling.com.br/Api/v3/produtos/${productId}`, payloadUpdate, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let getRes2 = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Midia after update (mapped to imagensURL):", JSON.stringify(getRes2.data.data.midia, null, 2));
        
    } catch (e) {
        if (e.response) {
            console.error("API Error:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

testPreserveMidia3();
