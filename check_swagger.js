const fs = require('fs');

async function getSwagger() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/BlingERP/ApiV3/master/swagger.json');
        const swagger = await response.json();
        const paths = Object.keys(swagger.paths).filter(p => p.includes('/nfes'));
        console.log("Paths containing /nfes:", paths);
        
        if (swagger.paths['/nfes/{idNotaFiscal}']) {
            console.log("Methods for /nfes/{id}:", Object.keys(swagger.paths['/nfes/{idNotaFiscal}']));
            if (swagger.paths['/nfes/{idNotaFiscal}'].put) {
                console.log("PUT /nfes/{id} params:", swagger.paths['/nfes/{idNotaFiscal}'].put.parameters);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
getSwagger();
