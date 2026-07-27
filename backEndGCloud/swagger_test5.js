const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        
        // Procurar nfes
        if (response.data.paths['/nfes'] && response.data.paths['/nfes'].post) {
            const schemaRef = response.data.paths['/nfes'].post.requestBody.content['application/json'].schema.$ref;
            const schemaName = schemaRef.split('/').pop();
            const schema = response.data.components.schemas[schemaName];
            console.log("Schema POST /nfes:", JSON.stringify(schema, null, 2));
            
            // Check if schema has properties
            if (schema.properties) {
                console.log("Has documentoVinculado?", !!schema.properties.documentoVinculado);
                console.log("Has pedidosVenda?", !!schema.properties.pedidosVenda);
                console.log("Has pedido?", !!schema.properties.pedido);
                if (schema.properties.documentoVinculado) {
                    console.log("documentoVinculado structure:", JSON.stringify(schema.properties.documentoVinculado, null, 2));
                }
            }
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
