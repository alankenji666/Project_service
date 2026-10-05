const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// Atualiza ranges para ir até Z
js = js.replace(/range: `\$\{sheetName\}!A2:V`/g, "range: `${sheetName}!A2:Z`");
js = js.replace(/range: `\$\{sheetName\}!A2:U`/g, "range: `${sheetName}!A2:Z`");

// Substitui o bloco do GET map
const getMapRegex = /idNotaFiscal: row\[11\].*?transportadora: row\[17\] \|\| '' \/\/ Era 20, recuou 3/s;
const newGetMap = `idNotaFiscal: row[11] || '',
            observacao: row[12] || '',
            itens: row[13] || '',
            avaliacao: row[14] || '',
            equipamento: row[15] || '',
            transportadora: row[16] || '',
            volume: row[17] || '',
            pesoTotal: row[18] || '',
            cep: row[19] || '',
            cidade: row[20] || '',
            estado: row[21] || '',
            bairro: row[22] || '',
            endereco: row[23] || '',
            numero: row[24] || '',
            complemento: row[25] || ''`;
js = js.replace(getMapRegex, newGetMap);

// Substitui o array de criação no POST
const createRegex = /const novaLinha = \[[\s\S]*?equipamento \|\| '' \/\/ Equipamento\s*\];/;
const newCreate = `const novaLinha = [
                '', // Conferido (A)
                idGerado, // ID Pedido (B)
                idGerado, // Número (C)
                '', // Número Loja (D)
                data || new Date().toISOString().split('T')[0], // Data (E)
                data || new Date().toISOString().split('T')[0], // Data Saída (F)
                situacao || 'EM ABERTO', // Situação (G)
                totalProdutos || '0,00', // Total Produtos (H)
                totalPedido || '0,00', // Total Pedido (I)
                vendedor || 'Sistema', // Vendedor (J)
                loja || 'Fábrica', // Loja (K)
                idNotaFiscal || '', // L
                observacao || '', // M
                itens || '', // N (Itens do orcamento)
                avaliacao || '', // O (Observacao 2)
                equipamento || '', // P
                req.body.transportadora || '', // Q
                req.body.volume || '', // R
                req.body.pesoTotal || '', // S
                req.body.cep || '', // T
                req.body.cidade || '', // U
                req.body.estado || '', // V
                req.body.bairro || '', // W
                req.body.endereco || '', // X
                req.body.numero || '', // Y
                req.body.complemento || '' // Z
            ];`;
js = js.replace(createRegex, newCreate);

// Substitui os adds de update no POST /update
const updateRegex = /\/\/ Colunas recuadas em 3 posições pois H, I, J foram deletadas da planilha\s*addUpdate\('L', idNotaFiscal\);[\s\S]*?addUpdate\('R', transportadora\);/;
const newUpdate = `addUpdate('L', idNotaFiscal);
            addUpdate('M', observacao);
            addUpdate('N', itens);
            addUpdate('O', avaliacao);
            addUpdate('P', equipamento);
            addUpdate('Q', req.body.transportadora);
            addUpdate('R', req.body.volume);
            addUpdate('S', req.body.pesoTotal);
            addUpdate('T', req.body.cep);
            addUpdate('U', req.body.cidade);
            addUpdate('V', req.body.estado);
            addUpdate('W', req.body.bairro);
            addUpdate('X', req.body.endereco);
            addUpdate('Y', req.body.numero);
            addUpdate('Z', req.body.complemento);`;
js = js.replace(updateRegex, newUpdate);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Backend configurado com as colunas novas A até Z!');
