const fs = require('fs');
let code = fs.readFileSync('backEndGCloud/index.js', 'utf8');

const regexQuantidadeRecebido = /'',\s*\/\/\s*G\s*-\s*Quantidade Recebido[^\n]*\n/g;

code = code.replace(regexQuantidadeRecebido, '');

// Corrigir hardcoded 15 para item.prazoEntrega || '15' se necessário
code = code.replace(/'15'\s*\/\/\s*L\s*-\s*Prazo Entrega/g, "item.prazoEntrega || '15'               // L - Prazo Entrega");
code = code.replace(/'15'\s*\/\/\s*K\s*-\s*Prazo Entrega/g, "item.prazoEntrega || '15'               // K - Prazo Entrega");

fs.writeFileSync('backEndGCloud/index.js', code);
console.log('Fixed backend!');
