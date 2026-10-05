const fs = require('fs');
let code = fs.readFileSync('backEndGCloud/index.js', 'utf8');

// For Terceiros
const target1 = `item.quantidade,   // F - Quantidade Pedido
                        'PENDENTE',        // H - Situação
            formattedDate,     // I - Data Pedido
            '',                // J - Dias Corridos
            '',                // K - Observação
            item.prazoEntrega || '15'               // L - Prazo Entrega`;

const replacement1 = `item.quantidade,   // F - Quantidade Pedido
            '',                // G - Quantidade Recebida
            'PENDENTE',        // H - Situação
            formattedDate,     // I - Data Pedido
            '',                // J - Dias Corridos
            '',                // K - Observação
            item.prazoEntrega || '15' // L - Prazo Entrega`;

// For Fabrica
const target2 = `item.quantidade,   // F - Quantidade Pedido
            'PENDENTE',        // G - Situação
            formattedDate,     // H - Data Pedido
            '',                // I - Dias Corridos
            '',                // J - Observação
            item.prazoEntrega || '15' // K - Prazo Entrega`;

const replacement2 = `item.quantidade,   // F - Quantidade Pedido
            '',                // G - Quantidade Recebida
            'PENDENTE',        // H - Situação
            formattedDate,     // I - Data Pedido
            '',                // J - Dias Corridos
            '',                // K - Observação
            item.prazoEntrega || '15' // L - Prazo Entrega`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('backEndGCloud/index.js', code);
console.log('Array corrigido');
