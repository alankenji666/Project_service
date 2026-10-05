const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Replace all occurrences of data format
const searchStr = `\${req.data ? req.data.split(' ')[0] : '-'}`;
const replaceStr = `\${req.data ? (req.data.includes(' ') ? req.data.split(':').slice(0, 2).join(':') : req.data) : '-'}`;

js = js.split(searchStr).join(replaceStr);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Formatacao de data atualizada!');
