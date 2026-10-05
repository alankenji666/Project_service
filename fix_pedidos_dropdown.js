const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarPedidos.js', 'utf8');

// 1. Substituir _createItemStatusBadge
const createBadgeRegex = /function _createItemStatusBadge\(status, pedidoId, itemCodigo, index\) \{[\s\S]*?return \`[\s\S]*?<\/button>\s*\`;\s*\}/;

const newCreateBadge = `function _createItemStatusBadge(status, pedidoId, itemCodigo, index) {
        const s = String(status || 'CRIADO').toUpperCase().trim();
        let currentStatus = s === 'OK' ? 'FINALIZADO' : s;
        if (currentStatus === 'PENDENTE') currentStatus = 'CRIADO';
        if (currentStatus === 'PRODUCAO' || currentStatus === 'EM PRODUCAO') currentStatus = 'EM PRODUÇÃO';
        
        const statusOptions = ['CRIADO', 'EM PRODUÇÃO', 'FINALIZADO'];
        if (!statusOptions.includes(currentStatus)) {
            currentStatus = 'CRIADO'; // Default fallback
        }

        let pBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
        if (currentStatus === 'EM PRODUÇÃO') pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
        if (currentStatus === 'FINALIZADO') pBadgeClass = 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';

        let dropdownOptions = statusOptions.map(opt => {
            let dotColor = 'bg-yellow-400';
            if (opt === 'EM PRODUÇÃO') dotColor = 'bg-blue-400';
            if (opt === 'FINALIZADO') dotColor = 'bg-green-400';
            return \`<button type="button" onclick="GerenciarPedidosApp.handleDropdownItemStatus('\${pedidoId}', '\${itemCodigo}', '\${opt}', \${index}, '\${currentStatus}', event)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 pedido-item-dropdown-option"><span class="w-2 h-2 rounded-full \${dotColor}"></span>\${opt}</button>\`;
        }).join('');

        return \`
        <div class="relative inline-block text-left" data-dropdown-container>
            <button type="button" onclick="event.stopPropagation(); document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => { if(m !== this.nextElementSibling) m.classList.add('hidden') }); this.nextElementSibling.classList.toggle('hidden');" class="px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border \${pBadgeClass} min-w-[120px] transition-all cursor-pointer shadow-sm">
                <span class="flex-1 text-center">\${currentStatus}</span>
                <svg class="w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="pedido-item-custom-dropdown-menu absolute right-0 mt-1.5 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-[60] hidden overflow-hidden py-1">
                \${dropdownOptions}
            </div>
        </div>\`;
    }`;

js = js.replace(createBadgeRegex, newCreateBadge);

// 2. Adicionar o handleDropdownItemStatus
// Find the exact line "handleToggleItemStatus: async function(" and insert before it
const handleToggleRegex = /handleToggleItemStatus: async function\(pedidoId, itemCodigo, currentStatus, index, event\) \{/;

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
                        const key = \`\${pedidoId}-\${index}\`;
                        if (pCache.detalhesProducao[key]) currentDesc = pCache.detalhesProducao[key].descricao || '';
                    }
                    if (!currentDesc) {
                        const prod = _enrichedProductsMap ? _enrichedProductsMap[itemCodigo] : null;
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
                            newStatus: newStatus === 'FINALIZADO' ? 'OK' : newStatus, // Mantemos 'OK' no back-end por compatibilidade? Melhor usar o newStatus!
                            itemIndex: index,
                            newDescription: currentDesc,
                            responsavel: responsavel,
                            numeroPedido: pCache ? (pCache.numero || pCache.numero_pedido || '') : '',
                            quantidade: index !== undefined && pCache ? ((pCache.itens || [])[index] ? (pCache.itens[index].quantidade || 1) : 1) : 1,
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
                _promptGeneric("Responsável", "Insira o nome do responsável:", async (ans) => {
                    if (!ans) return;
                    await executeUpdate(ans);
                }, "text");
            } else {
                await executeUpdate('');
            }
        },
        handleToggleItemStatus: async function(pedidoId, itemCodigo, currentStatus, index, event) {`;

js = js.replace(handleToggleRegex, newHandleDropdown);

fs.writeFileSync('js/modulos/gerenciarPedidos.js', js);
console.log('Script modificado com sucesso!');
