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
    let _transportadorasBtn, _transportadorasModal, _closeTransportadorasModalBtn;
    let _transportadorasListView, _transportadoraFormView, _addTransportadoraBtn;
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

    // Formas de pagamento conhecidas (ID Bling -> Nome)
    const FORMAS_PAGAMENTO = [
        { id: '6220056', nome: 'Dinheiro' },
        { id: '6220057', nome: 'Conta a receber/pagar' },
    ];

    const FORMA_PAGAMENTO_PADRAO = '6220056'; // Dinheiro

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
        _state.linhaProducaoModal = document.getElementById('production-line-modal');
        _state.linhaProducaoContent = document.getElementById('production-line-modal-content');
        _state.linhaProducaoCloseBtn = document.getElementById('close-production-line-modal-btn');
        _state.linhaProducaoPrintBtn = document.getElementById('print-production-line-btn');

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
        _state.nfeEditObservacoes = document.getElementById('nfe-edit-observacoes');
        _state.nfeEditObservacoesOriginal = document.getElementById('nfe-edit-observacoes-original');
        _state.nfeEditAddParcelaBtn = document.getElementById('nfe-edit-add-parcela-btn');
        _state.nfeEditAutoParcelasBtn = document.getElementById('nfe-edit-auto-parcelas-btn');
        _state.nfeEditParcelasTbody = document.getElementById('nfe-edit-parcelas-tbody');
        _state.nfeEditSpinner = document.getElementById('nfe-edit-spinner');
        _state.draftNfeEditBtn = document.getElementById('draft-nfe-edit-btn');
        _state.nfeDraftSpinner = document.getElementById('nfe-draft-spinner');
        _state.saveOrderEditBtn = document.getElementById('save-order-edit-btn');
        _state.saveOrderSpinner = document.getElementById('save-order-spinner');
    }

    function _bindEvents() {
        // Eventos para Transportadoras
        if (_transportadorasBtn) _transportadorasBtn.addEventListener('click', _openTransportadorasModal);
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

        const toggleValoresChk = document.getElementById('modal-toggle-valores');
        if (toggleValoresChk) {
            toggleValoresChk.addEventListener('change', _handleModalToggleValores);
        }

        const printDropdownBtn = document.getElementById('modal-print-dropdown-btn');
        const printDropdownMenu = document.getElementById('modal-print-dropdown-menu');
        const printOrderBtn = document.getElementById('modal-print-order-btn');
        const printMarkerBtn = document.getElementById('modal-print-marker-btn');

        if (printDropdownBtn && printDropdownMenu) {
            printDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                printDropdownMenu.classList.toggle('hidden');
            });

            // Fechar dropdown ao clicar fora
            document.addEventListener('click', (e) => {
                if (!printDropdownBtn.contains(e.target) && !printDropdownMenu.contains(e.target)) {
                    printDropdownMenu.classList.add('hidden');
                }
            });
        }

        if (printOrderBtn) {
            printOrderBtn.addEventListener('click', () => {
                printDropdownMenu.classList.add('hidden');
                _handleModalPrint();
            });
        }

        if (printMarkerBtn) {
            printMarkerBtn.addEventListener('click', () => {
                printDropdownMenu.classList.add('hidden');
                _handlePrintMarker();
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

        // Botão de Emitir NF-e
        if (_state.modalEmitirNfeBtn) {
            _state.modalEmitirNfeBtn.addEventListener('click', _handleEmitirNfe);
        }

        // Eventos do Modal de Edição de NF-e
        if (_state.closeNfeEditModalBtn) _state.closeNfeEditModalBtn.addEventListener('click', _closeNfeEditModal);
        if (_state.cancelNfeEditBtn) _state.cancelNfeEditBtn.addEventListener('click', _closeNfeEditModal);
        if (_state.nfeEditAddItemBtn) _state.nfeEditAddItemBtn.addEventListener('click', () => _addNfeEditItemRow({}));
        if (_state.nfeEditAddParcelaBtn) _state.nfeEditAddParcelaBtn.addEventListener('click', () => _addNfeEditParcelaRow({}));
        if (_state.nfeEditAutoParcelasBtn) {
            _state.nfeEditAutoParcelasBtn.addEventListener('click', _handleAutoAdjustParcelas);
        }
        if (_state.confirmNfeEditBtn) _state.confirmNfeEditBtn.addEventListener('click', () => _confirmCustomEmitirNfe(false));
        if (_state.draftNfeEditBtn) _state.draftNfeEditBtn.addEventListener('click', () => _confirmCustomEmitirNfe(true));
        if (_state.saveOrderEditBtn) _state.saveOrderEditBtn.addEventListener('click', _saveOrderEdit);
        if (_state.nfeEditModal) {
            _state.nfeEditModal.addEventListener('click', (e) => {
                if (e.target === _state.nfeEditModal) {
                    _closeNfeEditModal();
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
                        if (_state.nfeEditContatoTipo) _state.nfeEditContatoTipo.value = contato.tipoPessoa || 'J';
                        if (_state.nfeEditContatoCnpj) _state.nfeEditContatoCnpj.value = contato.numeroDocumento || '';
                        if (_state.nfeEditContatoIe) _state.nfeEditContatoIe.value = contato.ie || '';
                        if (_state.nfeEditContatoContribuinte) {
                            _state.nfeEditContatoContribuinte.value = contato.indicadorIe !== undefined ? contato.indicadorIe : 9;
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
        if (_state.linhaProducaoPrintBtn) _state.linhaProducaoPrintBtn.addEventListener('click', _printProductionLine);
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
                tr.classList.remove('bg-blue-50', 'border-blue-500', 'hover:bg-blue-100');
                tr.classList.add('hover:bg-gray-50', 'border-transparent');
            }
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
                btn.title = "Nota Fiscal já foi emitida (ID: " + idNota + ")";
            } else {
                btn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    Editar Pedido
                `;
                btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                btn.title = "Editar informações e Gerar Nota Fiscal Eletrônica no Bling";
            }
        }

        // Reset toggle com valor
        const toggleChk = document.getElementById('modal-toggle-valores');
        if (toggleChk) toggleChk.checked = true;

        const numero = pedido.número || pedido.numero || orderNumber;
        title.innerText = `Pedido Nº ${numero}`;

        // --- Mapeamento de campos a ignorar ou tratar especialmente ---
        const ignoreKeys = ['id', 'id_pedido', 'id pedido', 'updatedAt'];
        // situacao já foi normalizada acima com _getStatusLabel
        const sitLower = situacao.toLowerCase();
        let badge = 'bg-gray-100 text-gray-700';
        if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badge = 'bg-green-100 text-green-700';
        else if (sitLower.includes('cancel')) badge = 'bg-red-100 text-red-700';
        else if (sitLower.includes('pendent') || sitLower.includes('abert')) badge = 'bg-yellow-100 text-yellow-700';
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
            
            const baixarPdfUrl = `${API_URLS.WEBHOOK_LAUNCH}/proxy-danfe?chaveAcesso=${chaveAcesso}&filename=${encodeURIComponent(safeFilenameForDownload)}`;

            const baixarBtnHtml = chaveAcesso ? `
                <a href="#" onclick="event.preventDefault(); window.downloadDanfeWithSpinner('${baixarPdfUrl}', '${safeFilenameForDownload.replace(/'/g, "\\'")}', this)" class="flex items-center gap-1.5 text-[10px] bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors font-bold uppercase shadow-sm" title="Baixar PDF do DANFE com o nome do cliente">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Baixar DANFE
                </a>
            ` : '';

            gridHtml += `
                <div class="bg-green-50 p-3 rounded-lg border border-green-100 md:col-span-2">
                    <div class="flex items-center gap-2 mb-1">
                        <svg class="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd"></path></svg>
                        <span class="block text-[10px] font-bold text-green-500 uppercase tracking-wider">Nota Fiscal Eletrônica (Emitida)</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="block text-sm text-green-800 font-bold">Nº ${numeroNota} (Série ${serieNota})</span>
                        <div class="flex items-center gap-2">
                            ${baixarBtnHtml}
                            ${linkDanfe !== '#' ? `
                                <a href="${linkDanfe}" target="_blank" class="flex items-center gap-1.5 text-[10px] bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-bold uppercase shadow-sm">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    Visualizar DANFE
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
                    <div id="pedido-modal-itens-container">
                        <table class="min-w-full divide-y divide-gray-200 text-sm rounded-lg overflow-hidden">
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

    function _parseItens(raw, producaoData = {}, pedidoId = '') {
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
                const key = `${pedidoId}-${index}`;
                const extra = producaoData[key];
                
                results.push({
                    codigo: sku,
                    quantidade: qty,
                    valor: _parseNumber(valPart) || 0,
                    status: (extra && extra.status) ? extra.status : status,
                    descricaoPersonalizada: (extra && extra.descricao) ? extra.descricao : '',
                    dataProducao: (extra && extra.data) ? extra.data : '', // Pegando a data da aba de produção
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
        const s = String(status || 'OK').toUpperCase().trim();
        const isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO';
        
        const badgeClass = isProducao 
            ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' 
            : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
        
        const label = isProducao ? 'Em Produção' : 'OK';
        const icon = isProducao 
            ? '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
            : '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';

        return `
            <button onclick="GerenciarPedidosApp.handleToggleItemStatus('${pedidoId}', '${itemCodigo}', '${s}', ${index}, event)"
                    id="status-badge-${pedidoId}-${index}"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all cursor-pointer shadow-sm active:scale-95 ${badgeClass}"
                    title="Clique para alternar status do item">
                ${icon}
                <span>${label}</span>
            </button>
        `;
    }

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

        // TRAVA DE SEGURANÇA: Se o status for Atendido (9), verifica itens em produção
        if (idSituacao === "9" || idSituacao === 9) {
            const pedido = _allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido) || String(p.número) === String(idPedido));
            if (pedido) {
                const finalId = pedido.id || pedido.id_pedido || idPedido;
                const itens = _parseItens(pedido.itens || '', pedido.detalhesProducao || {}, finalId);
                const temItemProducao = itens.some(item => {
                    const s = String(item.status || 'OK').toUpperCase().trim();
                    return s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO';
                });

                if (temItemProducao) {
                    await _showCustomAlert('Bloqueado', 'Não é possível marcar como <strong>Atendido</strong> enquanto houver itens individuais <strong>Em Produção</strong> neste pedido.', false);
                    return;
                }
            }
        }
        
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
                console.error("Erro no Bling:", erro);
                throw new Error(`Bling recusou a mudança: ${erro}`);
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
        _state.nfeEditCurrentTranspNome = pedidoBling.transporte?.etiqueta?.nome || pedidoBling.transporte?.contato?.nome || '';

        // Preencher metadados básicos do cliente
        if (_state.nfeEditContatoId) _state.nfeEditContatoId.value = pedidoBling.contato?.id || '';
        if (_state.nfeEditContatoNome) _state.nfeEditContatoNome.value = pedidoBling.contato?.nome || '';
        if (_state.nfeEditContatoNomeDetalhe) _state.nfeEditContatoNomeDetalhe.value = pedidoBling.contato?.nome || '';
        
        // Resetar campos detalhados para evitar lixo de carregamentos anteriores
        if (_state.nfeEditContatoFantasia) _state.nfeEditContatoFantasia.value = '';
        if (_state.nfeEditContatoTipo) _state.nfeEditContatoTipo.value = 'J';
        if (_state.nfeEditContatoCnpj) _state.nfeEditContatoCnpj.value = '';
        if (_state.nfeEditContatoIe) _state.nfeEditContatoIe.value = '';
        if (_state.nfeEditContatoContribuinte) _state.nfeEditContatoContribuinte.value = '9';
        
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
                        if (_state.nfeEditContatoTipo) _state.nfeEditContatoTipo.value = c.tipoPessoa || 'J';
                        if (_state.nfeEditContatoCnpj) _state.nfeEditContatoCnpj.value = c.numeroDocumento || '';
                        if (_state.nfeEditContatoIe) _state.nfeEditContatoIe.value = c.ie || '';
                        if (_state.nfeEditContatoContribuinte) {
                            _state.nfeEditContatoContribuinte.value = c.indicadorIe !== undefined ? c.indicadorIe : 9;
                        }
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
        if (_state.nfeEditData) _state.nfeEditData.value = pedidoBling.data || defaultDate;
        if (_state.nfeEditDataSaida) _state.nfeEditDataSaida.value = pedidoBling.dataSaida || pedidoBling.data || defaultDate;
        if (_state.nfeEditDataPrevista) _state.nfeEditDataPrevista.value = pedidoBling.dataPrevista || pedidoBling.data || defaultDate;
        
        _updateAllDateWarnings();
        if (_state.nfeEditObservacoesOriginal) _state.nfeEditObservacoesOriginal.value = pedidoBling.observacoes || '';
        
        let obsVal = pedidoBling.observacoes || '';
        let vendedorVal = '';
        if (pedidoBling.vendedor) {
            if (typeof pedidoBling.vendedor === 'object' && pedidoBling.vendedor.id) {
                vendedorVal = pedidoBling.vendedor.id;
            } else {
                vendedorVal = pedidoBling.vendedor;
            }
        }
        const vendedorNome = _getVendedorName(vendedorVal);
        if (vendedorNome && vendedorNome !== '-') {
            obsVal = obsVal.trim();
            const suffix = `Vendedor: ${vendedorNome}`;
            if (!obsVal.endsWith(suffix) && !obsVal.includes(suffix)) {
                if (obsVal) {
                    obsVal += `\n\n${suffix}`;
                } else {
                    obsVal = suffix;
                }
            }
        }
        if (_state.nfeEditObservacoes) _state.nfeEditObservacoes.value = obsVal;

        // Transporte e valores (a transportadora é setada pelo _loadTransportadoras de forma assíncrona)
        if (_state.nfeEditFrete) {
            const num = parseFloat(pedidoBling.transporte?.frete) || 0;
            _state.nfeEditFrete.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        }
        if (_state.nfeEditFretePorConta) _state.nfeEditFretePorConta.value = 9; // Força "9 - Sem Transporte" como padrão
        if (_state.nfeEditVolumes) _state.nfeEditVolumes.value = pedidoBling.transporte?.quantidadeVolumes || 0;
        if (_state.nfeEditPesoBruto) _state.nfeEditPesoBruto.value = pedidoBling.transporte?.pesoBruto || 0;
        if (_state.nfeEditPesoLiquido) _state.nfeEditPesoLiquido.value = pedidoBling.transporte?.pesoLiquido || pedidoBling.transporte?.pesoBruto || 0;
        if (_state.nfeEditDesconto) {
            const num = parseFloat(pedidoBling.desconto?.valor) || 0;
            _state.nfeEditDesconto.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
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

        // Exibir o modal
        _updateFreteFields(); // Aplica visibilidade inicial dos campos de transporte
        _updateVolumesWarning(); // Aplica estado inicial do warning de volumes
        _calculateTotals(); // Calcula totais iniciais
        _state.nfeEditModal.classList.remove('hidden');
    }

    function _addNfeEditItemRow(item = {}) {
        if (!_state.nfeEditItensTbody) return;

        const tr = document.createElement('tr');
        tr.className = 'nfe-edit-item-row';
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
    }

    function _updateIeWarning() {
        if (!_state.nfeEditContatoIe || !_state.nfeEditIeWarning) return;
        const ieVal = _state.nfeEditContatoIe.value.trim();
        if (!ieVal) {
            _state.nfeEditIeWarning.classList.remove('hidden');
        } else {
            _state.nfeEditIeWarning.classList.add('hidden');
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

        totalPecas += frete;
        const totalPedido = totalPecas + totalServicos - desconto;

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
        
        // Expressão regular para encontrar "Condições Pagto: - FATURADO" ou apenas "FATURADO"
        const regex = /(?:Condi[çc][õo]es\s+Pagto:\s*-\s*)?FATURADO\s+([0-9\s/,\-a-zA-Z]+)/i;
        const match = obsText.match(regex);
        if (!match) return null;
        
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

    function _handleAutoAdjustParcelas() {
        if (!_state.nfeEditParcelasTbody) return;

        const obsText = _state.nfeEditObservacoesOriginal ? _state.nfeEditObservacoesOriginal.value : '';
        let days = _parseDaysFromObservacoes(obsText);

        // Se não encontrou condição nas observações, ajusta como 1 parcela à vista (hoje)
        if (!days || days.length === 0) {
            days = [0];
        }

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
        const totalNota = Math.round((totalItens + frete - descontoVal) * 100) / 100;

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
                observacoes: numParcelas === 1 ? 'À Vista' : `Parcela ${i + 1}/${numParcelas}`
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

    async function _saveOrderEdit() {
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
                const valor = _parseNumber(row.querySelector('.nfe-edit-item-valor').value);

                if (!descricao) { alert('Todas as linhas de item devem conter uma descrição.'); return; }
                if (quantidade <= 0) { alert(`O item "${descricao}" deve ter quantidade maior que zero.`); return; }
                items.push({ codigo, descricao, quantidade, valor });
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

        if (!confirm('Tem certeza de que deseja atualizar este pedido no Bling com as informações preenchidas?')) return;

        // Sobrescrever payloadUpdate com os dados editados
        payloadUpdate.contato = {
            id: contatoId,
            nome: contatoNome,
            tipoPessoa: contatoTipo,
            numeroDocumento: contatoCnpj,
            ie: contatoIe,
            indicadorIe: contatoContribuinte
        };
        
        if (dataOperacao) payloadUpdate.data = dataOperacao;
        if (dataSaida) payloadUpdate.dataSaida = dataSaida;
        if (dataPrevista) payloadUpdate.dataPrevista = dataPrevista;
        if (observacoes) payloadUpdate.observacoes = observacoes;

        // O payload de itens em vendas
        payloadUpdate.itens = items.map(i => ({
            codigo: i.codigo,
            descricao: i.descricao,
            quantidade: i.quantidade,
            valor: i.valor
        }));

        payloadUpdate.transporte = {
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

        if (parcelas.length > 0) {
            payloadUpdate.parcelas = parcelas;
        }

        const btn = _state.saveOrderEditBtn;
        const spinner = _state.saveOrderSpinner;

        try {
            if (btn) btn.disabled = true;
            if (spinner) spinner.classList.remove('hidden');

            const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadUpdate)
            });

            if (!res.ok) {
                const errorResult = await res.json().catch(() => ({}));
                throw new Error(errorResult.message || 'Falha ao atualizar pedido no Bling.');
            }

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
            
            _closeNfeEditModal();
        } catch (err) {
            console.error('[Salvar Pedido] Erro ao atualizar pedido:', err);
            alert('Erro ao atualizar pedido: ' + err.message);
        } finally {
            if (btn) btn.disabled = false;
            if (spinner) spinner.classList.add('hidden');
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

                if (!descricao) {
                    alert('Todas as linhas de item devem conter uma descrição.');
                    return;
                }
                if (quantidade <= 0) {
                    alert(`O item "${descricao}" deve ter quantidade maior que zero.`);
                    return;
                }
                items.push({ codigo, descricao, quantidade, valor });
            }
        }

        if (items.length === 0) {
            alert('A nota fiscal deve possuir ao menos 1 item.');
            return;
        }

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
        const totalNotaCalculado = Math.round((totalItens + frete - descontoVal) * 100) / 100;

        if (parcelas.length > 0) {
            let totalParcelas = 0;
            parcelas.forEach(p => { totalParcelas += p.valor; });
            totalParcelas = Math.round(totalParcelas * 100) / 100;

            if (Math.abs(totalNotaCalculado - totalParcelas) > 0.05) {
                if (!confirm(`Aviso: A soma das parcelas (R$ ${totalParcelas.toFixed(2)}) é diferente do total líquido calculado da nota (R$ ${totalNotaCalculado.toFixed(2)}).\n\nDeseja continuar assim mesmo? (Nota: Caso prossiga, a SEFAZ ou o Bling podem rejeitar a nota por inconsistência de valores)`)) {
                    return;
                }
            }
        }

        if (somenteGerar) {
            if (!confirm('Criar a NF-e no Bling SEM enviar para a SEFAZ?\n\nA nota ficará como rascunho e poderá ser conferida e enviada manualmente no Bling.')) return;
        } else {
            if (!confirm('Confirmar a emissão da Nota Fiscal com os dados editados? Esta ação enviará a nota para a SEFAZ.')) return;
        }

        // Preparar payload customizado
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

        payload.itens = items;

        payload.transporte = {
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
            payload.desconto = {
                valor: descontoVal,
                unidade: 'REAL'
            };
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
            if (spinner) spinner.classList.remove('hidden');

            const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}/gerar-nfe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, somenteGerar })
            });

            const result = await res.json();

            if (!res.ok) {
                const errorMsg = result.message || 'Falha ao gerar NF-e.';
                const details = result.details ? ` (Detalhes: ${JSON.stringify(result.details)})` : '';
                throw new Error(errorMsg + details);
            }

            if (result.status === 'partial_success' || result.status === 'draft_success') {
                // Nota criada mas não enviada (rascunho ou falha no envio)
                const toastText = result.status === 'draft_success'
                    ? `✅ Rascunho criado no Bling! ID da Nota: ${result.data?.idNota || ''}. Confira e envie manualmente pelo Bling.`
                    : 'Atenção: ' + result.message;
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: toastText,
                        duration: 7000,
                        gravity: 'top',
                        position: 'center',
                        style: { background: 'linear-gradient(to right, #f59e0b, #d97706)' }
                    }).showToast();
                } else {
                    alert(toastText);
                }
            } else if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: '🚀 NF-e Gerada com Sucesso!',
                    duration: 4000,
                    gravity: 'top',
                    position: 'center',
                    style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' }
                }).showToast();
            }

            // Atualizar localmente o pedido com o novo ID da nota e status "Atendido"
            const pedidoLocal = _allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido));
            if (pedidoLocal) {
                const idNota = result.data?.idNotaFiscal || result.idNotaFiscal || '';
                if (idNota) {
                    if (pedidoLocal.id_nota !== undefined) pedidoLocal.id_nota = idNota;
                    if (pedidoLocal['id nota'] !== undefined) pedidoLocal['id nota'] = idNota;
                    if (pedidoLocal['idnotafiscal'] !== undefined) pedidoLocal['idnotafiscal'] = idNota;
                }
                const atendidoLabel = 'Atendido';
                if (pedidoLocal.situação !== undefined) pedidoLocal.situação = atendidoLabel;
                if (pedidoLocal.situacao !== undefined) pedidoLocal.situacao = atendidoLabel;
            }

            // Fechar modal de edição
            _closeNfeEditModal();
            _filterPedidos();
            _openOrderDetailsModal(idPedido);

        } catch (err) {
            console.error('[EmitirNFe Customizada] Erro:', err);
            alert('Erro ao emitir nota com dados customizados: ' + err.message);
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
            if (_state.draftNfeEditBtn) _state.draftNfeEditBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            if (spinner) spinner.classList.add('hidden');
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

    function _handlePrintMarker() {
        const modal = document.getElementById('order-details-modal');
        if (!modal) return;
        const orderNumber = modal.dataset.currentOrderNumber;
        if (!orderNumber) return;

        const pedido = _allPedidos.find(p => (p.id === orderNumber) || (p.número === orderNumber) || (p.numero === orderNumber));
        if (!pedido) return;

        const cliente = (pedido.contato_nome || pedido['contato nome'] || pedido.cliente || '-').toUpperCase();
        const vendedor = _getVendedorName(pedido.vendedor || '');
        const now = new Date().toLocaleString('pt-BR');

        const printWindow = window.open('', '_blank', 'width=850,height=750');
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
            font-size: 180px; 
            font-weight: 900; 
            color: #000; 
            line-height: 0.95;
            margin-bottom: 15px;
            word-wrap: break-word;
            width: 100%;
            text-transform: uppercase;
        }

        .mks-service { 
            font-size: 52px; 
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
            font-size: 34px; 
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
            @page { size: A4 landscape; margin: 0; }
        }
    </style>
</head>
<body>
    <div class="container" id="print-container">
        <div class="company-name" id="company-name">${cliente}</div>
        <div class="mks-service">MKS - Service</div>
        <br>
        <div class="vendedor">Vendedor: ${vendedor}</div>
    </div>
    <div class="footer">Gerado em ${now}</div>
    <script>
        window.onload = function(){ 
            const el = document.getElementById('company-name');
            const container = document.getElementById('print-container');
            
            let fontSize = 180; 
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
        let skippedDueToProduction = 0;
        const idsToUpdate = allIds.filter(id => {
            const p = _allPedidos.find(p => String(p.id) === String(id) || String(p.numero) === String(id) || String(p.número) === String(id));
            if (!p) return true; 
            
            // TRAVA DE SEGURANÇA: Se for Atendido (9), não permite se houver item em produção
            if (newStatusId === 9 || String(newStatusId) === "9") {
                const finalId = p.id || p.id_pedido || id;
                const itens = _parseItens(p.itens || '', p.detalhesProducao || {}, finalId);
                const temItemProducao = itens.some(item => {
                    const s = String(item.status || 'OK').toUpperCase().trim();
                    return s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO';
                });
                if (temItemProducao) {
                    skippedDueToProduction++;
                    return false;
                }
            }

            const situacaoAtual = (p.situação || p.situacao || '').toLowerCase();
            const labelLower = label.toLowerCase();
            
            // Mapeamento de termos para evitar redundância
            if (labelLower.includes('atendid') && (situacaoAtual.includes('atendid') || situacaoAtual.includes('conclu') || situacaoAtual.includes('entreg'))) return false;
            if (labelLower.includes('abert') && (situacaoAtual.includes('abert') || situacaoAtual.includes('pendent'))) return false;
            if (labelLower.includes('produ') && situacaoAtual.includes('produ')) return false;
            
            return true;
        });

        if (idsToUpdate.length === 0) {
            if (skippedDueToProduction > 0) {
                alert(`Ação cancelada. Os ${skippedDueToProduction} pedido(s) selecionado(s) possuem itens "Em Produção" e não podem ser finalizados.`);
            } else {
                alert(`Todos os ${allIds.length} pedidos selecionados já estão com a situação "${label}".`);
            }
            return;
        }

        let msg = idsToUpdate.length === allIds.length 
            ? `Mudar ${idsToUpdate.length} pedido(s) para "${label}"?`
            : `Mudar ${idsToUpdate.length} pedido(s) para "${label}"?\n(${allIds.length - idsToUpdate.length} pedidos serão ignorados).`;

        if (skippedDueToProduction > 0) {
            msg += `\n\nOBS: ${skippedDueToProduction} pedido(s) foram bloqueados por possuírem itens em produção.`;
        }

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
                const sitNormalized = _getStatusLabel(p.situação || p.situacao || p.situao || '').toLowerCase();
                
                if (sel === 'atendido') {
                    statusMatch = (sitNormalized.includes('atendid') || sitNormalized.includes('entregue') || sitNormalized.includes('conclu'));
                } else if (sel === 'aberto') {
                    statusMatch = (sitNormalized.includes('abert') || sitNormalized.includes('pendent') || sitNormalized.includes('andamento'));
                } else if (sel === 'producao') {
                    statusMatch = sitNormalized.includes('produ');
                } else if (sel === 'cancelado') {
                    statusMatch = sitNormalized.includes('cancel');
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
                else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento')) badgeClass = 'bg-yellow-100 text-yellow-800';
                else if (sitLower.includes('produ')) badgeClass = 'bg-blue-100 text-blue-800';

                // Verificação de Pedido Novo
                const isNewOrder = newOrders.includes(String(numero)) || newOrders.includes(String(p.id));
                const rowClass = isNewOrder 
                    ? 'bg-blue-50 border-l-4 border-blue-500 transition-colors hover:bg-blue-100'
                    : 'hover:bg-gray-50 transition-colors border-l-4 border-transparent';

                return `
                    <tr id="pedido-row-${numero}" data-order-number="${numero}" class="${rowClass}">
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

    function _updateLinhaProducaoBtnVisibility() {
        if (!_statusSelect || !_state.linhaProducaoBtn) return;
        if (_statusSelect.value === 'producao') {
            _state.linhaProducaoBtn.classList.remove('hidden');
        } else {
            _state.linhaProducaoBtn.classList.add('hidden');
        }
    }

    /**
     * Filtra e agrupa itens em produção para exibir no modal.
     */
    function _showProductionLine() {
        if (!_state.linhaProducaoModal || !_state.linhaProducaoContent) return;

        // 1. Filtrar pedidos em produção
        const pedidosEmProducao = _allPedidos.filter(p => {
            const sit = _getStatusLabel(p.situação || p.situacao || '').toLowerCase();
            return sit.includes('produ');
        });

        // 2. Extrair e agrupar itens com status individual "Em Produção"
        const aggregatedItems = {};

        pedidosEmProducao.forEach(p => {
            const numeroPedido = p.numero || p.número || 'N/A';
            const finalId = p.id_pedido || p.id || '';
            const itensRaw = p.itens || p.Itens || '';
            const parsedItens = _parseItens(itensRaw, p.detalhesProducao || {}, finalId);
            const empresa = p.contato_nome || p['contato nome'] || p.cliente || 'N/A';
            const vendedorFull = _getVendedorName(p.vendedor || '');
            const vendedor = vendedorFull.split(' ')[0];
            const orcamento = p.orcamento || p.orçamento || '';
            const dataPedido = p.data || p.data_criacao || '';

            parsedItens.forEach(item => {
                const s = String(item.status || 'OK').toUpperCase().trim();
                const isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO';

                if (isProducao) {
                    const codigo = String(item.codigo).trim();
                    // Usamos uma chave composta para mostrar itens por pedido/empresa
                    const key = `${codigo}_${numeroPedido}_${item.descricaoPersonalizada || ''}`; 
                    
                    if (!aggregatedItems[key]) {
                        aggregatedItems[key] = {
                            codigo: codigo,
                            // PRIORIDADE: Descrição Personalizada -> Descrição do Produto (cache) -> Código
                            descricao: item.descricaoPersonalizada || codigo, 
                            quantidadeTotal: 0,
                            data: item.dataProducao || dataPedido,
                            vendedor: vendedor,
                            empresa: empresa,
                            orcamento: orcamento,
                            numeroPedido: numeroPedido,
                            pedidoId: finalId,
                            itemIndex: item.index,
                            descricaoPersonalizada: item.descricaoPersonalizada
                        };
                    }
                    aggregatedItems[key].quantidadeTotal += (parseFloat(item.quantidade) || 0);
                }
            });
        });

        const itemsArray = Object.values(aggregatedItems);

        // Ordenar por data (Mais antigos primeiro)
        itemsArray.sort((a, b) => {
            const dA = _parseDate(a.data) || new Date(8640000000000000); 
            const dB = _parseDate(b.data) || new Date(8640000000000000);
            return dA - dB;
        });

        if (itemsArray.length === 0) {
            _state.linhaProducaoContent.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                    <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                    <p class="text-xl font-medium">Nenhum item marcado como "Em Produção"</p>
                    <p class="text-sm">Marque itens individuais dentro dos pedidos para que apareçam aqui.</p>
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
                            <th class="px-6 py-4 text-center text-xs font-black text-gray-400 uppercase tracking-wider">Qtd Total</th>
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

                            return `
                            <tr class="hover:bg-blue-50/30 transition-colors">
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-4">
                                        <div class="flex flex-col items-center gap-1 flex-shrink-0">
                                            ${item.orcamento && item.orcamento !== '0' ? `<span class="text-[9px] font-black text-blue-500 uppercase leading-none mb-1">Orç.: ${item.orcamento}</span>` : ''}
                                            <div class="w-16 h-16 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                                                <img id="lp-img-${item.codigo}-${item.numeroPedido}" src="https://placehold.co/60x60/f8fafc/cbd5e1?text=..." 
                                                     class="max-w-full max-h-full object-contain"
                                                     onerror="this.src='https://placehold.co/60x60/f8fafc/cbd5e1?text=?'">
                                            </div>
                                            <span class="text-[9px] font-black text-gray-400 uppercase tracking-tighter">SKU-${item.codigo}</span>
                                        </div>
                                        <div>
                                            <p class="font-black text-gray-800 text-base" id="lp-desc-${item.codigo}-${item.numeroPedido}">${item.descricao || item.codigo}</p>
                                            <p class="text-xs font-bold text-blue-500 uppercase tracking-widest">
                                                <span class="text-blue-600 font-bold">${item.vendedor}</span> <span class="mx-1 text-gray-400">-</span> <span class="text-gray-500">${item.empresa}</span>
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <div class="flex flex-col items-center gap-2">
                                        <div class="flex flex-col items-center">
                                            <span class="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Solicitação</span>
                                            <span onclick="GerenciarPedidosApp.handleEditProductionDate('${item.pedidoId}', '${item.codigo}', ${item.itemIndex}, '${item.data}', event, '${item.numeroPedido}')"
                                                  class="text-sm font-bold text-gray-700 border-b border-dashed border-gray-300 cursor-pointer hover:text-blue-600 hover:border-blue-400 transition-all">
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
                                    <span class="inline-flex items-center justify-center min-w-[40px] h-10 px-3 bg-blue-100 text-blue-700 rounded-xl font-black text-lg">
                                        ${item.quantidadeTotal}
                                    </span>
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
            const res = await fetch(`${API_URLS.PRODUCTS}?t=${Date.now()}`, { mode: 'cors' });
            if (!res.ok) return;
            const json = await res.json();
            const products = json.data || json || [];

            items.forEach(item => {
                const prod = products.find(p => String(p.codigo || '').trim() === String(item.codigo).trim());
                if (prod) {
                    const imgId = `lp-img-${item.codigo}-${item.numeroPedido}`;
                    const descId = `lp-desc-${item.codigo}-${item.numeroPedido}`;
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

    return {
        openOrderDetailsModal: _openOrderDetailsModal,
        handleItemClick: handleItemClick,
        handleEditItemDescription: async function(pedidoId, itemCodigo, index, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const pedido = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            if (!pedido) return;

            const finalPedidoId = String(pedido.id || pedido.id_pedido || '');
            const finalNumPedido = String(pedido.numero || pedido.numero_pedido || '');
            const itens = _parseItens(pedido.itens, pedido.detalhesProducao || {}, finalPedidoId, finalNumPedido);
            const item = itens[index];
            if (!item) return;

            // Elementos do layout
            const modal = document.getElementById('edit-item-desc-modal');
            const currentDescEl = document.getElementById('edit-item-desc-current');
            const complementContainer = document.getElementById('edit-item-desc-complement-container');
            const complementText = document.getElementById('edit-item-desc-complement-text');
            const inputEl = document.getElementById('edit-item-desc-input');
            const saveBtn = document.getElementById('save-edit-item-desc-btn');

            if (!modal || !currentDescEl || !inputEl || !saveBtn) return;

            // Busca o nome original real no cache de produtos
            const prod = _enrichedProductsMap[item.codigo];
            let baseName = prod ? prod.descricao : (item.descricaoPersonalizada ? item.codigo : item.codigo);
            
            const currentPersonalized = item.descricaoPersonalizada || '';

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
            modal.classList.remove('hidden');
            
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 100);

            // Listeners de Fechar
            const closeModal = () => modal.classList.add('hidden');
            document.getElementById('close-edit-item-desc-modal-btn').onclick = closeModal;
            document.getElementById('cancel-edit-item-desc-btn').onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            // Salvar
            saveBtn.onclick = async () => {
                const novaDesc = inputEl.value.trim();
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
                            itemIndex: index,
                            numeroPedido: finalNumPedido,
                            newStatus: item.status || 'OK',
                            quantidade: item.quantidade || 1,
                            dataPedido: pedido ? (pedido.data || pedido.data_criacao || '') : ''
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText || 'Erro no servidor');
                    }
                    
                    // ATUALIZAÇÃO DO CACHE LOCAL: Crucial para ver a mudança na hora
                    if (pedido) {
                        // Atualiza os dados de produção no cache local
                        if (!pedido.detalhesProducao) pedido.detalhesProducao = {};
                        const key = `${pedidoId}-${index}`;
                        pedido.detalhesProducao[key] = {
                            status: pedido.detalhesProducao[key]?.status || 'OK',
                            descricao: novaDesc
                        };
                        
                        // Atualiza a visualização no modal sem fechar
                        const descEl = document.getElementById(`desc-${itemCodigo}-${index}`);
                        if (descEl) descEl.textContent = novaDesc || itemCodigo;
                    }
                    
                    if (typeof Toastify !== 'undefined') {
                        Toastify({ text: "Descrição atualizada!", duration: 2500, style: { background: "#10b981" } }).showToast();
                    }
                    
                    // Atualiza a visualização da tabela ao fundo
                    _filterPedidos();
                    
                    // Recarrega o modal de detalhes para mostrar o novo nome na lista
                    _openOrderDetailsModal(pedidoId);

                    closeModal();
                } catch (error) {
                    console.error("Erro ao editar descrição:", error);
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
            } else {
                // Pedido novo que não está no frontend ainda. Recarrega a lista toda.
                console.log(`[GerenciarPedidos] Pedido novo detectado (${numero}). Recarregando lista completa...`);
                fetchPedidos(true); // O true força o bypass do cache
                return;
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
                        else if (sitLower.includes('pendent') || sitLower.includes('abert')) badgeClass = 'bg-yellow-100 text-yellow-800';
                        else if (sitLower.includes('produção') || sitLower.includes('producao') || sitLower.includes('andamento') || sitLower.includes('em andamento')) badgeClass = 'bg-blue-100 text-blue-800';
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
        handleToggleItemStatus: async function(pedidoId, itemCodigo, currentStatus, index, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const newStatus = (currentStatus === 'OK') ? 'EM PRODUÇÃO' : 'OK';
            
            // Busca o pedido no cache
            const pCache = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            
            // Bloqueia se o pedido já estiver Atendido e o usuário tentar colocar o item Em Produção
            if (newStatus === 'EM PRODUÇÃO' && pCache) {
                const sit = String(pCache.situação || pCache.situacao || '').toLowerCase().trim();
                if (sit.includes('atendid')) {
                    _showCustomAlert('Ação não permitida', 'Não é possivel alterar o item para "Em Produção", o pedido está como "Atendido"', false);
                    return;
                }
            }

            const btn = document.getElementById(`status-badge-${pedidoId}-${index}`);
            
            // Optimistic UI Update
            if (btn) {
                btn.classList.add('opacity-50', 'pointer-events-none');
                const span = btn.querySelector('span');
                if (span) span.innerText = 'Salvando...';
            }

            try {
                // Pega a descrição atual do cache para não perder ao salvar status
                const pCache = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
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
                        quantidade: index !== undefined ? (_parseItens(pCache.itens, pCache.detalhesProducao || {}, pedidoId)[index]?.quantidade || 1) : 1,
                        dataPedido: pCache ? (pCache.data || pCache.data_criacao || '') : ''
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Erro ao atualizar status do item');
                }

                // Feedback imediato no badge...
                if (btn) {
                    btn.classList.remove('opacity-50', 'pointer-events-none');
                    const span = btn.querySelector('span');
                    if (span) span.innerText = (newStatus === 'OK') ? 'OK' : 'EM PRODUÇÃO';
                    const isProducao = newStatus === 'EM PRODUÇÃO';
                    const badgeClass = isProducao 
                        ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' 
                        : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
                    btn.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all cursor-pointer shadow-sm active:scale-95 ${badgeClass}`;
                    btn.setAttribute('onclick', `GerenciarPedidosApp.handleToggleItemStatus('${pedidoId}', '${itemCodigo}', '${newStatus}', ${index}, event)`);
                }

                // Sincronização de Cache
                if (pCache) {
                    if (!pCache.detalhesProducao) pCache.detalhesProducao = {};
                    pCache.detalhesProducao[`${pedidoId}-${index}`] = { status: newStatus, descricao: currentDesc };
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
                _renderOrderDetailsModal(pedidoId);
            }
        },
        handleEditProductionDate: async function(pedidoId, itemCodigo, itemIndex, currentDate, event, numeroPedido) {
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

            try {
                // Feedback visual de carregamento
                const span = event.target;
                span.innerText = '...';

                const response = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedidoId,
                        numeroPedido, // Importante para localizar a linha correta na planilha
                        itemCodigo,
                        itemIndex,
                        dataPedido: dateToSave 
                    })
                });

                if (!response.ok) throw new Error("Erro ao salvar data.");

                // Atualiza o cache local para refletir na UI sem refresh
                const pedido = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
                if (pedido) {
                    if (!pedido.detalhesProducao) pedido.detalhesProducao = {};
                    const key = `${pedidoId}-${itemIndex}`;
                    if (!pedido.detalhesProducao[key]) pedido.detalhesProducao[key] = { status: 'OK', descricao: '' };
                    pedido.detalhesProducao[key].data = dateToSave;
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
        updateOrderItemStatusRealTime: function(data) {
            const { pedidoId, itemCodigo, newStatus, itemIndex, newDescription, dataPedido } = data;
            console.log(`[GerenciarPedidos] Sincronizando status/data do item ${itemCodigo} no pedido ${pedidoId}`);

            // 1. Atualizar no cache local
            const pedido = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            if (pedido) {
                if (!pedido.detalhesProducao) pedido.detalhesProducao = {};
                const key = `${pedidoId}-${itemIndex}`;
                pedido.detalhesProducao[key] = {
                    status: newStatus || pedido.detalhesProducao[key]?.status || 'OK',
                    descricao: newDescription !== undefined ? newDescription : (pedido.detalhesProducao[key]?.descricao || ''),
                    data: dataPedido !== undefined ? dataPedido : (pedido.detalhesProducao[key]?.data || '')
                };
            }

            // 2. Atualizar a UI se o modal estiver aberto para este pedido
            if (_currentModalPedidoId && String(_currentModalPedidoId) === String(pedidoId)) {
                const btn = document.getElementById(`status-badge-${pedidoId}-${itemIndex}`);
                if (btn) {
                    const isProducao = newStatus === 'EM PRODUÇÃO' || newStatus === 'PRODUCAO' || newStatus === 'EM PRODUCAO';
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
                    // Atualiza o onclick para refletir o novo status atual
                    btn.setAttribute('onclick', `GerenciarPedidosApp.handleToggleItemStatus('${pedidoId}', '${itemCodigo}', '${newStatus}', ${itemIndex}, event)`);
                }
            }

            // 3. SE a Linha de Produção estiver aberta, atualizar em tempo real
            const lpModal = document.getElementById('production-line-modal');
            if (lpModal && !lpModal.classList.contains('hidden')) {
                console.log('[LinhaProducao] Atualizando em tempo real...');
                // Dispara o re-render da linha de produção
                _showProductionLine();
            }
        },
        updateOrderNfeInfoRealTime: function(nfeData) {
            const pedidoId = nfeData.id_pedido || nfeData.idPedido;
            if (!pedidoId) return;

            console.log(`[GerenciarPedidos] Sincronizando NF-e ${nfeData.numero} para o pedido ${pedidoId}`);

            // 1. Atualizar no cache local
            const pedido = _allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            if (pedido) {
                pedido.id_nota = nfeData.id || nfeData.id_nota || nfeData.numero;
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
