const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /function _setupMasks\(\) \{[\s\S]*?const cepInput = document\.getElementById\('garantia-cep'\);/;
const replacement = `function _setupMasks() {
        if (window._garantiaMasksConfigured) return;
        window._garantiaMasksConfigured = true;
        
        const cepInput = document.getElementById('garantia-cep');`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Prevenção de múltiplos listeners adicionada!');
