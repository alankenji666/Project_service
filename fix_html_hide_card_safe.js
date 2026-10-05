const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div id="btn-show-garantia-pedidos" class="[^"]+">/;
html = html.replace(regex, '<div id="btn-show-garantia-pedidos" style="display: none !important;">');

fs.writeFileSync('index.html', html);
console.log('Card removido permanentemente com display none!');
