const fs = require('fs');

// 1. Corrigir index.html
let htmlContent = fs.readFileSync('index.html', 'utf8');
htmlContent = htmlContent.replace(/<input type="number" step="0\.001" min="0" id="product-weight-bruto-input"/g, '<input type="text" id="product-weight-bruto-input"');
htmlContent = htmlContent.replace(/<input type="number" step="0\.001" min="0" id="product-weight-liquido-input"/g, '<input type="text" id="product-weight-liquido-input"');
fs.writeFileSync('index.html', htmlContent);

// 2. Corrigir main.js
let jsContent = fs.readFileSync('js/main.js', 'utf8');

// Injetar a máscara se ainda não existir
const formatFunc = `
function _formatModalWeightInput(inputEl) {
    if (!inputEl) return;
    
    function formatValue(value) {
        let clean = String(value).replace(/[^0-9]/g, '');
        if (!clean) return '0,000';
        
        let grams = parseInt(clean, 10);
        let valFloat = grams / 1000;
        
        return valFloat.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    
    // Removendo os listeners antigos se existirem para não acumular
    const newEl = inputEl.cloneNode(true);
    inputEl.parentNode.replaceChild(newEl, inputEl);
    
    newEl.addEventListener('input', function(e) {
        let val = this.value;
        this.value = formatValue(val);
    });
    
    return newEl; // retorna a nova referência
}
`;

if (!jsContent.includes('_formatModalWeightInput')) {
    // Injetar logo antes da definição de _openProductWeightEditModal
    jsContent = jsContent.replace(/function _openProductWeightEditModal/, formatFunc + '\nfunction _openProductWeightEditModal');
}

// Em _openProductWeightEditModal
const regexOpenModal = /if \(_productWeightBrutoInput\) _productWeightBrutoInput\.value = product\.pesoBruto \|\| product\.metricas\?\.peso_bruto \|\| "";\s*if \(_productWeightLiquidoInput\) _productWeightLiquidoInput\.value = product\.pesoLiq \|\| product\.metricas\?\.peso_liquido \|\| "";/;

const replacementOpenModal = `
        if (_productWeightBrutoInput) {
            let val = parseFloat(product.pesoBruto || product.metricas?.peso_bruto || 0);
            _productWeightBrutoInput.value = val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            _productWeightBrutoInput = _formatModalWeightInput(_productWeightBrutoInput);
        }
        if (_productWeightLiquidoInput) {
            let val = parseFloat(product.pesoLiq || product.metricas?.peso_liquido || 0);
            _productWeightLiquidoInput.value = val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            _productWeightLiquidoInput = _formatModalWeightInput(_productWeightLiquidoInput);
        }
`;

if (jsContent.match(regexOpenModal)) {
    jsContent = jsContent.replace(regexOpenModal, replacementOpenModal);
}

// Em _saveProductWeightEdit
const regexSaveModal = /const pesoBruto = parseFloat\(_productWeightBrutoInput\.value\);\s*const pesoLiquido = parseFloat\(_productWeightLiquidoInput\.value\);/;

const replacementSaveModal = `
    const pesoBruto = parseFloat(String(_productWeightBrutoInput.value).replace(',', '.'));
    const pesoLiquido = parseFloat(String(_productWeightLiquidoInput.value).replace(',', '.'));
`;

if (jsContent.match(regexSaveModal)) {
    jsContent = jsContent.replace(regexSaveModal, replacementSaveModal);
}

fs.writeFileSync('js/main.js', jsContent);
console.log('Arquivos atualizados');
