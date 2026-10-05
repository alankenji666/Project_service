const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Remove inner let
js = js.replace(/let _listaTransportadoras = \[\];/, '_listaTransportadoras = [];');

// 2. Add outer let
const varRegex = /let _tableContainer;/;
js = js.replace(varRegex, "let _tableContainer;\n    let _listaTransportadoras = [];");

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Escopo da variável corrigido!');
