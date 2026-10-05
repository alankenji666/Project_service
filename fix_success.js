const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace(/if \(data\.success\) \{/g, 'if (data.success || !data.error) {');

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Fix applied to gerenciarGarantia.js');
