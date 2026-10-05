const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// The exact string in the file right now
const oldSave = `const observacao = document.getElementById('satg-modal-observacao').value.trim();
        
        const payload = { rowIndex: _currentSatgRowIndex };
        if (status) payload.status = status;
        if (observacao !== undefined) payload.observacao = observacao;`;

const newSave = `const observacao = document.getElementById('satg-modal-observacao').value.trim();
        const elAcaoPecas = document.getElementById('satg-modal-acao-pecas');
        const acaoPecas = elAcaoPecas ? elAcaoPecas.value.trim() : '';
        
        const payload = { rowIndex: _currentSatgRowIndex };
        if (status) payload.status = status;
        if (observacao !== undefined) payload.observacao = observacao;
        if (elAcaoPecas) payload.acaoPecas = acaoPecas;`;

// We need to handle CRLF vs LF
let cleanJs = js.replace(/\\r\\n/g, '\\n');
let cleanOldSave = oldSave.replace(/\\r\\n/g, '\\n');

if (cleanJs.includes(cleanOldSave)) {
    cleanJs = cleanJs.replace(cleanOldSave, newSave.replace(/\\r\\n/g, '\\n'));
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', cleanJs);
    console.log('Fixed _updateSatgStatus to actually send acaoPecas!');
} else {
    console.log('Failed to match _updateSatgStatus string!');
}
