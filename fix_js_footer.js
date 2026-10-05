const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Add _updateUITotalValues function right after _updateUIPesoTotal
const insertPos = js.indexOf('function _formatItemsString() {');
if (insertPos === -1) throw new Error('Could not find _formatItemsString');

const updateTotalValuesFunc = `
    function _updateUITotalValues() {
        const tfoot = document.getElementById('garantia-items-footer');
        if (!tfoot) return;
        if (_currentOrderItems.length === 0) {
            tfoot.classList.add('hidden');
            return;
        }

        tfoot.classList.remove('hidden');

        let totalItens = 0;
        _currentOrderItems.forEach(i => {
            totalItens += (parseFloat(i.preco || 0) * parseInt(i.qtd || 1));
        });

        const chkEnvio = document.getElementById('garantia-possui-envio');
        const inputFrete = document.getElementById('garantia-valor-frete');
        let freteVal = 0;
        
        if (chkEnvio && chkEnvio.checked && inputFrete && inputFrete.value.trim() !== '') {
            let fStr = String(inputFrete.value).replace(/\\./g, '').replace(',', '.').replace(/[^\\d.-]/g, '');
            freteVal = parseFloat(fStr) || 0;
        }

        const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        
        let html = '';
        
        if (freteVal > 0) {
            html += \`
                <tr class="bg-slate-50">
                    <td colspan="3" class="px-4 py-2 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Itens:</td>
                    <td class="px-4 py-2 text-right font-bold text-slate-700 text-sm">\${fmt(totalItens)}</td>
                    <td></td>
                </tr>
                <tr class="bg-slate-50 border-t border-slate-200">
                    <td colspan="3" class="px-4 py-2 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Frete:</td>
                    <td class="px-4 py-2 text-right font-bold text-slate-700 text-sm">\${fmt(freteVal)}</td>
                    <td></td>
                </tr>
                <tr class="bg-green-50 border-t border-green-200">
                    <td colspan="3" class="px-4 py-3 text-right text-[12px] font-black text-green-800 uppercase tracking-wider">Valor Total:</td>
                    <td class="px-4 py-3 text-right font-black text-green-700 text-base">\${fmt(totalItens + freteVal)}</td>
                    <td></td>
                </tr>
            \`;
        } else {
            html += \`
                <tr class="bg-green-50">
                    <td colspan="3" class="px-4 py-3 text-right text-[12px] font-black text-green-800 uppercase tracking-wider">Valor Total:</td>
                    <td class="px-4 py-3 text-right font-black text-green-700 text-base">\${fmt(totalItens)}</td>
                    <td></td>
                </tr>
            \`;
        }
        
        tfoot.innerHTML = html;
    }

`;

js = js.slice(0, insertPos) + updateTotalValuesFunc + js.slice(insertPos);

// 2. Call it inside _renderOrderItems
js = js.replace(/_updateUIPesoTotal\(\);/g, '_updateUIPesoTotal();\n        _updateUITotalValues();');

// 3. Call it on checkbox change
js = js.replace(/if \(e\.target\.checked\) \{/g, `_updateUITotalValues();
                if (e.target.checked) {`);

// 4. Call it on input change for frete
// We need to find _setupMasks or wherever garantia-valor-frete is bound.
const setupMasksPos = js.indexOf("const inputFrete = document.getElementById('garantia-valor-frete');");
if (setupMasksPos !== -1) {
    const replMasks = `const inputFrete = document.getElementById('garantia-valor-frete');
        if (inputFrete && !inputFrete.hasAttribute('data-mask-bound')) {
            inputFrete.setAttribute('data-mask-bound', 'true');
            inputFrete.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\\D/g, '');
                if (value.length > 0) {
                    value = (parseInt(value) / 100).toFixed(2) + '';
                    value = value.replace('.', ',');
                    value = value.replace(/(\\d)(?=(\\d{3})+(?!\\d))/g, '$1.');
                    e.target.value = 'R$ ' + value;
                } else {
                    e.target.value = '';
                }
                _updateUITotalValues();
            });
        }`;
    
    const regexMasks = /const inputFrete = document\.getElementById\('garantia-valor-frete'\);\s*if \(inputFrete[^{]+\{[^}]+\}[^}]+\}[^}]+\}/;
    js = js.replace(regexMasks, replMasks);
}

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Script js modificado!');
