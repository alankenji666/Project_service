const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. In _renderProdutoResults, change 'preco: parseFloat(p.preco || 0)' to 'preco: parseFloat(p.preco_de_custo) || parseFloat(p.preco || 0)'
js = js.replace(/peso: parseFloat\(p\.peso_bruto \|\| p\.peso_liquido \|\| 0\),\s*preco: parseFloat\(p\.preco \|\| 0\)/g, 
\`peso: parseFloat(p.peso_bruto || p.peso_liquido || 0),
                            preco: parseFloat(p.preco_de_custo) || parseFloat(p.preco || 0)\`);

// 2. In _renderOrderItems, change the TD for the price.
let oldTdPrice = \`<td class="px-4 py-3 text-right">
                    <span class="font-bold text-emerald-600">\${(item.preco || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                </td>\`;
let newTdPrice = \`<td class="px-4 py-3">
                    <div class="flex items-center gap-2 justify-end" onclick="event.stopPropagation()">
                        <span class="font-bold text-emerald-600">R$</span>
                        <input type="text" class="garantia-item-preco-input w-24 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-600" value="\${(item.preco || 0).toFixed(2).replace('.', ',')}">
                        <button type="button" class="garantia-item-sync-preco-btn flex-shrink-0 p-1 text-emerald-500 hover:text-emerald-700 bg-white rounded shadow-sm border border-gray-200 hidden transition-all" title="Salvar novo preço de custo no cadastro do produto" data-original-preco="\${(item.preco || 0).toFixed(2).replace('.', ',')}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        </button>
                    </div>
                </td>\`;

// Let's make sure it handles Windows CRLF
let cleanJs = js.replace(/\\r\\n/g, '\\n');
let cleanOldTdPrice = oldTdPrice.replace(/\\r\\n/g, '\\n');

if (cleanJs.includes(cleanOldTdPrice)) {
    cleanJs = cleanJs.replace(cleanOldTdPrice, newTdPrice);
} else {
    console.log('Failed to replace oldTdPrice');
}

// 3. In _renderOrderItems, add event listeners for the new price input and button.
// We can inject it right after the syncPesoBtn block.
let oldPesoBlockEnd = \`                                            break;
                                        }
                                    }
                                } catch(e) {
                                    lastError = e;
                                }
                                
                                if (!updateSuccess && attempt < maxRetries) {
                                    console.warn(\\\`[Garantia] Tentativa \\\${attempt + 1}/\\\${maxRetries} falhou ao salvar peso. Tentando novamente em \\\${retryDelays[attempt]/1000}s...\\\`);
                                    await new Promise(r => setTimeout(r, retryDelays[attempt]));
                                }
                            }
                            
                            if (updateSuccess) {
                                syncPesoBtn.dataset.originalPeso = currentPeso.toFixed(3);
                                syncPesoBtn.classList.add('hidden');
                                if (window._allProducts) {
                                    const p = window._allProducts.find(x => String(x.id) === String(productIdToUpdate));
                                    if (p) {
                                        p.peso_bruto = currentPeso;
                                        p.peso_liquido = currentPeso;
                                    }
                                }
                                alert('Peso atualizado com sucesso no Bling!');
                            } else {
                                alert('Falha ao atualizar o peso no Bling aps vrias tentativas. Tente novamente mais tarde.');
                            }
                        } else {
                            alert('Produto no encontrado no cache local para atualizao.');
                        }
                    } catch (error) {
                        console.error('Erro ao salvar peso:', error);
                        alert('Falha ao atualizar peso no Bling.');
                    } finally {
                        syncPesoBtn.innerHTML = originalBtnHtml;
                        syncPesoBtn.disabled = false;
                    }
                });
            }\`;

// We inject right after that closing brace of if(pesoInput && syncPesoBtn)
let newPrecoBlock = \`
            const precoInput = tr.querySelector('.garantia-item-preco-input');
            const syncPrecoBtn = tr.querySelector('.garantia-item-sync-preco-btn');
            if (precoInput && syncPrecoBtn) {
                
                // Formatação monetária ao digitar
                precoInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\\D/g, '');
                    if (val === '') {
                        e.target.value = '0,00';
                    } else {
                        val = (parseInt(val) / 100).toFixed(2).replace('.', ',');
                        e.target.value = val;
                    }
                    
                    const originalPreco = syncPrecoBtn.dataset.originalPreco;
                    const currentPreco = precoInput.value;
                    
                    item.preco = parseFloat(currentPreco.replace('.', '').replace(',', '.'));
                    _renderOrderTotal(); // Atualiza total na hora!
                    
                    if (currentPreco !== originalPreco) {
                        syncPrecoBtn.classList.remove('hidden');
                    } else {
                        syncPrecoBtn.classList.add('hidden');
                    }
                });

                syncPrecoBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const currentPreco = parseFloat(String(precoInput.value).replace('.', '').replace(',', '.')) || 0;
                    const originalBtnHtml = syncPrecoBtn.innerHTML;
                    
                    syncPrecoBtn.innerHTML = \\\`<svg class="animate-spin h-4 w-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\\\`;
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
                                    if (res.ok) {
                                        updateSuccess = true;
                                        break;
                                    }
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
                    } finally {
                        syncPrecoBtn.innerHTML = originalBtnHtml;
                        syncPrecoBtn.disabled = false;
                    }
                });
            }
\`;

let cleanOldPesoBlockEnd = oldPesoBlockEnd.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '').replace(//g, 'a'); // handles some encode parsing issues occasionally
// We use a safe indexOf on a shorter substring to avoid exact matching failures
const searchKey = "syncPesoBtn.disabled = false;\\n                    }\\n                });\\n            }";

if (cleanJs.indexOf(searchKey) !== -1) {
    cleanJs = cleanJs.replace(searchKey, searchKey + newPrecoBlock);
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', cleanJs);
    console.log('Script ran successfully!');
} else {
    // try removing spaces and newlines to match
    let noSpaceJs = cleanJs.replace(/\\s+/g, '');
    let noSpaceKey = searchKey.replace(/\\s+/g, '');
    if (noSpaceJs.includes(noSpaceKey)) {
        console.log('Found with no spaces, but need exact replace.');
    } else {
        console.log('Could not find injection point for preco logic.');
    }
}
