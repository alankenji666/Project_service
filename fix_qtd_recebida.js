const fs = require('fs');

let backend = fs.readFileSync('backEndGCloud/index.js', 'utf8');

// 1. Restaurar a coluna Quantidade Recebido no payload de / e /launch-fabrica
// Em /launch
backend = backend.replace(/item\.quantidade,   \/\/ F - Quantidade Pedido\s*'PENDENTE',        \/\/ G - Situação/g, 
`item.quantidade,   // F - Quantidade Pedido
            '',                // G - Quantidade Recebido (vazio ao lançar)
            'PENDENTE',        // H - Situação`);

// Corrigir os comentários H, I, J, K para refletir o +1
backend = backend.replace(/\/\/ H - Data Pedido/g, '// I - Data Pedido');
backend = backend.replace(/\/\/ I - Dias Corridos/g, '// J - Dias Corridos');
backend = backend.replace(/\/\/ J - Observação/g, '// K - Observação');
backend = backend.replace(/\/\/ K - Prazo Entrega/g, '// L - Prazo Entrega');

// 2. Atualizar /update-order-status para capturar e gravar 'quantidadeMovimento' se a coluna existir
const updateOrderRegex = /const diasCorridosColIndex = headers\.indexOf\('dias corridos'\);/;
backend = backend.replace(updateOrderRegex, `const diasCorridosColIndex = headers.indexOf('dias corridos');
        const qtdRecebidaColIndex = headers.indexOf('quantidade recebida') !== -1 ? headers.indexOf('quantidade recebida') : headers.indexOf('quantidade recebido');`);

const updateOrderExtractRegex = /const { orderCode, codigoService, newStatus, requisitionType, diasCorridos } = req\.body;/;
backend = backend.replace(updateOrderExtractRegex, `const { orderCode, codigoService, newStatus, requisitionType, diasCorridos, quantidadeMovimento } = req.body;`);

const pushUpdatesRegex = /if \(typeof diasCorridos !== 'undefined' && diasCorridosColIndex !== -1\) {/g;
backend = backend.replace(pushUpdatesRegex, `if (typeof quantidadeMovimento !== 'undefined' && qtdRecebidaColIndex !== -1) {
            const qtdRecebidaRange = \`\${sheetName}!\${String.fromCharCode(65 + qtdRecebidaColIndex)}\${rowIndexToUpdate + 1}\`;
            updates.push({
                range: qtdRecebidaRange,
                values: [[quantidadeMovimento]]
            });
        }

        if (typeof diasCorridos !== 'undefined' && diasCorridosColIndex !== -1) {`);

fs.writeFileSync('backEndGCloud/index.js', backend);
console.log('Backend restaurado com suporte a Quantidade Recebida!');
