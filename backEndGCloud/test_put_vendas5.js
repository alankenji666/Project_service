const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://developer.bling.com.br/build/assets/openapi-D-189jcU.json');
        
        const path = response.data.paths['/pedidos/vendas/{idPedidoVenda}'];
        if (path && path.put) {
            const reqBody = path.put.requestBody.content['application/json'].schema.$ref;
            const schemaName = reqBody.split('/').pop();
            const schema = response.data.components.schemas[schemaName];
            
            console.log("PUT Schema properties:");
            if (schema.properties && schema.properties.parcelas) {
                console.log("Parcelas info:", JSON.stringify(schema.properties.parcelas, null, 2));
                const itemRef = schema.properties.parcelas.items.$ref;
                if (itemRef) {
                    const itemSchemaName = itemRef.split('/').pop();
                    console.log("Parcela Item Schema:", JSON.stringify(response.data.components.schemas[itemSchemaName], null, 2));
                }
            }
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
