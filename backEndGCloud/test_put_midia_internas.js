const axios = require('axios');

async function testPutMidiaWithImages() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        // 1. Fetch product 16676777872
        let getBlingRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/16676777872`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let productData = getBlingRes.data.data;
        const { id, dataCriacao, dataAlteracao, ...payload } = productData;
        
        // 2. Mock some images in midia (just as if they existed)
        payload.midia = {
            imagens: {
                internas: [
                    {
                        link: "https://www.bling.com.br/imagens/miniatura.jpg",
                        ordem: 1,
                        anexo: { id: 12345678 }
                    }
                ],
                externas: [],
                imagensURL: []
            }
        };
        
        // 3. PUT it back
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

testPutMidiaWithImages();
