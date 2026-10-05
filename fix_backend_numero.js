const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// 1. Fix GET mapping
const getMapRegex = /observacao: row\[12\] \|\| '', \/\/ Era 15, recuou 3[\s\S]*?transportadora: row\[17\] \|\| '' \/\/ Era 20, recuou 3/;
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
                    numeroEndereco: row[24] || '',
                    complemento: row[25] || ''`;
js = js.replace(getMapRegex, newGetMap);

// 2. Fix POST Create mapping
// It currently has req.body.numero
js = js.replace(/req\.body\.numero \|\| '', \/\/ Y/, "req.body.numeroEndereco || '', // Y");

// 3. Fix POST Update mapping
// It currently has addUpdate('Y', req.body.numero);
js = js.replace(/addUpdate\('Y', req\.body\.numero\);/, "addUpdate('Y', req.body.numeroEndereco);");

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Backend configurado com as colunas novas (numeroEndereco)!');
