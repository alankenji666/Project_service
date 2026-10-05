const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Remove the wrongly injected block from _resetGarantiaForm
const badBlockReset = `        // Preencher Envio
        const chkEnvio = document.getElementById('garantia-possui-envio');
        const contEnvio = document.getElementById('garantia-envio-container');
        if (chkEnvio) {
            const hasEnvio = pedido.transportadora || pedido.volume || pedido.cep || pedido.cidade || pedido.bairro;
            chkEnvio.checked = !!hasEnvio;
            if (hasEnvio && contEnvio) contEnvio.classList.remove('hidden');
            else if (contEnvio) contEnvio.classList.add('hidden');
            
            document.getElementById('garantia-transportadora').value = pedido.transportadora || '';
            document.getElementById('garantia-volume').value = pedido.volume || '';
            document.getElementById('garantia-cep').value = pedido.cep || '';
            document.getElementById('garantia-endereco').value = pedido.endereco || '';
            document.getElementById('garantia-numero-envio').value = pedido.numeroEndereco || pedido.numero || '';
            document.getElementById('garantia-complemento').value = pedido.complemento || '';
            document.getElementById('garantia-bairro').value = pedido.bairro || '';
            document.getElementById('garantia-cidade').value = pedido.cidade || '';
            document.getElementById('garantia-estado').value = pedido.estado || '';
        }`;
js = js.replace(badBlockReset, "");

// 2. Put it properly in _openEditPedidoForm
const openEditRegex = /_currentEditPedidoId = idPedido;/;
const openEditFix = `_currentEditPedidoId = idPedido;

        // Preencher Envio
        const chkEnvio = document.getElementById('garantia-possui-envio');
        const contEnvio = document.getElementById('garantia-envio-container');
        if (chkEnvio) {
            const hasEnvio = pedido.transportadora || pedido.volume || pedido.cep || pedido.cidade || pedido.bairro;
            chkEnvio.checked = !!hasEnvio;
            if (hasEnvio && contEnvio) contEnvio.classList.remove('hidden');
            else if (contEnvio) contEnvio.classList.add('hidden');
            
            document.getElementById('garantia-transportadora').value = pedido.transportadora || '';
            document.getElementById('garantia-volume').value = pedido.volume || '';
            document.getElementById('garantia-cep').value = pedido.cep || '';
            document.getElementById('garantia-endereco').value = pedido.endereco || '';
            document.getElementById('garantia-numero-envio').value = pedido.numeroEndereco || pedido.numero || '';
            document.getElementById('garantia-complemento').value = pedido.complemento || '';
            document.getElementById('garantia-bairro').value = pedido.bairro || '';
            document.getElementById('garantia-cidade').value = pedido.cidade || '';
            document.getElementById('garantia-estado').value = pedido.estado || '';
        }`;
js = js.replace(openEditRegex, openEditFix);

// 3. Make sure the reset in _resetGarantiaForm is correct
const properReset = `    function _resetGarantiaForm() {
        document.getElementById('garantia-pedido-form').reset();
        _itemsList.innerHTML = '<li id="garantia-items-empty" class="text-sm text-gray-500 italic text-center py-2">Nenhum item adicionado.</li>';
        
        const chk = document.getElementById('garantia-possui-envio');
        if (chk) chk.checked = false;
        const cont = document.getElementById('garantia-envio-container');
        if (cont) cont.classList.add('hidden');
        ['garantia-transportadora', 'garantia-volume', 'garantia-cep', 'garantia-endereco', 'garantia-numero-envio', 'garantia-complemento', 'garantia-bairro', 'garantia-cidade', 'garantia-estado'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const titleEl = document.querySelector('#garantia-form-header h1');`;
// Replace the start of _resetGarantiaForm
const resetRegexFix = /function _resetGarantiaForm\(\) \{[\s\S]*?const titleEl = document\.querySelector\('#garantia-form-header h1'\);/;
js = js.replace(resetRegexFix, properReset);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Fixed js architecture');
