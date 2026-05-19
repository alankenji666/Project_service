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

    /**
     * Resolve o nome do vendedor a partir do objeto de pedido ou NFe.
     * Retorna apenas o primeiro nome para economizar espaço.
     */
    function _getVendedorInfo(p, nfe = null) {
        let raw = p.vendedor || p.nome_vendedor || (nfe ? nfe.nome_do_vendedor : 'N/A');
        if (typeof raw !== 'string') return 'N/A';
        
        let fullName = raw;
        for (const [id, name] of Object.entries(_vendedorMap)) {
            if (raw.includes(id)) {
                fullName = name;
                break;
            }
        }
        
        if (fullName === 'N/A') return 'N/A';
        return fullName.trim().split(' ')[0];
    }
    let _salesChartInstance = null;

    let _state = {
        isInitialized: false,
        isStarted: false,
        selectedChannel: 'total',
        currentDateFilterValue: 'all',
        startDate: null,
        endDate: null,
        lojaIntegradaSort: { key: 'numero_pedido', direction: 'desc' },
        lojaIntegradaCurrentPage: 1,
        lojaIntegradaPageSize: 20,
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
        },
        activeRankingFilter: 'all',
        rankingSearchQuery: '',
        rankingCurrentPage: 1,
        rankingPageSize: 100,
        rankingSort: { key: 'quantidade', direction: 'desc' },
        rankingProductSort: { key: 'data', direction: 'desc' },
        rankingProductContext: { codigo: '', descricao: '' },
        selectedRankingItems: [] // Novo: Itens selecionados no ranking para o relatório
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
            let date;
            if (dateStr instanceof Date) {
                date = dateStr;
            } else {
                date = (_utils && _utils.parsePtBrDate) ? _utils.parsePtBrDate(dateStr) : new Date(dateStr);
            }

            if (!date || isNaN(date.getTime())) return dateStr;

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            // Verifica se a entrada era uma string e continha T ou : para incluir o horário
            const shouldIncludeTime = typeof dateStr === 'string' && (dateStr.includes('T') || dateStr.includes(':'));
            
            if (shouldIncludeTime) {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            }
            
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    function _showLojaIntegradaOrderTooltip(event) {
        const trigger = event.target.closest('.li-order-row-trigger');
        if (!trigger || !_dom.customProductTooltip) return;

        const itemsRaw = trigger.dataset.liItems || '';
        const subtotal = parseFloat(trigger.dataset.liSubtotal) || 0;
        const frete = parseFloat(trigger.dataset.liFreight) || 0;
        const total = parseFloat(trigger.dataset.liTotal) || 0;
        const numero = trigger.dataset.liNumber || '';

        const items = itemsRaw.split(';').filter(s => s.trim() !== '').map(s => s.trim());
        
        let html = `<div class="p-2 bg-white rounded-lg shadow-xl border border-gray-300 max-w-md">`;
        html += `<h4 class="font-bold text-sm mb-2 pb-1 border-b">Itens do Pedido #${numero}</h4>`;
        
        if (items.length > 0) {
            html += `<ul class="space-y-1 text-xs mb-2">`;
            items.forEach(item => {
                const match = item.match(/^([\d.]+x)\s*(.*)$/);
                if (match) {
                    html += `<li class="flex justify-between gap-4"><span>${match[1]} ${match[2]}</span></li>`;
                } else {
                    html += `<li>${item}</li>`;
                }
            });
            html += `</ul>`;
        } else {
            html += `<p class="text-xs text-gray-500 italic mb-2">Sem detalhes dos produtos</p>`;
        }

        html += `
            <div class="mt-2 pt-2 border-t text-[11px] text-gray-600">
                <div class="flex justify-between mb-0.5"><span>Subtotal:</span><span class="font-medium">${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div class="flex justify-between mb-1"><span>Frete:</span><span class="font-medium">${frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div class="flex justify-between font-bold border-t mt-1 pt-1 text-[13px] text-gray-900"><span>Total do Pedido:</span><span>${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
        </div>`;

        _dom.customProductTooltip.innerHTML = html;
        _dom.customProductTooltip.classList.remove('hidden');
        _dom.customProductTooltip.style.opacity = '1';
        if (_utils.positionTooltip) _utils.positionTooltip(event, _dom.customProductTooltip);
    }

    /**
     * Processa a string de itens da NFe.
     * @param {string} itemsString - A string no formato "(codigo, qtd, valor);(codigo, qtd, valor)".
     * @returns {Array} Um array de objetos, cada um com {codigo, quantidade, valor}.
     */
    function _parseNfeItemsString(itemsString) {
        if (!itemsString) return [];
        
        // Se já for um array (comum em pedidos do Bling), mapeia para o formato padrão
        if (Array.isArray(itemsString)) {
            return itemsString.map(item => ({
                codigo: String(item.codigo || item.código || item.codigo_service || "").trim(),
                quantidade: parseFloat(item.quantidade || 0),
                valor: parseFloat(item.valor || item.valor_unitario || item.preco || 0)
            }));
        }

        if (typeof itemsString !== 'string') return [];

        try {
            // Usa regex para extrair cada grupo (COD, QTD, VAL) independente do separador
            // Suporta tanto "(A, 1, 2) (B, 3, 4)" (espaço) quanto "(A, 1, 2);(B, 3, 4)" (ponto e vírgula)
            const matches = itemsString.match(/\(([^)]+)\)/g);
            if (matches && matches.length > 0) {
                return matches.map(match => {
                    const inner = match.slice(1, -1); // Remove parênteses
                    const parts = inner.split(',').map(s => s.trim());
                    return {
                        codigo: parts[0] || '',
                        quantidade: parseFloat(parts[1] || 0),
                        valor: parseFloat(parts[2] || 0)
                    };
                }).filter(item => item.codigo);
            }

            // Fallback: tenta separar por ponto e vírgula sem parênteses
            return itemsString
                .split(';')
                .filter(s => s.trim() !== '')
                .map(itemStr => {
                    const parts = itemStr.split(',');
                    return {
                        codigo: parts[0]?.trim() || '',
                        quantidade: parseFloat(parts[1]?.trim() || 0),
                        valor: parseFloat(parts[2]?.trim() || 0)
                    };
                }).filter(item => item.codigo);
        } catch (e) {
            console.error("Erro ao processar string de itens:", itemsString, e);
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

        _dom.rankingContainer = document.getElementById('dashboard-ranking-container');
        _dom.selectRankingBtn = document.getElementById('select-ranking-dashboard');
        _dom.backToSelectorFromRankingBtn = document.getElementById('back-to-selector-from-ranking-btn');
        _dom.rankingSalesChartCanvas = document.getElementById('ranking-sales-chart');
        _dom.rankingTableContainer = document.getElementById('ranking-table-container');
        _dom.rankingSummaryCards = document.getElementById('ranking-summary-cards');
        _dom.rankingSearchInput = document.getElementById('ranking-search-input');

        _dom.rankingProductModal = document.getElementById('ranking-product-details-modal');
        _dom.rankingProductModalTitle = document.getElementById('ranking-product-modal-title');
        _dom.rankingProductModalSubtitle = document.getElementById('ranking-product-modal-subtitle');
        _dom.rankingProductModalContent = document.getElementById('ranking-product-modal-content');
        _dom.rankingProductModalEmpty = document.getElementById('ranking-product-modal-empty');
        _dom.closeRankingProductModalBtn = document.getElementById('close-ranking-product-modal-btn');
        _dom.rankingProductModalOkBtn = document.getElementById('ranking-product-modal-ok-btn');

        // NOVO: Cache dos elementos do modal de relatório de ranking
        _dom.rankingReportModal = document.getElementById('ranking-report-modal');
        _dom.closeRankingReportModalBtn = document.getElementById('close-ranking-report-modal-btn');
        _dom.rankingReportCancelBtn = document.getElementById('ranking-report-cancel-btn');
        _dom.printRankingReportBtn = document.getElementById('print-ranking-report-btn');
        _dom.rankingReportModalContent = document.getElementById('ranking-report-modal-content');
        _dom.clearRankingSelectionBtn = document.getElementById('clear-ranking-selection-btn');
        _dom.reportBtn = document.getElementById('open-product-report-modal-btn');
    }

    // --- Navigation Functions ---

    function _showSalesDashboard() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.add('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.remove('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.remove('hidden');
        _setDateRange('all');
    }

    function _refreshActiveDashboard() {
        if (!_dom.vendasContainer.classList.contains('hidden')) _renderSalesView();
        if (!_dom.rankingContainer.classList.contains('hidden')) _renderRankingDashboard();
    }

    function _showEstoqueDashboard() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.add('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.remove('hidden');
        if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.add('hidden');
        _state.activeEstoqueFilter = 'all';
        _state.estoqueCurrentPage = 1; // Reseta para a primeira página
        _renderEstoqueDashboard();
    }

    function _showRankingDashboard() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.add('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.rankingContainer) _dom.rankingContainer.classList.remove('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.remove('hidden');
        _renderRankingDashboard();
    }

    function _showSelector() {
        if (_dom.selectorContainer) _dom.selectorContainer.classList.remove('hidden');
        if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');
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

    // --- Ranking Dashboard Logic ---
    function _calculateRankingData() {
        const ranking = {};
        const activeFilter = _state.activeRankingFilter;
        const searchQuery = (_state.rankingSearchQuery || '').toLowerCase().trim();

        const categoryTotals = {
            'all': { id: 'all', label: 'Geral', total: 0, count: 0, color: '#2563eb' },
            'Estoque - Terceiros': { id: 'Estoque - Terceiros', label: 'Terceiros', total: 0, count: 0, color: '#8b5cf6' },
            'Estoque - Fábrica': { id: 'Estoque - Fábrica', label: 'Fábrica', total: 0, count: 0, color: '#10b981' },
            'Sob Demanda - Fábrica': { id: 'Sob Demanda - Fábrica', label: 'Sob Demanda', total: 0, count: 0, color: '#f59e0b' },
            'Estoque - Consumo': { id: 'Estoque - Consumo', label: 'Consumo', total: 0, count: 0, color: '#64748b' }
        };

        // Filtro de status e Unificação de Fontes (Deduplicado por número do pedido)
        const allSources = [..._allPedidosBling, ..._allNFeData];
        const uniqueOrdersMap = new Map();
        
        allSources.forEach(p => {
            const num = String(p.numero || p.número || p.id || p.id_pedido || '');
            if (!num) return;
            // Se já temos esse pedido, prioriza o que tem itens populados
            if (!uniqueOrdersMap.has(num) || (!uniqueOrdersMap.get(num).itens && p.itens)) {
                uniqueOrdersMap.set(num, p);
            }
        });

        const pedidosBase = Array.from(uniqueOrdersMap.values()).filter(p => {
            const sit = (p.situação || p.situacao || p.situao || p.status || "").toLowerCase().trim();
            // Aceita variações de atendido, concluído, faturado, entregue ou pago
            return sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad') || sit.includes('pago');
        });

        // FILTRAGEM DE DATA (CORREÇÃO): Prioriza intervalo específico se existir
        let filteredPedidos;
        const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
        const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
        const selectedYear = parseInt(_state.selectedYearFilter, 10);

        filteredPedidos = pedidosBase.filter(p => {
            // Busca data em múltiplos campos possíveis para garantir captura
            const rawDate = p.data || p.data_saida || p.data_faturamento || p.data_emissao || p.data_criacao || p.data_pedido || p['data pedido'] || "";
            let pDate = null;

            if (rawDate) {
                // Tenta parsing flexível (yyyy-mm-dd ou dd/mm/yyyy)
                if (String(rawDate).includes('-')) {
                    pDate = new Date(rawDate + 'T00:00:00');
                } else {
                    pDate = _utils.parsePtBrDate(rawDate);
                }
            }

            if (!pDate || isNaN(pDate.getTime())) return false;

            // Se houver um intervalo de datas (30 dias, 90 dias, customizado)
            if (startDate || endDate) {
                const afterStart = !startDate || pDate >= startDate;
                const beforeEnd = !endDate || pDate <= endDate;
                return afterStart && beforeEnd;
            }

            // Se não houver intervalo, mas houver filtro de ano
            if (selectedYear && !isNaN(selectedYear)) {
                return pDate.getFullYear() === selectedYear;
            }

            return true; // Se nenhum filtro, retorna todos
        });

        filteredPedidos.forEach(p => {
            // Suporta 'itens' ou 'Itens'
            const itemsRaw = p.itens || p.Itens || p.items || [];
            const items = _parseNfeItemsString(itemsRaw);

            items.forEach(item => {
                const cod = item.codigo;
                if (!cod) return;

                const productInfo = _allProducts.find(prod => prod.codigo === cod);
                const tags = productInfo ? (productInfo.grupo_de_tags_tags || []) : [];
                
                // Extração da Imagem (Padrão do sistema usa url_imagens_externas[0])
                const imgUrl = productInfo ? (
                    (productInfo.url_imagens_externas && productInfo.url_imagens_externas[0]) || 
                    productInfo.link_da_imagem || 
                    productInfo.imagem_url || 
                    productInfo.imagem || 
                    ""
                ) : "";

                // Somar totais por categoria nos cards (Ignora o filtro ativo para mostrar o total de cada card)
                const valorTotalItem = (item.quantidade * item.valor);
                categoryTotals['all'].total += valorTotalItem;
                categoryTotals['all'].count += item.quantidade;

                Object.keys(categoryTotals).forEach(catId => {
                    if (catId !== 'all' && tags.includes(catId)) {
                        categoryTotals[catId].total += valorTotalItem;
                        categoryTotals[catId].count += item.quantidade;
                    }
                });

                // Verifica se passa no filtro de busca (Descrição ou Código)
                const fallbackDesc = `item ${cod}`.toLowerCase();
                const desc = (productInfo?.descricao || fallbackDesc).toLowerCase();
                const codigo = (cod || "").toLowerCase().trim();

                if (searchQuery && !desc.includes(searchQuery) && !codigo.includes(searchQuery)) return;

                // Verifica se passa no filtro de categoria atual para a tabela/gráfico
                if (activeFilter !== 'all' && !tags.includes(activeFilter)) return;

                if (!ranking[cod]) {
                    ranking[cod] = {
                        codigo: cod,
                        descricao: productInfo ? productInfo.descricao : `Item ${cod}`,
                        imagem: imgUrl,
                        quantidade: 0,
                        valorTotal: 0,
                        numPedidos: 0,
                        pedidosIds: new Set(), // Para contar pedidos únicos
                        clientes: new Set(), // Novo: Para o relatório
                        vendedores: {} // Novo: Rastrear vendas por vendedor
                    };
                }
                ranking[cod].quantidade += item.quantidade;
                ranking[cod].valorTotal += valorTotalItem;
                
                const pedidoNum = p.numero || p.número || p.id || p.id_pedido || "";
                if (pedidoNum) ranking[cod].pedidosIds.add(pedidoNum);

                const cliente = p.cliente || p.nome_cliente || p.contato || "Consumidor Final";
                ranking[cod].clientes.add(cliente);

                // Rastrear Vendedor
                const vendedor = _getVendedorInfo(p);
                ranking[cod].vendedores[vendedor] = (ranking[cod].vendedores[vendedor] || 0) + item.quantidade;
            });
        });

        // Converte Sets para arrays e limpa dados
        Object.values(ranking).forEach(item => {
            item.numPedidos = item.pedidosIds.size;
            item.clientes = Array.from(item.clientes);
            
            // Calcula vendedor principal
            let maxSales = -1;
            let topVendedor = 'N/A';
            for (const [v, qty] of Object.entries(item.vendedores)) {
                if (qty > maxSales) {
                    maxSales = qty;
                    topVendedor = v;
                }
            }
            item.vendedorPrincipal = topVendedor;

            delete item.pedidosIds; // Não precisamos mais do Set
        });

        const sortedRanking = Object.values(ranking).sort((a, b) => b.quantidade - a.quantidade);

        // Se houver busca, incluir também itens que NÃO tiveram vendas no período para mostrar o status zerado
        if (searchQuery) {
            _allProducts.forEach(p => {
                const cod = (p.codigo || '').toLowerCase().trim();
                const desc = (p.descricao || '').toLowerCase();
                const tags = p.grupo_de_tags_tags || [];

                // Verifica se o produto bate com a busca e não está no ranking (já vendido)
                const matchesSearch = desc.includes(searchQuery) || cod.includes(searchQuery);
                const matchesCategory = activeFilter === 'all' || tags.includes(activeFilter);
                
                if (matchesSearch && matchesCategory && !ranking[p.codigo]) {
                    sortedRanking.push({
                        codigo: p.codigo,
                        descricao: p.descricao,
                        imagem: (p.url_imagens_externas && p.url_imagens_externas[0]) || p.link_da_imagem || p.imagem_url || p.imagem || "",
                        quantidade: 0,
                        valorTotal: 0,
                        numPedidos: 0
                    });
                }
            });
        }

        // --- ORDENAÇÃO DO RANKING ---
        const sortKey = _state.rankingSort.key;
        const sortDir = _state.rankingSort.direction === 'asc' ? 1 : -1;

        sortedRanking.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * sortDir;
            }
            return (valA - valB) * sortDir;
        });

        return {
            ranking: sortedRanking,
            categories: Object.values(categoryTotals)
        };
    }

    function _renderRankingDashboard() {
        const data = _calculateRankingData();
        const rankingData = data.ranking;
        const top15 = rankingData.slice(0, 15);
        const activeFilter = _state.activeRankingFilter;

        // Renderizar Cards de Categoria
        if (_dom.rankingSummaryCards) {
            let cardsHtml = '';
            data.categories.forEach(cat => {
                const isActive = activeFilter === cat.id;
                const isMainCard = cat.id === 'all';
                
                cardsHtml += `
                    <div data-ranking-filter="${cat.id}" class="cursor-pointer transition-all duration-200 transform hover:scale-105 ${isActive ? 'ring-4 shadow-lg' : ''} ${isMainCard ? (isActive ? 'bg-blue-700' : 'bg-blue-600') : 'bg-white border-t-4'} p-4 rounded-xl shadow-md" ${!isMainCard ? `style="border-color: ${cat.color}; ${isActive ? 'box-shadow: 0 0 0 4px ' + cat.color + '44' : ''}"` : ''}>
                        <p class="text-xs font-bold uppercase ${isMainCard ? 'text-white opacity-80' : 'text-gray-500'}">${cat.label} (Saídas)</p>
                        <p class="text-xl font-black ${isMainCard ? 'text-white' : 'text-gray-800'}">${cat.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        <p class="text-[10px] ${isMainCard ? 'text-blue-100' : 'text-gray-400'} font-medium">${cat.count} unidades vendidas</p>
                    </div>
                `;
            });
            _dom.rankingSummaryCards.innerHTML = cardsHtml;
        }

        // Gráfico de Ranking
        if (_dom.rankingSalesChartCanvas) {
            const ctx = _dom.rankingSalesChartCanvas.getContext('2d');
            if (_state.charts.ranking) _state.charts.ranking.destroy();

            _state.charts.ranking = new Chart(ctx, {
                type: 'bar',
                data: {
                    // Aumentado para 60 caracteres para dar prioridade à descrição
                    labels: top15.map(d => d.descricao.length > 60 ? d.descricao.substring(0, 60) + '...' : d.descricao),
                    datasets: [{
                        label: 'Qtd. Vendida',
                        data: top15.map(d => d.quantidade),
                        backgroundColor: 'rgba(249, 115, 22, 0.7)',
                        borderColor: 'rgb(249, 115, 22)',
                        borderWidth: 1,
                        borderRadius: 6,
                        barThickness: 20 // Deixa as barras mais elegantes
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            left: 20,
                            right: 40,
                            top: 10,
                            bottom: 10
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const item = top15[ctx.dataIndex];
                                    return [
                                        ` Descrição: ${item.descricao}`,
                                        ` Quantidade: ${item.quantidade}`,
                                        ` Valor Total: ${item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                                        ` Pedidos: ${item.numPedidos}`
                                    ];
                                }
                            }
                        },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'right',
                            color: '#4b5563',
                            font: { weight: 'bold', size: 11 },
                            formatter: (val) => val
                        }
                    },
                    scales: {
                        x: { 
                            beginAtZero: true, 
                            grid: { display: false },
                            ticks: { display: false } // Remove números do eixo X para limpar o visual
                        },
                        y: { 
                            grid: { display: false },
                            ticks: {
                                font: {
                                    weight: 'bold',
                                    size: 11
                                },
                                color: '#374151'
                            }
                        }
                    }
                }
            });
        }

        // Tabela de Ranking com Paginação Inteligente
        if (_dom.rankingTableContainer) {
            const pageSize = _state.rankingPageSize;
            const totalItems = rankingData.length;
            const totalPages = Math.ceil(totalItems / pageSize);
            
            // Só pagina se passar de 100 itens
            const isPagingActive = totalItems > pageSize;
            const currentPage = _state.rankingCurrentPage;
            
            // Reseta página se ela ficou "fora" do range após um filtro
            if (currentPage > totalPages && totalPages > 0) {
                _state.rankingCurrentPage = 1;
            }

            const startIdx = (currentPage - 1) * pageSize;
            const pagedData = isPagingActive ? rankingData.slice(startIdx, startIdx + pageSize) : rankingData;

            let paginationHtml = '';
            if (isPagingActive) {
                paginationHtml = `
                    <div class="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <div class="text-sm text-gray-700">
                            Mostrando <span class="font-bold">${startIdx + 1}</span> a <span class="font-bold">${Math.min(startIdx + pageSize, totalItems)}</span> de <span class="font-bold">${totalItems}</span> produtos
                        </div>
                        <div class="flex space-x-2">
                            <button id="ranking-prev-page" ${currentPage === 1 ? 'disabled opacity-50 cursor-not-allowed' : ''} class="px-4 py-2 border rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors font-medium text-sm flex items-center">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg> Anterior
                            </button>
                            <div class="flex items-center px-4 font-bold text-gray-700 text-sm">
                                Página ${currentPage} de ${totalPages}
                            </div>
                            <button id="ranking-next-page" ${currentPage === totalPages ? 'disabled opacity-50 cursor-not-allowed' : ''} class="px-4 py-2 border rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors font-medium text-sm flex items-center">
                                Próximo <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            }

            let tableHtml = `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left w-10">
                                    <input type="checkbox" id="ranking-select-all" class="rounded text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer" ${pagedData.every(item => _state.selectedRankingItems.includes(item.codigo)) ? 'checked' : ''}>
                                </th>
                                <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Posição</th>
                                <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors" data-ranking-sort="descricao">
                                    <div class="flex items-center">Produto ${_getSortIcon('descricao', _state.rankingSort)}</div>
                                 </th>
                                 <th class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors" data-ranking-sort="quantidade">
                                     <div class="flex items-center justify-center">Quantidade ${_getSortIcon('quantidade', _state.rankingSort)}</div>
                                 </th>
                                 <th class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors" data-ranking-sort="valorTotal">
                                     <div class="flex items-center justify-end">Total (R$) ${_getSortIcon('valorTotal', _state.rankingSort)}</div>
                                 </th>
                                 <th class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors" data-ranking-sort="numPedidos">
                                     <div class="flex items-center justify-center">Nº Pedidos ${_getSortIcon('numPedidos', _state.rankingSort)}</div>
                                 </th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-100">
                            ${pagedData.map((item, index) => {
                                const globalIndex = startIdx + index;
                                const isSelected = _state.selectedRankingItems.includes(item.codigo);
                                return `
                                    <tr class="hover:bg-orange-50 transition-colors cursor-pointer group ${isSelected ? 'bg-orange-50' : ''}" data-ranking-row="${item.codigo}" data-ranking-desc="${item.descricao.replace(/"/g, '&quot;')}">
                                        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                            <input type="checkbox" class="ranking-item-checkbox rounded text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer" data-codigo="${item.codigo}" ${isSelected ? 'checked' : ''}>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold ${globalIndex < 3 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}">
                                                ${globalIndex + 1}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center">
                                                <div class="flex-shrink-0 h-12 w-12 mr-3 flex items-center justify-center rounded-lg overflow-hidden ${item.imagem ? '' : 'bg-gray-200 border border-gray-300 shadow-sm'}">
                                                    ${item.imagem ? 
                                                        `<img class="h-full w-full object-contain" src="${item.imagem}" alt="" onerror="this.parentNode.classList.add('bg-gray-200', 'border', 'border-gray-300', 'shadow-sm'); this.parentNode.innerHTML='<span class=\'text-gray-500 font-bold text-lg\'>?</span>'; this.onerror=null;">` : 
                                                        `<span class="text-gray-500 font-bold text-lg">?</span>`
                                                    }
                                                </div>
                                                <div>
                                                    <div class="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">${item.descricao}</div>
                                                    <div class="text-[10px] text-gray-400 font-mono uppercase">${item.codigo}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-center text-sm font-bold text-gray-700">${item.quantidade}</td>
                                        <td class="px-6 py-4 text-right text-sm text-gray-600">${item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td class="px-6 py-4 text-center text-sm text-gray-500">${item.numPedidos}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                ${paginationHtml}
            `;
            _dom.rankingTableContainer.innerHTML = tableHtml;
        }
    }

    function _getProductSalesDetails(codigo) {
        // Filtra e deduplica fontes
        const allSources = [..._allPedidosBling, ..._allNFeData];
        const uniqueOrdersMap = new Map();
        allSources.forEach(p => {
            const num = String(p.numero || p.número || p.id || p.id_pedido || '');
            if (num && (!uniqueOrdersMap.has(num) || (!uniqueOrdersMap.get(num).itens && p.itens))) uniqueOrdersMap.set(num, p);
        });

        const pedidosBase = Array.from(uniqueOrdersMap.values()).filter(p => {
            const sit = (p.situação || p.situacao || p.situao || p.status || "").toLowerCase().trim();
            return sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad') || sit.includes('pago');
        });

        const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
        const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
        const selectedYear = parseInt(_state.selectedYearFilter, 10);

        const filteredPedidos = pedidosBase.filter(p => {
            const rawDate = p.data || p.data_saida || p.data_faturamento || p.data_emissao || p.data_criacao || p.data_pedido || p['data pedido'] || "";
            let pDate = null;
            if (rawDate) {
                if (String(rawDate).includes('-')) pDate = new Date(rawDate + 'T00:00:00');
                else pDate = _utils.parsePtBrDate(rawDate);
            }
            if (!pDate || isNaN(pDate.getTime())) return false;

            if (startDate || endDate) {
                return (!startDate || pDate >= startDate) && (!endDate || pDate <= endDate);
            }
            if (selectedYear && !isNaN(selectedYear)) {
                return pDate.getFullYear() === selectedYear;
            }
            return true;
        });

        const salesDetails = [];
        filteredPedidos.forEach(p => {
            const items = _parseNfeItemsString(p.itens || p.Itens || '');
            const matchingItems = items.filter(it => it.codigo === codigo);
            
            matchingItems.forEach(item => {
                const nfeIdRaw = p.id_nota_fiscal || p['id nota fiscal'] || "";
                const nfeId = String(nfeIdRaw).split('.')[0].trim();
                const nfe = nfeId ? _allNFeData.find(n => String(n.id_nota || "").split('.')[0].trim() === nfeId) : null;

                salesDetails.push({
                    pedido: p.numero_pedido || p.numero || p.número || 'N/A',
                    data: p.data || p.data_pedido || p['data pedido'] || p.data_emissao || '',
                    cliente: p.contato_nome || p.cliente_nome || p['contato nome'] || p['cliente nome'] || p.cliente || p.contato || 'Desconhecido',
                    vendedor: _getVendedorInfo(p, nfe), // Novo: Vendedor
                    quantidade: item.quantidade,
                    valorUnit: item.valor,
                    valorTotal: item.quantidade * item.valor
                });
            });
        });

        return salesDetails;
    }

    /**
     * Mostra os detalhes de pedidos de um produto específico do ranking.
     */
    function _showProductSalesDetailsModal(codigo, descricao) {
        // Salva o contexto para permitir re-ordenação
        _state.rankingProductContext = { codigo, descricao };

        const salesDetails = _getProductSalesDetails(codigo);

        // --- ORDENAÇÃO DOS DETALHES NO MODAL ---
        const sort = _state.rankingProductSort;
        const sortDir = sort.direction === 'asc' ? 1 : -1;

        salesDetails.sort((a, b) => {
            let valA = a[sort.key];
            let valB = b[sort.key];

            if (sort.key === 'data') {
                const dateA = _utils.parsePtBrDate(valA) || new Date(0);
                const dateB = _utils.parsePtBrDate(valB) || new Date(0);
                return (dateA - dateB) * sortDir;
            }

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * sortDir;
            }
            return (valA - valB) * sortDir;
        });

        // Configura UI do modal
        if (_dom.rankingProductModalTitle) _dom.rankingProductModalTitle.textContent = descricao;
        if (_dom.rankingProductModalSubtitle) _dom.rankingProductModalSubtitle.textContent = `Código: ${codigo} - ${salesDetails.length} aparições em pedidos no período.`;

        if (salesDetails.length === 0) {
            if (_dom.rankingProductModalContent) _dom.rankingProductModalContent.innerHTML = '';
            if (_dom.rankingProductModalEmpty) _dom.rankingProductModalEmpty.classList.remove('hidden');
        } else {
            if (_dom.rankingProductModalEmpty) _dom.rankingProductModalEmpty.classList.add('hidden');
            
            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-200 transition-colors" data-ranking-prod-sort="pedido">
                                <div class="flex items-center">Pedido ${_getSortIcon('pedido', _state.rankingProductSort)}</div>
                            </th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-200 transition-colors" data-ranking-prod-sort="data">
                                <div class="flex items-center">Data ${_getSortIcon('data', _state.rankingProductSort)}</div>
                            </th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-200 transition-colors" data-ranking-prod-sort="cliente">
                                <div class="flex items-center">Cliente ${_getSortIcon('cliente', _state.rankingProductSort)}</div>
                            </th>
                            <th class="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-200 transition-colors" data-ranking-prod-sort="quantidade">
                                <div class="flex items-center justify-center">Qtd. ${_getSortIcon('quantidade', _state.rankingProductSort)}</div>
                            </th>
                            <th class="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-200 transition-colors" data-ranking-prod-sort="valorTotal">
                                <div class="flex items-center justify-end">Total ${_getSortIcon('valorTotal', _state.rankingProductSort)}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-100">
                        ${salesDetails.map(d => `
                            <tr>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <div class="text-sm font-bold text-blue-600">#${d.pedido}</div>
                                    <div class="text-[9px] text-gray-400 italic">${d.vendedor}</div>
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${d.data}</td>
                                <td class="px-4 py-3 text-sm text-gray-900 font-medium">${d.cliente}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-orange-600">${d.quantidade}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">${d.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            if (_dom.rankingProductModalContent) _dom.rankingProductModalContent.innerHTML = html;
        }

        if (_dom.rankingProductModal) _dom.rankingProductModal.classList.remove('hidden');
    }

    /**
     * Gera e exibe o relatório customizado dos itens selecionados no ranking.
     */
    function _generateCustomRankingReport() {
        const selectedCodes = _state.selectedRankingItems;
        if (selectedCodes.length === 0) return;

        // Recupera todos os dados do ranking para obter as descrições/imagens
        const allData = _calculateRankingData();
        const rankingMap = {};
        allData.ranking.forEach(item => { rankingMap[item.codigo] = item; });

        let reportHtml = `
            <div class="space-y-12 print:space-y-8">
        `;

        selectedCodes.forEach(codigo => {
            const itemBase = rankingMap[codigo];
            if (!itemBase) return;

            const sales = _getProductSalesDetails(codigo);
            if (sales.length === 0) return;

            reportHtml += `
                <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm page-break-avoid">
                    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                        <div class="flex items-center gap-4">
                            <div class="h-16 w-16 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
                                <img src="${itemBase.imagem || ''}" class="h-full w-full object-contain" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';">
                            </div>
                            <div>
                                <h3 class="text-lg font-black text-gray-900">${itemBase.descricao}</h3>
                                <p class="text-xs text-gray-400 font-mono">CÓDIGO: ${codigo} - ${sales.length} PEDIDOS NO PERÍODO</p>
                            </div>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-100">
                            <thead class="bg-white">
                                <tr>
                                    <th class="px-6 py-3 text-left text-[10px] font-black text-gray-500 uppercase">Pedido</th>
                                    <th class="px-6 py-3 text-left text-[10px] font-black text-gray-500 uppercase">Data</th>
                                    <th class="px-6 py-3 text-left text-[10px] font-black text-gray-500 uppercase">Cliente / Item</th>
                                    <th class="px-6 py-3 text-center text-[10px] font-black text-gray-500 uppercase">Qtd</th>
                                    <th class="px-6 py-3 text-right text-[10px] font-black text-gray-500 uppercase">Total Item</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${sales.map(s => `
                                    <tr class="hover:bg-gray-50 transition-colors">
                                        <td class="px-6 py-3 whitespace-nowrap">
                                            <div class="text-sm font-bold text-blue-600">#${s.pedido}</div>
                                            <div class="text-[9px] text-gray-400 italic">${s.vendedor}</div>
                                        </td>
                                        <td class="px-6 py-3 text-xs text-gray-500">${s.data}</td>
                                        <td class="px-6 py-3">
                                            <div class="text-sm font-bold text-gray-800 leading-tight">${itemBase.descricao}</div>
                                            <div class="text-[10px] text-orange-600 italic font-medium">Cliente: ${s.cliente}</div>
                                        </td>
                                        <td class="px-6 py-3 text-center text-sm font-bold text-orange-600">${s.quantidade}</td>
                                        <td class="px-6 py-3 text-right text-sm text-gray-700">${s.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot class="bg-gray-50 font-bold border-t border-gray-100">
                                <tr>
                                    <td colspan="3" class="px-6 py-3 text-right text-xs uppercase text-gray-500">Subtotal do Produto:</td>
                                    <td class="px-6 py-3 text-center text-sm text-orange-600">${itemBase.quantidade}</td>
                                    <td class="px-6 py-3 text-right text-sm text-gray-800">${itemBase.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        });

        const totalGeral = selectedCodes.reduce((sum, cod) => sum + (rankingMap[cod]?.valorTotal || 0), 0);
        const totalItens = selectedCodes.reduce((sum, cod) => sum + (rankingMap[cod]?.quantidade || 0), 0);

        reportHtml += `
            <div class="bg-blue-600 text-white rounded-xl p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 mt-8">
                <div>
                    <h4 class="text-blue-100 text-xs font-bold uppercase tracking-wider">Resumo do Relatório</h4>
                    <p class="text-lg font-medium">${selectedCodes.length} produtos diferentes selecionados</p>
                </div>
                <div class="flex gap-12 text-center">
                    <div>
                        <span class="block text-blue-100 text-[10px] font-bold uppercase">Volume Total</span>
                        <span class="text-2xl font-black">${totalItens} unidades</span>
                    </div>
                    <div>
                        <span class="block text-blue-100 text-[10px] font-bold uppercase">Valor Total</span>
                        <span class="text-3xl font-black">${totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
            </div>
        </div>
        `;

        if (_dom.rankingReportModalContent) _dom.rankingReportModalContent.innerHTML = reportHtml;
        if (_dom.rankingReportModal) _dom.rankingReportModal.classList.remove('hidden');
    }

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

        _state.rankingCurrentPage = 1;
        _refreshActiveDashboard();
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

    /**
     * Helper centralizado para obter a data de um pedido/NFe de forma consistente.
     */
    function _getOrderDate(p) {
        if (!p) return null;
        // Ordem de prioridade exaustiva (incluindo campos de NFe, Pedido Bling e Pedido Loja Integrada)
        const rawDate = p['Data Criação'] || p['Data criação'] || p.data_criação || p.data_criacao || p.dataCriacao || p.data_de_emissao || p.data_emissao || p.data_saida || p.data_faturamento || p.data || p.data_pedido || p['data pedido'] || p.data_venda || p.Data || "";
        if (!rawDate) return null;

        // Tenta ISO primeiro (como na versão original que funcionava para Loja Integrada)
        let d = new Date(rawDate);
        if (isNaN(d.getTime())) {
            // Se falhar (ex: DD/MM/AAAA), usa o utilitário manual para fuso local
            d = _utils.parsePtBrDate(String(rawDate));
        }
        return (d && !isNaN(d.getTime())) ? d : null;
    }

    /**
     * Helper centralizado para obter o valor total de um pedido de forma consistente.
     */
    function _getOrderValue(p) {
        if (!p) return 0;
        // Ordem de prioridade exaustiva (incluindo campos de NFe, Pedido Bling e Pedido Loja Integrada)
        const val = p.total_pedido || p['total pedido'] || p.valor_da_nota || p.valor_total || p.total_venda || p.total || p.valortotal || p.valor || p['Valor Total'] || p['Valor total'] || p.valor_total_venda || p.valorTotal || 0;
        // Limpa a string de valor (remove R$, pontos de milhar, espaços e converte vírgula em ponto)
        const cleanVal = String(val).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanVal) || 0;
    }

    function _renderSalesView() {
        if (!_dom.salesChartCanvas || !_allPedidosBling) return;

        if (_salesChartInstance) { _salesChartInstance.destroy(); _salesChartInstance = null; }
        _dom.salesTableContainer.innerHTML = '';
        
        let filteredPedidos;
        const selectedYear = parseInt(_state.selectedYearFilter, 10);

        // Filtra e deduplica fontes para o ranking de vendedores/gráficos
        // IMPORTANTE: Inclui _allLojaIntegradaOrders para que pedidos não faturados também apareçam no balanço geral
        const allSources = [..._allPedidosBling, ..._allNFeData, ..._allLojaIntegradaOrders];
        const uniqueOrdersMap = new Map();
        allSources.forEach(p => {
            const num = String(p.numero || p.número || p.id || p.id_pedido || '');
            if (num && (!uniqueOrdersMap.has(num) || (!uniqueOrdersMap.get(num).itens && p.itens))) uniqueOrdersMap.set(num, p);
        });

        const pedidosBase = Array.from(uniqueOrdersMap.values()).filter(p => {
            const sit = (p.situação || p.situacao || p.situao || p.status || "").toLowerCase().trim();
            return sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad') || sit.includes('pago');
        });

        if (selectedYear && !isNaN(selectedYear)) {
            filteredPedidos = pedidosBase.filter(p => {
                const pDate = _getOrderDate(p);
                return pDate && !isNaN(pDate.getTime()) && pDate.getFullYear() === selectedYear;
            });
        } else {
            const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
            const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
            filteredPedidos = pedidosBase.filter(p => {
                const pDate = _getOrderDate(p);
                return pDate && !isNaN(pDate.getTime()) && (!startDate || pDate >= startDate) && (!endDate || pDate <= endDate);
            });
        }

        const stores = ['Bling', 'Mercado Livre', 'Loja Integrada'];
        const storeData = stores.map(store => {
            const currentPedidos = filteredPedidos.filter(p => _getNormalizedStoreName(p) === store);
            const total = currentPedidos.reduce((sum, p) => sum + _getOrderValue(p), 0);
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
            const date = _getOrderDate(p);
            if (!date) return;
            const key = aggregationLevel === 'day' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!salesByPeriod[key]) salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
            const store = _getNormalizedStoreName(p);
            let value = _getOrderValue(p);
            
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

        if (_state.selectedChannel === 'loja_integrada') {
            _dom.salesTableContainer.innerHTML = `
                <div class="border-b border-gray-200 mt-6">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        <a href="#" data-tab="vendas" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Vendas Faturadas (Bling)</a>
                        <a href="#" data-tab="pedidos" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Todos os Pedidos (Loja Integrada)</a>
                    </nav>
                </div>
                <div id="li-tab-content"></div>`;
            _renderTabContent();
        } else if (_state.selectedChannel !== 'total') {
            // Para outros canais (Bling, Mercado Livre), mostramos apenas a aba de vendas faturadas sem opção de troca
            _dom.salesTableContainer.innerHTML = `<div id="li-tab-content" class="mt-6"></div>`;
            _state.activeLiTab = 'vendas';
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

        // [DEBUG] Discovery of property names
        if (_allLojaIntegradaOrders.length > 0) {
            console.log('[Dashboard DEBUG] Exemplo de objeto Pedido LI:', Object.keys(_allLojaIntegradaOrders[0]));
        }

        // Removido parseDate local para usar _getOrderDate centralizado

        const yearLabel = isNaN(selectedYear) ? 'Tudo' : selectedYear;
        console.log(`[Dashboard DEBUG] Iniciando filtragem para: Canais=${currentStoreName}, Ano=${yearLabel}, Tab=${_state.activeLiTab}`);

        if (selectedYear && !isNaN(selectedYear)) {
            filteredNFe = _allNFeData.filter(nfe => _getOrderDate(nfe)?.getFullYear() === selectedYear);
            
            if (_state.activeLiTab === 'pedidos') {
                filteredOrders = _allLojaIntegradaOrders.filter(p => {
                    const d = _getOrderDate(p);
                    return d && d.getFullYear() === selectedYear;
                });
            } else {
                filteredOrders = _allPedidosBling.filter(p => {
                    const isTarget = _getNormalizedStoreName(p) === currentStoreName;
                    const d = _getOrderDate(p);
                    return isTarget && d && d.getFullYear() === selectedYear;
                });
            }
        } else {
            // Ajuste robusto para startDate/endDate que podem vir em ISO (YYYY-MM-DD) do input ou PT-BR
            const parseFilterDate = (str) => {
                if (!str) return null;
                let d = _utils.parsePtBrDate(str);
                if (!d || isNaN(d.getTime())) d = new Date(str + 'T00:00:00'); // Garante início do dia
                return (d && !isNaN(d.getTime())) ? d : null;
            };

            const startDate = parseFilterDate(_state.startDate);
            const endDate = parseFilterDate(_state.endDate);
            if (endDate) endDate.setHours(23, 59, 59, 999); // Garante fim do dia se houver filtro
            
            filteredNFe = _allNFeData.filter(nfe => {
                const d = _getOrderDate(nfe);
                if (!startDate && !endDate) return true;
                return d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
            });
            
            if (_state.activeLiTab === 'pedidos') {
                filteredOrders = _allLojaIntegradaOrders.filter(p => {
                    const d = _getOrderDate(p);
                    if (!startDate && !endDate) return true; // CORREÇÃO CRÍTICA: Se não há filtro, inclui o pedido.
                    return d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
                });
                console.log(`[Dashboard DEBUG] Pedidos LI filtrados: ${filteredOrders.length} de ${_allLojaIntegradaOrders.length}`);
            } else {
                filteredOrders = _allPedidosBling.filter(p => {
                    const isTarget = _getNormalizedStoreName(p) === currentStoreName;
                    const d = _getOrderDate(p);
                    if (!startDate && !endDate) return true;
                    return isTarget && d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
                });
            }
        }

        if (_state.activeLiTab === 'vendas') {
            const salesByPeriod = {};
            const liPedidos = _allPedidosBling.filter(p => {
                const sit = (p.situação || p.situacao || p.situao || "").toLowerCase().trim();
                const isConcluido = (sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad'));
                if (!isConcluido) return false;

                const d = _getOrderDate(p);
                if (!d) return false;
                if (selectedYear && !isNaN(selectedYear) && d.getFullYear() !== selectedYear) return false;
                if (!selectedYear) {
                    const parseFilterDate = (str) => {
                        if (!str) return null;
                        let dt = _utils.parsePtBrDate(str);
                        if (!dt || isNaN(dt.getTime())) dt = new Date(str + 'T00:00:00');
                        return (dt && !isNaN(dt.getTime())) ? dt : null;
                    };
                    const startDate = parseFilterDate(_state.startDate);
                    const endDate = parseFilterDate(_state.endDate);
                    if (endDate) endDate.setHours(23, 59, 59, 999);
                    if ((startDate && d < startDate) || (endDate && d > endDate)) return false;
                }
                return true;
            });

            liPedidos.forEach(p => {
                const d = _getOrderDate(p);
                if (!d) return;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!salesByPeriod[key]) salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
                const store = _getNormalizedStoreName(p);
                if (salesByPeriod[key][store] !== undefined) salesByPeriod[key][store] += _getOrderValue(p);
            });
            tabContentContainer.innerHTML = _getSalesTableHTML(Object.keys(salesByPeriod).sort(), salesByPeriod);
        } else {
            // --- Ordenação (Lógica de 3 Estados) ---
            let orders = [...filteredOrders];
            const { key, direction } = _state.lojaIntegradaSort;

            if (direction) {
                const dir = direction === 'asc' ? 1 : -1;
                orders.sort((a, b) => {
                    let valA, valB;
                    
                    if (key === 'numero_pedido') {
                        valA = parseInt(a['Numero Pedido'] || a.numero_pedido || a.numeroPedido || a.numero || a.número || 0);
                        valB = parseInt(b['Numero Pedido'] || b.numero_pedido || b.numeroPedido || b.numero || b.número || 0);
                        return (valA - valB) * dir;
                    } else if (key === 'data_criacao') {
                        const d1 = _getOrderDate(a);
                        const d2 = _getOrderDate(b);
                        return ((d1?.getTime() || 0) - (d2?.getTime() || 0)) * dir;
                    } else if (key === 'valor_total') {
                        const v1 = _parseCurrencyBRL(a['Valor Total'] || a.valor_total || a.valorTotal || a.total_pedido || a.total || 0);
                        const v2 = _parseCurrencyBRL(b['Valor Total'] || b.valor_total || b.valorTotal || b.total_pedido || b.total || 0);
                        return (v1 - v2) * dir;
                    } else if (key === 'cliente') {
                        valA = String(a['Cliente'] || a.cliente || a.contato_nome || '').toLowerCase();
                        valB = String(b['Cliente'] || b.cliente || b.contato_nome || '').toLowerCase();
                    } else if (key === 'situacao') {
                        valA = String(a['Situação'] || a.situacao || a.situao || a.situação || '').toLowerCase();
                        valB = String(b['Situação'] || b.situacao || b.situao || b.situação || '').toLowerCase();
                    } else if (key === 'cupom') {
                        // Lógica agressiva para encontrar o cupom no objeto
                        const findCupom = (p) => {
                            const keywords = ['cupom', 'voucher', 'vale', 'promo', 'desconto', 'coupon'];
                            const k = Object.keys(p).find(key => keywords.some(kw => key.toLowerCase().includes(kw)));
                            let val = (k ? p[k] : null) || p.cupom || p.Cupom || '';
                            if (val === 'N/A' || !val || String(val).trim() === '') val = '';
                            return String(val).toLowerCase();
                        };
                        valA = findCupom(a);
                        valB = findCupom(b);
                    } else {
                        valA = String(a[key] || '').toLowerCase();
                        valB = String(b[key] || '').toLowerCase();
                    }
                    return valA.localeCompare(valB, 'pt-BR') * dir;
                });
            } else {
                // Estado "Padrão": Ordena por número de pedido descendente por default se não houver ordenação ativa
                orders.sort((a, b) => {
                    const valA = parseInt(a['Numero Pedido'] || a.numero_pedido || a.numeroPedido || a.numero || a.número || 0);
                    const valB = parseInt(b['Numero Pedido'] || b.numero_pedido || b.numeroPedido || b.numero || b.número || 0);
                    return valB - valA;
                });
            }

            // --- Paginação ---
            const totalItems = orders.length;
            const totalPages = Math.ceil(totalItems / _state.lojaIntegradaPageSize);
            _state.lojaIntegradaCurrentPage = Math.min(_state.lojaIntegradaCurrentPage, totalPages) || 1;
            const startIndex = (_state.lojaIntegradaCurrentPage - 1) * _state.lojaIntegradaPageSize;
            const paginatedOrders = orders.slice(startIndex, startIndex + _state.lojaIntegradaPageSize);

            tabContentContainer.innerHTML = _getLojaIntegradaOrdersTableHTML(paginatedOrders, {
                totalItems,
                totalPages,
                currentPage: _state.lojaIntegradaCurrentPage
            });
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

    function _getLojaIntegradaOrdersTableHTML(orders, pagination = null) {
        const formatCurrency = (v) => {
            const val = _parseCurrencyBRL(v);
            return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };
        
        const sortIcon = (col) => {
            if (_state.lojaIntegradaSort.key !== col) return '<span class="ml-1 text-gray-300">↕</span>';
            return _state.lojaIntegradaSort.direction === 'asc' ? '<span class="ml-1 text-blue-600">▲</span>' : '<span class="ml-1 text-blue-600">▼</span>';
        };
        
        let html = `
            <div class="bg-white p-4 rounded-lg shadow-md mt-4">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Pedidos E-Commerce (Loja Integrada)</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th data-li-sort="numero_pedido" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                                    <div class="flex items-center">Pedido Nº ${sortIcon('numero_pedido')}</div>
                                </th>
                                <th data-li-sort="data_criacao" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                                    <div class="flex items-center">Data ${sortIcon('data_criacao')}</div>
                                </th>
                                <th data-li-sort="cliente" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                                    <div class="flex items-center">Cliente ${sortIcon('cliente')}</div>
                                </th>
                                <th data-li-sort="situacao" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                                    <div class="flex items-center">Situação ${sortIcon('situacao')}</div>
                                </th>
                                <th data-li-sort="cupom" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                                    <div class="flex items-center">Cupom ${sortIcon('cupom')}</div>
                                </th>
                                <th data-li-sort="valor_total" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                                    <div class="flex items-center justify-end">Valor Total ${sortIcon('valor_total')}</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;

        if (orders.length === 0) {
            html += `<tr><td colspan="6" class="px-6 py-10 text-center text-gray-500 italic text-sm">Nenhum pedido encontrado para este período.</td></tr>`;
        } else {
            orders.forEach(p => {
                try {
                    const numero = p['Numero Pedido'] || p.numero_pedido || p.numeroPedido || p.numero || p.número || '-';
                    const dStr = p['Data Criação'] || p['data_criação'] || p.data_criação || p.data_criacao || p.dataCriacao || p.data || p.data_pedido || "-";
                    const cliente = p['Cliente'] || p.cliente || p.contato_nome || p['contato nome'] || '-';
                    const situacao = p['Situação'] || p.situacao || p.situao || p.situação || '-';
                    
                    // Busca cupom de forma extremamente agressiva (qualquer chave que remeta a cupom ou desconto)
                    const cupomKeywords = ['cupom', 'voucher', 'vale', 'promo', 'desconto', 'coupon'];
                    const cupomKey = Object.keys(p).find(k => {
                        const lowK = k.toLowerCase();
                        return cupomKeywords.some(kw => lowK.includes(kw));
                    });
                    
                    let cupom = (cupomKey ? p[cupomKey] : null) || p.cupom || p.Cupom || '-';
                    if (cupom === 'N/A' || !cupom || String(cupom).trim() === '') cupom = '-';
                    
                    const totalRaw = p['Valor Total'] || p.valor_total || p.valorTotal || p.total_pedido || p.total_venda || p.total || p.valortotal || 0;
                    const freteRaw = p['Valor Frete'] || p.valor_frete || p.valorFrete || p.frete || 0;
                    const subtotalRaw = p['Valor Produtos'] || p.valor_produtos || p.valorProdutos || p.subtotal || 0;
                    
                    // Limpa a string de itens para evitar quebra de atributos HTML
                    let itensRaw = p.itens || p.Itens || '';
                    itensRaw = String(itensRaw).replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ').trim();

                    let badgeClass = 'bg-gray-100 text-gray-800';
                    const sitLower = String(situacao).toLowerCase();
                    if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badgeClass = 'bg-green-100 text-green-800';
                    else if (sitLower.includes('cancel')) badgeClass = 'bg-red-100 text-red-800';
                    else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento') || sitLower.includes('aguardando')) badgeClass = 'bg-yellow-100 text-yellow-800';
                    else if (sitLower.includes('produ')) badgeClass = 'bg-blue-100 text-blue-800';
                    else if (sitLower.includes('pago') || sitLower.includes('aprov')) badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                    
                    html += `
                        <tr class="hover:bg-gray-50 transition-colors li-order-row-trigger" 
                            data-li-items="${itensRaw.replace(/"/g, '&quot;')}"
                            data-li-subtotal="${subtotalRaw}"
                            data-li-freight="${freteRaw}"
                            data-li-total="${totalRaw}"
                            data-li-number="${numero}">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${numero}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${_formatDate(dStr)}</td>
                            <td class="px-6 py-4 text-sm text-gray-900 truncate max-w-[250px]" title="${cliente}">${cliente}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${badgeClass}">${situacao}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cupom}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">${formatCurrency(totalRaw)}</td>
                        </tr>
                    `;
                } catch (err) {
                    console.error('[Dashboard] Erro ao renderizar linha de pedido:', err, p);
                }
            });
        }

        html += `</tbody></table></div>`;

        // Footer de Paginação
        if (pagination && pagination.totalPages > 1) {
            html += `
                <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div class="flex-1 flex justify-between sm:hidden">
                        <button data-li-page="prev" class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Anterior</button>
                        <button data-li-page="next" class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Próxima</button>
                    </div>
                    <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p class="text-sm text-gray-700">
                                Mostrando <span class="font-medium">${((pagination.currentPage - 1) * _state.lojaIntegradaPageSize) + 1}</span> 
                                até <span class="font-medium">${Math.min(pagination.currentPage * _state.lojaIntegradaPageSize, pagination.totalItems)}</span> 
                                de <span class="font-medium">${pagination.totalItems}</span> resultados
                            </p>
                        </div>
                        <div>
                            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button data-li-page="prev" class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${pagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                                    <span class="sr-only">Anterior</span>
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                                </button>
                                <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                    Página ${pagination.currentPage} / ${pagination.totalPages}
                                </span>
                                <button data-li-page="next" class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${pagination.currentPage === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
                                    <span class="sr-only">Próxima</span>
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>`;
        }

        html += `</div>`;
        return html;
    }

    function _showSalesDetailsModal(monthKey, channel) {
        let start, end, titleDate;
        if (monthKey === 'period-total') {
            start = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
            end = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
            titleDate = (start && end) ? `de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}` : "em todo o período";
        } else {
            const [y, m] = monthKey.split('-');
            start = new Date(parseInt(y), parseInt(m) - 1, 1, 0, 0, 0);
            end = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59, 999);
            titleDate = `de ${new Date(y, m - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
        }
    
        _currentSalesDetails = _allPedidosBling.filter(p => {
            const sit = (p.situação || p.situacao || p.situao || p.status || "").toLowerCase().trim();
            if (!(sit.includes('atendid') || sit.includes('conclu') || sit.includes('entreg') || sit.includes('faturad') || sit.includes('pago'))) return false;

            // Usa o helper centralizado para consistência
            const d = _getOrderDate(p);
            if (!d || isNaN(d.getTime())) return false;

            const selectedYear = parseInt(_state.selectedYearFilter, 10);
            if (monthKey === 'period-total' && selectedYear && !isNaN(selectedYear)) {
                if (d.getFullYear() !== selectedYear) return false;
            }

            const channelMatch = (channel === 'Total' || channel === 'total') ? true : (_getNormalizedStoreName(p) === channel);
            return channelMatch && (!start || d >= start) && (!end || d <= end);
        });
        
        const total = _currentSalesDetails.reduce((sum, p) => sum + _getOrderValue(p), 0);
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
     * Gera o HTML de ícone de ordenação baseado na chave e estado atual.
     */
    function _getSortIcon(key, sortState) {
        if (sortState.key !== key) {
            return '<svg class="w-3 h-3 ml-1 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5zM15 10l-5 5-5-5h10z"/></svg>';
        }
        return sortState.direction === 'asc' 
            ? '<svg class="w-3 h-3 ml-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z"/></svg>'
            : '<svg class="w-3 h-3 ml-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M15 10l-5 5-5-5h10z"/></svg>';
    }

    /**
     * Renderiza a estrutura da tabela de detalhes de vendas com cabeçalhos clicáveis para ordenação.
     */
    function _renderSalesDetailsTable() {
        const sort = _state.salesSort;

        const html = `
            <table class="min-w-full divide-y divide-gray-200" id="sales-details-table">
                <thead class="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="pedido">
                            <div class="flex items-center">Pedido ${_getSortIcon('pedido', sort)}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="nota">
                            <div class="flex items-center">Nota ${_getSortIcon('nota', sort)}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="cliente">
                            <div class="flex items-center">Cliente ${_getSortIcon('cliente', sort)}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="data">
                            <div class="flex items-center">Data ${_getSortIcon('data', sort)}</div>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="vendedor">
                            <div class="flex items-center">Vendedor ${_getSortIcon('vendedor', sort)}</div>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" data-sales-sort="valor">
                            <div class="flex items-center justify-end">Valor ${_getSortIcon('valor', sort)}</div>
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
                    valA = _getOrderValue(a);
                    valB = _getOrderValue(b);
                    break;
                case 'data':
                default:
                    valA = _getOrderDate(a) || 0;
                    valB = _getOrderDate(b) || 0;
                    break;
            }

            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            
            // Critério de desempate: sempre Data desc se não for a chave primária
            if (sort.key !== 'data') {
                const dateA = _getOrderDate(a) || 0;
                const dateB = _getOrderDate(b) || 0;
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
            const totalValue = _getOrderValue(p);

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
                    ${_formatDate(_getOrderDate(p))}
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
            }).format(val || 0).replace(/\u00A0/g, ' '); // Garante espaços normais
        };

        const getVendedor = (p, nfe) => {
            let raw = p.vendedor || (nfe ? nfe.nome_do_vendedor : 'N/A');
            for (const [id, name] of Object.entries(_vendedorMap)) {
                if (raw.includes(id)) return name;
            }
            return raw;
        };

        let headers, rows;
        if (type === 'notes') {
            headers = ["Nº Nota", "Data", "Cliente", "Vendedor", "Valor", "Situação", "Origem"];
            rows = _currentSalesDetails.map(p => {
                const rawNfeId = p.id_nota_fiscal || p['id nota fiscal'] || "";
                const nfeId = String(rawNfeId).split('.')[0].trim();
                const nfe = nfeId ? _allNFeData.find(n => String(n.id_nota || "").split('.')[0].trim() === nfeId) : null;
                
                const totalValue = parseFloat(p.total_pedido || p['total pedido'] || p.valor_total || p.total_venda || p.total || p.valortotal || 0) || 0;
                
                return [
                    nfe ? nfe.numero_da_nota : (p.numero || p.número || '-'), 
                    _formatDate(nfe ? nfe.data_de_emissao : (p.data || p.data_criacao || p.data_pedido)), 
                    p.contato_nome || p['contato nome'] || (nfe ? nfe.nome_do_client : '-'), 
                    getVendedor(p, nfe), 
                    formatBRL(nfe ? nfe.valor_da_nota : totalValue), 
                    p.situação || p.situacao || (nfe ? nfe.situacao : '-'), 
                    _getNormalizedStoreName(p) || (nfe ? nfe.origem_loja : '-')
                ];
            });
        } else {
            headers = ["Nº Nota", "Data", "Cliente", "Código Item", "Quantidade", "Valor Unitario (Venda)", "Valor Unitario (Custo)", "Total (Venda)", "Total (Custo)"];
            rows = [];
            _currentSalesDetails.forEach(p => {
                const rawNfeId = p.id_nota_fiscal || p['id nota fiscal'] || "";
                const nfeId = String(rawNfeId).split('.')[0].trim();
                const nfe = nfeId ? _allNFeData.find(n => String(n.id_nota || "").split('.')[0].trim() === nfeId) : null;
                
                const itensRaw = nfe ? nfe.itens : (p.itens || '');
                const items = _parseNfeItemsString(itensRaw);

                items.forEach(i => {
                    const product = _allProducts.find(prod => String(prod.codigo) === String(i.codigo));
                    const custoUnitario = product ? (parseFloat(product.preco_de_custo) || 0) : 0;
                    const vendaUnitario = parseFloat(i.valor) || 0;
                    const quantidade = parseFloat(i.quantidade) || 0;

                    const totalVenda = quantidade * vendaUnitario;
                    const totalCusto = quantidade * custoUnitario;

                    rows.push([
                        nfe ? nfe.numero_da_nota : (p.numero || p.número || '-'), 
                        _formatDate(nfe ? nfe.data_de_emissao : (p.data || p.data_criacao || p.data_pedido)), 
                        p.contato_nome || p['contato nome'] || (nfe ? nfe.nome_do_client : '-'), 
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
        const fileName = `vendas_${type}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
        link.download = fileName;
        link.click();
    }

    // --- Event Binding ---

    function _bindEvents() {
        _dom.selectVendasBtn?.addEventListener('click', _showSalesDashboard);
        _dom.selectEstoqueBtn?.addEventListener('click', _showEstoqueDashboard);
        _dom.selectRankingBtn?.addEventListener('click', _showRankingDashboard);
        _dom.backToSelectorBtn?.addEventListener('click', _showSelector);
        _dom.backToSelectorFromEstoqueBtn?.addEventListener('click', _showSelector);
        _dom.backToSelectorFromRankingBtn?.addEventListener('click', _showSelector);

        _dom.rankingSummaryCards?.addEventListener('click', e => {
            const card = e.target.closest('[data-ranking-filter]');
            if (card) { 
                _state.activeRankingFilter = card.dataset.rankingFilter; 
                _state.rankingCurrentPage = 1; // Reseta página
                _renderRankingDashboard(); 
            }
        });

        _dom.rankingSearchInput?.addEventListener('input', e => {
            _state.rankingSearchQuery = e.target.value;
            _state.rankingCurrentPage = 1; // Reseta página
            _renderRankingDashboard();
        });

        _dom.rankingTableContainer?.addEventListener('click', e => {
            // Se clicou no checkbox, não abre o modal de detalhes
            if (e.target.classList.contains('ranking-item-checkbox') || e.target.id === 'ranking-select-all') {
                return;
            }

            // Detalhes do Produto
            const row = e.target.closest('[data-ranking-row]');
            if (row) {
                const codigo = row.dataset.rankingRow;
                const desc = row.dataset.rankingDesc;
                _showProductSalesDetailsModal(codigo, desc);
                return;
            }

            // Ordenação do Ranking
            const sortHeader = e.target.closest('[data-ranking-sort]');
            if (sortHeader) {
                const key = sortHeader.dataset.rankingSort;
                if (_state.rankingSort.key === key) {
                    _state.rankingSort.direction = _state.rankingSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    _state.rankingSort.key = key;
                    _state.rankingSort.direction = 'desc';
                }
                _state.rankingCurrentPage = 1;
                _renderRankingDashboard();
                return;
            }

            // Paginação do Ranking
            if (e.target.closest('#ranking-prev-page')) {
                if (_state.rankingCurrentPage > 1) {
                    _state.rankingCurrentPage--;
                    _renderRankingDashboard();
                    _dom.rankingTableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
            if (e.target.closest('#ranking-next-page')) {
                const totalItems = _calculateRankingData().ranking.length;
                const totalPages = Math.ceil(totalItems / _state.rankingPageSize);
                if (_state.rankingCurrentPage < totalPages) {
                    _state.rankingCurrentPage++;
                    _renderRankingDashboard();
                    _dom.rankingTableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });

        // NOVO: Registro de Checkboxes no Ranking
        _dom.rankingTableContainer?.addEventListener('change', e => {
            if (e.target.id === 'ranking-select-all') {
                const checkboxes = _dom.rankingTableContainer.querySelectorAll('.ranking-item-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const codigo = cb.dataset.codigo;
                    if (e.target.checked) {
                        if (!_state.selectedRankingItems.includes(codigo)) _state.selectedRankingItems.push(codigo);
                    } else {
                        _state.selectedRankingItems = _state.selectedRankingItems.filter(id => id !== codigo);
                    }
                });
                _renderRankingDashboard(); // Para atualizar cores das linhas
                return;
            }

            if (e.target.classList.contains('ranking-item-checkbox')) {
                const codigo = e.target.dataset.codigo;
                if (e.target.checked) {
                    if (!_state.selectedRankingItems.includes(codigo)) _state.selectedRankingItems.push(codigo);
                } else {
                    _state.selectedRankingItems = _state.selectedRankingItems.filter(id => id !== codigo);
                }
                _renderRankingDashboard(); // Para atualizar o "select all" e cores
            }
        });

        // NOVO: Evento de Relatório no Ranking
        _dom.reportBtn?.addEventListener('click', e => {
            // Se estivermos no Ranking, assumimos o controle TOTAL do botão e impedimos outros listeners (main.js)
            if (!_dom.rankingContainer.classList.contains('hidden')) {
                e.preventDefault();
                e.stopImmediatePropagation(); // Impede o listener do main.js de abrir o modal padrão
                e.stopPropagation();

                if (_state.selectedRankingItems.length > 0) {
                    _generateCustomRankingReport();
                } else {
                    _utils.showMessageModal?.("Erro", "Selecione ao menos um item da tabela (marcando o checkbox) para gerar o relatório do ranking.");
                }
            }
        }, true); // Usando capture para garantir prioridade se necessário

        const closeRankingReportModal = () => _dom.rankingReportModal.classList.add('hidden');
        _dom.closeRankingReportModalBtn?.addEventListener('click', closeRankingReportModal);
        _dom.rankingReportCancelBtn?.addEventListener('click', closeRankingReportModal);
        _dom.printRankingReportBtn?.addEventListener('click', () => {
            const printContent = _dom.rankingReportModalContent.innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Relatório de Ranking de Saídas</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            @media print {
                                .page-break-avoid { page-break-inside: avoid; }
                                body { padding: 0; margin: 0; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body class="p-8 bg-white">
                        <div class="mb-8 border-b-2 border-blue-600 pb-4">
                            <h1 class="text-3xl font-black">MKS SERVICE</h1>
                            <p class="text-sm text-gray-500 uppercase font-bold">Relatório de Ranking de Saídas - ${new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                        ${printContent}
                    </body>
                </html>
            `);
            printWindow.document.close();
            // Espera carregar tailwind
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }, 1000);
        });

        _dom.clearRankingSelectionBtn?.addEventListener('click', () => {
            _state.selectedRankingItems = [];
            _renderRankingDashboard();
            closeRankingReportModal();
        });

        const closeRankingProductModal = () => _dom.rankingProductModal.classList.add('hidden');
        _dom.closeRankingProductModalBtn?.addEventListener('click', closeRankingProductModal);
        _dom.rankingProductModalOkBtn?.addEventListener('click', closeRankingProductModal);

        _dom.rankingProductModalContent?.addEventListener('click', e => {
            const sortHeader = e.target.closest('[data-ranking-prod-sort]');
            if (sortHeader) {
                const key = sortHeader.dataset.rankingProdSort;
                if (_state.rankingProductSort.key === key) {
                    _state.rankingProductSort.direction = _state.rankingProductSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    _state.rankingProductSort.key = key;
                    _state.rankingProductSort.direction = 'desc';
                }
                const { codigo, descricao } = _state.rankingProductContext;
                if (codigo) _showProductSalesDetailsModal(codigo, descricao);
            }
        });

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

        _dom.startDateInput?.addEventListener('change', () => { _state.currentDateFilterValue = 'custom'; _refreshActiveDashboard(); });
        _dom.endDateInput?.addEventListener('change', () => { _state.currentDateFilterValue = 'custom'; _refreshActiveDashboard(); });
        _dom.clearFiltersBtn?.addEventListener('click', () => {
            _state.selectedYearFilter = new Date().getFullYear().toString();
            if (_dom.yearFilter) _dom.yearFilter.value = _state.selectedYearFilter;
            
            const rAll = document.querySelector('[name="date-range"][value="all"]');
            if (rAll) rAll.checked = true;

            _state.rankingSearchQuery = '';
            _state.rankingCurrentPage = 1; // Reseta página
            if (_dom.rankingSearchInput) _dom.rankingSearchInput.value = '';

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

            // --- Listeners para Loja Integrada (Ordenação e Paginação) ---
            
            // Ordenação (Nova Tabela - Lógica de 3 Estados)
            const liSort = e.target.closest('[data-li-sort]');
            if (liSort) {
                const key = liSort.dataset.liSort;
                if (_state.lojaIntegradaSort.key === key) {
                    // Ciclo: Descendente -> Ascendente -> Padrão (null)
                    if (_state.lojaIntegradaSort.direction === 'desc') {
                        _state.lojaIntegradaSort.direction = 'asc';
                    } else if (_state.lojaIntegradaSort.direction === 'asc') {
                        _state.lojaIntegradaSort.direction = null;
                    } else {
                        _state.lojaIntegradaSort.direction = 'desc';
                    }
                } else {
                    // Ao clicar em uma nova coluna, começa por Descendente (Maior para o menor)
                    _state.lojaIntegradaSort = { key, direction: 'desc' };
                }
                _renderTabContent();
                return;
            }

            // Paginação (Nova Tabela)
            const liPage = e.target.closest('[data-li-page]');
            if (liPage) {
                const action = liPage.dataset.liPage;
                if (action === 'prev') {
                    if (_state.lojaIntegradaCurrentPage > 1) _state.lojaIntegradaCurrentPage--;
                } else if (action === 'next') {
                    _state.lojaIntegradaCurrentPage++;
                } else if (!isNaN(parseInt(action))) {
                    _state.lojaIntegradaCurrentPage = parseInt(action);
                }
                _renderTabContent();
                return;
            }
        });

        _dom.salesTableContainer?.addEventListener('mouseover', e => {
            if (e.target.closest('.li-order-row-trigger')) {
                _showLojaIntegradaOrderTooltip(e);
            }
        });

        _dom.salesTableContainer?.addEventListener('mouseout', e => {
            if (e.target.closest('.li-order-row-trigger')) {
                if (_dom.customProductTooltip) {
                    _dom.customProductTooltip.style.opacity = '0';
                    setTimeout(() => { 
                        if (_dom.customProductTooltip && _dom.customProductTooltip.style.opacity === '0') {
                            _dom.customProductTooltip.classList.add('hidden');
                        }
                    }, 200);
                }
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
        },
        
        /**
         * NOVO: Reseta a visualização do dashboard para o seletor de cards.
         */
        resetToSelector: function() {
            _showSelector();
        }
    };
})();


