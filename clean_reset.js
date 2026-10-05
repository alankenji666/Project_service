const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /if \(_inputCodCliente\) _inputCodCliente\.value = '';\s*if \(_inputCliente\) _inputCliente\.value = '';/g;
const rep = `if (_inputCodCliente) { _inputCodCliente.value = ''; _inputCodCliente.readOnly = false; _inputCodCliente.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); }
          if (_inputCliente) { _inputCliente.value = ''; _inputCliente.readOnly = false; _inputCliente.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); }
          if (_inputCpfCnpj) { _inputCpfCnpj.readOnly = false; _inputCpfCnpj.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); }`;

js = js.replace(regex, rep);
fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Reset form corrigido');
