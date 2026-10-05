const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// The block to replace in _openEditPedidoForm:
const regexFallback = /let codFall = pedido\.codigoCliente \|\| '';\s*if \(!codFall && typeof satgAssociado !== 'undefined' && satgAssociado\) \{\s*codFall = satgAssociado\.codigoCliente \|\| '';\s*\}\s*if \(_inputCodCliente\) _inputCodCliente\.value = codFall;\s*_inputCliente\.value = pedido\.cliente \|\| pedido\.nomeContato \|\| '';\s*_inputCpfCnpj\.value = pedido\.cpfCnpj \|\| pedido\.cpf \|\| '';/g;

const newFallback = `let codFall = pedido.codigoCliente || '';
        let cliFall = pedido.cliente || pedido.nomeContato || '';
        let cpfFall = pedido.cpfCnpj || pedido.cpf || '';
        
        // Single Source of Truth: Se tem SAT-G vinculado, PUXA tudo de lá e bloqueia a edição no Orçamento
        if (typeof satgAssociado !== 'undefined' && satgAssociado) {
            codFall = satgAssociado.codigoCliente || codFall;
            cliFall = satgAssociado.cliente || cliFall;
            cpfFall = satgAssociado.cpf || cpfFall;
            
            if (_inputCodCliente) { _inputCodCliente.readOnly = true; _inputCodCliente.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); _inputCodCliente.title = "Edite os dados do cliente no SAT-G vinculado"; }
            if (_inputCliente) { _inputCliente.readOnly = true; _inputCliente.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); _inputCliente.title = "Edite os dados do cliente no SAT-G vinculado"; }
            if (_inputCpfCnpj) { _inputCpfCnpj.readOnly = true; _inputCpfCnpj.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); _inputCpfCnpj.title = "Edite os dados do cliente no SAT-G vinculado"; }
        } else {
            // Se for orçamento avulso (sem SAT-G), libera para edição normal
            if (_inputCodCliente) { _inputCodCliente.readOnly = false; _inputCodCliente.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); _inputCodCliente.title = ""; }
            if (_inputCliente) { _inputCliente.readOnly = false; _inputCliente.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); _inputCliente.title = ""; }
            if (_inputCpfCnpj) { _inputCpfCnpj.readOnly = false; _inputCpfCnpj.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70'); _inputCpfCnpj.title = ""; }
        }

        if (_inputCodCliente) _inputCodCliente.value = codFall;
        _inputCliente.value = cliFall;
        _inputCpfCnpj.value = cpfFall;`;

js = js.replace(regexFallback, newFallback);
fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Frontend SSOT atualizado!');
