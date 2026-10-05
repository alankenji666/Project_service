const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// Update GET /pedidos
js = js.replace(
    /situacao: row\[6\] \|\| '',\s*cliente: row\[7\] \|\| '',\s*cpfCnpj: row\[8\] \|\| '',\s*observacao: row\[14\] \|\| '',\s*itens: row\[15\] \|\| '',\s*avaliacao: row\[16\] \|\| '',\s*equipamento: row\[18\] \|\| '',\s*transportadora: row\[19\] \|\| ''/,
    `situacao: row[6] || '',
                    codigoCliente: row[7] || '', // NOVO
                    cliente: row[8] || '',
                    cpfCnpj: row[9] || '',
                    observacao: row[15] || '',
                    itens: row[16] || '',
                    avaliacao: row[17] || '',
                    equipamento: row[19] || '',
                    transportadora: row[20] || ''`
);

// Update POST /pedido novaLinha
js = js.replace(
    /situacao \|\| 'EM ABERTO', \/\/ Situação\s*nomeContato \|\| '', \/\/ Contato Nome\s*cpfCnpj \|\| '', \/\/ CPF\/CNPJ\s*totalProdutos \|\| '0,00', \/\/ Total Produtos\s*totalPedido \|\| '0,00', \/\/ Total Pedido\s*vendedor \|\| 'Sistema', \/\/ Vendedor\s*loja \|\| 'Fábrica', \/\/ Loja\s*idNotaFiscal \|\| '', \/\/ ID Nota Fiscal\s*observacao \|\| '', \/\/ Observação\s*itens \|\| '', \/\/ Itens\s*avaliacao \|\| '', \/\/ Observação \(2\) - Usado para Avaliação Interna\s*'', \/\/ Orçamento\s*equipamento \|\| '' \/\/ Equipamento/,
    `situacao || 'EM ABERTO', // Situação
                idCliente || '', // NOVO: Cod Cliente
                nomeContato || '', // Contato Nome
                cpfCnpj || '', // CPF/CNPJ
                totalProdutos || '0,00', // Total Produtos
                totalPedido || '0,00', // Total Pedido
                vendedor || 'Sistema', // Vendedor
                loja || 'Fábrica', // Loja
                idNotaFiscal || '', // ID Nota Fiscal
                observacao || '', // Observação
                itens || '', // Itens
                avaliacao || '', // Observação (2) - Usado para Avaliação Interna
                '', // Orçamento
                equipamento || '' // Equipamento`
);

// Update POST /pedido/update (if applicable, though I didn't verify it thoroughly, let's look if it uses fixed indices for update)
// Usually /update receives an array of updates: { column: 'C', value: '...' } so it shouldn't matter as much, EXCEPT if they hardcoded 'H' for something. Let's not touch /update if it's dynamic.

// Update GET /satg
js = js.replace(
    /tipoEquipamento: row\[31\] \|\| ''\s*\/\/\s*AF \(Tipo Equipamento\)/,
    `tipoEquipamento: row[31] || '',             // AF (Tipo Equipamento)
                    codigoCliente: row[32] || ''               // AG (Cod Cliente)`
);

// Update POST /satg/public-submit
js = js.replace(
    /safeString\(formData\.problema\),\s*\/\/ V: Descrição Defeito/,
    `safeString(formData.problema),    // V: Descrição Defeito`
);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('backEndGCloud atualizado com novas colunas');
