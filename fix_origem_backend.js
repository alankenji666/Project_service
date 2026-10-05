const fs = require('fs');
let code = fs.readFileSync('backEndGCloud/pedidos.js', 'utf8');

// 1. Extrair 'origem' de req.body
code = code.replace(/const \{ pedidoId, itemCodigo, newStatus, itemIndex, newDescription, responsavel, numeroPedido, quantidade \} = req\.body;/, 
                    'const { pedidoId, itemCodigo, newStatus, itemIndex, newDescription, responsavel, numeroPedido, quantidade, origem } = req.body;');

// 2. Adicionar 'origem' se não existir no header da planilha existente
code = code.replace(/if \(pHeadersNorm\.indexOf\('responsavel'\) === -1\) \{ pHeadersRaw\.push\('responsavel'\); pHeadersNorm\.push\('responsavel'\); changed = true; \}/, 
                    "if (pHeadersNorm.indexOf('responsavel') === -1) { pHeadersRaw.push('responsavel'); pHeadersNorm.push('responsavel'); changed = true; }\n                if (pHeadersNorm.indexOf('origem') === -1) { pHeadersRaw.push('Origem'); pHeadersNorm.push('origem'); changed = true; }");

// 3. Adicionar 'Origem' no pHeadersRaw default (para planilhas novas)
code = code.replace(/pHeadersRaw = \['pedido_id', 'sku', 'item_index', 'status', 'quantidade', 'data', 'descricao', 'responsavel'\];/g, 
                    "pHeadersRaw = ['pedido_id', 'sku', 'item_index', 'status', 'quantidade', 'data', 'descricao', 'responsavel', 'Origem'];");
code = code.replace(/pHeadersNorm = \['pedido_id', 'sku', 'item_index', 'status', 'quantidade', 'data', 'descricao', 'responsavel'\];/g, 
                    "pHeadersNorm = ['pedido_id', 'sku', 'item_index', 'status', 'quantidade', 'data', 'descricao', 'responsavel', 'origem'];");

// 4. Encontrar index de origem
code = code.replace(/const hResp = pHeadersNorm\.indexOf\('responsavel'\);/, 
                    "const hResp = pHeadersNorm.indexOf('responsavel');\n            const hOrigem = pHeadersNorm.indexOf('origem');");

// 5. Definir finalOrigem
code = code.replace(/let finalDate = dataPedido;/, 
                    "let finalDate = dataPedido;\n            let finalOrigem = origem;");

// 6. Tratar foundIdx para manter origem existente
code = code.replace(/if \(finalDate === undefined && hDate !== -1\) finalDate = pRows\[foundIdx\]\[hDate\];/, 
                    "if (finalDate === undefined && hDate !== -1) finalDate = pRows[foundIdx][hDate];\n                if (finalOrigem === undefined && hOrigem !== -1) finalOrigem = pRows[foundIdx][hOrigem];");

// 7. Popular rowData com finalOrigem
code = code.replace(/if \(hResp !== -1\) rowData\[hResp\] = finalResp \|\| '';/, 
                    "if (hResp !== -1) rowData[hResp] = finalResp || '';\n            if (hOrigem !== -1) rowData[hOrigem] = finalOrigem || '';");

fs.writeFileSync('backEndGCloud/pedidos.js', code);
console.log('Backend pedidos.js atualizado com suporte à coluna Origem');
