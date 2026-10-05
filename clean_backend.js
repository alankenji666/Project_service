const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// 1. Atualizar o POST /pedido (criação)
// Remove os dados do cliente e insere strings vazias para não duplicar, mantendo o alinhamento das colunas
js = js.replace(/idCliente \|\| '', \/\/ NOVO: Cod Cliente\s*nomeContato \|\| '', \/\/ Contato Nome\s*cpfCnpj \|\| '', \/\/ CPF\/CNPJ/, `'', // H: Cod Cliente (Removido p/ evitar duplicidade com SatG)\n                '', // I: Contato Nome (Removido p/ evitar duplicidade)\n                '', // J: CPF/CNPJ (Removido p/ evitar duplicidade)`);

// 2. Atualizar o POST /pedido/update
// Remove o update das colunas H, I e J
js = js.replace(/addUpdate\('H', idCliente\); \/\/ NOVO Cod Cliente\s*addUpdate\('I', nomeContato\);\s*addUpdate\('J', cpfCnpj\);/, `// Colunas H, I, J removidas (Dados do cliente agora vivem apenas no SatG)`);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Backend sem duplicidade atualizado!');
