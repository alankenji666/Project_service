const fs = require('fs');
const file = 'js/modulos/gerenciarGarantia.js';
let content = fs.readFileSync(file, 'utf8');

const regexCell = /<td class="px-4 py-3 text-center">\s*<span class="font-medium text-gray-600">\$\{\(item\.peso \|\| 0\)\.toFixed\(3\)\} kg<\/span>\s*<\/td>/;

const replacementHtml = `<td class="px-4 py-3">
                    <div class="flex items-center gap-2 justify-center" onclick="event.stopPropagation()">
                        <input type="number" step="0.001" min="0" class="garantia-item-peso-input w-20 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500" value="\${(item.peso || 0).toFixed(3)}">
                        <button type="button" class="garantia-item-sync-peso-btn flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 bg-white rounded shadow-sm border border-gray-200 hidden transition-all" title="Salvar novo peso no cadastro do produto no Bling" data-original-peso="\${(item.peso || 0).toFixed(3)}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        </button>
                    </div>
                </td>`;

if (regexCell.test(content)) {
    content = content.replace(regexCell, replacementHtml);
    
    // Now inject the script listener for the row
    const regexListener = /tr\.querySelector\('\.btn-remove-item'\)\.onclick\s*=\s*\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\);\s*_removeOrderItem\(index\);\s*\};/;
    
    const listenerScript = `
            const pesoInput = tr.querySelector('.garantia-item-peso-input');
            const syncPesoBtn = tr.querySelector('.garantia-item-sync-peso-btn');
            if (pesoInput && syncPesoBtn) {
                pesoInput.addEventListener('input', () => {
                    const originalPeso = parseFloat(syncPesoBtn.dataset.originalPeso) || 0;
                    const currentPeso = parseFloat(pesoInput.value) || 0;
                    
                    item.peso = currentPeso;
                    
                    if (currentPeso !== originalPeso) {
                        syncPesoBtn.classList.remove('hidden');
                    } else {
                        syncPesoBtn.classList.add('hidden');
                    }
                });

                syncPesoBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const currentPeso = parseFloat(pesoInput.value) || 0;
                    const originalBtnHtml = syncPesoBtn.innerHTML;
                    
                    syncPesoBtn.innerHTML = \`<svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\`;
                    syncPesoBtn.disabled = true;

                    try {
                        let productIdToUpdate = null;
                        if (window._allProducts) {
                            const p = window._allProducts.find(x => String(x.codigo) === String(item.cod) || String(x.id) === String(item.id));
                            if (p) productIdToUpdate = p.id;
                        }

                        if (productIdToUpdate) {
                            // IMPORTANTE: Utiliza API_URLS do gerenciarGarantia
                            await fetch(\`\${API_URLS.PRODUCTS}/\${productIdToUpdate}\`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ peso_bruto: currentPeso, peso_liquido: currentPeso })
                            });
                            
                            if (window._allProducts) {
                                const p = window._allProducts.find(x => String(x.id) === String(productIdToUpdate));
                                if (p) {
                                    p.pesoBruto = currentPeso;
                                    p.pesoLiq = currentPeso;
                                    if (!p.metricas) p.metricas = {};
                                    p.metricas.peso_bruto = currentPeso;
                                    p.metricas.peso_liquido = currentPeso;
                                }
                            }
                            if (typeof PesquisarProduto !== 'undefined' && PesquisarProduto.updateProductWeightDisplay) {
                                PesquisarProduto.updateProductWeightDisplay(productIdToUpdate, currentPeso, currentPeso);
                            }

                            syncPesoBtn.dataset.originalPeso = currentPeso;
                            syncPesoBtn.innerHTML = \`<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>\`;
                            setTimeout(() => {
                                syncPesoBtn.classList.add('hidden');
                                syncPesoBtn.innerHTML = originalBtnHtml;
                                syncPesoBtn.disabled = false;
                            }, 1500);

                        } else {
                            alert(\`Produto \${item.cod || ''} não encontrado no catálogo local.\`);
                            syncPesoBtn.innerHTML = originalBtnHtml;
                            syncPesoBtn.disabled = false;
                        }
                    } catch (error) {
                        console.error('Erro ao atualizar peso:', error);
                        alert('Erro ao atualizar o peso no Bling.');
                        syncPesoBtn.innerHTML = originalBtnHtml;
                        syncPesoBtn.disabled = false;
                    }
                });
            }
            
            tr.querySelector('.btn-remove-item').onclick = (e) => { e.stopPropagation(); _removeOrderItem(index); };`;
            
    content = content.replace(regexListener, listenerScript);
    
    fs.writeFileSync(file, content);
    console.log('Success: Replaced in gerenciarGarantia.js');
} else {
    console.log('Error: targetHtml not found via regex.');
}
