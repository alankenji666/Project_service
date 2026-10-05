const fs = require('fs');
let c = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');
c = c.replace(/window\.API_BASE_URL \+ '\/garantia\/transportadoras'/g, "window.API_BASE_URL + '/transportadoras'");
fs.writeFileSync('js/modulos/gerenciarGarantia.js', c);
console.log('Fixed URL');
