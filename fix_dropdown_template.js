const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

// 1. Encontrar o block do html do status para fabrica
const htmlRegex = /statusHtml = \`<select data-quantidade="\$\{item\.quantidadePedido\}" class="fabrica-status-select[\s\S]*?<\/select>\`;/;

const customHtml = `
                                const statusOptions = ['Criado', 'Em Produção', 'Finalizado'];
                                let pBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                let currentStatus = (itemStatus === 'criado' || itemStatus === 'pendente') ? 'CRIADO' : (itemStatus.includes('produ') ? 'EM PRODUÇÃO' : 'FINALIZADO');
                                if (currentStatus === 'EM PRODUÇÃO') pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                                if (currentStatus === 'FINALIZADO') pBadgeClass = 'bg-green-100 text-green-800 border-green-200';

                                let dropdownOptions = statusOptions.map(s => {
                                    let dotColor = 'bg-yellow-400';
                                    if (s === 'Em Produção') dotColor = 'bg-blue-400';
                                    if (s === 'Finalizado') dotColor = 'bg-green-400';
                                    return \`<button type="button" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 fabrica-dropdown-option" data-value="\${s}" data-order-code="\${item.orderCode}" data-codigo-service="\${item.codigoService}" data-quantidade="\${item.quantidadePedido}"><span class="w-2 h-2 rounded-full \${dotColor}"></span>\${s}</button>\`;
                                }).join('');

                                statusHtml = \`
                                <div class="relative inline-block text-left fabrica-custom-dropdown" data-dropdown-container>
                                    <button type="button" class="fabrica-custom-dropdown-btn px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border \${pBadgeClass} min-w-[120px] transition-all hover:shadow-sm">
                                        <span class="flex-1 text-center">\${currentStatus}</span>
                                        <svg class="w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </button>
                                    <div class="fabrica-custom-dropdown-menu absolute left-1/2 -translate-x-1/2 mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-[60] hidden overflow-hidden py-1">
                                        \${dropdownOptions}
                                    </div>
                                </div>\`;
`;

js = js.replace(htmlRegex, customHtml);

// 2. Encontrar o event listener do .fabrica-status-select e trocar pela lógica dos botões
const listenerRegex = /_ordersTableContent\.querySelectorAll\('\.fabrica-status-select'\)\.forEach\(selectElem => \{[\s\S]*?\}\);[\n\s]*\}\);/g;

const customListener = `
                    // Listener para fechar dropdowns se clicar fora
                    if (!window._fabricaGlobalClickSet) {
                        document.addEventListener('click', () => {
                            document.querySelectorAll('.fabrica-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
                        });
                        window._fabricaGlobalClickSet = true;
                    }

                    _ordersTableContent.querySelectorAll('.fabrica-custom-dropdown-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            document.querySelectorAll('.fabrica-custom-dropdown-menu:not(.hidden)').forEach(m => {
                                if (m !== btn.nextElementSibling) m.classList.add('hidden');
                            });
                            const menu = btn.nextElementSibling;
                            if (menu) menu.classList.toggle('hidden');
                        });
                    });

                    _ordersTableContent.querySelectorAll('.fabrica-dropdown-option').forEach(optionBtn => {
                        optionBtn.addEventListener('click', async (event) => {
                            event.stopPropagation();
                            const menu = event.target.closest('.fabrica-custom-dropdown-menu');
                            if (menu) menu.classList.add('hidden');

                            const newStatus = event.target.closest('button').dataset.value;
                            const { orderCode, codigoService, quantidade } = event.target.closest('button').dataset;
                            const requisitionType = 'fabrica';

                            // Extrair o current status (texto atual do botão principal) para ver se não é o mesmo
                            const btnMain = menu.previousElementSibling;
                            const currentStatusStr = btnMain.querySelector('span').textContent.trim();
                            if (newStatus.toUpperCase() === currentStatusStr.toUpperCase()) return; // não mudou

                            if (newStatus === 'Finalizado') {
                                // Call the exact same logic as checking the checkbox
                                const tr = event.target.closest('tr');
                                const checkbox = tr.querySelector('.order-item-checkbox');
                                if (checkbox) {
                                    checkbox.checked = true;
                                    _handleItemStatusChange(orderCode, codigoService, requisitionType, checkbox);
                                }
                            } else if (newStatus === 'Em Produção') {
                                // Trigger generic prompt for Responsável
                                _promptGeneric("Responsável", "Insira o nome do responsável:", async (ans) => {
                                    if (!ans) return;
                                    
                                    const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                                    if (detailsBox) detailsBox.style.display = 'none';
                                    _loadingOverlay.querySelector('p').textContent = 'Enviando p/ Linha...';
                                    _loadingOverlay.classList.remove('hidden');

                                    try {
                                        const updateOrderRes = await fetch(API_URLS.ORDERS_UPDATE, {
                                            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                orderCode, codigoService, newStatus: 'Em Produção', requisitionType
                                            })
                                        });
                                        if (!updateOrderRes.ok) throw new Error("Erro ao atualizar status na requisição");

                                        const targetItemDesc = _allOrdersFabrica.flatMap(o => o.rawItems).find(i => i.orderCode === orderCode && i.codigoService === codigoService);
                                        const dt = new Date();
                                        const dtStr = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
                                        
                                        const linhaPayload = {
                                            pedidoId: orderCode,
                                            itemCodigo: codigoService,
                                            newStatus: 'Em Produção',
                                            itemIndex: 1,
                                            newDescription: targetItemDesc ? targetItemDesc.descricao : '',
                                            responsavel: ans,
                                            numeroPedido: orderCode,
                                            quantidade: quantidade || 1,
                                            dataPedido: dtStr,
                                            origem: 'Reposição'
                                        };
                                        const linhaRes = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                                            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(linhaPayload)
                                        });
                                        
                                        const targetItem = _allOrdersFabrica.flatMap(o => o.rawItems).find(i => i.orderCode === orderCode && i.codigoService === codigoService);
                                        if (targetItem) targetItem.situacao = 'Em Produção';
                                        
                                        _showMessageModal("Sucesso", "Status alterado para Em Produção e enviado para a Linha de Produção.");
                                    } catch (e) {
                                        _showMessageModal("Erro", "Erro ao mudar status: " + e.message);
                                    } finally {
                                        _loadingOverlay.classList.add('hidden');
                                        _renderConsolidatedOrdersTable();
                                    }
                                }, "text");
                            } else if (newStatus === 'Criado') {
                                const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                                if (detailsBox) detailsBox.style.display = 'none';
                                _loadingOverlay.querySelector('p').textContent = 'Atualizando status...';
                                _loadingOverlay.classList.remove('hidden');

                                try {
                                    const updateOrderRes = await fetch(API_URLS.ORDERS_UPDATE, {
                                        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            orderCode, codigoService, newStatus: 'Criado', requisitionType
                                        })
                                    });
                                    if (!updateOrderRes.ok) throw new Error("Erro ao atualizar status");
                                    const targetItem = _allOrdersFabrica.flatMap(o => o.rawItems).find(i => i.orderCode === orderCode && i.codigoService === codigoService);
                                    if (targetItem) targetItem.situacao = 'Criado';
                                } catch (e) {
                                    _showMessageModal("Erro", "Erro ao mudar status: " + e.message);
                                } finally {
                                    _loadingOverlay.classList.add('hidden');
                                    _renderConsolidatedOrdersTable();
                                }
                            }
                        });
                    });
`;

js = js.replace(listenerRegex, customListener);

fs.writeFileSync('js/main.js', js);
console.log('Template do dropdown alterado!');
