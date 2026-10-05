const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const target = `opt.value = t.nomeFantasia || t.razaoSocial || t.nome;`;
const replacement = `opt.value = t.codigo;`;

js = js.replace(target, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Value da Transportadora atualizado para usar o código!');
