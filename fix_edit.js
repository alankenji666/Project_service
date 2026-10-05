const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace(/_inputCliente\.value = pedido\.cliente \|\| pedido\.nomeContato \|\| '';/, `if (_inputCodCliente) _inputCodCliente.value = pedido.codigoCliente || '';\n        _inputCliente.value = pedido.cliente || pedido.nomeContato || '';`);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS frontend atualizado');
