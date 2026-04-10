import { API_URLS } from '../apiConfig.js';
import { debounce } from '../utils.js';

export const GerenciarPedidosApp = (function () {
    let _allPedidos = [];
    let _filteredPedidos = [];
    let _state = {
        currentPage: 1,
        pageSize: 30,
        sortKey: 'data',
        sortDir: 'desc'
    };
    let _tableContent, _searchInput, _loadingEl, _noMessageEl;
    let _startDateInput, _endDateInput, _dateRadios, _clearFiltersBtn, _statusSelect, _yearFilter;
    let _paginationContainer, _paginationTopContainer, _tableHeaders;
    let _selectAllCheckbox, _batchActionsContainer, _selectedCountSpan, _batchAttendBtn;
    let _isInitialized = false;
    let _lastHoveredRowId = null;
    let _currentModalPedidoId = null; // ID do pedido aberto no modal
    let _enrichedProductsMap = {}; // Mapa para cachear dados de produtos do modal

    function _getVendedorName(vendedor) {
        if (!vendedor) return '-';
        const v = String(vendedor).trim();
        if (v === '15596443455') return 'Reginaldo Araujo de Souza';
        if (v === '15596443462') return 'Julio Martins dos Santos';
        if (v === '15596442848') return 'Rodrigo Carbone';
        if (v.includes('ID:')) {
            const id = v.replace('ID:', '').trim();
            if (id === '15596443455') return 'Reginaldo Araujo de Souza';
            if (id === '15596443462') return 'Julio Martins dos Santos';
            if (id === '15596442848') return 'Rodrigo Carbone';
        }
        return vendedor;
    }

    function _fmtData(str) {
        if (!str) return '-';
        // Aceita yyyy-mm-dd ou yyyy/mm/dd e converte para dd/mm/aaaa
        const m = String(str).match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return str; // Devolve original se não reconhece
    }

    function _parseNumber(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        
        // Remove símbolos de moeda, espaços e pontos de milhar
        let clean = String(val).trim().replace(/[R$\s]/g, '');
        
        // Se tem ponto e vírgula, ex: 1.234,56 -> 1234.56
        if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } 
        // Se tem apenas vírgula, ex: 150,90 -> 150.90
        else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
        }
        
        const res = parseFloat(clean);
        return isNaN(res) ? 0 : res;
    }

    function _cacheDom() {
        _tableContent = document.getElementById('pedidos-table-content');
        _searchInput = document.getElementById('pedidos-search-input');
        _loadingEl = document.getElementById('pedidos-loading');
        _noMessageEl = document.getElementById('no-pedidos-message');
        _startDateInput = document.getElementById('pedidos-start-date');
        _endDateInput = document.getElementById('pedidos-end-date');
        _dateRadios = document.querySelectorAll('.pedidos-date-radio');
        _clearFiltersBtn = document.getElementById('pedidos-clear-filters-btn');
        _statusSelect = document.getElementById('pedidos-status-select');
        _yearFilter = document.getElementById('pedidos-year-filter');
        _paginationContainer = document.getElementById('pedidos-pagination-container');
        _paginationTopContainer = document.getElementById('pedidos-pagination-top-container');
        _tableHeaders = document.querySelectorAll('th[data-pedidos-sort]');
        
        _selectAllCheckbox = document.getElementById('pedidos-select-all');
        _batchActionsContainer = document.getElementById('pedidos-batch-actions');
        _selectedCountSpan = document.getElementById('pedidos-selected-count');
        _batchAttendBtn = document.getElementById('pedidos-batch-attend-btn');

        // Novos elementos do Modal de Edição Rápida
        _state.quickEditModal = document.getElementById('item-quick-edit-modal');
        _state.quickEditItemName = document.getElementById('quick-edit-product-name');
        _state.quickEditCostInput = document.getElementById('quick-edit-cost-price');
        _state.quickEditStockInput = document.getElementById('quick-edit-stock');
        _state.quickEditLocInput = document.getElementById('quick-edit-location');
        _state.quickEditLoading = document.getElementById('quick-edit-loading');
        _state.quickEditSaveBtn = document.getElementById('save-item-quick-edit-btn');
        _state.quickEditCancelBtn = document.getElementById('cancel-item-quick-edit-btn');
        _state.quickEditCloseBtn = document.getElementById('close-item-quick-edit-modal-btn');
    }

    function _bindEvents() {
        if (_searchInput) {
            _searchInput.addEventListener('input', debounce(_filterPedidos, 300));
        }
        if (_startDateInput) _startDateInput.addEventListener('change', () => { _clearDateRadios(); _filterPedidos(); });
        if (_endDateInput) _endDateInput.addEventListener('change', () => { _clearDateRadios(); _filterPedidos(); });
        if (_statusSelect) _statusSelect.addEventListener('change', _filterPedidos);
        if (_yearFilter) _yearFilter.addEventListener('change', _filterPedidos);
        if (_dateRadios) {
            _dateRadios.forEach(radio => radio.addEventListener('change', _handleDatePresetChange));
        }
        if (_clearFiltersBtn) {
            _clearFiltersBtn.addEventListener('click', _clearFilters);
        }
        if (_tableHeaders) {
            _tableHeaders.forEach(th => th.addEventListener('click', _handleSort));
        }
        
        if (_selectAllCheckbox) {
            _selectAllCheckbox.addEventListener('change', _handleSelectAllToggle);
        }
        if (_batchAttendBtn) {
            _batchAttendBtn.addEventListener('click', () => _handleBatchChangeStatus(9, 'Atendido'));
        }
        
        // Novos botões de lote no topo da tabela
        const batchOpenBtn = document.getElementById('pedidos-batch-open-btn');
        const batchProdBtn = document.getElementById('pedidos-batch-prod-btn');
        
        if (batchOpenBtn) batchOpenBtn.addEventListener('click', () => _handleBatchChangeStatus(6, 'Em Aberto'));
        if (batchProdBtn) batchProdBtn.addEventListener('click', () => _handleBatchChangeStatus(447331, 'Em Produção'));

        if (_tableContent) {
            _tableContent.addEventListener('mouseover', (e) => {
                const tr = e.target.closest('tr');
                if (tr) {
                    const id = tr.querySelector('td')?.innerText;
                    if (id && id !== _lastHoveredRowId) {
                        _lastHoveredRowId = id;
                        if (typeof Toastify !== 'undefined') {
                            Toastify({
                                text: "Em desenvolvimento",
                                duration: 1500,
                                gravity: "bottom",
                                position: "right",
                                style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
                            }).showToast();
                        }
                    }
                }
            });
            _tableContent.addEventListener('mouseout', () => {
                _lastHoveredRowId = null;
            });
            _tableContent.addEventListener('click', (e) => {
                const obsBtn = e.target.closest('.edit-order-observation-btn');
                if (obsBtn && _state.openOrderObservationModal) {
                    _state.openOrderObservationModal(obsBtn.dataset.targetId);
                    return;
                }
                
                // Somente abre o modal se clicar em uma célula explicitamente clicável
                if (!e.target.closest('.clickable-cell')) {
                    return;
                }

                const tr = e.target.closest('tr');
                if (tr) {
                    const orderNumber = tr.dataset.orderNumber;
                    if (orderNumber) {
                        _openOrderDetailsModal(orderNumber);
                    }
                }
            });
            _tableContent.addEventListener('change', (e) => {
                if (e.target.classList.contains('pedido-row-checkbox')) {
                    _updateBatchSelectionState();
                }
            });
        }

        const closeOrderModalBtn = document.getElementById('close-order-modal-btn');
        if (closeOrderModalBtn) {
            closeOrderModalBtn.addEventListener('click', () => {
                const modal = document.getElementById('order-details-modal');
                if (modal) modal.classList.add('hidden');
            });
        }

        const toggleValoresChk = document.getElementById('modal-toggle-valores');
        if (toggleValoresChk) {
            toggleValoresChk.addEventListener('change', _handleModalToggleValores);
        }

        const printBtn = document.getElementById('modal-print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', _handleModalPrint);
        }

        // Novos botões de status no modal
        const openBtn = document.getElementById('modal-status-open-btn');
        const prodBtn = document.getElementById('modal-status-prod-btn');
        const attendBtn = document.getElementById('modal-status-attend-btn');
        
        if (openBtn) openBtn.addEventListener('click', () => _handleModalChangeStatus(6, 'Em Aberto'));
        if (prodBtn) prodBtn.addEventListener('click', () => _handleModalChangeStatus(447331, 'Em Produção'));
        if (attendBtn) attendBtn.addEventListener('click', () => _handleModalChangeStatus(9, 'Atendido'));

        // Eventos do Modal de Edição Rápida
        if (_state.quickEditCancelBtn) _state.quickEditCancelBtn.addEventListener('click', _closeQuickEditModal);
        if (_state.quickEditCloseBtn) _state.quickEditCloseBtn.addEventListener('click', _closeQuickEditModal);
        if (_state.quickEditSaveBtn) _state.quickEditSaveBtn.addEventListener('click', _saveItemQuickEdit);
    }

    function _handleSelectAllToggle(e) {
        if (!_tableContent) return;
        const isChecked = e.target.checked;
        const checkboxes = _tableContent.querySelectorAll('.pedido-row-checkbox');
        checkboxes.forEach(cb => cb.checked = isChecked);
        _updateBatchSelectionState();
    }

    function _updateBatchSelectionState() {
        if (!_tableContent || !_batchActionsContainer || !_selectedCountSpan) return;
        const checkedBoxes = _tableContent.querySelectorAll('.pedido-row-checkbox:checked');
        const totalChecked = checkedBoxes.length;
        
        _selectedCountSpan.textContent = totalChecked;
        if (totalChecked > 0) {
            _batchActionsContainer.classList.remove('hidden');
        } else {
            _batchActionsContainer.classList.add('hidden');
        }
        
        if (_selectAllCheckbox) {
            const allCheckboxes = _tableContent.querySelectorAll('.pedido-row-checkbox');
            _selectAllCheckbox.checked = allCheckboxes.length > 0 && totalChecked === allCheckboxes.length;
        }
    }

    function _openOrderDetailsModal(orderRef) {
        const modal = document.getElementById('order-details-modal');
        const content = document.getElementById('modal-order-content');
        const title = document.getElementById('modal-order-title');
        
        if (!modal || !content || !title) return;

        let pedido;
        // Se já recebeu o objeto do pedido, usa ele diretamente
        if (orderRef && typeof orderRef === 'object') {
            pedido = orderRef;
        } else {
            // Caso contrário, busca na lista convertendo tudo para String (mais seguro)
            const refStr = String(orderRef);
            pedido = _allPedidos.find(p => 
                String(p.id || '') === refStr || 
                String(p.número || '') === refStr || 
                String(p.numero || '') === refStr
            );
        }

        if (!pedido) {
            content.innerHTML = '<p class="text-center text-red-500">Pedido não encontrado.</p>';
            modal.classList.remove('hidden');
            return;
        }

        const orderNumber = pedido.numero || pedido.número || orderRef;

        // Salvar o ID do pedido atual no modal
        const pedidoId = pedido.id || pedido.id_pedido || pedido['id pedido'] || '';
        _currentModalPedidoId = pedidoId || orderNumber;
        modal.dataset.currentOrderNumber = orderNumber;

        // Gerenciar visibilidade dos botões de troca de status
        const situacaoCheckRaw = (pedido.situação || pedido.situacao || '').toLowerCase();
        
        const btnOpen = document.getElementById('modal-status-open-btn');
        const btnProd = document.getElementById('modal-status-prod-btn');
        const btnAttend = document.getElementById('modal-status-attend-btn');

        if (btnOpen && btnProd && btnAttend) {
            // Mostra todos por padrão
            [btnOpen, btnProd, btnAttend].forEach(b => b.classList.remove('hidden'));

            // Oculta o botão que corresponde à situação atual
            if (situacaoCheckRaw.includes('abert') || situacaoCheckRaw.includes('pendent')) {
                btnOpen.classList.add('hidden');
            } else if (situacaoCheckRaw.includes('atendid') || situacaoCheckRaw.includes('entregue') || situacaoCheckRaw.includes('conclu')) {
                btnAttend.classList.add('hidden');
            } else if (situacaoCheckRaw.includes('produ')) {
                btnProd.classList.add('hidden');
            }
        }

        // Reset toggle com valor
        const toggleChk = document.getElementById('modal-toggle-valores');
        if (toggleChk) toggleChk.checked = true;

        const numero = pedido.número || pedido.numero || orderNumber;
        title.innerText = `Pedido Nº ${numero}`;

        // --- Mapeamento de campos a ignorar ou tratar especialmente ---
        const ignoreKeys = ['id', 'id_pedido', 'id pedido', 'updatedAt'];
        const situacao = pedido.situação || pedido.situacao || '-';
        const sitLower = situacao.toLowerCase();
        let badge = 'bg-gray-100 text-gray-700';
        if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badge = 'bg-green-100 text-green-700';
        else if (sitLower.includes('cancel')) badge = 'bg-red-100 text-red-700';
        else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento')) badge = 'bg-yellow-100 text-yellow-700';

        // --- Cabeçalho resumido do pedido ---
        const cliente = pedido.contato_nome || pedido['contato nome'] || pedido.cliente || '-';
        const cpfCnpj = pedido.cpf_cnpj || pedido['cpf cnpj'] || pedido['cpf/cnpj'] || '';
        const data = _fmtData(pedido.data) || '-';
        const totalVal = _parseNumber(pedido.total_pedido || pedido['total pedido'] || pedido.total || pedido.valor_total || pedido.total_venda || 0);
        const totalFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal);
        const vendedorRaw = pedido.vendedor || '-';
        const vendedorName = _getVendedorName(vendedorRaw);

        // --- Info grid (campos gerais, excluindo ID e itens) ---
        const skipInGrid = [...ignoreKeys, 'numero', 'número', 'itens', 'situação', 'situacao', 'vendedor',
            'contato_nome', 'contato nome', 'cpf_cnpj', 'cpf cnpj', 'cpf/cnpj', 'data', 'total', 'total_pedido', 'total pedido'];

        let gridHtml = '';
        Object.entries(pedido).forEach(([key, value]) => {
            if (!skipInGrid.includes(key.toLowerCase()) && value) {
                const niceKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                let displayValue = value;
                // Formata valores que parecem datas (yyyy-mm-dd)
                if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
                    displayValue = _fmtData(String(value));
                } 
                // Formata campos de valor/total/preço como moeda
                else if (key.toLowerCase().includes('total') || 
                         key.toLowerCase().includes('preco') || 
                         key.toLowerCase().includes('preço') || 
                         key.toLowerCase().includes('valor') ||
                         key.toLowerCase().includes('custo')) {
                    const numVal = _parseNumber(value);
                    displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numVal);
                }

                gridHtml += `
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">${niceKey}</span>
                        <span class="block text-sm text-gray-800 break-words">${displayValue}</span>
                    </div>`;
            }
        });

        // --- Itens: parse da string "(codigo, qtd, valor)" ---
        const itensRaw = pedido.itens || pedido.Itens || '';
        let itensHtml = '';
        if (itensRaw) {
            const itensList = _parseItens(itensRaw);
            if (itensList.length > 0) {
                itensHtml = `
                <div class="mt-6">
                    <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Itens do Pedido</h3>
                    <div id="pedido-modal-itens-container">
                        <table class="min-w-full divide-y divide-gray-200 text-sm rounded-lg overflow-hidden">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Produto</th>
                                    <th class="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Qtd</th>
                                    <th class="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Estoque</th>
                                    <th class="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Valor</th>
                                </tr>
                            </thead>
                            <tbody id="pedido-modal-itens-body" class="bg-white divide-y divide-gray-100">
                                ${itensList.map(item => `
                                    <tr data-item-codigo="${item.codigo}" class="cursor-pointer hover:bg-gray-50 transition-colors item-row">
                                        <td class="px-4 py-3" onclick="GerenciarPedidosApp.handleItemClick('${item.codigo}')">
                                            <div class="flex items-center gap-3">
                                                <img id="img-${item.codigo}" src="https://placehold.co/48x48/e2e8f0/64748b?text=..." 
                                                     alt="" class="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                                                     onerror="this.src='https://placehold.co/48x48/e2e8f0/64748b?text=?'">
                                                <div>
                                                    <p class="font-medium text-gray-800" id="desc-${item.codigo}">${item.codigo}</p>
                                                    <p class="text-xs text-gray-400">${item.codigo}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-4 py-3 text-center text-gray-700" onclick="GerenciarPedidosApp.handleItemClick('${item.codigo}')">${item.quantidade}</td>
                                        <td class="px-4 py-3 text-center" id="stock-col-${item.codigo}" onclick="GerenciarPedidosApp.handleItemClick('${item.codigo}')">
                                            <span class="text-xs text-gray-400 italic">carregando...</span>
                                        </td>
                                        <td class="px-4 py-3 text-right font-semibold text-gray-800" onclick="GerenciarPedidosApp.handleItemClick('${item.codigo}')">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(_parseNumber(item.valor))}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;

                // Após renderizar, buscar imagens e descrições dos produtos
                setTimeout(() => _enrichItensWithProductData(itensList), 50);
            }
        }

        content.innerHTML = `
            <!-- Cabeçalho resumido -->
            <div class="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                    <p class="text-lg font-semibold text-gray-900">${cliente}</p>
                    ${cpfCnpj ? `<p class="text-xs text-gray-400 mt-0.5">${cpfCnpj}</p>` : ''}
                </div>
                <span class="px-3 py-1 text-xs font-bold uppercase rounded-full ${badge}">${situacao}</span>
            </div>

            <!-- Dados rápidos -->
            <div class="grid grid-cols-3 gap-3 mt-4">
                <div class="text-center bg-blue-50 rounded-lg p-3">
                    <p class="text-[10px] text-blue-400 uppercase font-bold">Data</p>
                    <p class="text-sm font-semibold text-blue-700 mt-1">${_fmtData(data)}</p>
                </div>
                <div class="text-center bg-green-50 rounded-lg p-3">
                    <p class="text-[10px] text-green-400 uppercase font-bold">Total</p>
                    <p class="text-sm font-semibold text-green-700 mt-1">${totalFmt}</p>
                </div>
                <div class="text-center bg-purple-50 rounded-lg p-3">
                    <p class="text-[10px] text-purple-400 uppercase font-bold">Vendedor</p>
                    <p class="text-sm font-semibold text-purple-700 mt-1 truncate" title="${vendedorName}">${vendedorName.split(' ')[0]}</p>
                </div>
            </div>

            <!-- Grid de demais campos -->
            ${gridHtml ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">${gridHtml}</div>` : ''}

            <!-- Tabela de itens -->
            ${itensHtml}
        `;

        modal.classList.remove('hidden');
    }

    function _parseItens(raw) {
        // Formato esperado: "(503070587, 1.00, 609.17)" ou múltiplos separados por "; " ou newline
        const results = [];
        const cleaned = String(raw).trim();
        // Cada item pode ser "(cod, qtd, val)"
        const regex = /\(([^)]+)\)/g;
        let match;
        while ((match = regex.exec(cleaned)) !== null) {
            const parts = match[1].split(',').map(s => s.trim());
            if (parts.length >= 3) {
                results.push({
                    codigo: parts[0],
                    quantidade: parseFloat(parts[1]) || 1,
                    valor: _parseNumber(parts[2]) || 0
                });
            } else if (parts.length === 2) {
                results.push({ codigo: parts[0], quantidade: parseFloat(parts[1]) || 1, valor: 0 });
            }
        }
        // Fallback: se não tiver parênteses, tenta vírgula simples
        if (results.length === 0 && cleaned) {
            const parts = cleaned.replace(/[()]/g, '').split(',').map(s => s.trim());
            if (parts.length >= 3) {
                results.push({ codigo: parts[0], quantidade: parseFloat(parts[1]) || 1, valor: _parseNumber(parts[2]) || 0 });
            } else if (parts.length > 0 && parts[0]) {
                results.push({ codigo: parts[0], quantidade: 1, valor: 0 });
            }
        }
        return results;
    }

    async function _enrichItensWithProductData(itensList) {
        try {
            const res = await fetch(`${API_URLS.PRODUCTS}?t=${Date.now()}`, { mode: 'cors' });
            if (!res.ok) return;
            const json = await res.json();
            const products = json.data || json || [];

            _enrichedProductsMap = {}; // Reset

            itensList.forEach(item => {
                const prod = products.find(p =>
                    String(p.codigo || '').trim() === String(item.codigo).trim()
                );
                if (!prod) {
                    const stockCol = document.getElementById(`stock-col-${item.codigo}`);
                    if (stockCol) stockCol.innerHTML = '<span class="text-xs text-red-400">N/A</span>';
                    return;
                }

                // Salvar no mapa local para uso no Quick Edit
                _enrichedProductsMap[item.codigo] = prod;

                const imgEl = document.getElementById(`img-${item.codigo}`);
                const descEl = document.getElementById(`desc-${item.codigo}`);
                const stockCol = document.getElementById(`stock-col-${item.codigo}`);

                if (imgEl && prod.url_imagens_externas && prod.url_imagens_externas[0]) {
                    imgEl.src = prod.url_imagens_externas[0];
                }
                if (descEl && prod.descricao) {
                    descEl.textContent = prod.descricao;
                }

                if (stockCol) {
                    const disponivel = parseFloat(prod.estoque) || 0;
                    const pedidoQty = parseFloat(item.quantidade) || 0;
                    if (disponivel >= pedidoQty) {
                        stockCol.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Disponível: ${disponivel}">OK</span>`;
                    } else {
                        stockCol.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title="Disponível: ${disponivel}">Sem Estoque</span>`;
                    }
                }
            });
        } catch (e) {
            console.warn('Não foi possível enriquecer itens com dados de produto:', e);
        }
    }

    // --- LOGICA DE EDIÇÃO RÁPIDA DE ITEM ---

    function handleItemClick(codigo) {
        const prod = _enrichedProductsMap[codigo];
        if (!prod) return;
        _openQuickEditModal(prod);
    }

    function _openQuickEditModal(prod) {
        if (!_state.quickEditModal) return;

        _state.currentEditingProduct = prod;

        if (_state.quickEditItemName) _state.quickEditItemName.textContent = `[${prod.codigo}] ${prod.descricao || ''}`;
        if (_state.quickEditCostInput) _state.quickEditCostInput.value = _parseNumber(prod.preco_de_custo).toFixed(2);
        if (_state.quickEditStockInput) _state.quickEditStockInput.value = _parseNumber(prod.estoque);
        if (_state.quickEditLocInput) _state.quickEditLocInput.value = prod.localizacao || '';

        _state.quickEditModal.classList.remove('hidden');
    }

    function _closeQuickEditModal() {
        if (_state.quickEditModal) _state.quickEditModal.classList.add('hidden');
        if (_state.quickEditLoading) _state.quickEditLoading.classList.add('hidden');
        if (_state.quickEditSaveBtn) _state.quickEditSaveBtn.disabled = false;
    }

    async function _saveItemQuickEdit() {
        const prod = _state.currentEditingProduct;
        if (!prod) return;

        const newCost = parseFloat(_state.quickEditCostInput.value);
        const newStock = parseFloat(_state.quickEditStockInput.value);
        const newLoc = _state.quickEditLocInput.value.trim();

        if (isNaN(newCost) || isNaN(newStock)) {
            alert('Por favor, insira valores válidos para preço e estoque.');
            return;
        }

        _state.quickEditLoading.classList.remove('hidden');
        _state.quickEditSaveBtn.disabled = true;

        try {
            // 1. Atualizar Detalhes (Custo e Localização)
            console.log(`[QuickEdit] Atualizando detalhes do produto ${prod.id}...`);
            const updateDetailsRes = await fetch(`${API_URLS.PRODUCTS}/${prod.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    preco_de_custo: newCost,
                    localizacao: newLoc
                })
            });

            if (!updateDetailsRes.ok) throw new Error('Falha ao atualizar detalhes do produto.');

            // 2. Atualizar Estoque (Balanço)
            console.log(`[QuickEdit] Atualizando estoque (Balanço) do produto ${prod.codigo}...`);
            const updateStockRes = await fetch(`${API_URLS.STOCK}/update-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    produto: { id: prod.id, codigo: prod.codigo },
                    operacaoBling: 'B', // Balanço
                    quantidadeFinal: newStock,
                    tipoEntrada: 'Ajuste Rápido no Pedido',
                    observacoes: 'Ajuste realizado durante a separação do pedido.'
                })
            });

            if (!updateStockRes.ok) throw new Error('Falha ao atualizar estoque.');

            // Sucesso!
            _closeQuickEditModal();

            // Mensagem de sucesso amigável
            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: "Produto atualizado com sucesso!",
                    duration: 2000,
                    gravity: "top",
                    position: "center",
                    style: { background: "#10b981" }
                }).showToast();
            }

            // Atualizar o modal de detalhes do pedido para refletir as mudanças (badges etc)
            const modal = document.getElementById('order-details-modal');
            const orderNumber = modal?.dataset?.currentOrderNumber;
            if (orderNumber) {
                // Pequeno delay para garantir que o cache da API de produtos limpou ou refletiu a mudança
                setTimeout(() => _openOrderDetailsModal(orderNumber), 500);
            }

        } catch (error) {
            console.error('[QuickEdit] Erro:', error);
            alert(`Erro ao salvar: ${error.message}`);
            _state.quickEditSaveBtn.disabled = false;
            _state.quickEditLoading.classList.add('hidden');
        }
    }

    function _handleModalToggleValores(e) {
        const showValor = e.target.checked;
        // Mostrar/ocultar a última coluna (valor) em thead e tbody
        const modal = document.getElementById('order-details-modal');
        if (!modal) return;
        const thValor = modal.querySelectorAll('table thead th:last-child');
        const tdValor = modal.querySelectorAll('table tbody td:last-child');
        [...thValor, ...tdValor].forEach(el => {
            el.style.display = showValor ? '' : 'none';
        });
    }

    function _handleModalPrint() {
        const modal = document.getElementById('order-details-modal');
        if (!modal) return;
        const orderNumber = modal.dataset.currentOrderNumber;
        if (!orderNumber) return;

        const pedido = _allPedidos.find(p => (p.id === orderNumber) || (p.número === orderNumber) || (p.numero === orderNumber));
        if (!pedido) return;

        // Verificar se valor deve ser incluído
        const showValor = document.getElementById('modal-toggle-valores')?.checked !== false;

        // Dados do pedido
        const numero     = pedido.número || pedido.numero || orderNumber;
        const cliente    = pedido.contato_nome || pedido['contato nome'] || pedido.cliente || '-';
        const cpfCnpj    = pedido.cpf_cnpj || pedido['cpf cnpj'] || pedido['cpf/cnpj'] || '';
        const data       = _fmtData(pedido.data) || '-';
        const dataSaida  = _fmtData(pedido.data_saida || pedido['data saida'] || '');
        const situacao   = pedido.situação || pedido.situacao || '-';
        const vendedor   = _getVendedorName(pedido.vendedor || '');
        const loja       = pedido.loja || '';
        const totalProd  = parseFloat(pedido.total_produtos || pedido['total produtos'] || 0);
        const totalPed   = parseFloat(pedido.total_pedido   || pedido['total pedido']   || pedido.total || 0);
        const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

        // Itens
        const itensRaw = pedido.itens || pedido.Itens || '';
        const itensList = _parseItens(itensRaw);

        // Montar linhas da tabela a partir das imagens já carregadas no modal
        const itensRows = itensList.map(item => {
            const imgEl  = document.getElementById(`img-${item.codigo}`);
            const descEl = document.getElementById(`desc-${item.codigo}`);
            const imgSrc = imgEl?.src || '';
            const desc   = descEl?.textContent || item.codigo;
            const valorCol = showValor ? `<td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${fmtBRL(item.valor)}</td>` : '';
            return `
                <tr>
                    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            ${imgSrc && !imgSrc.includes('placehold.co') ? `<img src="${imgSrc}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;">` : '<div style="width:44px;height:44px;background:#f1f5f9;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;"></div>'}
                            <div>
                                <div style="font-weight:600;font-size:13px;color:#1e293b;">${desc}</div>
                                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Cód: ${item.codigo}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;color:#475569;">${item.quantidade}</td>
                    ${valorCol}
                </tr>`;
        }).join('');

        const totalHeader = showValor ? '<th style="padding:10px 14px;background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b;text-align:right;">Valor</th>' : '';
        const totalFooter = showValor ? `
            <tr style="background:#f0fdf4;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#15803d;">Total</td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#15803d;text-align:right;">${fmtBRL(totalPed)}</td>
            </tr>` : '';

        const now = new Date().toLocaleString('pt-BR');

        const printWindow = window.open('', '_blank', 'width=850,height=750');
        printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Pedido Nº ${numero}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 32px; }

        /* Cabeçalho */
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 20px; }
        .doc-header .title { font-size: 22px; font-weight: 800; color: #1e40af; }
        .doc-header .meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
        .doc-header .meta strong { color: #1e293b; font-size: 13px; }

        /* Bloco cliente */
        .client-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; }
        .client-block .name { font-size: 15px; font-weight: 700; color: #0f172a; }
        .client-block .sub  { font-size: 12px; color: #64748b; margin-top: 3px; }
        .badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 3px 10px; border-radius: 999px; margin-top: 6px; }
        .badge-yellow { background: #fef9c3; color: #854d0e; }
        .badge-green  { background: #dcfce7; color: #166534; }
        .badge-red    { background: #fee2e2; color: #991b1b; }
        .badge-gray   { background: #f1f5f9; color: #475569; }

        /* Grid de info */
        .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
        .info-box .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: .05em; margin-bottom: 4px; }
        .info-box .val { font-size: 13px; font-weight: 600; color: #1e293b; }

        /* Tabela itens */
        .items-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: .06em; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        thead th { background: #1e40af; color: #fff; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left; }
        thead th:last-child { text-align: right; }

        /* Rodapé */
        .doc-footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: right; }

        @media print {
            body { padding: 20px; }
            @page { margin: 15mm; }
        }
    </style>
</head>
<body>
    <div class="doc-header">
        <div>
            <div class="title">Pedido Nº ${numero}</div>
            ${loja ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">Via ${loja}</div>` : ''}
        </div>
        <div class="meta">
            <strong>GestorApp</strong><br>
            Emitido em: ${now}
        </div>
    </div>

    <div class="client-block">
        <div class="name">${cliente}</div>
        ${cpfCnpj ? `<div class="sub">CNPJ/CPF: ${cpfCnpj}</div>` : ''}
        <span class="badge ${situacao.toLowerCase().includes('abert') || situacao.toLowerCase().includes('pendent') || situacao.toLowerCase().includes('andamento') ? 'badge-yellow' : situacao.toLowerCase().includes('atendid') || situacao.toLowerCase().includes('conclu') ? 'badge-green' : situacao.toLowerCase().includes('cancel') ? 'badge-red' : situacao.toLowerCase().includes('produ') ? 'badge-blue' : 'badge-gray'}">${situacao}</span>
    </div>

    <div class="info-grid">
        <div class="info-box"><div class="lbl">Data Pedido</div><div class="val">${data}</div></div>
        ${dataSaida ? `<div class="info-box"><div class="lbl">Data Saída</div><div class="val">${dataSaida}</div></div>` : ''}
        <div class="info-box"><div class="lbl">Vendedor</div><div class="val">${vendedor}</div></div>
        ${showValor ? `<div class="info-box"><div class="lbl">Total Produtos</div><div class="val">${fmtBRL(totalProd || totalPed)}</div></div>` : ''}
        ${showValor ? `<div class="info-box"><div class="lbl">Total Pedido</div><div class="val" style="color:#15803d;">${fmtBRL(totalPed)}</div></div>` : ''}
    </div>

    ${itensList.length > 0 ? `
    <div class="items-title">Itens do Pedido</div>
    <table>
        <thead>
            <tr>
                <th>Produto</th>
                <th style="text-align:center;width:80px;">Qtd</th>
                ${totalHeader}
            </tr>
        </thead>
        <tbody>
            ${itensRows}
            ${totalFooter}
        </tbody>
    </table>` : ''}

    <div class="doc-footer">Documento gerado pelo sistema MKS-SERVICE &bull; ${now}</div>
    <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`);
        printWindow.document.close();
    }


    async function _handleModalChangeStatus(newStatusId, label) {
        const orderNumber = document.getElementById('order-details-modal')?.dataset?.currentOrderNumber;
        if (!orderNumber) return;

        const pedido = _allPedidos.find(p => (p.id === orderNumber) || (p.número === orderNumber) || (p.numero === orderNumber));
        const idParaEnviar = pedido?.id || pedido?.id_pedido || pedido?.['id pedido'] || orderNumber;

        if (!confirm(`Mudar o Pedido Nº ${orderNumber} para "${label}"?`)) return;

        const container = document.getElementById('modal-status-actions');
        if (container) {
            container.style.opacity = '0.5';
            container.style.pointerEvents = 'none';
        }

        try {
            const backendUrl = `${API_URLS.ORDERS_BLING}/update-status`;
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [idParaEnviar], idSituacao: newStatusId })
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.message || 'Erro ao atualizar');

            // Atualizar localmente o pedido em memória
            if (pedido) {
                if (pedido.situação !== undefined) pedido.situação = label;
                if (pedido.situacao !== undefined) pedido.situacao = label;
            }

            alert(`Pedido Nº ${orderNumber} alterado para "${label}" com sucesso!`);

            // Fechar e recarregar
            document.getElementById('order-details-modal')?.classList.add('hidden');
            await fetchPedidos(true);

        } catch (err) {
            console.error('Erro ao mudar status do pedido:', err);
            alert('Erro: ' + err.message);
            if (container) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            }
        }
    }


    async function _handleBatchChangeStatus(newStatusId, label) {
        const checkedBoxes = _tableContent.querySelectorAll('.pedido-row-checkbox:checked');
        const allIds = Array.from(checkedBoxes).map(cb => cb.value);
        if (allIds.length === 0) return;

        // Filtrar pedidos que já possuem o status alvo para evitar erro no Bling
        const idsToUpdate = allIds.filter(id => {
            const p = _allPedidos.find(p => String(p.id) === String(id) || String(p.numero) === String(id) || String(p.número) === String(id));
            if (!p) return true; 
            
            const situacaoAtual = (p.situação || p.situacao || '').toLowerCase();
            const labelLower = label.toLowerCase();
            
            // Mapeamento de termos para evitar redundância
            if (labelLower.includes('atendid') && (situacaoAtual.includes('atendid') || situacaoAtual.includes('conclu') || situacaoAtual.includes('entreg'))) return false;
            if (labelLower.includes('abert') && (situacaoAtual.includes('abert') || situacaoAtual.includes('pendent'))) return false;
            if (labelLower.includes('produ') && situacaoAtual.includes('produ')) return false;
            
            return true;
        });

        if (idsToUpdate.length === 0) {
            alert(`Todos os ${allIds.length} pedidos selecionados já estão com a situação "${label}".`);
            return;
        }

        const msg = idsToUpdate.length === allIds.length 
            ? `Mudar ${idsToUpdate.length} pedido(s) para "${label}"?`
            : `Mudar ${idsToUpdate.length} pedido(s) para "${label}"?\n(${allIds.length - idsToUpdate.length} pedidos já estão nessa situação e serão ignorados).`;

        if (!confirm(msg)) return;

        if (_loadingEl) _loadingEl.classList.remove('hidden');
        if (_tableContent) _tableContent.innerHTML = '';
        _batchActionsContainer.classList.add('hidden');

        try {
            const backendUrl = API_URLS.ORDERS_BLING ? API_URLS.ORDERS_BLING.replace('/pedidos', '/pedidos/update-status') : "https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/update-status";
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToUpdate, idSituacao: newStatusId })
            });

            const json = await response.json();
            if (!response.ok) throw new Error(json.message || 'Erro ao atualizar pedidos');

            alert(`Pedidos atualizados para "${label}". Sucessos: ${json.data?.sucessos?.length || 0}. Erros: ${json.data?.erros?.length || 0}.`);
            
            // Recarregar os dados para refletir mudanças
            await fetchPedidos(true);

        } catch (error) {
            console.error("Erro ao atualizar lote de pedidos:", error);
            alert("Erro ao tentar mudar situação dos pedidos. Detalhes: " + error.message);
            await fetchPedidos(true); // Recarrega mesmo em caso de erro para manter integridade visual
        }
    }

    function _handleSort(e) {
        const key = e.currentTarget.dataset.pedidosSort;
        if (_state.sortKey === key) {
            _state.sortDir = _state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            _state.sortKey = key;
            _state.sortDir = 'asc';
        }
        _state.currentPage = 1;
        _renderTable(_filteredPedidos);
    }

    function _clearDateRadios() {
        if (_dateRadios) _dateRadios.forEach(r => r.checked = false);
    }

    function _handleDatePresetChange(e) {
        const val = e.target.value;
        const now = new Date();
        let start = '', end = '';

        if (val === 'all') {
            start = ''; end = '';
        } else if (val === '30' || val === '60' || val === '90') {
            const d = new Date();
            d.setDate(d.getDate() - parseInt(val));
            start = d.toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
        } else if (val === 'current_month') {
            const d = new Date(now.getFullYear(), now.getMonth(), 1);
            start = d.toISOString().split('T')[0];
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        } else if (val === 'last_month') {
            const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            start = d.toISOString().split('T')[0];
            end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        } else if (val === 'last_3_months') {
            const d = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            start = d.toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
        }

        if (_startDateInput) _startDateInput.value = start;
        if (_endDateInput) _endDateInput.value = end;
        _filterPedidos();
    }

    function _clearFilters() {
        if (_searchInput) _searchInput.value = '';
        if (_startDateInput) _startDateInput.value = '';
        if (_endDateInput) _endDateInput.value = '';
        if (_statusSelect) _statusSelect.value = 'aberto';
        if (_yearFilter) {
            const currentYearStr = new Date().getFullYear().toString();
            // Verifica se a opção existe
            if (Array.from(_yearFilter.options).some(opt => opt.value === currentYearStr)) {
                _yearFilter.value = currentYearStr;
            } else {
                _yearFilter.value = 'all';
            }
        }
        if (_dateRadios) {
            _dateRadios.forEach(r => {
                if (r.value === 'all') r.checked = true;
                else r.checked = false;
            });
        }
        _filterPedidos();
    }

    async function fetchPedidos(force = false) {
        if (!force && _allPedidos.length > 0) {
            _filterPedidos(); // Chama _filterPedidos em vez de _renderTable diretamente
            return;
        }

        if (_tableContent) _tableContent.innerHTML = '';
        if (_noMessageEl) _noMessageEl.classList.add('hidden');
        if (_loadingEl) _loadingEl.classList.remove('hidden');

        try {
            const url = API_URLS.ORDERS_BLING || "https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos";
            const response = await fetch(url + (force ? "?t=" + new Date().getTime() : ""), { mode: 'cors' });
            
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const json = await response.json();
            if (json.status === 'success' && json.data) {
                _allPedidos = json.data;
                _populateYearFilter();
            } else {
                _allPedidos = [];
            }
            _filterPedidos();

        } catch (error) {
            console.error("Erro ao buscar pedidos Bling:", error);
            if (_loadingEl) _loadingEl.classList.add('hidden');
            if (_noMessageEl) {
                _noMessageEl.classList.remove('hidden');
                const p = _noMessageEl.querySelector('p');
                if (p) p.textContent = "Erro ao carregar os pedidos. Verifique sua conexão e tente novamente.";
            }
        }
    }

    function _populateYearFilter() {
        if (!_yearFilter) return;
        const years = new Set();
        _allPedidos.forEach(p => {
            const dataStr = p.data || p.data_criacao || '';
            const pDate = _parseDate(dataStr);
            if (pDate && !isNaN(pDate)) {
                years.add(pDate.getFullYear());
            }
        });
        const sortedYears = Array.from(years).sort((a, b) => b - a);
        const currentYear = new Date().getFullYear();
        
        let html = '<option value="all">Tudo</option>';
        sortedYears.forEach(year => {
            html += `<option value="${year}">${year}</option>`;
        });
        _yearFilter.innerHTML = html;

        // Se o ano atual estiver na lista ou logo no início, seleciona-o.
        if (sortedYears.includes(currentYear)) {
            _yearFilter.value = currentYear.toString();
        } else {
            _yearFilter.value = 'all';
        }
    }

    function _parseDate(dateStr) {
        if (!dateStr) return null;
        if (dateStr.includes('/')) {
            const parts = dateStr.split(' ')[0].split('/'); 
            if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        if (dateStr.includes('-')) {
            const parts = dateStr.split(' ')[0].split('-');
            if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date(dateStr);
    }

    function _filterPedidos() {
        if (!_searchInput) return;
        const term = (_searchInput.value || '').toLowerCase();
        
        let startMillis = 0;
        let endMillis = Infinity;

        if (_startDateInput && _startDateInput.value) {
            const d = new Date(_startDateInput.value + 'T00:00:00'); 
            if (!isNaN(d)) startMillis = d.getTime();
        }
        if (_endDateInput && _endDateInput.value) {
            const d = new Date(_endDateInput.value + 'T23:59:59');
            if (!isNaN(d)) endMillis = d.getTime();
        }
        
        const filtered = _allPedidos.filter(p => {
            const numero = String(p.número || p.numero || '').toLowerCase();
            const cliente = String(p.contato_nome || p['contato nome'] || p.cliente || '').toLowerCase();
            
            let dateMatch = true;
            if (startMillis > 0 || endMillis < Infinity) {
                const dataStr = p.data || p.data_criacao || '';
                const pDate = _parseDate(dataStr);
                if (pDate && !isNaN(pDate)) {
                    const pdTime = pDate.getTime();
                    dateMatch = (pdTime >= startMillis && pdTime <= endMillis);
                } else if (!dataStr) {
                    dateMatch = false; // Se tiver filtro e não tiver data considero false
                }
            }

            let yearMatch = true;
            if (_yearFilter && _yearFilter.value !== 'all') {
                const selectedYear = parseInt(_yearFilter.value, 10);
                const dataStr = p.data || p.data_criacao || '';
                const pDate = _parseDate(dataStr);
                if (pDate && !isNaN(pDate)) {
                    yearMatch = pDate.getFullYear() === selectedYear;
                } else {
                    yearMatch = false;
                }
            }

            let statusMatch = true;
            if (_statusSelect && _statusSelect.value !== 'all') {
                const sel = _statusSelect.value;
                const sitLower = (p.situação || p.situacao || p.situao || '').toLowerCase();
                
                if (sel === 'atendido') {
                    statusMatch = (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu'));
                } else if (sel === 'aberto') {
                    statusMatch = (sitLower.includes('abert') || sitLower.includes('pendent') || sitLower.includes('andamento'));
                } else if (sel === 'producao') {
                    statusMatch = sitLower.includes('produ');
                } else if (sel === 'cancelado') {
                    statusMatch = sitLower.includes('cancel');
                }
            }

            const vendedor = _getVendedorName(p.vendedor || '').toLowerCase();
            const orcamento = String(p.orcamento || p['orcamento'] || p.orçamento || '').toLowerCase();
            const termMatch = numero.includes(term) || cliente.includes(term) || vendedor.includes(term) || orcamento.includes(term);
            return dateMatch && statusMatch && yearMatch && termMatch;
        });

        _filteredPedidos = filtered;
        _state.currentPage = 1;
        _renderTable(_filteredPedidos);
    }

    function _renderTable(pedidos) {
        if (_loadingEl) _loadingEl.classList.add('hidden');
        
        if (pedidos.length === 0) {
            if (_tableContent) _tableContent.innerHTML = '';
            if (_noMessageEl) {
                _noMessageEl.classList.remove('hidden');
                const p = _noMessageEl.querySelector('p');
                if (p) p.textContent = "Nenhum pedido encontrado.";
            }
            if (_paginationContainer) _paginationContainer.innerHTML = '';
            if (_paginationTopContainer) _paginationTopContainer.innerHTML = '';
            return;
        }

        if (_noMessageEl) _noMessageEl.classList.add('hidden');

        // Apply sorting
        const dir = _state.sortDir === 'asc' ? 1 : -1;
        const key = _state.sortKey;
        const sorted = [...pedidos].sort((a, b) => {
            let valA = '', valB = '';
            
            if (key === 'numero') {
                valA = a.número || a.numero || '0';
                valB = b.número || b.numero || '0';
                return (parseInt(valA) - parseInt(valB)) * dir;
            }
            if (key === 'data') {
                valA = _parseDate(a.data || a.data_criacao || '')?.getTime() || 0;
                valB = _parseDate(b.data || b.data_criacao || '')?.getTime() || 0;
                return (valA - valB) * dir;
            }
            if (key === 'cliente') {
                valA = String(a.contato_nome || a['contato nome'] || a.cliente || '').toLowerCase();
                valB = String(b.contato_nome || b['contato nome'] || b.cliente || '').toLowerCase();
                return valA.localeCompare(valB) * dir;
            }
            if (key === 'situacao') {
                valA = String(a.situação || a.situacao || a.situao || '').toLowerCase();
                valB = String(b.situação || b.situacao || b.situao || '').toLowerCase();
                return valA.localeCompare(valB) * dir;
            }
            if (key === 'vendedor') {
                valA = _getVendedorName(a.vendedor || '').toLowerCase();
                valB = _getVendedorName(b.vendedor || '').toLowerCase();
                return valA.localeCompare(valB) * dir;
            }
            if (key === 'total') {
                valA = _parseNumber(a.total_pedido || a['total pedido'] || a.valortotal || a.total || a.valor_total || a.total_venda || 0);
                valB = _parseNumber(b.total_pedido || b['total pedido'] || b.valortotal || b.total || b.valor_total || b.total_venda || 0);
                return (valA - valB) * dir;
            }
            return 0;
        });

        // Pagination
        const totalItems = sorted.length;
        const totalPages = Math.ceil(totalItems / _state.pageSize) || 1;
        if (_state.currentPage > totalPages) _state.currentPage = totalPages;
        
        const startIndex = (_state.currentPage - 1) * _state.pageSize;
        const itemsToDisplay = sorted.slice(startIndex, startIndex + _state.pageSize);

        // Render rows
        if (_tableContent) {
            _tableContent.innerHTML = itemsToDisplay.map(p => {
                const numero = p.número || p.numero || '-';
                const cliente = p.contato_nome || p['contato nome'] || p.cliente || '-';
                const vendedor = _getVendedorName(p.vendedor);
                const situacao = p.situação || p.situacao || p.situao || '-';
                const totalVal = _parseNumber(p.total_pedido || p['total pedido'] || p.valortotal || p.total || p.valor_total || p.total_venda || 0);
                const totalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal);
                
                const dataStr = p.data || p.data_criacao || '';
                const pDate = _parseDate(dataStr);
                let dateFormatted = dataStr || '-';
                if (pDate && !isNaN(pDate)) {
                    dateFormatted = `${String(pDate.getDate()).padStart(2, '0')}/${String(pDate.getMonth() + 1).padStart(2, '0')}/${pDate.getFullYear()}`;
                }

                // Format situation color
                let badgeClass = 'bg-gray-100 text-gray-800';
                const sitLower = situacao.toLowerCase();
                if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badgeClass = 'bg-green-100 text-green-800';
                else if (sitLower.includes('cancel')) badgeClass = 'bg-red-100 text-red-800';
                else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento')) badgeClass = 'bg-yellow-100 text-yellow-800';
                else if (sitLower.includes('produ')) badgeClass = 'bg-blue-100 text-blue-800';

                return `
                    <tr id="pedido-row-${numero}" data-order-number="${numero}" class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap text-left text-sm">
                            <input type="checkbox" class="pedido-row-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" value="${p.id || p.numero || numero}">
                        </td>
                        <td class="order-cell-numero px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span class="text-blue-600">${numero}</span>
                            ${(p.orcamento && p.orcamento !== '0') ? `<div class="text-[11px] text-gray-400 mt-0.5" title="Orçamento">${p.orcamento}</div>` : ''}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer clickable-cell">${dateFormatted}</td>
                        <td class="px-6 py-4 text-sm text-gray-900 max-w-[250px] truncate cursor-pointer clickable-cell" title="${cliente}">${cliente}</td>
                        <td class="px-6 py-4 text-sm text-gray-500 cursor-pointer clickable-cell">${vendedor}</td>
                        <td class="order-cell-status px-6 py-4 whitespace-nowrap cursor-pointer clickable-cell">
                            <span class="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${badgeClass}">${situacao}</span>
                        </td>
                        <td class="order-cell-total px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right cursor-pointer clickable-cell">${totalFormatted}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                            <span class="edit-order-observation-btn cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors inline-block" 
                                data-target-id="${numero}" 
                                title="Adicionar/Ver Observação">
                               <svg class="h-5 w-5 ${(p.observacao || p.observação) ? 'text-red-500' : 'text-gray-300'} order-obs-icon-${numero}" viewBox="0 0 20 20" fill="currentColor">
                                   <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                               </svg>
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Apply bold/icons to headers based on sorting state
        if (_tableHeaders) {
            _tableHeaders.forEach(th => {
                const isSorted = th.dataset.pedidosSort === key;
                const baseText = th.innerText.replace(/[▲▼]/g, '').trim();
                th.innerText = baseText + (isSorted ? (_state.sortDir === 'asc' ? ' ▲' : ' ▼') : '');
            });
        }
        
        // Reset check all
        if (_selectAllCheckbox) _selectAllCheckbox.checked = false;
        _updateBatchSelectionState();

        _renderPaginationUI(totalItems, totalPages, startIndex);
    }

    function _renderPaginationUI(totalItems, totalPages, startIndex) {
        if (!_paginationContainer || !_paginationTopContainer) return;

        if (totalPages <= 1) {
            _paginationContainer.innerHTML = '';
            _paginationTopContainer.innerHTML = '';
            return;
        }

        const paginationHtml = (prefixId) => `
            <div class="flex flex-1 items-center justify-between w-full bg-transparent">
                <div class="flex flex-1 justify-between sm:hidden">
                    <button id="${prefixId}-prev-page-mobile" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${_state.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">Anterior</button>
                    <button id="${prefixId}-next-page-mobile" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${_state.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">Próximo</button>
                </div>
                <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                        <p class="text-sm text-gray-700">
                            Mostrando <span class="font-bold">${startIndex + 1}</span> a <span class="font-bold">${Math.min(startIndex + _state.pageSize, totalItems)}</span> de <span class="font-bold">${totalItems}</span> itens
                        </p>
                    </div>
                    <div>
                        <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                            <button id="${prefixId}-prev-page" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${_state.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                                <span class="sr-only">Anterior</span>
                                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
                            </button>
                            <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">Página ${_state.currentPage} de ${totalPages}</span>
                            <button id="${prefixId}-next-page" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${_state.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
                                <span class="sr-only">Próximo</span>
                                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        `;

        _paginationContainer.innerHTML = paginationHtml('bottom');
        _paginationTopContainer.innerHTML = paginationHtml('top');

        const attachNav = (id, change) => {
            const btn = document.getElementById(id);
            if (btn && _state.currentPage !== (change > 0 ? totalPages : 1)) {
                btn.addEventListener('click', () => {
                    const newPage = _state.currentPage + change;
                    if (newPage >= 1 && newPage <= totalPages) {
                        _state.currentPage = newPage;
                        _renderTable(_filteredPedidos);
                        // Auto-scroll to top of table
                        const tableHeader = document.getElementById('pedidos-table');
                        if (tableHeader) {
                            const rect = tableHeader.getBoundingClientRect();
                            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                            window.scrollTo({ top: rect.top + scrollTop - 120, behavior: 'smooth' });
                        }
                    }
                });
            }
        };

        ['bottom', 'top'].forEach(prefix => {
            attachNav(`${prefix}-prev-page`, -1);
            attachNav(`${prefix}-next-page`, 1);
            attachNav(`${prefix}-prev-page-mobile`, -1);
            attachNav(`${prefix}-next-page-mobile`, 1);
        });
    }

    return {
        handleItemClick: handleItemClick,
        init: function (config = {}) {
            if (config.openOrderObservationModal) {
                _state.openOrderObservationModal = config.openOrderObservationModal;
            }
            if (!_isInitialized) {
                _cacheDom();
                if (_statusSelect && !_statusSelect.value) {
                    _statusSelect.value = 'aberto';
                } else if (_statusSelect && _statusSelect.value === 'all') {
                    _statusSelect.value = 'aberto';
                }
                _bindEvents();
                _isInitialized = true;
            }
            fetchPedidos(); 
        },
        fetchPedidos: fetchPedidos,
        getAllPedidos: () => _allPedidos,
        updateOrderSingleRow: function(data) {
            if (!data || !data.numero) return;
            const numero = String(data.numero);
            
            // 1. Update internal data
            const index = _allPedidos.findIndex(p => String(p.numero) === numero || String(p.id) === numero);
            if (index !== -1) {
                // Update properties if provided in data
                if (data.situacao) _allPedidos[index].situacao = data.situacao;
                if (data.total) _allPedidos[index].total_pedido = data.total;
                // Also update filtered copy if it exists there
                const fIndex = _filteredPedidos.findIndex(p => String(p.numero) === numero || String(p.id) === numero);
                if (fIndex !== -1) {
                    if (data.situacao) _filteredPedidos[fIndex].situacao = data.situacao;
                    if (data.total) _filteredPedidos[fIndex].total_pedido = data.total;
                }
            }

            // 2. Update DOM row directly
            const row = document.getElementById(`pedido-row-${numero}`);
            if (row) {
                console.log(`[GerenciarPedidos] Atualizando linha do pedido ${numero} via DOM.`);
                
                // Update Status
                if (data.situacao) {
                    const statusCell = row.querySelector('.order-cell-status');
                    if (statusCell) {
                        let badgeClass = 'bg-gray-100 text-gray-800';
                        const sitLower = data.situacao.toLowerCase();
                        if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badgeClass = 'bg-green-100 text-green-800';
                        else if (sitLower.includes('cancel')) badgeClass = 'bg-red-100 text-red-800';
                        else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento') || sitLower.includes('em andamento')) badgeClass = 'bg-yellow-100 text-yellow-800';
                        else if (sitLower.includes('prepar') || sitLower.includes('impress') || sitLower.includes('verificad')) badgeClass = 'bg-blue-100 text-blue-800';
                        
                        statusCell.innerHTML = `<span class="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${badgeClass}">${data.situacao}</span>`;
                    }
                }

                // Update Total
                if (data.total !== undefined) {
                    const totalCell = row.querySelector('.order-cell-total');
                    if (totalCell) {
                        const totalVal = _parseNumber(data.total || 0);
                        const totalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal);
                        totalCell.innerText = totalFormatted;
                    }
                }

                // Highlight Row
                row.classList.add('row-update-flash');
                setTimeout(() => row.classList.remove('row-update-flash'), 2000);
            }
        },
        updateOrderObservationStatus: function(orderId, obsArray) {
            const hasObs = Array.isArray(obsArray) && obsArray.length > 0;
            // Update the data array
            const target = _allPedidos.find(p => String(p.id) === String(orderId) || String(p.numero) === String(orderId) || String(p.numero_loja || p.numeroLoja) === String(orderId));
            if (target) {
                target.observacao = hasObs ? obsArray : '';
                // Attempt to update the UI directly if visible
                const iconSvg = _tableContent?.querySelector(`.order-obs-icon-${target.numero || target.número || target.id}`);
                if (iconSvg) {
                    iconSvg.classList.toggle('text-red-500', hasObs);
                    iconSvg.classList.toggle('text-gray-300', !hasObs);
                }
            }
        },
        openOrderDetailsByNumber: function(orderNumber) {
            console.log(`[GerenciarPedidos] Tentando abrir modal para o pedido nº ${orderNumber}`);
            // Já busca o pedido aqui para garantir que temos o objeto
            const pedido = _allPedidos.find(p => 
                String(p.numero || '') === String(orderNumber) || 
                String(p.número || '') === String(orderNumber)
            );
            
            if (pedido) {
                _openOrderDetailsModal(pedido);
            } else {
                console.warn(`[GerenciarPedidos] Pedido ${orderNumber} não encontrado localmente.`);
            }
        }
    };
})();
