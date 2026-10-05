const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// Add idCliente to destructuring in /pedido/update
js = js.replace(
    /const \{\s*idPedido,\s*\/\/\s*Obrigatório para saber qual linha atualizar\s*numero,\s*situacao,\s*nomeContato,/,
    `const {
                idPedido, // Obrigatório para saber qual linha atualizar
                numero,
                situacao,
                idCliente, // NOVO
                nomeContato,`
);

// Update letters in /pedido/update
js = js.replace(
    /addUpdate\('C', numero\);\s*addUpdate\('G', situacao\);\s*addUpdate\('H', nomeContato\);\s*addUpdate\('I', cpfCnpj\);\s*addUpdate\('N', idNotaFiscal\);\s*addUpdate\('O', observacao\);\s*addUpdate\('P', itens\);\s*addUpdate\('Q', avaliacao\);\s*addUpdate\('S', equipamento\);\s*addUpdate\('T', transportadora\);/,
    `addUpdate('C', numero);
            addUpdate('G', situacao);
            addUpdate('H', idCliente); // NOVO Cod Cliente
            addUpdate('I', nomeContato);
            addUpdate('J', cpfCnpj);
            addUpdate('O', idNotaFiscal);
            addUpdate('P', observacao);
            addUpdate('Q', itens);
            addUpdate('R', avaliacao);
            addUpdate('T', equipamento);
            addUpdate('U', transportadora);`
);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Update letters ajustado!');
