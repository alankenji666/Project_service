const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Injection 1: populate modal
let oldPopulate = "document.getElementById('satg-modal-observacao').value = req.observacao || '';";
let newPopulate = `document.getElementById('satg-modal-observacao').value = req.observacao || '';
        const elAcaoPecas = document.getElementById('satg-modal-acao-pecas');
        if (elAcaoPecas) elAcaoPecas.value = req.acaoPecas || req.acao_pecas || req.acao || '';`;
        
js = js.replace(oldPopulate, newPopulate);

// Injection 2: save modal
let oldSave = `const observacao = document.getElementById('satg-modal-observacao').value.trim();
        
        const payload = { rowIndex: _currentSatgRowIndex };
        if (status) payload.status = status;
        if (observacao !== undefined) payload.observacao = observacao;`;

let newSave = `const observacao = document.getElementById('satg-modal-observacao').value.trim();
        const elAcaoPecas = document.getElementById('satg-modal-acao-pecas');
        const acaoPecas = elAcaoPecas ? elAcaoPecas.value.trim() : '';
        
        const payload = { rowIndex: _currentSatgRowIndex };
        if (status) payload.status = status;
        if (observacao !== undefined) payload.observacao = observacao;
        if (elAcaoPecas) payload.acaoPecas = acaoPecas;`;

js = js.replace(oldSave, newSave);

// Injection 3: also update the local req object after success so it doesn't revert before page reload
let oldUpdate = `if (status !== 'APROVADO') {
                _inputIdNota.value = req.notaFiscal || '';`;
let newUpdate = `if (status) req.status = status;
            req.observacao = observacao;
            if (elAcaoPecas) req.acaoPecas = acaoPecas;
            
            if (status !== 'APROVADO') {
                _inputIdNota.value = req.notaFiscal || '';`;
js = js.replace(oldUpdate, newUpdate);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS Updated with acaoPecas logic');
