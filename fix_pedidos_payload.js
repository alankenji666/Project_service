const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarPedidos.js', 'utf8');

const regex = /handleDropdownItemStatus: async function\([\s\S]*?handleToggleItemStatus: async function\(/;

const newHandleDropdown = `handleDropdownItemStatus: async function(pedidoId, itemCodigo, newStatus, index, currentStatus, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (newStatus === currentStatus) return;

            document.querySelectorAll('.pedido-item-custom-dropdown-menu').forEach(m => m.classList.add('hidden'));

            const pCache = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            
            if (newStatus === 'EM PRODUÇÃO' && pCache) {
                const sit = String(pCache.situação || pCache.situacao || '').toLowerCase().trim();
                if (sit.includes('atendid')) {
                    _showCustomAlert('Ação não permitida', 'Não é possivel alterar o item para "Em Produção", o pedido está como "Atendido"', false);
                    return;
                }
            }

            const executeUpdate = async (responsavel = '') => {
                try {
                    let currentDesc = '';
                    if (pCache && pCache.detalhesProducao) {
                        const keyId = \`\${pedidoId}-\${index}\`;
                        const keyNum = \`\${pCache.numero || pCache.numero_pedido}-\${index}\`;
                        const extra = pCache.detalhesProducao[keyId] || pCache.detalhesProducao[keyNum];
                        if (extra) currentDesc = extra.descricao || '';
                    }
                    if (!currentDesc) {
                        const prod = window._enrichedProductsMap ? window._enrichedProductsMap[itemCodigo] : null;
                        if (prod && prod.descricao) currentDesc = prod.descricao;
                    }

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
                            newStatus: newStatus === 'FINALIZADO' ? 'OK' : newStatus,
                            itemIndex: index,
                            newDescription: currentDesc,
                            responsavel: responsavel,
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
                        pCache.detalhesProducao[\`\${pedidoId}-\${index}\`] = { status: newStatus === 'FINALIZADO' ? 'OK' : newStatus, descricao: currentDesc };
                    }

                    _renderOrderDetailsModal(pedidoId);

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
                await executeUpdate('');
            }
        },
        handleToggleItemStatus: async function(`;

js = js.replace(regex, newHandleDropdown);

// 3. Remover chamadas duplicadas de listener global que podem estar causando problemas, adicionando um listener global lá em cima
// Mas nós fizemos onclick com dropdown-menu document.querySelectorAll e this.nextElementSibling.classList.toggle('hidden') inline, então tá bom!

fs.writeFileSync('js/modulos/gerenciarPedidos.js', js);
console.log('Script modificado com payload completo!');
