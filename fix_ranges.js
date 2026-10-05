const fs = require('fs');
let js = fs.readFileSync('backEndGCloud/garantia.js', 'utf8');

// Update SatG range
js = js.replace(/range: `\$\{sheetName\}!A2:AF` \/\/ At AF \(coluna 32\)/, "range: `${sheetName}!A2:AG` // Até AG (coluna 33)");
js = js.replace(/range: `\$\{sheetName\}!A2:AF` \/\/ Até AF \(coluna 32\)/, "range: `${sheetName}!A2:AG` // Até AG (coluna 33)");

// Update OrcamentosGarantia range
js = js.replace(/range: `\$\{sheetName\}!A2:T` \/\/ Busca at a coluna T \(Transportadora\)/, "range: `${sheetName}!A2:U` // Busca até a coluna U (Transportadora agora está em U)");
js = js.replace(/range: `\$\{sheetName\}!A2:T` \/\/ Busca até a coluna T \(Transportadora\)/, "range: `${sheetName}!A2:U` // Busca até a coluna U (Transportadora agora está em U)");

fs.writeFileSync('backEndGCloud/garantia.js', js);
console.log('backEndGCloud atualizado ranges');
