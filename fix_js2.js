const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regexPencil = /document\.getElementById\('satg-modal-cliente'\)\.innerText = req\.cliente \|\| '-';\s*injectEditPencil\('satg-modal-cliente', 'C', 'cliente', req\.cliente\);/g;

const newPencil = `document.getElementById('satg-modal-codcliente').innerText = req.codigoCliente || '-';
        injectEditPencil('satg-modal-codcliente', 'AG', 'codigoCliente', req.codigoCliente);
        
        document.getElementById('satg-modal-cliente').innerText = req.cliente || '-';
        injectEditPencil('satg-modal-cliente', 'C', 'cliente', req.cliente);`;

js = js.replace(regexPencil, newPencil);

// Ensure input variables exist and are bound.
const regexVars = /let _inputCliente;\s*let _inputCpfCnpj;/g;
const newVars = `let _inputCodCliente;\n      let _inputCliente;\n      let _inputCpfCnpj;`;
js = js.replace(regexVars, newVars);

const regexInputBind = /_inputCliente = document\.getElementById\('garantia-cliente'\);/g;
const newInputBind = `_inputCodCliente = document.getElementById('garantia-codcliente');\n          _inputCliente = document.getElementById('garantia-cliente');`;
js = js.replace(regexInputBind, newInputBind);

const regexReset = /if \(_inputCliente\) _inputCliente\.value = '';/g;
const newReset = `if (_inputCodCliente) _inputCodCliente.value = '';\n          if (_inputCliente) _inputCliente.value = '';`;
js = js.replace(regexReset, newReset);

const regexFill = /_inputCliente\.value = req\.cliente \|\| '';/g;
const newFill = `if (_inputCodCliente) _inputCodCliente.value = req.codigoCliente || '';\n                _inputCliente.value = req.cliente || '';`;
js = js.replace(regexFill, newFill);

const regexPayload = /idCliente: _inputCliente\.value\.trim\(\),\s*nomeContato: _inputCliente\.value\.trim\(\),/g;
const newPayload = `idCliente: (_inputCodCliente ? _inputCodCliente.value.trim() : ''),\n                  nomeContato: _inputCliente.value.trim(),`;
js = js.replace(regexPayload, newPayload);


fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS atualizado!');
