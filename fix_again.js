const fs = require('fs');
const file = 'js/modulos/gerenciarPedidos.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Change type="number" to text
content = content.replace(/<input type="number" step="0\.001" min="0" class="([^"]*nfe-edit-item-peso[^"]*)" value="([^"]*)">/g, '<input type="text" class="$1" value="$2">');

// 2. Insert function at the very end of the IIFE
const funcStr = `
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

    return {
        init,`;
content = content.replace(/return\s*\{\s*init,/g, funcStr);

// 3. Inject the _formatWeightInput call when building the row
const regexListenerNfe = /const pesoInput = tr\.querySelector\('\.nfe-edit-item-peso'\);/g;
content = content.replace(regexListenerNfe, `const pesoInput = tr.querySelector('.nfe-edit-item-peso');\n        if (pesoInput) _formatWeightInput(pesoInput);`);

// 4. Update the save logic to convert comma to dot before parseFloat
const replaceParseNfe = /const currentPeso = parseFloat\(pesoInput\.value\) \|\| 0;/g;
content = content.replace(replaceParseNfe, `const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;`);

fs.writeFileSync(file, content);
console.log('Fixed gerenciarPedidos.js properly');
