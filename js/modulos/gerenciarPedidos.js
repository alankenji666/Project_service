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
    let _isInitialized = false;
    let _lastHoveredRowId = null;

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

        if (_tableContent) {
            _tableContent.addEventListener('mouseover', (e) => {
                const tr = e.target.closest('tr');
                if (tr) {
                    const id = tr.querySelector('td')?.innerText;
                    if (id && id !== _lastHoveredRowId) {
                        _lastHoveredRowId = id;
                        if (typeof Toastify !== 'undefined' && false) { // Desativei o toast que fica piscando
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
                }
            });
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
        if (_statusSelect) _statusSelect.value = 'pendente';
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
                
                if (sel === 'atendido') statusMatch = (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu'));
                else if (sel === 'pendente') statusMatch = (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento') || sitLower.includes('em andamento'));
                else if (sel === 'preparando') statusMatch = (sitLower.includes('prepar') || sitLower.includes('impress') || sitLower.includes('verificad'));
                else if (sel === 'cancelado') statusMatch = sitLower.includes('cancel');
            }

            const vendedor = _getVendedorName(p.vendedor || '').toLowerCase();
            const termMatch = numero.includes(term) || cliente.includes(term) || vendedor.includes(term);
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
                valA = parseFloat(a.total_pedido || a['total pedido'] || a.valortotal || a.total || 0);
                valB = parseFloat(b.total_pedido || b['total pedido'] || b.valortotal || b.total || 0);
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
                const totalVal = parseFloat(p.total_pedido || p['total pedido'] || p.valortotal || p.total || 0);
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
                else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento') || sitLower.includes('em andamento')) badgeClass = 'bg-yellow-100 text-yellow-800';
                else if (sitLower.includes('prepar') || sitLower.includes('impress') || sitLower.includes('verificad')) badgeClass = 'bg-blue-100 text-blue-800';

                return `
                    <tr id="pedido-row-${numero}" data-order-number="${numero}" class="hover:bg-gray-50 transition-colors">
                        <td class="order-cell-numero px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${numero}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dateFormatted}</td>
                        <td class="px-6 py-4 text-sm text-gray-900 max-w-[250px] truncate" title="${cliente}">${cliente}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${vendedor}</td>
                        <td class="order-cell-status px-6 py-4 whitespace-nowrap">
                            <span class="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${badgeClass}">${situacao}</span>
                        </td>
                        <td class="order-cell-total px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">${totalFormatted}</td>
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
        init: function (config = {}) {
            if (config.openOrderObservationModal) {
                _state.openOrderObservationModal = config.openOrderObservationModal;
            }
            if (!_isInitialized) {
                _cacheDom();
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
                        const totalVal = parseFloat(data.total || 0);
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
        }
    };
})();
