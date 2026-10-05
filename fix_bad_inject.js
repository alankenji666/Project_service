const fs = require('fs');
const file = 'js/modulos/gerenciarPedidos.js';
let content = fs.readFileSync(file, 'utf8');

// The injected function code exactly as it was:
const injectedFunc = `
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

// Replace the messed up if statement back to its original state
const regexBrokenIf = /if \(!confirmed\)\s*function _formatWeightInput[\s\S]*?this\.value = formatValue\(val\);\s*}\);\s*}\s*return \{/;
if (content.match(regexBrokenIf)) {
    content = content.replace(regexBrokenIf, `if (!confirmed) return { success: false, error: "Cancelado pelo usuário" };\n\n${injectedFunc}\n    return {`);
    fs.writeFileSync(file, content);
    console.log("Fixed!");
} else {
    console.log("Did not find broken if regex.");
}
