const fs = require('fs');

let backend = fs.readFileSync('backEndGCloud/index.js', 'utf8');

// For both / and /launch-fabrica, the block is similar.
// I will use regex replacement to remove the "Quantidade Recebido" row and shift the comments.

backend = backend.replace(/item\.quantidade,   \/\/ F - Quantidade Pedido\s*'',                \/\/ G - Quantidade Recebido \(vazio ao lançar\)\s*'PENDENTE',        \/\/ H - Situação\s*formattedDate,     \/\/ I - Data Pedido\s*'',                \/\/ J - Dias Corridos\s*'',                \/\/ K - Observação\s*'15'\s*\/\/ L - Prazo Entrega/g,
`item.quantidade,   // F - Quantidade Pedido
            'PENDENTE',        // G - Situação
            formattedDate,     // H - Data Pedido
            '',                // I - Dias Corridos
            '',                // J - Observação
            item.prazoEntrega || '15'               // K - Prazo Entrega`);

backend = backend.replace(/item\.quantidade,   \/\/ F - Quantidade Pedido\s*'',                \/\/ G - Quantidade Recebido \(vazio ao lanar\)\s*'PENDENTE',        \/\/ H - Situao\s*formattedDate,     \/\/ I - Data Pedido\s*'',                \/\/ J - Dias Corridos\s*'',                \/\/ K - Observao\s*item\.prazoEntrega \|\| '15' \/\/ L - Prazo Entrega/g,
`item.quantidade,   // F - Quantidade Pedido
            'PENDENTE',        // G - Situação
            formattedDate,     // H - Data Pedido
            '',                // I - Dias Corridos
            '',                // J - Observação
            item.prazoEntrega || '15' // K - Prazo Entrega`);

// In case encoding characters are messed up, let's use a simpler match:
const target1 = `item.quantidade,   // F - Quantidade Pedido
            '',                // G - Quantidade Recebido (vazio ao lançar)
            'PENDENTE',        // H - Situação
            formattedDate,     // I - Data Pedido
            '',                // J - Dias Corridos
            '',                // K - Observação
            '15'               // L - Prazo Entrega`;

const replacement1 = `item.quantidade,   // F - Quantidade Pedido
            'PENDENTE',        // G - Situação
            formattedDate,     // H - Data Pedido
            '',                // I - Dias Corridos
            '',                // J - Observação
            item.prazoEntrega || '15'               // K - Prazo Entrega`;

fs.writeFileSync('backEndGCloud/index.js', backend);
