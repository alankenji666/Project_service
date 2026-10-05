const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

js = js.replace(/<select class="fabrica-status-select/g, '<select data-quantidade="${item.quantidadePedido}" class="fabrica-status-select');

js = js.replace(/quantidade: event\.target\.closest\('tr'\)\.querySelector\('td:nth-child\(5\)'\)\?\.textContent\?\.trim\(\) \|\| 1/g, "quantidade: event.target.dataset.quantidade || 1");

fs.writeFileSync('js/main.js', js);
console.log('Quantidade extraída do dataset!');
