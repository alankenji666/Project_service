const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Remove the line that shows the filter bar unconditionally
js = js.replace("if (_satgTopFilterBar) _satgTopFilterBar.classList.remove('hidden');", "// (Removido: Ocultação movida para _showView)");

// 2. Add hide to _showView base
const showViewStart = "if (_satgContainer) _satgContainer.classList.add('hidden');";
const showViewStartReplace = "if (_satgContainer) _satgContainer.classList.add('hidden');\n        if (_satgTopFilterBar) _satgTopFilterBar.classList.add('hidden');";
js = js.replace(showViewStart, showViewStartReplace);

// 3. Add show to _showView('satg')
const showViewSatg = "if (_satgContainer) _satgContainer.classList.remove('hidden');";
const showViewSatgReplace = "if (_satgContainer) _satgContainer.classList.remove('hidden');\n            if (_satgTopFilterBar) _satgTopFilterBar.classList.remove('hidden');";
js = js.replace(showViewSatg, showViewSatgReplace);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Fixed visibility toggle of satg top filter bar');
