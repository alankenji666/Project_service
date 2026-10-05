const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regexFallback = /if \(_inputCodCliente\) _inputCodCliente\.value = pedido\.codigoCliente \|\| '';/g;
const newFallback = `let codFall = pedido.codigoCliente || '';
        if (!codFall && typeof satgAssociado !== 'undefined' && satgAssociado) {
            codFall = satgAssociado.codigoCliente || '';
        }
        if (_inputCodCliente) _inputCodCliente.value = codFall;`;

js = js.replace(regexFallback, newFallback);
fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Frontend fallback inserido!');
