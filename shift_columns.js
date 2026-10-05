const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// 1. Corrigir range no router.get('/pedidos')
js = js.replace(/range: `\$\{sheetName\}!A2:U`/, "range: `${sheetName}!A2:V`");

// 2. Corrigir índices no GET /pedidos
// Antes: observacao: row[15], itens: row[16], avaliacao: row[17], equipamento: row[19], transportadora: row[20]
js = js.replace(/observacao: row\[15\] \|\| '',/, "observacao: row[12] || '', // Era 15, recuou 3");
js = js.replace(/itens: row\[16\] \|\| '',/, "itens: row[13] || '', // Era 16, recuou 3");
js = js.replace(/avaliacao: row\[17\] \|\| '',/, "avaliacao: row[14] || '', // Era 17, recuou 3");
js = js.replace(/equipamento: row\[19\] \|\| '',/, "equipamento: row[16] || '', // Era 19, recuou 3");
js = js.replace(/transportadora: row\[20\] \|\| ''/, "transportadora: row[17] || '' // Era 20, recuou 3");

// 3. Remover strings vazias do POST /pedido (criação)
js = js.replace(/situacao \|\| 'EM ABERTO', \/\/ Situação\s*'', \/\/ H: Cod Cliente \(Removido p\/ evitar duplicidade com SatG\)\s*'', \/\/ I: Contato Nome \(Removido p\/ evitar duplicidade\)\s*'', \/\/ J: CPF\/CNPJ \(Removido p\/ evitar duplicidade\)\s*totalProdutos/, "situacao || 'EM ABERTO', // Situação\n                totalProdutos");

// 4. Corrigir colunas do POST /pedido/update (deslocar -3)
js = js.replace(/\/\/ Colunas H, I, J removidas \(Dados do cliente agora vivem apenas no SatG\)\s*addUpdate\('O', idNotaFiscal\);\s*addUpdate\('P', observacao\);\s*addUpdate\('Q', itens\);\s*addUpdate\('R', avaliacao\);\s*addUpdate\('T', equipamento\);\s*addUpdate\('U', transportadora\);/, `// Colunas recuadas em 3 posições pois H, I, J foram deletadas da planilha
            addUpdate('L', idNotaFiscal);
            addUpdate('M', observacao);
            addUpdate('N', itens);
            addUpdate('O', avaliacao);
            addUpdate('Q', equipamento);
            addUpdate('R', transportadora);`);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Garantia backend indices ajustados!');
