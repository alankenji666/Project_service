const fs = require('fs');

function applyWeightMask(file, inputClass, syncBtnClass, updateApiCall) {
    let content = fs.readFileSync(file, 'utf8');

    // Mudar type="number" para type="text" e tirar step/min nas inputs de peso
    const regexInput = new RegExp(`<input type="number" step="0.001" min="0" class="([^"]*${inputClass}[^"]*)" value="([^"]*)">`, 'g');
    content = content.replace(regexInput, `<input type="text" class="$1" value="$2">`);

    // Injetar função _formatWeightInput no final do arquivo (antes do return do IIFE)
    const formatFunc = `
    function _formatWeightInput(inputEl) {
        if (!inputEl) return;
        
        function formatValue(value) {
            let clean = String(value).replace(/[^0-9]/g, '');
            if (!clean) return '0,000';
            
            let grams = parseInt(clean, 10);
            let valFloat = grams / 1000;
            
            return valFloat.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
        
        if (inputEl.value) {
            let val = parseFloat(String(inputEl.value).replace(',', '.')) || 0;
            inputEl.value = val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
        
        inputEl.addEventListener('input', function(e) {
            let val = this.value;
            this.value = formatValue(val);
        });
    }
    `;
    
    // Inserir formatFunc se ainda não existir
    if (!content.includes('_formatWeightInput(inputEl)')) {
        content = content.replace(/\s*return\s*\{/, formatFunc + '\n    return {');
    }

    // Adaptar parsing de peso e aplicar formatação
    if (file.includes('gerenciarPedidos.js')) {
        // Encontrar onde as linhas são adicionadas para NFe e aplicar a máscara
        const regexListenerNfe = /const pesoInput = tr\.querySelector\('\.nfe-edit-item-peso'\);/g;
        if (content.match(regexListenerNfe)) {
            content = content.replace(regexListenerNfe, `const pesoInput = tr.querySelector('.nfe-edit-item-peso');\n        if (pesoInput) _formatWeightInput(pesoInput);`);
        }
        
        // E o parseFloat para ler da tela e mandar pra API na NFe (já usa parseFloat)
        // O `syncPesoBtn.addEventListener('click'` tem:
        // const currentPeso = parseFloat(pesoInput.value) || 0;
        const replaceParseNfe = /const currentPeso = parseFloat\(pesoInput\.value\) \|\| 0;/g;
        content = content.replace(replaceParseNfe, `const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;`);
        
    } else if (file.includes('gerenciarGarantia.js')) {
        // Encontrar onde as linhas são adicionadas para Garantia
        const regexListenerGar = /const pesoInput = tr\.querySelector\('\.garantia-item-peso-input'\);/g;
        if (content.match(regexListenerGar)) {
            content = content.replace(regexListenerGar, `const pesoInput = tr.querySelector('.garantia-item-peso-input');\n            if (pesoInput) _formatWeightInput(pesoInput);`);
        }
        
        const replaceParseGar = /const currentPeso = parseFloat\(pesoInput\.value\) \|\| 0;/g;
        content = content.replace(replaceParseGar, `const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;`);
    }

    fs.writeFileSync(file, content);
}

applyWeightMask('js/modulos/gerenciarPedidos.js', 'nfe-edit-item-peso', 'nfe-edit-item-sync-peso-btn', true);
applyWeightMask('js/modulos/gerenciarGarantia.js', 'garantia-item-peso-input', 'garantia-item-sync-peso-btn', true);

console.log('Scripts atualizados com máscaras de peso!');
