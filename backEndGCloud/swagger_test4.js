const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/api/swagger.json');
        const paths = response.data.paths;
        
        // Procurar o POST /nfes
        if (paths['/nfes']) {
            const postNfes = paths['/nfes'].post;
            const schemaRef = postNfes.requestBody.content['application/json'].schema.$ref;
            const schemaName = schemaRef.split('/').pop();
            const schema = response.data.components.schemas[schemaName];
            console.log("Schema POST /nfes:", JSON.stringify(schema, null, 2));
        } else {
            console.log("POST /nfes not found");
        }

    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
