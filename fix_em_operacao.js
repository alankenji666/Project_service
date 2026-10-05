const fs = require('fs');

// 1. Atualizar HTML
let html = fs.readFileSync('index.html', 'utf8');

// The original HTML for Em Operação
// Note: Some files use different encodings, like `Em Operao?`. To be safe, we will use a Regex.
const htmlRegex = /<span class="text-gray-500 block text-xs">Em Opera[^<]+?\?<\/span>\s*<span class="font-medium" id="satg-modal-operacao">.*?<\/span>/;
const htmlReplacement = `<span class="text-gray-500 block text-xs">Em Operação?</span><select id="satg-modal-operacao" class="bg-transparent border-b border-gray-200 text-gray-800 font-medium outline-none cursor-pointer py-0 text-sm focus:border-gray-500 hover:bg-gray-100 rounded transition-colors mt-1 w-full"><option value="">-</option><option value="SIM">SIM</option><option value="NÃO">NÃO</option></select>`;

if (html.match(htmlRegex)) {
    html = html.replace(htmlRegex, htmlReplacement);
    fs.writeFileSync('index.html', html);
    console.log('HTML atualizado com sucesso!');
} else {
    console.log('Regex HTML falhou. Verifique.');
}

// 2. Atualizar Javascript
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const jsRegex = /document\.getElementById\('satg-modal-operacao'\)\.innerText = req\.emOperacao \|\| '-';\s*injectEditPencil\('satg-modal-operacao', 'R', 'emOperacao', req\.emOperacao\);/;

const jsReplacement = `const operacaoSelect = document.getElementById('satg-modal-operacao');
        if (operacaoSelect) {
            operacaoSelect.value = req.emOperacao || '';
            operacaoSelect.onchange = async () => {
                const newValue = operacaoSelect.value;
                try {
                    const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rowIndex: req.rowIndex,
                            updates: [ { column: 'R', value: newValue } ]
                        })
                    });
                    if (!res.ok) throw new Error();
                    req.emOperacao = newValue;
                    _fetchSatGData(true);
                    if (window._showToast) window._showToast('Status "Em Operação" atualizado com sucesso', 'success');
                } catch(e) {
                    console.error(e);
                    alert('Erro ao atualizar status "Em Operação"');
                    operacaoSelect.value = req.emOperacao || '';
                }
            };
        }`;

if (js.match(jsRegex)) {
    js = js.replace(jsRegex, jsReplacement);
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
    console.log('JS atualizado com sucesso!');
} else {
    console.log('Regex JS falhou. Verifique.');
}
