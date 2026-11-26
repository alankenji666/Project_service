import { API_URLS } from '../apiConfig.js';
import { debounce } from '../utils.js';

export const GerenciarPedidosApp = (function () {
    let _allPedidos = [];
    let _filteredPedidos = [];
    let _preProducaoItems = [];
    let _garantiaProducaoItems = [];
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
    let _transportadorasBtn, _transportadorasModal, _closeTransportadorasModalBtn;
    let _transportadorasListView, _transportadoraFormView, _addTransportadoraBtn;
    let _isInitialized = false;
    let _lastHoveredRowId = null;
    let _currentModalPedidoId = null; // ID do pedido aberto no modal
    let _enrichedProductsMap = {}; // Mapa para cachear dados de produtos do modal
    let _pedidosBroadcast = null;

    function _initCrossTabSync() {
        if (_pedidosBroadcast) return;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                _pedidosBroadcast = new BroadcastChannel('mks_pedidos_sync_channel');
                _pedidosBroadcast.onmessage = (event) => {
                    if (event.data && event.data.type === 'orderItemStatusUpdated') {
                        console.log('[BroadcastChannel] Atualização de item recebida:', event.data);
                        GerenciarPedidosApp.updateOrderItemStatusRealTime(event.data.data, true);
                    }
                };
            } catch (e) {
                console.warn('[BroadcastChannel] Falha ao inicializar canal:', e);
            }
        }

        window.addEventListener('storage', (event) => {
            if (event.key === 'mks_pedidos_item_sync' && event.newValue) {
                try {
                    const parsed = JSON.parse(event.newValue);
                    if (parsed && parsed.data && (Date.now() - parsed.ts < 10000)) {
                        console.log('[LocalStorage Sync] Atualização de item recebida:', parsed);
                        GerenciarPedidosApp.updateOrderItemStatusRealTime(parsed.data, true);
                    }
                } catch (e) {}
            }
        });
    }

    function _broadcastItemStatusChange(data) {
        try {
            if (_pedidosBroadcast) {
                _pedidosBroadcast.postMessage({ type: 'orderItemStatusUpdated', data });
            }
            localStorage.setItem('mks_pedidos_item_sync', JSON.stringify({ ts: Date.now(), data }));
        } catch (e) {
            console.warn('[Broadcast] Falha ao enviar broadcast:', e);
        }
    }

    function _getVendedorName(vendedor) {
        if (!vendedor) return '-';
        if (typeof vendedor === 'object') {
            if (vendedor.nome && typeof vendedor.nome === 'string' && vendedor.nome.trim()) {
                vendedor = vendedor.nome.trim();
            } else if (vendedor.id !== undefined && vendedor.id !== null && vendedor.id !== 0 && vendedor.id !== '0') {
                vendedor = vendedor.id;
            } else {
                return '-';
            }
        }
        const v = String(vendedor).trim();
        if (!v || v === '-' || v === '0' || v === 'ID: 0' || v === '[object Object]' || v === 'null' || v === 'undefined') return '-';
        if (v === '15596443455') return 'Reginaldo Araujo de Souza';
        if (v === '15596443462') return 'Julio Martins dos Santos';
        if (v === '15596442848') return 'Rodrigo Carbone';
        if (v.includes('ID:')) {
            const id = v.replace('ID:', '').trim();
            if (id === '15596443455') return 'Reginaldo Araujo de Souza';
            if (id === '15596443462') return 'Julio Martins dos Santos';
            if (id === '15596442848') return 'Rodrigo Carbone';
            if (!id || id === '0') return '-';
        }
        const vLower = v.toLowerCase();
        if (vLower === 'e-commerce' || vLower === 'ecommerce' || vLower.includes('loja integrada')) {
            return 'E-Commerce';
        }
        return v;
    }

    function _extractPagamentoInfo(pedidoBling, isEcommerce = false) {
        if (!pedidoBling) return '';
        const parcelas = Array.isArray(pedidoBling.parcelas) ? pedidoBling.parcelas : [];
        const count = parcelas.length;
        const obsParcela = parcelas.map(p => p.observacoes || '').find(o => o && o.trim() !== '') || '';
        const obsLower = obsParcela.toLowerCase();

        if (obsLower.includes('cartão') || obsLower.includes('cartao') || obsLower.includes('crédito') || obsLower.includes('credito') || obsLower.includes('card')) {
            const vezes = count > 0 ? `${count}x` : '1x';
            return `${vezes} no Cartão (Pagali)`;
        }
        if (obsLower.includes('pix')) {
            return 'Pix (Pagali)';
        }
        if (obsLower.includes('boleto')) {
            return 'Boleto (Pagali)';
        }
        if (obsParcela) {
            let clean = obsParcela.replace(/^m[ée]todo de pagamento:\s*/i, '').trim();
            if (clean) {
                if (isEcommerce && !clean.toLowerCase().includes('pagali')) {
                    clean += ' (Pagali)';
                }
                return clean;
            }
        }
        if (isEcommerce && count > 1) {
            return `${count}x no Cartão (Pagali)`;
        }
        return '';
    }

    // Formas de pagamento conhecidas (ID Bling -> Nome)
    const FORMAS_PAGAMENTO = [
        { id: '6220056', nome: 'Dinheiro' },
        { id: '6220057', nome: 'Conta a receber/pagar' },
    ];

    const FORMA_PAGAMENTO_PADRAO = '6220057'; // Conta a receber/pagar

    function _buildFormasPagamentoOptions(selectedId) {
        const efectiveId = String(selectedId || FORMA_PAGAMENTO_PADRAO);
        return FORMAS_PAGAMENTO.map(f => {
            const sel = f.id === efectiveId ? ' selected' : '';
            return `<option value="${f.id}"${sel}>${f.nome}</option>`;
        }).join('');
    }

    /**
     * Converte IDs numéricos de situação para labels legíveis.
     */
    function _getStatusLabel(situacao) {
        if (!situacao) return '-';
        let s = String(situacao).trim();
        
        // Remove prefixo "ID: " se existir
        if (s.includes('ID:')) {
            s = s.replace('ID:', '').trim();
        }

        if (s === '447331') return 'Em Produção';
        if (s === '6') return 'Em Aberto';
        if (s === '9') return 'Atendido';
        if (s === '15') return 'Em Andamento';
        if (s === '12') return 'Cancelado';
        if (s === '37589') return 'Atendido P.';
        
        return situacao;
    }

    function _fmtData(str) {
        if (!str) return '-';
        // Se já estiver no formato dd/mm/aaaa, retorna
        if (/^\d{2}\/\d{2}\/\d{4}/.test(String(str))) return String(str).substring(0, 10);
        
        // Aceita yyyy-mm-dd ou yyyy/mm/dd e converte para dd/mm/aaaa
        const m = String(str).match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return str; 
    }

    function _parseDate(str) {
        if (!str) return null;
        const s = String(str).trim();
        
        // Tenta yyyy-mm-dd
        let m = s.match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})/);
        if (m) return new Date(m[1], m[2] - 1, m[3]);
        
        // Tenta dd/mm/yyyy
        m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) return new Date(m[3], m[2] - 1, m[1]);
        
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
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

        // Novos elementos para transportadoras
        _transportadorasBtn = document.getElementById('pedidos-transportadoras-btn');
        _transportadorasModal = document.getElementById('transportadoras-modal');
        _closeTransportadorasModalBtn = document.getElementById('close-transportadoras-modal-btn');
        _transportadorasListView = document.getElementById('transportadoras-list-view');
        _transportadoraFormView = document.getElementById('transportadora-form-view');
        _addTransportadoraBtn = document.getElementById('add-transportadora-btn');

        // Elementos da Linha de Produção
        _state.linhaProducaoBtn = document.getElementById('pedidos-linha-producao-btn');
        if (_state.linhaProducaoBtn) _state.linhaProducaoBtn.classList.remove('hidden');
        _state.linhaProducaoModal = document.getElementById('production-line-modal');
        _state.linhaProducaoContent = document.getElementById('production-line-modal-content');
        _state.linhaProducaoCloseBtn = document.getElementById('close-production-line-modal-btn');
        _state.linhaProducaoPrintBtn = document.getElementById('print-production-line-btn');
        _state.linhaProducaoFilterTipo = document.getElementById('filter-tipo-lp');
        _state.linhaProducaoFilterResp = document.getElementById('filter-responsavel-lp');
        _state.linhaProducaoFilterStatus = document.getElementById('filter-status-lp');
        _state.linhaProducaoFilterSearch = document.getElementById('filter-search-lp');
        _state.linhaProducaoFilterSearchClear = document.getElementById('filter-search-lp-clear');
        _state.linhaProducaoCountBadge = document.getElementById('lp-items-count-badge');
        _state.linhaProducaoAddBtn = document.getElementById('lp-add-item-btn');

        // Elementos do Modal de Detalhes do Pedido
        _state.modalStatusCurrentText = document.getElementById('modal-status-current-text');
        _state.modalStatusDropdownBtn = document.getElementById('modal-status-dropdown-btn');
        _state.modalStatusDropdownMenu = document.getElementById('modal-status-dropdown-menu');
        _state.modalEmitirNfeBtn = document.getElementById('modal-emitir-nfe-btn');
        _state.modalPrintNfeBtn = document.getElementById('modal-print-nfe-btn');
        _state.modalStatusSpinner = document.getElementById('modal-status-spinner');
        _state.modalStatusChevron = document.getElementById('modal-status-chevron');

        // Novos elementos do Modal de Edição Rápida
        _state.quickEditModal = document.getElementById('item-quick-edit-modal');
        _state.quickEditItemName = document.getElementById('quick-edit-product-name');
        _state.quickEditCostInput = document.getElementById('quick-edit-cost-price');
        _state.quickEditStockInput = document.getElementById('quick-edit-stock');
        _state.quickEditLocInput = document.getElementById('quick-edit-location');
        _state.quickEditImageUrl = document.getElementById('quick-edit-image-url');
        _state.quickEditLoading = document.getElementById('quick-edit-loading');
        _state.quickEditSaveBtn = document.getElementById('save-item-quick-edit-btn');
        _state.quickEditCancelBtn = document.getElementById('cancel-item-quick-edit-btn');
        _state.quickEditCloseBtn = document.getElementById('close-item-quick-edit-modal-btn');

        // Elementos do Modal de Edição de NF-e
        _state.nfeEditModal = document.getElementById('nfe-edit-modal');
        _state.closeNfeEditModalBtn = document.getElementById('close-nfe-edit-modal-btn');
        _state.cancelNfeEditBtn = document.getElementById('cancel-nfe-edit-btn');
        _state.confirmNfeEditBtn = document.getElementById('confirm-nfe-edit-btn');
        _state.nfeEditAddItemBtn = document.getElementById('nfe-edit-add-item-btn');
        _state.nfeEditItensTbody = document.getElementById('nfe-edit-itens-tbody');
        _state.nfeEditContatoId = document.getElementById('nfe-edit-contato-id');
        _state.nfeEditContatoNome = document.getElementById('nfe-edit-contato-nome');
        _state.nfeEditContatoNomeDetalhe = document.getElementById('nfe-edit-contato-nome-detalhe');
        _state.nfeEditClientToggleBtn = document.getElementById('nfe-edit-client-toggle-btn');
        _state.nfeEditClientToggleChevron = document.getElementById('nfe-edit-client-toggle-chevron');
        _state.nfeEditIeWarning = document.getElementById('nfe-edit-ie-warning');
        _state.nfeEditClientDetails = document.getElementById('nfe-edit-client-details');
        _state.nfeEditContatoFantasia = document.getElementById('nfe-edit-contato-fantasia');
        _state.nfeEditContatoTipo = document.getElementById('nfe-edit-contato-tipo');
        _state.nfeEditContatoCnpj = document.getElementById('nfe-edit-contato-cnpj');
        _state.nfeEditContatoIe = document.getElementById('nfe-edit-contato-ie');
        _state.nfeEditContatoContribuinte = document.getElementById('nfe-edit-contato-contribuinte');
        _state.nfeEditNaturezaId = document.getElementById('nfe-edit-natureza-id');
        _state.nfeEditData = document.getElementById('nfe-edit-data');
        _state.nfeEditDataWarning = document.getElementById('nfe-edit-data-warning');
        _state.nfeEditDataSaida = document.getElementById('nfe-edit-data-saida');
        _state.nfeEditDataSaidaWarning = document.getElementById('nfe-edit-data-saida-warning');
        _state.nfeEditDataPrevista = document.getElementById('nfe-edit-data-prevista');
        _state.nfeEditDataPrevistaWarning = document.getElementById('nfe-edit-data-prevista-warning');
        _state.nfeEditFrete = document.getElementById('nfe-edit-frete');
        _state.nfeEditFretePorConta = document.getElementById('nfe-edit-frete-por-conta');
        _state.nfeEditTransportadora = document.getElementById('nfe-edit-transportadora');
        _state.nfeEditTransportadoraContainer = document.getElementById('nfe-edit-transportadora-container');
        _state.nfeEditVolumes = document.getElementById('nfe-edit-volumes');
        _state.nfeEditVolumesWarning = document.getElementById('nfe-edit-volumes-warning');
        _state.nfeEditFreteContainer = document.getElementById('nfe-edit-frete-container');
        _state.nfeEditVolumesContainer = document.getElementById('nfe-edit-volumes-container');
        _state.nfeEditPesoBrutoContainer = document.getElementById('nfe-edit-peso-bruto-container');
        _state.nfeEditPesoLiquidoContainer = document.getElementById('nfe-edit-peso-liquido-container');
        _state.nfeEditPesoBruto = document.getElementById('nfe-edit-peso-bruto');
        _state.nfeEditPesoLiquido = document.getElementById('nfe-edit-peso-liquido');
        _state.nfeEditDesconto = document.getElementById('nfe-edit-desconto');
        _state.nfeEditDescontoContainer = document.getElementById('nfe-edit-desconto-container');
        _state.nfeEditOutrasDespesas = document.getElementById('nfe-edit-outras-despesas');
        _state.nfeEditObservacoes = document.getElementById('nfe-edit-observacoes');
        _state.nfeEditObservacoesOriginal = document.getElementById('nfe-edit-observacoes-original');
        _state.nfeEditAddParcelaBtn = document.getElementById('nfe-edit-add-parcela-btn');
        _state.nfeEditAutoParcelasBtn = document.getElementById('nfe-edit-auto-parcelas-btn');
        _state.nfeEditAiParseBtn = document.getElementById('nfe-edit-ai-parse-btn');
        _state.nfeEditParcelasTbody = document.getElementById('nfe-edit-parcelas-tbody');
        _state.nfeEditSpinner = document.getElementById('nfe-edit-spinner');
        _state.draftNfeEditBtn = document.getElementById('draft-nfe-edit-btn');
        _state.nfeDraftSpinner = document.getElementById('nfe-draft-spinner');
        _state.saveOrderEditBtn = document.getElementById('save-order-edit-btn');
        _state.saveOrderSpinner = document.getElementById('save-order-spinner');

        // Elementos de Modo do Modal de Edição (NF-e vs NF-s)
        _state.nfeModeNfeBtn = document.getElementById('nfe-mode-nfe-btn');
        _state.nfeModeNfsBtn = document.getElementById('nfe-mode-nfs-btn');
        _state.nfeModeNfsBadge = document.getElementById('nfe-mode-nfs-badge');
        _state.nfeEditViewNfe = document.getElementById('nfe-edit-view-nfe');
        _state.nfeEditViewNfs = document.getElementById('nfe-edit-view-nfs');
        _state.nfeFooterActions = document.getElementById('nfe-footer-actions');
        _state.nfsFooterActions = document.getElementById('nfs-footer-actions');
        _state.nfsEditClienteNome = document.getElementById('nfs-edit-cliente-nome');
        _state.nfsEditClienteDoc = document.getElementById('nfs-edit-cliente-doc');
        _state.nfsEditClienteCidadeUf = document.getElementById('nfs-edit-cliente-cidade-uf');
        _state.nfsEditItensTbody = document.getElementById('nfs-edit-itens-tbody');
        _state.nfsEditTotalServicos = document.getElementById('nfs-edit-total-servicos');
        _state.nfsEditCountBadge = document.getElementById('nfs-edit-count-badge');
        _state.nfsEditObservacoes = document.getElementById('nfs-edit-observacoes');
        _state.confirmNfsEmitBtn = document.getElementById('confirm-nfs-emit-btn');
    }

    function _bindEvents() {
        _initCrossTabSync();
        // Eventos para Transportadoras
        if (_transportadorasBtn) _transportadorasBtn.addEventListener('click', _openTransportadorasModal);

        const globalSyncBtn = document.getElementById('global-sync-orders-btn');
        if (globalSyncBtn) {
            globalSyncBtn.onclick = async () => {
                const originalHtml = globalSyncBtn.innerHTML;
                globalSyncBtn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Buscando...`;
                globalSyncBtn.disabled = true;

                try {
                    const date = new Date();
                    date.setDate(date.getDate() - 15);
                    const dataInicial = date.toISOString().split('T')[0];

                    const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas?idsSituacoes[]=6&dataInicial=${dataInicial}`);
                    if (!res.ok) throw new Error("Falha ao buscar do Bling");
                    
                    const json = await res.json();
                    const pedidosBling = json.data || [];
                    
                    if (pedidosBling.length === 0) {
                        alert("Nenhum pedido em aberto nos últimos 15 dias encontrado no Bling.");
                        return;
                    }
                    
                    // Compara com os pedidos já carregados no sistema (planilha)
                    const pedidosFaltantes = pedidosBling.filter(pBling => {
                        return !_allPedidos.some(pLocal => 
                            String(pLocal.id) === String(pBling.id) || 
                            String(pLocal.numero) === String(pBling.numero) ||
                            String(pLocal.numero) === String(pBling.id)
                        );
                    });

                    if (pedidosFaltantes.length === 0) {
                        alert(`Tudo em dia! ${pedidosBling.length} pedido(s) em aberto no Bling já estão na planilha.`);
                    } else {
                        globalSyncBtn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sincronizando ${pedidosFaltantes.length}...`;
                        
                        const baseUrl = API_URLS.ORDERS_BLING.replace('/pedidos', '');
                        
                        let successCount = 0;
                        for(const p of pedidosFaltantes) {
                            try {
                                // Manda webhook 1 por 1
                                await fetch(`${baseUrl}/bling/pedidos`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        event: "pedidos.vendas.updated",
                                        data: { id: p.id }
                                    })
                                });
                                successCount++;
                            } catch (e) {
                                console.error("Erro no webhook:", e);
                            }
                        }
                        
                        const detalhes = pedidosFaltantes.map(p => `Pedido Nº ${p.numero} - ${p.contato?.nome || 'Sem Nome'}`).join('\n');
                        alert(`Sincronização concluída! ${successCount} pedido(s) novo(s) processado(s):\n\n${detalhes}`);
                        fetchPedidos(true); // recarrega a tabela
                    }
                } catch(error) {
                    console.error(error);
                    alert("Erro ao tentar sincronizar os pedidos.");
                } finally {
                    globalSyncBtn.innerHTML = originalHtml;
                    globalSyncBtn.disabled = false;
                }
            };
        }

        if (_closeTransportadorasModalBtn) _closeTransportadorasModalBtn.addEventListener('click', function() {
            if (_transportadorasModal) _transportadorasModal.classList.add('hidden');
        });
        if (_addTransportadoraBtn) _addTransportadoraBtn.addEventListener('click', function() { _showTransportadoraForm(); });

        const cancelTranspBtn = document.getElementById('cancel-transportadora-btn');
        if (cancelTranspBtn) cancelTranspBtn.addEventListener('click', function() {
            if (_transportadorasListView) _transportadorasListView.classList.remove('hidden');
            if (_transportadoraFormView) _transportadoraFormView.classList.add('hidden');
        });

        const saveTranspBtn = document.getElementById('transp-save-btn');
        if (saveTranspBtn) saveTranspBtn.addEventListener('click', _saveTransportadora);

        if (_searchInput) {
            _searchInput.addEventListener('input', debounce(_filterPedidos, 300));
        }
        if (_startDateInput) _startDateInput.addEventListener('change', () => { _clearDateRadios(); _filterPedidos(); });
        if (_endDateInput) _endDateInput.addEventListener('change', () => { _clearDateRadios(); _filterPedidos(); });
        if (_statusSelect) _statusSelect.addEventListener('change', () => {
            _filterPedidos();
            _updateLinhaProducaoBtnVisibility();
        });
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


        const printDropdownBtn = document.getElementById('modal-print-dropdown-btn');
        const printDropdownMenu = document.getElementById('modal-print-dropdown-menu');
        const printOrderBtn = document.getElementById('modal-print-order-btn');
        const printOrderSubmenu = document.getElementById('modal-print-order-submenu');
        const printOrderChevron = document.getElementById('modal-print-order-chevron');
        const printOrderComPrecoBtn = document.getElementById('modal-print-order-com-preco-btn');
        const printOrderSemPrecoBtn = document.getElementById('modal-print-order-sem-preco-btn');
        const printMarkerBtn = document.getElementById('modal-print-marker-btn');

        const closePrintDropdown = () => {
            if (printDropdownMenu) printDropdownMenu.classList.add('hidden');
            if (printOrderSubmenu) printOrderSubmenu.classList.add('hidden');
            if (printOrderBtn) {
                printOrderBtn.classList.remove('bg-blue-50', 'text-blue-700');
            }
            if (printOrderChevron) {
                printOrderChevron.classList.remove('rotate-90', '-rotate-90', 'text-blue-600');
            }
        };

        if (printDropdownBtn && printDropdownMenu) {
            printDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpening = printDropdownMenu.classList.contains('hidden');
                printDropdownMenu.classList.toggle('hidden');
                if (!isOpening) {
                    if (printOrderSubmenu) printOrderSubmenu.classList.add('hidden');
                    if (printOrderBtn) printOrderBtn.classList.remove('bg-blue-50', 'text-blue-700');
                    if (printOrderChevron) printOrderChevron.classList.remove('rotate-90', '-rotate-90', 'text-blue-600');
                }
            });

            // Fechar dropdown ao clicar fora
            document.addEventListener('click', (e) => {
                if (!printDropdownBtn.contains(e.target) && 
                    !printDropdownMenu.contains(e.target) && 
                    !(printOrderSubmenu && printOrderSubmenu.contains(e.target))) {
                    closePrintDropdown();
                }
            });
        }

        if (printOrderBtn && printOrderSubmenu) {
            printOrderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = printOrderSubmenu.classList.toggle('hidden');
                if (isHidden) {
                    printOrderBtn.classList.remove('bg-blue-50', 'text-blue-700');
                    if (printOrderChevron) printOrderChevron.classList.remove('rotate-90', '-rotate-90', 'text-blue-600');
                } else {
                    printOrderBtn.classList.add('bg-blue-50', 'text-blue-700');
                    if (printOrderChevron) printOrderChevron.classList.add('rotate-90', 'text-blue-600');
                }
            });
        }

        if (printOrderComPrecoBtn) {
            printOrderComPrecoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closePrintDropdown();
                _handleModalPrint(true);
            });
        }

        if (printOrderSemPrecoBtn) {
            printOrderSemPrecoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closePrintDropdown();
                _handleModalPrint(false);
            });
        }

        if (printMarkerBtn) {
            printMarkerBtn.addEventListener('click', () => {
                closePrintDropdown();
                _handlePrintMarker(false);
            });
        }
        
        const printMarkerSmallBtn = document.getElementById('modal-print-marker-small-btn');
        if (printMarkerSmallBtn) {
            printMarkerSmallBtn.addEventListener('click', () => {
                printDropdownMenu.classList.add('hidden');
                _handlePrintMarker(true);
            });
        }


        
        const printLadosCimaBtn = document.getElementById('modal-print-lados-cima-btn');
        if (printLadosCimaBtn) {
            printLadosCimaBtn.addEventListener('click', () => {
                printDropdownMenu.classList.add('hidden');
                _handlePrintLadosCima();
            });
        }

        const syncOrderBtn = document.getElementById('modal-sync-order-btn');
        if (syncOrderBtn) {
            syncOrderBtn.addEventListener('click', () => {
                _handleSyncOrder();
            });
        }

        if (_state.modalPrintNfeBtn) {
            _state.modalPrintNfeBtn.addEventListener('click', () => {
                printDropdownMenu.classList.add('hidden');
                _handlePrintNfe();
            });
        }

        // Lógica do novo dropdown customizado de status
        if (_state.modalStatusDropdownBtn && _state.modalStatusDropdownMenu) {
            _state.modalStatusDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _state.modalStatusDropdownMenu.classList.toggle('hidden');
            });

            // Fechar ao clicar em uma opção ou fora
            document.addEventListener('click', (e) => {
                const optBtn = e.target.closest('.modal-status-option-btn');
                if (optBtn) {
                    const value = optBtn.dataset.value;
                    const label = optBtn.innerText.trim();
                    _state.modalStatusDropdownMenu.classList.add('hidden');
                    _handleModalStatusChange(value, label);
                    return;
                }

                if (!_state.modalStatusDropdownBtn.contains(e.target) && !_state.modalStatusDropdownMenu.contains(e.target)) {
                    _state.modalStatusDropdownMenu.classList.add('hidden');
                }
            });
        }

        // Botão de Editar Pedido (no modal de detalhes)
        if (_state.modalEmitirNfeBtn) {
            _state.modalEmitirNfeBtn.addEventListener('click', _handleEmitirNfe);
        }

        // Alternância de abas/modos dentro de Editar Pedido (NF-e vs NF-s)
        if (_state.nfeModeNfeBtn) {
            _state.nfeModeNfeBtn.addEventListener('click', () => _switchNfeEditMode('nfe'));
        }
        if (_state.nfeModeNfsBtn) {
            _state.nfeModeNfsBtn.addEventListener('click', () => {
                if (!_state.nfeModeNfsBtn.disabled) {
                    _switchNfeEditMode('nfs');
                }
            });
        }
        if (_state.confirmNfsEmitBtn) {
            _state.confirmNfsEmitBtn.addEventListener('click', _handleEmitirNfs);
        }

        // Eventos do Modal de Edição de NF-e
        if (_state.closeNfeEditModalBtn) _state.closeNfeEditModalBtn.addEventListener('click', _closeNfeEditModal);
        if (_state.cancelNfeEditBtn) _state.cancelNfeEditBtn.addEventListener('click', _closeNfeEditModal);
        if (_state.nfeEditAddItemBtn) _state.nfeEditAddItemBtn.addEventListener('click', () => _addNfeEditItemRow({}));
        if (_state.nfeEditAddParcelaBtn) _state.nfeEditAddParcelaBtn.addEventListener('click', () => _addNfeEditParcelaRow({}));
        if (_state.nfeEditAutoParcelasBtn) {
            _state.nfeEditAutoParcelasBtn.addEventListener('click', _handleAutoAdjustParcelas);
        }
        if (_state.nfeEditAiParseBtn) {
            _state.nfeEditAiParseBtn.addEventListener('click', _handleAiParseObservation);
        }
        
        // NOVO: Bind do botão manual de parcelas
        _state.nfeEditManualParcelasBtn = document.getElementById('nfe-edit-manual-parcelas-btn');
        if (_state.nfeEditManualParcelasBtn) {
            _state.nfeEditManualParcelasBtn.addEventListener('click', _handleManualAdjustParcelas);
        }
        
        // NOVO: Bind do botão de consultar CNPJ
        const consultarCnpjBtn = document.getElementById('nfe-edit-consultar-cnpj-btn');
        if (consultarCnpjBtn) {
            consultarCnpjBtn.addEventListener('click', _handleConsultarCnpj);
        }
        
        if (_state.confirmNfeEditBtn) _state.confirmNfeEditBtn.addEventListener('click', () => _confirmCustomEmitirNfe(false));
        if (_state.draftNfeEditBtn) _state.draftNfeEditBtn.addEventListener('click', () => _confirmCustomEmitirNfe(true));
        if (_state.saveOrderEditBtn) _state.saveOrderEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            _saveOrderEdit(false, false);
        });
        if (_state.nfeEditModal) {
            _state.nfeEditModal.addEventListener('click', (e) => {
                if (e.target === _state.nfeEditModal) {
                    // _closeNfeEditModal(); // Desativado a pedido do usuário para evitar fechamento acidental
                }
            });
        }
        if (_state.nfeEditClientToggleBtn && _state.nfeEditClientDetails) {
            _state.nfeEditClientToggleBtn.addEventListener('click', () => {
                const isHidden = _state.nfeEditClientDetails.classList.toggle('hidden');
                if (_state.nfeEditClientToggleChevron) {
                    if (isHidden) {
                        _state.nfeEditClientToggleChevron.classList.remove('rotate-180');
                    } else {
                        _state.nfeEditClientToggleChevron.classList.add('rotate-180');
                    }
                }
            });
        }
        if (_state.nfeEditContatoNome && _state.nfeEditContatoNomeDetalhe) {
            _state.nfeEditContatoNome.addEventListener('input', (e) => {
                _state.nfeEditContatoNomeDetalhe.value = e.target.value;
            });
            _state.nfeEditContatoNomeDetalhe.addEventListener('input', (e) => {
                _state.nfeEditContatoNome.value = e.target.value;
            });
        }

        if (_state.nfeEditContatoIe) {
            _state.nfeEditContatoIe.addEventListener('input', _updateIeWarning);
            _state.nfeEditContatoIe.addEventListener('change', _updateIeWarning);
        }

        if (_state.nfeEditContatoTipo) {
            _state.nfeEditContatoTipo.addEventListener('change', _updateIeWarning);
        }

        if (_state.nfeEditContatoCnpj) {
            _state.nfeEditContatoCnpj.addEventListener('input', () => {
                const digits = _state.nfeEditContatoCnpj.value.replace(/\D/g, '');
                if (digits.length === 11 && _state.nfeEditContatoTipo) {
                    _state.nfeEditContatoTipo.value = 'F';
                    if (_state.nfeEditContatoContribuinte && (!_state.nfeEditContatoIe || !_state.nfeEditContatoIe.value.trim())) {
                        _state.nfeEditContatoContribuinte.value = '9';
                    }
                    _updateIeWarning();
                } else if (digits.length === 14 && _state.nfeEditContatoTipo) {
                    _state.nfeEditContatoTipo.value = 'J';
                    _updateIeWarning();
                }
            });
        }

        if (_state.nfeEditData) {
            _state.nfeEditData.addEventListener('input', _updateAllDateWarnings);
            _state.nfeEditData.addEventListener('change', _updateAllDateWarnings);
        }
        if (_state.nfeEditDataSaida) {
            _state.nfeEditDataSaida.addEventListener('input', _updateAllDateWarnings);
            _state.nfeEditDataSaida.addEventListener('change', _updateAllDateWarnings);
        }
        if (_state.nfeEditDataPrevista) {
            _state.nfeEditDataPrevista.addEventListener('input', _updateAllDateWarnings);
            _state.nfeEditDataPrevista.addEventListener('change', _updateAllDateWarnings);
        }

        // Botões para ajustar data fora do mês atual para hoje
        const adjustBtns = document.querySelectorAll('.adjust-to-today-btn');
        adjustBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const targetId = btn.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    targetInput.value = new Date().toISOString().substring(0, 10);
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    _updateAllDateWarnings();
                }
            });
        });

        if (_state.nfeEditFrete) _formatCurrencyInput(_state.nfeEditFrete);
        if (_state.nfeEditDesconto) _formatCurrencyInput(_state.nfeEditDesconto);
        if (_state.nfeEditOutrasDespesas) _formatCurrencyInput(_state.nfeEditOutrasDespesas);

        // Recalcular totais sempre que frete ou desconto ou outras despesas mudar
        if (_state.nfeEditFrete) {
            _state.nfeEditFrete.addEventListener('input', _calculateTotals);
        }
        if (_state.nfeEditDesconto) {
            _state.nfeEditDesconto.addEventListener('input', _calculateTotals);
        }
        if (_state.nfeEditOutrasDespesas) {
            _state.nfeEditOutrasDespesas.addEventListener('input', _calculateTotals);
        }

        // Listener para Frete por Conta - ocultar/mostrar campos de transporte
        if (_state.nfeEditFretePorConta) {
            _state.nfeEditFretePorConta.addEventListener('change', _updateFreteFields);
        }
        // Listener nos campos de frete e volumes para warning
        if (_state.nfeEditFrete) {
            _state.nfeEditFrete.addEventListener('input', () => {
                _updateVolumesWarning();
                _calculateTotals();
            });
            _state.nfeEditFrete.addEventListener('change', _updateVolumesWarning);
        }
        if (_state.nfeEditVolumes) {
            _state.nfeEditVolumes.addEventListener('input', _updateVolumesWarning);
            _state.nfeEditVolumes.addEventListener('change', _updateVolumesWarning);
        }
        if (_state.nfeEditDesconto) {
            _state.nfeEditDesconto.addEventListener('input', _calculateTotals);
        }

        if (_state.nfeEditContatoId) {
            _state.nfeEditContatoId.addEventListener('change', async (e) => {
                const id = e.target.value.trim();
                if (!id) return;
                try {
                    const res = await fetch(`${API_URLS.ORDERS_BLING}/contatos/${id}`);
                    if (!res.ok) throw new Error();
                    const result = await res.json();
                    const contato = result.data;
                    if (contato) {
                        if (_state.nfeEditContatoNome) _state.nfeEditContatoNome.value = contato.nome || '';
                        if (_state.nfeEditContatoNomeDetalhe) _state.nfeEditContatoNomeDetalhe.value = contato.nome || '';
                        if (_state.nfeEditContatoFantasia) _state.nfeEditContatoFantasia.value = contato.fantasia || '';
                        const docClean = (contato.numeroDocumento || '').replace(/\D/g, '');
                        const tipoCalculado = contato.tipoPessoa || (docClean.length === 11 ? 'F' : 'J');
                        if (_state.nfeEditContatoTipo) _state.nfeEditContatoTipo.value = tipoCalculado;
                        if (_state.nfeEditContatoCnpj) _state.nfeEditContatoCnpj.value = contato.numeroDocumento || '';
                        if (_state.nfeEditContatoIe) _state.nfeEditContatoIe.value = contato.ie || '';
                        if (_state.nfeEditContatoContribuinte) {
                            _state.nfeEditContatoContribuinte.value = contato.indicadorIe !== undefined ? contato.indicadorIe : (tipoCalculado === 'F' ? 9 : 9);
                        }
                        _updateIeWarning();
                    }
                } catch (err) {
                    console.warn('[NFe Edit] Não foi possível carregar os detalhes do contato pelo ID digitado.');
                }
            });
        }

        // Eventos do Modal de Edição Rápida
        if (_state.quickEditCancelBtn) _state.quickEditCancelBtn.addEventListener('click', _closeQuickEditModal);
        if (_state.quickEditCloseBtn) _state.quickEditCloseBtn.addEventListener('click', _closeQuickEditModal);
        if (_state.quickEditSaveBtn) _state.quickEditSaveBtn.addEventListener('click', _saveItemQuickEdit);

        // Eventos da Linha de Produção
        if (_state.linhaProducaoBtn) _state.linhaProducaoBtn.addEventListener('click', _showProductionLine);
        if (_state.linhaProducaoCloseBtn) _state.linhaProducaoCloseBtn.addEventListener('click', () => _state.linhaProducaoModal.classList.add('hidden'));
        if (_state.linhaProducaoAddBtn) _state.linhaProducaoAddBtn.addEventListener('click', _openAddProductionItemModal);
        if (_state.linhaProducaoPrintBtn) _state.linhaProducaoPrintBtn.addEventListener('click', _printProductionLine);
        if (_state.linhaProducaoFilterTipo) {
            const lpPrefs = _loadLinhaProducaoFilterPrefs();
            if (lpPrefs.tipo && Array.from(_state.linhaProducaoFilterTipo.options).some(o => o.value === lpPrefs.tipo)) {
                _state.linhaProducaoFilterTipo.value = lpPrefs.tipo;
                _state.linhaProducaoFilterTipo.dataset.prefsLoaded = 'true';
            }
            _state.linhaProducaoFilterTipo.addEventListener('change', () => {
                _saveLinhaProducaoFilterPrefs();
                _showProductionLine();
            });
        }
        if (_state.linhaProducaoFilterResp) _state.linhaProducaoFilterResp.addEventListener('change', () => {
            _saveLinhaProducaoFilterPrefs();
            _showProductionLine();
        });
        if (_state.linhaProducaoFilterStatus) {
            const lpPrefs = _loadLinhaProducaoFilterPrefs();
            if (lpPrefs.status && Array.from(_state.linhaProducaoFilterStatus.options).some(o => o.value === lpPrefs.status)) {
                _state.linhaProducaoFilterStatus.value = lpPrefs.status;
                _state.linhaProducaoFilterStatus.dataset.prefsLoaded = 'true';
            }
            _state.linhaProducaoFilterStatus.addEventListener('change', () => {
                _saveLinhaProducaoFilterPrefs();
                _showProductionLine();
            });
        }
        if (_state.linhaProducaoFilterSearch) {
            _state.linhaProducaoFilterSearch.addEventListener('input', () => {
                const rawSearch = _state.linhaProducaoFilterSearch.value.trim();
                if (_state.linhaProducaoFilterSearchClear) {
                    if (rawSearch) {
                        _state.linhaProducaoFilterSearchClear.classList.remove('hidden');
                    } else {
                        _state.linhaProducaoFilterSearchClear.classList.add('hidden');
                    }
                }
                _showProductionLine();
            });
            _state.linhaProducaoFilterSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    _state.linhaProducaoFilterSearch.value = '';
                    if (_state.linhaProducaoFilterSearchClear) {
                        _state.linhaProducaoFilterSearchClear.classList.add('hidden');
                    }
                    _showProductionLine();
                }
            });
        }
        if (_state.linhaProducaoFilterSearchClear) {
            _state.linhaProducaoFilterSearchClear.addEventListener('click', () => {
                if (_state.linhaProducaoFilterSearch) {
                    _state.linhaProducaoFilterSearch.value = '';
                    _state.linhaProducaoFilterSearch.focus();
                }
                _state.linhaProducaoFilterSearchClear.classList.add('hidden');
                _showProductionLine();
            });
        }
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

        // Limpa o destaque de "novo pedido" se existir
        const numStr = String(orderNumber);
        const newOrders = JSON.parse(localStorage.getItem('new_orders_highlight') || '[]');
        if (newOrders.includes(numStr)) {
            const updated = newOrders.filter(id => id !== numStr);
            localStorage.setItem('new_orders_highlight', JSON.stringify(updated));
            const tr = document.getElementById(`pedido-row-${numStr}`);
            if (tr) {
                tr.classList.remove('bg-blue-50', 'hover:bg-blue-100');
                tr.classList.add('hover:bg-gray-50');
                const firstTd = tr.querySelector('td');
                if (firstTd) {
                    firstTd.classList.remove('border-l-4', 'border-blue-500');
                    firstTd.classList.add('border-l-4', 'border-transparent');
                }
            }
        }

        // Limpar qualquer estado ou cache residual de edição de outro pedido anterior
        if (_state.nfeEditModal && _state.nfeEditModal.classList.contains('hidden')) {
            _state.currentPedidoBlingBruto = null;
            if (_state.nfeEditTransportadora) {
                _state.nfeEditTransportadora.selectedIndex = 0;
                _state.nfeEditTransportadora.value = '';
            }
            _state.nfeEditCurrentTranspId = '';
            _state.nfeEditCurrentTranspNome = '';
        }

        // Salvar o ID do pedido atual no modal
        const pedidoId = pedido.id || pedido.id_pedido || pedido['id pedido'] || '';
        _currentModalPedidoId = pedidoId || orderNumber;
        modal.dataset.currentOrderNumber = orderNumber;

        // Gerenciar valor e texto do dropdown customizado
        const situacao = _getStatusLabel(pedido.situação || pedido.situacao || pedido.id_situacao || '-');
        const situacaoRaw = situacao.toLowerCase();
        let currentStatusVal = "6";
        let currentStatusLabel = "Em Aberto";
 
        if (situacaoRaw.includes('abert') || situacaoRaw.includes('pendent')) {
            currentStatusVal = "6";
            currentStatusLabel = "Em Aberto";
        } else if (situacaoRaw.includes('produ')) {
            currentStatusVal = "447331";
            currentStatusLabel = "Em Produção";
        } else if (situacaoRaw.includes('atendid') || situacaoRaw.includes('entregue') || situacaoRaw.includes('conclu')) {
            currentStatusVal = "9";
            currentStatusLabel = "Atendido";
        } else if (situacaoRaw.includes('cancel')) {
            currentStatusVal = "12";
            currentStatusLabel = "Cancelado";
        }
 
        const statusTextEl = document.getElementById('modal-status-current-text') || _state.modalStatusCurrentText;
        if (statusTextEl) {
            statusTextEl.innerText = currentStatusLabel;
        }
        _updateModalStatusButtonStyle(currentStatusVal);
 
        // Gerenciar visibilidade do botão de Emitir NF-e
        // Tenta encontrar a nota no cache global primeiro (mais atualizado em tempo real)
        const nfeVinculada = (window._allNFeData || []).find(n => 
            String(n.id_pedido || n.idPedido || '') === String(pedidoId) ||
            String(n.numero_pedido || '') === String(orderNumber)
        );
        
        const idNota = nfeVinculada?.id || nfeVinculada?.id_nota || nfeVinculada?.numero || 
                       pedido.id_nota || pedido['id nota'] || pedido.idnotafiscal || 
                       pedido.id_nota_fiscal || pedido['id nota fiscal'] || '';
        if (_state.modalEmitirNfeBtn) {
            const btn = _state.modalEmitirNfeBtn;
            if (idNota) {
                btn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    NF-e Emitida
                `;
                btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                btn.classList.add('bg-green-600', 'hover:bg-green-700');
                btn.title = "Nota Fiscal (NF-e) já foi emitida (ID: " + idNota + ")";
            } else {
                btn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Editar Pedido
                `;
                btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                btn.title = "Editar informações antes de emitir a Nota Fiscal Eletrônica (NF-e)";
            }
        }


        // Reset dropdown de impressão e submenu
        const printMenu = document.getElementById('modal-print-dropdown-menu');
        if (printMenu) printMenu.classList.add('hidden');
        const printSubmenu = document.getElementById('modal-print-order-submenu');
        if (printSubmenu) printSubmenu.classList.add('hidden');
        const printOrderBtnEl = document.getElementById('modal-print-order-btn');
        if (printOrderBtnEl) printOrderBtnEl.classList.remove('bg-blue-50', 'text-blue-700');
        const chevron = document.getElementById('modal-print-order-chevron');
        if (chevron) chevron.classList.remove('rotate-90', '-rotate-90', 'text-blue-600', 'rotate-180');

        const numero = pedido.número || pedido.numero || orderNumber;
        title.innerText = `Pedido Nº ${numero}`;

        // --- Mapeamento de campos a ignorar ou tratar especialmente ---
        const ignoreKeys = ['id', 'id_pedido', 'id pedido', 'updatedAt'];
        // situacao já foi normalizada acima com _getStatusLabel
        const sitLower = situacao.toLowerCase();
        let badge = 'bg-gray-100 text-gray-700';
        if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badge = 'bg-green-100 text-green-700';
        else if (sitLower.includes('cancel')) badge = 'bg-red-100 text-red-700';
        else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('analise')) badge = 'bg-yellow-100 text-yellow-700';
        else if (sitLower.includes('produção') || sitLower.includes('producao') || sitLower.includes('andamento')) badge = 'bg-blue-100 text-blue-700';

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
            'contato_nome', 'contato nome', 'cpf_cnpj', 'cpf cnpj', 'cpf/cnpj', 'data', 'total', 'total_pedido', 'total pedido',
            'id_nota', 'id nota', 'idnotafiscal', 'id_nota_fiscal', 'id nota fiscal', 'detalhes_producao', 'detalhesproducao'];

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

        // --- NF-e: Buscar dados vinculados ---
        const nfe = (window._allNFeData || []).find(n => 
            String(n.id_pedido || n.idPedido || '') === String(pedidoId) ||
            String(n.numero_pedido || '') === String(orderNumber) ||
            String(n.id_nota || '') === String(idNota)
        );
        const safeClientName = (pedido.nome || pedido.cliente || 'Cliente').replace(/'/g, "\\'");

        if (nfe) {
            const numeroNota = nfe.numero || nfe.numero_da_nota || '-';
            const serieNota = nfe.serie || '-';
            const linkDanfe = nfe['Link DANFE'] || nfe.link_danfe || nfe.linkDanfe || nfe.link || '#';
            const chaveAcesso = nfe.chave_acesso || nfe.chaveAcesso || nfe.chave_de_acesso || nfe['Chave de Acesso'] || '';
            
            const rawName = (pedido.nome || pedido.contato_nome || pedido['contato nome'] || pedido.cliente || 'Cliente').trim();
            const rawWords = rawName.split(/\s+/);
            let resultWords = [];
            let validNamesCount = 0;
            for (let word of rawWords) {
                resultWords.push(word);
                if (word.length > 3 && /[a-zA-Z]/.test(word)) validNamesCount++;
                if (validNamesCount >= 2) break;
            }
            const shortClientName = resultWords.join(' ');
            const orcValue = pedido.orcamento || pedido.orçamento || '';
            const orcamentoStr = (orcValue && String(orcValue) !== '0') ? ` - Orc. ${orcValue}` : '';
            const numeroNotaStr = numeroNota !== '-' ? ` - Nfe. ${numeroNota}` : '';
            
            let baseFilename = `DANFE - ${shortClientName}${numeroNotaStr}${orcamentoStr}`;
            let safeFilenameForDownload = baseFilename.replace(/[<>:"/\\|?*]/g, '_') + '.pdf';
            let safeFilenameXmlForDownload = `XML ${baseFilename}`.replace(/[<>:"/\\|?*]/g, '_') + '.xml';
            
            // Tenta extrair a chave do link se não veio diretamente (comum no webhook do Bling)
            let finalChaveAcesso = chaveAcesso;
            if (!finalChaveAcesso && linkDanfe && linkDanfe !== '#') {
                const matchChave = linkDanfe.match(/chave=([^&]+)/) || linkDanfe.match(/chaveAcesso=([^&]+)/);
                if (matchChave) finalChaveAcesso = matchChave[1];
            }

            let baixarPdfUrl = '';
            let baixarXmlUrl = '';
            if (finalChaveAcesso) {
                baixarPdfUrl = `${API_URLS.WEBHOOK_LAUNCH}/proxy-danfe?chaveAcesso=${finalChaveAcesso}&filename=${encodeURIComponent(safeFilenameForDownload)}`;
                baixarXmlUrl = `${API_URLS.WEBHOOK_LAUNCH}/proxy-xml?chaveAcesso=${finalChaveAcesso}&filename=${encodeURIComponent(safeFilenameXmlForDownload)}`;
            } else if (linkDanfe && linkDanfe !== '#') {
                baixarPdfUrl = `${API_URLS.WEBHOOK_LAUNCH}/proxy-pdf?url=${encodeURIComponent(linkDanfe)}&filename=${encodeURIComponent(safeFilenameForDownload)}`;
            }

            let baixarBtnHtml = '';
            if (baixarPdfUrl && finalChaveAcesso) {
                baixarBtnHtml = `
                <a href="#" onclick="event.preventDefault(); window.downloadDanfeWithSpinner('${baixarPdfUrl}', '${safeFilenameForDownload.replace(/'/g, "\\'")}', this)" class="flex items-center gap-1.5 text-[10px] bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors font-bold uppercase shadow-sm" title="Baixar PDF do DANFE com o nome do cliente">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Baixar DANFE
                </a>
                <a href="#" onclick="event.preventDefault(); window.downloadXmlWithSpinner('${baixarXmlUrl}', '${safeFilenameXmlForDownload.replace(/'/g, "\\'")}', this)" class="flex items-center gap-1.5 text-[10px] bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors font-bold uppercase shadow-sm" title="Baixar arquivo XML da NF-e">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Baixar XML
                </a>`;
            } else if (!finalChaveAcesso && String(numeroNota).toLowerCase() !== 'processando...') {
                baixarBtnHtml = `
                <div class="flex items-center gap-1 bg-white border border-yellow-300 rounded px-1.5 py-1 shadow-sm">
                    <input type="text" id="manual-chave-acesso-${idNota}" placeholder="Cole a Chave de Acesso (44 dígitos)" class="text-[9px] text-gray-700 bg-transparent w-44 focus:outline-none placeholder-gray-400">
                    <button onclick="window.saveChaveAcessoManual('${idNota}', this)" class="bg-yellow-500 hover:bg-yellow-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors shadow-sm">SALVAR</button>
                    <button onclick="window.syncNfeBling(this)" class="bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors shadow-sm ml-1 flex items-center justify-center" title="Sincronizar Nota no Bling">
                        <svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        SYNC
                    </button>
                </div>`;
            }

            gridHtml += `
                <div class="bg-green-50 p-3 rounded-lg border border-green-100 md:col-span-2">
                    <div class="flex items-center gap-2 mb-1">
                        <svg class="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd"></path></svg>
                        <span class="block text-[10px] font-bold text-green-500 uppercase tracking-wider">Nota Fiscal Eletrônica (Emitida)</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span id="modal-nfe-numero-display" class="block text-sm text-green-800 font-bold">Nº ${numeroNota} (Série ${serieNota})</span>
                        <div class="flex items-center gap-2">
                            ${baixarBtnHtml}
                            ${linkDanfe !== '#' ? `
                                <a href="${linkDanfe}" target="_blank" class="flex items-center gap-1.5 text-[10px] bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-bold uppercase shadow-sm">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    Visualizar DANFE
                                </a>
                                <a href="#" onclick="event.preventDefault(); window.openEmailDanfeModal('${baixarPdfUrl}', '${finalChaveAcesso || ''}', '${linkDanfe || ''}', '${safeFilenameForDownload.replace(/'/g, "\\'")}', '${pedido.email || pedido.contato_email || pedido['e-mail'] || ''}', '${numeroNota}', '${safeClientName}', '${numero}', '${orcValue}', '${vendedorName.replace(/'/g, "\\'")}', ${_pedidoHasService(pedido)})" class="flex items-center gap-1.5 text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-bold uppercase shadow-sm">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    Enviar E-mail
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>`;
        } else {
            gridHtml += `
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 md:col-span-2">
                    <div class="flex items-center gap-2 mb-1">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd"></path></svg>
                        <span class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nota Fiscal Eletrônica</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="block text-sm text-gray-500 font-bold italic">Aguardando emissão...</span>
                    </div>
                </div>`;
        }

        // --- Itens: parse da string "(codigo, qtd, valor)" ---
        const itensRaw = pedido.itens || pedido.Itens || '';
        let itensHtml = '';
        if (itensRaw) {
            const pedidoId = pedido.id_pedido || pedido.id || pedido.numero_pedido || pedido.numero;
            const itensList = _parseItens(itensRaw, pedido.detalhesProducao || {}, pedidoId);
            if (itensList.length > 0) {
                itensHtml = `
                <div class="mt-6">
                    <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Itens do Pedido</h3>
                    <div id="pedido-modal-itens-container" class="pb-28">
                        <table class="min-w-full divide-y divide-gray-200 text-sm rounded-lg">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Produto</th>
                                    <th class="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Qtd</th>
                                    <th class="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Estoque</th>
                                    <th class="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Situação</th>
                                    <th class="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Valor</th>
                                </tr>
                            </thead>
                            <tbody id="pedido-modal-itens-body" class="bg-white divide-y divide-gray-100">
                                ${itensList.map((item, index) => {
                                    const isService = String(item.codigo).trim().startsWith('7');
                                    const initialStockHtml = isService 
                                        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-700 border border-orange-200">Serviço</span>`
                                        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-400 border border-gray-200 animate-pulse">...</span>`;

                                    return `
                                    <tr data-item-codigo="${item.codigo}" data-item-index="${index}" class="cursor-pointer hover:bg-gray-50 transition-colors item-row" onclick="GerenciarPedidosApp.handleItemClick('${item.codigo}')">
                                        <td class="px-4 py-3">
                                            <div class="flex items-center gap-3">
                                                <img id="img-${item.codigo}-${index}" src="https://placehold.co/48x48/e2e8f0/64748b?text=..." 
                                                     alt="" class="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                                                     onerror="this.src='https://placehold.co/48x48/e2e8f0/64748b?text=?'">
                                                <div>
                                                    <div class="flex items-center gap-2">
                                                        <p class="font-medium text-gray-800" id="desc-${item.codigo}-${index}">${item.descricaoPersonalizada || item.codigo}</p>
                                                        <div class="flex items-center gap-1">
                                                            <button onclick="GerenciarPedidosApp.handleSearchProduct('${item.codigo}', event)" 
                                                                    class="p-1 hover:bg-blue-50 text-blue-500 rounded transition-colors" 
                                                                    title="Pesquisar detalhes do produto">
                                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                            </button>
                                                            <button onclick="GerenciarPedidosApp.handleEditItemDescription('${pedidoId}', '${item.codigo}', ${index}, event)" 
                                                                    class="p-1 hover:bg-orange-50 text-orange-500 rounded transition-colors" 
                                                                    title="Editar nome/variação para produção">
                                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p class="text-xs text-gray-400">${item.codigo}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-4 py-3 text-center text-gray-700">${item.quantidade}</td>
                                        <td class="px-4 py-3 text-center" id="stock-col-${item.codigo}-${index}">
                                            ${initialStockHtml}
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            ${_createItemStatusBadge(item.status, pedidoId, item.codigo, index)}
                                        </td>
                                        <td class="px-4 py-3 text-right font-semibold text-gray-800">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(_parseNumber(item.valor))}</td>
                                    </tr>
                                    `;
                                }).join('')}
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

    function _parseItens(raw, producaoData = {}, pedidoId = '', altPedidoId = '') {
        const results = [];
        if (!raw) return results;

        // Limpa a string e divide pelo padrão "(SKU, QTD"
        const itemStrings = String(raw).split(/(?=\([^,]+,\s*\d+)/).filter(Boolean);

        itemStrings.forEach((itemStr, index) => {
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
            if (parts.length >= 3) {
                const sku = parts[0];
                const qty = parseFloat(parts[1]) || 1;
                let valPart = parts[2];
                let status = 'OK';
                
                if (valPart.includes('|')) {
                    const sub = valPart.split('|');
                    valPart = sub[0];
                    status = sub[1] || 'OK';
                }

                // BUSCA NA ABA DE PRODUÇÃO (Prioridade Total)
                const key1 = `${pedidoId}-${index}`;
                const key2 = altPedidoId ? `${altPedidoId}-${index}` : null;
                let extra = producaoData[key1] || (key2 ? producaoData[key2] : null);
                if (!extra && producaoData && typeof producaoData === 'object') {
                    const found = Object.entries(producaoData).find(([k]) => k.endsWith(`-${index}`));
                    if (found) extra = found[1];
                }
                
                results.push({
                    codigo: sku,
                    quantidade: qty,
                    quantidadeProducao: (extra && extra.quantidade !== undefined && extra.quantidade !== '') ? (parseFloat(extra.quantidade) || qty) : qty,
                    valor: _parseNumber(valPart) || 0,
                    status: (extra && extra.status) ? extra.status : status,
                    descricaoPersonalizada: (extra && extra.descricao) ? extra.descricao : '',
                    dataProducao: (extra && extra.data) ? extra.data : '', // Pegando a data da aba de produção
                    responsavel: (extra && extra.responsavel) ? extra.responsavel : '', // Novo campo de Responsável
                    vendedorProducao: (extra && extra.vendedor) ? extra.vendedor : '',
                    index: index // Adicionando o índice original
                });
            }
        });
        
        return results;
    }

    /**
     * Cria o HTML do badge de status do item (OK / Em Produção).
     */
    function _createItemStatusBadge(status, pedidoId, itemCodigo, index) {
        let s = String(status || 'OK').toUpperCase().trim();
        if (s === 'CRIADO' || s === 'PENDENTE' || s === 'FINALIZADO') s = 'OK';
        let currentStatus = s;
        if (currentStatus === 'PRODUCAO' || currentStatus === 'EM PRODUCAO') currentStatus = 'EM PRODUÇÃO';
        
        if (!window._pedidoItemDropdownListener) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            });
            window.addEventListener('scroll', () => {
                document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            }, true);
            window._pedidoItemDropdownListener = true;
        }
        
        const statusOptions = ['OK', 'EM PRODUÇÃO'];
        if (!statusOptions.includes(currentStatus)) {
            currentStatus = 'OK'; // Default fallback
        }

        let pBadgeClass = 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'; // OK default
        if (currentStatus === 'EM PRODUÇÃO') pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';

        let dropdownOptions = statusOptions.map(opt => {
            let dotColor = 'bg-green-400';
            if (opt === 'EM PRODUÇÃO') dotColor = 'bg-blue-400';
            return `<button type="button" onclick="GerenciarPedidosApp.handleDropdownItemStatus('${pedidoId}', '${itemCodigo}', '${opt}', ${index}, '${currentStatus}', event)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 pedido-item-dropdown-option"><span class="w-2 h-2 rounded-full ${dotColor}"></span>${opt}</button>`;
        }).join('');

        return `
        <div class="relative inline-block text-left" data-dropdown-container>
            <button type="button" onclick="GerenciarPedidosApp.toggleItemStatusDropdown(this, event)" class="px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border ${pBadgeClass} min-w-[120px] transition-all cursor-pointer shadow-sm">
                <span class="flex-1 text-center">${currentStatus}</span>
                <svg class="w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="pedido-item-custom-dropdown-menu absolute right-0 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-[70] hidden overflow-hidden py-1">
                ${dropdownOptions}
            </div>
        </div>`;
    }

    function _toggleItemStatusDropdown(btn, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const menu = btn.nextElementSibling;
        if (!menu) return;

        // Fecha todos os outros menus abertos
        document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });

        const isOpening = menu.classList.contains('hidden');
        if (isOpening) {
            // Mede espaço abaixo vs acima
            const modalContent = btn.closest('#modal-order-content') || btn.closest('.overflow-y-auto') || document.body;
            const btnRect = btn.getBoundingClientRect();
            const contentRect = modalContent.getBoundingClientRect();
            
            // Espaço restante abaixo do botão até a borda inferior visível do container ou da viewport
            const bottomLimit = Math.min(contentRect.bottom, window.innerHeight);
            const spaceBelow = bottomLimit - btnRect.bottom;
            const menuHeight = 100; // altura do menu com 2 itens + margens

            if (spaceBelow < menuHeight) {
                // Sem espaço abaixo: abre para CIMA (dropup)
                menu.style.bottom = 'calc(100% + 6px)';
                menu.style.top = 'auto';
            } else {
                // Espaço suficiente: abre para BAIXO
                menu.style.top = 'calc(100% + 6px)';
                menu.style.bottom = 'auto';
            }

            menu.classList.remove('hidden');
        } else {
            menu.classList.add('hidden');
        }
    }
    window.togglePedidoItemDropdown = _toggleItemStatusDropdown;

    async function _enrichItensWithProductData(itensList) {
        try {
            const res = await fetch(`${API_URLS.PRODUCTS}?t=${Date.now()}`, { mode: 'cors' });
            if (!res.ok) return;
            const json = await res.json();
            const products = json.data || json || [];

            _enrichedProductsMap = {}; // Reset

            itensList.forEach((item, idx) => {
                const isService = String(item.codigo).trim().startsWith('7');
                const prod = products.find(p =>
                    String(p.codigo || '').trim() === String(item.codigo).trim()
                );

                if (!prod) {
                    const stockCol = document.getElementById(`stock-col-${item.codigo}-${idx}`);
                    if (stockCol) {
                        if (isService) {
                            stockCol.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200" title="Item de Serviço Livre">Serviço</span>`;
                        } else {
                            stockCol.innerHTML = '<span class="text-xs text-red-400">N/A</span>';
                        }
                    }
                    return;
                }

                // Salvar no mapa local para uso no Quick Edit
                _enrichedProductsMap[item.codigo] = prod;

                const imgEl = document.getElementById(`img-${item.codigo}-${idx}`);
                const descEl = document.getElementById(`desc-${item.codigo}-${idx}`);
                const stockCol = document.getElementById(`stock-col-${item.codigo}-${idx}`);

                if (imgEl && prod.url_imagens_externas && prod.url_imagens_externas[0]) {
                    imgEl.src = prod.url_imagens_externas[0];
                }
                
                // Só sobrescreve se não tiver descrição personalizada E o conteúdo atual for o código
                if (descEl && prod.descricao) {
                    if (!item.descricaoPersonalizada || descEl.textContent.trim() === item.codigo) {
                        descEl.textContent = prod.descricao;
                    }
                }

                if (stockCol) {
                    const disponivel = parseFloat(prod.estoque) || 0;
                    const pedidoQty = parseFloat(item.quantidade) || 0;
                    if (isService) {
                        stockCol.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-700 border border-orange-200" title="Serviço">Serviço</span>`;
                    } else if (disponivel >= pedidoQty) {
                        stockCol.innerHTML = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-200 shadow-sm" title="Disponível: ${disponivel}">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            OK
                        </span>`;
                    } else {
                        stockCol.innerHTML = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200 shadow-sm" title="Disponível: ${disponivel}">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            Esgotado
                        </span>`;
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
        
        // NOVO: Armazena os valores originais para comparação posterior e detecção de mudanças
        _state.originalQuickEditValues = {
            cost: _parseNumber(prod.preco_de_custo),
            stock: _parseNumber(prod.estoque),
            location: (prod.localizacao || '').trim()
        };

        if (_state.quickEditItemName) _state.quickEditItemName.textContent = `[${prod.codigo}] ${prod.descricao || ''}`;
        
        // Preenche os inputs com os valores originais formatados
        if (_state.quickEditCostInput) {
            _state.quickEditCostInput.value = _state.originalQuickEditValues.cost.toFixed(2);
        }
        if (_state.quickEditStockInput) {
            _state.quickEditStockInput.value = _state.originalQuickEditValues.stock;
        }
        if (_state.quickEditLocInput) {
            _state.quickEditLocInput.value = _state.originalQuickEditValues.location;
        }
        if (_state.quickEditImageUrl) {
            let imgUrl = '';
            if (prod.url_imagens_externas && prod.url_imagens_externas.length > 0) {
                imgUrl = prod.url_imagens_externas[0];
            } else if (typeof prod.url_imagens_externas === 'string') {
                imgUrl = prod.url_imagens_externas;
            } else if (prod.imagem) {
                imgUrl = prod.imagem;
            }
            _state.quickEditImageUrl.value = imgUrl;
            _state.originalQuickEditValues.imageUrl = imgUrl;
        }

        _state.quickEditModal.classList.remove('hidden');
    }

    function _closeQuickEditModal() {
        if (_state.quickEditModal) _state.quickEditModal.classList.add('hidden');
        if (_state.quickEditLoading) _state.quickEditLoading.classList.add('hidden');
        if (_state.quickEditSaveBtn) _state.quickEditSaveBtn.disabled = false;
    }

    async function _saveItemQuickEdit() {
        const prod = _state.currentEditingProduct;
        const originals = _state.originalQuickEditValues;
        if (!prod || !originals) return;

        // Captura valores atuais dos inputs
        const newCost = parseFloat(_state.quickEditCostInput.value);
        const newStock = parseFloat(_state.quickEditStockInput.value);
        const newLoc = _state.quickEditLocInput.value.trim();
        const newImageUrl = _state.quickEditImageUrl ? _state.quickEditImageUrl.value.trim() : '';

        if (isNaN(newCost) || isNaN(newStock)) {
            alert('Por favor, insira valores válidos para preço e estoque.');
            return;
        }

        // DETECÇÃO DE MUDANÇAS: Só enviaremos para a API o que realmente mudou
        const costChanged = Math.abs(newCost - originals.cost) > 0.001;
        const stockChanged = Math.abs(newStock - originals.stock) > 0.001;
        const locChanged = newLoc !== originals.location;
        const imageChanged = newImageUrl !== (originals.imageUrl || '');

        // Se nada mudou, apenas fecha
        if (!costChanged && !stockChanged && !locChanged && !imageChanged) {
            _closeQuickEditModal();
            return;
        }

        console.log(`[QuickEdit] Iniciando salvamento para ${prod.codigo}. Mudanças: Custo=${costChanged}, Estoque=${stockChanged}, Local=${locChanged}, Imagem=${imageChanged}`);
        console.log(`[QuickEdit] Valores: Custo(${originals.cost} -> ${newCost}), Estoque(${originals.stock} -> ${newStock})`);

        _state.quickEditLoading.classList.remove('hidden');
        _state.quickEditSaveBtn.disabled = true;

        try {
            // 1. Atualizar Detalhes (Custo, Localização e Imagem) - Apenas se necessário
            if (costChanged || locChanged || imageChanged) {
                console.log(`[QuickEdit] Enviando PUT para atualizar detalhes (ID: ${prod.id})...`);
                const updateDetailsRes = await fetch(`${API_URLS.PRODUCTS}/${prod.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        preco_de_custo: newCost,
                        localizacao: newLoc,
                        imagem_url: newImageUrl
                    })
                });

                if (!updateDetailsRes.ok) throw new Error('Falha ao atualizar detalhes do produto.');
                console.log(`[QuickEdit] Detalhes atualizados com sucesso.`);
            }

            // 2. Atualizar Estoque (Balanço) - Apenas se necessário
            if (stockChanged) {
                console.log(`[QuickEdit] Enviando POST para atualizar estoque (Código: ${prod.codigo}) para ${newStock}...`);
                const updateStockRes = await fetch(API_URLS.ORDERS_UPDATE, {
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
                console.log(`[QuickEdit] Estoque atualizado com sucesso.`);
            }

            // Sucesso!
            _closeQuickEditModal();

            // Mensagem de sucesso
            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: "Produto atualizado com sucesso!",
                    duration: 2000,
                    gravity: "top",
                    position: "center",
                    style: { background: "#10b981" }
                }).showToast();
            }

            // 3. Sincronizar o cache frontend global se existir
            if (window._allProducts) {
                const globalProd = window._allProducts.find(p => String(p.id) === String(prod.id) || String(p.codigo) === String(prod.codigo));
                if (globalProd) {
                    if (costChanged) globalProd.preco_de_custo = newCost;
                    if (locChanged) globalProd.localizacao = newLoc;
                    if (stockChanged) globalProd.estoque = newStock;
                }
            }

            // 4. Propagar a atualização visual para outros módulos se estiverem ativos
            if (typeof PesquisarProduto !== 'undefined') {
                if (PesquisarProduto.getSelectedProductCodigo && PesquisarProduto.getSelectedProductCodigo() === prod.codigo) {
                    if (stockChanged && PesquisarProduto.updateStockDisplay) PesquisarProduto.updateStockDisplay(newStock);
                }
                if (costChanged && PesquisarProduto.updateProductCostPriceDisplay) PesquisarProduto.updateProductCostPriceDisplay(prod.id, newCost);
                if (locChanged && PesquisarProduto.updateProductLocationDisplay) PesquisarProduto.updateProductLocationDisplay(prod.id, newLoc);
            }
            if (stockChanged && typeof SaidaItens !== 'undefined' && SaidaItens.updateProductStockInTable) {
                SaidaItens.updateProductStockInTable(prod.codigo, newStock);
            }

            // Atualizar o modal de detalhes do pedido para refletir as mudanças (badges etc)
            if (_currentModalPedidoId) {
                // Pequeno delay para garantir que o cache da API de produtos limpou ou refletiu a mudança
                setTimeout(() => _openOrderDetailsModal(_currentModalPedidoId), 500);
            }

        } catch (error) {
            console.error('[QuickEdit] Erro:', error);
            alert(`Erro ao salvar: ${error.message}`);
            _state.quickEditSaveBtn.disabled = false;
            _state.quickEditLoading.classList.add('hidden');
        }
    }

    // --- LOGICA DE TROCA DE STATUS E NF-E ---

    function _updateModalStatusButtonStyle(val) {
        const btn = document.getElementById('modal-status-dropdown-btn') || _state.modalStatusDropdownBtn;
        if (!btn) return;
        
        // Remove classes antigas de cor e borda
        btn.classList.remove('bg-yellow-100', 'text-yellow-800', 'border-yellow-200', 'bg-yellow-50', 'text-yellow-700',
                          'bg-blue-100', 'text-blue-800', 'border-blue-200', 'bg-blue-50', 'text-blue-700',
                          'bg-green-100', 'text-green-800', 'border-green-200', 'bg-green-50', 'text-green-700',
                          'bg-red-100', 'text-red-800', 'border-red-200', 'bg-red-50', 'text-red-700',
                          'bg-gray-50', 'text-gray-700', 'border-gray-200');

        if (val === "6") { // Em Aberto
            btn.classList.add('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
        } else if (val === "447331") { // Produção
            btn.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-200');
        } else if (val === "9") { // Atendido
            btn.classList.add('bg-green-100', 'text-green-800', 'border-green-200');
        } else if (val === "12") { // Cancelado
            btn.classList.add('bg-red-100', 'text-red-800', 'border-red-200');
        } else {
            btn.classList.add('bg-gray-50', 'text-gray-700', 'border-gray-200');
        }
    }

    async function _handleModalStatusChange(idSituacao, label) {
        const idPedido = _currentModalPedidoId;
        if (!idPedido || !idSituacao) return;

        if (!confirm(`Deseja alterar a situação do pedido para "${label}"?`)) {
            return;
        }

        try {
            if (_state.modalStatusDropdownBtn) _state.modalStatusDropdownBtn.disabled = true;
            if (_state.modalStatusSpinner) _state.modalStatusSpinner.classList.remove('hidden');
            if (_state.modalStatusChevron) _state.modalStatusChevron.classList.add('hidden');
            if (_state.modalStatusCurrentText) {
                _state.modalStatusCurrentText.dataset.originalText = _state.modalStatusCurrentText.innerText;
                _state.modalStatusCurrentText.innerText = 'Alterando...';
            }
            
            _updateModalStatusButtonStyle(idSituacao);
            
            const res = await fetch(`${API_URLS.ORDERS_BLING}/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [idPedido], idSituacao: idSituacao })
            });

            const result = await res.json();

            if (!res.ok || result.status === 'error') {
                throw new Error(result.message || 'Falha ao atualizar status.');
            }

            if (result.status === 'partial_success' && result.data.erros.length > 0) {
                const erro = result.data.erros[0].erro;
                // Se o erro for genérico de situação, vamos dar uma dica melhor para o usuário (ex: Falta de Estoque)
                if (erro.toLowerCase().includes('não foi possível alterar') || erro.toLowerCase().includes('nao foi possivel alterar')) {
                    console.error("Erro no Bling ao alterar situação:", erro);
                    throw new Error(`Bling recusou a mudança. Isso geralmente ocorre por duas razões:\n1. O pedido já está nessa situação.\n2. Falta de Estoque (Se o Bling estiver configurado para baixar estoque ao Atender, ele bloqueia se algum item estiver esgotado).`);
                } else {
                    console.error("Erro no Bling:", erro);
                    throw new Error(`Bling recusou a mudança: ${erro}`);
                }
            }

            // Atualizar localmente o pedido em memória para manter consistência no UI
            const pedido = _allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido) || String(p.número) === String(idPedido));
            if (pedido) {
                if (pedido.situação !== undefined) pedido.situação = label;
                if (pedido.situacao !== undefined) pedido.situacao = label;
            }

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: `Status alterado para ${label}`,
                    duration: 2000,
                    style: { background: "#10b981" }
                }).showToast();
            }

            // Atualizar a tabela ao fundo
            _filterPedidos();

            // Atualizar o modal para refletir a nova situação (badges etc)
            setTimeout(() => _openOrderDetailsModal(idPedido), 500);

        } catch (err) {
            alert('Erro: ' + err.message);
            // Restaurar texto original em caso de erro
            if (_state.modalStatusCurrentText && _state.modalStatusCurrentText.dataset.originalText) {
                _state.modalStatusCurrentText.innerText = _state.modalStatusCurrentText.dataset.originalText;
            }
            _openOrderDetailsModal(idPedido);
        } finally {
            if (_state.modalStatusDropdownBtn) _state.modalStatusDropdownBtn.disabled = false;
            if (_state.modalStatusSpinner) _state.modalStatusSpinner.classList.add('hidden');
            if (_state.modalStatusChevron) _state.modalStatusChevron.classList.remove('hidden');
        }
    }

    window.customConfirm = function(message, title = 'Confirmação', type = 'info') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-confirm-overlay');
            const titleEl = document.getElementById('custom-confirm-title');
            const messageEl = document.getElementById('custom-confirm-message');
            const iconEl = document.getElementById('custom-confirm-icon');
            const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
            const confirmBtn = document.getElementById('custom-confirm-confirm-btn');

            if (!overlay) {
                // Se não achar o HTML, fallback para o nativo
                resolve(window.confirm(message));
                return;
            }

            titleEl.textContent = title;
            messageEl.textContent = message;

            // Configurar tipo (cores e ícone)
            if (type === 'danger' || type === 'warning') {
                confirmBtn.className = 'px-5 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-colors';
                iconEl.innerHTML = '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
            } else {
                confirmBtn.className = 'px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors';
                iconEl.innerHTML = '<svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            }

            // Mostrar modal
            overlay.classList.remove('hidden');

            const cleanup = () => {
                overlay.classList.add('hidden');
                cancelBtn.removeEventListener('click', handleCancel);
                confirmBtn.removeEventListener('click', handleConfirm);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            cancelBtn.addEventListener('click', handleCancel);
            confirmBtn.addEventListener('click', handleConfirm);
        });
    };

    function _printNfeConsoleLog(message, status = 'loading') {
        const detailsDiv = document.getElementById('nfe-emission-details');
        if (!detailsDiv) return;

        let icon = '';
        if (status === 'loading') {
            icon = '<span class="text-yellow-400 animate-pulse">[...]</span>';
        } else if (status === 'success') {
            icon = '<span class="text-green-500 font-bold">[OK]</span>';
        } else if (status === 'error') {
            icon = '<span class="text-red-500 font-bold">[ERRO]</span>';
        } else if (status === 'info') {
            icon = '<span class="text-blue-400 font-bold">[INFO]</span>';
        }

        const logLine = document.createElement('div');
        logLine.className = 'flex space-x-2';
        logLine.innerHTML = `<span>></span><span>${message}</span><span class="ml-auto">${icon}</span>`;
        detailsDiv.appendChild(logLine);
        detailsDiv.scrollTop = detailsDiv.scrollHeight;
        return logLine;
    }

    function _updateNfeConsoleLog(logLineEl, status) {
        if (!logLineEl) return;
        let icon = '';
        if (status === 'success') icon = '<span class="text-green-500 font-bold">[OK]</span>';
        else if (status === 'error') icon = '<span class="text-red-500 font-bold">[ERRO]</span>';
        else if (status === 'loading') icon = '<span class="text-yellow-400 animate-pulse">[...]</span>';
        else if (status === 'info') icon = '<span class="text-blue-400 font-bold">[INFO]</span>';
        
        const lastChild = logLineEl.lastElementChild;
        if (lastChild) lastChild.innerHTML = icon;
    }

    function _pedidoHasService(pedido) {
        if (!pedido) return false;
        if (Array.isArray(pedido.itens)) {
            return pedido.itens.some(i => String(i.codigo || i.sku || i.codigo_produto || '').trim().startsWith('7'));
        }
        const raw = pedido.itens || pedido.Itens || '';
        if (typeof raw === 'string' && raw) {
            if (/\(\s*7[0-9a-zA-Z_-]*/.test(raw)) return true;
            const list = _parseItens(raw, pedido.detalhesProducao || {}, pedido.id || pedido.numero);
            if (list && list.length > 0) {
                return list.some(item => String(item.codigo || '').trim().startsWith('7'));
            }
        }
        return false;
    }
    window._pedidoHasService = _pedidoHasService;

    function _handleEmitirNfs() {
        const orderNumber = _state.currentPedidoBlingBruto?.numero || _currentModalPedidoId || '';

        _showCustomAlert(
            'Emissão de NF-s',
            `Serviços do Pedido Nº ${orderNumber} separados e validados com sucesso!\nA integração de envio da Nota Fiscal de Serviço (NF-s) está preparada para a próxima etapa.`,
            true
        );
    }

    async function _handleEmitirNfe() {
        const idPedido = _currentModalPedidoId;
        if (!idPedido) return;

        // Verificar se já tem nota
        const pedido = _allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido));
        console.log("Pedido para Emissão de NF-e:", pedido);
        const idNotaFromPedido = pedido?.id_nota || pedido?.idNota || pedido?.['id nota'] || pedido?.idnotafiscal || pedido?.id_nota_fiscal || pedido?.['id nota fiscal'] || '';
        const orderNumber = pedido?.numero || pedido?.número || '';

        const nfeVinculada = (window._allNFeData || []).find(n => 
            (n.id_pedido && String(n.id_pedido) === String(idPedido)) || 
            (n.idPedido && String(n.idPedido) === String(idPedido)) ||
            (n.numero_pedido && String(n.numero_pedido) === String(orderNumber)) ||
            (n.id_nota && idNotaFromPedido && String(n.id_nota) === String(idNotaFromPedido))
        );
        
        const idNotaExistente = nfeVinculada?.id || nfeVinculada?.id_nota || nfeVinculada?.numero || idNotaFromPedido;
        
        if (idNotaExistente) {
            _showCustomAlert('Ação não permitida', 'NFe do pedido já emitida, não é possivel emitir outra.', false);
            return;
        }

        const btn = _state.modalEmitirNfeBtn;
        const originalHtml = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 mr-1" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Carregando...`;

            // Buscar os dados completos do pedido para abrir o modal de edição
            const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}`);
            if (!res.ok) {
                const errorResult = await res.json().catch(() => ({}));
                throw new Error(errorResult.message || 'Falha ao buscar dados do pedido no Bling.');
            }
            
            const result = await res.json();
            const pedidoBling = result.data;
            if (!pedidoBling) {
                throw new Error('Os dados do pedido não foram retornados do Bling.');
            }

            console.log("Detalhes do pedido Bling carregados para edição:", pedidoBling);
            _openNfeEditModal(pedidoBling);

        } catch (err) {
            console.error('[EmitirNFe] Erro ao carregar pedido:', err);
            alert('Erro ao carregar dados do pedido: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    function _openNfeEditModal(pedidoBling) {
        if (!_state.nfeEditModal) return;

        // Salva o objeto bruto para envio via PUT no "Salvar Pedido"
        _state.currentPedidoBlingBruto = JSON.parse(JSON.stringify(pedidoBling));

        // Salvar as informações da transportadora do pedido no estado para quando ela for necessária
        _state.nfeEditCurrentTranspId = pedidoBling.transporte?.contato?.id || '';
        _state.nfeEditCurrentTranspNome = pedidoBling.transporte?.contato?.nome || '';
        
        _state.nfeEditCurrentUf = pedidoBling.transporte?.etiqueta?.uf || pedidoBling.contato?.endereco?.geral?.uf || pedidoBling.transporte?.enderecoEntrega?.uf || '';

        // Preencher metadados básicos do cliente
        if (_state.nfeEditContatoId) _state.nfeEditContatoId.value = pedidoBling.contato?.id || '';
        if (_state.nfeEditContatoNome) _state.nfeEditContatoNome.value = pedidoBling.contato?.nome || '';
        if (_state.nfeEditContatoNomeDetalhe) _state.nfeEditContatoNomeDetalhe.value = pedidoBling.contato?.nome || '';
        
        // Resetar campos detalhados para evitar lixo de carregamentos anteriores
        const initialDocClean = (pedidoBling.contato?.numeroDocumento || '').replace(/\D/g, '');
        const initialTipo = pedidoBling.contato?.tipoPessoa || (initialDocClean.length === 11 ? 'F' : 'J');
        if (_state.nfeEditContatoFantasia) _state.nfeEditContatoFantasia.value = '';
        if (_state.nfeEditContatoTipo) _state.nfeEditContatoTipo.value = initialTipo;
        if (_state.nfeEditContatoCnpj) _state.nfeEditContatoCnpj.value = pedidoBling.contato?.numeroDocumento || '';
        if (_state.nfeEditContatoIe) _state.nfeEditContatoIe.value = pedidoBling.contato?.ie || '';
        if (_state.nfeEditContatoContribuinte) _state.nfeEditContatoContribuinte.value = initialTipo === 'F' ? '9' : '9';
        
        // Esconder detalhes do cliente por padrão ao abrir
        if (_state.nfeEditClientDetails) _state.nfeEditClientDetails.classList.add('hidden');
        if (_state.nfeEditClientToggleChevron) _state.nfeEditClientToggleChevron.classList.remove('rotate-180');

        _updateIeWarning();

        // Carregar detalhes cadastrais do cliente em background
        if (pedidoBling.contato?.id) {
            fetch(`${API_URLS.ORDERS_BLING}/contatos/${pedidoBling.contato.id}`)
                .then(res => res.json())
                .then(result => {
                    const c = result.data;
                    if (c && String(c.id) === String(_state.nfeEditContatoId.value)) {
                        if (_state.nfeEditContatoNome) _state.nfeEditContatoNome.value = c.nome || '';
                        if (_state.nfeEditContatoNomeDetalhe) _state.nfeEditContatoNomeDetalhe.value = c.nome || '';
                        if (_state.nfeEditContatoFantasia) _state.nfeEditContatoFantasia.value = c.fantasia || '';
                        const docClean = (c.numeroDocumento || '').replace(/\D/g, '');
                        const tipoCalculado = c.tipoPessoa || (docClean.length === 11 ? 'F' : 'J');
                        if (_state.nfeEditContatoTipo) _state.nfeEditContatoTipo.value = tipoCalculado;
                        if (_state.nfeEditContatoCnpj) _state.nfeEditContatoCnpj.value = c.numeroDocumento || '';
                        if (_state.nfeEditContatoIe) _state.nfeEditContatoIe.value = c.ie || '';
                        if (_state.nfeEditContatoContribuinte) {
                            _state.nfeEditContatoContribuinte.value = c.indicadorIe !== undefined ? c.indicadorIe : (tipoCalculado === 'F' ? 9 : 9);
                        }
                        
                        _state.nfeEditCurrentContatoBruto = JSON.parse(JSON.stringify(c));
                        _state.nfeEditCurrentUf = c.endereco?.geral?.uf || c.enderecoGeral?.uf || c.enderecoCobranca?.uf || _state.nfeEditCurrentUf;
                        
                        _updateIeWarning();
                    }
                })
                .catch(err => {
                    console.warn('[NFe Edit] Não foi possível carregar os detalhes cadastrais do contato.', err);
                });
        }
        
        // Buscar natureza de operação (se estiver na raiz ou no primeiro item)
        let naturezaId = '';
        if (pedidoBling.naturezaOperacao?.id) {
            naturezaId = pedidoBling.naturezaOperacao.id;
        } else if (pedidoBling.itens && Array.isArray(pedidoBling.itens)) {
            const itemComNat = pedidoBling.itens.find(item => item.naturezaOperacao && item.naturezaOperacao.id);
            if (itemComNat) {
                naturezaId = itemComNat.naturezaOperacao.id;
            }
        }
        if (_state.nfeEditNaturezaId) {
            const selectEl = _state.nfeEditNaturezaId;
            // Remove previous custom option if any exists
            const customOption = selectEl.querySelector('option[data-custom="true"]');
            if (customOption) customOption.remove();

            const targetVal = String(naturezaId || '15107272436').trim();
            if (targetVal && targetVal !== '15107272436' && targetVal !== '15107272437') {
                const opt = document.createElement('option');
                opt.value = targetVal;
                opt.textContent = `Outra (${targetVal})`;
                opt.setAttribute('data-custom', 'true');
                selectEl.appendChild(opt);
            }
            selectEl.value = targetVal;
        }
        
        const defaultDate = new Date().toISOString().substring(0, 10);
        if (_state.nfeEditData) _state.nfeEditData.value = defaultDate;
        if (_state.nfeEditDataSaida) _state.nfeEditDataSaida.value = defaultDate;
        if (_state.nfeEditDataPrevista) _state.nfeEditDataPrevista.value = defaultDate;
        
        _updateAllDateWarnings();
        if (_state.nfeEditObservacoesOriginal) _state.nfeEditObservacoesOriginal.value = pedidoBling.observacoes || '';
        
        let obsVal = pedidoBling.observacoes || '';
        let vendedorVal = '';
        if (pedidoBling.vendedor) {
            if (typeof pedidoBling.vendedor === 'object') {
                if (pedidoBling.vendedor.nome && typeof pedidoBling.vendedor.nome === 'string' && pedidoBling.vendedor.nome.trim()) {
                    vendedorVal = pedidoBling.vendedor.nome.trim();
                } else if (pedidoBling.vendedor.id && pedidoBling.vendedor.id !== 0 && pedidoBling.vendedor.id !== '0') {
                    vendedorVal = pedidoBling.vendedor.id;
                }
            } else {
                vendedorVal = pedidoBling.vendedor;
            }
        }
        
        const localPedido = _allPedidos.find(p => String(p.id) === String(_currentModalPedidoId) || String(p.numero) === String(_currentModalPedidoId) || String(p.id_pedido) === String(_currentModalPedidoId) || (pedidoBling.numero && String(p.numero) === String(pedidoBling.numero)));
        const orcamentoVal = localPedido ? (localPedido.orcamento || localPedido.orçamento || '') : '';
        let vendedorNome = _getVendedorName(vendedorVal);
        
        if (!vendedorNome || vendedorNome === '-') {
            if (localPedido && localPedido.vendedor) {
                vendedorNome = _getVendedorName(localPedido.vendedor);
            }
        }

        const isEcommerce = (localPedido && (
            String(localPedido.loja || '').toLowerCase().includes('loja integrada') ||
            String(localPedido.vendedor || '').toLowerCase().includes('commerce') ||
            String(localPedido.numero_loja || '').trim() !== ''
        )) || (pedidoBling.loja && (
            String(pedidoBling.loja.id) === '205371925' ||
            String(pedidoBling.loja.nome || '').toLowerCase().includes('loja integrada')
        )) || (pedidoBling.numeroLoja && String(pedidoBling.numeroLoja).trim() !== '');

        if (isEcommerce && (!vendedorNome || vendedorNome === '-')) {
            vendedorNome = 'E-Commerce';
        }

        const pagamentoTexto = _extractPagamentoInfo(pedidoBling, isEcommerce);

        if (obsVal.includes('[object Object]')) {
            obsVal = obsVal.replace(/\[object Object\]/g, (vendedorNome && vendedorNome !== '-') ? vendedorNome : 'E-Commerce');
        }

        // Reposiciona ou insere "Pagamento:" exatamente acima de "Vendedor:"
        if (pagamentoTexto) {
            obsVal = obsVal.replace(/Pagamento:\s*[^\n]+(\r?\n)?/gi, '').trim();
            if (/Vendedor:\s*[^\n]+/i.test(obsVal)) {
                obsVal = obsVal.replace(/(Vendedor:\s*[^\n]+)/i, `Pagamento: ${pagamentoTexto}\n$1`);
            }
        }
        
        let appendText = '';
        if (orcamentoVal && String(orcamentoVal).trim() !== '-' && String(orcamentoVal).trim() !== '0') {
            if (!obsVal.includes('Orçamento:')) {
                appendText += `Orçamento: ${String(orcamentoVal).trim()}\n`;
            }
        }
        if (pagamentoTexto && !obsVal.includes('Pagamento:')) {
            appendText += `Pagamento: ${pagamentoTexto}\n`;
        }
        if (vendedorNome && vendedorNome !== '-' && !obsVal.includes('Vendedor:')) {
            appendText += `Vendedor: ${vendedorNome}`;
        }
        appendText = appendText.trim();
        
        if (appendText) {
            obsVal = obsVal.trim();
            if (!obsVal.includes(appendText)) {
                if (obsVal) {
                    obsVal += `\n\n${appendText}`;
                } else {
                    obsVal = appendText;
                }
            }
        }
        if (_state.nfeEditObservacoes) _state.nfeEditObservacoes.value = obsVal;

        // Transporte e valores (a transportadora é setada pelo _loadTransportadoras de forma assíncrona)
        if (_state.nfeEditFrete) {
            const num = parseFloat(pedidoBling.transporte?.frete) || 0;
            _state.nfeEditFrete.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        }
        if (_state.nfeEditFretePorConta) {
            const currentFreteConta = pedidoBling.transporte?.fretePorConta !== undefined && pedidoBling.transporte?.fretePorConta !== null ? parseInt(pedidoBling.transporte.fretePorConta) : 9;
            _state.nfeEditFretePorConta.value = currentFreteConta;
        }
        if (_state.nfeEditVolumes) _state.nfeEditVolumes.value = pedidoBling.transporte?.quantidadeVolumes || 0;
        if (_state.nfeEditPesoBruto) _state.nfeEditPesoBruto.value = pedidoBling.transporte?.pesoBruto || 0;
        if (_state.nfeEditPesoLiquido) _state.nfeEditPesoLiquido.value = pedidoBling.transporte?.pesoLiquido || pedidoBling.transporte?.pesoBruto || 0;
        if (_state.nfeEditDesconto) {
            const num = parseFloat(pedidoBling.desconto?.valor) || 0;
            _state.nfeEditDesconto.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        }
        if (_state.nfeEditOutrasDespesas) {
            const num = pedidoBling.outrasDespesas ? parseFloat(pedidoBling.outrasDespesas) : 0;
            _state.nfeEditOutrasDespesas.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        }

        // Limpar e carregar itens
        if (_state.nfeEditItensTbody) {
            _state.nfeEditItensTbody.innerHTML = '';
            if (pedidoBling.itens && Array.isArray(pedidoBling.itens)) {
                pedidoBling.itens.forEach(item => {
                    _addNfeEditItemRow(item);
                });
            }
        }

        // Limpar e carregar parcelas
        if (_state.nfeEditParcelasTbody) {
            _state.nfeEditParcelasTbody.innerHTML = '';
            if (pedidoBling.parcelas && Array.isArray(pedidoBling.parcelas)) {
                pedidoBling.parcelas.forEach(p => {
                    _addNfeEditParcelaRow(p);
                });
            }
        }

        // Botão de ajuste de parcelas: sempre visível
        // Quando encontra condições nas observações mostra com destaque pulsante,
        // caso contrário fica disponível para ajustar manualmente (1x à vista).
        if (_state.nfeEditAutoParcelasBtn) {
            _state.nfeEditAutoParcelasBtn.classList.remove('hidden');
            const hasCond = _parseDaysFromObservacoes(pedidoBling.observacoes || '');
            const svgEl = _state.nfeEditAutoParcelasBtn.querySelector('svg');
            if (hasCond) {
                // Condição detectada: destaque pulsante
                if (svgEl) svgEl.classList.add('animate-pulse');
                _state.nfeEditAutoParcelasBtn.title = 'Condições de pagamento detectadas. Clique para ajustar parcelas automaticamente.';
            } else {
                // Sem condição: botão disponível mas sem pulsar
                if (svgEl) svgEl.classList.remove('animate-pulse');
                _state.nfeEditAutoParcelasBtn.title = 'Clique para ajustar como 1 parcela à vista (data atual).';
            }
        }

        // Detectar se o pedido possui serviços (código iniciado com 7)
        const serviceItems = (pedidoBling.itens || []).filter(item => {
            const cod = String(item.codigo || item.sku || '').trim();
            return cod.startsWith('7');
        });
        const hasService = serviceItems.length > 0;

        if (_state.nfeModeNfsBtn) {
            if (hasService) {
                _state.nfeModeNfsBtn.disabled = false;
                _state.nfeModeNfsBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                _state.nfeModeNfsBtn.classList.add('cursor-pointer');
                _state.nfeModeNfsBtn.title = `Pedido possui ${serviceItems.length} serviço(s) para emissão de NF-s`;
                if (_state.nfeModeNfsBadge) {
                    _state.nfeModeNfsBadge.textContent = `${serviceItems.length}`;
                    _state.nfeModeNfsBadge.classList.remove('hidden');
                }
            } else {
                _state.nfeModeNfsBtn.disabled = true;
                _state.nfeModeNfsBtn.classList.add('opacity-40', 'cursor-not-allowed');
                _state.nfeModeNfsBtn.classList.remove('cursor-pointer');
                _state.nfeModeNfsBtn.title = 'Este pedido não possui serviços (código iniciado em 7)';
                if (_state.nfeModeNfsBadge) {
                    _state.nfeModeNfsBadge.classList.add('hidden');
                }
            }
        }

        // Preencher a aba NF-s com os serviços identificados
        _populateNfsView(pedidoBling, serviceItems);

        // Sempre inicializar exibindo a tela padrão de NF-e
        _switchNfeEditMode('nfe');

        // Exibir o modal
        _updateFreteFields(); // Aplica visibilidade inicial dos campos de transporte
        _updateVolumesWarning(); // Aplica estado inicial do warning de volumes
        _calculateTotals(); // Calcula totais iniciais
        _state.nfeEditModal.classList.remove('hidden');
    }

    function _switchNfeEditMode(mode) {
        _state.currentNfeEditMode = mode;
        if (mode === 'nfs') {
            if (_state.nfeEditViewNfe) _state.nfeEditViewNfe.classList.add('hidden');
            if (_state.nfeEditViewNfs) _state.nfeEditViewNfs.classList.remove('hidden');
            if (_state.nfeFooterActions) _state.nfeFooterActions.classList.add('hidden');
            if (_state.nfsFooterActions) _state.nfsFooterActions.classList.remove('hidden');

            if (_state.nfeModeNfeBtn) {
                _state.nfeModeNfeBtn.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold transition-all text-gray-600 hover:text-gray-900 bg-transparent flex items-center gap-1.5 cursor-pointer';
            }
            if (_state.nfeModeNfsBtn) {
                _state.nfeModeNfsBtn.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm bg-purple-600 text-white flex items-center gap-1.5 cursor-pointer';
            }
        } else {
            if (_state.nfeEditViewNfe) _state.nfeEditViewNfe.classList.remove('hidden');
            if (_state.nfeEditViewNfs) _state.nfeEditViewNfs.classList.add('hidden');
            if (_state.nfeFooterActions) _state.nfeFooterActions.classList.remove('hidden');
            if (_state.nfsFooterActions) _state.nfsFooterActions.classList.add('hidden');

            if (_state.nfeModeNfeBtn) {
                _state.nfeModeNfeBtn.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm bg-blue-600 text-white flex items-center gap-1.5 cursor-pointer';
            }
            if (_state.nfeModeNfsBtn) {
                const hasDisabled = _state.nfeModeNfsBtn.disabled;
                _state.nfeModeNfsBtn.className = `px-3.5 py-1.5 rounded-md text-xs font-bold transition-all text-gray-600 hover:text-gray-900 bg-transparent flex items-center gap-1.5 ${hasDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`;
            }
        }
    }

    function _populateNfsView(pedidoBling, serviceItems) {
        if (_state.nfsEditClienteNome) {
            _state.nfsEditClienteNome.value = pedidoBling.contato?.nome || '';
        }
        if (_state.nfsEditClienteDoc) {
            _state.nfsEditClienteDoc.value = pedidoBling.contato?.numeroDocumento || '';
        }
        if (_state.nfsEditClienteCidadeUf) {
            const cidade = pedidoBling.contato?.endereco?.geral?.municipio || pedidoBling.transporte?.etiqueta?.municipio || '';
            const uf = pedidoBling.contato?.endereco?.geral?.uf || pedidoBling.transporte?.etiqueta?.uf || '';
            _state.nfsEditClienteCidadeUf.value = cidade ? (uf ? `${cidade} - ${uf}` : cidade) : uf;
        }
        if (_state.nfsEditCountBadge) {
            _state.nfsEditCountBadge.textContent = `${serviceItems.length} serviço${serviceItems.length > 1 ? 's' : ''}`;
        }

        if (_state.nfsEditItensTbody) {
            _state.nfsEditItensTbody.innerHTML = '';
            let totalServ = 0;
            const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            if (serviceItems.length === 0) {
                _state.nfsEditItensTbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-4 py-8 text-center text-gray-400">
                            Nenhum item de serviço (código iniciado em 7) encontrado neste pedido.
                        </td>
                    </tr>
                `;
            } else {
                serviceItems.forEach(item => {
                    const qtd = parseFloat(item.quantidade) || 0;
                    const valor = parseFloat(item.valor) || 0;
                    const total = qtd * valor;
                    totalServ += total;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-3 font-mono text-xs font-semibold text-purple-700 bg-purple-50/50">
                            ${item.codigo || item.sku || '-'}
                        </td>
                        <td class="px-4 py-3 font-medium text-gray-800">
                            ${item.descricao || '-'}
                        </td>
                        <td class="px-4 py-3 text-center text-gray-700 font-semibold">
                            ${qtd}
                        </td>
                        <td class="px-4 py-3 text-right text-gray-700">
                            ${formatter.format(valor)}
                        </td>
                        <td class="px-4 py-3 text-right font-bold text-gray-900">
                            ${formatter.format(total)}
                        </td>
                    `;
                    _state.nfsEditItensTbody.appendChild(tr);
                });
            }

            if (_state.nfsEditTotalServicos) {
                _state.nfsEditTotalServicos.textContent = formatter.format(totalServ);
            }
        }

        if (_state.nfsEditObservacoes) {
            const descricoes = serviceItems.map(i => `${i.descricao} (Qtd: ${i.quantidade})`).join('; ');
            _state.nfsEditObservacoes.value = descricoes ? `Prestação de serviços: ${descricoes}` : '';
        }
    }

    function _addNfeEditItemRow(item = {}) {
        if (!_state.nfeEditItensTbody) return;

        const tr = document.createElement('tr');
        tr.className = 'nfe-edit-item-row';
        if (item.id) tr.dataset.itemId = item.id; // NOVO: Armazena o ID interno do item

        let itemPeso = item.pesoBruto !== undefined ? item.pesoBruto : (item.peso !== undefined ? item.peso : null);
        
        // Se a venda não trouxe o peso, tentamos buscar do cadastro de produtos carregado globalmente
        if (!itemPeso || itemPeso === 0) {
            if (window._allProducts) {
                const prod = window._allProducts.find(p => String(p.id) === String(item.produto?.id || item.id) || String(p.codigo) === String(item.codigo));
                if (prod) {
                    console.log(`[DEBUG Peso] Produto ${prod.codigo} encontrado no _allProducts:`, prod);
                    itemPeso = parseFloat(prod.pesoBruto) || parseFloat(prod.pesoLiquido) || 
                               parseFloat(prod.metricas?.peso_bruto) || parseFloat(prod.metricas?.peso_liquido) || 0;
                } else {
                    console.warn(`[DEBUG Peso] Produto NÃO encontrado no _allProducts! Procurado: ID ${item.produto?.id || item.id} / Codigo ${item.codigo}`);
                }
            } else {
                console.warn(`[DEBUG Peso] window._allProducts não existe no momento!`);
            }
        }
        if (!itemPeso) itemPeso = 0;
        
        tr.innerHTML = `
            <td class="px-4 py-2">
                <input type="text" class="nfe-edit-item-codigo w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" value="${item.codigo || ''}">
            </td>
            <td class="px-4 py-2">
                <input type="text" class="nfe-edit-item-descricao w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" value="${item.descricao || ''}">
            </td>
            <td class="px-4 py-2 text-center">
                <input type="number" step="1" min="1" class="nfe-edit-item-quantidade w-full px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500" value="${item.quantidade || 1}">
            </td>
            <td class="px-4 py-2">
                <div class="flex items-center gap-2 justify-center">
                    <input type="text" class="nfe-edit-item-peso w-20 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500" value="${itemPeso}">
                    <button type="button" class="nfe-edit-item-sync-peso-btn flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 bg-white rounded shadow-sm border border-gray-200 hidden transition-all" title="Salvar novo peso no cadastro do produto" data-original-peso="${itemPeso}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                    </button>
                </div>
            </td>
            <td class="px-4 py-2 text-right">
                <input type="text" class="nfe-edit-item-valor w-full px-2 py-1 text-sm border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500" value="${item.valor || 0}">
            </td>
            <td class="px-4 py-2 text-right text-gray-700 font-medium">
                <span class="nfe-edit-item-subtotal">R$ 0,00</span>
            </td>
            <td class="px-4 py-2 text-center">
                <button type="button" class="text-red-500 hover:text-red-700 p-1 delete-item-row-btn transition-colors">
                    <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;

        tr.querySelector('.delete-item-row-btn').addEventListener('click', () => {
            tr.remove();
            _calculateTotals();
        });
        
        const valorInput = tr.querySelector('.nfe-edit-item-valor');
        if (valorInput) {
            _formatCurrencyInput(valorInput);
            valorInput.addEventListener('input', _calculateTotals);
        }
        
        const qtdInput = tr.querySelector('.nfe-edit-item-quantidade');
        if (qtdInput) qtdInput.addEventListener('input', _calculateTotals);

        const pesoInput = tr.querySelector('.nfe-edit-item-peso');
        if (pesoInput) _formatWeightInput(pesoInput);
        const syncPesoBtn = tr.querySelector('.nfe-edit-item-sync-peso-btn');
        if (pesoInput && syncPesoBtn) {
            pesoInput.addEventListener('input', () => {
                const originalPeso = parseFloat(syncPesoBtn.dataset.originalPeso) || 0;
                const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;
                if (currentPeso !== originalPeso) {
                    syncPesoBtn.classList.remove('hidden');
                } else {
                    syncPesoBtn.classList.add('hidden');
                }
            });

            syncPesoBtn.addEventListener('click', async () => {
                const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;
                const originalBtnHtml = syncPesoBtn.innerHTML;
                
                syncPesoBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                syncPesoBtn.disabled = true;

                try {
                    let productIdToUpdate = null;
                    if (window._allProducts) {
                        const p = window._allProducts.find(x => String(x.codigo) === String(item.codigo));
                        if (p) productIdToUpdate = p.id;
                    }

                    if (productIdToUpdate) {
                        await fetch(`${API_URLS.PRODUCTS}/${productIdToUpdate}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ peso_bruto: currentPeso, peso_liquido: currentPeso })
                        });
                        
                        if (window._allProducts) {
                            const p = window._allProducts.find(x => String(x.id) === String(productIdToUpdate));
                            if (p) {
                                p.pesoBruto = currentPeso;
                                p.pesoLiq = currentPeso;
                                if (!p.metricas) p.metricas = {};
                                p.metricas.peso_bruto = currentPeso;
                                p.metricas.peso_liquido = currentPeso;
                            }
                        }
                        if (typeof PesquisarProduto !== 'undefined') {
                            PesquisarProduto.updateProductWeightDisplay(productIdToUpdate, currentPeso, currentPeso);
                        }

                        syncPesoBtn.dataset.originalPeso = currentPeso;
                        syncPesoBtn.innerHTML = `<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                        setTimeout(() => {
                            syncPesoBtn.classList.add('hidden');
                            syncPesoBtn.innerHTML = originalBtnHtml;
                            syncPesoBtn.disabled = false;
                        }, 1500);

                    } else {
                        alert(`Produto ${item.codigo} não encontrado no catálogo local.`);
                        syncPesoBtn.innerHTML = originalBtnHtml;
                        syncPesoBtn.disabled = false;
                    }
                } catch (e) {
                    console.error("Erro ao sincronizar peso", e);
                    alert("Erro ao sincronizar peso: " + e.message);
                    syncPesoBtn.innerHTML = originalBtnHtml;
                    syncPesoBtn.disabled = false;
                }
            });
        }

        const codigoInput = tr.querySelector('.nfe-edit-item-codigo');
        if (codigoInput) codigoInput.addEventListener('input', _calculateTotals);

        _state.nfeEditItensTbody.appendChild(tr);
        _calculateTotals();
    }

    function _addNfeEditParcelaRow(parcela = {}) {
        if (!_state.nfeEditParcelasTbody) return;

        const tr = document.createElement('tr');
        tr.className = 'nfe-edit-parcela-row';

        let dataVenc = '';
        if (parcela.dataVencimento) {
            dataVenc = parcela.dataVencimento.substring(0, 10);
        } else {
            const dateInput = _state.nfeEditData;
            dataVenc = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().substring(0, 10);
        }

        tr.innerHTML = `
            <td class="px-4 py-2">
                <input type="date" class="nfe-edit-parcela-data w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" value="${dataVenc}">
            </td>
            <td class="px-4 py-2">
                <input type="text" class="nfe-edit-parcela-valor w-full px-2 py-1 text-sm border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500" value="${parcela.valor || 0}">
            </td>
            <td class="px-4 py-2">
                <select class="nfe-edit-parcela-forma-id w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white">
                    ${_buildFormasPagamentoOptions(parcela.formaPagamento?.id || '')}
                </select>
            </td>
            <td class="px-4 py-2">
                <input type="text" class="nfe-edit-parcela-obs w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" value="${parcela.observacoes || ''}" placeholder="Opcional">
            </td>
            <td class="px-4 py-2 text-center">
                <button type="button" class="text-red-500 hover:text-red-700 p-1 delete-parcela-row-btn transition-colors">
                    <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;

        tr.querySelector('.delete-parcela-row-btn').addEventListener('click', () => tr.remove());
        
        const valorInput = tr.querySelector('.nfe-edit-parcela-valor');
        if (valorInput) {
            _formatCurrencyInput(valorInput);
        }

        _state.nfeEditParcelasTbody.appendChild(tr);
    }

    function _closeNfeEditModal() {
        if (_state.nfeEditModal) {
            _state.nfeEditModal.classList.add('hidden');
        }
        _state.currentPedidoBlingBruto = null;
        if (_state.nfeEditTransportadora) {
            _state.nfeEditTransportadora.selectedIndex = 0;
            _state.nfeEditTransportadora.value = '';
        }
        _state.nfeEditCurrentTranspId = '';
        _state.nfeEditCurrentTranspNome = '';
    }

    async function _handleConsultarCnpj() {
        const btn = document.getElementById('nfe-edit-consultar-cnpj-btn');
        const cnpjInput = _state.nfeEditContatoCnpj;
        if (!cnpjInput || !btn) return;

        let doc = cnpjInput.value.replace(/\D/g, '');
        if (doc.length === 11) {
            // Se for CPF (11 dígitos), ajusta automaticamente o Tipo para Pessoa Física e Contribuinte para Não Contribuinte
            if (_state.nfeEditContatoTipo) {
                _state.nfeEditContatoTipo.value = 'F';
            }
            if (_state.nfeEditContatoContribuinte) {
                _state.nfeEditContatoContribuinte.value = '9'; // Não contribuinte
            }
            if (_state.nfeEditContatoIe && !_state.nfeEditContatoIe.value.trim()) {
                _state.nfeEditContatoIe.value = '';
            }
            _updateIeWarning();

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: "👤 CPF detectado! Tipo da Pessoa alterado para 'Pessoa Física' e Contribuinte para 'Não Contribuinte'.",
                    duration: 4000,
                    gravity: "top",
                    position: "center",
                    style: { background: "#2563eb" }
                }).showToast();
            } else {
                alert("Você digitou um CPF (11 dígitos).\n\nO Tipo da Pessoa foi alterado automaticamente para 'Pessoa Física' e Contribuinte para 'Não Contribuinte'.\n\n(A busca automática de Inscrição Estadual na SEFAZ aplica-se apenas a empresas com CNPJ).");
            }
            return;
        }

        if (doc.length !== 14) {
            alert("Por favor, informe um CNPJ válido com 14 dígitos ou CPF com 11 dígitos para verificação.");
            return;
        }

        // Se for CNPJ (14 dígitos), garante que o Tipo seja Pessoa Jurídica
        if (_state.nfeEditContatoTipo) {
            _state.nfeEditContatoTipo.value = 'J';
        }

        let cnpj = doc;

        const originalHtml = btn.innerHTML;
        try {
            btn.innerHTML = `<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;

            const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error("Limite de consultas excedido (máximo 3 por minuto na API gratuita). Tente novamente em alguns instantes.");
                }
                throw new Error("Não foi possível consultar os dados. O CNPJ pode ser inválido.");
            }

            const data = await res.json();
            
            // Removemos a atualização do Nome e Fantasia a pedido do usuário
            // Apenas adiciona a IE sem mexer no que veio do Bling

            // Trata Inscrição Estadual (IE)
            let ieEncontrada = '';
            if (data.estabelecimento?.inscricoes_estaduais && data.estabelecimento.inscricoes_estaduais.length > 0) {
                const targetUf = String(_state.nfeEditCurrentUf || '').trim().toUpperCase();
                // Procura IE ativa no estado de destino (UF) do pedido
                let ieAtiva = data.estabelecimento.inscricoes_estaduais.find(ie => {
                    const ieUf = String(ie.estado?.sigla || '').trim().toUpperCase();
                    return ie.ativo === true && ieUf === targetUf && targetUf !== '';
                });
                // Se não achar no UF de destino, pega a primeira ativa
                if (!ieAtiva) {
                    ieAtiva = data.estabelecimento.inscricoes_estaduais.find(ie => ie.ativo === true);
                }
                if (ieAtiva && ieAtiva.inscricao_estadual) {
                    ieEncontrada = ieAtiva.inscricao_estadual.replace(/\D/g, '');
                }
            }

            if (_state.nfeEditContatoIe) {
                _state.nfeEditContatoIe.value = ieEncontrada;
                // Atualiza contribuinte baseado na IE
                if (_state.nfeEditContatoContribuinte) {
                    if (ieEncontrada.toLowerCase() === 'isento') {
                        _state.nfeEditContatoContribuinte.value = '2'; // Isento
                    } else if (ieEncontrada !== '') {
                        _state.nfeEditContatoContribuinte.value = '1'; // Contribuinte
                    } else {
                        _state.nfeEditContatoContribuinte.value = '9'; // Não contribuinte
                    }
                }
            }

            _updateIeWarning();
            
            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: `✅ CNPJ consultado com sucesso!`,
                    duration: 2500,
                    gravity: "top",
                    position: "center",
                    style: { background: "#10b981" }
                }).showToast();
            }

        } catch (err) {
            alert(err.message);
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    function _updateIeWarning() {
        if (!_state.nfeEditContatoIe || !_state.nfeEditIeWarning) return;
        const tipoPessoa = _state.nfeEditContatoTipo ? _state.nfeEditContatoTipo.value : 'J';
        const ieVal = _state.nfeEditContatoIe.value.trim();
        // Pessoa Física ('F') não necessita de Inscrição Estadual, portanto não deve exibir aviso de IE não preenchida
        if (tipoPessoa === 'F' || ieVal) {
            _state.nfeEditIeWarning.classList.add('hidden');
        } else {
            _state.nfeEditIeWarning.classList.remove('hidden');
        }
    }

    function _updateDateWarning(inputEl, warningEl) {
        if (!inputEl || !warningEl) return;
        const val = inputEl.value.trim();
        if (!val) {
            warningEl.classList.add('hidden');
            return;
        }
        
        const parts = val.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed
            
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            
            if (year !== currentYear || month !== currentMonth) {
                warningEl.classList.remove('hidden');
            } else {
                warningEl.classList.add('hidden');
            }
        } else {
            warningEl.classList.add('hidden');
        }
    }

    function _updateAllDateWarnings() {
        _updateDateWarning(_state.nfeEditData, _state.nfeEditDataWarning);
        _updateDateWarning(_state.nfeEditDataSaida, _state.nfeEditDataSaidaWarning);
        _updateDateWarning(_state.nfeEditDataPrevista, _state.nfeEditDataPrevistaWarning);
    }

    async function _loadNfeTransportadorasBling(selectIdBling, selectNomeBling) {
        if (!_state.nfeEditTransportadora) return;
        
        function setValue(id, nome) {
            if (id && Array.from(_state.nfeEditTransportadora.options).some(o => o.value === String(id))) {
                _state.nfeEditTransportadora.value = String(id);
            } else if (nome) {
                const opt = Array.from(_state.nfeEditTransportadora.options).find(o => o.text.toUpperCase() === String(nome).toUpperCase() || o.getAttribute('data-nome')?.toUpperCase() === String(nome).toUpperCase());
                if (opt) {
                    _state.nfeEditTransportadora.value = opt.value;
                } else {
                    _state.nfeEditTransportadora.value = '';
                }
            } else {
                _state.nfeEditTransportadora.value = '';
            }
        }

        if (_state.transportadorasLoaded) {
            setValue(selectIdBling, selectNomeBling);
            return;
        }

        try {
            _state.nfeEditTransportadora.innerHTML = '<option value="">Carregando...</option>';
            // idTipoContato=14578222406 = Transportadoras
            const res = await fetch(`${API_URLS.ORDERS_BLING}/contatos?idTipoContato=14578222406`);
            if (res.ok) {
                const result = await res.json();
                const contatos = result.data || [];
                
                let html = '<option value="">Selecione a Transportadora</option>';
                contatos.forEach(c => {
                    html += `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`;
                });
                _state.nfeEditTransportadora.innerHTML = html;
                _state.transportadorasLoaded = true;
                setValue(selectIdBling, selectNomeBling);
            } else {
                _state.nfeEditTransportadora.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        } catch (e) {
            console.error('Erro ao buscar transportadoras:', e);
            _state.nfeEditTransportadora.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    // Mostra/oculta campos de transporte baseado no "Frete por Conta"
    function _updateFreteFields() {
        const semTransporte = _state.nfeEditFretePorConta && parseInt(_state.nfeEditFretePorConta.value) === 9;
        
        if (_state.nfeEditTransportadoraContainer) {
            _state.nfeEditTransportadoraContainer.classList.toggle('hidden', semTransporte);
            
            // Se for necessário mostrar a transportadora e ela ainda não foi carregada, carregue agora
            if (!semTransporte && !_state.transportadorasLoaded) {
                _loadNfeTransportadorasBling(_state.nfeEditCurrentTranspId, _state.nfeEditCurrentTranspNome);
            }
        }

        const containers = [
            _state.nfeEditVolumesContainer,
            _state.nfeEditPesoBrutoContainer,
            _state.nfeEditPesoLiquidoContainer
        ];
        containers.forEach(c => {
            if (c) {
                if (semTransporte) {
                    c.classList.add('hidden');
                } else {
                    c.classList.remove('hidden');
                }
            }
        });
        // Atualiza o warning de volumes também
        _updateVolumesWarning();
        
        // Recalcula totais (pois o frete e desconto podem ter sumido/aparecido)
        if (typeof _calculateTotals === 'function') {
            _calculateTotals();
        }
    }

    // Mostra/oculta warning em Volumes quando há frete mas volumes não preenchido
    function _updateVolumesWarning() {
        const semTransporte = _state.nfeEditFretePorConta && parseInt(_state.nfeEditFretePorConta.value) === 9;
        if (semTransporte) {
            if (_state.nfeEditVolumesWarning) _state.nfeEditVolumesWarning.classList.add('hidden');
            return;
        }
        // Detectar valor do frete
        let freteVal = 0;
        if (_state.nfeEditFrete) {
            const raw = _state.nfeEditFrete.value.replace(/[^\d,]/g, '').replace(',', '.');
            freteVal = parseFloat(raw) || 0;
        }
        const volumes = parseInt(_state.nfeEditVolumes?.value) || 0;
        // Mostrar warning se tem frete mas volumes zerado/vazio
        if (_state.nfeEditVolumesWarning) {
            if (freteVal > 0 && volumes <= 0) {
                _state.nfeEditVolumesWarning.classList.remove('hidden');
            } else {
                _state.nfeEditVolumesWarning.classList.add('hidden');
            }
        }
    }

    function _calculateTotals() {
        if (!_state.nfeEditItensTbody) return;

        const rows = _state.nfeEditItensTbody.querySelectorAll('.nfe-edit-item-row');
        let totalPecas = 0;
        let totalServicos = 0;

        rows.forEach(row => {
            const codigoInput = row.querySelector('.nfe-edit-item-codigo');
            const qtdInput = row.querySelector('.nfe-edit-item-quantidade');
            const valorInput = row.querySelector('.nfe-edit-item-valor');

            if (codigoInput && qtdInput && valorInput) {
                const codigo = codigoInput.value.trim();
                const qtd = parseFloat(qtdInput.value) || 0;
                
                // Extrai valor monetário
                let valorStr = valorInput.value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                const valor = parseFloat(valorStr) || 0;

                const subtotal = qtd * valor;
                
                // Atualiza o texto do subtotal na linha
                const subtotalSpan = row.querySelector('.nfe-edit-item-subtotal');
                if (subtotalSpan) {
                    subtotalSpan.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal);
                }

                if (codigo.startsWith('7')) {
                    totalServicos += subtotal;
                } else if (codigo.startsWith('5') || codigo.startsWith('6')) {
                    totalPecas += subtotal;
                } else {
                    // Outros códigos também tratamos como peças por padrão
                    totalPecas += subtotal;
                }
            }
        });

        // Pegar frete e desconto (sempre pega, independente de semTransporte, pois estão sempre visíveis)
        let frete = 0;
        if (_state.nfeEditFrete) {
            let freteStr = _state.nfeEditFrete.value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
            frete = parseFloat(freteStr) || 0;
        }

        let desconto = 0;
        if (_state.nfeEditDesconto) {
            let descontoStr = _state.nfeEditDesconto.value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
            desconto = parseFloat(descontoStr) || 0;
        }

        let outrasDespesas = 0;
        if (_state.nfeEditOutrasDespesas) {
            let outrasDespesasStr = _state.nfeEditOutrasDespesas.value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
            outrasDespesas = parseFloat(outrasDespesasStr) || 0;
        }

        // Recuperar IPI do pedido original (se houver), pois ele compõe o total da nota no Bling
        let totalIPI = 0;
        if (_state.currentPedidoBlingBruto && _state.currentPedidoBlingBruto.tributacao && _state.currentPedidoBlingBruto.tributacao.totalIPI) {
            totalIPI = parseFloat(_state.currentPedidoBlingBruto.tributacao.totalIPI) || 0;
        }

        totalPecas += frete;
        const totalPedido = totalPecas + totalServicos + outrasDespesas + totalIPI - desconto;

        // Atualizar UI
        const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const elPecas = document.getElementById('nfe-edit-total-pecas');
        const elServicos = document.getElementById('nfe-edit-total-servicos');
        const elPedido = document.getElementById('nfe-edit-total-pedido');

        if (elPecas) elPecas.textContent = formatter.format(totalPecas);
        if (elServicos) elServicos.textContent = formatter.format(totalServicos);
        if (elPedido) elPedido.textContent = formatter.format(totalPedido);
    }

    function _parseDaysFromObservacoes(obsText) {
        if (!obsText) return null;

        // Detectar "À VISTA" ou "A VISTA" -> 1 parcela na data atual (0 dias)
        if (/\bà\s*vista\b|\ba\s*vista\b/i.test(obsText)) {
            return [0]; // 0 dias = vencimento hoje
        }
        
        // Expressão regular para encontrar "Condições Pagto: - FATURADO" ou "FATURAMENTO"
        const regex = /(?:Condi[çc][õo]es\s+Pagto:?\s*-?\s*)?(?:FATURAD[OA]|FATURAMENTO)\s+([0-9\s/,\-a-zA-Z]+)/i;
        const match = obsText.match(regex);
        if (!match) {
            // Tenta pegar diretamente se houver apenas a condição (ex: 30/45/60)
            const fallbackRegex = /(?:Condi[çc][õo]es\s+Pagto:?\s*-?\s*)([0-9\s/]+)/i;
            const fallbackMatch = obsText.match(fallbackRegex);
            if (!fallbackMatch) return null;
            
            const parts = fallbackMatch[1].split(/[^0-9]+/);
            const days = parts.map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p >= 0);
            return days.length > 0 ? days : null;
        }
        
        const rawVal = match[1];
        // Divide o valor extraído em partes numéricas
        const parts = rawVal.split(/[^0-9]+/);
        const days = parts.map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p >= 0);
        
        return days.length > 0 ? days : null;
    }

    function _addDaysToDate(baseDateStr, days) {
        const date = new Date(baseDateStr + 'T12:00:00');
        date.setDate(date.getDate() + days);
        return date.toISOString().substring(0, 10);
    }

    function _generateParcelasWithDays(days) {
        if (!_state.nfeEditParcelasTbody) return;

        // Calcular valor total da nota com base nos inputs atuais do modal
        let totalItens = 0;
        if (_state.nfeEditItensTbody) {
            const rows = _state.nfeEditItensTbody.querySelectorAll('.nfe-edit-item-row');
            rows.forEach(row => {
                const quantidade = parseInt(row.querySelector('.nfe-edit-item-quantidade').value) || 0;
                const valor = _parseNumber(row.querySelector('.nfe-edit-item-valor').value);
                totalItens += quantidade * valor;
            });
        }
        const frete = _state.nfeEditFrete ? _parseNumber(_state.nfeEditFrete.value) : 0;
        const descontoVal = _state.nfeEditDesconto ? _parseNumber(_state.nfeEditDesconto.value) : 0;
        const outrasDespesasVal = _state.nfeEditOutrasDespesas ? _parseNumber(_state.nfeEditOutrasDespesas.value) : 0;
        
        let totalIPI = 0;
        if (_state.currentPedidoBlingBruto && _state.currentPedidoBlingBruto.tributacao && _state.currentPedidoBlingBruto.tributacao.totalIPI) {
            totalIPI = parseFloat(_state.currentPedidoBlingBruto.tributacao.totalIPI) || 0;
        }

        const totalNota = Math.round((totalItens + frete + outrasDespesasVal + totalIPI - descontoVal) * 100) / 100;

        if (totalNota <= 0) {
            alert('O valor total líquido calculado para a nota é R$ 0.00 ou menor. Adicione itens com valores antes de ajustar as parcelas.');
            return;
        }

        // Obter a forma de pagamento ID existente na primeira parcela atual do formulário
        let formaPagamentoId = '';
        const firstFormaInput = _state.nfeEditParcelasTbody.querySelector('.nfe-edit-parcela-forma-id');
        if (firstFormaInput) {
            formaPagamentoId = firstFormaInput.value.trim();
        }

        // Calcular parcelas usando divisão precisa centavos a centavos
        const numParcelas = days.length;
        const baseValor = Math.floor((totalNota / numParcelas) * 100) / 100;
        let somaCalculada = 0;

        // Data base do pedido (sempre a data atual)
        const baseDateStr = new Date().toISOString().substring(0, 10);

        // Limpar parcelas atuais
        _state.nfeEditParcelasTbody.innerHTML = '';

        for (let i = 0; i < numParcelas; i++) {
            let valorP = baseValor;
            if (i === numParcelas - 1) {
                // Última parcela absorve a diferença dos centavos
                valorP = Math.round((totalNota - somaCalculada) * 100) / 100;
            } else {
                somaCalculada += baseValor;
            }

            const vencimentoStr = _addDaysToDate(baseDateStr, days[i]);

            _addNfeEditParcelaRow({
                dataVencimento: vencimentoStr,
                valor: valorP,
                formaPagamento: { id: formaPagamentoId || FORMA_PAGAMENTO_PADRAO },
                observacoes: ''
            });
        }

        const descricao = days.length === 1 && days[0] === 0
            ? `1 parcela à vista (hoje)`
            : `${days.join('/')} dias (${numParcelas}x de R$ ${(totalNota / numParcelas).toFixed(2).replace('.', ',')})`;

        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: `✅ Parcelas ajustadas: ${descricao}`,
                duration: 3500,
                gravity: 'top',
                position: 'center',
                style: { background: 'linear-gradient(to right, #10b981, #059669)' }
            }).showToast();
        } else {
            alert(`Parcelas ajustadas: ${descricao}`);
        }
    }

    async function _handleAiParseObservation() {
        const obsText = _state.nfeEditObservacoesOriginal ? _state.nfeEditObservacoesOriginal.value : '';
        if (!obsText.trim()) {
            alert('Não há observação original para analisar.');
            return;
        }

        const btn = _state.nfeEditAiParseBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg class="animate-spin -ml-1 mr-1 h-3 w-3 inline text-purple-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processando...`;
        btn.disabled = true;

        try {
            const backendUrl = window.API_URLS && window.API_URLS.ORDERS_BLING 
                ? window.API_URLS.ORDERS_BLING.replace('/pedidos', '')
                : "https://bling-proxy-api-255108547424.southamerica-east1.run.app";
            
            const response = await fetch(`${backendUrl}/bling/parse-observation-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: obsText })
            });

            if (!response.ok) throw new Error('Falha ao processar IA');
            const result = await response.json();
            const data = result.data;

            if (data.volume !== null && data.volume !== undefined) {
                const volInput = document.getElementById('nfe-edit-volumes');
                if (volInput) volInput.value = data.volume;
            }

            if (data.peso !== null && data.peso !== undefined) {
                const pesoBruto = document.getElementById('nfe-edit-peso-bruto');
                const pesoLiq = document.getElementById('nfe-edit-peso-liquido');
                if (pesoBruto) pesoBruto.value = data.peso;
                if (pesoLiq) pesoLiq.value = data.peso;
            }

            if (data.parcelas && Array.isArray(data.parcelas) && data.parcelas.length > 0) {
                let parcelasFinais = data.parcelas;
                
                // Sanitização: Se a IA falhou e devolveu "30456075" (apenas 1 parcela com número gigante)
                if (parcelasFinais.length === 1 && parcelasFinais[0] > 1000) {
                    console.warn('[AI Fallback] IA falhou ao separar as datas. Usando Regex local para parcelas...');
                    const localDays = _parseDaysFromObservacoes(obsText);
                    if (localDays && localDays.length > 0) {
                        parcelasFinais = localDays;
                    } else {
                        // Último recurso: dividir a string brutalmente (ex: "304560" -> [30, 45, 60]) se for padrão 2 dígitos
                        const strVal = String(parcelasFinais[0]);
                        if (strVal.length % 2 === 0) {
                            parcelasFinais = strVal.match(/.{1,2}/g).map(Number);
                        }
                    }
                }
                
                _generateParcelasWithDays(parcelasFinais);
            }

            if (data.freteConta !== null && data.freteConta !== undefined) {
                const freteContaSelect = _state.nfeEditFretePorConta;
                if (freteContaSelect) {
                    freteContaSelect.value = data.freteConta;
                    freteContaSelect.dispatchEvent(new Event('change'));
                }
            }

            if (data.transportadora) {
                const freteContaSelect = _state.nfeEditFretePorConta;
                if (freteContaSelect) {
                    const transpLower = String(data.transportadora).toLowerCase();
                    // Regra: Se a transportadora for Sedex, forçar CIF (0). Senão, manter 0 se antes era 9.
                    if (transpLower.includes('sedex')) {
                        freteContaSelect.value = 0;
                        freteContaSelect.dispatchEvent(new Event('change'));
                    } else if (parseInt(freteContaSelect.value) === 9) {
                        freteContaSelect.value = 0;
                        freteContaSelect.dispatchEvent(new Event('change'));
                    }
                }

                if (!_state.transportadorasLoaded) {
                    await _loadNfeTransportadorasBling(_state.nfeEditCurrentTranspId, _state.nfeEditCurrentTranspNome);
                }

                const transpSelect = _state.nfeEditTransportadora;
                if (transpSelect) {
                    const nome = String(data.transportadora).toUpperCase();
                    if (nome === 'RETIRADA' || nome === 'CLIENTE RETIRA') {
                        const opt = Array.from(transpSelect.options).find(o => o.text.toUpperCase().includes('RETIRADA'));
                        if (opt) transpSelect.value = opt.value;
                    } else if (nome.includes('BRASPRESS')) {
                        const optTambore = Array.from(transpSelect.options).find(o => o.text.toUpperCase().includes('BRASPRESS') && o.text.toUpperCase().includes('TAMBORE'));
                        if (optTambore) {
                            transpSelect.value = optTambore.value;
                        } else {
                            const opt = Array.from(transpSelect.options).find(o => o.text.toUpperCase().includes('BRASPRESS'));
                            transpSelect.value = opt ? opt.value : '';
                        }
                    } else {
                        const opt = Array.from(transpSelect.options).find(o => o.text.toUpperCase().includes(nome) || nome.includes(o.text.toUpperCase()) && o.text.trim() !== '' && o.text.trim().toUpperCase() !== 'SELECIONE A TRANSPORTADORA');
                        if (opt) {
                            transpSelect.value = opt.value;
                        } else {
                            transpSelect.value = '';
                        }
                    }
                }
            }

            // Limpar Observação da Nota mantendo apenas Orçamento, Pagamento e Vendedor
            const currentObs = _state.nfeEditObservacoes ? _state.nfeEditObservacoes.value : '';
            const orcMatch = currentObs.match(/Orçamento:\s*([^\n]+)/i); // Pega a linha do orçamento
            const orcamento = orcMatch ? orcMatch[1].trim() : '';
            const pagMatch = currentObs.match(/Pagamento:\s*([^\n]+)/i); // Pega a linha do pagamento

            const currentPedido = _state.currentPedidoBlingBruto || {};
            const localPedido = _allPedidos.find(p => String(p.id) === String(_currentModalPedidoId) || String(p.numero) === String(_currentModalPedidoId) || String(p.id_pedido) === String(_currentModalPedidoId) || (currentPedido.numero && String(p.numero) === String(currentPedido.numero)));

            let vendedorNome = '';
            if (currentPedido.vendedor) {
                const v = currentPedido.vendedor;
                let rawVendedor = '';
                if (typeof v === 'object') {
                    if (v.nome && typeof v.nome === 'string' && v.nome.trim()) rawVendedor = v.nome.trim();
                    else if (v.id && v.id !== 0 && v.id !== '0') rawVendedor = v.id;
                } else {
                    rawVendedor = v;
                }
                const fullVendedor = _getVendedorName(rawVendedor);
                if (fullVendedor && fullVendedor !== '-') {
                    vendedorNome = fullVendedor.toLowerCase() === 'e-commerce' ? 'E-Commerce' : fullVendedor.split(' ')[0];
                }
            }

            if (!vendedorNome || vendedorNome === '-') {
                if (localPedido && localPedido.vendedor) {
                    const fullVendedor = _getVendedorName(localPedido.vendedor);
                    if (fullVendedor && fullVendedor !== '-') {
                        vendedorNome = fullVendedor.toLowerCase() === 'e-commerce' ? 'E-Commerce' : fullVendedor.split(' ')[0];
                    }
                }
            }

            const isEcommerce = (localPedido && (
                String(localPedido.loja || '').toLowerCase().includes('loja integrada') ||
                String(localPedido.vendedor || '').toLowerCase().includes('commerce') ||
                String(localPedido.numero_loja || '').trim() !== ''
            )) || (currentPedido.loja && (
                String(currentPedido.loja.id) === '205371925' ||
                String(currentPedido.loja.nome || '').toLowerCase().includes('loja integrada')
            )) || (currentPedido.numeroLoja && String(currentPedido.numeroLoja).trim() !== '');

            if (isEcommerce && (!vendedorNome || vendedorNome === '-')) {
                vendedorNome = 'E-Commerce';
            }

            const pagamentoTexto = pagMatch ? pagMatch[1].trim() : _extractPagamentoInfo(currentPedido, isEcommerce);

            if (_state.nfeEditObservacoes) {
                let novaObs = 'A venda é realizada com reserva de domínio, nos termos do art. 521 do Código Civil, até a quitação integral. Em caso de mora, a VENDEDORA poderá cobrar os valores em atraso ou requerer a apreensão e depósito judicial do bem.\n\n';
                if (orcamento && orcamento !== '-' && orcamento !== '0') novaObs += `Orçamento: ${orcamento}\n`;
                if (pagamentoTexto) novaObs += `Pagamento: ${pagamentoTexto}\n`;
                if (vendedorNome && vendedorNome !== '-') novaObs += `Vendedor: ${vendedorNome}\n`;
                _state.nfeEditObservacoes.value = novaObs.trim();
            }

            if (window.Toastify) {
                Toastify({
                    text: "Dados extraídos pela IA e preenchidos!",
                    duration: 3000,
                    gravity: "top",
                    position: 'center',
                    style: { background: 'linear-gradient(to right, #9333ea, #7e22ce)' }
                }).showToast();
            }

        } catch (error) {
            console.error('Erro ao chamar IA:', error);
            alert('Erro ao processar dados com IA. Verifique se o backend está atualizado.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    function _handleAutoAdjustParcelas() {
        const obsText = _state.nfeEditObservacoesOriginal ? _state.nfeEditObservacoesOriginal.value : '';
        let days = _parseDaysFromObservacoes(obsText);

        // Se não encontrou condição nas observações, ajusta como 1 parcela à vista (hoje)
        if (!days || days.length === 0) {
            days = [0];
        }

        _generateParcelasWithDays(days);
    }

    function _handleManualAdjustParcelas() {
        const inputEl = document.getElementById('nfe-edit-manual-parcelas-input');
        if (!inputEl) return;
        
        const rawVal = inputEl.value.trim();
        if (!rawVal) {
            alert("Digite os dias para vencimento separados por vírgula. Exemplo: 28,35,70");
            return;
        }

        // Separa por vírgula, converte pra inteiro, filtra NaN e espaços
        const days = rawVal.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p > 0);
        
        if (days.length === 0) {
            alert("Formato inválido. Digite os dias para vencimento separados por vírgula, apenas números maiores que zero. Exemplo: 28,35,70");
            return;
        }

        _generateParcelasWithDays(days);
        
        // Limpa o input após usar com sucesso
        inputEl.value = '';
    }

    async function _saveOrderEdit(silent = false, skipConfirm = false) {
        const idPedido = _currentModalPedidoId;
        if (!idPedido) return;
        if (!_state.currentPedidoBlingBruto) {
            alert('Erro: Pedido original não carregado.');
            return;
        }

        // Clone do objeto original
        const payloadUpdate = JSON.parse(JSON.stringify(_state.currentPedidoBlingBruto));

        // Obter valores
        const contatoIdStr = _state.nfeEditContatoId ? _state.nfeEditContatoId.value.trim() : '';
        const contatoNome = _state.nfeEditContatoNome ? _state.nfeEditContatoNome.value.trim() : '';
        const contatoFantasia = _state.nfeEditContatoFantasia ? _state.nfeEditContatoFantasia.value.trim() : '';
        const contatoTipo = _state.nfeEditContatoTipo ? _state.nfeEditContatoTipo.value : 'J';
        const contatoCnpj = _state.nfeEditContatoCnpj ? _state.nfeEditContatoCnpj.value.trim() : '';
        const contatoIe = _state.nfeEditContatoIe ? _state.nfeEditContatoIe.value.trim() : '';
        const contatoContribuinte = _state.nfeEditContatoContribuinte ? parseInt(_state.nfeEditContatoContribuinte.value) : 9;
        const dataOperacao = _state.nfeEditData ? _state.nfeEditData.value.trim() : '';
        const dataSaida = _state.nfeEditDataSaida ? _state.nfeEditDataSaida.value.trim() : '';
        const dataPrevista = _state.nfeEditDataPrevista ? _state.nfeEditDataPrevista.value.trim() : '';
        const observacoes = _state.nfeEditObservacoes ? _state.nfeEditObservacoes.value.trim() : '';

        const transportadoraIdStr = _state.nfeEditTransportadora ? _state.nfeEditTransportadora.value : '';
        const transportadoraOpt = _state.nfeEditTransportadora && _state.nfeEditTransportadora.selectedIndex > 0 ? _state.nfeEditTransportadora.options[_state.nfeEditTransportadora.selectedIndex] : null;
        const transportadoraNome = transportadoraOpt ? transportadoraOpt.text : '';

        const frete = _state.nfeEditFrete ? _parseNumber(_state.nfeEditFrete.value) : 0;
        const fretePorConta = _state.nfeEditFretePorConta ? parseInt(_state.nfeEditFretePorConta.value) || 0 : 0;
        const quantidadeVolumes = _state.nfeEditVolumes ? parseInt(_state.nfeEditVolumes.value) || 0 : 0;
        const pesoBruto = _state.nfeEditPesoBruto ? parseFloat(_state.nfeEditPesoBruto.value) || 0 : 0;
        const pesoLiquido = _state.nfeEditPesoLiquido ? parseFloat(_state.nfeEditPesoLiquido.value) || 0 : 0;
        const descontoVal = _state.nfeEditDesconto ? _parseNumber(_state.nfeEditDesconto.value) : 0;
        const outrasDespesasVal = _state.nfeEditOutrasDespesas ? _parseNumber(_state.nfeEditOutrasDespesas.value) : 0;

        // Validações básicas
        if (!contatoIdStr) { alert('Por favor, informe o ID do cliente.'); return; }
        const contatoId = parseInt(contatoIdStr);
        if (isNaN(contatoId)) { alert('O ID do cliente deve ser um número válido.'); return; }

        const items = [];
        if (_state.nfeEditItensTbody) {
            const rows = _state.nfeEditItensTbody.querySelectorAll('.nfe-edit-item-row');
            for (const row of rows) {
                const codigo = row.querySelector('.nfe-edit-item-codigo').value.trim();
                const descricao = row.querySelector('.nfe-edit-item-descricao').value.trim();
                const quantidade = parseInt(row.querySelector('.nfe-edit-item-quantidade').value) || 0;
                const pesoInput = row.querySelector('.nfe-edit-item-peso');
                const peso = pesoInput ? (parseFloat(pesoInput.value) || 0) : 0;
                const valor = _parseNumber(row.querySelector('.nfe-edit-item-valor').value);

                const idItem = row.dataset.itemId || null;

                if (!descricao) { alert('Todas as linhas de item devem conter uma descrição.'); return; }
                if (quantidade <= 0) { alert(`O item "${descricao}" deve ter quantidade maior que zero.`); return; }
                items.push({ codigo, descricao, quantidade, peso, valor, idItem });
            }
        }
        if (items.length === 0) { alert('A nota fiscal deve possuir ao menos 1 item.'); return; }

        const parcelas = [];
        if (_state.nfeEditParcelasTbody) {
            const rows = _state.nfeEditParcelasTbody.querySelectorAll('.nfe-edit-parcela-row');
            for (const row of rows) {
                const dataVencimento = row.querySelector('.nfe-edit-parcela-data').value;
                const valor = _parseNumber(row.querySelector('.nfe-edit-parcela-valor').value);
                const formaIdStr = row.querySelector('.nfe-edit-parcela-forma-id').value.trim();
                const obs = row.querySelector('.nfe-edit-parcela-obs').value.trim();

                if (!dataVencimento) { alert('Todas as parcelas devem conter uma data de vencimento.'); return; }
                if (valor <= 0) { alert('Todas as parcelas devem ter valor maior que zero.'); return; }

                const pObj = { dataVencimento: dataVencimento, valor, observacoes: obs };
                if (formaIdStr) {
                    const formaId = parseInt(formaIdStr);
                    if (!isNaN(formaId)) { pObj.formaPagamento = { id: formaId }; }
                }
                parcelas.push(pObj);
            }
        }

        if (!skipConfirm) {
            const confirmed = await _showCustomConfirm(
                'Atualizar Pedido no Bling',
                'Tem certeza de que deseja atualizar este pedido no Bling com as informações preenchidas?'
            );
            if (!confirmed) return { success: false, error: "Cancelado pelo usuário" };
        }

        // Para evitar que o Bling apague o endereço do cliente no pedido (já que o GET não traz o endereço dentro de contato),
        // passamos apenas o ID. As alterações no contato serão salvas via PUT na API de contatos logo abaixo.
        payloadUpdate.contato = { id: contatoId };
        
        if (dataOperacao) payloadUpdate.data = dataOperacao;
        if (dataSaida) payloadUpdate.dataSaida = dataSaida;
        if (dataPrevista) payloadUpdate.dataPrevista = dataPrevista;
        if (observacoes) payloadUpdate.observacoes = observacoes;

        // O payload de itens em vendas (Bling requer o ID interno se o item já existia no pedido)
        payloadUpdate.itens = items.map((i, index) => {
            let originalItem = null;
            if (i.idItem) {
                originalItem = _state.currentPedidoBlingBruto.itens?.find(orig => String(orig.id) === i.idItem);
            }
            if (!originalItem && _state.currentPedidoBlingBruto.itens && _state.currentPedidoBlingBruto.itens[index]) {
                originalItem = _state.currentPedidoBlingBruto.itens[index];
            }

            if (originalItem) {
                // Mantém id, produto.id, etc., atualizando apenas os campos alteráveis
                return {
                    ...originalItem,
                    codigo: i.codigo,
                    descricao: i.descricao,
                    quantidade: i.quantidade,
                    pesoBruto: i.peso,
                    pesoLiquido: i.peso,
                    valor: i.valor
                };
            } else {
                // Item inteiramente novo adicionado pelo usuário
                return {
                    codigo: i.codigo,
                    descricao: i.descricao,
                    quantidade: i.quantidade,
                    pesoBruto: i.peso,
                    pesoLiquido: i.peso,
                    valor: i.valor
                };
            }
        });

        payloadUpdate.transporte = {
            ...(_state.currentPedidoBlingBruto.transporte || {}),
            fretePorConta: fretePorConta,
            frete: frete,
            quantidadeVolumes: quantidadeVolumes,
            pesoBruto: pesoBruto,
            pesoLiquido: pesoLiquido
        };
        if (transportadoraIdStr || transportadoraNome) {
            payloadUpdate.transporte.contato = {};
            if (transportadoraIdStr) payloadUpdate.transporte.contato.id = parseInt(transportadoraIdStr);
            if (transportadoraNome) payloadUpdate.transporte.contato.nome = transportadoraNome;
        }

        if (descontoVal > 0) {
            payloadUpdate.desconto = { valor: descontoVal, unidade: 'REAL' };
        } else {
            payloadUpdate.desconto = { valor: 0, unidade: 'REAL' };
        }

        if (outrasDespesasVal > 0) {
            payloadUpdate.outrasDespesas = outrasDespesasVal;
        } else {
            payloadUpdate.outrasDespesas = 0;
        }

        if (parcelas.length > 0) {
            payloadUpdate.parcelas = parcelas;
        }

        const btn = _state.saveOrderEditBtn;
        const spinner = _state.saveOrderSpinner;

        try {
            if (btn) btn.disabled = true;
            if (spinner) spinner.classList.remove('hidden');

            // Atualiza os dados fiscais diretamente no cadastro do contato primeiro
            if (_state.nfeEditCurrentContatoBruto && contatoId) {
                const contatoPayload = {
                    ..._state.nfeEditCurrentContatoBruto,
                    nome: contatoNome,
                    tipo: contatoTipo, // Corrigido
                    numeroDocumento: contatoCnpj,
                    ie: contatoIe,
                    indicadorIe: contatoContribuinte
                };

                // O Bling V3 muitas vezes retorna dataNascimento: "0000-00-00" no GET, mas se enviarmos isso de volta no PUT ele rejeita com erro de validação.
                if (contatoPayload.dadosAdicionais && contatoPayload.dadosAdicionais.dataNascimento === '0000-00-00') {
                    contatoPayload.dadosAdicionais.dataNascimento = '';
                }
                
                try {
                    const putReq = await fetch(`${API_URLS.ORDERS_BLING}/contatos/${contatoId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(contatoPayload)
                    });
                    
                    if (!putReq.ok) {
                        const errData = await putReq.json().catch(() => ({}));
                        console.error('[NFe Edit] Detalhes do erro ao atualizar contato:', errData);
                        let errMsg = errData.message || 'Erro desconhecido ao atualizar contato';
                        if (errData.details && errData.details.error && errData.details.error.fields) {
                            errMsg += ': ' + errData.details.error.fields.map(f => f.msg || f.message).join(', ');
                        }
                        throw new Error(`Falha ao atualizar cliente no Bling antes do pedido. Motivo: ${errMsg}`);
                    }
                } catch (cErr) {
                    throw cErr; // Interrompe o salvamento
                }
            }

            const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadUpdate)
            });

            if (!res.ok) {
                const errorResult = await res.json().catch(() => ({}));
                
                // Tratar caso em que o usuário tenta salvar os mesmos dados (Bling retorna Cód 3)
                let isIdenticalError = false;
                if (errorResult.details && errorResult.details.error && errorResult.details.error.fields) {
                    isIdenticalError = errorResult.details.error.fields.some(f => 
                        String(f.code) === '3' || 
                        (f.msg && f.msg.toLowerCase().includes('idêntica')) ||
                        (f.message && f.message.toLowerCase().includes('idêntica'))
                    );
                }

                if (isIdenticalError) {
                    console.log("[Salvar Pedido] Bling reportou informações idênticas (Cód 3). Tratando como sucesso.");
                    if (!silent) {
                        if (typeof Toastify !== 'undefined') {
                            Toastify({
                                text: '✅ Pedido já está atualizado no Bling com estes dados!',
                                duration: 3500,
                                gravity: 'top',
                                position: 'center',
                                style: { background: '#3b82f6' }
                            }).showToast();
                        } else {
                            alert('Pedido já está atualizado no Bling com estes dados!');
                        }
                    }
                    return { success: true };
                }

                console.error("Erro completo retornado pelo backend:", errorResult);
                
                let errMsg = errorResult.message || 'Falha ao atualizar pedido no Bling.';
                if (errorResult.details && errorResult.details.error && errorResult.details.error.fields) {
                    const fields = errorResult.details.error.fields;
                    const mapErros = fields.map(f => `${f.msg || f.message} (Cód: ${f.code})`).join(' | ');
                    errMsg += ` Detalhes do Bling: ${mapErros}`;
                }
                throw new Error(errMsg);
            }

            if (!silent) {
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: '✅ Pedido atualizado com sucesso no Bling!',
                        duration: 3500,
                        gravity: 'top',
                        position: 'center',
                        style: { background: '#10b981' }
                    }).showToast();
                } else {
                    alert('Pedido atualizado com sucesso no Bling!');
                }
            }
            
            // O modal permanece aberto após salvar com sucesso.
            return { success: true };
        } catch (err) {
            console.error('[Salvar Pedido] Erro ao atualizar pedido:', err);
            if (!silent) {
                alert('Erro ao atualizar pedido: ' + err.message);
            }
            return { success: false, error: err.message };
        } finally {
            if (btn) btn.disabled = false;
            if (spinner) spinner.classList.add('hidden');
            const confirmModal = document.getElementById('app-confirm-modal');
            if (confirmModal) confirmModal.classList.add('hidden');
        }
    }

    async function _confirmCustomEmitirNfe(somenteGerar = false) {
        const idPedido = _currentModalPedidoId;
        if (!idPedido) return;

        // Obter valores
        const contatoIdStr = _state.nfeEditContatoId ? _state.nfeEditContatoId.value.trim() : '';
        const contatoNome = _state.nfeEditContatoNome ? _state.nfeEditContatoNome.value.trim() : '';
        const contatoFantasia = _state.nfeEditContatoFantasia ? _state.nfeEditContatoFantasia.value.trim() : '';
        const contatoTipo = _state.nfeEditContatoTipo ? _state.nfeEditContatoTipo.value : 'J';
        const contatoCnpj = _state.nfeEditContatoCnpj ? _state.nfeEditContatoCnpj.value.trim() : '';
        const contatoIe = _state.nfeEditContatoIe ? _state.nfeEditContatoIe.value.trim() : '';
        const contatoContribuinte = _state.nfeEditContatoContribuinte ? parseInt(_state.nfeEditContatoContribuinte.value) : 9;
        const naturezaIdStr = _state.nfeEditNaturezaId ? _state.nfeEditNaturezaId.value.trim() : '';
        const dataOperacao = _state.nfeEditData ? _state.nfeEditData.value.trim() : '';
        const dataSaida = _state.nfeEditDataSaida ? _state.nfeEditDataSaida.value.trim() : '';
        const dataPrevista = _state.nfeEditDataPrevista ? _state.nfeEditDataPrevista.value.trim() : '';
        const observacoes = _state.nfeEditObservacoes ? _state.nfeEditObservacoes.value.trim() : '';

        const transportadoraIdStr = _state.nfeEditTransportadora ? _state.nfeEditTransportadora.value : '';
        const transportadoraOpt = _state.nfeEditTransportadora && _state.nfeEditTransportadora.selectedIndex > 0 ? _state.nfeEditTransportadora.options[_state.nfeEditTransportadora.selectedIndex] : null;
        const transportadoraNome = transportadoraOpt ? transportadoraOpt.text : '';

        const frete = _state.nfeEditFrete ? _parseNumber(_state.nfeEditFrete.value) : 0;
        const fretePorConta = _state.nfeEditFretePorConta ? parseInt(_state.nfeEditFretePorConta.value) || 0 : 0;
        const quantidadeVolumes = _state.nfeEditVolumes ? parseInt(_state.nfeEditVolumes.value) || 0 : 0;
        const pesoBruto = _state.nfeEditPesoBruto ? parseFloat(_state.nfeEditPesoBruto.value) || 0 : 0;
        const pesoLiquido = _state.nfeEditPesoLiquido ? parseFloat(_state.nfeEditPesoLiquido.value) || 0 : 0;
        const descontoVal = _state.nfeEditDesconto ? _parseNumber(_state.nfeEditDesconto.value) : 0;
        const outrasDespesasVal = _state.nfeEditOutrasDespesas ? _parseNumber(_state.nfeEditOutrasDespesas.value) : 0;

        // Validações básicas
        if (!contatoIdStr) {
            alert('Por favor, informe o ID do cliente.');
            return;
        }
        const contatoId = parseInt(contatoIdStr);
        if (isNaN(contatoId)) {
            alert('O ID do cliente deve ser um número válido.');
            return;
        }

        if (fretePorConta === 9 && frete > 0) {
            if (window.App && window.App.showMessageModal) {
                window.App.showMessageModal('Atenção: Frete Incompatível', 'O pedido tem valor em frete, mas a opção frete está com a opção <b>"Sem Transporte"</b>. Mude para outra opção de frete antes de emitir a nota.');
            } else {
                alert('O pedido tem valor em frete, mas a opção frete está com a opção "Sem Transporte"');
            }
            return;
        }

        const items = [];
        if (_state.nfeEditItensTbody) {
            const rows = _state.nfeEditItensTbody.querySelectorAll('.nfe-edit-item-row');
            for (const row of rows) {
                const codigo = row.querySelector('.nfe-edit-item-codigo').value.trim();
                const descricao = row.querySelector('.nfe-edit-item-descricao').value.trim();
                const quantidade = parseInt(row.querySelector('.nfe-edit-item-quantidade').value) || 0;
                const valor = _parseNumber(row.querySelector('.nfe-edit-item-valor').value);
                const idItem = row.dataset.itemId || null;

                if (!descricao) {
                    alert('Todas as linhas de item devem conter uma descrição.');
                    return;
                }
                if (quantidade <= 0) {
                    alert(`O item "${descricao}" deve ter quantidade maior que zero.`);
                    return;
                }
                items.push({ idItem, codigo, descricao, quantidade, valor });
            }
        }

        if (items.length === 0) {
            alert('A nota fiscal deve possuir ao menos 1 item.');
            return;
        }

        // O payload de itens na NF-e deve preservar os dados originais (como UNIDADE) 
        // para não falhar a validação do Bling.
        const itensPayload = items.map((i, index) => {
            let originalItem = null;
            if (i.idItem) {
                originalItem = _state.currentPedidoBlingBruto.itens?.find(orig => String(orig.id) === i.idItem);
            }
            if (!originalItem && _state.currentPedidoBlingBruto.itens && _state.currentPedidoBlingBruto.itens[index]) {
                originalItem = _state.currentPedidoBlingBruto.itens[index];
            }

            if (originalItem) {
                return {
                    ...originalItem,
                    codigo: i.codigo,
                    descricao: i.descricao,
                    quantidade: i.quantidade,
                    valor: i.valor
                };
            } else {
                return {
                    codigo: i.codigo,
                    descricao: i.descricao,
                    quantidade: i.quantidade,
                    valor: i.valor
                };
            }
        });

        const parcelas = [];
        if (_state.nfeEditParcelasTbody) {
            const rows = _state.nfeEditParcelasTbody.querySelectorAll('.nfe-edit-parcela-row');
            for (const row of rows) {
                const dataVencimento = row.querySelector('.nfe-edit-parcela-data').value;
                const valor = _parseNumber(row.querySelector('.nfe-edit-parcela-valor').value);
                const formaIdStr = row.querySelector('.nfe-edit-parcela-forma-id').value.trim();
                const obs = row.querySelector('.nfe-edit-parcela-obs').value.trim();

                if (!dataVencimento) {
                    alert('Todas as parcelas devem conter uma data de vencimento.');
                    return;
                }
                if (valor <= 0) {
                    alert('Todas as parcelas devem ter valor maior que zero.');
                    return;
                }

                const pObj = { data: dataVencimento, valor, observacoes: obs };
                if (formaIdStr) {
                    const formaId = parseInt(formaIdStr);
                    if (!isNaN(formaId)) {
                        pObj.formaPagamento = { id: formaId };
                    }
                }
                parcelas.push(pObj);
            }
        }

        // Validação da soma das parcelas vs valor total da nota
        let totalItens = 0;
        items.forEach(it => { totalItens += it.quantidade * it.valor; });
        const totalNotaCalculado = Math.round((totalItens + frete + outrasDespesasVal - descontoVal) * 100) / 100;

        if (parcelas.length > 0) {
            let totalParcelas = 0;
            parcelas.forEach(p => { totalParcelas += p.valor; });
            totalParcelas = Math.round(totalParcelas * 100) / 100;

            if (Math.abs(totalNotaCalculado - totalParcelas) > 0.05) {
                const msg = `Aviso: A soma das parcelas (R$ ${totalParcelas.toFixed(2)}) é diferente do total líquido calculado da nota (R$ ${totalNotaCalculado.toFixed(2)}).\n\nDeseja continuar assim mesmo? (Nota: Caso prossiga, a SEFAZ ou o Bling podem rejeitar a nota por inconsistência de valores)`;
                const confirmed = await window.customConfirm(msg, 'Inconsistência de Valores', 'warning');
                if (!confirmed) {
                    return;
                }
            }
        }

        // Validação de Peso dos Produtos antes da Emissão Automática
        if (!somenteGerar) {
            let allZeroWeight = true;
            let hasValidProducts = false;
            const confirmBtn = _state.confirmNfeEditBtn;
            const btnOriginalText = confirmBtn ? confirmBtn.innerHTML : '';
            
            try {
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Verificando pesos...';
                }

                // Extrair IDs dos produtos do pedido bruto
                const productIds = [];
                if (_state.currentPedidoBlingBruto && _state.currentPedidoBlingBruto.itens) {
                    _state.currentPedidoBlingBruto.itens.forEach(it => {
                        if (it.produto && it.produto.id) productIds.push(it.produto.id);
                    });
                }

                if (productIds.length > 0) {
                    hasValidProducts = true;
                    // Checar apenas os 3 primeiros para não demorar muito (rate limit)
                    for (const pid of productIds.slice(0, 3)) {
                        const resProd = await fetch(`${API_URLS.PRODUCTS}/${pid}`);
                        if (resProd.ok) {
                            const pData = await resProd.json();
                            const product = pData.data;
                            const pesoBruto = parseFloat(product.pesoBruto) || 0;
                            if (pesoBruto > 0) {
                                allZeroWeight = false;
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("Erro ao checar pesos dos produtos:", e);
            } finally {
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = btnOriginalText;
                }
            }

            if (hasValidProducts && allZeroWeight) {
                const msg = 'Os produtos deste pedido estão com PESO ZERO no cadastro do Bling!\nComo o Bling ignora o peso manual e usa o peso dos produtos para gerar a NF-e, ela sairá zerada e a transportadora poderá rejeitar!\n\nRecomendamos usar o botão "Criar Rascunho", ou cadastrar o peso nos produtos.\n\nDeseja forçar o envio automático mesmo assim?';
                const confirmed = await window.customConfirm(msg, '⚠️ ALERTA DE PESO ZERO ⚠️', 'danger');
                if (!confirmed) {
                    return;
                }
            } else {
                const confirmed = await window.customConfirm('Confirmar a emissão da Nota Fiscal com os dados editados?\n\nEsta ação enviará a nota para a SEFAZ.', 'Emissão de NF-e', 'info');
                if (!confirmed) return;
            }
        } else {
            const confirmed = await window.customConfirm('Criar a NF-e no Bling SEM enviar para a SEFAZ?\n\nA nota ficará como rascunho e poderá ser conferida e enviada manualmente no Bling.', 'Criar Rascunho', 'info');
            if (!confirmed) return;
        }

        // Preparar payload customizado. 
        // A API de NF-e do Bling V3 exige o nome, tipoPessoa e documento se o contato for enviado.
        // Além disso, se enviarmos o contato, devemos enviar o endereço junto, senão a NFe fica sem endereço!
        const payload = {
            finalidade: 1, // 1 = Normal
            contato: {
                id: contatoId,
                nome: contatoNome,
                tipoPessoa: contatoTipo,
                numeroDocumento: contatoCnpj,
                ie: contatoIe,
                indicadorIe: contatoContribuinte
            }
        };

        // Resgatar o endereço da etiqueta do pedido ou do cadastro do contato
        if (_state.currentPedidoBlingBruto?.transporte?.etiqueta) {
            const et = _state.currentPedidoBlingBruto.transporte.etiqueta;
            payload.contato.endereco = {
                endereco: et.endereco || "",
                numero: et.numero || "",
                complemento: et.complemento || "",
                bairro: et.bairro || "",
                cep: et.cep || "",
                municipio: et.municipio || "",
                uf: et.uf || ""
            };
        } else if (_state.nfeEditCurrentContatoBruto?.endereco?.geral) {
            const eg = _state.nfeEditCurrentContatoBruto.endereco.geral;
            payload.contato.endereco = {
                endereco: eg.endereco || "",
                numero: eg.numero || "",
                complemento: eg.complemento || "",
                bairro: eg.bairro || "",
                cep: eg.cep || "",
                municipio: eg.municipio || "",
                uf: eg.uf || ""
            };
        }

        if (naturezaIdStr) {
            const naturezaId = parseInt(naturezaIdStr);
            if (!isNaN(naturezaId)) {
                payload.naturezaOperacao = { id: naturezaId };
            }
        }

        if (dataOperacao) {
            payload.dataOperacao = dataOperacao;
        }

        if (dataSaida) {
            payload.dataSaida = dataSaida;
        }

        if (dataPrevista) {
            payload.dataPrevista = dataPrevista;
        }

        if (observacoes) {
            payload.observacoes = observacoes;
        }

        payload.itens = itensPayload;

        payload.transporte = {
            ...(_state.currentPedidoBlingBruto.transporte || {}),
            fretePorConta: fretePorConta,
            frete: frete,
            quantidadeVolumes: quantidadeVolumes,
            pesoBruto: pesoBruto,
            pesoLiquido: pesoLiquido
        };

        if (transportadoraIdStr || transportadoraNome) {
            payload.transporte.contato = {};
            if (transportadoraIdStr) payload.transporte.contato.id = parseInt(transportadoraIdStr);
            if (transportadoraNome) payload.transporte.contato.nome = transportadoraNome;
        }

        if (descontoVal > 0) {
            payload.desconto = descontoVal;
        }

        if (outrasDespesasVal > 0) {
            payload.outrasDespesas = outrasDespesasVal;
        }

        if (parcelas.length > 0) {
            payload.parcelas = parcelas;
        }

        const confirmBtn = _state.confirmNfeEditBtn;
        const cancelBtn = _state.cancelNfeEditBtn;
        const spinner = somenteGerar ? _state.nfeDraftSpinner : _state.nfeEditSpinner;
        const actionBtn = somenteGerar ? _state.draftNfeEditBtn : confirmBtn;

        try {
            if (confirmBtn) confirmBtn.disabled = true;
            if (_state.draftNfeEditBtn) _state.draftNfeEditBtn.disabled = true;
            if (cancelBtn) cancelBtn.disabled = true;

            // Abrir o Console Modal
            const consoleOverlay = document.getElementById('nfe-emission-overlay');
            const consoleDetails = document.getElementById('nfe-emission-details');
            const consoleOkBtn = document.getElementById('nfe-emission-ok-btn');
            
            if (consoleOverlay) consoleOverlay.classList.remove('hidden');
            if (consoleDetails) consoleDetails.innerHTML = ''; // Limpar logs antigos
            if (consoleOkBtn) {
                consoleOkBtn.classList.add('hidden'); // Ocultar botão OK no início
                // Remover listeners antigos para evitar duplicidade
                const novoOkBtn = consoleOkBtn.cloneNode(true);
                consoleOkBtn.parentNode.replaceChild(novoOkBtn, consoleOkBtn);
                
                novoOkBtn.addEventListener('click', () => {
                    document.getElementById('nfe-emission-overlay').classList.add('hidden');
                    _closeNfeEditModal();
                    _filterPedidos();
                    _openOrderDetailsModal(idPedido);
                });
            }

            // 1. Salvar os dados editados no Pedido de Venda primeiro (Bling V3)
            let stepSave = _printNfeConsoleLog('Salvando alterações do pedido no Bling...');
            const saveResult = await _saveOrderEdit(true, true);
            if (!saveResult || !saveResult.success) {
                _updateNfeConsoleLog(stepSave, 'error');
                _printNfeConsoleLog(`Erro ao salvar pedido: ${saveResult?.error || 'Erro desconhecido'}`, 'error');
                throw new Error("Falha ao salvar edições no pedido");
            }
            _updateNfeConsoleLog(stepSave, 'success');

            // 2. Chamar o backend para gerar a NFe através do pedido
            let stepGenerate = _printNfeConsoleLog('Enviando comando de geração de NF-e...');
            let res;
            try {
                res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}/gerar-nfe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ somenteGerar })
                });
            } catch (networkError) {
                _updateNfeConsoleLog(stepGenerate, 'error');
                _printNfeConsoleLog(`Tempo limite de conexão excedido ou falha de rede.`, 'error');
                _printNfeConsoleLog(`⚠️ ATENÇÃO: A NF-e pode ter sido gerada com sucesso no Bling!`, 'info');
                _printNfeConsoleLog(`A Sefaz pode estar lenta. Verifique diretamente no painel do Bling.`, 'info');
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: 'A conexão caiu, mas a NF-e pode ter sido emitida no Bling. Verifique lá!',
                        duration: 8000,
                        gravity: 'top',
                        position: 'center',
                        style: { background: 'linear-gradient(to right, #f59e0b, #d97706)' }
                    }).showToast();
                }
                return; // Encerra a função silenciosamente em vez de estourar o erro no console de novo
            }

            const result = await res.json();

            if (!res.ok) {
                _updateNfeConsoleLog(stepGenerate, 'error');
                const errorMsg = result.message || 'Falha ao gerar NF-e.';
                const details = result.details ? ` (Detalhes: ${JSON.stringify(result.details)})` : '';
                _printNfeConsoleLog(`${errorMsg}${details}`, 'error');
                throw new Error("Falha na API");
            }
            _updateNfeConsoleLog(stepGenerate, 'success');

            let stepSefaz = null;
            if (!somenteGerar) {
                stepSefaz = _printNfeConsoleLog('Aguardando resposta da SEFAZ...');
            }

            if (result.status === 'partial_success' || result.status === 'draft_success') {
                if (stepSefaz) _updateNfeConsoleLog(stepSefaz, 'error');
                
                // Nota criada mas não enviada (rascunho ou falha no envio)
                const toastText = result.status === 'draft_success'
                    ? `Rascunho criado! ID da Nota: ${result.data?.idNota || ''}.`
                    : 'Nota criada, mas o envio falhou: ' + result.message;
                
                _printNfeConsoleLog(toastText, result.status === 'draft_success' ? 'info' : 'error');
                
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: result.status === 'draft_success' ? '✅ Rascunho criado no Bling!' : 'Atenção: Falha ao enviar para SEFAZ',
                        duration: 7000,
                        gravity: 'top',
                        position: 'center',
                        style: { background: 'linear-gradient(to right, #f59e0b, #d97706)' }
                    }).showToast();
                }
            } else {
                if (stepSefaz) _updateNfeConsoleLog(stepSefaz, 'success');
                _printNfeConsoleLog(`🚀 NF-e Gerada e Autorizada com Sucesso! (ID: ${result.data?.idNota || ''})`, 'success');
                
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: '🚀 NF-e Gerada com Sucesso!',
                        duration: 4000,
                        gravity: 'top',
                        position: 'center',
                        style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' }
                    }).showToast();
                }
            }

            // Atualizar localmente o pedido com o novo ID da nota e status "Atendido"
            const pedidoLocal = _allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido));
            if (pedidoLocal) {
                const idNota = result.data?.idNota || result.idNota || result.data?.idNotaFiscal || result.idNotaFiscal || '';
                if (idNota) {
                    pedidoLocal.id_nota = idNota;
                    pedidoLocal['id nota'] = idNota;
                    pedidoLocal['idnotafiscal'] = idNota;
                    
                    // Injeta a NFe provisória no cache para o frontend já exibir que está em processamento
                    if (window._allNFeData) {
                        const existingNfe = window._allNFeData.find(n => String(n.id) === String(idNota) || String(n.id_nota) === String(idNota));
                        if (!existingNfe) {
                            window._allNFeData.push({
                                id: idNota,
                                id_nota: idNota,
                                id_pedido: idPedido,
                                numero: 'SEFAZ...',
                                serie: '-',
                                chaveAcesso: '',
                                linkDanfe: '#'
                            });
                        }
                    }
                }
                const atendidoLabel = 'Atendido';
                pedidoLocal.situação = atendidoLabel;
                pedidoLocal.situacao = atendidoLabel;
            }

        } catch (err) {
            console.error('[EmitirNFe Customizada] Erro:', err);
            // Mostrar botão ok para o usuário fechar o modal mesmo com erro
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
            if (_state.draftNfeEditBtn) _state.draftNfeEditBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            
            // Exibir o botão OK para fechar o console
            const novoOkBtn = document.getElementById('nfe-emission-ok-btn');
            if (novoOkBtn) novoOkBtn.classList.remove('hidden');
        }
    }

    function _formatCurrencyInput(inputEl) {
        if (!inputEl) return;
        
        function formatValue(value) {
            let clean = String(value).replace(/\D/g, '');
            if (!clean || clean === '00' || clean === '0') return 'R$ 0,00';
            
            let cents = parseInt(clean, 10);
            let valFloat = cents / 100;
            
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(valFloat);
        }
        
        // Formata valor inicial se for numérico puro
        if (inputEl.value && !inputEl.value.includes('R$')) {
            const num = parseFloat(inputEl.value) || 0;
            inputEl.value = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(num);
        }
        
        inputEl.addEventListener('input', (e) => {
            e.target.value = formatValue(e.target.value);
        });
        
        inputEl.addEventListener('focus', () => {
            setTimeout(() => {
                inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
            }, 10);
        });
    }

    async function _handlePrintNfe() {
        const idPedido = _currentModalPedidoId;
        const pedido = _allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido));
        const idNotaFromPedido = pedido?.id_nota || pedido?.idNota || pedido?.['id nota'] || pedido?.idnotafiscal || pedido?.id_nota_fiscal || pedido?.['id nota fiscal'] || '';
        const orderNumber = pedido?.numero || pedido?.número || '';
        
        const nfeVinculada = (window._allNFeData || []).find(n => 
            (n.id_pedido && String(n.id_pedido) === String(idPedido)) || 
            (n.idPedido && String(n.idPedido) === String(idPedido)) ||
            (n.numero_pedido && String(n.numero_pedido) === String(orderNumber)) ||
            (n.id_nota && idNotaFromPedido && String(n.id_nota) === String(idNotaFromPedido)) ||
            (n.idNota && idNotaFromPedido && String(n.idNota) === String(idNotaFromPedido))
        );
        const idNota = nfeVinculada?.id || nfeVinculada?.id_nota || nfeVinculada?.idNota || nfeVinculada?.numero || idNotaFromPedido;

        if (!idNota) {
            const wantEmit = await _showCustomConfirm('Atenção', 'Este pedido ainda não possui Nota Fiscal emitida. Deseja emitir agora?');
            if (wantEmit) {
                _handleEmitirNfe();
            }
            return;
        }

        // Tenta usar o link da DANFE se estiver no cache
        const linkDanfe = nfeVinculada?.['Link DANFE'] || nfeVinculada?.link_danfe || nfeVinculada?.linkDanfe || nfeVinculada?.link;
        
        if (linkDanfe && linkDanfe !== '#') {
            window.open(linkDanfe, '_blank');
            return;
        }

        const win = window.open(`https://www.bling.com.br/notas.fiscais.php#edit/${idNota}`, '_blank');
        if (win) {
            win.focus();
        } else {
            alert('Por favor, permita pop-ups para abrir a nota fiscal.');
        }
    }

    // --- LOGICA DE EDIÇÃO RÁPIDA DE ITEM ---

    function _handleModalPrint(showValorParam = null) {
        const modal = document.getElementById('order-details-modal');
        if (!modal) return;
        const orderNumber = modal.dataset.currentOrderNumber;
        if (!orderNumber) return;

        const pedido = _allPedidos.find(p => (p.id === orderNumber) || (p.número === orderNumber) || (p.numero === orderNumber));
        if (!pedido) return;

        // Verificar se valor deve ser incluído (se não especificado, padrão true)
        const showValor = showValorParam !== null && showValorParam !== undefined ? Boolean(showValorParam) : true;

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
        const finalId = pedido.id || pedido.id_pedido || orderNumber;
        const itensList = _parseItens(itensRaw, pedido.detalhesProducao || {}, finalId);

        // Montar linhas da tabela a partir das imagens já carregadas no modal
        const itensRows = itensList.map((item, index) => {
            const imgEl  = document.getElementById(`img-${item.codigo}-${index}`);
            const descEl = document.getElementById(`desc-${item.codigo}-${index}`);
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
    async function _handleSyncOrder() {
        const modal = document.getElementById('order-details-modal');
        if (!modal) return;
        
        const orderNumber = modal.dataset.currentOrderNumber;
        if (!orderNumber) return;

        const pedidoOriginal = _allPedidos.find(p => (p.id === orderNumber) || (p.número === orderNumber) || (p.numero === orderNumber));
        if (!pedidoOriginal) return;

        const idParaEnviar = pedidoOriginal.id || pedidoOriginal.id_pedido || pedidoOriginal['id pedido'] || orderNumber;

        const syncBtn = document.getElementById('modal-sync-order-btn');
        let originalHtml = '';
        if (syncBtn) {
            originalHtml = syncBtn.innerHTML;
            syncBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sincronizando...`;
            syncBtn.disabled = true;
        }

        try {
            // 1. Busca os dados mais recentes diretamente do Bling
            const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idParaEnviar}`);
            if (!res.ok) throw new Error('Falha ao buscar pedido no Bling (Status ' + res.status + ')');
            const json = await res.json();
            const blingData = json.data ? json.data : json;

            // 2. Dispara o Webhook internamente em BACKGROUND (sem await) para gravar na planilha
            const baseUrl = API_URLS.ORDERS_BLING.replace('/pedidos', '');
            
            // Webhook de Pedidos
            fetch(`${baseUrl}/bling/pedidos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'pedido.updated', // Campo obrigatório para o backend não quebrar
                    data: blingData 
                })
            }).catch(e => console.error("Erro ao notificar webhook de pedido:", e));

            // Webhook de NF-e (se houver nota, sincroniza também a planilha de notas)
            if (blingData.notaFiscal && blingData.notaFiscal.id) {
                fetch(`${baseUrl}/bling/nfe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'invoice.updated',
                        data: { id: blingData.notaFiscal.id }
                    })
                }).catch(e => console.error("Erro ao notificar webhook de NFe:", e));
            }

            // 3. Traduz os dados do Bling para o formato da interface instantaneamente
            const situacaoMap = {
                6: "Em aberto", 9: "Atendido", 12: "Cancelado", 15: "Em andamento", 24: "Em andamento"
            };
            const novaSituacao = blingData.situacao ? (situacaoMap[blingData.situacao.id] || "N/A") : "N/A";
            const novoIdNota = blingData.notaFiscal ? blingData.notaFiscal.id : "";

            // 4. Faz o Merge local para evitar o Race Condition de leitura da planilha (que é lenta)
            const index = _allPedidos.findIndex(p => p.id === pedidoOriginal.id || p.numero === pedidoOriginal.numero);
            if (index !== -1) {
                _allPedidos[index].situacao = novaSituacao;
                if (novoIdNota) _allPedidos[index].id_nota = novoIdNota;
                if (blingData.contato?.nome) _allPedidos[index].contato_nome = blingData.contato.nome;
            }

            // 5. Atualiza a tabela global
            _filterPedidos();

            // 6. Reabre o menu de impressão
            const printDropdownMenu = document.getElementById('modal-print-dropdown-menu');
            if (printDropdownMenu) {
                printDropdownMenu.classList.add('hidden');
            }

            // 7. Reabre o modal já com os dados corretos forçados na memória
            _openOrderDetailsModal(orderNumber);

        } catch (error) {
            console.error('Erro ao sincronizar:', error);
            alert('Não foi possível sincronizar o pedido. Verifique o console.');
        } finally {
            if (syncBtn) {
                syncBtn.innerHTML = originalHtml;
                syncBtn.disabled = false;
            }
        }
    }

    function _handlePrintLadosCima() {
        const win = window.open('', '_blank');
        if (!win) {
            alert('Por favor, permita pop-ups para imprimir.');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lado Para Cima</title>
                <style>
                    @page { margin: 10mm; size: A4 landscape; }
                    * { box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: 'Arial Black', Impact, sans-serif; 
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        background: white;
                        color: black;
                    }
                    .container {
                        width: 100%;
                        height: 100%;
                        border: 20px solid black;
                        border-radius: 40px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: space-between;
                        padding: 30px 20px;
                    }
                    .arrow-wrapper {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 15%;
                        width: 100%;
                        padding: 20px 0;
                    }
                    svg {
                        width: auto;
                        height: 100%;
                        max-height: 55vh;
                    }
                    .text-box {
                        text-align: center;
                        width: 100%;
                        padding-bottom: 20px;
                    }
                    h1 {
                        font-size: 80px;
                        font-weight: 900;
                        margin: 0;
                        text-transform: uppercase;
                        line-height: 1.1;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="arrow-wrapper">
                        <svg viewBox="0 0 24 24" fill="black">
                            <path d="M12 1 L1 13 h6 v10 h10 v-10 h6 L12 1 z"/>
                        </svg>
                        <svg viewBox="0 0 24 24" fill="black">
                            <path d="M12 1 L1 13 h6 v10 h10 v-10 h6 L12 1 z"/>
                        </svg>
                    </div>
                    <div class="text-box">
                        <h1>ESTE LADO PARA CIMA</h1>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => window.close(), 500);
                        }, 250);
                    };
                </script>
            </body>
            </html>
        `;
        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    async function _handlePrintMarker(smallMarker = false) {
        const modal = document.getElementById('order-details-modal');
        if (!modal) return;
        const orderNumber = modal.dataset.currentOrderNumber;
        if (!orderNumber) return;

        const pedido = _allPedidos.find(p => 
            String(p.id || '') === String(orderNumber) || 
            String(p.número || '') === String(orderNumber) || 
            String(p.numero || '') === String(orderNumber)
        );
        if (!pedido) return;

        const printWindow = window.open('', '_blank', 'width=850,height=750');
        if (!printWindow) {
            alert('Por favor, permita pop-ups no seu navegador para imprimir.');
            return;
        }
        printWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Carregando informações da transportadora...</h2></body></html>');

        const cliente = (pedido.contato_nome || pedido['contato nome'] || pedido.cliente || '-').toUpperCase();
        const vendedorFull = _getVendedorName(pedido.vendedor || '');
        const vendedor = vendedorFull.split(' ')[0];
        const now = new Date().toLocaleString('pt-BR');

        const pedidoId = String(pedido.id || pedido.id_pedido || pedido['id pedido'] || pedido.numero || '').trim();
        const numPedido = String(pedido.numero || pedido.número || orderNumber || '').trim();
        const idNota = String(
            pedido.id_nota || 
            pedido.idNota || 
            pedido['id nota'] || 
            pedido.idnotafiscal || 
            pedido.id_nota_fiscal || 
            pedido['id nota fiscal'] || 
            ''
        ).trim();

        // Busca a NF-e vinculada EXCLUSIVAMENTE a este pedido
        const nfeObj = (window._allNFeData || []).find(n => {
            const nIdPedido = String(n.id_pedido || n.idPedido || '').trim();
            const nNumPedido = String(n.numero_pedido || n.numeroPedido || '').trim();
            const nIdNota = String(n.id_nota || n.idNota || n.id || '').trim();
            const nNumeroNota = String(n.numero || n.numero_da_nota || '').trim();

            if (pedidoId && nIdPedido && nIdPedido === pedidoId) return true;
            if (numPedido && nNumPedido && nNumPedido === numPedido) return true;
            if (idNota && nIdNota && nIdNota === idNota) return true;
            if (idNota && nNumeroNota && nNumeroNota === idNota) return true;
            return false;
        });

        let nfeNum = '';
        if (nfeObj) {
            const num = nfeObj.numero || nfeObj.numero_da_nota || '';
            if (num && String(num) !== 'SEFAZ...') {
                nfeNum = String(num);
            }
        }

        // Tenta pegar direto da interface gráfica do modal do pedido aberto como fallback
        if (!nfeNum) {
            const nfeDisplayEl = document.getElementById('modal-nfe-numero-display');
            if (nfeDisplayEl && nfeDisplayEl.innerText) {
                const match = nfeDisplayEl.innerText.match(/Nº\s*(\d+)/i);
                if (match && match[1]) {
                    nfeNum = match[1];
                }
            }
        }

        function isInvalidOrRetirada(tNome, cliNome) {
            if (!tNome) return true;
            const t = String(tNome).trim().toUpperCase();
            if (!t || t === '-' || t === '0' || t === 'NULL' || t === 'UNDEFINED') return true;

            // Termos que indicam retirada ou ausência de transportadora
            const retiradaTerms = [
                'RETIRADA', 'BALCAO', 'BALCÃO', 'CLIENTE RETIRA', 'RETIRA CLIENTE', 
                'SEM FRETE', 'SEM TRANSPORTE', 'SEM TRANSPORTADORA', 'SEM OCORRENCIA',
                'TRANSPORTE PROPRIO', 'TRANSPORTE PRÓPRIO', 'PROPRIO', 'PRÓPRIO',
                'ENTREGA PROPRIA', 'ENTREGA PRÓPRIA', 'A RETIRAR', 'VAI RETIRAR'
            ];
            if (retiradaTerms.some(term => t.includes(term))) return true;

            // Se o nome da transportadora for igual ou muito similar ao nome do cliente (destinatário)
            if (cliNome) {
                const c = String(cliNome).trim().toUpperCase();
                if (c) {
                    if (t === c || c.includes(t) || t.includes(c)) return true;
                    const wordsT = t.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => w.length > 2);
                    const wordsC = c.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => w.length > 2);
                    if (wordsT.length >= 2 && wordsC.length >= 2) {
                        if (wordsT[0] === wordsC[0] && wordsT[1] === wordsC[1]) return true;
                    } else if (wordsT.length === 1 && wordsC.length >= 1) {
                        if (wordsT[0] === wordsC[0]) return true;
                    }
                }
            }
            return false;
        }

        // Tentar obter a Transportadora para ESTE pedido
        let transpNome = '';
        if (pedido.transportadora && !isInvalidOrRetirada(pedido.transportadora, cliente)) {
            transpNome = String(pedido.transportadora);
        } else if (pedido.transporte && !isInvalidOrRetirada(pedido.transporte, cliente)) {
            transpNome = String(pedido.transporte);
        } else if (nfeObj && nfeObj.transportadora && !isInvalidOrRetirada(nfeObj.transportadora, cliente)) {
            transpNome = String(nfeObj.transportadora);
        } else if (nfeObj && nfeObj.transporte && !isInvalidOrRetirada(nfeObj.transporte, cliente)) {
            transpNome = String(nfeObj.transporte);
        }

        // Se o modal de edição de NF-e estiver VISÍVEL especificamente para este pedido, considera a seleção do usuário
        if (!transpNome && _state.nfeEditModal && !_state.nfeEditModal.classList.contains('hidden') && String(_currentModalPedidoId || '') === pedidoId) {
            const isSemFrete = _state.nfeEditFretePorConta && parseInt(_state.nfeEditFretePorConta.value) === 9;
            if (!isSemFrete) {
                const selectTransp = document.getElementById('nfe-edit-transportadora');
                if (selectTransp && selectTransp.selectedIndex > 0) {
                    const optText = selectTransp.options[selectTransp.selectedIndex].text;
                    if (optText && !optText.toUpperCase().includes('SELECIONE') && !optText.toUpperCase().includes('CARREGANDO')) {
                        if (!isInvalidOrRetirada(optText, cliente)) {
                            transpNome = optText;
                        }
                    }
                }
                if (!transpNome && _state.currentPedidoBlingBruto && String(_state.currentPedidoBlingBruto.id || '') === pedidoId) {
                    const cNome = _state.currentPedidoBlingBruto.transporte?.contato?.nome || '';
                    if (!isInvalidOrRetirada(cNome, cliente)) {
                        transpNome = cNome;
                    }
                }
            }
        }

        // Se ainda não temos a transportadora, busca direto na API de vendas do Bling para este pedido específico
        if (!transpNome) {
            try {
                const fetchId = pedido.id || pedido.id_pedido || pedido['id pedido'] || orderNumber;
                const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${fetchId}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result && result.data) {
                        const bData = result.data;
                        const fretePorConta = bData.transporte?.fretePorConta;
                        // 9 = Sem Ocorrência de Transporte (ou sem frete / retirada)
                        if (fretePorConta === 9 || String(fretePorConta) === '9') {
                            transpNome = '';
                        } else if (bData.transporte?.contato?.nome && !isInvalidOrRetirada(bData.transporte.contato.nome, cliente)) {
                            transpNome = bData.transporte.contato.nome;
                        } else if (bData.transportadora && typeof bData.transportadora === 'string' && !isInvalidOrRetirada(bData.transportadora, cliente)) {
                            transpNome = bData.transportadora;
                        }
                    }
                }
            } catch(e) {
                console.error("Erro ao buscar transportadora no Bling para o marcador:", e);
            }
        }

        if (transpNome && !isInvalidOrRetirada(transpNome, cliente)) {
            transpNome = transpNome.trim().toUpperCase();
            pedido.transportadora = transpNome; // Salva no objeto para cliques subsequentes
        } else {
            transpNome = '';
            pedido.transportadora = ''; // Limpa para evitar cache incorreto
        }

        printWindow.document.open();
        
        const pageMedia = smallMarker ? '@page { size: A6 portrait; margin: 0; }' : '@page { size: A4 landscape; margin: 0; }';
        const nameFontSize = smallMarker ? '70px' : '180px';
        const serviceFontSize = smallMarker ? '26px' : '52px';
        const detailsFontSize = smallMarker ? '18px' : '34px';
        const detailsLargeSize = smallMarker ? '20px' : '38px';
        
        printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Marcador - ${cliente}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Arial Black', Gadget, sans-serif; 
            background: #fff; 
            padding: 10px; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            width: 100vw;
            height: 100vh;
            text-align: center;
            overflow: hidden;
        }

        .container {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .company-name { 
            font-size: ${nameFontSize}; 
            font-weight: 900; 
            color: #000; 
            line-height: 0.95;
            margin-bottom: 15px;
            word-wrap: break-word;
            width: 100%;
            text-transform: uppercase;
        }

        .mks-service { 
            font-size: ${serviceFontSize}; 
            font-weight: normal; 
            color: #000; 
            margin-bottom: 10px;
            font-family: Arial, sans-serif;
            border-top: 8px solid #000;
            padding-top: 15px;
            display: inline-block;
            width: 80%;
        }

        .vendedor { 
            font-size: ${detailsFontSize}; 
            color: #333; 
            font-family: Arial, sans-serif;
            font-weight: normal;
        }

        .footer {
            position: fixed;
            bottom: 10px;
            right: 15px;
            font-size: 9px;
            color: #999;
            font-family: Arial, sans-serif;
        }

        @media print {
            body { padding: 0; margin: 0; height: 100vh; width: 100vw; }
            ${pageMedia}
        }
    </style>
</head>
<body>
    <div class="container" id="print-container">
        <div class="company-name" id="company-name">${cliente}</div>
        <div class="mks-service">MKS - Service</div>
        <br>
        <div class="vendedor" style="font-size: ${detailsLargeSize};">Vendedor: ${vendedor}${nfeNum ? ` | <strong>NF-e: ${nfeNum}</strong>` : ''}</div>
        ${transpNome ? `<div class="vendedor" style="margin-top: 15px; font-size: ${detailsLargeSize};">Transportadora: <strong>${transpNome}</strong></div>` : ''}
    </div>
    <div class="footer">Gerado em ${now}</div>
    <script>
        window.onload = function(){ 
            const el = document.getElementById('company-name');
            const container = document.getElementById('print-container');
            
            let fontSize = ${smallMarker ? '70' : '180'}; 
            el.style.fontSize = fontSize + 'px';
            
            // Verifica se a altura do container (conteúdo) passa da altura da janela
            // Usamos um limite de 98% para capturar o transbordo real
            function isTooBig() {
                return container.offsetHeight > window.innerHeight * 0.98;
            }

            // Reduz gradualmente até caber na altura total disponível
            // Definimos 40px como mínimo para que nunca fique "pequeno"
            while (isTooBig() && fontSize > 40) {
                fontSize -= 2;
                el.style.fontSize = fontSize + 'px';
            }
            
            setTimeout(() => {
                window.print(); 
                window.onafterprint = function(){ window.close(); } 
            }, 600);
        }
    </script>
</body>
</html>`);
        printWindow.document.close();
    }


    // --- Modais de Interface Customizados ---
    function _showCustomConfirm(title, message) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] transition-opacity';
            overlay.innerHTML = `
                <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center transform scale-100 transition-transform">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">${title}</h3>
                    <p class="text-gray-600 mb-6">${message}</p>
                    <div class="flex justify-center gap-3">
                        <button id="custom-modal-no" class="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors w-full cursor-pointer">Cancelar</button>
                        <button id="custom-modal-yes" class="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-colors w-full cursor-pointer">Sim</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('custom-modal-no').onclick = () => { overlay.remove(); resolve(false); };
            document.getElementById('custom-modal-yes').onclick = () => { overlay.remove(); resolve(true); };
        });
    }

    function _showCustomAlert(title, message, isSuccess = true) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] transition-opacity';
            const iconHtml = isSuccess 
                ? `<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>`
                : `<div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></div>`;
            
            overlay.innerHTML = `
                <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center transform scale-100 transition-transform">
                    ${iconHtml}
                    <h3 class="text-xl font-bold text-gray-800 mb-2">${title}</h3>
                    <p class="text-gray-600 mb-6">${message}</p>
                    <button id="custom-alert-ok" class="px-6 py-2.5 ${isSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-semibold rounded-xl shadow-md transition-colors w-full cursor-pointer">OK</button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('custom-alert-ok').onclick = () => { overlay.remove(); resolve(); };
        });
    }

    async function _handleModalChangeStatus(newStatusId, label, btnEl) {
        const orderNumber = document.getElementById('order-details-modal')?.dataset?.currentOrderNumber;
        if (!orderNumber) return;

        const pedido = _allPedidos.find(p => (p.id === orderNumber) || (p.número === orderNumber) || (p.numero === orderNumber));
        const idParaEnviar = pedido?.id || pedido?.id_pedido || pedido?.['id pedido'] || orderNumber;

        const confirmResult = await _showCustomConfirm('Atenção', `Deseja realmente alterar o Pedido Nº ${orderNumber} para <strong>${label}</strong>?`);
        if (!confirmResult) return;

        const originalBtnHtml = btnEl ? btnEl.innerHTML : null;
        if (btnEl) {
            btnEl.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Gravando...`;
        }

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

            // Fechar modal imediatamente para mostrar agilidade
            document.getElementById('order-details-modal')?.classList.add('hidden');
            
            await _showCustomAlert('Sucesso!', `Pedido Nº ${orderNumber} alterado para "${label}" com sucesso!`, true);

            await fetchPedidos(true);

        } catch (err) {
            console.error('Erro ao mudar status do pedido:', err);
            await _showCustomAlert('Erro na Atualização', err.message, false);
        } finally {
            if (btnEl && originalBtnHtml) btnEl.innerHTML = originalBtnHtml;
            if (container) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            }
        }
    }


    function _showProgressModal(title, message, progressStr) {
        let overlay = document.getElementById('batch-progress-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'batch-progress-modal';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] transition-opacity';
            overlay.innerHTML = `
                <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center transform scale-100 transition-transform">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <h3 id="batch-progress-title" class="text-xl font-bold text-gray-800 mb-2">${title}</h3>
                    <div id="batch-progress-message" class="text-gray-600 mb-4 text-sm"></div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                        <div id="batch-progress-bar" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                    <p id="batch-progress-str" class="text-sm font-semibold text-blue-600"></p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        document.getElementById('batch-progress-title').innerHTML = title;
        document.getElementById('batch-progress-message').innerHTML = message;
        document.getElementById('batch-progress-str').innerHTML = progressStr;
        
        const match = progressStr.match(/(\d+) de (\d+)/);
        if (match) {
            const pct = (parseInt(match[1]) / parseInt(match[2])) * 100;
            document.getElementById('batch-progress-bar').style.width = `${pct}%`;
        }
    }

    function _hideProgressModal() {
        const overlay = document.getElementById('batch-progress-modal');
        if (overlay) overlay.remove();
    }

    async function _processBatchQueue(idsArray, newStatusId, label) {
        let sucessos = [];
        let erros = [];
        const backendUrl = API_URLS.ORDERS_BLING ? API_URLS.ORDERS_BLING.replace('/pedidos', '/pedidos/update-status') : "https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos/update-status";

        for (let i = 0; i < idsArray.length; i++) {
            const id = idsArray[i];
            const p = _allPedidos.find(ped => String(ped.id) === String(id) || String(ped.numero) === String(id) || String(ped.número) === String(id));
            const numeroDisplay = p ? (p.numero || p.número || id) : id;

            _showProgressModal('Atualizando Pedidos', `Processando pedido <strong>${numeroDisplay}</strong>...`, `${i + 1} de ${idsArray.length}`);

            try {
                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [id], idSituacao: newStatusId })
                });

                const json = await response.json();
                
                let isSuccess = false;
                let errMsg = '';
                if (response.ok && json.status !== 'error') {
                     if (json.data && json.data.erros && json.data.erros.length > 0) {
                         errMsg = json.data.erros[0].erro || 'Erro no Bling';
                         
                         // Tratamento específico: Bling retorna esse erro genérico quando o pedido já está na situação desejada
                         if (errMsg.toLowerCase().includes('não foi possível alterar') || errMsg.toLowerCase().includes('nao foi possivel alterar')) {
                             isSuccess = true;
                         } else {
                             isSuccess = false;
                         }
                     } else {
                         isSuccess = true;
                     }
                } else {
                     errMsg = json.message || 'Erro de conexão/servidor';
                }

                if (isSuccess) {
                    sucessos.push(id);
                } else {
                    erros.push({ id: id, numero: numeroDisplay, erro: errMsg });
                }
            } catch (error) {
                erros.push({ id: id, numero: numeroDisplay, erro: error.message });
            }
            
            // Pausa de 300ms entre as requisições para não sobrecarregar
            await new Promise(r => setTimeout(r, 300));
        }
        
        _hideProgressModal();
        return { sucessos, erros };
    }

    async function _executeBatchWithRetry(idsArray, newStatusId, label) {
        if (_loadingEl) _loadingEl.classList.remove('hidden');
        if (_tableContent) _tableContent.innerHTML = '';
        _batchActionsContainer.classList.add('hidden');

        const results = await _processBatchQueue(idsArray, newStatusId, label);
        
        if (results.erros.length > 0) {
            let errorListHtml = results.erros.map(e => `<strong>Pedido ${e.numero}:</strong> ${e.erro}`).join('<br>');
            const wantRetry = await _showCustomConfirm('Alguns pedidos falharam', 
                `Sucessos: <strong>${results.sucessos.length}</strong><br>Erros: <strong>${results.erros.length}</strong><br><br>
                 <div class="text-left text-xs max-h-32 overflow-y-auto mb-2 text-red-600 bg-red-50 p-2 rounded border border-red-100">${errorListHtml}</div>
                 Deseja tentar reenviar os que falharam?`);
            
            if (wantRetry) {
                const failedIds = results.erros.map(e => e.id);
                await _executeBatchWithRetry(failedIds, newStatusId, label);
                return;
            }
        } else {
            await _showCustomAlert('Concluído!', `Os pedidos foram atualizados para "${label}".<br>Total: <strong>${results.sucessos.length}</strong>`, true);
        }
        
        await fetchPedidos(true);
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

        let msg = idsToUpdate.length === allIds.length 
            ? `Mudar ${idsToUpdate.length} pedido(s) para "${label}"?`
            : `Mudar ${idsToUpdate.length} pedido(s) para "${label}"?\n(${allIds.length - idsToUpdate.length} pedidos serão ignorados).`;

        if (!confirm(msg)) return;

        await _executeBatchWithRetry(idsToUpdate, newStatusId, label);
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
            console.time('[Desempenho] Busca de Pedidos na API (Bling/Proxy)');
            const url = API_URLS.ORDERS_BLING || "https://bling-proxy-api-255108547424.southamerica-east1.run.app/pedidos";
            const response = await fetch(url + (force ? "?t=" + new Date().getTime() : ""), { mode: 'cors' });
            
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const json = await response.json();
            console.timeEnd('[Desempenho] Busca de Pedidos na API (Bling/Proxy)');
            
            console.time('[Desempenho] Renderização e Filtro da Tabela de Pedidos');
            if (json.status === 'success' && json.data) {
                _allPedidos = json.data;
                _preProducaoItems = Array.isArray(json.preProducao) ? json.preProducao : [];
                _garantiaProducaoItems = Array.isArray(json.garantia) ? json.garantia : [];
                _populateYearFilter();
            } else {
                _allPedidos = [];
                _preProducaoItems = [];
                _garantiaProducaoItems = [];
            }
            _filterPedidos();
            const lpModalEl = document.getElementById('production-line-modal');
            if (lpModalEl && !lpModalEl.classList.contains('hidden')) {
                _showProductionLine();
            }
            console.timeEnd('[Desempenho] Renderização e Filtro da Tabela de Pedidos');

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

    function _updatePedidoItemInCache(pedido, itemIndex, newStatus, newDescription, responsavel, dataPedido, quantidade, vendedor) {
        if (!pedido) return;
        if (!pedido.detalhesProducao) pedido.detalhesProducao = {};
        
        const pid = String(pedido.id || pedido.id_pedido || '');
        const pnum = String(pedido.numero || pedido.número || pedido.numero_pedido || '');
        const idxStr = String(itemIndex);

        // Atualiza todas as chaves existentes ou potenciais para esse item
        const keysToUpdate = new Set();
        if (pid) keysToUpdate.add(`${pid}-${idxStr}`);
        if (pnum) keysToUpdate.add(`${pnum}-${idxStr}`);
        
        // Procura qualquer chave existente em detalhesProducao que termine com -idxStr
        Object.keys(pedido.detalhesProducao).forEach(k => {
            if (k.endsWith(`-${idxStr}`)) keysToUpdate.add(k);
        });

        keysToUpdate.forEach(k => {
            const prev = pedido.detalhesProducao[k] || {};
            pedido.detalhesProducao[k] = {
                status: newStatus !== undefined ? newStatus : (prev.status || 'OK'),
                descricao: newDescription !== undefined ? newDescription : (prev.descricao || ''),
                data: dataPedido !== undefined ? dataPedido : (prev.data || ''),
                responsavel: responsavel !== undefined ? responsavel : (prev.responsavel || ''),
                quantidade: quantidade !== undefined ? quantidade : (prev.quantidade !== undefined ? prev.quantidade : ''),
                vendedor: vendedor !== undefined ? vendedor : (prev.vendedor || '')
            };
        });

        // Se itens for string, atualiza o status inline na string também
        const rawItens = typeof pedido.itens === 'string' ? pedido.itens : (typeof pedido.Itens === 'string' ? pedido.Itens : null);
        if (rawItens && newStatus !== undefined) {
            try {
                const itemStrings = String(rawItens).split(/(?=\([^,]+,\s*\d+)/).filter(Boolean);
                const items = [];
                itemStrings.forEach((s, i) => {
                    let c = s.trim();
                    if (c.startsWith('(')) c = c.substring(1);
                    if (c.endsWith(')')) { if (((c.match(/\(/g) || []).length < (c.match(/\)/g) || []).length)) c = c.substring(0, c.length - 1); }
                    const p = c.split(',').map(x => x.trim());
                    if (p.length >= 3) {
                        let v = p[2];
                        if (v.includes('|')) v = v.split('|')[0];
                        let st = (String(i) === idxStr) ? newStatus : (p[2].includes('|') ? p[2].split('|')[1] : 'OK');
                        items.push(`(${p[0]}, ${p[1]}, ${v}|${st})`);
                    } else {
                        items.push(s);
                    }
                });
                if (items.length > 0) {
                    const updatedStr = items.join(' ');
                    pedido.itens = updatedStr;
                    if (pedido.Itens) pedido.Itens = updatedStr;
                }
            } catch (e) {
                console.warn('[Cache] Erro ao sincronizar itens string:', e);
            }
        }
    }

    function _updateOrderRowStatus(p) {
        if (!p) return;
        const numero = p.numero || p.número || p.id;
        if (!numero) return;

        // Se estiver filtrado por 'producao', re-filtra para que o pedido entre ou saia da lista instantaneamente
        if (_statusSelect && _statusSelect.value === 'producao') {
            _filterPedidos();
            return;
        }

        // Se a linha estiver renderizada na tabela atual, atualiza o status diretamente no DOM
        const row = document.getElementById(`pedido-row-${numero}`);
        if (row) {
            const statusTd = row.querySelector('.order-cell-status');
            if (statusTd) {
                const situacao = _getStatusLabel(p.situação || p.situacao || p.situao || '');
                const sitLower = situacao.toLowerCase();
                let badgeClass = 'bg-gray-100 text-gray-800';
                if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badgeClass = 'bg-green-100 text-green-800';
                else if (sitLower.includes('cancel')) badgeClass = 'bg-red-100 text-red-800';
                else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento') || sitLower.includes('analise')) badgeClass = 'bg-yellow-100 text-yellow-800';
                else if (sitLower.includes('produ')) badgeClass = 'bg-blue-100 text-blue-800';

                const hasItemProducao = _pedidoHasItemEmProducao(p);
                const itemProdBadge = (hasItemProducao && !sitLower.includes('produ')) 
                    ? `<span class="ml-1.5 inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-800 border border-blue-200" title="Possui item em produção">Item em Produção</span>` 
                    : '';

                statusTd.innerHTML = `<span class="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${badgeClass}">${situacao}</span>${itemProdBadge}`;
                
                // Feedback visual sutil de atualização
                row.classList.add('row-update-flash');
                setTimeout(() => row.classList.remove('row-update-flash'), 1500);
            }
        }
    }

    function _pedidoHasItemEmProducao(p) {
        if (!p) return false;

        const finalId = String(p.id || p.id_pedido || p.numero || p.número || '').trim();
        const altId = String(p.numero || p.número || p.numero_pedido || '').trim();

        // 1. Verificação se itens é array
        if (Array.isArray(p.itens) && p.itens.length > 0) {
            return p.itens.some((item, idx) => {
                const key1 = `${finalId}-${idx}`;
                const key2 = `${altId}-${idx}`;
                const extra = (p.detalhesProducao && (p.detalhesProducao[key1] || p.detalhesProducao[key2])) || 
                              (p.detalhesProducao && Object.entries(p.detalhesProducao).find(([k]) => k.endsWith(`-${idx}`))?.[1]);
                let st = String((extra && extra.status) || item.status || '').toUpperCase().trim();
                if (st === 'CRIADO' || st === 'PENDENTE' || st === 'FINALIZADO' || st === 'OK') return false;
                return st === 'EM PRODUÇÃO' || st === 'PRODUCAO' || st === 'EM PRODUCAO';
            });
        }

        // 2. Verificação nos itens string via _parseItens
        const raw = typeof p.itens === 'string' ? p.itens : (typeof p.Itens === 'string' ? p.Itens : '');
        if (raw) {
            const itens = _parseItens(raw, p.detalhesProducao || {}, finalId, altId);
            if (itens && itens.length > 0) {
                return itens.some(item => {
                    let st = String(item.status || '').toUpperCase().trim();
                    if (st === 'CRIADO' || st === 'PENDENTE' || st === 'FINALIZADO' || st === 'OK') return false;
                    return st === 'EM PRODUÇÃO' || st === 'PRODUCAO' || st === 'EM PRODUCAO';
                });
            }
        }

        // 3. Fallback: se itens não estiver disponível, analisa detalhesProducao diretamente
        if (p.detalhesProducao && typeof p.detalhesProducao === 'object') {
            return Object.values(p.detalhesProducao).some(d => {
                const s = String(d?.status || '').toUpperCase().trim();
                if (s === 'CRIADO' || s === 'PENDENTE' || s === 'FINALIZADO' || s === 'OK') return false;
                return s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO';
            });
        }

        return false;
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
                const sitNormalized = _getStatusLabel(p.situação || p.situacao || p.situao || '').toLowerCase();
                
                if (sel === 'atendido') {
                    statusMatch = (sitNormalized.includes('atendid') || sitNormalized.includes('entregue') || sitNormalized.includes('conclu'));
                } else if (sel === 'aberto') {
                    statusMatch = (sitNormalized.includes('abert') || sitNormalized.includes('pendent') || sitNormalized.includes('andamento'));
                } else if (sel === 'producao') {
                    statusMatch = sitNormalized.includes('produ') || _pedidoHasItemEmProducao(p);
                } else if (sel === 'cancelado') {
                    statusMatch = sitNormalized.includes('cancel');
                }
            }

            const vendedor = _getVendedorName(p.vendedor || '').toLowerCase();
            const orcamento = String(p.orcamento || p['orcamento'] || p.orçamento || '').toLowerCase();
            const numeroLoja = String(p.numero_loja || p.numeroLoja || '').toLowerCase();
            
            // Busca dados da NFe vinculada para filtro
            let numeroNota = '';
            let chaveNota = '';
            if (window._allNFeData) {
                const nfe = window._allNFeData.find(n => 
                    String(n.id_pedido || n.idPedido || '') === String(p.id) ||
                    String(n.numero_pedido || '') === String(p.número || p.numero) ||
                    String(n.id_nota || '') === String(p.id_nota || p['id nota'] || p.idnotafiscal || p.id_nota_fiscal || p['id nota fiscal'])
                );
                if (nfe) {
                    numeroNota = String(nfe.numero || nfe.numero_da_nota || '').toLowerCase();
                    chaveNota = String(nfe.chaveAcesso || nfe.chave_acesso || '').toLowerCase();
                }
            }

            const termMatch = numero.includes(term) || 
                              cliente.includes(term) || 
                              vendedor.includes(term) || 
                              orcamento.includes(term) || 
                              numeroLoja.includes(term) ||
                              (numeroNota && numeroNota.includes(term)) ||
                              (chaveNota && chaveNota.includes(term));

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
            const newOrders = JSON.parse(localStorage.getItem('new_orders_highlight') || '[]');

            _tableContent.innerHTML = itemsToDisplay.map(p => {
                const numero = p.número || p.numero || '-';
                const cliente = p.contato_nome || p['contato nome'] || p.cliente || '-';
                const vendedor = _getVendedorName(p.vendedor);
                const situacao = _getStatusLabel(p.situação || p.situacao || p.situao || '-');
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
                else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento') || sitLower.includes('analise')) badgeClass = 'bg-yellow-100 text-yellow-800';
                else if (sitLower.includes('produ')) badgeClass = 'bg-blue-100 text-blue-800';

                const hasItemProducao = _pedidoHasItemEmProducao(p);
                const itemProdBadge = (hasItemProducao && !sitLower.includes('produ')) 
                    ? `<span class="ml-1.5 inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-800 border border-blue-200" title="Possui item em produção">Item em Produção</span>` 
                    : '';

                // Verificação de Pedido Novo e Pedido de outro mês
                const isNewOrder = newOrders.includes(String(numero)) || newOrders.includes(String(p.id));
                
                const now = new Date();
                const isOutdated = pDate && !isNaN(pDate) && (pDate.getMonth() !== now.getMonth() || pDate.getFullYear() !== now.getFullYear());

                let rowClass = 'hover:bg-gray-50 transition-colors';
                if (isNewOrder) {
                    rowClass = 'bg-blue-50 transition-colors hover:bg-blue-100';
                } else if (isOutdated) {
                    rowClass = 'bg-yellow-50 transition-colors hover:bg-yellow-100';
                }

                const firstTdClass = isNewOrder ? 'border-l-4 border-blue-500' : (isOutdated ? 'border-l-4 border-yellow-500' : 'border-l-4 border-transparent');

                return `
                    <tr id="pedido-row-${numero}" data-order-number="${numero}" class="${rowClass}">
                        <td class="${firstTdClass} px-6 py-4 whitespace-nowrap text-left text-sm">
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
                            <span class="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${badgeClass}">${situacao}</span>${itemProdBadge}
                        </td>
                        <td class="order-cell-total px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right cursor-pointer clickable-cell">${totalFormatted}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                            <span class="edit-order-observation-btn cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors inline-block" 
                                data-target-id="${numero}" 
                                title="Adicionar/Ver Observação">
                               <svg class="h-5 w-5 pointer-events-none ${(p.observacao || p.observação) ? 'text-red-500' : 'text-gray-300'} order-obs-icon-${numero}" viewBox="0 0 20 20" fill="currentColor">
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

    function _updateLinhaProducaoBtnVisibility() {
        if (!_state.linhaProducaoBtn) return;
        _state.linhaProducaoBtn.classList.remove('hidden');
    }

    const STORAGE_KEY_LP_FILTERS = 'mks_linha_producao_filters';

    function _loadLinhaProducaoFilterPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LP_FILTERS);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function _saveLinhaProducaoFilterPrefs() {
        try {
            const prefs = {
                tipo: _state.linhaProducaoFilterTipo ? _state.linhaProducaoFilterTipo.value : 'TODOS',
                responsavel: _state.linhaProducaoFilterResp ? _state.linhaProducaoFilterResp.value : 'TODOS',
                status: _state.linhaProducaoFilterStatus ? _state.linhaProducaoFilterStatus.value : 'TODOS'
            };
            localStorage.setItem(STORAGE_KEY_LP_FILTERS, JSON.stringify(prefs));
        } catch (e) {
            console.warn('[LinhaProducao] Erro ao salvar preferências de filtro:', e);
        }
    }

    const STORAGE_KEY_LP_RESPONSAVEIS = 'mks_lp_responsaveis_cache';

    function _getAllResponsaveisList() {
        const set = new Set();
        const addVal = (raw) => {
            const val = String(raw || '').trim().toUpperCase();
            if (!val || val === '-' || val === 'SEM_RESP' || val === 'SEM RESPONSÁVEL' || val === 'SEM RESPONSAVEL' || val === 'UNDEFINED' || val === 'NULL') return;
            set.add(val);
        };
        if (Array.isArray(_allPedidos)) {
            _allPedidos.forEach(p => {
                if (p.detalhesProducao) {
                    Object.values(p.detalhesProducao).forEach(d => {
                        if (d && d.responsavel) addVal(d.responsavel);
                    });
                }
            });
        }
        if (Array.isArray(_preProducaoItems)) {
            _preProducaoItems.forEach(u => {
                if (u && u.responsavel) addVal(u.responsavel);
            });
        }
        if (Array.isArray(_garantiaProducaoItems)) {
            _garantiaProducaoItems.forEach(g => {
                if (g && g.responsavel) addVal(g.responsavel);
            });
        }

        let result = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (result.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY_LP_RESPONSAVEIS, JSON.stringify(result));
            } catch (e) {}
        } else {
            try {
                const cached = JSON.parse(localStorage.getItem(STORAGE_KEY_LP_RESPONSAVEIS) || '[]');
                if (Array.isArray(cached) && cached.length > 0) {
                    result = cached;
                }
            } catch (e) {}
        }

        if (!result || result.length === 0) {
            result = ['CLEITON', 'KAKA', 'MARCAO', 'SILVIO'];
        }

        return Array.from(new Set(result.map(r => String(r || '').trim().toUpperCase()).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    function _setupResponsavelSelectWidget({
        selectEl,
        selectGroupEl,
        addBtnEl,
        newGroupEl,
        newInputEl,
        confirmBtnEl,
        cancelBtnEl,
        currentVal = ''
    }) {
        if (!selectEl) return () => '';

        const rawList = _getAllResponsaveisList();
        const list = Array.from(new Set(rawList.map(r => String(r || '').trim().toUpperCase()).filter(Boolean)));
        list.sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const trimmedCur = String(currentVal || '').trim().toUpperCase();
        let selectedVal = '';
        if (trimmedCur && trimmedCur !== '-' && trimmedCur !== 'SEM_RESP' && trimmedCur !== 'SEM RESPONSÁVEL' && trimmedCur !== 'SEM RESPONSAVEL') {
            const exact = list.find(r => r === trimmedCur);
            if (exact) {
                selectedVal = exact;
            } else {
                list.push(trimmedCur);
                list.sort((a, b) => a.localeCompare(b, 'pt-BR'));
                selectedVal = trimmedCur;
            }
        }

        selectEl.innerHTML = '<option value="">-- Sem responsável --</option>' +
            list.map(r => `<option value="${String(r).replace(/"/g, '&quot;')}">${r}</option>`).join('');
        selectEl.value = selectedVal;

        if (selectGroupEl) selectGroupEl.classList.remove('hidden');
        if (newGroupEl) newGroupEl.classList.add('hidden');
        if (newInputEl) newInputEl.value = '';

        const closeNewInput = () => {
            if (newInputEl) newInputEl.value = '';
            if (newGroupEl) newGroupEl.classList.add('hidden');
            if (selectGroupEl) selectGroupEl.classList.remove('hidden');
        };

        const confirmNewInput = () => {
            if (!newInputEl) return;
            const typed = newInputEl.value.trim().toUpperCase();
            if (!typed) {
                newInputEl.focus();
                return;
            }
            const existingOpt = Array.from(selectEl.options).find(
                opt => opt.value && opt.value.toUpperCase() === typed
            );
            if (existingOpt) {
                selectEl.value = existingOpt.value;
            } else {
                const opt = document.createElement('option');
                opt.value = typed;
                opt.textContent = typed;
                selectEl.appendChild(opt);
                selectEl.value = typed;
                try {
                    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY_LP_RESPONSAVEIS) || '[]');
                    if (!cached.includes(typed)) {
                        cached.push(typed);
                        cached.sort((a, b) => a.localeCompare(b, 'pt-BR'));
                        localStorage.setItem(STORAGE_KEY_LP_RESPONSAVEIS, JSON.stringify(cached));
                    }
                } catch(e) {}
            }
            closeNewInput();
        };

        if (addBtnEl && newGroupEl && selectGroupEl && newInputEl) {
            addBtnEl.onclick = () => {
                selectGroupEl.classList.add('hidden');
                newGroupEl.classList.remove('hidden');
                newInputEl.value = '';
                newInputEl.focus();
            };
        }
        if (confirmBtnEl) confirmBtnEl.onclick = confirmNewInput;
        if (cancelBtnEl) cancelBtnEl.onclick = closeNewInput;
        if (newInputEl) {
            newInputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmNewInput();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeNewInput();
                }
            };
        }

        return () => {
            if (newGroupEl && !newGroupEl.classList.contains('hidden') && newInputEl && newInputEl.value.trim()) {
                confirmNewInput();
            }
            return (selectEl.value || '').trim().toUpperCase();
        };
    }

    function _getAllVendedoresList() {
        const set = new Set([
            'Julio Martins dos Santos',
            'Reginaldo Araujo de Souza',
            'Rodrigo Carbone',
            'E-Commerce'
        ]);
        _allPedidos.forEach(p => {
            const name = _getVendedorName(p.vendedor || '').trim();
            if (name && name !== '-' && !/^ID:\s*/i.test(name)) {
                set.add(name);
            }
        });
        _preProducaoItems.forEach(u => {
            const name = _getVendedorName(u.vendedor || '').trim();
            if (name && name !== '-' && !/^ID:\s*/i.test(name)) {
                set.add(name);
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    function _openAddProductionItemModal() {
        const modal = document.getElementById('lp-add-item-modal');
        const closeBtn = document.getElementById('close-lp-add-item-btn');
        const cancelBtn = document.getElementById('cancel-lp-add-item-btn');
        const confirmBtn = document.getElementById('confirm-lp-add-item-btn');

        const orcInput = document.getElementById('lp-add-orcamento-input');
        const dateInput = document.getElementById('lp-add-date-input');
        const searchInput = document.getElementById('lp-add-product-search');
        const resultsEl = document.getElementById('lp-add-product-results');
        const skuInput = document.getElementById('lp-add-sku-input');
        const qtyInput = document.getElementById('lp-add-qty-input');
        const statusInput = document.getElementById('lp-add-status-input');
        const descInput = document.getElementById('lp-add-desc-input');
        const respInput = document.getElementById('lp-add-resp-input');

        if (!modal || !confirmBtn) return;

        // Data padrão: hoje (YYYY-MM-DD)
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        orcInput.value = '';
        dateInput.value = todayStr;
        searchInput.value = '';
        skuInput.value = '';
        qtyInput.value = '1';
        statusInput.value = 'EM PRODUÇÃO';
        descInput.value = '';
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';

        // Dropdown de responsáveis cadastrados + botão "+"
        const getAddResponsavel = _setupResponsavelSelectWidget({
            selectEl: respInput,
            selectGroupEl: document.getElementById('lp-add-resp-select-group'),
            addBtnEl: document.getElementById('lp-add-resp-add-btn'),
            newGroupEl: document.getElementById('lp-add-resp-new-group'),
            newInputEl: document.getElementById('lp-add-new-resp-input'),
            confirmBtnEl: document.getElementById('lp-add-confirm-resp-btn'),
            cancelBtnEl: document.getElementById('lp-add-cancel-resp-btn'),
            currentVal: ''
        });

        // Busca de produtos no catálogo global window._allProducts
        const renderSearchResults = (term) => {
            const products = Array.isArray(window._allProducts) ? window._allProducts : [];
            const q = String(term || '').toLowerCase().trim();
            if (!q) {
                resultsEl.classList.add('hidden');
                return;
            }

            const matches = products.filter(p =>
                String(p.codigo || '').toLowerCase().includes(q) ||
                String(p.descricao || '').toLowerCase().includes(q)
            ).slice(0, 25);

            if (matches.length === 0) {
                resultsEl.innerHTML = '<div class="px-4 py-3 text-xs text-gray-500">Nenhum produto encontrado no catálogo.</div>';
                resultsEl.classList.remove('hidden');
                return;
            }

            resultsEl.innerHTML = matches.map(p => {
                const img = (p.url_imagens_externas && p.url_imagens_externas[0]) ? p.url_imagens_externas[0] : 'https://placehold.co/36x36/f1f5f9/94a3b8?text=?';
                const cod = String(p.codigo || '').replace(/"/g, '&quot;');
                const desc = String(p.descricao || '').replace(/"/g, '&quot;');
                return `
                <button type="button" class="lp-prod-result-item w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-3 transition-colors" data-codigo="${cod}" data-descricao="${desc}">
                    <img src="${img}" class="w-9 h-9 rounded-lg object-contain bg-gray-50 border border-gray-100 shrink-0" onerror="this.src='https://placehold.co/36x36/f1f5f9/94a3b8?text=?'">
                    <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold text-gray-800 truncate">${desc}</div>
                        <div class="text-[11px] font-mono text-blue-600 font-semibold">${cod}</div>
                    </div>
                </button>`;
            }).join('');

            resultsEl.querySelectorAll('.lp-prod-result-item').forEach(btn => {
                btn.onclick = () => {
                    skuInput.value = btn.dataset.codigo || '';
                    descInput.value = btn.dataset.descricao || '';
                    searchInput.value = `${btn.dataset.codigo} - ${btn.dataset.descricao}`;
                    resultsEl.classList.add('hidden');
                };
            });

            resultsEl.classList.remove('hidden');
        };

        searchInput.oninput = (e) => renderSearchResults(e.target.value);
        searchInput.onfocus = (e) => { if (e.target.value.trim()) renderSearchResults(e.target.value); };

        const closeModal = () => {
            resultsEl.classList.add('hidden');
            modal.classList.add('hidden');
        };
        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
            else if (!e.target.closest('#lp-add-product-search') && !e.target.closest('#lp-add-product-results')) {
                resultsEl.classList.add('hidden');
            }
        };

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirmar';
        confirmBtn.onclick = async () => {
            const orcamento = orcInput.value.trim();
            const sku = skuInput.value.trim();
            const desc = descInput.value.trim();
            const qty = parseFloat(qtyInput.value) || 0;
            const data = dateInput.value;
            const status = statusInput.value || 'EM PRODUÇÃO';
            const resp = getAddResponsavel();

            if (!orcamento) {
                alert('Informe o número do orçamento.');
                orcInput.focus();
                return;
            }
            if (!sku) {
                alert('Informe ou selecione o código SKU do produto.');
                skuInput.focus();
                return;
            }
            if (qty <= 0) {
                alert('Informe uma quantidade válida.');
                qtyInput.focus();
                return;
            }

            // Verifica localmente antes mesmo de ir ao servidor se já existe pré-produção ou pedido em produção para este orçamento + SKU
            const dupPre = _preProducaoItems.find(u =>
                String(u.orcamento || '').trim() === orcamento &&
                String(u.sku || '').trim() === sku
            );
            if (dupPre) {
                _showCustomAlert('Item já registrado', `O item ${sku} já está na Linha de Produção para o orçamento ${orcamento} (Status: "${dupPre.status || 'EM PRODUÇÃO'}").`, false);
                return;
            }

            const existingPedidoMatch = _allPedidos.find(p => String(p.orcamento || p.orçamento || '').trim() === orcamento);
            if (existingPedidoMatch) {
                const pid = String(existingPedidoMatch.id || existingPedidoMatch.id_pedido || existingPedidoMatch.numero || '');
                const pnum = String(existingPedidoMatch.numero || existingPedidoMatch.número || '');
                const parsed = _parseItens(existingPedidoMatch.itens || existingPedidoMatch.Itens || '', existingPedidoMatch.detalhesProducao || {}, pid, pnum);
                const itemInOrder = parsed.find(it => String(it.codigo).trim() === sku);
                if (itemInOrder) {
                    const st = String(itemInOrder.status || '').toUpperCase().trim();
                    if (st === 'EM PRODUÇÃO' || st === 'PRODUCAO' || st === 'EM PRODUCAO' || st === 'AGUARDANDO RETIRADA' || st === 'FINALIZADO') {
                        _showCustomAlert('Item já em produção', `O orçamento ${orcamento} já possui o Pedido #${pnum || pid} com o item ${sku} marcado como "${st}".`, false);
                        return;
                    }
                }
            }

            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...`;

            try {
                const response = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedidoId: '',
                        numeroPedido: '',
                        orcamento,
                        itemCodigo: sku,
                        newStatus: status,
                        itemIndex: '',
                        newDescription: desc,
                        responsavel: resp,
                        quantidade: qty,
                        dataPedido: data,
                        origem: 'Orçamento',
                        isManualPreProd: true
                    })
                });

                const resJson = await response.json().catch(() => ({}));

                if (response.status === 409) {
                    _showCustomAlert('Item já registrado', resJson.message || 'Este item já está na Linha de Produção para este orçamento.', false);
                    return;
                }

                if (!response.ok) {
                    throw new Error(resJson.message || 'Erro ao adicionar item à Linha de Produção');
                }

                if (resJson.linkedToExistingPedido && resJson.pedidoId) {
                    const pFound = _allPedidos.find(p =>
                        String(p.id) === String(resJson.pedidoId) ||
                        String(p.numero) === String(resJson.numeroPedido)
                    );
                    if (pFound && resJson.itemIndex !== '') {
                        _updatePedidoItemInCache(pFound, resJson.itemIndex, status, desc, resp, data);
                        _updateOrderRowStatus(pFound);
                    } else {
                        fetchPedidos(true);
                    }
                    if (typeof Toastify !== 'undefined') {
                        Toastify({ text: `Orçamento já possuía Pedido #${resJson.numeroPedido}! Item vinculado à produção.`, duration: 3500, style: { background: "#2563eb" } }).showToast();
                    }
                } else {
                    _preProducaoItems.push({
                        pedidoId: '',
                        itemIndex: '',
                        sku,
                        orcamento,
                        status,
                        descricao: desc,
                        quantidade: qty,
                        data,
                        responsavel: resp,
                        origem: 'Orçamento'
                    });
                    if (typeof Toastify !== 'undefined') {
                        Toastify({ text: `Item ${sku} adicionado à Linha de Produção!`, duration: 2500, style: { background: "#10b981" } }).showToast();
                    }
                }

                _broadcastItemStatusChange({
                    pedidoId: resJson.pedidoId || '',
                    numeroPedido: resJson.numeroPedido || '',
                    orcamento,
                    itemCodigo: sku,
                    newStatus: status,
                    itemIndex: resJson.itemIndex !== undefined ? resJson.itemIndex : '',
                    newDescription: desc,
                    responsavel: resp,
                    dataPedido: data,
                    quantidade: qty,
                    origem: 'Orçamento'
                });

                closeModal();
                _showProductionLine();
            } catch (error) {
                console.error('Erro ao adicionar item manual na linha de produção:', error);
                alert('Erro ao salvar: ' + error.message);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Confirmar';
            }
        };

        modal.classList.remove('hidden');
        setTimeout(() => orcInput.focus(), 80);
    }

    /**
     * Filtra e agrupa itens em produção para exibir no modal.
     */
    function _showProductionLine() {
        if (!_state.linhaProducaoModal) _state.linhaProducaoModal = document.getElementById('production-line-modal');
        if (!_state.linhaProducaoContent) _state.linhaProducaoContent = document.getElementById('production-line-modal-content');
        if (!_state.linhaProducaoModal || !_state.linhaProducaoContent) return;

        const savedPrefs = _loadLinhaProducaoFilterPrefs();
        if (_state.linhaProducaoFilterTipo && _state.linhaProducaoFilterTipo.dataset.prefsLoaded !== 'true') {
            _state.linhaProducaoFilterTipo.dataset.prefsLoaded = 'true';
            if (savedPrefs.tipo && Array.from(_state.linhaProducaoFilterTipo.options).some(o => o.value === savedPrefs.tipo)) {
                _state.linhaProducaoFilterTipo.value = savedPrefs.tipo;
            }
        }
        if (_state.linhaProducaoFilterStatus && _state.linhaProducaoFilterStatus.dataset.prefsLoaded !== 'true') {
            _state.linhaProducaoFilterStatus.dataset.prefsLoaded = 'true';
            if (savedPrefs.status && Array.from(_state.linhaProducaoFilterStatus.options).some(o => o.value === savedPrefs.status)) {
                _state.linhaProducaoFilterStatus.value = savedPrefs.status;
            }
        }

        // Varre TODOS os pedidos, pois o status individual dos itens (detalhesProducao) é o que importa
        const aggregatedItems = {};
        const linkedOrcSkuSet = new Set();

        _allPedidos.forEach(p => {
            const numeroPedido = p.numero || p.número || 'N/A';
            const finalId = p.id_pedido || p.id || '';
            const itensRaw = p.itens || p.Itens || '';
            const parsedItens = _parseItens(itensRaw, p.detalhesProducao || {}, finalId, numeroPedido);
            const empresa = p.contato_nome || p['contato nome'] || p.cliente || 'N/A';
            const orderVendedorFull = _getVendedorName(p.vendedor || '');
            const orderVendedor = (orderVendedorFull && orderVendedorFull !== '-') ? orderVendedorFull.split(' ')[0] : '';
            const orcamento = String(p.orcamento || p.orçamento || '').trim();
            const dataPedido = p.data || p.data_criacao || '';

            parsedItens.forEach(item => {
                const s = String(item.status || 'OK').toUpperCase().trim();
                const isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO' || s === 'AGUARDANDO RETIRADA' || s === 'FINALIZADO';

                if (isProducao) {
                    const codigo = String(item.codigo).trim();
                    if (orcamento && orcamento !== '0') {
                        linkedOrcSkuSet.add(`${orcamento}_${codigo}`);
                    }
                    const itemVendFull = item.vendedorProducao ? _getVendedorName(item.vendedorProducao) : '';
                    const itemVendedor = (itemVendFull && itemVendFull !== '-') ? itemVendFull.split(' ')[0] : orderVendedor;
                    // Usamos uma chave composta para mostrar itens por pedido/empresa
                    const key = `${codigo}_${numeroPedido}_${item.descricaoPersonalizada || ''}`; 
                    
                    if (!aggregatedItems[key]) {
                        aggregatedItems[key] = {
                            codigo: codigo,
                            // PRIORIDADE: Descrição Personalizada -> Descrição do Produto (cache) -> Código
                            descricao: item.descricaoPersonalizada || codigo, 
                            quantidadeTotal: 0,
                            data: item.dataProducao || dataPedido,
                            vendedor: itemVendedor,
                            empresa: empresa,
                            orcamento: orcamento,
                            numeroPedido: numeroPedido,
                            pedidoId: finalId,
                            itemIndex: item.index,
                            descricaoPersonalizada: item.descricaoPersonalizada,
                            status: item.status || 'EM PRODUÇÃO',
                            responsavel: item.responsavel || '',
                            domRef: String(numeroPedido),
                            isPreProducao: false,
                            isGarantia: false,
                            tipo: 'VENDAS'
                        };
                    } else if (item.vendedorProducao && itemVendedor) {
                        aggregatedItems[key].vendedor = itemVendedor;
                    }
                    aggregatedItems[key].quantidadeTotal += (parseFloat(item.quantidadeProducao ?? item.quantidade) || 0);
                }
            });
        });

        // Inclui itens de pré-produção (adicionados manualmente apenas com Orçamento, ainda sem pedido no Bling)
        _preProducaoItems.forEach(pre => {
            const preSku = String(pre.sku || pre.codigo || '').trim();
            const preOrc = String(pre.orcamento || '').trim();
            if (!preSku || !preOrc) return;
            if (linkedOrcSkuSet.has(`${preOrc}_${preSku}`)) return; // Já vinculado a um pedido real

            const s = String(pre.status || 'EM PRODUÇÃO').toUpperCase().trim();
            const isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO' || s === 'AGUARDANDO RETIRADA' || s === 'FINALIZADO';
            if (!isProducao) return;

            const preDesc = pre.descricaocomplementar || pre.descricaoPersonalizada || pre.descricao || '';
            const preVendFull = _getVendedorName(pre.vendedor || '');
            const preVendedor = (preVendFull && preVendFull !== '-') ? preVendFull.split(' ')[0] : '';

            const safeOrcRef = 'PRE_' + preOrc.replace(/[^a-zA-Z0-9_-]/g, '_');
            const key = `PRE_${preSku}_${preOrc}`;
            if (!aggregatedItems[key]) {
                aggregatedItems[key] = {
                    codigo: preSku,
                    descricao: preDesc || preSku,
                    quantidadeTotal: parseFloat(pre.quantidade) || 1,
                    data: pre.data || '',
                    vendedor: preVendedor,
                    empresa: '',
                    orcamento: preOrc,
                    numeroPedido: '',
                    pedidoId: '',
                    itemIndex: '',
                    descricaoPersonalizada: preDesc,
                    status: pre.status || 'EM PRODUÇÃO',
                    responsavel: pre.responsavel || '',
                    domRef: safeOrcRef,
                    isPreProducao: true,
                    isGarantia: false,
                    tipo: 'VENDAS'
                };
            }
        });

        // Inclui itens de garantia que estão em produção
        _garantiaProducaoItems.forEach(gar => {
            const garSku = String(gar.sku || '').trim();
            const garPid = String(gar.pedidoId || '').trim();
            const garIdx = gar.itemIndex !== undefined && gar.itemIndex !== null ? String(gar.itemIndex) : '';
            const s = String(gar.status || 'EM PRODUÇÃO').toUpperCase().trim();
            const isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO' || s === 'AGUARDANDO RETIRADA' || s === 'FINALIZADO';
            if (!isProducao) return;

            let respSat = gar.vendedor || gar.responsavelSat || '';
            if (!respSat && typeof window.GerenciarGarantiaApp !== 'undefined' && typeof window.GerenciarGarantiaApp.getSatgResponsavel === 'function') {
                respSat = window.GerenciarGarantiaApp.getSatgResponsavel(garPid, gar.orcamento);
            }

            const garDesc = gar.descricaocomplementar || gar.descricaoPersonalizada || gar.descricao || '';
            const safeGarRef = 'GAR_' + garPid.replace(/[^a-zA-Z0-9_-]/g, '_') + (garIdx !== '' ? `_${garIdx}` : '');
            const key = `GAR_${garPid}_${garIdx}_${garSku}`;
            if (!aggregatedItems[key]) {
                aggregatedItems[key] = {
                    codigo: garSku,
                    descricao: garDesc || garSku,
                    quantidadeTotal: parseFloat(gar.quantidade) || 1,
                    data: gar.data || '',
                    vendedor: respSat || '',
                    empresa: gar.cliente || '',
                    orcamento: gar.orcamento || '',
                    numeroPedido: garPid,
                    pedidoId: garPid,
                    itemIndex: garIdx,
                    descricaoPersonalizada: garDesc,
                    status: gar.status || 'EM PRODUÇÃO',
                    responsavel: gar.responsavel || '',
                    domRef: safeGarRef,
                    isPreProducao: false,
                    isGarantia: true,
                    tipo: 'GARANTIA',
                    origem: 'Garantia',
                    cliente: gar.cliente || ''
                };
            }
        });

        let itemsArray = Object.values(aggregatedItems);

        // Extrair responsáveis únicos para o filtro
        const responsaveisSet = new Set();
        itemsArray.forEach(item => {
            const r = String(item.responsavel || '').trim().toUpperCase();
            if (r && r !== '-' && r !== 'SEM_RESP' && r !== 'SEM RESPONSÁVEL' && r !== 'SEM RESPONSAVEL') {
                responsaveisSet.add(r);
            }
        });
        const responsaveis = Array.from(responsaveisSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        // Atualizar options do select de filtro mantendo a seleção atual (ou restaurando salva)
        if (_state.linhaProducaoFilterResp) {
            let currentSelection = String(_state.linhaProducaoFilterResp.value || 'TODOS').toUpperCase();
            if (_state.linhaProducaoFilterResp.dataset.prefsLoaded !== 'true' && (_allPedidos.length > 0 || _preProducaoItems.length > 0 || _garantiaProducaoItems.length > 0)) {
                _state.linhaProducaoFilterResp.dataset.prefsLoaded = 'true';
                if (savedPrefs.responsavel) currentSelection = String(savedPrefs.responsavel).toUpperCase();
            }
            let optionsHTML = '<option value="TODOS">Todos</option><option value="SEM_RESP">Sem Responsável</option>';
            responsaveis.forEach(resp => {
                optionsHTML += `<option value="${resp}">${resp}</option>`;
            });
            _state.linhaProducaoFilterResp.innerHTML = optionsHTML;
            if (currentSelection === 'SEM_RESP' || responsaveis.includes(currentSelection)) {
                _state.linhaProducaoFilterResp.value = currentSelection;
            } else {
                _state.linhaProducaoFilterResp.value = 'TODOS';
            }
        }

        // Aplicar o filtro de Responsável se não for TODOS
        if (_state.linhaProducaoFilterResp && _state.linhaProducaoFilterResp.value !== 'TODOS') {
            const activeFilter = String(_state.linhaProducaoFilterResp.value).toUpperCase().trim();
            if (activeFilter === 'SEM_RESP') {
                itemsArray = itemsArray.filter(item => {
                    const r = String(item.responsavel || '').trim().toUpperCase();
                    return !r || r === '-' || r === 'SEM_RESP' || r === 'SEM RESPONSÁVEL';
                });
            } else {
                itemsArray = itemsArray.filter(item => {
                    const r = String(item.responsavel || '').trim().toUpperCase();
                    return r === activeFilter;
                });
            }
        }

        // Aplicar o filtro de Situação se não for TODOS
        if (_state.linhaProducaoFilterStatus && _state.linhaProducaoFilterStatus.value !== 'TODOS') {
            const activeStatus = _state.linhaProducaoFilterStatus.value.toUpperCase().trim();
            itemsArray = itemsArray.filter(item => {
                let st = String(item.status || '').toUpperCase().trim();
                if (st === 'PRODUCAO' || st === 'EM PRODUCAO') st = 'EM PRODUÇÃO';
                return st === activeStatus;
            });
        }

        // Aplicar o filtro de Tipo (TODOS, VENDAS, GARANTIA)
        const tipoFilter = _state.linhaProducaoFilterTipo ? _state.linhaProducaoFilterTipo.value : 'TODOS';
        if (tipoFilter === 'VENDAS') {
            itemsArray = itemsArray.filter(item => item.tipo === 'VENDAS');
        } else if (tipoFilter === 'GARANTIA') {
            itemsArray = itemsArray.filter(item => item.tipo === 'GARANTIA');
        }

        // Se o filtro for GARANTIA, oculta o botão + Adicionar Item manualmente; caso contrário, exibe
        if (_state.linhaProducaoAddBtn) {
            if (tipoFilter === 'GARANTIA') {
                _state.linhaProducaoAddBtn.classList.add('hidden');
            } else {
                _state.linhaProducaoAddBtn.classList.remove('hidden');
            }
        }

        // Aplicar o filtro de Busca (Orçamento, Cliente, Pedido, Código, Descrição, Vendedor, Responsável)
        const rawSearch = _state.linhaProducaoFilterSearch ? _state.linhaProducaoFilterSearch.value.trim() : '';
        const searchTerm = rawSearch.toLowerCase();

        if (_state.linhaProducaoFilterSearchClear) {
            if (rawSearch) {
                _state.linhaProducaoFilterSearchClear.classList.remove('hidden');
            } else {
                _state.linhaProducaoFilterSearchClear.classList.add('hidden');
            }
        }

        if (searchTerm) {
            itemsArray = itemsArray.filter(i => {
                const orc = String(i.orcamento || '').toLowerCase();
                const cliente = String(i.empresa || i.cliente || '').toLowerCase();
                const pedido = String(i.numeroPedido || '').toLowerCase();
                const cod = String(i.codigo || '').toLowerCase();
                const desc = String(i.descricao || i.descricaoPersonalizada || '').toLowerCase();
                const vend = String(i.vendedor || '').toLowerCase();
                const resp = String(i.responsavel || '').toLowerCase();

                return orc.includes(searchTerm) ||
                       cliente.includes(searchTerm) ||
                       pedido.includes(searchTerm) ||
                       cod.includes(searchTerm) ||
                       desc.includes(searchTerm) ||
                       vend.includes(searchTerm) ||
                       resp.includes(searchTerm);
            });
        }

        // Atualizar contador de itens no badge
        if (_state.linhaProducaoCountBadge) {
            const count = itemsArray.length;
            _state.linhaProducaoCountBadge.textContent = count === 1 ? '1 item' : `${count} itens`;
        }

        // Ordenar por data (Mais antigos primeiro)
        itemsArray.sort((a, b) => {
            const dA = _parseDate(a.data) || new Date(8640000000000000); 
            const dB = _parseDate(b.data) || new Date(8640000000000000);
            return dA - dB;
        });

        if (itemsArray.length === 0) {
            const emptySub = searchTerm 
                ? 'Nenhum item corresponde ao termo pesquisado.' 
                : 'Tente ajustar os filtros de tipo, responsável ou situação.';
            _state.linhaProducaoContent.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                    <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                    <p class="text-xl font-medium">Nenhum item encontrado</p>
                    <p class="text-sm">${emptySub}</p>
                </div>`;
            _state.linhaProducaoModal.classList.remove('hidden');
            return;
        }

        // 3. Renderizar a tabela
        _renderProductionLineTable(itemsArray);
        _state.linhaProducaoModal.classList.remove('hidden');

        // 4. Enriquecer com dados de produto (imagem/descrição)
        setTimeout(() => _enrichProductionLineWithProductData(itemsArray), 50);
    }

    function _renderProductionLineTable(items) {
        _state.linhaProducaoContent.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 border border-gray-100 rounded-xl overflow-hidden">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Produto</th>
                            <th class="px-6 py-4 text-center text-xs font-black text-gray-400 uppercase tracking-wider">Data</th>
                            <th class="px-6 py-4 text-center text-xs font-black text-gray-400 uppercase tracking-wider">Qtd / Sit. / Resp.</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-100">
                        ${items.map(item => {
                            const pDate = _parseDate(item.data);
                            const dateFormatted = (pDate && !isNaN(pDate)) 
                                ? `${String(pDate.getDate()).padStart(2, '0')}/${String(pDate.getMonth() + 1).padStart(2, '0')}/${pDate.getFullYear()}`
                                : item.data || '-';

                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            let diffDays = 0;
                            if (pDate && !isNaN(pDate)) {
                                const prodDate = new Date(pDate);
                                prodDate.setHours(0, 0, 0, 0);
                                diffDays = Math.floor((today - prodDate) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) diffDays = 0;
                            }

                            const domRef = item.domRef || item.numeroPedido;
                            const idxArg = (item.itemIndex !== '' && item.itemIndex !== undefined && item.itemIndex !== null) ? item.itemIndex : "''";
                            const orcSafe = String(item.orcamento || '').replace(/'/g, "\\'");
                            const subtitleHtml = item.isGarantia
                                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-black uppercase mr-1.5">Garantia</span>${item.vendedor ? `<span class="text-blue-600 font-bold">${item.vendedor}</span> <span class="mx-1 text-gray-400">-</span> ` : ''}<span class="text-gray-600 font-semibold">${item.empresa || 'Cliente Garantia'}</span>`
                                : item.isPreProducao
                                    ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-black uppercase mr-1.5">Pré-Produção</span>${item.vendedor ? `<span class="text-blue-600 font-bold">${item.vendedor}</span> <span class="mx-1 text-gray-400">-</span> ` : ''}<span class="text-gray-400 font-semibold">Aguardando pedido</span>`
                                    : `<span class="text-blue-600 font-bold">${item.vendedor || '-'}</span> <span class="mx-1 text-gray-400">-</span> <span class="text-gray-500">${item.empresa}</span>`;

                            const topTagHtml = item.isGarantia
                                ? `<span class="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase tracking-wide">${item.orcamento ? (String(item.orcamento).startsWith('SAT-G') ? item.orcamento : `SAT-G: ${item.orcamento}`) : (item.numeroPedido || 'Garantia')}</span>${item.numeroPedido && item.orcamento ? `<span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-black uppercase tracking-wide">Pedido #${item.numeroPedido}</span>` : ''}`
                                : (item.orcamento && item.orcamento !== '0'
                                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black uppercase tracking-wide">Orç.: ${item.orcamento}</span>`
                                    : (item.numeroPedido && item.numeroPedido !== 'N/A'
                                        ? `<span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-black uppercase tracking-wide">Pedido #${item.numeroPedido}</span>`
                                        : ''));

                            return `
                            <tr class="hover:bg-blue-50/30 transition-colors">
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-2 mb-2">
                                        ${topTagHtml}
                                        <button onclick="GerenciarPedidosApp.handleEditItemDescription('${item.pedidoId}', '${item.codigo}', ${idxArg}, event, '${orcSafe}')"
                                                class="no-print inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                                                title="Editar descrição, responsável, vendedor e quantidade">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            Editar
                                        </button>
                                    </div>
                                    <div class="flex items-center gap-4">
                                        <div class="flex flex-col items-center gap-1 flex-shrink-0">
                                            <div class="w-16 h-16 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                                                <img id="lp-img-${item.codigo}-${domRef}" src="https://placehold.co/60x60/f8fafc/cbd5e1?text=..." 
                                                     class="max-w-full max-h-full object-contain"
                                                     onerror="this.src='https://placehold.co/60x60/f8fafc/cbd5e1?text=?'">
                                            </div>
                                            <span class="text-[9px] font-black text-gray-400 uppercase tracking-tighter">SKU-${item.codigo}</span>
                                        </div>
                                        <div>
                                            <p class="font-black text-gray-800 text-base" id="lp-desc-${item.codigo}-${domRef}">${item.descricao || item.codigo}</p>
                                            <p class="text-xs font-bold text-blue-500 uppercase tracking-widest mt-0.5">
                                                ${subtitleHtml}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <div class="flex flex-col items-center gap-2">
                                        <div class="flex flex-col items-center">
                                            <span class="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Solicitação</span>
                                            <span class="text-sm font-bold text-gray-700">
                                                ${dateFormatted}
                                            </span>
                                        </div>
                                        <div class="flex flex-col items-center pt-1.5 border-t border-gray-100 w-full">
                                            <span class="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Dias Corridos</span>
                                            <span class="text-xs font-black text-orange-600">${diffDays} ${diffDays === 1 ? 'Dia' : 'Dias'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <div class="flex flex-col items-center gap-2">
                                        <div class="flex flex-col items-center">
                                            <span class="inline-flex items-center justify-center min-w-[36px] h-9 px-2 bg-blue-100 text-blue-700 rounded-lg font-black text-base border border-blue-200">
                                                ${item.quantidadeTotal}
                                            </span>
                                        </div>
                                        <div class="flex flex-col items-center pt-1.5 border-t border-gray-100 w-full">
                                            <div class="flex items-center justify-center relative w-fit">
                                                <span class="text-[10px] font-black px-2 py-1 ${item.status.toUpperCase() === 'FINALIZADO' ? 'bg-green-100 text-green-700 border-green-200' : item.status.toUpperCase() === 'AGUARDANDO RETIRADA' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-orange-50 text-orange-600 border-orange-200'} rounded-md whitespace-nowrap uppercase tracking-wider border">
                                                    ${item.status}
                                                </span>
                                                <button onclick="GerenciarPedidosApp.openProductionStatusModal('${item.pedidoId}', '${item.codigo}', ${idxArg}, '${item.numeroPedido}', '${String(item.status || 'EM PRODUÇÃO').replace(/'/g, "\\'")}', event, '${orcSafe}')" class="no-print absolute -right-7 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Alterar Situação">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="flex flex-col items-center pt-1.5 border-t border-gray-100 w-full">
                                        ${item.responsavel ? 
                                            `<div class="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded-md">
                                                <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                                <span class="text-[10px] font-black uppercase tracking-wider whitespace-nowrap leading-none">${item.responsavel}</span>
                                            </div>` 
                                            : 
                                            `<span class="text-[9px] font-bold px-2 py-0.5 text-gray-400 border border-dashed border-gray-300 rounded whitespace-nowrap">SEM RESP.</span>`
                                        }
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async function _enrichProductionLineWithProductData(items) {
        try {
            let products = Array.isArray(window._allProducts) && window._allProducts.length > 0 ? window._allProducts : null;
            if (!products) {
                const res = await fetch(`${API_URLS.PRODUCTS}?t=${Date.now()}`, { mode: 'cors' });
                if (!res.ok) return;
                const json = await res.json();
                products = json.data || json || [];
            }

            items.forEach(item => {
                const prod = products.find(p => String(p.codigo || '').trim() === String(item.codigo).trim());
                if (prod) {
                    const domRef = item.domRef || item.numeroPedido;
                    const imgId = `lp-img-${item.codigo}-${domRef}`;
                    const descId = `lp-desc-${item.codigo}-${domRef}`;
                    const imgEl = document.getElementById(imgId);
                    const descEl = document.getElementById(descId);
                    
                    if (imgEl && prod.url_imagens_externas && prod.url_imagens_externas[0]) imgEl.src = prod.url_imagens_externas[0];
                    
                    // Se NÃO tiver descrição personalizada, usa a do produto (padrão)
                    if (descEl && !item.descricaoPersonalizada && prod.descricao) {
                        descEl.textContent = prod.descricao;
                    }
                }
            });
        } catch (e) {
            console.warn('[LinhaProducao] Erro ao enriquecer:', e);
        }
    }

    function _printProductionLine() {
        if (!_state.linhaProducaoContent) return;
        
        const content = _state.linhaProducaoContent.innerHTML;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Linha de Produção - MKS Service</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            body { padding: 20px; font-family: sans-serif; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
                            .no-print { display: none; }
                            img { max-width: 70px; max-height: 70px; object-fit: contain; border-radius: 12px; }
                        }
                    </style>
                </head>
                <body class="p-8">
                    <div class="mb-8 flex justify-between items-end border-b-2 border-blue-600 pb-4">
                        <div>
                            <h1 class="text-4xl font-black text-gray-800">LINHA DE PRODUÇÃO</h1>
                            <p class="text-gray-500 font-bold uppercase tracking-widest text-sm">MKS SERVICE - Relatório de Itens Pendentes</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm font-bold text-gray-400 uppercase">Gerado em</p>
                            <p class="text-lg font-black text-gray-800">${new Date().toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                    <div class="production-line-print-container">
                        ${content}
                    </div>
                    <div class="mt-12 pt-8 border-t border-gray-100 text-center text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                        Sistema de Gestão MKS Service - Documento Interno
                    </div>
                </body>
            </html>
        `);
        
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 1000);
    }

    function _initEditItemDescModal() {
        const modal = document.getElementById('edit-item-desc-modal');
        const closeBtn = document.getElementById('close-edit-item-desc-modal-btn');
        const cancelBtn = document.getElementById('cancel-edit-item-desc-btn');

        if (!modal) return;

        const close = () => {
            console.log('[GerenciarPedidos] Fechando modal de descrição...');
            modal.classList.add('hidden');
        };

        // Remover listeners antigos para evitar duplicação (opcional mas seguro)
        closeBtn?.replaceWith(closeBtn.cloneNode(true));
        cancelBtn?.replaceWith(cancelBtn.cloneNode(true));

        // Re-selecionar após clone
        const newCloseBtn = document.getElementById('close-edit-item-desc-modal-btn');
        const newCancelBtn = document.getElementById('cancel-edit-item-desc-btn');

        newCloseBtn?.addEventListener('click', close);
        newCancelBtn?.addEventListener('click', close);
        
        // Fechar ao clicar fora do conteúdo
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    }
    function _formatWeightInput(inputEl) {
        if (!inputEl) return;
        
        function formatValue(value) {
            let clean = String(value).replace(/[^0-9]/g, '');
            if (!clean) return '0,000';
            
            let grams = parseInt(clean, 10);
            let valFloat = grams / 1000;
            
            return valFloat.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
        
        if (inputEl.value) {
            let val = parseFloat(String(inputEl.value).replace(',', '.')) || 0;
            inputEl.value = val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
        
        inputEl.addEventListener('input', function(e) {
            let val = this.value;
            this.value = formatValue(val);
        });
    }

    return {
        openOrderDetailsModal: _openOrderDetailsModal,
        openLinhaProducaoModal: async function(tipo = 'TODOS') {
            if (!_isInitialized) {
                _cacheDom();
                if (_statusSelect && !_statusSelect.value) {
                    _statusSelect.value = 'aberto';
                } else if (_statusSelect && _statusSelect.value === 'all') {
                    _statusSelect.value = 'aberto';
                }
                _bindEvents();
                _isInitialized = true;
            } else if (!_state.linhaProducaoModal) {
                _cacheDom();
            }

            if (!_state.linhaProducaoModal) {
                _state.linhaProducaoModal = document.getElementById('production-line-modal');
            }
            if (!_state.linhaProducaoContent) {
                _state.linhaProducaoContent = document.getElementById('production-line-modal-content');
            }
            if (!_state.linhaProducaoFilterTipo) {
                _state.linhaProducaoFilterTipo = document.getElementById('filter-tipo-lp');
            }
            if (!_state.linhaProducaoFilterResp) {
                _state.linhaProducaoFilterResp = document.getElementById('filter-responsavel-lp');
            }
            if (!_state.linhaProducaoFilterStatus) {
                _state.linhaProducaoFilterStatus = document.getElementById('filter-status-lp');
            }
            if (!_state.linhaProducaoFilterSearch) {
                _state.linhaProducaoFilterSearch = document.getElementById('filter-search-lp');
            }
            if (!_state.linhaProducaoFilterSearchClear) {
                _state.linhaProducaoFilterSearchClear = document.getElementById('filter-search-lp-clear');
            }
            if (!_state.linhaProducaoCountBadge) {
                _state.linhaProducaoCountBadge = document.getElementById('lp-items-count-badge');
            }
            if (!_state.linhaProducaoCloseBtn) {
                _state.linhaProducaoCloseBtn = document.getElementById('close-production-line-modal-btn');
                if (_state.linhaProducaoCloseBtn) {
                    _state.linhaProducaoCloseBtn.onclick = () => {
                        if (_state.linhaProducaoModal) _state.linhaProducaoModal.classList.add('hidden');
                    };
                }
            }

            if (_state.linhaProducaoFilterTipo) {
                _state.linhaProducaoFilterTipo.dataset.prefsLoaded = 'true';
                _state.linhaProducaoFilterTipo.value = tipo;
                _saveLinhaProducaoFilterPrefs();
            }
            if (_state.linhaProducaoModal) {
                _state.linhaProducaoModal.classList.remove('hidden');
            }

            if (_state.linhaProducaoContent && (!_allPedidos || _allPedidos.length === 0)) {
                _state.linhaProducaoContent.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg class="animate-spin h-8 w-8 text-blue-500 mb-3" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p class="text-sm font-semibold text-gray-500">Carregando itens da Linha de Produção...</p>
                    </div>`;
            }

            if (_allPedidos.length === 0 && _garantiaProducaoItems.length === 0) {
                await fetchPedidos();
            }
            _showProductionLine();
        },
        showProductionLine: _showProductionLine,
        toggleItemStatusDropdown: _toggleItemStatusDropdown,
        handleItemClick: handleItemClick,
        handleEditItemDescription: async function(pedidoId, itemCodigo, index, event, orcamento = '') {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const pedido = pedidoId
                ? _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId))
                : null;
            let preItem = null;
            if (!pedido && orcamento) {
                const targetOrc = String(orcamento).trim();
                const targetSku = String(itemCodigo || '').trim();
                preItem = _preProducaoItems.find(pp =>
                    String(pp.orcamento || '').trim() === targetOrc &&
                    String(pp.sku || pp.codigo || '').trim() === targetSku
                ) || null;
            }

            let garItem = null;
            if (!pedido && !preItem) {
                const targetPid = String(pedidoId || '').trim();
                const targetSku = String(itemCodigo || '').trim();
                const targetIdx = (index !== undefined && index !== null && index !== '') ? String(index) : '';
                garItem = _garantiaProducaoItems.find(gi => {
                    const gPid = String(gi.pedidoId || '').trim();
                    const gSku = String(gi.sku || gi.codigo || '').trim();
                    const gIdx = (gi.itemIndex !== undefined && gi.itemIndex !== null) ? String(gi.itemIndex) : '';
                    if (gPid && targetPid && gPid === targetPid) {
                        if (targetIdx !== '' && gIdx !== '') return gIdx === targetIdx && (!targetSku || gSku === targetSku);
                        return !targetSku || gSku === targetSku;
                    }
                    return false;
                }) || null;
            }

            if (!pedido && !preItem && !garItem) return;

            const finalPedidoId = pedido ? String(pedido.id || pedido.id_pedido || '') : (garItem ? String(garItem.pedidoId || pedidoId || '') : '');
            const finalNumPedido = pedido ? String(pedido.numero || pedido.numero_pedido || '') : (garItem ? String(garItem.pedidoId || pedidoId || '') : '');
            const finalOrcamento = String(orcamento || (pedido ? (pedido.orcamento || pedido.orçamento || '') : (preItem ? preItem.orcamento : (garItem ? garItem.orcamento : ''))) || '').trim();

            let item = null;
            if (pedido) {
                const itens = _parseItens(pedido.itens, pedido.detalhesProducao || {}, finalPedidoId, finalNumPedido);
                item = itens[index];
            } else if (preItem) {
                item = {
                    codigo: String(preItem.sku || preItem.codigo || itemCodigo || '').trim(),
                    descricaoPersonalizada: preItem.descricaocomplementar || preItem.descricaoPersonalizada || preItem.descricao || '',
                    responsavel: preItem.responsavel || '',
                    vendedor: preItem.vendedor || '',
                    status: preItem.status || 'OK',
                    quantidade: preItem.quantidade || 1,
                    quantidadeProducao: preItem.quantidade || 1,
                    data: preItem.data || ''
                };
            } else if (garItem) {
                let respSat = garItem.vendedor || garItem.responsavelSat || '';
                if (!respSat && typeof window.GerenciarGarantiaApp !== 'undefined' && typeof window.GerenciarGarantiaApp.getSatgResponsavel === 'function') {
                    respSat = window.GerenciarGarantiaApp.getSatgResponsavel(garItem.pedidoId, garItem.orcamento);
                }
                item = {
                    codigo: String(garItem.sku || garItem.codigo || itemCodigo || '').trim(),
                    descricaoPersonalizada: garItem.descricaocomplementar || garItem.descricaoPersonalizada || garItem.descricao || '',
                    responsavel: garItem.responsavel || '',
                    vendedor: respSat || '',
                    status: garItem.status || 'EM PRODUÇÃO',
                    quantidade: garItem.quantidade || 1,
                    quantidadeProducao: garItem.quantidade || 1,
                    data: garItem.data || '',
                    cliente: garItem.cliente || ''
                };
            }
            if (!item) return;

            // Elementos do layout
            const modal = document.getElementById('edit-item-desc-modal');
            const currentDescEl = document.getElementById('edit-item-desc-current');
            const complementContainer = document.getElementById('edit-item-desc-complement-container');
            const complementText = document.getElementById('edit-item-desc-complement-text');
            const inputEl = document.getElementById('edit-item-desc-input');
            const respEl = document.getElementById('edit-item-responsavel-input');
            const dateEl = document.getElementById('edit-item-date-input');
            const vendEl = document.getElementById('edit-item-vendedor-input');
            const qtyEl = document.getElementById('edit-item-qty-input');
            const saveBtn = document.getElementById('save-edit-item-desc-btn');

            if (!modal || !currentDescEl || !inputEl || !saveBtn) return;

            // Busca o nome original real no cache de produtos
            const prod = _enrichedProductsMap[item.codigo];
            let baseName = prod ? prod.descricao : item.codigo;
            
            const currentPersonalized = item.descricaoPersonalizada || '';
            const rawItemDate = pedido ? (item.dataProducao || pedido.data || pedido.data_criacao || '') : (item.data || '');
            const parsedItemDate = _parseDate(rawItemDate);
            const initialIsoDate = (parsedItemDate && !isNaN(parsedItemDate))
                ? `${parsedItemDate.getFullYear()}-${String(parsedItemDate.getMonth() + 1).padStart(2, '0')}-${String(parsedItemDate.getDate()).padStart(2, '0')}`
                : '';

            // Preencher campos no Modal
            if (currentDescEl) currentDescEl.textContent = baseName;
            
            if (complementContainer && complementText) {
                if (currentPersonalized) {
                    complementText.textContent = currentPersonalized;
                    complementContainer.classList.remove('hidden');
                } else {
                    complementContainer.classList.add('hidden');
                }
            }
            
            inputEl.value = currentPersonalized;
            if (dateEl) dateEl.value = initialIsoDate;

            const getEditResponsavel = _setupResponsavelSelectWidget({
                selectEl: respEl,
                selectGroupEl: document.getElementById('edit-item-resp-select-group'),
                addBtnEl: document.getElementById('edit-item-add-resp-btn'),
                newGroupEl: document.getElementById('edit-item-resp-new-group'),
                newInputEl: document.getElementById('edit-item-new-resp-input'),
                confirmBtnEl: document.getElementById('edit-item-confirm-resp-btn'),
                cancelBtnEl: document.getElementById('edit-item-cancel-resp-btn'),
                currentVal: item.responsavel || ''
            });
            if (vendEl) {
                vendEl.parentElement.classList.remove('hidden');
                const lbl = vendEl.parentElement.querySelector('label');
                if (lbl) {
                    lbl.textContent = garItem ? 'Responsável SAT:' : 'Vendedor:';
                }
                const vendedoresList = _getAllVendedoresList();
                const rawVend = pedido ? (item.vendedorProducao || pedido.vendedor || '') : (item.vendedor || '');
                let currentVend = _getVendedorName(rawVend);
                if (!currentVend || currentVend === '-') currentVend = '';
                currentVend = String(currentVend).trim();

                let selectedValue = '';
                if (currentVend) {
                    const exact = vendedoresList.find(v => v.toLowerCase() === currentVend.toLowerCase());
                    if (exact) {
                        selectedValue = exact;
                    } else {
                        const prefixMatch = vendedoresList.find(v => v.toLowerCase().startsWith(currentVend.toLowerCase() + ' '));
                        if (prefixMatch) {
                            selectedValue = prefixMatch;
                        } else {
                            vendedoresList.push(currentVend);
                            selectedValue = currentVend;
                        }
                    }
                }

                vendEl.innerHTML = '<option value="">-- Sem vendedor --</option>' +
                    vendedoresList.map(v => `<option value="${String(v).replace(/"/g, '&quot;')}">${v}</option>`).join('');
                vendEl.value = selectedValue;
            }
            if (qtyEl) {
                qtyEl.value = pedido ? (item.quantidadeProducao ?? item.quantidade ?? 1) : (item.quantidade ?? 1);
            }
            modal.classList.remove('hidden');
            
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 100);

            // Listeners de Fechar
            const closeModal = () => {
                if (vendEl) vendEl.parentElement.classList.remove('hidden');
                modal.classList.add('hidden');
            };
            document.getElementById('close-edit-item-desc-modal-btn').onclick = closeModal;
            document.getElementById('cancel-edit-item-desc-btn').onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            // Salvar
            saveBtn.onclick = async () => {
                const novaDesc = inputEl.value.trim();
                const novoResp = getEditResponsavel();
                const novaData = dateEl ? dateEl.value.trim() : '';
                const novoVendedor = vendEl ? vendEl.value.trim() : '';
                const novaQtd = qtyEl ? parseFloat(qtyEl.value) : (parseFloat(item.quantidadeProducao ?? item.quantidade) || 1);

                if (qtyEl && (isNaN(novaQtd) || novaQtd <= 0)) {
                    alert('Informe uma quantidade válida maior que zero.');
                    qtyEl.focus();
                    return;
                }

                if (dateEl && initialIsoDate && !novaData) {
                    alert('Informe uma data de solicitação válida.');
                    dateEl.focus();
                    return;
                }

                const dateChanged = Boolean(dateEl && novaData && novaData !== initialIsoDate);
                const dataToSend = dateChanged ? novaData : rawItemDate;

                saveBtn.disabled = true;
                saveBtn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...';

                try {
                    const response = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pedidoId: finalPedidoId,
                            itemCodigo,
                            newDescription: novaDesc,
                            responsavel: novoResp,
                            vendedor: novoVendedor,
                            itemIndex: pedido ? index : (garItem ? (garItem.itemIndex !== undefined ? garItem.itemIndex : index) : ''),
                            numeroPedido: finalNumPedido,
                            orcamento: finalOrcamento,
                            newStatus: item.status || 'OK',
                            quantidade: novaQtd,
                            dataPedido: dataToSend,
                            origem: garItem ? 'Garantia' : undefined,
                            cliente: garItem ? (garItem.cliente || '') : undefined,
                            ...(dateChanged ? { isDateEdit: true } : {})
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText || 'Erro no servidor');
                    }

                    const resJson = await response.json().catch(() => ({}));
                    const updatedDateForCache = dateChanged ? novaData : undefined;
                    
                    // ATUALIZAÇÃO DO CACHE LOCAL & UI
                    if (pedido) {
                        _updatePedidoItemInCache(pedido, index, item.status || 'OK', novaDesc, novoResp, updatedDateForCache, novaQtd, novoVendedor);
                        _updateOrderRowStatus(pedido);
                        _broadcastItemStatusChange({
                            pedidoId: finalPedidoId,
                            numeroPedido: finalNumPedido,
                            orcamento: finalOrcamento,
                            itemCodigo,
                            newStatus: item.status || 'OK',
                            itemIndex: index,
                            newDescription: novaDesc,
                            responsavel: novoResp,
                            quantidade: novaQtd,
                            vendedor: novoVendedor,
                            ...(dateChanged ? { dataPedido: novaData } : {})
                        });
                        
                        // Atualiza a visualização no modal sem fechar
                        const descEl = document.getElementById(`desc-${itemCodigo}-${index}`);
                        if (descEl) descEl.textContent = novaDesc || itemCodigo;
                        const lpDescEl = document.getElementById(`lp-desc-${itemCodigo}-${finalNumPedido || index}`);
                        if (lpDescEl) lpDescEl.textContent = novaDesc || baseName;
                    } else if (preItem) {
                        if (resJson.linkedToExistingPedido && (resJson.pedidoId || resJson.numeroPedido)) {
                            _preProducaoItems = _preProducaoItems.filter(pp =>
                                !(String(pp.orcamento || '').trim() === finalOrcamento && String(pp.sku || pp.codigo || '').trim() === String(itemCodigo || '').trim())
                            );
                            const linkedPedido = _allPedidos.find(p =>
                                String(p.id) === String(resJson.pedidoId) || String(p.numero) === String(resJson.numeroPedido)
                            );
                            if (linkedPedido && resJson.itemIndex !== undefined && resJson.itemIndex !== '') {
                                _updatePedidoItemInCache(linkedPedido, resJson.itemIndex, item.status || 'OK', novaDesc, novoResp, dateChanged ? novaData : resJson.itemData?.data, novaQtd, novoVendedor);
                                _updateOrderRowStatus(linkedPedido);
                            }
                            _broadcastItemStatusChange({
                                pedidoId: String(resJson.pedidoId || ''),
                                numeroPedido: String(resJson.numeroPedido || ''),
                                orcamento: finalOrcamento,
                                itemCodigo,
                                newStatus: item.status || 'OK',
                                itemIndex: resJson.itemIndex ?? '',
                                newDescription: novaDesc,
                                responsavel: novoResp,
                                quantidade: novaQtd,
                                vendedor: novoVendedor,
                                dataPedido: dateChanged ? novaData : resJson.itemData?.data
                            });
                        } else {
                            preItem.descricaocomplementar = novaDesc;
                            preItem.descricaoPersonalizada = novaDesc;
                            preItem.descricao = novaDesc;
                            preItem.responsavel = novoResp;
                            preItem.vendedor = novoVendedor;
                            preItem.quantidade = novaQtd;
                            if (dateChanged) preItem.data = novaData;
                            _broadcastItemStatusChange({
                                pedidoId: '',
                                numeroPedido: '',
                                orcamento: finalOrcamento,
                                itemCodigo,
                                newStatus: item.status || 'OK',
                                itemIndex: '',
                                newDescription: novaDesc,
                                responsavel: novoResp,
                                quantidade: novaQtd,
                                vendedor: novoVendedor,
                                dataPedido: preItem.data
                            });
                            const domRef = 'PRE_' + finalOrcamento.replace(/[^a-zA-Z0-9_-]/g, '_');
                            const lpDescEl = document.getElementById(`lp-desc-${itemCodigo}-${domRef}`);
                            if (lpDescEl) lpDescEl.textContent = novaDesc || baseName;
                        }
                    } else if (garItem) {
                        garItem.descricaocomplementar = novaDesc;
                        garItem.descricaoPersonalizada = novaDesc;
                        garItem.descricao = novaDesc;
                        garItem.responsavel = novoResp;
                        garItem.quantidade = novaQtd;
                        if (dateChanged) garItem.data = novaData;
                        _broadcastItemStatusChange({
                            pedidoId: finalPedidoId,
                            numeroPedido: finalNumPedido,
                            orcamento: finalOrcamento,
                            itemCodigo,
                            newStatus: item.status || 'OK',
                            itemIndex: garItem.itemIndex !== undefined ? garItem.itemIndex : index,
                            newDescription: novaDesc,
                            responsavel: novoResp,
                            quantidade: novaQtd,
                            origem: 'Garantia',
                            cliente: garItem.cliente || '',
                            dataPedido: garItem.data
                        });
                        const safeGarRef = 'GAR_' + String(finalPedidoId).replace(/[^a-zA-Z0-9_-]/g, '_') + (garItem.itemIndex !== '' ? `_${garItem.itemIndex}` : '');
                        const lpDescEl = document.getElementById(`lp-desc-${itemCodigo}-${safeGarRef}`);
                        if (lpDescEl) lpDescEl.textContent = novaDesc || baseName;
                    }
                    
                    if (typeof Toastify !== 'undefined') {
                        Toastify({ text: "Item atualizado!", duration: 2500, style: { background: "#10b981" } }).showToast();
                    }
                    
                    const orderDetailsModal = document.getElementById('order-details-modal');
                    if (pedido && orderDetailsModal && !orderDetailsModal.classList.contains('hidden')) {
                        _openOrderDetailsModal(pedidoId);
                    }
                    if (_state.linhaProducaoModal && !_state.linhaProducaoModal.classList.contains('hidden')) {
                        _showProductionLine();
                    }

                    closeModal();
                } catch (error) {
                    console.error("Erro ao editar item:", error);
                    alert("Erro ao salvar: " + error.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Salvar';
                }
            };
        },
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
        getAllGarantiaProducaoItems: () => _garantiaProducaoItems,
        getAllPreProducaoItems: () => _preProducaoItems,
        getAllResponsaveisList: _getAllResponsaveisList,
        updateOrderSingleRow: function(data) {
            if (!data || !data.numero) return;
            const numero = String(data.numero);
            
            // 1. Update internal data
            const index = _allPedidos.findIndex(p => String(p.numero) === numero || String(p.id) === numero);
            if (index !== -1) {
                // Update properties if provided in data
                if (data.situacao) _allPedidos[index].situacao = data.situacao;
                if (data.total !== undefined) _allPedidos[index].total_pedido = data.total;
                if (data.cliente) _allPedidos[index].contato_nome = data.cliente;
                if (data.data) _allPedidos[index].data = data.data;
                if (data.vendedor) _allPedidos[index].vendedor = data.vendedor;
                if (data.orcamento) _allPedidos[index].orcamento = data.orcamento;
                if (data.id_nota) _allPedidos[index].id_nota = data.id_nota;
                
                // Também atualiza na cópia filtrada
                const fIndex = _filteredPedidos.findIndex(p => String(p.numero) === numero || String(p.id) === numero);
                if (fIndex !== -1) {
                    if (data.situacao) _filteredPedidos[fIndex].situacao = data.situacao;
                    if (data.total !== undefined) _filteredPedidos[fIndex].total_pedido = data.total;
                    if (data.cliente) _filteredPedidos[fIndex].contato_nome = data.cliente;
                    if (data.data) _filteredPedidos[fIndex].data = data.data;
                    if (data.vendedor) _filteredPedidos[fIndex].vendedor = data.vendedor;
                    if (data.orcamento) _filteredPedidos[fIndex].orcamento = data.orcamento;
                    if (data.id_nota) _filteredPedidos[fIndex].id_nota = data.id_nota;
                }

                // Força o re-render completo da tabela para refletir TODAS as edições imediatamente
                _filterPedidos();
                
                // NOVO: Atualizar modal se estiver aberto para este pedido (ex: NFe recém vinculada via webhook de pedido)
                if (_currentModalPedidoId && String(_currentModalPedidoId) === numero) {
                    _openOrderDetailsModal(numero);
                }
                
                // Aplica o flash visual na linha re-renderizada
                setTimeout(() => {
                    const row = document.getElementById(`pedido-row-${numero}`);
                    if (row) {
                        row.classList.add('row-update-flash');
                        setTimeout(() => row.classList.remove('row-update-flash'), 2000);
                    }
                }, 100);

            } else {
                // Pedido novo que não está no frontend ainda. 
                console.log(`[GerenciarPedidos] Pedido novo detectado (${numero}). Recarregando lista completa...`);
                
                // Registra como novo para pintar de azul independente do payload do evento
                const newOrders = JSON.parse(localStorage.getItem('new_orders_highlight') || '[]');
                if (!newOrders.includes(String(numero))) {
                    newOrders.push(String(numero));
                    localStorage.setItem('new_orders_highlight', JSON.stringify(newOrders));
                }

                fetchPedidos(true); // O true força o bypass do cache
                return;
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
        },
        handleSearchProduct: function(codigo, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            console.log(`[GerenciarPedidos] Pesquisando produto ${codigo}...`);
            
            // Se houver integração com o PesquisarProduto, abre lá
            const navPesquisar = document.getElementById('nav-pesquisar');
            if (navPesquisar && typeof window.PesquisarProduto !== 'undefined') {
                navPesquisar.click();

                // Garante que a barra de filtro global esteja visível
                const globalFilterBar = document.getElementById('global-filter-bar');
                if (globalFilterBar) globalFilterBar.classList.remove('hidden');

                // Dá um tempo para a página mudar antes de pesquisar
                setTimeout(() => {
                    const searchInput = document.getElementById('global-search-input');
                    if (searchInput) {
                        searchInput.value = codigo;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        searchInput.focus();
                    }
                }, 150);
            }
        },
        openProductionStatusModal: function(pedidoId, itemCodigo, index, numeroPedido, currentStatus, event, orcamento = '') {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const modal = document.getElementById('lp-status-modal');
            const subtitle = document.getElementById('lp-status-modal-subtitle');
            const closeBtn = document.getElementById('close-lp-status-modal-btn');
            const cancelBtn = document.getElementById('cancel-lp-status-modal-btn');
            const confirmBtn = document.getElementById('confirm-lp-status-modal-btn');

            if (!modal || !confirmBtn) return;

            let normStatus = String(currentStatus || 'EM PRODUÇÃO').toUpperCase().trim();
            if (normStatus === 'PRODUCAO' || normStatus === 'EM PRODUCAO') normStatus = 'EM PRODUÇÃO';

            if (subtitle) {
                const isGar = String(pedidoId || numeroPedido || '').toUpperCase().startsWith('GAR-');
                const domRef = isGar
                    ? ('GAR_' + String(pedidoId || numeroPedido || '').replace(/[^a-zA-Z0-9_-]/g, '_') + (index !== "''" && index !== '' && index !== undefined ? `_${index}` : ''))
                    : ((!pedidoId && !numeroPedido && orcamento)
                        ? ('PRE_' + String(orcamento).replace(/[^a-zA-Z0-9_-]/g, '_'))
                        : index);
                const descEl = document.getElementById(`lp-desc-${itemCodigo}-${domRef}`)
                    || document.getElementById(`lp-desc-${itemCodigo}-${numeroPedido}`);
                const descText = descEl ? descEl.textContent.trim() : itemCodigo;
                if (isGar) {
                    subtitle.textContent = `Garantia #${numeroPedido || pedidoId} • ${descText}`;
                } else if (!pedidoId && !numeroPedido && orcamento) {
                    subtitle.textContent = `Orçamento ${orcamento} (Pré-Prod) • ${descText}`;
                } else {
                    subtitle.textContent = `Pedido #${numeroPedido || pedidoId} • ${descText}`;
                }
            }

            const radios = modal.querySelectorAll('input[name="lp-item-status-radio"]');
            let matched = false;
            radios.forEach(r => {
                if (r.value.toUpperCase() === normStatus) {
                    r.checked = true;
                    matched = true;
                } else {
                    r.checked = false;
                }
            });
            if (!matched && radios.length > 0) radios[0].checked = true;

            const closeModal = () => modal.classList.add('hidden');
            if (closeBtn) closeBtn.onclick = closeModal;
            if (cancelBtn) cancelBtn.onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Confirmar';
            confirmBtn.onclick = async () => {
                const checkedRadio = modal.querySelector('input[name="lp-item-status-radio"]:checked');
                if (!checkedRadio) return;
                const selectedStatus = checkedRadio.value;

                if (selectedStatus === normStatus) {
                    closeModal();
                    return;
                }

                confirmBtn.disabled = true;
                confirmBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...`;

                try {
                    await this.handleQuickProductionStatus(pedidoId, itemCodigo, index, numeroPedido, selectedStatus, null, orcamento);
                    closeModal();
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = 'Confirmar';
                }
            };

            modal.classList.remove('hidden');
        },
        handleQuickProductionStatus: async function(pedidoId, itemCodigo, index, numeroPedido, explicitStatus, event, orcamento = '') {
            let btn = null;
            let originalHtml = '';
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                if (event.currentTarget) {
                    btn = event.currentTarget;
                    originalHtml = btn.innerHTML;
                    btn.innerHTML = `<svg class="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                    btn.disabled = true;
                }
            }

            // Busca o pedido no cache
            const pCache = pedidoId
                ? _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId))
                : null;
            const finalOrc = String(orcamento || (pCache ? (pCache.orcamento || pCache.orçamento || '') : '')).trim();
            let preItem = null;
            if (!pCache && finalOrc) {
                const targetSku = String(itemCodigo || '').trim();
                preItem = _preProducaoItems.find(pp =>
                    String(pp.orcamento || '').trim() === finalOrc &&
                    String(pp.sku || pp.codigo || '').trim() === targetSku
                ) || null;
            }

            let garItem = null;
            if (!pCache && !preItem) {
                const targetPid = String(pedidoId || numeroPedido || '').trim();
                const targetSku = String(itemCodigo || '').trim();
                const targetIdx = (index !== undefined && index !== null && index !== '') ? String(index) : '';
                garItem = _garantiaProducaoItems.find(gi => {
                    const gPid = String(gi.pedidoId || '').trim();
                    const gSku = String(gi.sku || gi.codigo || '').trim();
                    const gIdx = (gi.itemIndex !== undefined && gi.itemIndex !== null) ? String(gi.itemIndex) : '';
                    if (gPid && targetPid && gPid === targetPid) {
                        if (targetIdx !== '' && gIdx !== '') return gIdx === targetIdx && (!targetSku || gSku === targetSku);
                        return !targetSku || gSku === targetSku;
                    }
                    return false;
                }) || null;
            }
            
            try {
                // Pega a descrição e o responsavel atual do cache para não perder
                let currentDesc = '';
                let currentResp = '';
                if (pCache && pCache.detalhesProducao) {
                    const keyId = `${pedidoId}-${index}`;
                    const keyNum = `${pCache.numero || pCache.numero_pedido}-${index}`;
                    const extra = pCache.detalhesProducao[keyId] || pCache.detalhesProducao[keyNum];
                    if (extra) {
                        currentDesc = extra.descricao || '';
                        currentResp = extra.responsavel || '';
                    }
                } else if (preItem) {
                    currentDesc = preItem.descricaocomplementar || preItem.descricaoPersonalizada || preItem.descricao || '';
                    currentResp = preItem.responsavel || '';
                } else if (garItem) {
                    currentDesc = garItem.descricaocomplementar || garItem.descricaoPersonalizada || garItem.descricao || '';
                    currentResp = garItem.responsavel || '';
                }

                // Se não houver descrição complementar, usa a descrição original do produto como fallback
                if (!currentDesc) {
                    const prod = _enrichedProductsMap[itemCodigo];
                    if (prod && prod.descricao) currentDesc = prod.descricao;
                }

                const parsedForQty = (pCache && index !== undefined && index !== '')
                    ? _parseItens(pCache?.itens, pCache?.detalhesProducao || {}, pedidoId)[index]
                    : null;

                const url = API_URLS.UPDATE_ITEM_STATUS;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedidoId: pCache ? (pCache.id || pedidoId) : (garItem ? (garItem.pedidoId || pedidoId) : ''),
                        itemCodigo,
                        newStatus: explicitStatus,
                        itemIndex: pCache ? index : (garItem ? (garItem.itemIndex !== undefined ? garItem.itemIndex : index) : ''),
                        newDescription: currentDesc,
                        responsavel: currentResp,
                        numeroPedido: pCache ? (pCache.numero || pCache.numero_pedido || '') : (garItem ? (garItem.pedidoId || pedidoId) : (numeroPedido || '')),
                        orcamento: garItem ? (garItem.orcamento || finalOrc) : finalOrc,
                        quantidade: pCache
                            ? (parsedForQty ? (parsedForQty.quantidadeProducao ?? parsedForQty.quantidade ?? 1) : 1)
                            : (garItem ? (garItem.quantidade || 1) : (preItem ? (preItem.quantidade || 1) : 1)),
                        dataPedido: pCache ? (pCache.data || pCache.data_criacao || '') : (garItem ? (garItem.data || '') : (preItem ? (preItem.data || '') : '')),
                        origem: garItem ? 'Garantia' : undefined,
                        cliente: garItem ? (garItem.cliente || '') : undefined
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Erro ao atualizar status do item');
                }

                const resJson = await response.json().catch(() => ({}));
                const itemData = resJson.itemData || {};

                // ATUALIZAÇÃO DO CACHE LOCAL & UI
                if (pCache) {
                    const resolvedDesc = resJson.linkedFromOrcamento ? (itemData.descricao ?? currentDesc) : currentDesc;
                    const resolvedResp = resJson.linkedFromOrcamento ? (itemData.responsavel ?? currentResp) : currentResp;
                    const resolvedQty = resJson.linkedFromOrcamento && itemData.quantidade !== undefined && itemData.quantidade !== '' ? itemData.quantidade : undefined;
                    const resolvedVend = resJson.linkedFromOrcamento && itemData.vendedor !== undefined && itemData.vendedor !== '' ? itemData.vendedor : undefined;
                    _updatePedidoItemInCache(pCache, index, explicitStatus, resolvedDesc, resolvedResp, itemData.data, resolvedQty, resolvedVend);
                    if (resJson.linkedFromOrcamento && finalOrc) {
                        _preProducaoItems = _preProducaoItems.filter(pp =>
                            !(String(pp.orcamento || '').trim() === finalOrc && String(pp.sku || pp.codigo || '').trim() === String(itemCodigo || '').trim())
                        );
                    }
                    _updateOrderRowStatus(pCache);
                    _broadcastItemStatusChange({
                        pedidoId,
                        numeroPedido: pCache.numero || pCache.numero_pedido || pedidoId,
                        orcamento: finalOrc,
                        itemCodigo,
                        newStatus: explicitStatus,
                        itemIndex: index,
                        newDescription: resolvedDesc,
                        responsavel: resolvedResp,
                        data: itemData.data,
                        quantidade: resolvedQty,
                        vendedor: resolvedVend
                    });
                } else if (preItem) {
                    if (resJson.linkedToExistingPedido && (resJson.pedidoId || resJson.numeroPedido)) {
                        _preProducaoItems = _preProducaoItems.filter(pp =>
                            !(String(pp.orcamento || '').trim() === finalOrc && String(pp.sku || pp.codigo || '').trim() === String(itemCodigo || '').trim())
                        );
                        const linkedPedido = _allPedidos.find(p =>
                            String(p.id) === String(resJson.pedidoId) || String(p.numero) === String(resJson.numeroPedido)
                        );
                        if (linkedPedido && resJson.itemIndex !== undefined && resJson.itemIndex !== '') {
                            _updatePedidoItemInCache(linkedPedido, resJson.itemIndex, explicitStatus, itemData.descricao ?? currentDesc, itemData.responsavel ?? currentResp, itemData.data);
                            _updateOrderRowStatus(linkedPedido);
                        }
                        _broadcastItemStatusChange({
                            pedidoId: String(resJson.pedidoId || ''),
                            numeroPedido: String(resJson.numeroPedido || ''),
                            orcamento: finalOrc,
                            itemCodigo,
                            newStatus: explicitStatus,
                            itemIndex: resJson.itemIndex ?? '',
                            newDescription: itemData.descricao ?? currentDesc,
                            responsavel: itemData.responsavel ?? currentResp,
                            data: itemData.data
                        });
                    } else {
                        preItem.status = explicitStatus;
                        preItem.descricaocomplementar = currentDesc;
                        preItem.responsavel = currentResp;
                        _broadcastItemStatusChange({
                            pedidoId: '',
                            numeroPedido: '',
                            orcamento: finalOrc,
                            itemCodigo,
                            newStatus: explicitStatus,
                            itemIndex: '',
                            newDescription: currentDesc,
                            responsavel: currentResp
                        });
                    }
                } else if (garItem) {
                    garItem.status = explicitStatus;
                    garItem.descricaocomplementar = currentDesc;
                    garItem.responsavel = currentResp;
                    const garSyncData = {
                        pedidoId: garItem.pedidoId || pedidoId,
                        numeroPedido: garItem.pedidoId || pedidoId,
                        orcamento: garItem.orcamento || finalOrc,
                        itemCodigo,
                        newStatus: explicitStatus,
                        itemIndex: garItem.itemIndex !== undefined ? garItem.itemIndex : index,
                        newDescription: currentDesc,
                        responsavel: currentResp,
                        origem: 'Garantia',
                        cliente: garItem.cliente || '',
                        dataPedido: garItem.data
                    };
                    _broadcastItemStatusChange(garSyncData);
                    if (window.GerenciarGarantiaApp && typeof window.GerenciarGarantiaApp.updateItemStatusRealTime === 'function') {
                        window.GerenciarGarantiaApp.updateItemStatusRealTime(garSyncData);
                    }
                }

                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: resJson.linkedFromOrcamento || resJson.linkedToExistingPedido
                            ? `Item marcado como ${explicitStatus} e vinculado ao Orçamento ${finalOrc}!`
                            : `Item marcado como ${explicitStatus}`,
                        duration: 2800,
                        style: { background: "#10b981" }
                    }).showToast();
                }

                // Recarrega o modal da linha de produção visualmente
                _showProductionLine();

            } catch (error) {
                console.error("Erro ao alterar status:", error);
                _showCustomAlert('Erro', error.message, false);
                if (btn) {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            }
        },
        handleDropdownItemStatus: async function(pedidoId, itemCodigo, newStatus, index, currentStatus, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (newStatus === currentStatus) return;

            document.querySelectorAll('.pedido-item-custom-dropdown-menu').forEach(m => m.classList.add('hidden'));

            const pCache = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            const finalOrc = pCache ? String(pCache.orcamento || pCache.orçamento || '').trim() : '';

            let currentDesc = '';
            let currentResp = '';
            if (pCache && pCache.detalhesProducao) {
                const keyId = `${pedidoId}-${index}`;
                const keyNum = `${pCache.numero || pCache.numero_pedido}-${index}`;
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

            const executeUpdate = async (responsavel) => {
                try {
                    const finalResponsavel = (responsavel !== undefined && responsavel !== null) ? responsavel : currentResp;

                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) {
                        const detailsBox = loadingOverlay.querySelector('.bg-gray-900');
                        if (detailsBox) detailsBox.style.display = 'none';
                        const p = loadingOverlay.querySelector('p');
                        if (p) p.textContent = 'Enviando p/ Linha...';
                        loadingOverlay.classList.remove('hidden');
                    }

                    const parsedForQty = (index !== undefined && pCache)
                        ? _parseItens(pCache.itens, pCache.detalhesProducao || {}, pedidoId)[index]
                        : null;

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
                            orcamento: finalOrc,
                            quantidade: parsedForQty ? (parsedForQty.quantidadeProducao ?? parsedForQty.quantidade ?? 1) : 1,
                            dataPedido: pCache ? (pCache.data || pCache.data_criacao || '') : '',
                            origem: 'Pedido'
                        })
                    });

                    if (loadingOverlay) loadingOverlay.classList.add('hidden');

                    if (!response.ok) {
                        const errTxt = await response.text();
                        throw new Error(errTxt || 'Erro ao atualizar status do item');
                    }

                    const resJson = await response.json().catch(() => ({}));
                    const itemData = resJson.itemData || {};

                    // Sincronização de Cache & UI
                    const baseSt = newStatus === 'OK' ? 'FINALIZADO' : newStatus;
                    const finalSt = (resJson.linkedFromOrcamento && itemData.status) ? itemData.status : baseSt;
                    const resolvedDesc = (resJson.linkedFromOrcamento && itemData.descricao !== undefined) ? itemData.descricao : currentDesc;
                    const resolvedResp = (resJson.linkedFromOrcamento && itemData.responsavel !== undefined) ? itemData.responsavel : finalResponsavel;
                    const resolvedData = resJson.linkedFromOrcamento ? itemData.data : undefined;
                    const resolvedQty = resJson.linkedFromOrcamento && itemData.quantidade !== undefined && itemData.quantidade !== '' ? itemData.quantidade : undefined;
                    const resolvedVend = resJson.linkedFromOrcamento && itemData.vendedor !== undefined && itemData.vendedor !== '' ? itemData.vendedor : undefined;

                    if (pCache) {
                        _updatePedidoItemInCache(pCache, index, finalSt, resolvedDesc, resolvedResp, resolvedData, resolvedQty, resolvedVend);
                        if (resJson.linkedFromOrcamento && finalOrc) {
                            _preProducaoItems = _preProducaoItems.filter(pp =>
                                !(String(pp.orcamento || '').trim() === finalOrc && String(pp.sku || pp.codigo || '').trim() === String(itemCodigo || '').trim())
                            );
                        }
                        _updateOrderRowStatus(pCache);
                        _broadcastItemStatusChange({
                            pedidoId,
                            numeroPedido: pCache.numero || pCache.numero_pedido || pedidoId,
                            orcamento: finalOrc,
                            itemCodigo,
                            newStatus: finalSt,
                            itemIndex: index,
                            newDescription: resolvedDesc,
                            responsavel: resolvedResp,
                            data: resolvedData,
                            quantidade: resolvedQty,
                            vendedor: resolvedVend
                        });
                    }

                    if (resJson.linkedFromOrcamento && finalOrc && typeof Toastify !== 'undefined') {
                        Toastify({
                            text: `Item vinculado à pré-produção do Orçamento ${finalOrc} (data preservada)!`,
                            duration: 3500,
                            style: { background: "#0284c7" }
                        }).showToast();
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
                const labelTxt = currentResp ? `O item já está com ${currentResp}. Deseja alterar o responsável?` : "Selecione o responsável pela produção:";
                const respOptions = typeof _getAllResponsaveisList === 'function' ? _getAllResponsaveisList() : ['CLEITON', 'KAKA', 'MARCAO', 'SILVIO'];
                if (window._promptGeneric) {
                    window._promptGeneric("Responsável", labelTxt, async (ans) => {
                        await executeUpdate(ans ? String(ans).trim().toUpperCase() : '');
                    }, "select", currentResp ? String(currentResp).trim().toUpperCase() : '', respOptions);
                } else {
                    const ans = prompt(labelTxt, currentResp);
                    await executeUpdate(ans ? String(ans).trim().toUpperCase() : '');
                }
            } else {
                await executeUpdate();
            }
        },
        handleToggleItemStatus: async function(pedidoId, itemCodigo, currentStatus, index, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const newStatus = (currentStatus === 'OK') ? 'EM PRODUÇÃO' : 'OK';
            
            // Busca o pedido no cache
            const pCache = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            const finalOrc = pCache ? String(pCache.orcamento || pCache.orçamento || '').trim() : '';
            
            const btn = document.getElementById(`status-badge-${pedidoId}-${index}`);
            
            // Optimistic UI Update
            if (btn) {
                btn.classList.add('opacity-50', 'pointer-events-none');
                const span = btn.querySelector('span');
                if (span) span.innerText = 'Salvando...';
            }

            try {
                // Pega a descrição atual do cache para não perder ao salvar status
                let currentDesc = '';
                if (pCache && pCache.detalhesProducao) {
                    const keyId = `${pedidoId}-${index}`;
                    const keyNum = `${pCache.numero || pCache.numero_pedido}-${index}`;
                    const extra = pCache.detalhesProducao[keyId] || pCache.detalhesProducao[keyNum];
                    if (extra) currentDesc = extra.descricao || '';
                }

                // Se não houver descrição complementar, usa a descrição original do produto como fallback
                if (!currentDesc) {
                    const prod = _enrichedProductsMap[itemCodigo];
                    if (prod && prod.descricao) currentDesc = prod.descricao;
                }

                const parsedForQty = (index !== undefined && pCache)
                    ? _parseItens(pCache.itens, pCache.detalhesProducao || {}, pedidoId)[index]
                    : null;

                const url = API_URLS.UPDATE_ITEM_STATUS;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedidoId,
                        itemCodigo,
                        newStatus,
                        itemIndex: index,
                        newDescription: currentDesc,
                        numeroPedido: pCache ? (pCache.numero || pCache.numero_pedido || '') : '',
                        orcamento: finalOrc,
                        quantidade: parsedForQty ? (parsedForQty.quantidadeProducao ?? parsedForQty.quantidade ?? 1) : 1,
                        dataPedido: pCache ? (pCache.data || pCache.data_criacao || '') : ''
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Erro ao atualizar status do item');
                }

                const resJson = await response.json().catch(() => ({}));
                const itemData = resJson.itemData || {};
                const resolvedStatus = (resJson.linkedFromOrcamento && itemData.status) ? itemData.status : newStatus;
                const resolvedDesc = (resJson.linkedFromOrcamento && itemData.descricao !== undefined) ? itemData.descricao : currentDesc;
                const resolvedResp = (resJson.linkedFromOrcamento && itemData.responsavel !== undefined) ? itemData.responsavel : undefined;
                const resolvedData = resJson.linkedFromOrcamento ? itemData.data : undefined;
                const resolvedQty = resJson.linkedFromOrcamento && itemData.quantidade !== undefined && itemData.quantidade !== '' ? itemData.quantidade : undefined;
                const resolvedVend = resJson.linkedFromOrcamento && itemData.vendedor !== undefined && itemData.vendedor !== '' ? itemData.vendedor : undefined;

                // Feedback imediato no badge...
                if (btn) {
                    btn.classList.remove('opacity-50', 'pointer-events-none');
                    const span = btn.querySelector('span');
                    if (span) span.innerText = (resolvedStatus === 'OK') ? 'OK' : resolvedStatus;
                    const isProducao = resolvedStatus === 'EM PRODUÇÃO';
                    const badgeClass = isProducao 
                        ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' 
                        : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
                    btn.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all cursor-pointer shadow-sm active:scale-95 ${badgeClass}`;
                    btn.setAttribute('onclick', `GerenciarPedidosApp.handleToggleItemStatus('${pedidoId}', '${itemCodigo}', '${resolvedStatus}', ${index}, event)`);
                }

                // Sincronização de Cache & UI
                if (pCache) {
                    _updatePedidoItemInCache(pCache, index, resolvedStatus, resolvedDesc, resolvedResp, resolvedData, resolvedQty, resolvedVend);
                    if (resJson.linkedFromOrcamento && finalOrc) {
                        _preProducaoItems = _preProducaoItems.filter(pp =>
                            !(String(pp.orcamento || '').trim() === finalOrc && String(pp.sku || pp.codigo || '').trim() === String(itemCodigo || '').trim())
                        );
                    }
                    _updateOrderRowStatus(pCache);
                    _broadcastItemStatusChange({
                        pedidoId,
                        numeroPedido: pCache.numero || pCache.numero_pedido || pedidoId,
                        orcamento: finalOrc,
                        itemCodigo,
                        newStatus: resolvedStatus,
                        itemIndex: index,
                        newDescription: resolvedDesc,
                        responsavel: resolvedResp,
                        data: resolvedData,
                        quantidade: resolvedQty,
                        vendedor: resolvedVend
                    });
                }

                if (resJson.linkedFromOrcamento && finalOrc && typeof Toastify !== 'undefined') {
                    Toastify({
                        text: `Item vinculado à pré-produção do Orçamento ${finalOrc} (data preservada)!`,
                        duration: 3500,
                        style: { background: "#0284c7" }
                    }).showToast();
                }

                // AUTO-UPDATE de Pedido Global desativado temporariamente para evitar erros de API no Bling
                /*
                if (newStatus === 'EM PRODUÇÃO') {
                    // ... lógica de update global ...
                }
                */

                // O sync via Firestore cuidará de atualizar a UI em todos os clientes.

            } catch (error) {
                console.error("Erro ao alternar status do item:", error);
                alert("Erro ao salvar: " + error.message);
                // Restaura o botão em caso de erro
                _openOrderDetailsModal(pedidoId);
            }
        },
        handleEditProductionDate: async function(pedidoId, itemCodigo, itemIndex, currentDate, event, numeroPedido, orcamento = '') {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            // Garante que o valor inicial no prompt esteja no formato dd/mm/aaaa
            const initialValue = _fmtData(currentDate);
            const newDateStr = prompt("Informe a nova data (DD/MM/AAAA):", initialValue);
            
            if (newDateStr === null || newDateStr === initialValue || !newDateStr.trim()) return;

            // Validação básica do formato dd/mm/aaaa
            const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            const match = newDateStr.match(dateRegex);
            
            let dateToSave = newDateStr;
            if (match) {
                // Converte para yyyy-mm-dd para consistência no banco de dados
                dateToSave = `${match[3]}-${match[2]}-${match[1]}`;
            }

            const pedido = pedidoId
                ? _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId))
                : null;
            const finalOrc = String(orcamento || (pedido ? (pedido.orcamento || pedido.orçamento || '') : '')).trim();
            let preItem = null;
            if (!pedido && finalOrc) {
                preItem = _preProducaoItems.find(pp =>
                    String(pp.orcamento || '').trim() === finalOrc &&
                    String(pp.sku || pp.codigo || '').trim() === String(itemCodigo || '').trim()
                ) || null;
            }

            try {
                // Feedback visual de carregamento
                if (event && event.target) {
                    event.target.innerText = '...';
                }

                const response = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedidoId: pedido ? (pedido.id || pedidoId) : '',
                        numeroPedido: pedido ? (pedido.numero || numeroPedido || '') : (numeroPedido || ''),
                        orcamento: finalOrc,
                        itemCodigo,
                        itemIndex: pedido ? itemIndex : '',
                        dataPedido: dateToSave,
                        isDateEdit: true
                    })
                });

                if (!response.ok) throw new Error("Erro ao salvar data.");

                // Atualiza o cache local para refletir na UI sem refresh
                if (pedido) {
                    _updatePedidoItemInCache(pedido, itemIndex, undefined, undefined, undefined, dateToSave);
                    _broadcastItemStatusChange({
                        pedidoId,
                        numeroPedido: pedido.numero || numeroPedido || pedidoId,
                        orcamento: finalOrc,
                        itemCodigo,
                        itemIndex,
                        dataPedido: dateToSave
                    });
                } else if (preItem) {
                    preItem.data = dateToSave;
                    _broadcastItemStatusChange({
                        pedidoId: '',
                        numeroPedido: '',
                        orcamento: finalOrc,
                        itemCodigo,
                        itemIndex: '',
                        dataPedido: dateToSave
                    });
                }

                if (typeof Toastify !== 'undefined') {
                    Toastify({ text: "Data atualizada!", duration: 2000, style: { background: "#10b981" } }).showToast();
                }

                // Recarrega a linha de produção para refletir a mudança
                _showProductionLine();

            } catch (error) {
                console.error("Erro ao editar data:", error);
                alert("Erro ao salvar data: " + error.message);
                _showProductionLine(); // Restaura o estado anterior
            }
        },
        updateOrderItemStatusRealTime: function(data, isLocalBroadcast = false) {
            if (!data) return;
            const { pedidoId, numeroPedido, orcamento, itemCodigo, newStatus, itemIndex, newDescription, dataPedido, data: dataField, responsavel, quantidade, vendedor, isPreProd } = data;
            const resolvedDate = dataPedido !== undefined ? dataPedido : dataField;
            console.log(`[GerenciarPedidos] Sincronizando status/data/resp do item ${itemCodigo} (${pedidoId || numeroPedido || ('Orç ' + orcamento)})`);

            // 1. Atualizar no cache local & atualizar linha da tabela
            const pedido = (pedidoId || numeroPedido)
                ? _allPedidos.find(p => 
                    (pedidoId && (String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId))) ||
                    (numeroPedido && (String(p.numero) === String(numeroPedido) || String(p.id) === String(numeroPedido)))
                )
                : null;
            
            if (pedido) {
                _updatePedidoItemInCache(pedido, itemIndex, newStatus, newDescription, responsavel, resolvedDate, quantidade, vendedor);
                _updateOrderRowStatus(pedido);
                const linkedOrc = String(orcamento || pedido.orcamento || pedido.orçamento || '').trim();
                if (!isPreProd && linkedOrc && itemCodigo) {
                    _preProducaoItems = _preProducaoItems.filter(pp =>
                        !(String(pp.orcamento || '').trim() === linkedOrc && String(pp.sku || pp.codigo || '').trim() === String(itemCodigo).trim())
                    );
                }
            } else if (orcamento && !pedidoId && !numeroPedido) {
                const targetOrc = String(orcamento).trim();
                const targetSku = String(itemCodigo || '').trim();
                if (targetOrc && targetSku) {
                    const existingIdx = _preProducaoItems.findIndex(pp =>
                        String(pp.orcamento || '').trim() === targetOrc &&
                        String(pp.sku || pp.codigo || '').trim() === targetSku
                    );
                    if (existingIdx >= 0) {
                        const ex = _preProducaoItems[existingIdx];
                        if (newStatus !== undefined) ex.status = newStatus;
                        if (newDescription !== undefined) {
                            ex.descricaocomplementar = newDescription;
                            ex.descricaoPersonalizada = newDescription;
                            ex.descricao = newDescription;
                        }
                        if (responsavel !== undefined) ex.responsavel = responsavel;
                        if (resolvedDate !== undefined) ex.data = resolvedDate;
                        if (quantidade !== undefined) ex.quantidade = quantidade;
                        if (vendedor !== undefined) ex.vendedor = vendedor;
                    } else {
                        _preProducaoItems.push({
                            orcamento: targetOrc,
                            sku: targetSku,
                            codigo: targetSku,
                            status: newStatus || 'EM PRODUÇÃO',
                            descricaocomplementar: newDescription || '',
                            descricao: newDescription || '',
                            responsavel: responsavel || '',
                            vendedor: vendedor || '',
                            quantidade: quantidade || 1,
                            data: resolvedDate || ''
                        });
                    }
                }
            } else if (data.origem === 'Garantia' || (pedidoId && String(pedidoId).toUpperCase().startsWith('GAR-')) || (numeroPedido && String(numeroPedido).toUpperCase().startsWith('GAR-'))) {
                const targetPid = String(pedidoId || numeroPedido || '').trim();
                const targetSku = String(itemCodigo || '').trim();
                const targetIdx = (itemIndex !== undefined && itemIndex !== null && itemIndex !== '') ? String(itemIndex) : '';
                const existingGar = _garantiaProducaoItems.find(gi => {
                    const gPid = String(gi.pedidoId || '').trim();
                    const gSku = String(gi.sku || gi.codigo || '').trim();
                    const gIdx = (gi.itemIndex !== undefined && gi.itemIndex !== null) ? String(gi.itemIndex) : '';
                    if (gPid && targetPid && gPid === targetPid) {
                        if (targetIdx !== '' && gIdx !== '') return gIdx === targetIdx && (!targetSku || gSku === targetSku);
                        return !targetSku || gSku === targetSku;
                    }
                    return false;
                });
                if (existingGar) {
                    if (newStatus !== undefined) existingGar.status = newStatus;
                    if (newDescription !== undefined) {
                        existingGar.descricao = newDescription;
                        existingGar.descricaocomplementar = newDescription;
                        existingGar.descricaoPersonalizada = newDescription;
                    }
                    if (responsavel !== undefined) existingGar.responsavel = responsavel;
                    if (resolvedDate !== undefined) existingGar.data = resolvedDate;
                    if (quantidade !== undefined) existingGar.quantidade = quantidade;
                    if (data.cliente !== undefined) existingGar.cliente = data.cliente;
                    if (data.vendedor !== undefined) existingGar.vendedor = data.vendedor;
                } else if (newStatus && String(newStatus).toUpperCase().trim() !== 'OK') {
                    _garantiaProducaoItems.push({
                        pedidoId: targetPid,
                        sku: targetSku,
                        codigo: targetSku,
                        itemIndex: targetIdx,
                        status: newStatus,
                        descricao: newDescription || '',
                        descricaocomplementar: newDescription || '',
                        responsavel: responsavel || '',
                        vendedor: data.vendedor || '',
                        data: resolvedDate || '',
                        quantidade: quantidade || 1,
                        origem: 'Garantia',
                        orcamento: orcamento || '',
                        cliente: data.cliente || ''
                    });
                }
                if (window.GerenciarGarantiaApp && typeof window.GerenciarGarantiaApp.updateItemStatusRealTime === 'function') {
                    window.GerenciarGarantiaApp.updateItemStatusRealTime(data);
                }
            }

            // 2. Atualizar a UI se o modal estiver aberto para este pedido
            const currentModalMatch = _currentModalPedidoId && pedido && (
                String(_currentModalPedidoId) === String(pedido.id) || 
                String(_currentModalPedidoId) === String(pedido.numero) ||
                (pedidoId && String(_currentModalPedidoId) === String(pedidoId)) ||
                (numeroPedido && String(_currentModalPedidoId) === String(numeroPedido))
            );

            if (currentModalMatch) {
                const targetPid = _currentModalPedidoId;
                const btn = document.getElementById(`status-badge-${targetPid}-${itemIndex}`) || 
                            document.getElementById(`status-badge-${pedido?.id}-${itemIndex}`) ||
                            document.getElementById(`status-badge-${pedido?.numero}-${itemIndex}`);
                if (btn) {
                    const isProducao = String(newStatus || '').toUpperCase().includes('PRODU');
                    const badgeClass = isProducao 
                        ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' 
                        : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
                    
                    btn.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all cursor-pointer shadow-sm active:scale-95 ${badgeClass}`;
                    btn.classList.remove('opacity-50', 'pointer-events-none');
                    
                    const label = isProducao ? 'Em Produção' : 'OK';
                    const icon = isProducao 
                        ? '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
                        : '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                    
                    btn.innerHTML = `${icon}<span>${label}</span>`;
                    btn.setAttribute('onclick', `GerenciarPedidosApp.handleToggleItemStatus('${targetPid}', '${itemCodigo}', '${newStatus}', ${itemIndex}, event)`);
                }
            }

            // 3. SE a Linha de Produção estiver aberta, atualizar em tempo real
            const lpModal = document.getElementById('production-line-modal');
            if (lpModal && !lpModal.classList.contains('hidden')) {
                console.log('[LinhaProducao] Atualizando em tempo real...');
                _showProductionLine();
            }

            // 4. Toast notification se a atualização veio externamente (outro navegador ou broadcast)
            if (!isLocalBroadcast && typeof Toastify !== 'undefined') {
                if (pedido) {
                    const isProd = String(newStatus || '').toUpperCase().includes('PRODU');
                    Toastify({
                        text: `Pedido #${pedido.numero || pedido.id}: item ${itemCodigo || ''} ${isProd ? 'entrou em Produção' : 'marcado como OK'}`,
                        duration: 3500,
                        gravity: "bottom",
                        position: "right",
                        style: { 
                            background: isProd ? "#2563eb" : "#10b981",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600"
                        }
                    }).showToast();
                } else if (orcamento && !pedidoId && !numeroPedido) {
                    Toastify({
                        text: `Orçamento ${orcamento} (Pré-Prod): item ${itemCodigo || ''} atualizado (${newStatus || 'EM PRODUÇÃO'})`,
                        duration: 3500,
                        gravity: "bottom",
                        position: "right",
                        style: {
                            background: "#4f46e5",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600"
                        }
                    }).showToast();
                } else if (data.origem === 'Garantia' || (pedidoId && String(pedidoId).toUpperCase().startsWith('GAR-')) || (numeroPedido && String(numeroPedido).toUpperCase().startsWith('GAR-'))) {
                    const isProd = String(newStatus || '').toUpperCase().includes('PRODU');
                    const targetPid = String(pedidoId || numeroPedido || '').trim();
                    Toastify({
                        text: `Garantia #${targetPid}: item ${itemCodigo || ''} ${isProd ? 'na Produção' : 'marcado como OK'}`,
                        duration: 3500,
                        gravity: "bottom",
                        position: "right",
                        style: {
                            background: "#9333ea",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600"
                        }
                    }).showToast();
                }
            }
        },
        updateOrderNfeInfoRealTime: function(nfeData) {
            const pedidoId = nfeData.id_pedido || nfeData.idPedido;
            if (!pedidoId) return;

            console.log(`[GerenciarPedidos] Sincronizando NF-e ${nfeData.numero} para o pedido ${pedidoId}`);

            // 1. Atualizar no cache local
            const pedido = _allPedidos.find(p => 
                String(p.id) === String(pedidoId) || 
                String(p.numero) === String(pedidoId) || 
                String(p.numero_loja || p.numeroLoja) === String(pedidoId)
            );
            if (pedido) {
                pedido.id_nota = nfeData.id || nfeData.id_nota || nfeData.numero;
                if (nfeData.chaveAcesso) pedido.chave_acesso = nfeData.chaveAcesso;
                if (nfeData.linkDanfe) pedido.link_danfe = nfeData.linkDanfe;
                
                // NOVO: Força o recarregamento da tabela principal em tempo real para exibir o botão da NF-e
                _filterPedidos();
            }

            // 2. Atualizar a UI se o modal estiver aberto para este pedido
            if (_currentModalPedidoId && String(_currentModalPedidoId) === String(pedidoId)) {
                // Força o re-render do modal para mostrar o bloco de NF-e
                _openOrderDetailsModal(pedidoId);
                
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: `NF-e ${nfeData.numero} vinculada ao pedido!`,
                        duration: 3000,
                        gravity: "top",
                        position: "center",
                        style: { background: "#10b981" }
                    }).showToast();
                }
            }
        }
    };
    // ============================================================
    // MÓDULO: GERENCIAR TRANSPORTADORAS
    // ============================================================

    function _openTransportadorasModal() {
        if (!_transportadorasModal) return;
        _transportadorasModal.classList.remove('hidden');
        if (_transportadorasListView) _transportadorasListView.classList.remove('hidden');
        if (_transportadoraFormView) _transportadoraFormView.classList.add('hidden');
        _loadTransportadoras();
    }

    function _showTransportadoraForm(editData = null) {
        if (!_transportadorasModal) return;
        if (_transportadorasListView) _transportadorasListView.classList.add('hidden');
        if (_transportadoraFormView) _transportadoraFormView.classList.remove('hidden');

        const form = document.getElementById('transportadora-form');
        if (form) form.reset();
        const idInput = document.getElementById('transp-id');
        if (idInput) idInput.value = '';

        const title = document.getElementById('transportadora-form-title');

        if (editData) {
            if (idInput) idInput.value = editData.id || '';
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            setVal('transp-nome', editData.nome);
            setVal('transp-cnpj', editData.cnpj);
            setVal('transp-telefone', editData.telefone);
            setVal('transp-placa', editData.placa);
            setVal('transp-uf', editData.uf);
            if (title) title.innerText = 'Editar Transportadora';
        } else {
            if (title) title.innerText = 'Cadastrar Transportadora';
        }

        const successMsg = document.getElementById('transp-form-success');
        if (successMsg) successMsg.classList.add('hidden');
        const errorMsg = document.getElementById('transp-form-error');
        if (errorMsg) errorMsg.classList.add('hidden');
    }

    async function _loadTransportadoras() {
        const tbody = document.getElementById('transportadoras-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500"><div class="flex flex-col items-center justify-center space-y-2"><svg class="w-8 h-8 animate-spin text-green-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="text-sm font-medium">Carregando transportadoras...</span></div></td></tr>';

        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
            const resp = await fetch(API_URLS.TRANSPORTADORAS, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            _renderTransportadorasList(Array.isArray(data) ? data : (data.transportadoras || []));
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-500 font-medium">Erro ao carregar transportadoras. Tente novamente.</td></tr>';
            console.error('[Transportadoras] Erro ao buscar:', e);
        }
    }

    function _renderTransportadorasList(list) {
        const tbody = document.getElementById('transportadoras-table-body');
        if (!tbody) return;

        if (!list || list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-gray-400">Nenhuma transportadora cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        list.forEach(function(item) {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';
            tr.dataset.id = item.id;
            const placaUf = [item.placa, item.uf].filter(Boolean).join(' / ') || '-';
            tr.innerHTML =
                '<td class="px-6 py-3 text-sm text-gray-500 font-mono">' + (item.id || '') + '</td>' +
                '<td class="px-6 py-3 text-sm font-semibold text-gray-800">' + (item.nome || '') + '</td>' +
                '<td class="px-6 py-3 text-sm text-gray-600">' + (item.cnpj || '-') + '</td>' +
                '<td class="px-6 py-3 text-sm text-gray-600">' + (item.telefone || '-') + '</td>' +
                '<td class="px-6 py-3 text-sm text-gray-600">' + placaUf + '</td>' +
                '<td class="px-6 py-3 text-right space-x-2">' +
                    '<button class="transp-edit-btn px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg text-xs font-bold transition-colors" data-id="' + item.id + '">Editar</button>' +
                    '<button class="transp-del-btn px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors" data-id="' + item.id + '">Excluir</button>' +
                '</td>';
            tbody.appendChild(tr);
        });

        const newTbody = tbody.cloneNode(true);
        tbody.parentNode.replaceChild(newTbody, tbody);
        newTbody.addEventListener('click', function(e) {
            const editBtn = e.target.closest('.transp-edit-btn');
            const delBtn  = e.target.closest('.transp-del-btn');
            if (editBtn) {
                const row = editBtn.closest('tr');
                const cells = row.querySelectorAll('td');
                const placaUfArr = cells[4].innerText.split('/');
                _showTransportadoraForm({
                    id:       row.dataset.id,
                    nome:     cells[1].innerText.trim(),
                    cnpj:     cells[2].innerText.trim() === '-' ? '' : cells[2].innerText.trim(),
                    telefone: cells[3].innerText.trim() === '-' ? '' : cells[3].innerText.trim(),
                    placa:    placaUfArr[0] ? placaUfArr[0].trim() : '',
                    uf:       placaUfArr[1] ? placaUfArr[1].trim() : ''
                });
            }
            if (delBtn) {
                if (confirm('Deseja realmente excluir esta transportadora?')) {
                    _deleteTransportadora(delBtn.dataset.id);
                }
            }
        });
    }

    async function _deleteTransportadora(id) {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
            const resp = await fetch(API_URLS.TRANSPORTADORAS + '/' + id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            _loadTransportadoras();
        } catch (e) {
            alert('Erro ao excluir transportadora. Tente novamente.');
            console.error('[Transportadoras] Erro ao excluir:', e);
        }
    }

    async function _saveTransportadora() {
        const id       = (document.getElementById('transp-id') || {}).value || '';
        const nome     = ((document.getElementById('transp-nome') || {}).value || '').trim();
        const cnpj     = ((document.getElementById('transp-cnpj') || {}).value || '').trim();
        const telefone = ((document.getElementById('transp-telefone') || {}).value || '').trim();
        const placa    = ((document.getElementById('transp-placa') || {}).value || '').trim();
        const uf       = ((document.getElementById('transp-uf') || {}).value || '').trim();

        const errorMsg   = document.getElementById('transp-form-error');
        const successMsg = document.getElementById('transp-form-success');

        if (errorMsg)   errorMsg.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');

        if (!nome) {
            if (errorMsg) { errorMsg.innerText = 'O campo Nome e obrigatorio.'; errorMsg.classList.remove('hidden'); }
            return;
        }

        if (cnpj) {
            const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
            if (!cnpjRegex.test(cnpj)) {
                if (errorMsg) { errorMsg.innerText = 'CNPJ invalido. Use o formato 00.000.000/0000-00.'; errorMsg.classList.remove('hidden'); }
                return;
            }
        }

        const payload = { nome: nome, cnpj: cnpj, telefone: telefone, placa: placa, uf: uf };
        const isEdit  = !!id.trim();
        const url     = isEdit ? (API_URLS.TRANSPORTADORAS + '/' + id.trim()) : API_URLS.TRANSPORTADORAS;
        const method  = isEdit ? 'PUT' : 'POST';
        const token   = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';

        const saveBtn = document.getElementById('transp-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = 'Salvando...'; }

        try {
            const resp = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);

            if (successMsg) {
                successMsg.innerText = isEdit ? 'Transportadora atualizada com sucesso!' : 'Transportadora cadastrada com sucesso!';
                successMsg.classList.remove('hidden');
            }

            const form = document.getElementById('transportadora-form');
            if (form) form.reset();
            const idEl = document.getElementById('transp-id');
            if (idEl) idEl.value = '';
            const title = document.getElementById('transportadora-form-title');
            if (title) title.innerText = 'Cadastrar Transportadora';

        } catch (e) {
            if (errorMsg) { errorMsg.innerText = 'Erro ao salvar. Tente novamente.'; errorMsg.classList.remove('hidden'); }
            console.error('[Transportadoras] Erro ao salvar:', e);
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = 'Salvar'; }
        }
    }
})();

// Função global para lidar com o download e exibir o spinner
window.downloadDanfeWithSpinner = async function(url, filename, btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin w-3 h-3 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> BAIXANDO...`;
    btn.classList.add('opacity-75', 'cursor-wait');
    btn.style.pointerEvents = 'none';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha no download da DANFE.');
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        alert('Erro ao baixar DANFE: ' + e.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.classList.remove('opacity-75', 'cursor-wait');
        btn.style.pointerEvents = 'auto';
    }
};

window.downloadXmlWithSpinner = async function(url, filename, btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin w-3 h-3 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> BAIXANDO...`;
    btn.classList.add('opacity-75', 'cursor-wait');
    btn.style.pointerEvents = 'none';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMsg = 'Falha no download do XML.';
            try {
                const errData = await response.json();
                if (errData && errData.message) errorMsg = errData.message;
            } catch (_) {}
            throw new Error(errorMsg);
        }
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        alert('Erro ao baixar XML: ' + e.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.classList.remove('opacity-75', 'cursor-wait');
        btn.style.pointerEvents = 'auto';
    }
};

window.syncNfeBling = async function(btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> SYNC...`;
    btn.disabled = true;
    
    const syncBtn = document.getElementById('modal-sync-order-btn');
    if (syncBtn) {
        // Trigger a click no botão principal de sync que já cuida de atualizar toda a nota e DB
        syncBtn.click();
    } else {
        alert('Botão principal de sincronização não encontrado no modal.');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

window.saveChaveAcessoManual = async function(idNota, btn) {
    const inputEl = document.getElementById(`manual-chave-acesso-${idNota}`);
    if (!inputEl) return;
    
    const chave = inputEl.value.trim();
    if (chave.length !== 44) {
        alert('A Chave de Acesso deve ter exatamente 44 dígitos numéricos.');
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.innerHTML = 'SALVANDO...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`${API_URLS.ORDERS_BLING}/nfe/${idNota}/chave-acesso`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chaveAcesso: chave })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || 'Erro ao salvar chave.');
        
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: '✅ Chave salva na planilha!',
                duration: 3000,
                gravity: 'top',
                position: 'center',
                style: { background: '#10b981' }
            }).showToast();
        }
    } catch(err) {
        alert(err.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

window.toggleDanfeModalTab = function(tabName) {
    const tabEmail = document.getElementById('tab-content-email');
    const tabColeta = document.getElementById('tab-content-coleta');
    const btnEmail = document.getElementById('tab-btn-email');
    const btnColeta = document.getElementById('tab-btn-coleta');
    const emailBtnText = document.getElementById('email-btn-text');

    if (tabName === 'email') {
        tabEmail.classList.remove('hidden');
        tabColeta.classList.add('hidden');
        
        btnEmail.classList.add('border-indigo-600', 'text-indigo-600');
        btnEmail.classList.remove('border-transparent', 'text-gray-500');
        
        btnColeta.classList.remove('border-indigo-600', 'text-indigo-600');
        btnColeta.classList.add('border-transparent', 'text-gray-500');
        
        if(emailBtnText) emailBtnText.innerText = 'Enviar E-mail';
    } else {
        tabEmail.classList.add('hidden');
        tabColeta.classList.remove('hidden');
        
        btnColeta.classList.add('border-indigo-600', 'text-indigo-600');
        btnColeta.classList.remove('border-transparent', 'text-gray-500');
        
        btnEmail.classList.remove('border-indigo-600', 'text-indigo-600');
        btnEmail.classList.add('border-transparent', 'text-gray-500');
        
        if(emailBtnText) emailBtnText.innerText = 'Solicitar Coleta';
        if (window._fetchColetaData) window._fetchColetaData();
    }
};

window.openEmailDanfeModal = function(baixarPdfUrl, chaveAcesso, linkDanfe, filename, contatoEmail, numeroNota, cliente, numeroBling, orcamento, vendedor, hasService) {
    const modal = document.getElementById('email-danfe-modal');
    if (!modal) return;

    if (window.toggleDanfeModalTab) window.toggleDanfeModalTab('email');

    // Aba 2 (Solicitar Coleta) & Detecção de Serviços
    let pedido = null;
    if (window._allPedidos) {
        pedido = window._allPedidos.find(p => 
            String(p.numero || p.número || '') === String(numeroBling) ||
            String(p.id_pedido || p.id || '') === String(numeroBling)
        );
    }

    if (typeof hasService !== 'boolean') {
        if (typeof window._pedidoHasService === 'function' && pedido) {
            hasService = window._pedidoHasService(pedido);
        } else if (pedido) {
            const raw = pedido.itens || pedido.Itens || '';
            if (Array.isArray(pedido.itens)) {
                hasService = pedido.itens.some(i => String(i.codigo || i.sku || i.codigo_produto || '').trim().startsWith('7'));
            } else if (typeof raw === 'string' && raw) {
                hasService = /\(\s*7[0-9a-zA-Z_-]*/.test(raw);
            }
        }
        hasService = !!hasService;
    }

    document.getElementById('email-danfe-to').value = contatoEmail || '';
    
    const primeiroNomeVendedor = (vendedor && vendedor !== '-') ? vendedor.split(' ')[0] : 'Vendedor';
    const orcStr = orcamento ? ` - Orç.: ${orcamento}` : '';

    if (hasService) {
        document.getElementById('email-danfe-subject').value = `${primeiroNomeVendedor} - Pedido N.: ${numeroBling || ''} - NFe. e NFs.${orcStr}`;
    } else {
        document.getElementById('email-danfe-subject').value = `${primeiroNomeVendedor} - Pedido N.: ${numeroBling || ''} - NFe.: ${numeroNota || ''}${orcStr}`;
    }
    
    const hour = new Date().getHours();
    let saudacaoStr = 'Bom dia';
    if (hour >= 12 && hour < 18) saudacaoStr = 'Boa tarde';
    else if (hour >= 18) saudacaoStr = 'Boa noite';
    const saudacao = `${saudacaoStr} ${primeiroNomeVendedor}`;
    
    let displayFilename = filename || 'DANFE';
    if (displayFilename.startsWith('DANFE - ')) {
        displayFilename = displayFilename.substring(8); // Remove "DANFE - "
    }
    if (displayFilename.toLowerCase().endsWith('.pdf')) {
        displayFilename = displayFilename.substring(0, displayFilename.length - 4); // Remove ".pdf"
    }

    if (hasService) {
        let displayFilenameSemNfe = displayFilename.replace(/\s*-\s*Nf-?e\.?:?\s*[^\s-]+/i, '').trim();
        if (orcamento && !displayFilenameSemNfe.toLowerCase().includes('orc')) {
            displayFilenameSemNfe += ` - Orc. ${orcamento}`;
        }
        document.getElementById('email-danfe-message').value = `${saudacao},\n\nSegue a NFe. e NFs.: ${displayFilenameSemNfe}\n\natt.:`;
    } else {
        document.getElementById('email-danfe-message').value = `${saudacao},\n\nSegue a NFe.: ${displayFilename}\n\natt.:`;
    }
    
    document.getElementById('email-danfe-filename').innerText = filename || 'DANFE.pdf';
    
    const freteMap = { 0: "CIF", 1: "FOB", 2: "Terceiros", 9: "Sem Frete" };
    let nomeCliente = cliente || '';
    let cnpj = '';
    let enderecoStr = '';
    let cidadeUf = '';
    let cep = '';
    let modalidadeFrete = 'FOB';
    let volumes = '1';
    let pesoTotal = '0';

    if (pedido) {
        nomeCliente = pedido.contato?.nome || pedido.contato_nome || pedido['contato nome'] || pedido.cliente || cliente || '';
        cnpj = pedido.contato?.numeroDocumento || pedido.cpf_cnpj || pedido['cpf cnpj'] || pedido['cpf/cnpj'] || '';

        const end = pedido.transporte?.enderecoEntrega;
        if (end) {
            enderecoStr = `${end.endereco || ''}, ${end.numero || ''} ${end.complemento ? ' - ' + end.complemento : ''} - ${end.bairro || ''}`;
            cidadeUf = `${end.municipio || ''} - ${end.uf || ''}`;
            cep = end.cep || '';
        } else if (pedido.endereço || pedido.endereco || pedido.cidade || pedido.bairro) {
            enderecoStr = `${pedido.endereço || pedido.endereco || ''} ${pedido.numero ? ', ' + pedido.numero : ''} ${pedido.bairro ? '- ' + pedido.bairro : ''}`.trim();
            cidadeUf = `${pedido.cidade || ''} ${pedido.uf ? '- ' + pedido.uf : ''}`.trim();
            cep = pedido.cep || '';
        }

        const fretePorConta = pedido.transporte?.fretePorConta;
        if (fretePorConta !== undefined) {
            modalidadeFrete = freteMap[fretePorConta] || 'FOB';
        }

        const vols = pedido.transporte?.volumes;
        if (vols && vols.length > 0) {
            volumes = vols.reduce((sum, v) => sum + (parseFloat(v.quantidade) || 0), 0);
            pesoTotal = vols.reduce((sum, v) => sum + (parseFloat(v.pesoBruto) || 0), 0).toFixed(1);
        }
    }

    // Se não encontrou o CNPJ na venda, tenta achar na NF-e vinculada
    if (!cnpj && numeroNota && window._allNFeData) {
        if (window._allNFeData.length > 0) {
            console.log("[Coleta Debug] Chaves da primeira NFe na planilha:", Object.keys(window._allNFeData[0]));
        }
        console.log("[Coleta Debug] Procurando NFe numeroNota:", numeroNota, "em", window._allNFeData.length, "notas");
        const nfe = window._allNFeData.find(n => {
            const numNfePlanilha = n.numero || n.numero_da_nota || n.numero_nota || '';
            return Number(numNfePlanilha) === Number(numeroNota);
        });
        console.log("[Coleta Debug] NFe encontrada:", nfe);
        if (nfe) {
            cnpj = nfe.cnpjcpf_cliente || nfe.cnpj_cpf_cliente || nfe['cnpj/cpf cliente'] || nfe.cnpj || nfe.cpf_cnpj || '';
            // Se nomeCliente for 'Cliente', permite substituir pelo nome que está na NFe
            if (!nomeCliente || nomeCliente === 'Cliente') {
                nomeCliente = nfe.nome_do_cliente || nfe.nome_cliente || nfe.cliente || nfe.contato_nome || '';
            }
        }
    }

    const updateColetaText = (nc, c, e, cid, ce, mf, v, pt, email = '') => {
        const coletaTemplate = `Boa tarde, tudo bem?

Gostaria de agendar uma coleta conforme as informações abaixo:

REMETENTE (Local de Coleta):
Razão Social: Marksell
CNPJ: 21.331.638/0001-85
Endereço: Rua João Dias Ribeiro, 409 - Térreo, Sala 01, Polo Industrial
Cidade/UF: Itapevi - SP
CEP: 06693-810

DESTINATÁRIO / PAGADOR DO FRETE:
Razão Social: ${nc}
CNPJ: ${c}
Endereço: ${e.trim()}
Cidade/UF: ${cid.trim()}
CEP: ${ce}

DADOS DA CARGA E FRETE:
Nota Fiscal: ${numeroNota || ''} (arquivo em anexo)
Modalidade de Frete: ${mf} (Pago pelo Destinatário - ${nc})
Volumes: ${v}
Dimensões (L x C x A): 32 cm x 68 cm x 15 cm
Peso Total: ${pt} kg

Ficamos no aguardo da confirmação.
Obrigado!`;

        const txtArea = document.getElementById('email-coleta-message');
        if (txtArea) txtArea.value = coletaTemplate;

        const emailField = document.getElementById('email-coleta-to');
        if (emailField && email && !emailField.value) {
            emailField.value = email;
        }
    };

    document.getElementById('email-coleta-to').value = ''; // Transportadora
    document.getElementById('email-coleta-subject').value = `Solicitação de Coleta - NFe ${numeroNota || ''} - Marksell / Itapevi-SP`;

    // Preenche imediatamente com o que encontrou em memória (Planilha ou cache)
    updateColetaText(nomeCliente, cnpj, enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);

    window._fetchColetaData = function() {
        if (window._coletaDataFetched) return;
        window._coletaDataFetched = true;
        
        // Se estiver faltando informações cruciais (como Endereço completo ou Peso), busca no backend via Bling
        if (!enderecoStr || pesoTotal === '0' || !cnpj) {
            const txtArea = document.getElementById('email-coleta-message');
            if (txtArea) txtArea.value = "Buscando dados complementares do pedido (Endereço, CNPJ, Peso...) no Bling...\nPor favor, aguarde uns segundos...";
            
            // Usa o ID interno resolvido pelo modal principal para evitar 400 Bad Request
            const fetchId = window._currentModalPedidoId || (pedido ? (pedido.id || pedido.id_pedido || pedido['id pedido'] || numeroBling) : numeroBling);
            
            if (fetchId && API_URLS.ORDERS_BLING) {
                fetch(`${API_URLS.ORDERS_BLING}/vendas/${fetchId}`)
                    .then(r => {
                        if (!r.ok) throw new Error('Falha Venda');
                        return r.json();
                    })
                    .then(data => {
                        const bPedido = data.data;
                        if (bPedido) {
                            if (!enderecoStr) {
                                const end = bPedido.transporte?.enderecoEntrega;
                                if (end) {
                                    enderecoStr = `${end.endereco || ''}, ${end.numero || ''} ${end.complemento ? ' - ' + end.complemento : ''} - ${end.bairro || ''}`;
                                    cidadeUf = `${end.municipio || ''} - ${end.uf || ''}`;
                                    cep = end.cep || '';
                                } else if (bPedido.contato?.endereco?.endereco) {
                                    const end = bPedido.contato.endereco;
                                    enderecoStr = `${end.endereco || ''}, ${end.numero || ''} ${end.complemento ? ' - ' + end.complemento : ''} - ${end.bairro || ''}`;
                                    cidadeUf = `${end.municipio || ''} - ${end.uf || ''}`;
                                    cep = end.cep || '';
                                }
                            }
                            if (pesoTotal === '0' && bPedido.transporte?.volumes) {
                                pesoTotal = bPedido.transporte.volumes.reduce((sum, v) => sum + (parseFloat(v.pesoBruto) || 0), 0).toFixed(1);
                                volumes = bPedido.transporte.volumes.reduce((sum, v) => sum + (parseFloat(v.quantidade) || 0), 0).toString();
                            }
                            if (!cnpj) {
                                cnpj = bPedido.contato?.numeroDocumento || '';
                            }
                            updateColetaText(nomeCliente, cnpj, enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);
                        } else {
                            throw new Error('Sem Venda');
                        }
                    })
                    .catch(err => {
                        console.warn("[Coleta] Erro ao buscar venda, tentando contato pelo CNPJ...", err.message);
                        console.log("[Coleta Debug] Estado atual -> CNPJ:", cnpj, "| nomeCliente:", nomeCliente);
                        
                        if (cnpj && API_URLS.ORDERS_BLING) {
                            const cleanCnpj = String(cnpj).replace(/\D/g, '');
                            if (cleanCnpj) {
                                console.log("[Coleta Debug] Disparando fetch para contatos com CNPJ limpo:", cleanCnpj);
                                fetch(`${API_URLS.ORDERS_BLING}/contatos?numeroDocumento=${cleanCnpj}`)
                                    .then(rc => rc.ok ? rc.json() : null)
                                    .then(dataC => {
                                        // Formata o CNPJ para exibição se for apenas números
                                        let displayCnpj = String(cnpj);
                                        if (displayCnpj.length === 14 && !displayCnpj.includes('.')) {
                                            displayCnpj = displayCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                                        }

                                        if (dataC && dataC.data && dataC.data.length > 0) {
                                            const contatoId = dataC.data[0].id;
                                            console.log("[Coleta Debug] Contato listado! ID:", contatoId, ". Buscando detalhes...");
                                            fetch(`${API_URLS.ORDERS_BLING}/contatos/${contatoId}`)
                                                .then(async rId => {
                                                    if (!rId.ok) {
                                                        const errText = await rId.text();
                                                        throw new Error(`Erro 400: ${errText}`);
                                                    }
                                                    return rId.json();
                                                })
                                                .then(detalhesC => {
                                                    console.log("[Coleta Debug] Detalhes do contato retornados:", detalhesC);
                                                    const c = detalhesC?.data || {};
                                                    const e = (c.endereco && c.endereco.geral) ? c.endereco.geral : (c.enderecoGeral || {});
                                                    const endStr = `${e.endereco || ''}, ${e.numero || ''} ${e.complemento ? ' - ' + e.complemento : ''} - ${e.bairro || ''}`.replace(/^, | - $|, $/g, '').trim();
                                                    const cid = `${e.municipio || ''} - ${e.uf || ''}`.replace(/^- | - $/g, '').trim();
                                                    const cepVal = e.cep || '';
                                                    const emailContato = c.email || '';
                                                    console.log("[Coleta Debug] Sucesso ao buscar detalhes! Atualizando texto...");
                                                    updateColetaText(nomeCliente, displayCnpj, endStr, cid, cepVal, modalidadeFrete, volumes, pesoTotal, emailContato);
                                                })
                                                .catch(errDetalhes => {
                                                    console.error("[Coleta] Erro ao buscar detalhes do contato:", errDetalhes);
                                                    updateColetaText(nomeCliente, displayCnpj, enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);
                                                });
                                        } else {
                                            console.log("[Coleta Debug] Contato não retornado. Atualizando com dados vazios...");
                                            updateColetaText(nomeCliente, displayCnpj, enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);
                                        }
                                    })
                                    .catch(e2 => {
                                        console.error("[Coleta] Erro ao buscar contato pelo CNPJ:", e2);
                                        updateColetaText(nomeCliente, String(cnpj), enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);
                                    });
                                return;
                            }
                        }
                        updateColetaText(nomeCliente, cnpj, enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);
                    });
            } else {
                updateColetaText(nomeCliente, cnpj, enderecoStr, cidadeUf, cep, modalidadeFrete, volumes, pesoTotal);
            }
        }
    };
    window._coletaDataFetched = false;

    const dragArea = document.getElementById('email-danfe-drag-area');
    if (dragArea) {
        dragArea.ondragstart = function(event) {
            let absoluteUrl = baixarPdfUrl;
            if (absoluteUrl && !absoluteUrl.startsWith('http')) {
                // Monta a URL completa, assumindo que baixarPdfUrl é um caminho absoluto do backEndGCloud
                absoluteUrl = API_URLS.WEBHOOK_LAUNCH + (absoluteUrl.startsWith('/') ? absoluteUrl : '/' + absoluteUrl);
            }
            // Chrome/Edge "DownloadURL" syntax: mime_type:file_name:absolute_url
            const safeFileName = (filename || 'DANFE.pdf').replace(/:/g, '_'); // Evita conflito na sintaxe do Chrome
            event.dataTransfer.setData('DownloadURL', `application/pdf:${safeFileName}:${absoluteUrl}`);
            event.dataTransfer.effectAllowed = 'copy';
        };
    }

    const downloadBtn = document.getElementById('email-danfe-download-btn');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            let absoluteUrl = baixarPdfUrl;
            if (absoluteUrl && !absoluteUrl.startsWith('http')) {
                absoluteUrl = API_URLS.WEBHOOK_LAUNCH + (absoluteUrl.startsWith('/') ? absoluteUrl : '/' + absoluteUrl);
            }
            window.open(absoluteUrl, '_blank');
        };
    }

    if (!window.copyToClipboard) {
        window.copyToClipboard = function(elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                el.select();
                document.execCommand('copy');
                if (typeof Toastify !== 'undefined') {
                    Toastify({ text: '✅ Texto copiado!', duration: 2000, gravity: 'bottom', position: 'center', style: { background: '#4f46e5', borderRadius: '8px' } }).showToast();
                }
            }
        };
    }

    const confirmBtn = document.getElementById('email-danfe-confirm-btn');
    confirmBtn.onclick = async function() {
        const isColeta = !document.getElementById('tab-content-coleta').classList.contains('hidden');
        
        const toEmail = isColeta ? document.getElementById('email-coleta-to').value.trim() : document.getElementById('email-danfe-to').value.trim();
        const subject = isColeta ? document.getElementById('email-coleta-subject').value.trim() : document.getElementById('email-danfe-subject').value.trim();
        const message = isColeta ? document.getElementById('email-coleta-message').value.trim() : document.getElementById('email-danfe-message').value.trim();

        if (!toEmail) {
            alert('Por favor, informe ao menos um e-mail de destino.');
            return;
        }

        const spinner = document.getElementById('email-danfe-spinner');
        spinner.classList.remove('hidden');
        confirmBtn.disabled = true;

        try {
            const res = await fetch(`${API_URLS.WEBHOOK_LAUNCH}/proxy-email-danfe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chaveAcesso: chaveAcesso,
                    linkDanfe: linkDanfe,
                    toEmail: toEmail,
                    subject: subject,
                    text: message,
                    filename: filename
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erro ao enviar e-mail.');

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: '✅ E-mail enviado com sucesso!',
                    duration: 3000,
                    gravity: 'top',
                    position: 'center',
                    style: { background: '#10b981' }
                }).showToast();
            }
            modal.classList.add('hidden');
        } catch (err) {
            alert(err.message);
        } finally {
            spinner.classList.add('hidden');
            confirmBtn.disabled = false;
        }
    };

    modal.classList.remove('hidden');
};

function _showCustomConfirm(title, text) {
    return new Promise(resolve => {
        const modal = document.getElementById('app-confirm-modal');
        const titleEl = document.getElementById('app-confirm-modal-title');
        const textEl = document.getElementById('app-confirm-modal-content');
        const cancelBtn = document.getElementById('app-confirm-modal-cancel-btn');
        const okBtn = document.getElementById('app-confirm-modal-ok-btn');
        const spinner = document.getElementById('app-confirm-modal-spinner');
        const okText = document.getElementById('app-confirm-modal-ok-text');
        
        if(!modal) return resolve(confirm(text));

        titleEl.textContent = title;
        textEl.innerHTML = text;
        
        spinner.classList.add('hidden');
        okBtn.disabled = false;
        cancelBtn.disabled = false;
        okText.textContent = 'Confirmar';
        
        const cleanup = () => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onConfirm);
        };
        
        const onCancel = () => { cleanup(); resolve(false); };
        
        const onConfirm = () => { 
            spinner.classList.remove('hidden');
            okText.textContent = 'Salvando...';
            okBtn.disabled = true;
            cancelBtn.disabled = true;
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onConfirm);
            resolve(true); 
        };
        
        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onConfirm);
        
        modal.classList.remove('hidden');
    });
}
