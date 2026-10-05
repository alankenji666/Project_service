const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace(/            let satgTitleHTML = '';\r?\n            \/\/ Buscar com mais flexibilidade \(com ou sem GAR-\)\r?\n            const cleanRef = refStr\.replace\('GAR-', ''\);\r?\n            const satgAssociado = _satgData\.find\(s => \{\r?\n                const sId = String\(s\.idPedido \|\| ''\)\.replace\('GAR-', ''\);\r?\n                return sId === cleanRef && sId !== '';\r?\n            \}\);\r?\n            if \(satgAssociado && satgAssociado\.codigo\) \{/, `            let satgTitleHTML = '';\n            if (satgAssociado && satgAssociado.codigo) {`);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Duplicate cleaned!');
