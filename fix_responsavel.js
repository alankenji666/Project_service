const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarPedidos.js', 'utf8');

const regex = /const executeUpdate = async \(responsavel = ''\) => \{[\s\S]*?await executeUpdate\(''\);\s*\}/;

const newExecuteUpdate = `const executeUpdate = async (responsavel) => {
                try {
                    let currentDesc = '';
                    let currentResp = '';
                    if (pCache && pCache.detalhesProducao) {
                        const keyId = \`\${pedidoId}-\${index}\`;
                        const keyNum = \`\${pCache.numero || pCache.numero_pedido}-\${index}\`;
                        const extra = pCache.detalhesProducao[keyId] || pCache.detalhesProducao[keyNum];
                        if (extra) {
                            currentDesc = extra.descricao || '';
                            currentResp = extra.responsavel || '';
                        }
                    }
                    if (!currentDesc) {
                        const prod = _enrichedProductsMap ? _enrichedProductsMap[itemCodigo] : null;
                        if (prod && prod.descricao) currentDesc = prod.descricao;
                    }
                    if (!currentDesc && pCache && pCache.itens && pCache.itens[index]) {
                        currentDesc = pCache.itens[index].descricao || pCache.itens[index].descricaoPersonalizada || '';
                    }

                    const finalResponsavel = (responsavel !== undefined && responsavel !== null) ? responsavel : currentResp;

                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) {
                        const detailsBox = loadingOverlay.querySelector('.bg-gray-900');
                        if (detailsBox) detailsBox.style.display = 'none';
                        const p = loadingOverlay.querySelector('p');
                        if (p) p.textContent = 'Enviando p/ Linha...';
                        loadingOverlay.classList.remove('hidden');
                    }

                    const response = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pedidoId,
                            itemCodigo,
                            newStatus: newStatus === 'OK' ? 'FINALIZADO' : newStatus,
                            itemIndex: index,
                            newDescription: currentDesc,
                            responsavel: finalResponsavel,
                            numeroPedido: pCache ? (pCache.numero || pCache.numero_pedido || '') : '',
                            quantidade: index !== undefined && pCache ? (_parseItens(pCache.itens, pCache.detalhesProducao || {}, pedidoId)[index]?.quantidade || 1) : 1,
                            dataPedido: pCache ? (pCache.data || pCache.data_criacao || '') : '',
                            origem: 'Pedido'
                        })
                    });

                    if (loadingOverlay) loadingOverlay.classList.add('hidden');

                    if (!response.ok) {
                        const errTxt = await response.text();
                        throw new Error(errTxt || 'Erro ao atualizar status do item');
                    }

                    // Sincronização de Cache
                    if (pCache) {
                        if (!pCache.detalhesProducao) pCache.detalhesProducao = {};
                        pCache.detalhesProducao[\`\${pedidoId}-\${index}\`] = { 
                            status: newStatus === 'OK' ? 'FINALIZADO' : newStatus, 
                            descricao: currentDesc,
                            responsavel: finalResponsavel
                        };
                    }

                    _openOrderDetailsModal(pedidoId);

                } catch (error) {
                    console.error("Erro ao alternar status do item:", error);
                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) loadingOverlay.classList.add('hidden');
                    alert("Erro ao salvar: " + error.message);
                }
            };

            if (newStatus === 'EM PRODUÇÃO') {
                if (window._promptGeneric) {
                    window._promptGeneric("Responsável", "Insira o nome do responsável:", async (ans) => {
                        if (!ans) return;
                        await executeUpdate(ans);
                    }, "text");
                } else {
                    const ans = prompt("Insira o nome do responsável:");
                    if (!ans) return;
                    await executeUpdate(ans);
                }
            } else {
                await executeUpdate();
            }`;

js = js.replace(regex, newExecuteUpdate);
fs.writeFileSync('js/modulos/gerenciarPedidos.js', js);
console.log('Script atualizado com manutenção do responsável');
