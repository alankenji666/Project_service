const fs = require('fs');

// 1. Corrigir HTML de Revenda
let html = fs.readFileSync('index.html', 'utf8');
const searchRevendaHtml = `<div><span class="text-gray-500">Revenda:</span> <span class="font-medium text-gray-800" id="satg-modal-revenda">-</span></div>`;
const replaceRevendaHtml = `<div class="flex items-center gap-1"><span class="text-gray-500">Revenda:</span> <select id="satg-modal-revenda" class="bg-transparent border-b border-gray-200 text-gray-800 font-medium outline-none cursor-pointer py-0 text-sm focus:border-gray-500 hover:bg-gray-100 rounded transition-colors"><option value="">-</option><option value="SIM">SIM</option><option value="NÃO">NÃO</option></select></div>`;

if (html.includes(searchRevendaHtml)) {
    html = html.replace(searchRevendaHtml, replaceRevendaHtml);
    fs.writeFileSync('index.html', html);
}

// 2. Corrigir gerenciarGarantia.js
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Fix `type is not defined`
js = js.replace(/\}, type\);/g, '}, options);');

// Alterar comportamento do satg-modal-revenda
const searchRevendaJS = `document.getElementById('satg-modal-revenda').innerText = req.revenda || '-';
        injectEditPencil('satg-modal-revenda', 'H', 'revenda', req.revenda, ['SIM', 'NÃO']);`;

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

if (js.includes('injectEditPencil(\'satg-modal-revenda\'')) {
    js = js.replace(searchRevendaJS, replaceRevendaJS);
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
}
console.log('Revenda atualizada para select e bug de type corrigido');
