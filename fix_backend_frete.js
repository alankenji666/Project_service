const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// 1. Atualizar range de A2:Z para A2:AA
js = js.replace(/range: `\$\{sheetName\}!A2:Z`/g, "range: `${sheetName}!A2:AA`");

// 2. Atualizar GET
const getMapRegex = /complemento: row\[25\] \|\| ''/;
const newGetMap = `complemento: row[25] || '',
                    valorFrete: row[26] || ''`;
js = js.replace(getMapRegex, newGetMap);

// 3. Atualizar Create (POST)
const createRegex = /req\.body\.complemento \|\| '' \/\/ Z/;
const newCreate = `req.body.complemento || '', // Z
                req.body.valorFrete || '' // AA`;
js = js.replace(createRegex, newCreate);

// 4. Atualizar Update (POST /update)
const updateRegex = /addUpdate\('Z', req\.body\.complemento\);/;
const newUpdate = `addUpdate('Z', req.body.complemento);
            addUpdate('AA', req.body.valorFrete);`;
js = js.replace(updateRegex, newUpdate);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Backend configurado com a coluna AA (Valor Frete)!');
