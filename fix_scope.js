const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace(/const refStr = String\(idPedido\);/, `const refStr = String(idPedido);\n        const cleanRef = refStr.replace('GAR-', '');\n        const satgAssociado = _satgData.find(s => {\n            const sId = String(s.idPedido || '').replace('GAR-', '');\n            return sId === cleanRef && sId !== '';\n        });`);

js = js.replace(/const cleanRef = refStr\.replace\('GAR-', ''\);\s*const satgAssociado = _satgData\.find\(s => \{\s*const sId = String\(s\.idPedido \|\| ''\)\.replace\('GAR-', ''\);\s*return sId === cleanRef && sId !== '';\s*\}\);/, '');

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('cleanRef fixed!');
