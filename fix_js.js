const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Inject Edit Pencil for codcliente
const injectClienteTarget = `document.getElementById('satg-modal-cliente').innerText = req.cliente || '-';
        injectEditPencil('satg-modal-cliente', 'C', 'cliente', req.cliente);`;

const injectClienteNew = `document.getElementById('satg-modal-codcliente').innerText = req.codigoCliente || '-';
        injectEditPencil('satg-modal-codcliente', 'AG', 'codigoCliente', req.codigoCliente);
        
        document.getElementById('satg-modal-cliente').innerText = req.cliente || '-';
        injectEditPencil('satg-modal-cliente', 'C', 'cliente', req.cliente);`;
        
js = js.replace(injectClienteTarget, injectClienteNew);

// Define _inputCodCliente
js = js.replace(
    /let _inputCliente;\s*let _inputCpfCnpj;/,
    `let _inputCodCliente;\n      let _inputCliente;\n      let _inputCpfCnpj;`
);

js = js.replace(
    /_inputCliente = document\.getElementById\('garantia-cliente'\);/,
    `_inputCodCliente = document.getElementById('garantia-codcliente');\n          _inputCliente = document.getElementById('garantia-cliente');`
);

// Reset form
js = js.replace(
    /if \(_inputCliente\) _inputCliente\.value = '';/,
    `if (_inputCodCliente) _inputCodCliente.value = '';\n          if (_inputCliente) _inputCliente.value = '';`
);

// HandleAprovarPedidoSatg
js = js.replace(
    /_inputCliente\.value = req\.cliente \|\| '';/,
    `if (_inputCodCliente) _inputCodCliente.value = req.codigoCliente || '';\n                _inputCliente.value = req.cliente || '';`
);

// Build Payload for POST /pedido
// We need to send idCliente: _inputCodCliente.value.trim() OR change the mapping
js = js.replace(
    /idCliente: _inputCliente\.value\.trim\(\), \s*nomeContato: _inputCliente\.value\.trim\(\),/,
    `idCliente: (_inputCodCliente ? _inputCodCliente.value.trim() : ''),\n                  nomeContato: _inputCliente.value.trim(),`
);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS atualizado com codcliente');
