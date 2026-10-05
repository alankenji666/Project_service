const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const target1 = "peso: parseFloat(p.peso_bruto || p.peso_liquido || 0),\\n                              preco: parseFloat(p.preco || 0)";
const target1_crlf = "peso: parseFloat(p.peso_bruto || p.peso_liquido || 0),\\r\\n                              preco: parseFloat(p.preco || 0)";
const replacement1 = "peso: parseFloat(p.peso_bruto || p.peso_liquido || 0),\\n                              preco: parseFloat(p.preco_de_custo) || parseFloat(p.preco || 0)";

js = js.replace(target1, replacement1).replace(target1_crlf, replacement1);

const target2 = '<td class="px-4 py-3 text-right">\\n                    <span class="font-bold text-emerald-600">${(item.preco || 0).toLocaleString(\\'pt-BR\\', {style: \\'currency\\', currency: \\'BRL\\'})}</span>\\n                </td>';
const target2_crlf = '<td class="px-4 py-3 text-right">\\r\\n                    <span class="font-bold text-emerald-600">${(item.preco || 0).toLocaleString(\\'pt-BR\\', {style: \\'currency\\', currency: \\'BRL\\'})}</span>\\r\\n                </td>';

const replacement2 = \`<td class="px-4 py-3">
                    <div class="flex items-center gap-2 justify-end" onclick="event.stopPropagation()">
                        <span class="font-bold text-emerald-600">R$</span>
                        <input type="text" class="garantia-item-preco-input w-24 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-600" value="\${(item.preco || 0).toFixed(2).replace('.', ',')}">
                        <button type="button" class="garantia-item-sync-preco-btn flex-shrink-0 p-1 text-emerald-500 hover:text-emerald-700 bg-white rounded shadow-sm border border-gray-200 hidden transition-all" title="Salvar novo preço de custo no cadastro do produto" data-original-preco="\${(item.preco || 0).toFixed(2).replace('.', ',')}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        </button>
                    </div>
                </td>\`;

js = js.replace(target2, replacement2).replace(target2_crlf, replacement2);


const target3 = \`syncPesoBtn.disabled = false;
                    }
                });
            }\`;

const replacement3 = \`syncPesoBtn.disabled = false;
                    }
                });
            }

            const precoInput = tr.querySelector('.garantia-item-preco-input');
            const syncPrecoBtn = tr.querySelector('.garantia-item-sync-preco-btn');
            if (precoInput && syncPrecoBtn) {
                precoInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\\D/g, '');
                    if (val === '') val = '000';
                    val = (parseInt(val) / 100).toFixed(2).replace('.', ',');
                    e.target.value = val;
                    
                    const originalPreco = syncPrecoBtn.dataset.originalPreco;
                    const currentPreco = precoInput.value;
                    
                    item.preco = parseFloat(currentPreco.replace('.', '').replace(',', '.'));
                    _updateUITotalValues();
                    
                    if (currentPreco !== originalPreco) syncPrecoBtn.classList.remove('hidden');
                    else syncPrecoBtn.classList.add('hidden');
                });

                syncPrecoBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const currentPreco = parseFloat(String(precoInput.value).replace('.', '').replace(',', '.')) || 0;
                    const originalBtnHtml = syncPrecoBtn.innerHTML;
                    
                    syncPrecoBtn.innerHTML = '<svg class="animate-spin h-4 w-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                    syncPrecoBtn.disabled = true;

                    try {
                        let productIdToUpdate = null;
                        let productCodigo = '';
                        if (window._allProducts) {
                            const p = window._allProducts.find(x => String(x.codigo) === String(item.cod) || String(x.id) === String(item.id));
                            if (p) {
                                productIdToUpdate = p.id;
                                productCodigo = p.codigo;
                            }
                        }

                        if (productIdToUpdate) {
                            const maxRetries = 3;
                            const retryDelays = [5000, 10000, 15000];
                            let updateSuccess = false;
                            
                            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                                try {
                                    const res = await fetch(\\\`\${API_URLS.PRODUCTS}/\${productIdToUpdate}\\\`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ preco_de_custo: currentPreco, codigo: productCodigo })
                                    });
                                    if (res.ok) { updateSuccess = true; break; }
                                } catch(e) { }
                                if (!updateSuccess && attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelays[attempt]));
                            }
                            
                            if (updateSuccess) {
                                syncPrecoBtn.dataset.originalPreco = precoInput.value;
                                syncPrecoBtn.classList.add('hidden');
                                if (window._allProducts) {
                                    const p = window._allProducts.find(x => String(x.id) === String(productIdToUpdate));
                                    if (p) p.preco_de_custo = currentPreco;
                                }
                                alert('Preço de custo atualizado com sucesso no Bling!');
                            } else {
                                alert('Falha ao atualizar o preço de custo no Bling.');
                            }
                        } else {
                            alert('Produto não encontrado no cache local para atualização.');
                        }
                    } catch (error) {
                        console.error('Erro ao salvar preço de custo:', error);
                        alert('Erro ao atualizar preço.');
                    } finally {
                        syncPrecoBtn.innerHTML = originalBtnHtml;
                        syncPrecoBtn.disabled = false;
                    }
                });
            }\`;

js = js.replace(target3, replacement3).replace(target3.replace(/\\n/g, '\\r\\n'), replacement3.replace(/\\n/g, '\\r\\n'));

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Script final concluído!');
