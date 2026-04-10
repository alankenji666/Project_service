// js/modulos/dashboard.js

// Importa Chart e o plugin, que estão disponíveis globalmente a partir dos scripts no index.
const Chart = window.Chart;
const ChartDataLabels = window.ChartDataLabels;

export const DashboardApp = (function() {
    // --- Private State & Variables ---
    let _allNFeData = [];
    let _allProducts = [];
    let _allLojaIntegradaOrders = [];
    let _allPedidosBling = []; // Nova fonte primária
    let _currentSalesDetails = []; // Armazena os dados para o modal de detalhes
    let _vendedorMap = {
        '15596443462': 'Julio Martins dos Santos',
        '15596443455': 'Reginaldo Araujo de Souza',
        '15596442848': 'Rodrigo Carbone'
    };
    let _salesChartInstance = null;

    let _state = {
        isInitialized: false,
        isStarted: false,
        selectedChannel: 'total',
        currentDateFilterValue: 'all',
        startDate: null,
        endDate: null,
        lojaIntegradaSort: { key: 'numero_pedido', direction: 'desc' },
        estoqueSort: { key: 'valor', direction: 'desc' },
        activeLiTab: 'vendas',
        selectedYearFilter: new Date().getFullYear().toString(),
        chartDisplayMode: 'bruta', // 'bruta' ou 'liquida'
        activeEstoqueFilter: 'all', // Filtro ativo no dashboard de estoque
        estoqueTopLimit: 'all', // Limite de itens no Top Itens (all, 10, 20, 30)
        estoqueCurrentPage: 1, // Página atual da tabela de estoque
        estoquePageSize: 30, // Itens por página
        charts: {}, // Armazena instâncias de outros gráficos (ex: estoque)
        salesSort: {
            key: 'data',
            direction: 'desc'
        }
    };

    let _dom = {}; // Cache for DOM elements
    let _utils = {}; // To hold utility functions passed from main App

    // --- Private Functions ---

    /**
     * Converte uma string de moeda (BRL) para um número float de forma segura.
     * Trata "R$", espaços, pontos de milhar e vírgula decimal.
     * @param {string | number} value - A string ou número a ser convertido.
     * @returns {number} O valor numérico.
     */
    function _parseCurrencyBRL(value) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value !== 'string' || value.trim() === '') {
            return 0;
        }

        let cleanValue = value.replace("R$", "").trim();
        
        const hasComma = cleanValue.includes(',');
        const hasDot = cleanValue.includes('.');

        if (hasComma) {
            // Formato brasileiro: 1.234,56 ou 23,95
            cleanValue = cleanValue
                .replace(/\./g, "") // Remove pontos de milhar
                .replace(",", "."); // Troca vírgula por ponto
        } else if (hasDot) {
            // Formato internacional ou já limpo
            const parts = cleanValue.split('.');
            if (parts.length > 2) {
                cleanValue = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
            }
        }

        const result = parseFloat(cleanValue);
        return isNaN(result) ? 0 : result;
    }

    /**
     * Formata uma data para o padrão brasileiro (DD/MM/AAAA HH:mm).
     * Trata strings ISO e formatos já existentes.
     * @param {string} dateStr - A string de data a ser formatada.
     * @returns {string} A data formatada.
     */
    function _formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        
        // Se já estiver no formato brasileiro DD/MM/AAAA, retorna como está
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return dateStr;
        }

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            // Verifica se a string original contém T (ISO) ou : (hora) para incluir o horário
            if (dateStr.includes('T') || dateStr.includes(':')) {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            }
            
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Processa a string de itens da NFe.
     * @param {string} itemsString - A string no formato "(codigo, qtd, valor);(codigo, qtd, valor)".
     * @returns {Array} Um array de objetos, cada um com {codigo, quantidade, valor}.
     */
    function _parseNfeItemsString(itemsString) {
        if (!itemsString || typeof itemsString !== 'string') {
            return [];
        }
        try {
            return itemsString
                .replace(/[()]/g, '')
                .split(';')
                .filter(s => s.trim() !== '')
                .map(itemStr => {
                    const parts = itemStr.split(',');
                    return {
                        codigo: parts[0]?.trim() || '',
                        quantidade: parseFloat(parts[1]?.trim() || 0),
                        valor: parseFloat(parts[2]?.trim() || 0)
                    };
                });
        } catch (e) {
            console.error("Erro ao processar string de itens da NFe:", itemsString, e);
            return [];
        }
    }

    /**
     * Caches DOM elements used by this module.
     */
    function _cacheDom() {
        _dom.yearFilter = document.getElementById('dashboard-year-filter');
        _dom.page = document.getElementById('page-dashboards');
        _dom.filterBar = document.getElementById('dashboard-filter-bar');
        _dom.startDateInput = document.getElementById('dashboard-start-date');
        _dom.endDateInput = document.getElementById('dashboard-end-date');
        _dom.summaryCards = document.getElementById('dashboard-summary-cards');
        _dom.salesChartCanvas = document.getElementById('sales-chart');
        _dom.salesTableContainer = document.getElementById('sales-table-container');
        _dom.clearFiltersBtn = document.getElementById('dashboard-clear-filters-btn');
        _dom.salesDetailsModal = document.getElementById('sales-details-modal');
        _dom.closeSalesDetailsModalBtn = document.getElementById('close-sales-details-modal-btn');
        _dom.salesDetailsModalTitle = document.getElementById('sales-details-modal-title');
        _dom.salesDetailsModalContent = document.getElementById('sales-details-modal-content');
        _dom.noSalesDetailsMessage = document.getElementById('no-sales-details-message');
        _dom.customProductTooltip = document.getElementById('custom-product-tooltip');
    
        _dom.selectorContainer = document.getElementById('dashboard-selector-container');
        _dom.vendasContainer = document.getElementById('dashboard-vendas-container');
        _dom.selectVendasBtn = document.getElementById('select-vendas-dashboard');
        _dom.selectEstoqueBtn = document.getElementById('select-estoque-dashboard');
        _dom.backToSelectorBtn = document.getElementById('back-to-selector-btn');

        _dom.exportNotesBtn = document.getElementById('export-sales-details-notes-csv-btn');
        _dom.exportItemsBtn = document.getElementById('export-sales-details-items-csv-btn');
        _dom.exportMenuBtn = document.getElementById('sales-details-export-button');
        _dom.exportDropdown = document.getElementById('sales-details-export-dropdown');
        _dom.vendaTypeToggle = document.getElementById('venda-type-toggle');

        _dom.estoqueContainer = document.getElementById('dashboard-estoque-container');
        _dom.estoqueSummaryCards = document.getElementById('estoque-summary-cards');
        _dom.estoqueChartCanvas = document.getElementById('estoque-distribution-chart');
        _dom.estoqueTopItemsContainer = document.getElementById('estoque-top-items-container');
        _dom.backToSelectorFromEstoqueBtn = document.getElementById('back-to-selector-from-estoque-btn');
        _dom.estoqueTypeToggle = document.getElementById('estoque-type-toggle');
        _dom.estoqueTopLimitSelect = document.getElementById('estoque-top-limit-select');
    }

    // --- Navigation Functions ---

    function _showSalesDashboard() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.add('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.remove('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.remove('hidden');
        _setDateRange('all');
    }

    function _showEstoqueDashboard() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.add('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.remove('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.add('hidden');
        _state.activeEstoqueFilter = 'all';
        _state.estoqueCurrentPage = 1; // Reseta para a primeira página
        _renderEstoqueDashboard();
    }

    function _showSelector() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.remove('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.add('hidden');
    }

    // --- Inventory Dashboard Logic ---

    function _calculateEstoqueData() {
        const categories = {
            'Estoque - Terceiros': { id: 'Estoque - Terceiros', label: 'Terceiros', total: 0, count: 0, color: '#8b5cf6' },
            'Estoque - Fábrica': { id: 'Estoque - Fábrica', label: 'Fábrica', total: 0, count: 0, color: '#10b981' },
            'Sob Demanda - Fábrica': { id: 'Sob Demanda - Fábrica', label: 'Sob Demanda', total: 0, count: 0, color: '#f59e0b' },
            'Estoque - Consumo': { id: 'Estoque - Consumo', label: 'Consumo', total: 0, count: 0, color: '#64748b' }
        };

        const isLiquido = _dom.estoqueTypeToggle ? _dom.estoqueTypeToggle.checked : true;
        let totalGeralValue = 0;
        const topItems = [];

        _allProducts.forEach(p => {
            const tags = p.grupo_de_tags_tags || [];
            const isConsumo = tags.includes('Estoque - Consumo');
            const hasValidTag = Object.keys(categories).some(catTag => tags.includes(catTag));

            if (!hasValidTag || (p.codigo && p.codigo.startsWith('7') && !hasValidTag)) return;

            const estoque = parseFloat(p.estoque) || 0;
            const precoCusto = _parseCurrencyBRL(p.preco_de_custo);
            const precoVenda = _parseCurrencyBRL(p.preco);
            
            let precoBase;
            if (isConsumo) {
                precoBase = precoCusto;
            } else {
                precoBase = isLiquido ? precoCusto : precoVenda;
            }

            const estoqueConsiderado = estoque > 0 ? estoque : 0;
            const valorItem = estoqueConsiderado * precoBase;

            Object.keys(categories).forEach(catTag => {
                if (tags.includes(catTag) && estoque !== 0) {
                    categories[catTag].total += valorItem;
                    categories[catTag].count++;
                }
            });

            totalGeralValue += valorItem;

            const activeFilter = _state.activeEstoqueFilter;
            if (activeFilter === 'all' || tags.includes(activeFilter)) {
                topItems.push({
                    codigo: p.codigo,
                    descricao: p.descricao,
                    estoque: Math.max(0, estoque),
                    precoUnitario: precoBase,
                    precoCusto: precoCusto,
                    precoVenda: precoVenda,
                    valor: valorItem
                });
            }
        });

        const sortKey = _state.estoqueSort.key;
        const sortDir = _state.estoqueSort.direction === 'asc' ? 1 : -1;
        topItems.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * sortDir;
            }
            return (valA - valB) * sortDir;
        });

        return {
            totalGeralValue,
            isLiquido,
            categories: Object.values(categories),
            topItems: topItems
        };
    }

    function _renderEstoqueDashboard() {
        const data = _calculateEstoqueData();
        const activeFilter = _state.activeEstoqueFilter;
        const limit = _state.estoqueTopLimit;

        // Cards
        let cardsHtml = `
            <div data-filter="all" class="cursor-pointer transition-all duration-200 transform hover:scale-105 ${activeFilter === 'all' ? 'ring-4 ring-blue-300 shadow-lg' : ''} bg-blue-600 text-white p-4 rounded-xl shadow-md">
                <p class="text-xs font-bold uppercase opacity-80">Valor Total (${data.isLiquido ? 'Líquido' : 'Bruto'})</p>
                <p class="text-xl font-black">${data.totalGeralValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
        `;

        data.categories.forEach(cat => {
            const isActive = activeFilter === cat.id;
            cardsHtml += `
                <div data-filter="${cat.id}" class="cursor-pointer transition-all duration-200 transform hover:scale-105 ${isActive ? 'ring-4 shadow-lg border-opacity-50' : ''} bg-white p-4 rounded-xl shadow-md border-t-4" style="border-color: ${cat.color}; ${isActive ? 'box-shadow: 0 0 0 4px ' + cat.color + '44' : ''}">
                    <p class="text-xs font-bold text-gray-500 uppercase">${cat.label}</p>
                    <p class="text-xl font-bold text-gray-800">${cat.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p class="text-[10px] text-gray-400 font-medium">${cat.count} itens com saldo</p>
                </div>
            `;
        });
        if (_dom.estoqueSummaryCards) _dom.estoqueSummaryCards.innerHTML = cardsHtml;

        // Gráfico
        if (_dom.estoqueChartCanvas) {
            const ctx = _dom.estoqueChartCanvas.getContext('2d');
            if (_state.charts.estoque) _state.charts.estoque.destroy();

            _state.charts.estoque = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.categories.map(c => c.label),
                    datasets: [{
                        data: data.categories.map(c => c.total),
                        backgroundColor: data.categories.map(c => c.color),
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: 30
                    },
                    cutout: '60%',
                    plugins: { 
                        datalabels: {
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            formatter: (value, ctx) => {
                                if (!value || value === 0) return '';
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const perc = (value / total) * 100;
                                if (perc < 3) return '';
                                return [
                                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value),
                                    '(' + perc.toFixed(1) + '%)'
                                ];
                            },
                            textAlign: 'center',
                            color: '#374151',
                            font: { weight: 'bold', size: 11 },
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: 4,
                            padding: 4,
                            borderColor: '#e5e7eb',
                            borderWidth: 1
                        },
                        legend: { 
                            position: 'right',
                            labels: { boxWidth: 12, padding: 20, font: { size: 12, weight: 'bold' } }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((ctx.parsed / total) * 100).toFixed(1);
                                    return ` ${ctx.label}: ${ctx.parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Top Itens com Paginação
        if (_dom.estoqueTopItemsContainer) {
            const filterLabel = activeFilter === 'all' ? 'Geral' : data.categories.find(c => c.id === activeFilter)?.label;
            
            // Lógica de Paginação e Limite
            let baseItems = data.topItems;
            if (limit !== 'all') {
                baseItems = baseItems.slice(0, parseInt(limit));
            }
            
            const totalItems = baseItems.length;
            const totalPages = Math.ceil(totalItems / _state.estoquePageSize);
            const startIndex = (_state.estoqueCurrentPage - 1) * _state.estoquePageSize;
            const itemsToDisplay = baseItems.slice(startIndex, startIndex + _state.estoquePageSize);
            
            const limitLabel = limit === 'all' ? 'Todos os Itens' : `Top ${limit} Itens`;

            let paginationHtml = '';
            if (totalPages > 1) {
                paginationHtml = `
                    <div class="mt-4 flex items-center justify-between bg-gray-50 px-4 py-3 sm:px-6 rounded-lg border border-gray-200">
                        <div class="flex flex-1 justify-between sm:hidden">
                            <button id="estoque-prev-page-mobile" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${_state.estoqueCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">Anterior</button>
                            <button id="estoque-next-page-mobile" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${_state.estoqueCurrentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">Próximo</button>
                        </div>
                        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p class="text-sm text-gray-700">
                                    Mostrando <span class="font-bold">${startIndex + 1}</span> a <span class="font-bold">${Math.min(startIndex + _state.estoquePageSize, totalItems)}</span> de <span class="font-bold">${totalItems}</span> itens
                                </p>
                            </div>
                            <div>
                                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button id="estoque-prev-page" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${_state.estoqueCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                                        <span class="sr-only">Anterior</span>
                                        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
                                    </button>
                                    <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">Página ${_state.estoqueCurrentPage} de ${totalPages}</span>
                                    <button id="estoque-next-page" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${_state.estoqueCurrentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
                                        <span class="sr-only">Próximo</span>
                                        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>`;
            }

            _dom.estoqueTopItemsContainer.innerHTML = `
                <div class="mb-4 flex justify-between items-center">
                    <h3 class="text-lg font-bold text-gray-700">${limitLabel} - <span class="text-blue-600">${filterLabel}</span></h3>
                </div>
                ${paginationHtml}
                <div class="overflow-x-auto mt-4">
                    <table class="min-w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th data-estoque-sort="descricao" class="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100">
                                    Produto ${_state.estoqueSort.key === 'descricao' ? (_state.estoqueSort.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th data-estoque-sort="estoque" class="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100">
                                    Qtd. ${_state.estoqueSort.key === 'estoque' ? (_state.estoqueSort.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th data-estoque-sort="precoUnitario" class="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100">
                                    Unit. (${data.isLiquido ? 'Custo' : 'Venda'}) ${_state.estoqueSort.key === 'precoUnitario' ? (_state.estoqueSort.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th data-estoque-sort="valor" class="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100">
                                    Total ${_state.estoqueSort.key === 'valor' ? (_state.estoqueSort.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${itemsToDisplay.length > 0 ? itemsToDisplay.map(item => `
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="px-4 py-3">
                                        <p class="text-sm font-bold text-gray-800 line-clamp-1">${item.descricao}</p>
                                        <p class="text-[10px] text-gray-400 font-mono">${item.codigo}</p>
                                    </td>
                                    <td class="px-4 py-3 text-center text-sm font-mono">${item.estoque}</td>
                                    <td class="px-4 py-3 text-right text-sm text-gray-600">
                                        ${item.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td class="px-4 py-3 text-right text-sm font-bold ${item.precoUnitario === 0 ? 'text-red-600' : 'text-blue-600'}">
                                        ${item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                </tr>
                            `).join('') : `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 italic">Nenhum item com saldo nesta categoria</td></tr>`}
                        </tbody>
                    </table>
                </div>
                <div class="mt-4">
                    ${paginationHtml}
                </div>
            `;
        }
    }

    // --- Sales Dashboard Logic ---

    function _populateYearFilter() {
        if (!_dom.yearFilter) return;

        // Se já temos anos populados, não precisa refazer a cada troca de menu
        if (_dom.yearFilter.options.length > 1) return;

        const allData = [..._allNFeData, ..._allLojaIntegradaOrders, ..._allPedidosBling];
        const years = new Set();

        allData.forEach(item => {
            const dateString = item.data_de_emissao || item.data_criacao || item.data_criação; 
            if (dateString) {
                const date = _utils.parsePtBrDate ? _utils.parsePtBrDate(dateString) : new Date(dateString); 
                if (date && !isNaN(date.getTime())) {
                    years.add(date.getFullYear());
                }
            }
        });

        let sortedYears = Array.from(years).sort((a, b) => b - a);

        // Garante que o ano atual esteja na lista
        const currentYear = new Date().getFullYear();
        if (!sortedYears.includes(currentYear)) {
            sortedYears.push(currentYear);
            sortedYears.sort((a, b) => b - a);
        }

        _dom.yearFilter.innerHTML = '<option value="all">Tudo</option>'; 
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            _dom.yearFilter.appendChild(option);
        });

        // Define o valor inicial baseado no estado
        if (_dom.yearFilter.querySelector(`option[value="${_state.selectedYearFilter}"]`)) {
            _dom.yearFilter.value = _state.selectedYearFilter;
        }
    }

    function _setDateRange(value) {
        const today = new Date();
        let startDate, endDate;
        const formatDate = (date) => date.toISOString().split('T')[0];

        const days = parseInt(value, 10);
        if (!isNaN(days)) {
            endDate = today;
            startDate = new Date();
            startDate.setDate(endDate.getDate() - days);
        } else {
            switch (value) {
                case 'all': startDate = null; endDate = null; break;
                case 'current_month': 
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1); 
                    endDate = today; 
                    break;
                case 'last_month': 
                    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1); 
                    endDate = new Date(today.getFullYear(), today.getMonth(), 0); 
                    break;
                case 'last_3_months': 
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
                    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1); 
                    break;
                case 'last_6_months': 
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
                    break;
            }
        }

        _state.currentDateFilterValue = value;
        _state.startDate = startDate ? formatDate(startDate) : '';
        _state.endDate = endDate ? formatDate(endDate) : '';
        
        if (_dom.startDateInput) _dom.startDateInput.value = _state.startDate;
        if (_dom.endDateInput) _dom.endDateInput.value = _state.endDate;

        _renderSalesView();
    }

    function _createSummaryCard(id, title, countLabel, count, totalValue, color) {
        const valueFormatted = (totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `<div data-id="${id}" class="${color} text-white p-4 rounded-lg shadow-lg flex flex-col justify-between cursor-pointer transform transition-transform duration-200 hover:scale-105">
                <div>
                    <h3 class="text-md font-semibold">${title}</h3>
                    <p class="text-sm">Total de ${countLabel}: ${count}</p>
                </div>
                <p class="text-2xl font-bold mt-2 self-end">${valueFormatted}</p>
            </div>`;
    }

    function _updateDashboardChart(selectedChannel) {
        if (selectedChannel) _state.selectedChannel = selectedChannel;

        if (_dom.summaryCards) {
            _dom.summaryCards.querySelectorAll('[data-id]').forEach(card => card.classList.remove('ring-4', 'ring-offset-2', 'ring-white', 'ring-opacity-75'));
            const activeCard = _dom.summaryCards.querySelector(`[data-id="${_state.selectedChannel}"]`);
            if (activeCard) activeCard.classList.add('ring-4', 'ring-offset-2', 'ring-white', 'ring-opacity-75');
        }

        _renderSalesView(); 
    }

    /**
     * Normaliza o nome da loja/canal para garantir que variações (ex: E-Commerce vs Loja Integrada) 
     * sejam contabilizadas no mesmo grupo.
     */
    function _getNormalizedStoreName(p) {
        const loja = String(p.loja || "").trim();
        const vendedor = String(p.vendedor || "").trim();
        
        // Verifica se é Loja Integrada ou E-Commerce (ambos são tratados como o mesmo canal)
        const isLI = (
            loja.toLowerCase().includes('loja integrada') || 
            loja.toLowerCase().includes('e-commerce') ||
            vendedor.toLowerCase().includes('e-commerce') ||
            vendedor.toLowerCase().includes('loja integrada')
        );

        if (isLI) return 'Loja Integrada';
        if (loja.toLowerCase().includes('mercado livre')) return 'Mercado Livre';
        
        // Se for vazio ou explicitamente Bling, retorna Bling
        if (!loja || loja.toLowerCase().includes('bling')) return 'Bling';
        
        return loja;
    }

    function _renderSalesView() {
        if (!_dom.salesChartCanvas || !_allPedidosBling) return;

        if (_salesChartInstance) { _salesChartInstance.destroy(); _salesChartInstance = null; }
        _dom.salesTableContainer.innerHTML = '';
        
        let filteredPedidos;
        const selectedYear = parseInt(_state.selectedYearFilter, 10);

        // Somente pedidos "Atendido", "Concluído" ou "Faturado" são considerados vendas concluídas
        const pedidosBase = _allPedidosBling.filter(p => {
            const sit = (p.situação || p.situacao || p.situao || "").toLowerCase().trim();
            // Filtro inclusivo: Atendido, Concluído, Entregue, Faturado (sub-strings para maior robustez)
            return sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad');
        });

        if (selectedYear && !isNaN(selectedYear)) {
            filteredPedidos = pedidosBase.filter(p => {
                const pDate = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
                return pDate && pDate.getFullYear() === selectedYear;
            });
        } else {
            const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
            const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
            filteredPedidos = pedidosBase.filter(p => {
                const pDate = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
                return pDate && (!startDate || pDate >= startDate) && (!endDate || pDate <= endDate);
            });
        }

        const stores = ['Bling', 'Mercado Livre', 'Loja Integrada'];
        const storeData = stores.map(store => {
            const currentPedidos = filteredPedidos.filter(p => _getNormalizedStoreName(p) === store);
            const total = currentPedidos.reduce((sum, p) => {
                const val = parseFloat(p.total_pedido || p['total pedido'] || p.valor_total || p.total_venda || p.total || p.valortotal || 0) || 0;
                return sum + val;
            }, 0);
            return { name: `Vendas ${store}`, id: store.toLowerCase().replace(/ /g, '_'), count: currentPedidos.length, total: total };
        });

        const grandTotalVendas = storeData.reduce((sum, store) => sum + store.total, 0);
        const grandTotalVendasCount = storeData.reduce((sum, store) => sum + store.count, 0);
        
        const colors = { 'bling': 'bg-green-500', 'mercado_livre': 'bg-yellow-500', 'loja_integrada': 'bg-blue-500' };
        let cardsHtml = storeData.map(store => _createSummaryCard(store.id, store.name, "Pedidos", store.count, store.total, colors[store.id])).join('');
        cardsHtml += _createSummaryCard('total', 'Total Vendas (Pedidos)', "Pedidos", grandTotalVendasCount, grandTotalVendas, 'bg-gray-700');
        
        if (_dom.summaryCards) _dom.summaryCards.innerHTML = cardsHtml;

        const aggregationLevel = ['current_month', 'last_month', '30'].includes(_state.currentDateFilterValue) ? 'day' : 'month';
        const salesByPeriod = {};
        
        filteredPedidos.forEach(p => {
            const date = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
            if (!date) return;
            const key = aggregationLevel === 'day' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!salesByPeriod[key]) salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
            const store = _getNormalizedStoreName(p);
            let value = parseFloat(p.total_pedido || p['total pedido'] || p.valor_total || p.total_venda || p.total || p.valortotal || 0) || 0;
            
            // Se modo líquido ativado, tentamos subtrair o custo
            if (_state.chartDisplayMode === 'liquida') {
                // Tentamos extrair itens do pedido
                const itemsStr = p.itens || '';
                // O formato dos itens no backend novo é (cod, qty, price) (cod, qty, price) ...
                const itemsMatch = itemsStr.match(/\(([^)]+)\)/g);
                if (itemsMatch) {
                    let totalCostOfGoods = 0;
                    itemsMatch.forEach(m => {
                        const parts = m.slice(1, -1).split(',');
                        if (parts.length >= 2) {
                            const cod = parts[0].trim();
                            const qty = parseFloat(parts[1]) || 0;
                            const product = _allProducts.find(prod => prod.codigo === cod);
                            const cost = product ? _parseCurrencyBRL(product.preco_de_custo) : 0;
                            totalCostOfGoods += cost * qty;
                        }
                    });
                    value -= totalCostOfGoods;
                }
            }
            if (salesByPeriod[key][store] !== undefined) salesByPeriod[key][store] += value;
        });

        const sortedKeys = Object.keys(salesByPeriod).sort();
        const chartLabels = sortedKeys.map(key => {
            if (aggregationLevel === 'day') { const parts = key.split('-'); return `${parts[2]}/${parts[1]}`; }
            const parts = key.split('-');
            return new Date(parts[0], parts[1] - 1).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        });
        const allDatasets = stores.map(store => {
            const channelId = store.toLowerCase().replace(/ /g, '_');
            return { 
                label: store, 
                data: sortedKeys.map(k => (salesByPeriod[k] ? salesByPeriod[k][store] || 0 : 0)), 
                borderColor: { 'Bling': 'rgba(34, 197, 94, 1)', 'Mercado Livre': 'rgba(234, 179, 8, 1)', 'Loja Integrada': 'rgba(59, 130, 246, 1)' }[store], 
                backgroundColor: { 'Bling': 'rgba(34, 197, 94, 0.2)', 'Mercado Livre': 'rgba(234, 179, 8, 0.2)', 'Loja Integrada': 'rgba(59, 130, 246, 0.2)' }[store], 
                fill: true, 
                tension: 0.1, 
                hidden: _state.selectedChannel !== 'total' && channelId !== _state.selectedChannel 
            };
        });

        const ctx = _dom.salesChartCanvas.getContext('2d');
        Chart.register(ChartDataLabels);
        _salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: chartLabels, datasets: allDatasets },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    datalabels: { 
                        anchor: 'end', 
                        align: 'top', 
                        color: '#374151', 
                        font: { weight: 'bold' }, 
                        formatter: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 
                        display: (context) => context.dataset.data[context.dataIndex] > 0 
                    } 
                }, 
                scales: { y: { beginAtZero: true } } 
            }
        });

        if (_state.selectedChannel !== 'total') {
            let chName = 'Loja Integrada';
            if (_state.selectedChannel === 'bling') chName = 'Bling';
            if (_state.selectedChannel === 'mercado_livre') chName = 'Mercado Livre';
            
            _dom.salesTableContainer.innerHTML = `
                <div class="border-b border-gray-200 mt-6">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        <a href="#" data-tab="vendas" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">Vendas Faturadas (${chName})</a>
                        <a href="#" data-tab="pedidos" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">Todos os Pedidos (${chName})</a>
                    </nav>
                </div>
                <div id="li-tab-content"></div>`;
            _renderTabContent();
        } else {
            _dom.salesTableContainer.innerHTML = _getSalesTableHTML(sortedKeys, salesByPeriod);
        }
    }

    // --- Tab & Table Rendering Logic ---

    function _renderTabContent() {
        const tabContentContainer = document.getElementById('li-tab-content');
        if (!tabContentContainer) return; 

        _dom.salesTableContainer.querySelectorAll('[data-tab]').forEach(tab => {
            const isActive = _state.activeLiTab === tab.dataset.tab;
            tab.classList.toggle('border-blue-500', isActive);
            tab.classList.toggle('text-blue-600', isActive);
            tab.classList.toggle('border-transparent', !isActive);
            tab.classList.toggle('text-gray-500', !isActive);
        });

        let filteredNFe, filteredOrders;
        const selectedYear = parseInt(_state.selectedYearFilter, 10);

        let currentStoreName = 'Loja Integrada';
        if (_state.selectedChannel === 'bling') currentStoreName = 'Bling';
        if (_state.selectedChannel === 'mercado_livre') currentStoreName = 'Mercado Livre';

        if (selectedYear && !isNaN(selectedYear)) {
            filteredNFe = _allNFeData.filter(nfe => _utils.parsePtBrDate(nfe.data_de_emissao)?.getFullYear() === selectedYear);
            filteredOrders = _allPedidosBling.filter(p => {
                const isTarget = _getNormalizedStoreName(p) === currentStoreName;
                const d = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
                return isTarget && d && d.getFullYear() === selectedYear;
            });
        } else {
            const startDate = _state.startDate ? _utils.parsePtBrDate(_state.startDate) : null;
            const endDate = _state.endDate ? _utils.parsePtBrDate(_state.endDate) : null;
            
            filteredNFe = _allNFeData.filter(nfe => {
                const d = _utils.parsePtBrDate(nfe.data_de_emissao);
                return d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
            });
            
            filteredOrders = _allPedidosBling.filter(p => {
                const isTarget = _getNormalizedStoreName(p) === currentStoreName;
                const d = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
                return isTarget && d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
            });
        }

        if (_state.activeLiTab === 'vendas') {
            const salesByPeriod = {};
            const liPedidos = _allPedidosBling.filter(p => {
                const sit = (p.situação || p.situacao || p.situao || "").toLowerCase().trim();
                const isConcluido = (sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad'));
                if (!isConcluido) return false;

                const d = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
                if (!d) return false;
                if (selectedYear && !isNaN(selectedYear) && d.getFullYear() !== selectedYear) return false;
                if (!selectedYear) {
                    const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
                    const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
                    if ((startDate && d < startDate) || (endDate && d > endDate)) return false;
                }
                return true;
            });

            liPedidos.forEach(p => {
                const d = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
                if (!d) return;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!salesByPeriod[key]) salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
                const store = _getNormalizedStoreName(p);
                if (salesByPeriod[key][store] !== undefined) salesByPeriod[key][store] += parseFloat(p.total_pedido || p['total pedido'] || 0) || 0;
            });
            tabContentContainer.innerHTML = _getSalesTableHTML(Object.keys(salesByPeriod).sort(), salesByPeriod);
        } else {
            // Removemos o filtro estrito de allowedStatus para permitir novos status como "Atendido"
            let orders = filteredOrders;
            const { key, direction } = _state.lojaIntegradaSort;
            const dir = direction === 'asc' ? 1 : -1;
            orders.sort((a, b) => {
                const valA = a[key], valB = b[key];
                if (key === 'valor_total' || key === 'numero_pedido') return (parseFloat(valA || 0) - parseFloat(valB || 0)) * dir;
                if (key === 'data_criação' || key === 'data_criacao') return (new Date(valA) - new Date(valB)) * dir;
                return String(valA || '').localeCompare(String(valB || '')) * dir;
            });
            tabContentContainer.innerHTML = _getLojaIntegradaOrdersTableHTML(orders);
        }
    }

    function _getSalesTableHTML(sortedMonths, salesData) {
        const formatCurrency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        let totals = { Bling: 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };

        let html = `<div class="bg-white p-4 rounded-lg shadow-md"><h3 class="text-xl font-bold text-gray-800 mb-4">Vendas Mensais Detalhadas</h3><div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês/Ano</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bling</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mercado Livre</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loja Integrada</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Mês</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
        
        sortedMonths.forEach(monthKey => {
            const data = salesData[monthKey] || { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
            Object.keys(totals).forEach(k => totals[k] += data[k]);
            const monthTotal = data['Bling'] + data['Mercado Livre'] + data['Loja Integrada'];
            const [y, m] = monthKey.split('-');
            const label = new Date(y, m - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            html += `<tr><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${label.charAt(0).toUpperCase() + label.slice(1)}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-right clickable-sales-cell cursor-pointer hover:bg-gray-50" data-month-key="${monthKey}" data-channel="Bling">${formatCurrency(data['Bling'])}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-right clickable-sales-cell cursor-pointer hover:bg-gray-50" data-month-key="${monthKey}" data-channel="Mercado Livre">${formatCurrency(data['Mercado Livre'])}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-right clickable-sales-cell cursor-pointer hover:bg-gray-50" data-month-key="${monthKey}" data-channel="Loja Integrada">${formatCurrency(data['Loja Integrada'])}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">${formatCurrency(monthTotal)}</td></tr>`;
        });
        
        const grandTotal = totals.Bling + totals['Mercado Livre'] + totals['Loja Integrada'];
        html += `</tbody><tfoot class="bg-gray-100\"><tr><th class="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase">Total Período</th><th class="px-6 py-3 text-right text-sm font-bold text-gray-700 clickable-sales-cell cursor-pointer hover:bg-gray-200" data-month-key="period-total" data-channel="Bling">${formatCurrency(totals.Bling)}</th><th class="px-6 py-3 text-right text-sm font-bold text-gray-700 clickable-sales-cell cursor-pointer hover:bg-gray-200" data-month-key="period-total" data-channel="Mercado Livre">${formatCurrency(totals['Mercado Livre'])}</th><th class="px-6 py-3 text-right text-sm font-bold text-gray-700 clickable-sales-cell cursor-pointer hover:bg-gray-200" data-month-key="period-total" data-channel="Loja Integrada">${formatCurrency(totals['Loja Integrada'])}</th><th class="px-6 py-3 text-right text-sm font-extrabold text-gray-900 clickable-sales-cell cursor-pointer hover:bg-gray-200" data-month-key="period-total" data-channel="Total">${formatCurrency(grandTotal)}</th></tr></tfoot></table></div></div>`;
        return html;
    }

    function _getLojaIntegradaOrdersTableHTML(orders) {
        const formatCurrency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        let html = `
            <div class="bg-white p-4 rounded-lg shadow-md mt-8">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Pedidos E-Commerce (Bling)</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedido Nº</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Situação</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;

        if (orders.length === 0) {
            html += `<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500 italic text-sm">Nenhum pedido encontrado para este período.</td></tr>`;
        } else {
            orders.forEach(p => {
                const total = parseFloat(p.total_pedido || p['total pedido'] || p.valor_total || p.total_venda || p.total || p.valortotal || 0) || 0;
                const dStr = p.data || p.data_criacao || p.data_pedido || "-";
                
                html += `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${p.numero || p.número || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${_formatDate(dStr)}</td>
                        <td class="px-6 py-4 text-sm text-gray-900 truncate max-w-[200px]" title="${p.contato_nome || p['contato nome'] || '-'}">${p.contato_nome || p['contato nome'] || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-xs">
                             <span class="px-2.5 py-1 font-bold uppercase rounded-full bg-gray-100 text-gray-800">${p.situação || p.situacao || p.situao || '-'}</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">${formatCurrency(total)}</td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div></div>`;
        return html;
    }

    // --- Modal, Tooltips & Export Functions ---

    function _showSalesDetailsModal(monthKey, channel) {
        let start, end, titleDate;
        if (monthKey === 'period-total') {
            start = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
            end = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
            titleDate = (start && end) ? `de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}` : "em todo o período";
        } else {
            const [y, m] = monthKey.split('-');
            start = new Date(parseInt(y), parseInt(m) - 1, 1);
            end = new Date(parseInt(y), parseInt(m), 0);
            titleDate = `de ${new Date(y, m - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
        }
    
        _currentSalesDetails = _allPedidosBling.filter(p => {
            const sit = (p.situação || p.situacao || p.situao || "").toLowerCase().trim();
            if (!(sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad'))) return false;

            const d = _utils.parsePtBrDate(p.data || p.data_criacao || p.data_pedido || "");
            if (!d) return false;

            const selectedYear = parseInt(_state.selectedYearFilter, 10);
            if (monthKey === 'period-total' && selectedYear && !isNaN(selectedYear)) {
                if (d.getFullYear() !== selectedYear) return false;
            }

            const channelMatch = (channel === 'Total' || channel === 'total') ? true : (_getNormalizedStoreName(p) === channel);
            return channelMatch && (!start || d >= start) && (!end || d <= end);
        });
        
        const total = _currentSalesDetails.reduce((sum, p) => sum + (parseFloat(p.total_pedido || p['total pedido'] || 0) || 0), 0);
        _dom.salesDetailsModalTitle.textContent = `Vendas Detalhadas (${channel}) ${titleDate} - Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        
        // Reseta ordenação ao abrir um novo modal de período/canal
        _state.salesSort = { key: 'data', direction: 'desc' };

        if (_currentSalesDetails.length === 0) {
            _dom.salesDetailsModalContent.innerHTML = '';
            _dom.noSalesDetailsMessage.classList.remove('hidden');
        } else {
            _dom.noSalesDetailsMessage.classList.add('hidden');
            _renderSalesDetailsTable();
        }
        _dom.salesDetailsModal.classList.remove('hidden');
    }

    /**
     * Renderiza a estrutura da tabela de detalhes de vendas com cabeçalhos clicáveis para ordenação.
     */
    function _renderSalesDetailsTable() {
        const sort = _state.salesSort;
        const getIcon = (key) => {
            if (sort.key !== key) return '<svg class="w-3 h-3 ml-1 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5zM15 10l-5 5-5-5h10z"/></svg>';
            return sort.direction === 'asc' 
                ? '<svg class="w-3 h-3 ml-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z"/></svg>'
                : '<svg class="w-3 h-3 ml-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M15 10l-5 5-5-5h10z"/></svg>';
        };

        const html = `
            <table class="min-w-full divide-y divide-gray-200" id="sales-details-table">
                <thead class="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="pedido">
                            <div class="flex items-center">Pedido ${getIcon('pedido')}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="nota">
                            <div class="flex items-center">Nota ${getIcon('nota')}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="cliente">
                            <div class="flex items-center">Cliente ${getIcon('cliente')}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="data">
                            <div class="flex items-center">Data ${getIcon('data')}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="vendedor">
                            <div class="flex items-center">Vendedor ${getIcon('vendedor')}</div>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="valor">
                            <div class="flex items-center justify-end">Valor ${getIcon('valor')}</div>
                        </th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200" id="sales-details-tbody">
                    <!-- Conteúdo renderizado dinamicamente -->
                </tbody>
            </table>
        `;
        _dom.salesDetailsModalContent.innerHTML = html;
        _applySalesSort();
    }

    /**
     * Aplica a ordenação atual à lista de detalhes de vendas e renderiza o corpo da tabela.
     */
    function _applySalesSort() {
        const sort = _state.salesSort;
        const sortedData = [..._currentSalesDetails].sort((a, b) => {
            let valA, valB;
            
            // Helper para obter dados da NFe se necessário
            const getNfe = (p) => {
                const rawId = p.id_nota_fiscal || p['id nota fiscal'] || "";
                const id = String(rawId).split('.')[0].trim();
                return id ? _allNFeData.find(n => String(n.id_nota || "").split('.')[0].trim() === id) : null;
            };

            switch (sort.key) {
                case 'pedido':
                    valA = parseInt(a.numero || a.número) || 0;
                    valB = parseInt(b.numero || b.número) || 0;
                    break;
                case 'nota':
                    const nfeA_nota = getNfe(a);
                    const nfeB_nota = getNfe(b);
                    valA = nfeA_nota ? (parseInt(nfeA_nota.numero_da_nota) || 0) : 0;
                    valB = nfeB_nota ? (parseInt(nfeB_nota.numero_da_nota) || 0) : 0;
                    break;
                case 'cliente':
                    valA = String(a.contato_nome || a['contato nome'] || "").toLowerCase();
                    valB = String(b.contato_nome || b['contato nome'] || "").toLowerCase();
                    break;
                case 'vendedor':
                    const getVendedor = (p) => {
                        let raw = p.vendedor || (getNfe(p)?.nome_do_vendedor) || 'N/A';
                        for (const [id, name] of Object.entries(_vendedorMap)) {
                            if (raw.includes(id)) return name;
                        }
                        return raw;
                    };
                    valA = getVendedor(a).toLowerCase();
                    valB = getVendedor(b).toLowerCase();
                    break;
                case 'valor':
                    valA = parseFloat(a.total_pedido || a['total pedido'] || 0);
                    valB = parseFloat(b.total_pedido || b['total pedido'] || 0);
                    break;
                case 'data':
                default:
                    valA = _utils.parsePtBrDate(a.data) || 0;
                    valB = _utils.parsePtBrDate(b.data) || 0;
                    break;
            }

            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            
            // Critério de desempate: sempre Data desc se não for a chave primária
            if (sort.key !== 'data') {
                const dateA = _utils.parsePtBrDate(a.data) || 0;
                const dateB = _utils.parsePtBrDate(b.data) || 0;
                return dateB - dateA;
            }
            return 0;
        });

        _renderSalesTableBody(sortedData);
    }

    /**
     * Renderiza o corpo da tabela de detalhes de vendas.
     */
    function _renderSalesTableBody(data) {
        const tbody = document.getElementById('sales-details-tbody');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-gray-500 italic text-sm">Nenhum resultado para estes filtros.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach(p => {
            const rawNfeId = p.id_nota_fiscal || p['id nota fiscal'] || "";
            const nfeId = String(rawNfeId).split('.')[0].trim();
            const nfe = nfeId ? _allNFeData.find(n => String(n.id_nota || "").split('.')[0].trim() === nfeId) : null;
            
            const numeroDisplay = nfe ? nfe.numero_da_nota : '-';
            const linkDanfe = nfe ? nfe.link_danfe : '#';
            const hasNfe = !!nfe;
            
            let vendedorRaw = p.vendedor || (nfe ? nfe.nome_do_vendedor : 'N/A');
            let vendedor = vendedorRaw;
            for (const [id, name] of Object.entries(_vendedorMap)) {
                if (vendedorRaw.includes(id)) { vendedor = name; break; }
            }
            
            const itensRaw = nfe ? nfe.itens : (p.itens || '');
            const totalValue = parseFloat(p.total_pedido || p['total pedido'] || p.valor_total || p.total_venda || p.total || p.valortotal || 0) || 0;

            html += `
            <tr id="sales-detail-row-${p.id || p.id_pedido}" class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                    ${p.numero || p.número || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${hasNfe ? `<a href="${linkDanfe}" target="_blank" class="text-blue-600 hover:underline font-bold">${numeroDisplay}</a>` : `<span class="text-red-500 font-bold">Sem Nota</span>`}
                </td>
                <td class="px-6 py-4 whitespace-nowrap nfe-items-tooltip-trigger cursor-help" 
                    data-itens="${itensRaw}" 
                    data-frete="${nfe ? (parseFloat(nfe.valor_do_frete) || 0) : 0}" 
                    data-valor-total="${totalValue}">
                    <div class="text-sm font-medium text-gray-900 truncate max-w-[200px]" title="${p.contato_nome || p['contato nome'] || '-'}">${p.contato_nome || p['contato nome'] || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                    ${_formatDate(p.data || p.data_criacao || p.data_pedido)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    ${vendedor}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <div class="flex items-center justify-center space-x-3">

                        
                        <span class="edit-sales-observation-btn cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors" 
                            data-target-id="${p.numero || p.número || p.id || p.id_pedido}" 
                            data-observation='${(() => {
                                const obsPedido = p.observacao || p.observação || "";
                                if (obsPedido && obsPedido.trim()) return JSON.stringify([{ autor: 'Pedido', obs: obsPedido.trim() }]);
                                return JSON.stringify([]);
                            })()}'
                            title="Adicionar/Ver Observação">
                           <svg class="h-5 w-5 ${(p.observacao || p.observação) ? 'text-red-500' : 'text-gray-300'}" viewBox="0 0 20 20" fill="currentColor">
                               <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                           </svg>
                        </span>
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }


    function _showNfeItemsTooltip(event) {
        const trigger = event.target.closest('.nfe-items-tooltip-trigger');
        if (!trigger || !_dom.customProductTooltip) return;

        const items = _parseNfeItemsString(trigger.dataset.itens);
        if (items.length === 0) return;

        const frete = parseFloat(trigger.dataset.frete || 0);
        const valorNotaReal = parseFloat(trigger.dataset.valorTotal || 0);
        const subtotal = items.reduce((s, i) => s + (i.valor * i.quantidade), 0);

        // Calcula o desconto pela diferença (Fórmula: Desconto = (Subtotal + Frete) - Valor Total Real)
        let descontoCalculado = (subtotal + frete) - valorNotaReal;
        
        // Trata arredondamentos minúsculos e evita valores negativos
        if (Math.abs(descontoCalculado) < 0.01) descontoCalculado = 0;
        if (descontoCalculado < 0) descontoCalculado = 0;

        let html = `<div class="p-2 bg-white rounded-lg shadow-xl border border-gray-300 max-w-md"><h4 class="font-bold text-sm mb-2 pb-1 border-b">Itens da NFe</h4><ul class="space-y-1 text-xs">`;
        items.forEach(i => {
            const p = _allProducts.find(prod => prod.codigo === i.codigo);
            html += `<li class="flex justify-between"><span>${i.quantidade}x ${p ? p.descricao : i.codigo}</span><span class="font-semibold ml-4">${i.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></li>`;
        });
        html += `</ul><div class="mt-2 pt-2 border-t text-xs">
            <div class="flex justify-between"><span>Subtotal:</span><span>${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div class="flex justify-between"><span>Frete:</span><span>${frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            ${descontoCalculado > 0 ? `<div class="flex justify-between text-red-600 font-medium"><span>Desconto:</span><span>-${descontoCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>` : ''}
            <div class="flex justify-between font-bold border-t mt-1 pt-1 text-sm"><span>Total da Nota:</span><span>${valorNotaReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
        </div></div>`;

        _dom.customProductTooltip.innerHTML = html;
        _dom.customProductTooltip.classList.remove('hidden');
        _dom.customProductTooltip.style.opacity = '1';
        if (_utils.positionTooltip) _utils.positionTooltip(event, _dom.customProductTooltip);
    }

    function _showSellerSalesTooltip(event) {
        const trigger = event.target.closest('.seller-tooltip-trigger');
        if (!trigger || !_dom.customProductTooltip) return;

        const name = trigger.dataset.sellerName;
        const sales = _currentSalesDetails.filter(n => n.nome_do_vendedor === name);
        const total = sales.reduce((s, n) => s + (parseFloat(n.valor_da_nota) || 0), 0);

        _dom.customProductTooltip.innerHTML = `
            <div class="p-2 bg-white rounded-lg shadow-xl border border-gray-300 text-xs">
                <h4 class="font-bold border-b mb-1 pb-1">Vendas: ${name}</h4>
                <div class="flex justify-between"><span>Total:</span><span class="font-bold ml-4">${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div class="flex justify-between"><span>Notas:</span><span>${sales.length}</span></div>
            </div>`;
        _dom.customProductTooltip.classList.remove('hidden');
        _dom.customProductTooltip.style.opacity = '1';
        if (_utils.positionTooltip) _utils.positionTooltip(event, _dom.customProductTooltip);
    }

    function _exportToCSV(type) {
        if (!_currentSalesDetails.length) return;
        
        const formatBRL = (val) => {
            return new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            }).format(val || 0);
        };

        let headers, rows;
        if (type === 'notes') {
            headers = ["Nº Nota", "Data", "Cliente", "Vendedor", "Valor", "Situação", "Origem"];
            rows = _currentSalesDetails.map(n => [
                n.numero_da_nota, 
                _formatDate(n.data_de_emissao), 
                n.nome_do_cliente, 
                n.nome_do_vendedor, 
                formatBRL(n.valor_da_nota), 
                n.situacao, 
                n.origem_loja
            ]);
        } else {
            headers = ["Nº Nota", "Data", "Cliente", "Código Item", "Quantidade", "Valor Unitario (Venda)", "Valor Unitario (Custo)", "Total (Venda)", "Total (Custo)"];
            rows = [];
            _currentSalesDetails.forEach(n => {
                _parseNfeItemsString(n.itens).forEach(i => {
                    const product = _allProducts.find(p => String(p.codigo) === String(i.codigo));
                    const custoUnitario = product ? (parseFloat(product.preco_de_custo) || 0) : 0;
                    const vendaUnitario = parseFloat(i.valor) || 0;
                    const quantidade = parseFloat(i.quantidade) || 0;

                    const totalVenda = quantidade * vendaUnitario;
                    const totalCusto = quantidade * custoUnitario;

                    rows.push([
                        n.numero_da_nota, 
                        _formatDate(n.data_de_emissao), 
                        n.nome_do_cliente, 
                        i.codigo, 
                        quantidade, 
                        formatBRL(vendaUnitario),
                        formatBRL(custoUnitario),
                        formatBRL(totalVenda),
                        formatBRL(totalCusto)
                    ]);
                });
            });
        }

        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `vendas_${type}.csv`;
        link.click();
    }

    // --- Event Binding ---

    function _bindEvents() {
        _dom.selectVendasBtn?.addEventListener('click', _showSalesDashboard);
        _dom.selectEstoqueBtn?.addEventListener('click', _showEstoqueDashboard);
        _dom.backToSelectorBtn?.addEventListener('click', _showSelector);
        _dom.backToSelectorFromEstoqueBtn?.addEventListener('click', _showSelector);

        _dom.estoqueTypeToggle?.addEventListener('change', () => { _state.estoqueCurrentPage = 1; _renderEstoqueDashboard(); });
        _dom.estoqueTopLimitSelect?.addEventListener('change', e => { _state.estoqueTopLimit = e.target.value; _state.estoqueCurrentPage = 1; _renderEstoqueDashboard(); });
        
        _dom.estoqueSummaryCards?.addEventListener('click', e => {
            const card = e.target.closest('[data-filter]');
            if (card) { _state.activeEstoqueFilter = card.dataset.filter; _state.estoqueCurrentPage = 1; _renderEstoqueDashboard(); }
        });

        _dom.estoqueTopItemsContainer?.addEventListener('click', e => {
            const header = e.target.closest('[data-estoque-sort]');
            if (header) {
                const key = header.dataset.estoqueSort;
                _state.estoqueSort = { key, direction: (_state.estoqueSort.key === key && _state.estoqueSort.direction === 'desc') ? 'asc' : 'desc' };
                _state.estoqueCurrentPage = 1;
                _renderEstoqueDashboard();
                return;
            }

            // Listeners de Paginação
            if (e.target.closest('#estoque-prev-page') || e.target.closest('#estoque-prev-page-mobile')) {
                if (_state.estoqueCurrentPage > 1) { 
                    _state.estoqueCurrentPage--; 
                    _renderEstoqueDashboard(); 
                    _dom.estoqueTopItemsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
            if (e.target.closest('#estoque-next-page') || e.target.closest('#estoque-next-page-mobile')) {
                const data = _calculateEstoqueData();
                const limit = _state.estoqueTopLimit;
                const baseItems = limit === 'all' ? data.topItems : data.topItems.slice(0, parseInt(limit));
                const totalPages = Math.ceil(baseItems.length / _state.estoquePageSize);
                if (_state.estoqueCurrentPage < totalPages) { 
                    _state.estoqueCurrentPage++; 
                    _renderEstoqueDashboard(); 
                    _dom.estoqueTopItemsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });

        _dom.yearFilter?.addEventListener('change', e => {
            _state.selectedYearFilter = e.target.value;
            if (_dom.startDateInput) _dom.startDateInput.value = '';
            if (_dom.endDateInput) _dom.endDateInput.value = '';
            _setDateRange('all');
        });

        _dom.vendaTypeToggle?.addEventListener('change', e => {
            _state.chartDisplayMode = e.target.checked ? 'liquida' : 'bruta';
            _renderSalesView();
        });

        _dom.startDateInput?.addEventListener('change', () => { _state.currentDateFilterValue = 'custom'; _renderSalesView(); });
        _dom.endDateInput?.addEventListener('change', () => { _state.currentDateFilterValue = 'custom'; _renderSalesView(); });
        _dom.clearFiltersBtn?.addEventListener('click', () => {
            _state.selectedYearFilter = new Date().getFullYear().toString();
            if (_dom.yearFilter) _dom.yearFilter.value = _state.selectedYearFilter;
            
            const rAll = document.querySelector('[name="date-range"][value="all"]');
            if (rAll) rAll.checked = true;

            _setDateRange('all');
        });

        _dom.filterBar?.querySelectorAll('[name="date-range"]').forEach(r => {
            r.addEventListener('change', e => { if (e.target.checked) _setDateRange(e.target.value); });
        });

        _dom.summaryCards?.addEventListener('click', e => {
            const card = e.target.closest('[data-id]');
            if (card) _updateDashboardChart(card.dataset.id);
        });

        _dom.salesTableContainer?.addEventListener('click', e => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                e.preventDefault();
                _state.activeLiTab = tab.dataset.tab;
                _renderTabContent();
                return;
            }
            const sort = e.target.closest('[data-sort-key]');
            if (sort && _state.selectedChannel === 'loja_integrada' && _state.activeLiTab === 'pedidos') {
                const key = sort.dataset.sortKey;
                _state.lojaIntegradaSort = { key, direction: (_state.lojaIntegradaSort.key === key && _state.lojaIntegradaSort.direction === 'asc') ? 'desc' : 'asc' };
                _renderTabContent();
            }
        });

        _dom.page?.addEventListener('click', e => {
            const cell = e.target.closest('.clickable-sales-cell');
            if (cell) _showSalesDetailsModal(cell.dataset.monthKey, cell.dataset.channel);
        });

        _dom.salesDetailsModal?.addEventListener('click', e => {
            if (e.target.closest('#close-sales-details-modal-btn')) _dom.salesDetailsModal.classList.add('hidden');
            if (e.target.closest('#sales-details-export-button')) { e.stopPropagation(); _dom.exportDropdown.classList.toggle('hidden'); }
            if (e.target.closest('#export-sales-details-notes-csv-btn')) { e.preventDefault(); _exportToCSV('notes'); _dom.exportDropdown.classList.add('hidden'); }
            if (e.target.closest('#export-sales-details-items-csv-btn')) { e.preventDefault(); _exportToCSV('items'); _dom.exportDropdown.classList.add('hidden'); }
            const editObsBtn = e.target.closest('.edit-sales-observation-btn');
            if (editObsBtn && _utils.openOrderObservationModal) {
                _utils.openOrderObservationModal(editObsBtn.dataset.targetId);
            }
        });

        _dom.salesDetailsModalContent?.addEventListener('click', e => {
            const header = e.target.closest('[data-sales-sort]');
            if (header) {
                const key = header.dataset.salesSort;
                _state.salesSort = {
                    key: key,
                    direction: (_state.salesSort.key === key && _state.salesSort.direction === 'desc') ? 'asc' : 'desc'
                };
                _renderSalesDetailsTable();
            }
        });

        _dom.salesDetailsModalContent?.addEventListener('mouseover', e => {
            if (e.target.closest('.seller-tooltip-trigger')) _showSellerSalesTooltip(e);
            else if (e.target.closest('.nfe-items-tooltip-trigger')) _showNfeItemsTooltip(e);
        });

        _dom.salesDetailsModalContent?.addEventListener('mouseout', () => {
            if (_dom.customProductTooltip) {
                _dom.customProductTooltip.style.opacity = '0';
                setTimeout(() => { if (_dom.customProductTooltip.style.opacity === '0') _dom.customProductTooltip.classList.add('hidden'); }, 200);
            }
        });
    }

    // --- Public API ---

    return {
        init: function(config) {
            _allNFeData = config.allNFeData || [];
            _allProducts = config.allProducts || [];
            _allLojaIntegradaOrders = config.allLojaIntegradaOrders || [];
            _allPedidosBling = config.allPedidosBling || [];
            _utils = config;
            
            if (!_state.isInitialized) {
                _cacheDom();
                _bindEvents();
                _state.isInitialized = true;
            }
        },

        start: function(nfeData, liOrders, pedidosBling, products) {
            if (!_state.isInitialized) {
                _cacheDom();
                _bindEvents();
                _state.isInitialized = true;
            }
            if (nfeData) _allNFeData = nfeData;
            if (liOrders) _allLojaIntegradaOrders = liOrders;
            if (pedidosBling) _allPedidosBling = pedidosBling;
            if (products) _allProducts = products;

            // Só popula os anos se o seletor estiver vazio
            if (_dom.yearFilter && _dom.yearFilter.options.length <= 1) {
                _populateYearFilter();
            }
            
            // Se já estiver "started", precisamos re-renderizar a view atual para refletir novos dados
            if (_state.isStarted) {
                console.log('[Dashboard] Dados atualizados em tempo real. Re-renderizando view ativa.');
                if (_dom.vendasContainer && !_dom.vendasContainer.classList.contains('hidden')) {
                    _renderSalesView();
                } else if (_dom.estoqueContainer && !_dom.estoqueContainer.classList.contains('hidden')) {
                    _renderEstoqueDashboard();
                }
            } else {
                _showSelector();
                _state.isStarted = true;
            }
        },

        stop: function() {
            if (_salesChartInstance) { _salesChartInstance.destroy(); _salesChartInstance = null; }
            Object.values(_state.charts).forEach(c => c?.destroy());
            _dom.filterBar?.classList.add('hidden');
            _dom.selectorContainer?.classList.add('hidden');
            _dom.vendasContainer?.classList.add('hidden');
            _dom.estoqueContainer?.classList.add('hidden');
            _state.isStarted = false;
        },

        updateOrderObservationStatus: function(id, obs) {
            const row = document.getElementById(`sales-detail-row-${id}`);
            if (row) {
                const icon = row.querySelector('.edit-sales-observation-btn');
                if (icon) {
                    icon.dataset.observation = JSON.stringify(obs || []);
                    const svg = icon.querySelector('svg');
                    const has = Array.isArray(obs) && obs.length > 0;
                    svg?.classList.toggle('text-red-500', has);
                    svg?.classList.toggle('text-gray-300', !has);
                }
            }
        },

        /**
         * Atualiza o estoque de um produto em tempo real no Dashboard.
         * @param {string} codigo 
         * @param {number} novoEstoque 
         */
        updateStockRealTime: function(codigo, novoEstoque) {
            // 1. Atualiza no array interno de produtos do dashboard
            const product = _allProducts.find(p => p.codigo === codigo);
            if (product) {
                product.estoque = novoEstoque;
                console.log(`[Dashboard] Estoque do produto ${codigo} atualizado para ${novoEstoque} na memória.`);

                // 2. Se o dashboard de estoque estiver sendo exibido, re-renderiza para atualizar gráficos e tabelas
                if (_state.isStarted && _dom.estoqueContainer && !_dom.estoqueContainer.classList.contains('hidden')) {
                    console.log('[Dashboard] Re-renderizando dashboard de estoque em tempo real.');
                    _renderEstoqueDashboard();
                }
            }
        },

        /**
         * Atualiza o nome de um produto em tempo real no Dashboard.
         * @param {string} codigo 
         * @param {string} novoNome 
         */
        updateProductNameRealTime: function(codigo, novoNome) {
            const product = _allProducts.find(p => p.codigo === codigo);
            if (product) {
                product.descricao = novoNome;
                console.log(`[Dashboard] Nome do produto ${codigo} atualizado para "${novoNome}" na memória.`);

                // Se o dashboard de estoque estiver sendo exibido, re-renderiza para atualizar os nomes na tabela
                if (_state.isStarted && _dom.estoqueContainer && !_dom.estoqueContainer.classList.contains('hidden')) {
                    _renderEstoqueDashboard();
                }
            }
        }
    };
})();


