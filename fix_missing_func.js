const fs = require('fs');
const file = 'js/modulos/gerenciarPedidos.js';
let content = fs.readFileSync(file, 'utf8');

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

    return {`;

content = content.replace(/\s*return\s*\{\s*openOrderDetailsModal:/, funcStr + '\n        openOrderDetailsModal:');

fs.writeFileSync(file, content);
console.log('Fixed gerenciarPedidos.js! The function is now properly defined.');
