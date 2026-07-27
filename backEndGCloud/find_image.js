const axios = require('axios');

async function findProductWithImage() {
    try {
        const tokenResponse = await axios.get('https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec');
        const accessToken = tokenResponse.data.access_token;
        
        let getBlingRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos?pagina=1&limite=50`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        for (let p of getBlingRes.data.data) {
            let fullRes = await axios.get(`https://api.bling.com.br/Api/v3/produtos/${p.id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            let midia = fullRes.data.data.midia;
            if (midia && midia.imagens && (midia.imagens.internas.length > 0 || midia.imagens.externas.length > 0)) {
                console.log("Found product with image:", p.id, p.nome);
                console.log(JSON.stringify(midia, null, 2));
                return;
            }
        }
        console.log("No products with images found in first 50.");
    } catch (e) {
        console.error(e.message);
    }
}

findProductWithImage();
