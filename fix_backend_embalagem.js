const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// 1. Update range to AB
js = js.replace(/range: `\$\{sheetName\}!A2:AA`/g, "range: `${sheetName}!A2:AB`");

// 2. Update GET mapping
const getMapRegex = /valorFrete: row\[26\] \|\| ''/;
const newGetMap = `valorFrete: row[26] || '',
                    embalagem: row[27] || ''`;
js = js.replace(getMapRegex, newGetMap);

// 3. Update POST (Create)
const createRegex = /req\.body\.valorFrete \|\| '' \/\/ AA/;
const newCreate = `req.body.valorFrete || '', // AA
                req.body.embalagem || '' // AB`;
js = js.replace(createRegex, newCreate);

// 4. Update POST (Update)
const updateRegex = /addUpdate\('AA', req\.body\.valorFrete\);/;
const newUpdate = `addUpdate('AA', req.body.valorFrete);
            addUpdate('AB', req.body.embalagem);`;
js = js.replace(updateRegex, newUpdate);

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('Backend configurado para suportar coluna AB (Embalagem)!');
