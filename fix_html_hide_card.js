const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div id="btn-show-garantia-pedidos" class="([^"]+)">/;
html = html.replace(regex, (match, classes) => {
    return `<div id="btn-show-garantia-pedidos" class="${classes} hidden">`;
});

fs.writeFileSync('index.html', html);
console.log('Card ocultado com sucesso no index.html!');
