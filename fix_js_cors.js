const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /html2canvas:\s*\{\s*scale:\s*2\s*\}/;
const replacement = "html2canvas:  { scale: 2, useCORS: true, allowTaint: true, logging: true }";

js = js.replace(regex, replacement);
fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('CORS adicionado ao html2canvas!');
