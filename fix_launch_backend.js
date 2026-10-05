const fs = require('fs');
let b = fs.readFileSync('backEndGCloud/index.js', 'utf8');

// Apenas em /launch-fabrica
const regexFabrica = /app\.post\('\/launch-fabrica'[\s\S]*?item\.quantidade,   \/\/ F - Quantidade Pedido\s*'',                \/\/ G - Quantidade Recebida\s*'PENDENTE',        \/\/ H - Situação/g;

b = b.replace(regexFabrica, (match) => match.replace("'PENDENTE',        // H - Situação", "'CRIADO',          // H - Situação"));

fs.writeFileSync('backEndGCloud/index.js', b);
console.log('Backend modificado');
