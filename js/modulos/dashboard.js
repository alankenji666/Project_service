// js/modulos/dashboard.js

// Importa Chart e o plugin, que estão disponíveis globalmente a partir dos scripts no index.
const Chart = window.Chart;
const ChartDataLabels = window.ChartDataLabels;

export const DashboardApp = (function() {
    // --- Private State & Variables ---
    let _allNFeData = [];
    let _allProducts = [];
    let _allLojaIntegradaOrders = [];
    let _currentSalesDetails = []; // Armazena os dados para o modal de detalhes
    let _salesChartInstance = null;
 // Ação: Substitua seu objeto _state por este bloco completo.

 let _state = {
    isInitialized: false,
    isStarted: false,
    selectedChannel: 'total',
    currentDateFilterValue: 'all',
    startDate: null,
    endDate: null,
    lojaIntegradaSort: { key: 'numero_pedido', direction: 'desc' },
    activeLiTab: 'vendas',
    selectedYearFilter: 'all',
    chartDisplayMode: 'bruta', // NOVO: 'bruta' ou 'liquida'
};


    let _dom = {}; // Cache for DOM elements
    let _utils = {}; // To hold utility functions passed from main App

    // --- Private Functions ---


    /**
     * NOVO: Converte uma string de moeda (BRL) para um número float de forma segura.
     * Trata "R$", pontos de milhar e vírgula decimal.
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
        // Remove "R$", espaços, e pontos de milhar. Troca a vírgula decimal por ponto.
        const sanitizedString = value
            .replace("R$", "")
            .trim()
            .replace(/\./g, "") // Remove pontos de milhar
            .replace(",", "."); // Troca vírgula por ponto

        return parseFloat(sanitizedString) || 0;
    }



/**
 * NOVO: Processa a string de itens da NFe.
 * @param {string} itemsString - A string no formato "(codigo, qtd, valor);(codigo, qtd, valor)".
 * @returns {Array} Um array de objetos, cada um com {codigo, quantidade, valor}.
 */
function _parseNfeItemsString(itemsString) {
    if (!itemsString || typeof itemsString !== 'string') {
        return [];
    }
    try {
        return itemsString
            .replace(/[()]/g, '') // Remove parênteses
            .split(';') // Divide em itens
            .filter(s => s.trim() !== '') // Remove partes vazias
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
    
        // ADICIONE AS 4 LINHAS ABAIXO
        _dom.exportNotesBtn = document.getElementById('export-sales-details-notes-csv-btn');
        _dom.exportItemsBtn = document.getElementById('export-sales-details-items-csv-btn');
        _dom.exportMenuBtn = document.getElementById('sales-details-export-button');
        _dom.exportDropdown = document.getElementById('sales-details-export-dropdown');
        _dom.vendaTypeToggle = document.getElementById('venda-type-toggle');

    }

    // ADICIONADO: Funções de tooltip
function _showNfeItemsTooltip(event) {
    const targetElement = event.target.closest('.nfe-items-tooltip-trigger');
    if (!targetElement || !_dom.customProductTooltip) return;

    const itemsString = targetElement.dataset.itens;
    if (!itemsString || itemsString === "undefined") return;

    try {
        const items = itemsString.replace(/[()]/g, '').split(';').filter(s => s.trim() !== '').map(itemStr => {
            const parts = itemStr.split(',');
            const codigo = parts[0]?.trim();
            const product = _allProducts.find(p => p.codigo === codigo);
            return {
                codigo: codigo,
                descricao: product ? product.descricao : 'Produto não encontrado',
                quantidade: parseFloat(parts[1]?.trim() || 0),
                valor: parseFloat(parts[2]?.trim() || 0)
            };
        });

        if (items.length === 0) return;

        const valorFrete = parseFloat(targetElement.dataset.frete || 0);
        const valorTotalItens = items.reduce((sum, item) => sum + (item.valor * item.quantidade), 0);
        const valorTotalNota = valorTotalItens + valorFrete;

        let tooltipContent = `<div class="p-2 bg-white rounded-lg shadow-xl border border-gray-300 max-w-md"><h4 class="font-bold text-center text-sm mb-2 pb-1 border-b">Itens da Nota Fiscal</h4><ul class="space-y-1 text-xs">`;
        items.forEach(item => {
            tooltipContent += `<li class="flex justify-between items-center"><span class="text-gray-700">${item.quantidade}x ${item.descricao} (${item.codigo})</span><span class="font-semibold text-gray-800 ml-4">${item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></li>`;
        });
        tooltipContent += `</ul><div class="mt-2 pt-2 border-t border-gray-200 text-xs space-y-1">
            <div class="flex justify-between"><span class="text-gray-600">Subtotal Itens:</span><span class="font-medium text-gray-800">${valorTotalItens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div class="flex justify-between"><span class="text-gray-600">Frete:</span><span class="font-medium text-gray-800">${valorFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div class="flex justify-between"><span class="font-bold text-gray-900">Total da Nota:</span><span class="font-bold text-gray-900">${valorTotalNota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
        </div></div>`;
        _dom.customProductTooltip.innerHTML = tooltipContent;
        if (_utils.positionTooltip) _utils.positionTooltip(event, _dom.customProductTooltip);
    } catch (e) {
        console.error("Erro ao processar itens da NFe para tooltip:", e);
    }
}

function _showObservationTooltip(event) {
    const targetElement = event.target.closest('.nfe-observation-status-icon');
    if (!targetElement || !_dom.customProductTooltip) return;

    let observationText = "Nenhuma Observação";
    try {
        const observationData = JSON.parse(targetElement.dataset.observation || '[]');
        if (Array.isArray(observationData) && observationData.length > 0) {
            observationText = observationData[observationData.length - 1];
        }
    } catch (e) { /* Ignora erros de parse */ }

    _dom.customProductTooltip.innerHTML = `<div class="p-2 bg-white rounded-lg shadow-xl border border-gray-400 max-w-sm"><p class="text-sm font-semibold text-gray-800 text-center break-words">${observationText}</p></div>`;
    if (_utils.positionTooltip) _utils.positionTooltip(event, _dom.customProductTooltip);
}

function _exportSalesDetailsNotesToCSV() {
    if (!_currentSalesDetails || _currentSalesDetails.length === 0) {
        _utils.showMessageModal("Nenhum Dado", "Não há notas para exportar.");
        return;
    }

    const headers = [
        "Numero da Nota", "Data de Emissao", "Situacao", "Valor da Nota",
        "Valor do Frete", "Nome do Cliente", "CNPJ/CPF Cliente",
        "Nome do Vendedor", "Numero Pedido Loja", "Transportadora",
        "Frete por Conta", "Origem Loja", "Observacoes"
    ];

    const escapeCSV = (field) => {
        if (field === null || field === undefined) return '""';
        let str = String(field);
        if (str.search(/("|;|\n)/g) >= 0) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = _currentSalesDetails.map(nfe => {
        const rowData = [
            nfe.numero_da_nota,
            _utils.parsePtBrDate(nfe.data_de_emissao)?.toLocaleDateString('pt-BR') || '',
            nfe.situacao,
            String(nfe.valor_da_nota || '0').replace('.', ','),
            String(nfe.valor_do_frete || '0').replace('.', ','),
            nfe.nome_do_cliente,
            _utils.formatCnpjCpf ? _utils.formatCnpjCpf(String(nfe.cnpjcpf_cliente || '')) : String(nfe.cnpjcpf_cliente || ''),
            nfe.nome_do_vendedor,
            nfe.numero_pedido_loja,
            nfe.transportadora,
            nfe.frete_por_conta,
            nfe.origem_loja,
            (Array.isArray(nfe.observacao) ? nfe.observacao.join(' | ') : (nfe.observacao || ''))
        ];
        return rowData.map(escapeCSV).join(';');
    });

    // A CORREÇÃO ESTÁ AQUI: Usa '\r\n' para a quebra de linha, igual à função que funciona.
    const csvContent = [headers.join(';'), ...rows].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "detalhes_vendas_notas.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


function _exportSalesDetailsItemsToCSV() {
    if (!_currentSalesDetails || _currentSalesDetails.length === 0) {
        _utils.showMessageModal("Nenhum Dado", "Não há itens para exportar.");
        return;
    }

    const headers = [
        "Numero da Nota", "Data de Emissao", "Nome do Cliente",
        "Codigo do Item", "Descricao do Item", "Quantidade", "Valor Unitario"
    ];
    
    const allItems = [];
    _currentSalesDetails.forEach(nfe => {
        const itemsString = nfe.itens;
        if (!itemsString || itemsString.trim() === '') return;

        const items = itemsString.replace(/[()]/g, '').split(';').filter(s => s.trim() !== '').map(itemStr => {
            const parts = itemStr.split(',');
            const codigo = parts[0]?.trim();
            const product = _allProducts.find(p => p.codigo === codigo);
            return {
                numero_da_nota: nfe.numero_da_nota,
                data_de_emissao: _utils.parsePtBrDate(nfe.data_de_emissao)?.toLocaleDateString('pt-BR') || '',
                nome_do_cliente: nfe.nome_do_cliente,
                codigo: codigo,
                descricao: product ? product.descricao : 'Produto não encontrado',
                quantidade: parseFloat(parts[1]?.trim() || 0),
                valor: parseFloat(parts[2]?.trim() || 0)
            };
        });
        allItems.push(...items);
    });

    if (allItems.length === 0) {
        _utils.showMessageModal("Nenhum Dado", "Não foram encontrados itens de produtos nas notas selecionadas.");
        return;
    }

    const escapeCSV = (field) => {
         if (field === null || field === undefined) return '""';
        let str = String(field);
        if (str.search(/("|;|\n)/g) >= 0) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = allItems.map(item => [
        item.numero_da_nota,
        item.data_de_emissao,
        item.nome_do_cliente,
        item.codigo,
        item.descricao,
        String(item.quantidade).replace('.',','),
        String(item.valor).replace('.',','),

    ].map(escapeCSV).join(';'));
    
    const csvContent = [headers.join(';'), ...rows].join('\r\n');


    const blob = new Blob(['\\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "detalhes_vendas_itens.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function _populateYearFilter() {
    if (!_dom.yearFilter) return;

    // Usa os dados que já estão no módulo (_allNFeData e _allLojaIntegradaOrders)
    // para encontrar todos os anos em que houve vendas.
    const allData = [..._allNFeData, ..._allLojaIntegradaOrders];
    const years = new Set();

    allData.forEach(item => {
        const dateString = item.data_de_emissao || item.data_criacao; 
        if (dateString) {
            const date = _utils.parsePtBrDate(dateString); 
            if (date && !isNaN(date)) {
                years.add(date.getFullYear());
            }
        }
    });

    // Ordena os anos do mais recente para o mais antigo.
    const sortedYears = Array.from(years).sort((a, b) => b - a);

    // Limpa o seletor e adiciona as opções novas.
    _dom.yearFilter.innerHTML = '<option value="all">Tudo</option>'; 
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        _dom.yearFilter.appendChild(option);
    });
}


function _bindEvents() {
    // --- Listeners do Filtro de Data ---
    if (_dom.yearFilter) {
        _dom.yearFilter.addEventListener('change', (event) => {
            _state.selectedYearFilter = event.target.value;
    
            // Limpa os outros filtros de data para evitar conflitos
            if (_dom.startDateInput) _dom.startDateInput.value = '';
            if (_dom.endDateInput) _dom.endDateInput.value = '';
            _setDateRange('all'); // Reseta para o estado inicial
        });
    }
    
    if (_dom.vendaTypeToggle) {
        _dom.vendaTypeToggle.addEventListener('change', (event) => {
            _state.chartDisplayMode = event.target.checked ? 'liquida' : 'bruta';
            _renderSalesView(); // Redesenha o gráfico com o novo modo
        });
    }

    if (_dom.filterBar) {
        _dom.startDateInput.addEventListener('change', _handleDateInputChange);
        _dom.endDateInput.addEventListener('change', _handleDateInputChange);
        _dom.clearFiltersBtn.addEventListener('click', () => _setDateRange('all'));
        _dom.filterBar.querySelectorAll('[name="date-range"]').forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (event.target.checked) _setDateRange(event.target.value);
            });
        });
    }

    // --- Listener dos Cards de Resumo ---
    if (_dom.summaryCards) {
        _dom.summaryCards.addEventListener('click', (event) => {
            const selectedCard = event.target.closest('[data-id]');
            if (selectedCard) {
                const channelId = selectedCard.dataset.id;
                _updateDashboardChart(channelId);
            }
        });
    }

    if (_dom.salesTableContainer) {
        _dom.salesTableContainer.addEventListener('click', function(event) {
            const tabLink = event.target.closest('[data-tab]');
            const sortHeader = event.target.closest('[data-sort-key]');

            if (tabLink) {
                event.preventDefault(); 
                const newTab = tabLink.dataset.tab;
                if (_state.activeLiTab !== newTab) {
                    _state.activeLiTab = newTab;
                    _renderTabContent(); // Chama a função leve
                }
                return;
            }

            if (sortHeader && _state.selectedChannel === 'loja_integrada' && _state.activeLiTab === 'pedidos') {
                const newKey = sortHeader.dataset.sortKey;
                let newDirection = 'asc';
                if (_state.lojaIntegradaSort.key === newKey && _state.lojaIntegradaSort.direction === 'asc') {
                    newDirection = 'desc';
                }
                _state.lojaIntegradaSort = { key: newKey, direction: newDirection };
                _renderTabContent(); // Chama a função leve
                return;
            }
        });
    }
    
    // --- Outros Listeners (Modal, Tooltips, etc.) ---
    if (_dom.page) {
        _dom.page.addEventListener('click', (event) => {
            const clickedCell = event.target.closest('.clickable-sales-cell');
            if (clickedCell) {
                const monthKey = clickedCell.dataset.monthKey;
                const channel = clickedCell.dataset.channel;
                _showSalesDetailsModal(monthKey, channel);
            }
        });
    }
    if (_dom.salesDetailsModal) {
        _dom.salesDetailsModal.addEventListener('click', (event) => {
            if (event.target.closest('#close-sales-details-modal-btn')) _dom.salesDetailsModal.classList.add('hidden');
            if (event.target.closest('#sales-details-export-button')) {
                event.stopPropagation();
                _dom.exportDropdown.classList.toggle('hidden');
            }
            if (event.target.closest('#export-sales-details-notes-csv-btn')) {
                event.preventDefault();
                _exportSalesDetailsNotesToCSV();
                _dom.exportDropdown.classList.add('hidden');
            }
            if (event.target.closest('#export-sales-details-items-csv-btn')) {
                event.preventDefault();
                _exportSalesDetailsItemsToCSV();
                _dom.exportDropdown.classList.add('hidden');
            }
            const viewBtn = event.target.closest('.view-nfe-observation-btn');
            if (viewBtn) {
                const nfeId = viewBtn.dataset.nfeId;
                if (_utils.openNfeObservationModal) _utils.openNfeObservationModal(nfeId);
            }
        });
    }
    if (_dom.salesDetailsModalContent) {
        _dom.salesDetailsModalContent.addEventListener('mouseover', (event) => {
            const exclamationIcon = event.target.closest('.nfe-observation-status-icon');
            if (exclamationIcon) { _showObservationTooltip(event); return; }
            const itemsTrigger = event.target.closest('.nfe-items-tooltip-trigger');
            if (itemsTrigger) _showNfeItemsTooltip(event);
        });
        _dom.salesDetailsModalContent.addEventListener('mouseout', () => {
            if (_dom.customProductTooltip) {
                _dom.customProductTooltip.style.opacity = '0';
                setTimeout(() => {
                    if (_dom.customProductTooltip.style.opacity === '0') {
                        _dom.customProductTooltip.classList.add('hidden');
                        _dom.customProductTooltip.innerHTML = '';
                    }
                }, 200);
            }
        });
    }
}


    function _handleDateInputChange() {
        _dom.filterBar.querySelectorAll('[name="date-range"]').forEach(radio => radio.checked = false);
        _state.currentDateFilterValue = 'custom';
        _renderSalesView();
    }
    
// AÇÃO: Substitua a função _setDateRange inteira pela versão corrigida.

function _setDateRange(value) {
    const today = new Date();
    let startDate, endDate;
    // Helper para formatar data para o input (YYYY-MM-DD)
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Lógica para calcular o intervalo de datas
    const days = parseInt(value, 10);
    if (!isNaN(days)) {
        endDate = today;
        startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
    } else {
        switch (value) {
            case 'all': 
                startDate = null; 
                endDate = null; 
                break;
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

    // CORREÇÃO: Armazena as datas no estado (_state) e também atualiza os inputs no DOM
    const formattedStartDate = startDate ? formatDate(startDate) : '';
    const formattedEndDate = endDate ? formatDate(endDate) : '';

    // Atualiza o ESTADO, que é a fonte da verdade para o gráfico
    _state.startDate = formattedStartDate;
    _state.endDate = formattedEndDate;
    
    // Atualiza o DOM para o usuário ver a mudança
    _dom.startDateInput.value = formattedStartDate;
    _dom.endDateInput.value = formattedEndDate;

    // Atualiza a página para refletir o novo intervalo de datas
    _renderSalesView();
}


    // >>> INÍCIO DO BLOCO DE SUBSTITUIÇÃO (Função _renderDashboardsPage) <<<



    // AÇÃO: COLE ESTA FUNÇÃO DE VOLTA NO SEU CÓDIGO

    function _createSummaryCard(id, title, countLabel, count, totalValue, color) {
        const valueFormatted = (totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        // Adicionado: transição e efeito de escala ao passar o mouse
        return `<div data-id="${id}" class="${color} text-white p-4 rounded-lg shadow-lg flex flex-col justify-between cursor-pointer transform transition-transform duration-200 hover:scale-105">
                <div>
                    <h3 class="text-md font-semibold">${title}</h3>
                    <p class="text-sm">Total de ${countLabel}: ${count}</p>
                </div>
                <p class="text-2xl font-bold mt-2 self-end">${valueFormatted}</p>
            </div>`;
    }

// AÇÃO 1: Substitua a função _updateDashboardChart inteira

function _updateDashboardChart(selectedChannel) {
    if (selectedChannel) {
        _state.selectedChannel = selectedChannel;
    }

    // Destaque visual para o card ativo
    if (_dom.summaryCards) {
        _dom.summaryCards.querySelectorAll('[data-id]').forEach(card => card.classList.remove('ring-4', 'ring-offset-2', 'ring-white', 'ring-opacity-75'));
        const activeCard = _dom.summaryCards.querySelector(`[data-id="${_state.selectedChannel}"]`);
        if (activeCard) activeCard.classList.add('ring-4', 'ring-offset-2', 'ring-white', 'ring-opacity-75');
    }

    // Roteamento foi removido. Sempre chamará a função principal de visualização.
    _renderSalesView(); 
}

function _renderTabContent() {
    const tabContentContainer = document.getElementById('li-tab-content');
    if (!tabContentContainer) return; 

    // 1. Estilo da aba ativa (lógica original)
    _dom.salesTableContainer.querySelectorAll('[data-tab]').forEach(tab => {
        const tabName = tab.dataset.tab;
        const isActive = _state.activeLiTab === tabName;
        tab.classList.toggle('border-blue-500', isActive);
        tab.classList.toggle('text-blue-600', isActive);
        tab.classList.toggle('border-transparent', !isActive);
        tab.classList.toggle('text-gray-500', !isActive);
        tab.classList.toggle('hover:text-gray-700', !isActive);
        tab.classList.toggle('hover:border-gray-300', !isActive);
    });

    // --- NOVA LÓGICA DE FILTRAGEM UNIFICADA ---
    let filteredNFeForTab = _allNFeData;
    let filteredOrdersForTab = _allLojaIntegradaOrders;
    const selectedYear = parseInt(_state.selectedYearFilter, 10);

    if (selectedYear && !isNaN(selectedYear)) {
        // Filtro por ano tem prioridade
        filteredNFeForTab = _allNFeData.filter(nfe => {
            const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
            return nfeDate && nfeDate.getFullYear() === selectedYear;
        });
        filteredOrdersForTab = _allLojaIntegradaOrders.filter(order => {
            const orderDate = new Date(order.data_criação); // Usa 'new Date' para o formato original de pedidos
            return !isNaN(orderDate.getTime()) && orderDate.getFullYear() === selectedYear;
        });
    } else {
        // Se ano for "Tudo", usa o filtro de data (lógica original)
        const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
        const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
        if (startDate || endDate) {
            filteredNFeForTab = _allNFeData.filter(nfe => {
                const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
                return nfeDate && (!startDate || nfeDate >= startDate) && (!endDate || nfeDate <= endDate);
            });
            filteredOrdersForTab = _allLojaIntegradaOrders.filter(order => {
                const orderDate = new Date(order.data_criação);
                return !isNaN(orderDate.getTime()) && (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
            });
        }
    }
    // --- FIM DA FILTRAGEM ---

    let contentHtml = '';

    // 3. Gera o HTML usando os dados já filtrados
    if (_state.activeLiTab === 'vendas') {
        const salesByPeriod = {};
        filteredNFeForTab.forEach(nfe => {
            const date = _utils.parsePtBrDate(nfe.data_de_emissao);
            if (!date) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!salesByPeriod[key]) salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
            const store = nfe.origem_loja;
            const value = parseFloat(nfe.valor_da_nota) || 0;
            if (salesByPeriod[key][store] !== undefined) salesByPeriod[key][store] += value;
        });
        const sortedKeys = Object.keys(salesByPeriod).sort();
        contentHtml = _getSalesTableHTML(sortedKeys, salesByPeriod);
    } else { // Aba de 'pedidos'
        const allowedStatus = ["Pedido Entregue", "Pedido Enviado","Pedido em separação", "Pedido Pago", "Em produção"];
        let filteredOrdersByStatus = filteredOrdersForTab.filter(order => {
            return order.situação && allowedStatus.includes(order.situação.trim());
        });
        
        const { key: sortKey, direction: sortDirStr } = _state.lojaIntegradaSort;
        const sortDir = sortDirStr === 'asc' ? 1 : -1;
        filteredOrdersByStatus.sort((a, b) => {
            const valA = a[sortKey], valB = b[sortKey];
            if (sortKey === 'valor_total' || sortKey === 'numero_pedido') return ((parseFloat(valA) || 0) - (parseFloat(valB) || 0)) * sortDir;
            if (sortKey === 'data_criação') return (new Date(valA) - new Date(valB)) * sortDir;
            return String(valA || '').localeCompare(String(valB || '')) * sortDir;
        });

        contentHtml = _getLojaIntegradaOrdersTableHTML(filteredOrdersByStatus);
    }
    
    // 4. Insere o HTML no container
    tabContentContainer.innerHTML = contentHtml;
}

function _renderSalesView() {
    if (!_dom.salesChartCanvas || !_allNFeData) return;

    // 1. LIMPEZA INICIAL
    if (_salesChartInstance) { _salesChartInstance.destroy(); _salesChartInstance = null; }
    _dom.salesTableContainer.innerHTML = '';
    
    // --- LÓGICA DE FILTRO UNIFICADA ---
    let filteredNFe;
    const selectedYear = parseInt(_state.selectedYearFilter, 10);

    if (selectedYear && !isNaN(selectedYear)) {
        filteredNFe = _allNFeData.filter(nfe => {
            const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
            return nfeDate && nfeDate.getFullYear() === selectedYear;
        });
    } else {
        const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
        const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;
        filteredNFe = _allNFeData.filter(nfe => {
            const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
            return nfeDate && (!startDate || nfeDate >= startDate) && (!endDate || nfeDate <= endDate);
        });
    }
    
    // --- RENDERIZAÇÃO DOS CARDS ---
    const stores = ['Bling', 'Mercado Livre', 'Loja Integrada'];
    const storeData = stores.map(store => {
        const notes = filteredNFe.filter(nfe => nfe.origem_loja === store);
        const total = notes.reduce((sum, nfe) => sum + (parseFloat(nfe.valor_da_nota) || 0), 0);
        return { name: `Vendas ${store}`, id: store.toLowerCase().replace(/ /g, '_'), count: notes.length, total: total };
    });

    const grandTotalVendas = storeData.reduce((sum, store) => sum + store.total, 0);
    const grandTotalVendasCount = storeData.reduce((sum, store) => sum + store.count, 0);
    
    const colors = { 'bling': 'bg-green-500', 'mercado_livre': 'bg-yellow-500', 'loja_integrada': 'bg-blue-500' };
    let cardsHtml = storeData.map(store => _createSummaryCard(store.id, store.name, "Notas", store.count, store.total, colors[store.id])).join('');
    cardsHtml += _createSummaryCard('total', 'Total Vendas (NFe)', "Notas", grandTotalVendasCount, grandTotalVendas, 'bg-gray-700');
    
    if (_dom.summaryCards) _dom.summaryCards.innerHTML = cardsHtml;

    // --- RENDERIZAÇÃO DO GRÁFICO E TABELA ---
    const aggregationLevel = ['current_month', 'last_month', '30'].includes(_state.currentDateFilterValue) ? 'day' : 'month';
    const salesByPeriod = {};
    
    filteredNFe.forEach(nfe => {
        const date = _utils.parsePtBrDate(nfe.data_de_emissao);
        if (!date) return;
        const key = aggregationLevel === 'day' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!salesByPeriod[key]) salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
        const store = nfe.origem_loja;
        let value;
        if (_state.chartDisplayMode === 'liquida') {
            const items = _parseNfeItemsString(nfe.itens);
            let totalCostOfGoods = 0;
            items.forEach(item => {
                const product = _allProducts.find(p => p.codigo === item.codigo);
                // AQUI ESTÁ A CORREÇÃO! Usando a nova função de limpeza.
                const cost = product ? _parseCurrencyBRL(product.preco_de_custo) : 0;
                totalCostOfGoods += cost * item.quantidade;
            });
            const grossSale = parseFloat(nfe.valor_da_nota) || 0;
            value = grossSale - totalCostOfGoods;
        } else {
            value = parseFloat(nfe.valor_da_nota) || 0;
        }
        if (salesByPeriod[key][store] !== undefined) salesByPeriod[key][store] += value;
    });

    const sortedKeys = Object.keys(salesByPeriod).sort();
    const chartLabels = sortedKeys.map(key => {
        if (aggregationLevel === 'day') { const [, month, day] = key.split('-'); return `${day}/${month}`; }
        const [year, month] = key.split('-');
        return new Date(year, month - 1).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
    });
    const allDatasets = ['Bling', 'Mercado Livre', 'Loja Integrada'].map(store => {
        const channelId = store.toLowerCase().replace(/ /g, '_');
        return { label: store, data: sortedKeys.map(k => (salesByPeriod[k] ? salesByPeriod[k][store] || 0 : 0)), borderColor: { 'Bling': 'rgba(34, 197, 94, 1)', 'Mercado Livre': 'rgba(234, 179, 8, 1)', 'Loja Integrada': 'rgba(59, 130, 246, 1)' }[store], backgroundColor: { 'Bling': 'rgba(34, 197, 94, 0.2)', 'Mercado Livre': 'rgba(234, 179, 8, 0.2)', 'Loja Integrada': 'rgba(59, 130, 246, 0.2)' }[store], fill: true, tension: 0.1, hidden: _state.selectedChannel !== 'total' && channelId !== _state.selectedChannel };
    });
    const ctx = _dom.salesChartCanvas.getContext('2d');
    Chart.register(ChartDataLabels);
    _salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets: allDatasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: { anchor: 'end', align: 'top', color: '#374151', font: { weight: 'bold' }, formatter: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), display: (context) => context.dataset.data[context.dataIndex] > 0 } }, scales: { y: { beginAtZero: true } } }
    });

    if (_state.selectedChannel === 'loja_integrada') {
        const tabsHtml = `
            <div class="border-b border-gray-200 mt-6">
                <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                    <a href="#" data-tab="vendas" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">Vendas (NFe)</a>
                    <a href="#" data-tab="pedidos" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">Pedidos da Loja</a>
                </nav>
            </div>
            <div id="li-tab-content"></div>`;
        _dom.salesTableContainer.innerHTML = tabsHtml;
        _renderTabContent();
    } else {
        const salesTableHtml = _getSalesTableHTML(sortedKeys, salesByPeriod);
        _dom.salesTableContainer.innerHTML = salesTableHtml;
    }
}



 // AÇÃO: Substitua a função _renderLojaIntegradaView inteira por esta versão.

    function _renderLojaIntegradaView() {
        // Garante que o gráfico seja destruído e a área limpa para a tabela
        if (_salesChartInstance) {
            _salesChartInstance.destroy();
            _salesChartInstance = null;
        }
        if (_dom.salesTableContainer) {
            _dom.salesTableContainer.innerHTML = '';
        }

        // Calcula os dados de Vendas (NFe) para o período selecionado
        const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
        const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;

        let filteredNFe = _allNFeData.filter(nfe => {
            const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
            return nfeDate && (!startDate || nfeDate >= startDate) && (!endDate || nfeDate <= endDate);
        });

        const salesByPeriod = {};
        filteredNFe.forEach(nfe => {
            const date = _utils.parsePtBrDate(nfe.data_de_emissao);
            if (!date) return;
            // Agrega sempre por mês para esta visualização
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!salesByPeriod[key]) {
                salesByPeriod[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
            }
            const store = nfe.origem_loja;
            const value = parseFloat(nfe.valor_da_nota) || 0;
            if (salesByPeriod[key][store] !== undefined) {
                salesByPeriod[key][store] += value;
            }
        });
        
        const sortedKeys = Object.keys(salesByPeriod).sort();

        // Desenha a tabela "Vendas Mensais Detalhadas"
        _renderSalesTable(sortedKeys, salesByPeriod);

        // A tabela "Pedidos - Loja Integrada" será adicionada aqui na próxima etapa.
    }

// AÇÃO: Substitua a função _renderLojaIntegradaView inteira por esta versão.

function _renderLojaIntegradaView() {
    // 1. Limpeza
    if (_salesChartInstance) {
        _salesChartInstance.destroy();
        _salesChartInstance = null;
    }
    if (_dom.salesTableContainer) {
        _dom.salesTableContainer.innerHTML = '';
    }

    // 2. Preparação de dados de Vendas (NFe)
    const startDate = _state.startDate ? new Date(_state.startDate + 'T00:00:00') : null;
    const endDate = _state.endDate ? new Date(_state.endDate + 'T23:59:59') : null;

    let filteredNFe = _allNFeData.filter(nfe => {
        const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
        return nfeDate && (!startDate || nfeDate >= startDate) && (!endDate || nfeDate <= endDate);
    });

    // 3. LÓGICA CORRIGIDA: Agrupa os dados para a tabela de vendas SEMPRE por mês.
    const salesByPeriodForTable = {};
    filteredNFe.forEach(nfe => {
        const date = _utils.parsePtBrDate(nfe.data_de_emissao);
        if (!date) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // Chave sempre mensal
        
        if (!salesByPeriodForTable[key]) {
            salesByPeriodForTable[key] = { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
        }
        const store = nfe.origem_loja;
        const value = parseFloat(nfe.valor_da_nota) || 0;
        if (salesByPeriodForTable[key][store] !== undefined) {
            salesByPeriodForTable[key][store] += value;
        }
    });
    const sortedTableKeys = Object.keys(salesByPeriodForTable).sort();

    // 4. Desenha a tabela "Vendas Mensais Detalhadas" com os dados mensais corretos.
    _renderSalesTable(sortedTableKeys, salesByPeriodForTable);

    // 5. Adiciona a tabela "Pedidos - Loja Integrada" logo abaixo, como antes.
    const filteredOrders = _allLojaIntegradaOrders.filter(order => {
        const orderDate = new Date(order.data_criação);
        return !isNaN(orderDate.getTime()) && (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
    });

    const { key: sortKey, direction: sortDirStr } = _state.lojaIntegradaSort;
    const sortDir = sortDirStr === 'asc' ? 1 : -1;
    filteredOrders.sort((a, b) => {
        let valA = a[sortKey], valB = b[sortKey];
        if (sortKey === 'valor_total' || sortKey === 'numero_pedido') {
            return ((parseFloat(valA) || 0) - (parseFloat(valB) || 0)) * sortDir;
        } else if (sortKey === 'data_criacao') {
            return (new Date(a.data_criação) - new Date(b.data_criação)) * sortDir;
        }
        return String(valA || '').localeCompare(String(valB || '')) * sortDir;
    });

    const ordersTableHtml = _getLojaIntegradaOrdersTableHTML(filteredOrders);
    if (_dom.salesTableContainer) {
        _dom.salesTableContainer.insertAdjacentHTML('beforeend', ordersTableHtml);
    }
}


function _getSalesTableHTML(sortedMonths, salesData) {
    const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    let totalBling = 0, totalML = 0, totalLI = 0;

    let tableHeader = `<div class="bg-white p-4 rounded-lg shadow-md"><h3 class="text-xl font-bold text-gray-800 mb-4">Vendas Mensais Detalhadas</h3><div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês/Ano</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bling</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mercado Livre</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loja Integrada (NFe)</th><th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Mês</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
    
    let rowsHtml = sortedMonths.map(monthKey => {
        const monthData = salesData[monthKey] || { 'Bling': 0, 'Mercado Livre': 0, 'Loja Integrada': 0 };
        totalBling += monthData['Bling'];
        totalML += monthData['Mercado Livre'];
        totalLI += monthData['Loja Integrada'];
        const monthTotal = monthData['Bling'] + monthData['Mercado Livre'] + monthData['Loja Integrada'];
        const [year, month] = monthKey.split('-');
        const monthLabel = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        return `<tr><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-right clickable-sales-cell" data-month-key="${monthKey}" data-channel="Bling">${formatCurrency(monthData['Bling'])}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-right clickable-sales-cell" data-month-key="${monthKey}" data-channel="Mercado Livre">${formatCurrency(monthData['Mercado Livre'])}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-right clickable-sales-cell" data-month-key="${monthKey}" data-channel="Loja Integrada">${formatCurrency(monthData['Loja Integrada'])}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">${formatCurrency(monthTotal)}</td></tr>`;
    }).join('');
    
    let tableFooter = `</tbody><tfoot class="bg-gray-100\"><tr><th class="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase">Total Período</th><th class="px-6 py-3 text-right text-sm font-bold text-gray-700 clickable-sales-cell" data-month-key="period-total" data-channel="Bling">${formatCurrency(totalBling)}</th><th class="px-6 py-3 text-right text-sm font-bold text-gray-700 clickable-sales-cell" data-month-key="period-total" data-channel="Mercado Livre">${formatCurrency(totalML)}</th><th class="px-6 py-3 text-right text-sm font-bold text-gray-700 clickable-sales-cell" data-month-key="period-total" data-channel="Loja Integrada">${formatCurrency(totalLI)}</th><th class="px-6 py-3 text-right text-sm font-extrabold text-gray-900 clickable-sales-cell" data-month-key="period-total" data-channel="Total">${formatCurrency(totalBling + totalML + totalLI)}</th></tr></tfoot></table></div></div>`;
    
    return tableHeader + rowsHtml + tableFooter;
}


// AÇÃO: Substitua a função _getLojaIntegradaOrdersTableHTML inteira por esta versão.

function _getLojaIntegradaOrdersTableHTML(orders) {
    const createHeader = (key, title, isNumeric = false) => {
        const isSorted = _state.lojaIntegradaSort.key === key;
        const icon = isSorted ? (_state.lojaIntegradaSort.direction === 'asc' ? '▲' : '▼') : '';
        const textAlign = isNumeric ? 'text-right' : 'text-left';
        return `<th class="px-6 py-3 ${textAlign} text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" data-sort-key="${key}">${title} ${icon}</th>`;
    };

    let tableHTML = `
        <div class="bg-white p-4 rounded-lg shadow-md mt-8">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Pedidos - Loja Integrada</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            ${createHeader('numero_pedido', 'Pedido Nº')}
                            ${createHeader('cliente', 'Cliente')}
                            ${createHeader('cupom', 'Cupom')}
                            ${createHeader('situação', 'Situação')}
                            ${createHeader('valor_total', 'Valor Total', true)}
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

    if (orders.length === 0) {
        tableHTML += `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Nenhum pedido encontrado com a situação "Pedido Entregue" ou "Pedido Enviado".</td></tr>`;
    } else {
        orders.forEach(order => {
            const hasCupom = order.cupom && order.cupom !== 'N/A';
            const cupomText = hasCupom ? order.cupom : 'Nenhum';
            const cupomClass = hasCupom ? 'text-green-600 font-semibold' : 'text-gray-500';

            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${order.numero_pedido || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${order.cliente || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${cupomClass}">${cupomText}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${order.situação || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor_total)}</td>
                </tr>`;
        });
    }

    tableHTML += `</tbody></table></div></div>`;
    return tableHTML;
}

    function _showSalesDetailsModal(monthKey, channel) {
        let startFilterDate, endFilterDate;
        let titleDatePart;
        const titleChannelPart = channel === 'Total' ? 'Todos os Canais' : channel;
    
        if (monthKey === 'period-total') {
            const startDateValue = _dom.startDateInput.value;
            const endDateValue = _dom.endDateInput.value;
            startFilterDate = startDateValue ? new Date(startDateValue + 'T00:00:00') : null;
            endFilterDate = endDateValue ? new Date(endDateValue + 'T23:59:59') : null;
            titleDatePart = (startDateValue && endDateValue) ? `de ${_utils.parsePtBrDate(startDateValue).toLocaleDateString('pt-BR')} a ${_utils.parsePtBrDate(endDateValue).toLocaleDateString('pt-BR')}` : "em todo o período";
        } else {
            const [year, month] = monthKey.split('-');
            startFilterDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            endFilterDate = new Date(parseInt(year), parseInt(month), 0);
            titleDatePart = `de ${new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
        }
    
        const filteredNFe = _allNFeData.filter(nfe => {
            const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
            if (!nfeDate) return false;
            
            const nfeDateOnly = new Date(nfeDate.getFullYear(), nfeDate.getMonth(), nfeDate.getDate());
            nfeDateOnly.setHours(0,0,0,0); // Zera a hora para comparação de data
    
            const channelMatch = (channel === 'Total') ? true : (nfe.origem_loja === channel);
            
            const startDateMatch = startFilterDate ? nfeDateOnly >= startFilterDate : true;
            const endDateMatch = endFilterDate ? nfeDateOnly <= endFilterDate : true;
    
            return channelMatch && startDateMatch && endDateMatch;
        });
        
        _currentSalesDetails = filteredNFe;
    
        const totalValue = filteredNFe.reduce((sum, nfe) => sum + (parseFloat(nfe.valor_da_nota) || 0), 0);
        const formattedTotal = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        _dom.salesDetailsModalTitle.textContent = `Vendas Detalhadas para ${titleChannelPart} ${titleDatePart} - Total: ${formattedTotal}`;
    
        if (filteredNFe.length === 0) {
            _dom.salesDetailsModalContent.innerHTML = '';
            _dom.noSalesDetailsMessage.classList.remove('hidden');
        } else {
            _dom.noSalesDetailsMessage.classList.add('hidden');
            let tableHtml = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº da Nota</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente / Data Emissão</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Situação</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações / Obs.</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
    
            filteredNFe.forEach(nfe => {
                const nfeDate = _utils.parsePtBrDate(nfe.data_de_emissao);
                const hasObservation = Array.isArray(nfe.observacao) && nfe.observacao.length > 0;
                const formattedDate = nfeDate ? nfeDate.toLocaleDateString('pt-BR') : 'N/A';
                const observacaoJson = JSON.stringify(nfe.observacao || []);
    
                tableHtml += `
                <tr id="sales-detail-row-${nfe.id_nota}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"><a href="${nfe.link_danfe || '#'}" target="_blank" rel="noopener noreferrer" title="Abrir DANFE">${nfe.numero_da_nota || 'N/A'}</a></td>
                    <td class="px-6 py-4 whitespace-nowrap nfe-items-tooltip-trigger cursor-help" data-itens="${nfe.itens}" data-frete="${nfe.valor_do_frete}">
                        <div class="text-sm font-medium text-gray-900">${nfe.nome_do_cliente || 'N/A'}</div>
                        <div class="text-xs text-gray-500">${formattedDate}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${(parseFloat(nfe.valor_da_nota) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${nfe.situacao || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <div class="flex items-center justify-center space-x-2">
                            <button class="view-nfe-observation-btn text-gray-500 hover:text-blue-600 p-1" data-nfe-id="${nfe.id_nota}" title="Visualizar/Editar Observações">
                               <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            </button>
                            <span class="nfe-observation-status-icon cursor-pointer" data-nfe-id="${nfe.id_nota}" data-observation='${observacaoJson}' title="${hasObservation ? 'Possui observações' : 'Nenhuma observação'}">
                               <svg class="h-5 w-5 ${hasObservation ? 'text-red-500' : 'text-gray-400'}" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>
                            </span>
                        </div>
                    </td>
                </tr>`;
            });
            tableHtml += `</tbody></table>`;
            _dom.salesDetailsModalContent.innerHTML = tableHtml;
        }
    
        _dom.salesDetailsModal.classList.remove('hidden');
    }
    
    


    // --- Public API ---
    return {
        init: function(config) {
            // A função init agora SÓ guarda as configurações
            console.log('[DashboardApp] Initializing config...');
            _allNFeData = config.allNFeData || [];
            _allProducts = config.allProducts || [];
            _utils.parsePtBrDate = config.parsePtBrDate;
            _utils.showMessageModal = config.showMessageModal;
            _utils.positionTooltip = config.positionTooltip;
            _utils.openNfeObservationModal = config.openNfeObservationModal;
            _utils.formatCnpjCpf = config.formatCnpjCpf;
        },
      // Ação: Substitua sua função start por esta versão corrigida

// Ação: Substitua completamente a sua função start por este bloco

start: function(allNFeData, allLojaIntegradaOrders) {
    // Garante que o setup do DOM e dos eventos rode apenas uma vez.
    if (!_state.isInitialized) {
        console.log('[DashboardApp] Performing one-time setup...');
        _cacheDom();
        _bindEvents();
        _state.isInitialized = true;
    }
    _populateYearFilter();
    // Se já estiver rodando, não faz nada. A função stop() reseta isso.
    if (_state.isStarted) return; 

    console.log('[DashboardApp] Starting...');
    
    // Mostra a barra de filtro
    if (_dom.filterBar) {
        _dom.filterBar.classList.remove('hidden');
    }

    // Atualiza os dados recebidos
    if (allNFeData) {
        _allNFeData = allNFeData;
    }
    if (allLojaIntegradaOrders) {
        _allLojaIntegradaOrders = allLojaIntegradaOrders;
    }

    // Define um filtro de data inicial para o gráfico
    _setDateRange('all'); 
    _state.isStarted = true;
},



        stop: function() {
            console.log('[DashboardApp] Stopping...');
            if (_salesChartInstance) {
                _salesChartInstance.destroy();
                _salesChartInstance = null;
            }
            if (_dom.filterBar) {
                _dom.filterBar.classList.add('hidden');
            }
             _state.isStarted = false;
        },

        updateNfeObservationStatus: function(nfeId, newObservation) {
            const rowToUpdate = document.getElementById(`sales-detail-row-${nfeId}`);
            if (rowToUpdate) {
                const statusIcon = rowToUpdate.querySelector('.nfe-observation-status-icon');
                const newObservationJson = JSON.stringify(newObservation || []);
                if (statusIcon) {
                    statusIcon.dataset.observation = newObservationJson;
                    const svgIcon = statusIcon.querySelector('svg');
                    const hasObservation = Array.isArray(newObservation) && newObservation.length > 0;
                    if (svgIcon) {
                        svgIcon.classList.toggle('text-red-500', hasObservation);
                        svgIcon.classList.toggle('text-gray-400', !hasObservation);
                        statusIcon.title = hasObservation ? 'Esta nota possui observações' : 'Nenhuma observação';
                    }
                }
            }
        }  
    };
})();

