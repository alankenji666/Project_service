const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

// Ensure _showSelector hides garantiaContainer
const selTarget = "if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');";
if (js.includes(selTarget)) {
    // replace all occurrences safely
    js = js.split(selTarget).join("if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');\n        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');");
}

// Ensure _showSalesDashboard hides garantiaContainer
const salesTarget = "if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');";
if (js.includes(salesTarget)) {
    js = js.split(salesTarget).join("if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');\n        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');");
}

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('Fixed visibility in all navigation functions!');
