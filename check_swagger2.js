const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/BlingERP/ApiV3/master/swagger.json', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const swagger = JSON.parse(data);
        console.log("POST /nfes schema:", JSON.stringify(swagger.paths['/nfes'].post.requestBody.content['application/json'].schema, null, 2));
    });
});
