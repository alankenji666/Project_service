const fs = require('fs');

// 1. Corrigir HTML de Revenda
let html = fs.readFileSync('index.html', 'utf8');

// The original HTML might have extra spaces or newlines.
// We'll use a regex to be safe.
const regexRevendaHtml = /<div( class=".*?")?><span class="text-gray-500">Revenda:<\/span> <span class="font-medium text-gray-800" id="satg-modal-revenda">.*?<\/span><\/div>/;
const replaceRevendaHtml = `<div class="flex items-center gap-1"><span class="text-gray-500">Revenda:</span> <select id="satg-modal-revenda" class="bg-transparent border-b border-gray-200 text-gray-800 font-medium outline-none cursor-pointer py-0 text-sm focus:border-gray-500 hover:bg-gray-100 rounded transition-colors"><option value="">-</option><option value="SIM">SIM</option><option value="NÃO">NÃO</option></select></div>`;

if (html.match(regexRevendaHtml)) {
    html = html.replace(regexRevendaHtml, replaceRevendaHtml);
    fs.writeFileSync('index.html', html);
    console.log('HTML Revenda atualizado!');
}

// 2. Corrigir gerenciarGarantia.js
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Fix the `type is not defined` bug in _openCustomPrompt completely.
// Since the user is editing free text fields, we DO need `type` for masks!
// I'll restore `type` into `_openCustomPrompt`.
const restorePromptSig = /function _openCustomPrompt\(title, initialValue, callback, options = null\) \{/g;
js = js.replace(restorePromptSig, 'function _openCustomPrompt(title, initialValue, callback, type = null) {');

// And I'll change injectEditPencil back to `type = 'text'`
const restoreInjectSig = /function injectEditPencil\(elementId, column, key, currentValue, options = null\) \{/g;
js = js.replace(restoreInjectSig, 'function injectEditPencil(elementId, column, key, currentValue, type = \'text\') {');

// Restore the call to `_openCustomPrompt` inside `injectEditPencil`
js = js.replace(/\}, options\);/g, '}, type);');

// Alterar comportamento do satg-modal-revenda
const regexRevendaJS = /document\.getElementById\('satg-modal-revenda'\)\.innerText = req\.revenda \|\| '-';\s*injectEditPencil\('satg-modal-revenda', 'H', 'revenda', req\.revenda, \['SIM', 'NÃO'\]\);/;

const replaceRevendaJS = `const revendaSelect = document.getElementById('satg-modal-revenda');
        if (revendaSelect) {
            revendaSelect.value = req.revenda || '';
            revendaSelect.onchange = async () => {
                const newValue = revendaSelect.value;
                try {
                    const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rowIndex: req.rowIndex,
                            updates: [ { column: 'H', value: newValue } ]
                        })
                    });
                    if (!res.ok) throw new Error();
                    req.revenda = newValue;
                    _fetchSatGData(true);
                    if (window._showToast) window._showToast('Revenda atualizada com sucesso', 'success');
                } catch(e) {
                    console.error(e);
                    alert('Erro ao atualizar Revenda');
                    revendaSelect.value = req.revenda || '';
                }
            };
        }`;

if (js.match(regexRevendaJS)) {
    js = js.replace(regexRevendaJS, replaceRevendaJS);
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
    console.log('JS Revenda atualizado e Type bugs corrigidos!');
}

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
