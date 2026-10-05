const fs = require('fs');
let code = fs.readFileSync('backEndGCloud/index.js', 'utf8');

const targetRegex = /item\.quantidade,   \/\/ F - Quantidade Pedido\s*(?:''\,\s*\/\/ G - Quantidade Recebida\s*)?'PENDENTE',        \/\/ H - Situação\s*formattedDate,     \/\/ I - Data Pedido\s*'',                \/\/ J - Dias Corridos\s*'',                \/\/ K - Observação\s*item\.prazoEntrega \|\| '15'\s*\/\/ L - Prazo Entrega/g;

code = code.replace(/item\.quantidade,   \/\/ F - Quantidade Pedido[\s\S]*?item\.prazoEntrega \|\| '15'\s*\/\/ L - Prazo Entrega/g, 
`item.quantidade,   // F - Quantidade Pedido
            '',                // G - Quantidade Recebida
            'PENDENTE',        // H - Situação
            formattedDate,     // I - Data Pedido
            '',                // J - Dias Corridos
            '',                // K - Observação
            item.prazoEntrega || '15' // L - Prazo Entrega`);

fs.writeFileSync('backEndGCloud/index.js', code);
console.log('Fixed brute force');
