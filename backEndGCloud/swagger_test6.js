const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        
        console.log("Keys in paths related to nfe:", Object.keys(response.data.paths).filter(p => p.includes('nfe')));
        
        const path = Object.keys(response.data.paths).find(p => p.includes('/nfes'));
        if (path && response.data.paths[path].post) {
            const schemaRef = response.data.paths[path].post.requestBody.content['application/json'].schema.$ref;
            const schemaName = schemaRef.split('/').pop();
            const schema = response.data.components.schemas[schemaName];
            console.log("Has documentoVinculado?", !!schema.properties.documentoVinculado);
            if (schema.properties.documentoVinculado) {
                console.log("documentoVinculado:", JSON.stringify(schema.properties.documentoVinculado, null, 2));
            }
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
