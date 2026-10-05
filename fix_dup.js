const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace('let _inputCodCliente;\n      let _inputCodCliente;', 'let _inputCodCliente;');
js = js.replace('let _inputCodCliente;\r\n      let _inputCodCliente;', 'let _inputCodCliente;');

// Wait, I should just remove all `let _inputCodCliente;` and re-insert exactly one.
js = js.split('let _inputCodCliente;').join('');
js = js.replace('let _inputCliente;', 'let _inputCodCliente;\n      let _inputCliente;');

// Are there duplicate bindings?
// _inputCodCliente = document.getElementById('garantia-codcliente');
const bindString = "_inputCodCliente = document.getElementById('garantia-codcliente');";
const bindCount = js.split(bindString).length - 1;
if (bindCount > 1) {
    js = js.split(bindString).join('');
    js = js.replace("_inputCliente = document.getElementById('garantia-cliente');", "_inputCodCliente = document.getElementById('garantia-codcliente');\n        _inputCliente = document.getElementById('garantia-cliente');");
}

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Duplicados removidos!');
