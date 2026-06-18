// js/modulos/estoque.js

// Importa as funções de utilidade que serão necessárias
import { createStatusPill, positionTooltip } from '../utils.js';

export const EstoqueApp = (function() {
    // --- Variáveis de Estado e Configuração Privadas ---
    let _allProducts = [];
    let _allOrdersTerceiros = [];
    let _allOrdersFabrica = [];
    let _selectedStockItems = new Set();
    let _state = {
        statusFilter: 'todos',
        currentPage: 1,
        itemsPerPage: 15,
        sortColumn: 'descricao',
        sortDirection: 'asc'
    };
    let _dom = {}; // Para referências de elementos do DOM
    let _utils = {}; // Para funções de utilidade externas (do App principal)

    // --- Funções Privadas ---

    // ADICIONADO CONSOLE.TABLE PARA DEPURAÇÃO
    function _calculateAguardandoChegarMap() {
        const aguardandoMap = new Map();
        const allOrderItems = [
            ..._allOrdersTerceiros.flatMap(o => o.rawItems),
            ..._allOrdersFabrica.flatMap(o => o.rawItems)
        ];
    
        for (const item of allOrderItems) {
            // Agora, a 'situacao' vem padronizada como 'OK' ou 'PENDENTE'
            if (item.situacao !== 'OK' && item.codigoService) {
                const currentQty = aguardandoMap.get(item.codigoService) || 0;
                // Garante que a quantidade seja um número antes de somar
                const itemQty = parseFloat(String(item.quantidadePedido || '0').replace(',', '.')) || 0;
                aguardandoMap.set(item.codigoService, currentQty + itemQty);
            }
        }
        }
        return aguardandoMap;
    }
    
    function _calculateVendas90dMap() {
        const vendasMap = new Map();
        const allPedidos = (typeof GerenciarPedidosApp !== 'undefined') ? GerenciarPedidosApp.getAllPedidos() : [];
        
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        allPedidos.forEach(pedido => {
            const dataPedido = _parseDate(pedido.data || pedido.dataCriacao);
            if (dataPedido >= ninetyDaysAgo) {
                const itensRaw = pedido.itens || pedido.Itens || '';
                const itemsList = _parseItensLocal(itensRaw);
                itemsList.forEach(item => {
                    const code = String(item.codigo);
                    const currentQty = vendasMap.get(code) || 0;
                    vendasMap.set(code, currentQty + (item.quantidade || 0));
                });
            }
        });
        return vendasMap;
    }

    function _renderStockPage(productsToRender) {
        if (!productsToRender) return;

        const aguardandoMap = _calculateAguardandoChegarMap();
        const vendas90dMap = _calculateVendas90dMap();

        const productsWithStatus = productsToRender.map(p => {
            const aguardandoChegar = aguardandoMap.get(p.codigo) || 0;
            const estoqueAtual = p.estoque ?? 0;
            const estoqueEfetivo = estoqueAtual + aguardandoChegar;
            
            // Força a quantidade de vendas a bater com a contagem exata do modal
            p.vendas_ultimos_90_dias = vendas90dMap.get(String(p.codigo)) || 0;

            let status = 'ok';
            if (p.estoque_minimo !== null && estoqueEfetivo <= p.estoque_minimo) status = 'baixo';
            else if (p.estoque_maximo !== null && estoqueEfetivo > p.estoque_maximo) status = 'excesso';
            else if (estoqueAtual < 0) status = 'indefinido';

            return { ...p, stockStatus: status, aguardandoChegar: aguardandoChegar };
        });

        const statusFilteredProducts = productsWithStatus.filter(p => _state.statusFilter === 'todos' ? true : p.stockStatus === _state.statusFilter);

        statusFilteredProducts.sort((a, b) => {
            const sortKey = _state.sortColumn;
            const valA = a[sortKey];
            const valB = b[sortKey];

            let comparison = 0;
            if (['estoque', 'estoque_minimo', 'estoque_maximo', 'vendas_ultimos_90_dias', 'aguardandoChegar'].includes(sortKey)) {
                const numA = parseFloat(valA) || 0;
                const numB = parseFloat(valB) || 0;
                comparison = numA - numB;
            } else {
                const strA = String(valA || '').trim();
                const strB = String(valB || '').trim();
                comparison = strA.localeCompare(strB, 'pt-BR', { numeric: true });
            }

            return _state.sortDirection === 'asc' ? comparison : -comparison;
        });

        const totalItems = statusFilteredProducts.length;
        const totalPages = Math.ceil(totalItems / _state.itemsPerPage);
        _state.currentPage = Math.min(_state.currentPage, totalPages) || 1;
        const startIndex = (_state.currentPage - 1) * _state.itemsPerPage;
        const endIndex = startIndex + _state.itemsPerPage;
        const paginatedProducts = statusFilteredProducts.slice(startIndex, endIndex);

        let html = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Diagnóstico de Estoque</h1>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            ${_createStatusCard('todos', 'Itens Filtrados', productsToRender.length, 'bg-blue-500')}
            ${_createStatusCard('baixo', 'Estoque Baixo', productsWithStatus.filter(p => p.stockStatus === 'baixo').length, 'bg-yellow-500')}
            ${_createStatusCard('ok', 'Estoque OK', productsWithStatus.filter(p => p.stockStatus === 'ok').length, 'bg-green-500')}
            ${_createStatusCard('excesso', 'Excesso de Estoque', productsWithStatus.filter(p => p.stockStatus === 'excesso').length, 'bg-red-500')}
        </div>
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 read-only-disable"><tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input type="checkbox" id="select-all-checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sortable-header" data-sort="descricao">
                        <div class="flex items-center">Produto ${_renderStockSortIcon('descricao')}</div>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sortable-header" data-sort="estoque">
                        <div class="flex items-center justify-center">Estoque Atual ${_renderStockSortIcon('estoque')}</div>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sortable-header" data-sort="aguardandoChegar">
                        <div class="flex items-center justify-center">Aguardando Chegar ${_renderStockSortIcon('aguardandoChegar')}</div>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sortable-header" data-sort="vendas_ultimos_90_dias">
                        <div class="flex items-center justify-center">Vendas 90d ${_renderStockSortIcon('vendas_ultimos_90_dias')}</div>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Mín / Máx</th>
                    <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">`;

        if (paginatedProducts.length === 0) {
            html += `<tr><td colspan="7" class="text-center py-8 text-gray-500">Nenhum item encontrado.</td></tr>`;
        } else {
            paginatedProducts.forEach(p => {
                const isChecked = _selectedStockItems.has(p.id) ? 'checked' : '';
                const imageUrl = p.url_imagens_externas && p.url_imagens_externas[0]
                    ? p.url_imagens_externas[0]
                    : 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
                html += `<tr data-product-code="${p.codigo}">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" class="stock-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-product-id="${p.id}" ${isChecked}>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <img src="${imageUrl}" 
                                     alt="${p.descricao || 'Imagem do produto'}" 
                                     class="product-list-item-img" 
                                     data-image-url="${imageUrl}"
                                     onerror="this.onerror=null;this.src='https://placehold.co/50x50/e2e8f0/64748b?text=?';">
                                <div class="ml-4">
                                    <div class="text-sm font-medium text-gray-900">${p.descricao}</div>
                                    <div class="text-sm text-gray-500">${p.codigo}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-800 stock-value">${p.estoque ?? 0}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">${p.aguardandoChegar}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold">
                            <span class="vendas-90d-link cursor-pointer text-blue-600 hover:text-blue-800 hover:underline" data-product-code="${p.codigo}" data-product-desc="${p.descricao}">
                                ${p.vendas_ultimos_90_dias ?? 0}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">${p.estoque_minimo ?? 0} / ${p.estoque_maximo ?? 0}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${createStatusPill(p.stockStatus)}</td>
                    </tr>`;
            });
        }
        html += `</tbody></table></div>
        <!-- Controles de Paginação -->
        <div class="flex items-center justify-between mt-4">
            <button id="prev-page-btn" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
            <span class="text-sm text-gray-700">Página ${_state.currentPage} de ${totalPages || 1}</span>
            <button id="next-page-btn" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Próximo</button>
        </div>
    `;
    _dom.pageEstoque.innerHTML = html;

        const stockTable = _dom.pageEstoque.querySelector('table');
        if (stockTable) {
            stockTable.addEventListener('mouseover', (event) => {
                if (event.target.classList.contains('product-list-item-img')) {
                    _utils.showProductTooltip(event);
                }
            });
            stockTable.addEventListener('mouseout', (event) => {
                if (event.target.classList.contains('product-list-item-img')) {
                    _utils.hideProductTooltip();
                }
            });

            // Adiciona evento de clique para Vendas 90D
            stockTable.addEventListener('click', (event) => {
                if (event.target.classList.contains('vendas-90d-link')) {
                    const productCode = event.target.dataset.productCode;
                    const productDesc = event.target.dataset.productDesc;
                    _showVendas90dModal(productCode, productDesc);
                }
            });
        }

        _dom.pageEstoque.querySelectorAll('.status-card').forEach(card => card.addEventListener('click', () => { _state.statusFilter = card.dataset.status; _state.currentPage = 1; _utils.applyGlobalFilters(); }));
        
        _dom.pageEstoque.querySelectorAll('.sortable-header').forEach(header => header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (_state.sortColumn === sortKey) {
                _state.sortDirection = _state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                _state.sortColumn = sortKey;
                _state.sortDirection = 'asc';
            }
            _utils.applyGlobalFilters();
        }));
        
        const prevBtn = _dom.pageEstoque.querySelector('#prev-page-btn');
        const nextBtn = _dom.pageEstoque.querySelector('#next-page-btn');
        
        if (prevBtn) {
            prevBtn.disabled = _state.currentPage === 1;
            prevBtn.addEventListener('click', () => { if (_state.currentPage > 1) { _state.currentPage--; _utils.applyGlobalFilters(); } });
        }
        if (nextBtn) {
            nextBtn.disabled = _state.currentPage === totalPages || totalPages === 0;
            nextBtn.addEventListener('click', () => { if (_state.currentPage < totalPages) { _state.currentPage++; _utils.applyGlobalFilters(); } });
        }

        _dom.pageEstoque.querySelectorAll('.stock-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                _toggleProductSelection(event.target.dataset.productId, event.target.checked);
            });
        });

        const selectAllCheckbox = _dom.pageEstoque.querySelector('#select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (event) => {
                const isChecked = event.target.checked;
                const currentPaginatedProductIds = paginatedProducts.map(p => p.id);
                _dom.pageEstoque.querySelectorAll('.stock-checkbox').forEach(checkbox => {
                    if (currentPaginatedProductIds.includes(checkbox.dataset.productId)) {
                        checkbox.checked = isChecked;
                        _toggleProductSelection(checkbox.dataset.productId, isChecked);
                    }
                });
            });

            const allVisibleProductIds = paginatedProducts.map(p => p.id);
            const allVisibleChecked = allVisibleProductIds.length > 0 && allVisibleProductIds.every(id => _selectedStockItems.has(id));
            selectAllCheckbox.checked = allVisibleChecked;
        }
    }

    function _createStatusCard(status, title, count, color) {
        return `<div data-status="${status}" class="status-card ${color} text-white p-3 rounded-lg shadow-lg cursor-pointer transform transition-transform duration-300 hover:scale-105 ${status === _state.statusFilter ? 'active' : ''}"><h3 class="text-sm font-semibold">${title}</h3><p class="text-2xl font-bold mt-2">${count}</p></div>`;
    }

    function _showVendas90dModal(productCode, productDesc) {
        let modal = document.getElementById('vendas-90d-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'vendas-90d-details-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] hidden';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-[90%] max-w-5xl max-h-[90vh] flex flex-col">
                    <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Detalhamento de Vendas</h3>
                            <p class="text-sm text-gray-500 mt-1" id="vendas-90d-modal-subtitle"></p>
                        </div>
                        <button id="close-vendas-90d-modal-btn" class="text-gray-500 hover:text-gray-800">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto flex-1">
                        <table class="min-w-full divide-y divide-gray-200" id="vendas-90d-table">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qtd Vendida</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Situação</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="vendas-90d-tbody">
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('close-vendas-90d-modal-btn').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }

        const subtitle = document.getElementById('vendas-90d-modal-subtitle');
        subtitle.innerHTML = `Produto: <strong>${productCode}</strong> - ${productDesc}`;

        const tbody = document.getElementById('vendas-90d-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Buscando vendas nos pedidos carregados...</td></tr>';
        
        modal.classList.remove('hidden');

        // Busca pedidos
        const allPedidos = (typeof GerenciarPedidosApp !== 'undefined') ? GerenciarPedidosApp.getAllPedidos() : [];
        
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        let salesRows = [];

        allPedidos.forEach(pedido => {
            const dataPedido = _parseDate(pedido.data || pedido.dataCriacao);
            
            // Verifica se o pedido é dos últimos 90 dias
            if (dataPedido >= ninetyDaysAgo) {
                const itensRaw = pedido.itens || pedido.Itens || '';
                const itemsList = _parseItensLocal(itensRaw);
                
                const itemEncontrado = itemsList.find(i => String(i.codigo) === String(productCode));
                if (itemEncontrado) {
                    const numPedido = pedido.numero || pedido.número || pedido.id || '-';
                    const cliente = pedido.contato_nome || pedido['contato nome'] || pedido.cliente || '-';
                    const dataFormatada = dataPedido.toLocaleDateString('pt-BR');
                    const situacao = pedido.situação || pedido.situacao || '-';
                    const qtdVendida = itemEncontrado.quantidade || 0;

                    salesRows.push({
                        dataStr: dataFormatada,
                        dataObj: dataPedido,
                        html: `
                            <tr class="hover:bg-gray-50">
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${numPedido}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${dataFormatada}</td>
                                <td class="px-4 py-3 text-sm text-gray-500 max-w-[250px] truncate" title="${cliente}">${cliente}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-gray-800">${qtdVendida}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${situacao}</td>
                            </tr>
                        `
                    });
                }
            }
        });

        // Ordenar do mais recente para o mais antigo
        salesRows.sort((a, b) => b.dataObj - a.dataObj);

        if (salesRows.length > 0) {
            tbody.innerHTML = salesRows.map(s => s.html).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-500">Nenhuma venda carregada na memória do sistema para este produto nos últimos 90 dias.<br><small class="text-gray-400">Verifique se os pedidos mais antigos já foram carregados na aba Pedidos Bling.</small></td></tr>';
        }
    }

    function _parseDate(dateStr) {
        if (!dateStr) return new Date(0);
        // Tenta parse de yyyy-mm-dd
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length >= 3) {
                // assume yyyy-mm-dd
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2].substring(0, 2)));
            }
        }
        // Tenta parse de dd/mm/yyyy
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length >= 3) {
                return new Date(parseInt(parts[2].substring(0, 4)), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }
        return new Date(dateStr);
    }

    function _parseItensLocal(itensRaw) {
        let items = [];
        if (!itensRaw) return items;
        if (Array.isArray(itensRaw)) {
            // Pode já ser um array de objetos dependendo da origem
            itensRaw.forEach(it => {
                if (typeof it === 'object') {
                    items.push({
                        codigo: it.codigo || '',
                        descricao: it.descricao || '',
                        quantidade: parseFloat(it.quantidade || 0)
                    });
                }
            });
            return items;
        }

        // Limpa a string e divide pelo padrão "(SKU, QTD"
        const itemStrings = String(itensRaw).split(/(?=\([^,]+,\s*\d+)/).filter(Boolean);
        itemStrings.forEach(itemStr => {
            let content = itemStr.trim();
            if (!content) return;

            // Remove parênteses básicos
            if (content.startsWith('(')) content = content.substring(1).trim();
            if (content.endsWith(')')) {
                const openCount = (content.match(/\(/g) || []).length;
                const closeCount = (content.match(/\)/g) || []).length;
                if (closeCount > openCount) content = content.substring(0, content.length - 1).trim();
            }

            const parts = content.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                const sku = parts[0];
                const qty = parseFloat(parts[1]) || 1;
                items.push({ codigo: sku, quantidade: qty });
            }
        });
        
        return items;
    }

    function _renderStockSortIcon(column) {
        if (_state.sortColumn !== column) return '';
        return _state.sortDirection === 'asc' ? '▲' : '▼';
    }

    function _toggleProductSelection(productId, isChecked) {
        if (isChecked) {
            _selectedStockItems.add(productId);
        } else {
            _selectedStockItems.delete(productId);
        }
        _updateSelectedCountDisplay();
    }

    function _clearSelection() {
        _selectedStockItems.clear();
        _updateSelectedCountDisplay();
        _utils.applyGlobalFilters(); 
    }

    function _updateSelectedCountDisplay() {
        if (_dom.selectedItemsCountDisplay) {
            _dom.selectedItemsCountDisplay.textContent = `Itens selecionados: ${_selectedStockItems.size}`;
        }
        if (_dom.generateReportButton) {
            _dom.generateReportButton.disabled = _selectedStockItems.size === 0;
        }
        if (_dom.clearSelectionBtn) {
            if (_selectedStockItems.size > 0) {
                _dom.clearSelectionBtn.classList.remove('hidden');
            } else {
                _dom.clearSelectionBtn.classList.add('hidden');
            }
        }
    }

    /**
     * Atualiza o estoque de um produto diretamente na tabela se ela estiver visível.
     * @param {string} codigo 
     * @param {number} novoEstoque 
     */
    function updateProductStockInTable(codigo, novoEstoque) {
        // 0. Atualiza na memória local interna
        const product = _allProducts.find(p => String(p.codigo) === String(codigo));
        if (product) product.estoque = novoEstoque;

        if (!_dom.pageEstoque) return;

        // Procura a linha que contém o código do produto
        const row = _dom.pageEstoque.querySelector(`tr[data-product-code="${codigo}"]`);
        if (row) {
            const stockCell = row.querySelector('.stock-value');
            if (stockCell) {
                stockCell.textContent = novoEstoque;
                
                // Animação visual de atualização
                stockCell.classList.add('text-green-600', 'transition-all', 'duration-500');
                setTimeout(() => {
                    stockCell.classList.remove('text-green-600');
                }, 2000);
            }
        }
    }

    /**
     * Atualiza o nome de um produto diretamente na tabela se ela estiver visível.
     * @param {string} codigo 
     * @param {string} novoNome 
     */
    function updateProductNameInTable(codigo, novoNome) {
        // 0. Atualiza na memória local interna
        const product = _allProducts.find(p => String(p.codigo) === String(codigo));
        if (product) product.descricao = novoNome;

        if (!_dom.pageEstoque) return;

        const row = _dom.pageEstoque.querySelector(`tr[data-product-code="${codigo}"]`);
        if (row) {
            const nameElement = row.querySelector('.text-sm.font-medium.text-gray-900');
            if (nameElement) {
                nameElement.textContent = novoNome;
                nameElement.classList.add('text-blue-600', 'transition-all', 'duration-500');
                setTimeout(() => nameElement.classList.remove('text-blue-600'), 2000);
            }
        }
    }

    // --- Funções Públicas (API do Módulo) ---
    function init(config) {
        _allProducts = config.allProducts;
        _allOrdersTerceiros = config.allOrdersTerceiros;
        _allOrdersFabrica = config.allOrdersFabrica;
        _selectedStockItems = config.selectedStockItems;
        _dom.pageEstoque = config.dom.pageEstoque;
        _dom.selectedItemsCountDisplay = config.dom.selectedItemsCountDisplay;
        _dom.generateReportButton = config.dom.generateReportButton;
        _dom.clearSelectionBtn = config.dom.clearSelectionBtn;
        _utils.showProductTooltip = config.utils.showProductTooltip;
        _utils.hideProductTooltip = config.utils.hideProductTooltip;
        _utils.applyGlobalFilters = config.utils.applyGlobalFilters;
    }

    function render(productsToRender) {
        if (_dom.pageEstoque) {
            _renderStockPage(productsToRender);
        }
    }

    return {
        init: init,
        render: render,
        clearSelection: _clearSelection,
        updateSelectedCountDisplay: _updateSelectedCountDisplay,
        updateProductStockInTable: updateProductStockInTable,
        updateProductNameInTable: updateProductNameInTable
    };
})();
