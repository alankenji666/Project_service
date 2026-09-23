import { API_URLS } from '../apiConfig.js?v=22';

export const GerenciarGarantiaApp = (function () {
    // Referências do DOM - Visualizações
    let _overviewCards;
    let _formContainer;
    let _tableContainer;

    // Referências do DOM - Botões de Navegação
    let _btnShowForm;
    let _btnShowTable;
    let _btnBackFromForm;
    let _btnBackFromTable;

    // Referências do DOM - Headers Dinâmicos
    let _mainHeader;
    let _formHeader;
    let _tableHeader;
    let _satgHeader;
    let _pedidosGarantiaHeader;

    // Referências do DOM - Formulário
    let _formPedido;
    let _inputCliente;
    let _inputCpfCnpj;
    let _inputNumero;
    let _inputIdNota;
    let _btnAddItemModal;
    let _modalGarantiaProduto;
    let _btnFecharGarantiaProduto;
    let _inputSearchProduto;
    let _divProdutoResults;
    
    // Novas variaveis modal Item Detalhe
    let _modalItemDetalhe, _btnFecharModalItemDetalhe, _btnCancelarItemDetalhe, _btnSalvarItemDetalhe;
    let _inputItemDetalheIndex, _inputItemDetalheNomeOriginal, _inputItemDetalheDescricao, _inputItemDetalheObservacao;
    let _itemsList;
    let _itemsEmpty;
    let _inputObservacao;
    let _inputAvaliacao;
    let _btnSubmitGarantia;
    let _btnSearchProduto;

    // Referências do DOM - Tabela
    let _tableContent;
    let _noDataMessage;
    let _searchInput;
    let _clearSearchBtn;

    // Referências do DOM - SatG
    let _satgContainer;
    let _btnShowSatg;
    let _btnBackFromSatg;
    let _satgTableContent;
    let _satgNoDataMessage;
    let _satgSearchInput;
    let _satgBadgeCount;

    // Referências do DOM - Modal Observação Sat-G
    let _satgObservationModal;
    let _satgObservationModalInfo;
    let _satgObservationHistory;
    let _satgObservationTextarea;
    let _satgObservationCharCount;
    let _saveSatgObservationBtn;
    let _cancelSatgObservationBtn;
    
    // Referências do DOM - Pedidos Garantia
    let _pedidosGarantiaContainer;
    let _btnShowPedidosGarantia;
    let _btnBackFromPedidosGarantia;
    let _pedidosGarantiaTableContent;
    let _noPedidosGarantiaMessage;
    let _pedidosGarantiaSearchInput;
    let _satgFilterBtn;
    let _satgFilterDropdown;
    let _satgFilterText;
    let _satgFilterCheckboxes;
    let _modalSatg;
    let _btnFecharModalSatg;
    let _btnVerPedidoSatg;

    let _modalPedidoGarantiaDetalhes;
    let _btnFecharModalPedidoGarantia;
    let _btnEditarPedidoGarantia;
    let _btnRecusarSatg;
    let _btnSalvarObsSatg;
    let _btnAprovarPedidoSatg;
    let _btnViewVinculadoSatg;
    let _satgVinculadoAlert;
    
    let _modalSatgPrintBtn;
    let _modalSatgPrintDropdownMenu;
    let _modalSatgPrintSatgBtn;

    // Estado interno
    let _garantiaData = [];
    let _filteredData = [];
    let _currentOrderItems = [];
    let _satgData = [];
    let _filteredSatgData = [];
    let _currentSatgRowIndex = null;
    let _currentEditPedidoId = null;
    let _currentSatgReqForOrder = null; // Guarda o SatG vinculado ao formulário atual
    let _pedidosGarantiaData = [];
    let _itensDetalhadoGarantiaData = [];
    let _eventsBound = false;
    let _formHasChanges = false;
    let _btnBackFromFormArrow = null;

    /**
     * Inicializa o módulo, cacheia elementos e configura eventos.
     */
    function init() {
        _cacheDomElements();
        if (_overviewCards) {
            _bindEvents();
        }
        _showView('cards');
        render(); // Pré-carrega a tabela
    }

    /**
     * Busca os elementos no DOM
     */
    function _cacheDomElements() {
        // Views
        _overviewCards = document.getElementById('garantia-overview-cards');
        _formContainer = document.getElementById('garantia-form-container');
        _tableContainer = document.getElementById('garantia-table-container');
        _satgContainer = document.getElementById('garantia-satg-container');
        _pedidosGarantiaContainer = document.getElementById('garantia-pedidos-container');

        // Navigation
        _btnShowForm = document.getElementById('btn-show-garantia-form');
        _btnShowTable = document.getElementById('btn-show-garantia-table');
        _btnShowSatg = document.getElementById('btn-show-garantia-satg');
        _btnShowPedidosGarantia = document.getElementById('btn-show-garantia-pedidos');
        _btnBackFromForm = document.getElementById('btn-back-garantia-form');
        _btnBackFromFormArrow = document.getElementById('btn-back-garantia-form-arrow');
        _btnBackFromTable = document.getElementById('btn-back-garantia-table');
        _btnBackFromSatg = document.getElementById('btn-back-garantia-satg');
        _btnBackFromPedidosGarantia = document.getElementById('btn-back-garantia-pedidos');

        // Form
        _formPedido = document.getElementById('garantia-pedido-form');
        _inputCliente = document.getElementById('garantia-cliente');
        _inputCpfCnpj = document.getElementById('garantia-cpf-cnpj');
        _inputNumero = document.getElementById('garantia-numero');
        _inputIdNota = document.getElementById('garantia-id-nota');
        _inputObservacao = document.getElementById('garantia-observacao');
        _inputAvaliacao = document.getElementById('garantia-avaliacao');
        _btnSubmitGarantia = document.getElementById('btn-submit-garantia');
        
        _itemsList = document.getElementById('garantia-items-list');
        _itemsEmpty = document.getElementById('garantia-items-empty');

        // Modal Produto
        _btnAddItemModal = document.getElementById('btn-add-garantia-item-modal');
        _modalGarantiaProduto = document.getElementById('modal-garantia-selecionar-produto');
        _btnFecharGarantiaProduto = document.getElementById('btn-fechar-garantia-produto');
        _inputSearchProduto = document.getElementById('garantia-search-produto-input');
        _divProdutoResults = document.getElementById('garantia-produto-results');
        
        // Modal Detalhe do Item
        _modalItemDetalhe = document.getElementById('modal-garantia-item-detalhe');
        _btnFecharModalItemDetalhe = document.getElementById('btn-fechar-modal-item-detalhe');
        _btnCancelarItemDetalhe = document.getElementById('btn-cancelar-item-detalhe');
        _btnSalvarItemDetalhe = document.getElementById('btn-salvar-item-detalhe');
        _inputItemDetalheIndex = document.getElementById('item-detalhe-index');
        _inputItemDetalheNomeOriginal = document.getElementById('item-detalhe-nome-original');
        _inputItemDetalheDescricao = document.getElementById('item-detalhe-descricao');
        _inputItemDetalheObservacao = document.getElementById('item-detalhe-observacao');

        // Headers
        _mainHeader = document.getElementById('garantia-main-header');
        _formHeader = document.getElementById('garantia-form-header');
        _tableHeader = document.getElementById('garantia-table-header');
        _satgHeader = document.getElementById('garantia-satg-header');

        // Table
        _tableContent = document.getElementById('garantia-table-content');
        _noDataMessage = document.getElementById('no-garantia-message');
        _searchInput = document.getElementById('garantia-search-input');
        _clearSearchBtn = document.getElementById('clear-garantia-search-btn');

        // SatG UI
        _satgTableContent = document.getElementById('garantia-satg-table-content');
        _satgNoDataMessage = document.getElementById('no-satg-message');
        _satgSearchInput = document.getElementById('garantia-satg-search-input');
        _satgBadgeCount = document.getElementById('satg-badge-count');
        _satgObservationModal = document.getElementById('satg-observation-modal');
        _satgObservationModalInfo = document.getElementById('satg-observation-modal-info');
        _satgObservationHistory = document.getElementById('satg-observation-history');
        _satgObservationTextarea = document.getElementById('satg-observation-textarea');
        _satgObservationCharCount = document.getElementById('satg-observation-char-count');
        _saveSatgObservationBtn = document.getElementById('save-satg-observation-btn');
        _cancelSatgObservationBtn = document.getElementById('cancel-satg-observation-btn');
        _satgFilterBtn = document.getElementById('btn-satg-filter');
        _satgFilterDropdown = document.getElementById('satg-filter-dropdown');
        _satgFilterText = document.getElementById('satg-filter-text');
        _satgFilterCheckboxes = document.querySelectorAll('.satg-filter-checkbox');
        _modalSatg = document.getElementById('modal-satg-avaliar');
        _btnFecharModalSatg = document.getElementById('btn-fechar-modal-satg');
        _btnVerPedidoSatg = document.getElementById('btn-ver-pedido-satg');
        
        _modalPedidoGarantiaDetalhes = document.getElementById('modal-pedido-garantia-detalhes');
        _btnFecharModalPedidoGarantia = document.getElementById('btn-fechar-modal-pedido-garantia');
        _btnEditarPedidoGarantia = document.getElementById('btn-editar-pedido-garantia');
        _btnRecusarSatg = document.getElementById('btn-recusar-satg');
        _btnSalvarObsSatg = document.getElementById('btn-salvar-obs-satg');
        _btnAprovarPedidoSatg = document.getElementById('btn-aprovar-pedido-satg');
        
        // Pedidos Garantia
        _pedidosGarantiaHeader = document.getElementById('garantia-pedidos-header');
        _pedidosGarantiaTableContent = document.getElementById('garantia-pedidos-table-content');
        _noPedidosGarantiaMessage = document.getElementById('no-garantia-pedidos-message');
        _pedidosGarantiaSearchInput = document.getElementById('garantia-pedidos-search-input');
        
        // Novo: Botão para ver Sat-G vinculado dentro do form
        _btnViewVinculadoSatg = document.getElementById('btn-view-vinculado-satg');
        _satgVinculadoAlert = document.getElementById('satg-vinculado-alert');

        _modalSatgPrintBtn = document.getElementById('modal-satg-print-btn');
        _modalSatgPrintDropdownMenu = document.getElementById('modal-satg-print-dropdown-menu');
        _modalSatgPrintSatgBtn = document.getElementById('modal-satg-print-satg-btn');
    }

    /**
     * Reseta o form para estado inicial
     */
    function _resetGarantiaForm() {
        document.getElementById('garantia-pedido-form').reset();
        _itemsList.innerHTML = '<li id="garantia-items-empty" class="text-sm text-gray-500 italic text-center py-2">Nenhum item adicionado.</li>';
        
        const titleEl = document.querySelector('#garantia-form-header h1');
        if (titleEl) titleEl.innerText = 'Novo Orçamento';
        
        const situacaoContainer = document.getElementById('garantia-situacao-container');
        if (situacaoContainer) situacaoContainer.classList.add('hidden');
        
        const btnSubmit = document.getElementById('btn-submit-garantia');
        if (btnSubmit) btnSubmit.innerHTML = 'Criar Pedido de Garantia';

        _currentEditPedidoId = null;
        _formHasChanges = false;
    }

    /**
     * Adiciona os Event Listeners
     */
    function _bindEvents() {
        if (_eventsBound) return;
        _eventsBound = true;

        // Navigation
        if (_btnShowForm) _btnShowForm.onclick = () => {
            _resetGarantiaForm();
            _showView('form');
        };
        if (_btnShowTable) _btnShowTable.onclick = () => _showView('table');
        if (_btnShowSatg) _btnShowSatg.onclick = () => { _showView('satg'); _fetchSatGData(); };
        if (_btnShowPedidosGarantia) _btnShowPedidosGarantia.onclick = () => { _showView('pedidosGarantia'); _fetchPedidosGarantiaData(); _fetchSatGData(true); };
        
        // Back buttons
        const checkCloseForm = () => {
            if (_formHasChanges) {
                const modalConfirm = document.getElementById('garantia-save-confirm-modal');
                if (modalConfirm) {
                    modalConfirm.classList.remove('hidden');
                    modalConfirm.classList.add('flex');
                    return; // Retorna pois a ação continua nos botões do modal
                }
            }
            document.getElementById('modal-garantia-form').classList.add('hidden');
            _fetchPedidosGarantiaData(); 
        };

        // Ligar os botões do Modal 3-way
        const saveModalCancel = document.getElementById('garantia-save-modal-cancel');
        const saveModalDiscard = document.getElementById('garantia-save-modal-discard');
        const saveModalSave = document.getElementById('garantia-save-modal-save');

        if (saveModalCancel) {
            saveModalCancel.onclick = () => {
                document.getElementById('garantia-save-confirm-modal').classList.add('hidden');
                document.getElementById('garantia-save-confirm-modal').classList.remove('flex');
            };
        }
        if (saveModalDiscard) {
            saveModalDiscard.onclick = () => {
                document.getElementById('garantia-save-confirm-modal').classList.add('hidden');
                document.getElementById('garantia-save-confirm-modal').classList.remove('flex');
                document.getElementById('modal-garantia-form').classList.add('hidden');
                _fetchPedidosGarantiaData(); 
            };
        }
        if (saveModalSave) {
            saveModalSave.onclick = () => {
                document.getElementById('garantia-save-confirm-modal').classList.add('hidden');
                document.getElementById('garantia-save-confirm-modal').classList.remove('flex');
                const btnSubmit = document.getElementById('btn-submit-garantia');
                if (btnSubmit) btnSubmit.click();
            };
        }

        if (_btnBackFromForm) _btnBackFromForm.onclick = checkCloseForm;
        if (_btnBackFromFormArrow) _btnBackFromFormArrow.onclick = checkCloseForm;
        const btnCloseFormX = document.getElementById('btn-close-garantia-form-x');
        if (btnCloseFormX) btnCloseFormX.onclick = checkCloseForm;
        if (_btnBackFromTable) _btnBackFromTable.onclick = () => { _showView('cards'); };
        if (_btnBackFromSatg) _btnBackFromSatg.onclick = () => { _showView('cards'); };
        if (_btnBackFromPedidosGarantia) _btnBackFromPedidosGarantia.onclick = () => _showView('cards');

        // Monitorar form para alterações
        if (_formPedido) {
            _formPedido.addEventListener('input', () => { _formHasChanges = true; });
            _formPedido.addEventListener('change', () => { _formHasChanges = true; });
        }

        // SatG Filter Toggle
        if (_satgFilterBtn) {
            _satgFilterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _satgFilterDropdown.classList.toggle('hidden');
            });
            // Click fora para fechar o dropdown
            document.addEventListener('click', (e) => {
                if (!_satgFilterBtn.contains(e.target) && !_satgFilterDropdown.contains(e.target)) {
                    _satgFilterDropdown.classList.add('hidden');
                }
            });
        }
        if (_satgFilterCheckboxes) {
            _satgFilterCheckboxes.forEach(cb => {
                cb.addEventListener('change', _applySatgFilters);
            });
        }

        // Novo: evento do botão para reabrir o SatG modal pelo form
        if (_btnViewVinculadoSatg) {
            _btnViewVinculadoSatg.onclick = () => {
                if (_currentSatgReqForOrder) {
                    _openSatgModal(_currentSatgReqForOrder);
                }
            };
        }

        // SatG Search
        if (_satgSearchInput) _satgSearchInput.addEventListener('input', _applySatgFilters);
        if (_btnFecharModalSatg) _btnFecharModalSatg.onclick = _closeSatgModal;
        
        if (_btnFecharModalPedidoGarantia) {
            _btnFecharModalPedidoGarantia.onclick = () => {
                if (_modalPedidoGarantiaDetalhes) _modalPedidoGarantiaDetalhes.classList.add('hidden');
            };
        }

        // Fechar dropdowns customizados ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[data-dropdown-container]')) {
                document.querySelectorAll('.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden), .retorno-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            }
            if (_modalSatgPrintDropdownMenu && !e.target.closest('#modal-satg-print-dropdown-container')) {
                _modalSatgPrintDropdownMenu.classList.add('hidden');
            }
        });

        if (_modalSatgPrintBtn) {
            _modalSatgPrintBtn.onclick = (e) => {
                e.stopPropagation();
                _modalSatgPrintDropdownMenu.classList.toggle('hidden');
            };
        }
        
        if (_modalSatgPrintSatgBtn) {
            _modalSatgPrintSatgBtn.onclick = (e) => {
                e.preventDefault();
                if (_modalSatgPrintDropdownMenu) _modalSatgPrintDropdownMenu.classList.add('hidden');
                _handlePrintSatG();
            };
        }

        if (_btnRecusarSatg) _btnRecusarSatg.onclick = () => _updateSatgStatus('RECUSADO');
        
        // Modal Sat-G Observacao
        if (_cancelSatgObservationBtn) {
            _cancelSatgObservationBtn.onclick = () => {
                if (_satgObservationModal) _satgObservationModal.classList.add('hidden');
            };
        }
        if (_satgObservationTextarea) {
            _satgObservationTextarea.addEventListener('input', () => {
                if (_satgObservationCharCount) {
                    _satgObservationCharCount.innerText = _satgObservationTextarea.value.length;
                }
            });
        }
        if (_saveSatgObservationBtn) {
            _saveSatgObservationBtn.onclick = async () => {
                await _saveSatgObservation();
            };
        }
        if (_btnSalvarObsSatg) {
            _btnSalvarObsSatg.onclick = () => {
                const req = _satgData.find(d => d.rowIndex === _currentSatgRowIndex);
                if (req && (req.idPedido || req.pedidoGerado)) {
                    _updateSatgStatus(null);
                } else {
                    _updateSatgStatus('EM ANALISE');
                }
            };
        }
        if (_btnAprovarPedidoSatg) _btnAprovarPedidoSatg.onclick = _handleAprovarPedidoSatg;

        // Form - Itens
        if (_btnAddItemModal) {
            _btnAddItemModal.onclick = () => {
                _modalGarantiaProduto.classList.remove('hidden');
                _inputSearchProduto.value = '';
                _renderProdutoResults('');
                _inputSearchProduto.focus();
            };
        }
        
        if (_btnFecharGarantiaProduto) {
            _btnFecharGarantiaProduto.onclick = () => {
                _modalGarantiaProduto.classList.add('hidden');
            };
        }
        
        // Modal Detalhes do Item
        const closeItemDetalheModal = () => {
            if (_modalItemDetalhe) _modalItemDetalhe.classList.add('hidden');
        };
        if (_btnFecharModalItemDetalhe) _btnFecharModalItemDetalhe.onclick = closeItemDetalheModal;
        if (_btnCancelarItemDetalhe) _btnCancelarItemDetalhe.onclick = closeItemDetalheModal;
        
        if (_btnSalvarItemDetalhe) {
            _btnSalvarItemDetalhe.onclick = () => {
                const idx = parseInt(_inputItemDetalheIndex.value);
                if (!isNaN(idx) && idx >= 0 && idx < _currentOrderItems.length) {
                    _currentOrderItems[idx].descricaoPersonalizada = _inputItemDetalheDescricao.value.trim();
                    _currentOrderItems[idx].observacaoItem = _inputItemDetalheObservacao.value.trim();
                    _renderOrderItems(); // Atualiza a tela
                }
                closeItemDetalheModal();
                _formHasChanges = true;
            };
        }

        if (_inputSearchProduto) {
            _inputSearchProduto.addEventListener('input', (e) => {
                _renderProdutoResults(e.target.value);
            });
        }

        // Form - Submit
        if (_formPedido) {
            _formPedido.onsubmit = _submitGarantiaPedido;
        }

        // Table - Search
        if (_searchInput) {
            _searchInput.addEventListener('input', _handleSearch);
        }
        if (_clearSearchBtn) {
            _clearSearchBtn.addEventListener('click', () => {
                _searchInput.value = '';
                _handleSearch();
            });
        }
        
        // Pedidos Garantia Search
        if (_pedidosGarantiaSearchInput) {
            _pedidosGarantiaSearchInput.addEventListener('input', _renderPedidosGarantiaTable);
        }
    }

    /**
     * Alterna entre as visualizações da tela
     */
    function _showView(viewName) {
        if (!_overviewCards) return; // Segurança

        _overviewCards.classList.add('hidden');
        _formContainer.classList.add('hidden');
        _tableContainer.classList.add('hidden');
        if (_satgContainer) _satgContainer.classList.add('hidden');
        if (_pedidosGarantiaContainer) _pedidosGarantiaContainer.classList.add('hidden');
        
        if (_mainHeader) _mainHeader.classList.add('hidden');
        if (_formHeader) _formHeader.classList.add('hidden');
        if (_tableHeader) _tableHeader.classList.add('hidden');
        if (_satgHeader) _satgHeader.classList.add('hidden');
        if (_pedidosGarantiaHeader) _pedidosGarantiaHeader.classList.add('hidden');

        if (viewName === 'cards') {
            _overviewCards.classList.remove('hidden');
            if (_mainHeader) _mainHeader.classList.remove('hidden');
            _currentSatgReqForOrder = null; // Limpa o estado ao voltar para cards
        } else if (viewName === 'form') {
            // Se view for form, a gente agora exibe o modal em vez de esconder a view atual
            // Então vamos reverter a ocultação das views principais que fizemos acima
            _overviewCards.classList.remove('hidden');
            if (_mainHeader) _mainHeader.classList.remove('hidden');
            
            _formContainer.classList.remove('hidden');
            if (_formHeader) _formHeader.classList.remove('hidden');
            document.getElementById('modal-garantia-form').classList.remove('hidden');
            
            // Exibe ou esconde o alerta de SatG vinculado
            if (_satgVinculadoAlert) {
                if (_currentSatgReqForOrder) {
                    _satgVinculadoAlert.classList.remove('hidden');
                } else {
                    _satgVinculadoAlert.classList.add('hidden');
                }
            }
        } else if (viewName === 'table') {
            _tableContainer.classList.remove('hidden');
            if (_tableHeader) _tableHeader.classList.remove('hidden');
        } else if (viewName === 'satg') {
            if (_satgContainer) _satgContainer.classList.remove('hidden');
            if (_satgHeader) _satgHeader.classList.remove('hidden');
        } else if (viewName === 'pedidosGarantia') {
            if (_pedidosGarantiaContainer) _pedidosGarantiaContainer.classList.remove('hidden');
            if (_pedidosGarantiaHeader) _pedidosGarantiaHeader.classList.remove('hidden');
        }
    }

    /**
     * Renderiza os resultados da busca de produtos
     */
    function _renderProdutoResults(query) {
        if (!_divProdutoResults) return;
        
        _divProdutoResults.innerHTML = '';
        
        const normalizeStr = (str) => {
            return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        const search = normalizeStr(query);
        const allProdutos = window._allProducts || [];
        
        const filtrados = allProdutos.filter(p => {
            const cod = normalizeStr(p.codigo);
            const nome = normalizeStr(p.descricao);
            return cod.includes(search) || nome.includes(search);
        }).slice(0, 30); // Limita a 30 resultados
        
        if (filtrados.length === 0) {
            _divProdutoResults.innerHTML = '<p class="text-gray-500 text-sm text-center mt-4">Nenhum produto encontrado.</p>';
            return;
        }
        
        filtrados.forEach(p => {
            const div = document.createElement('div');
            div.className = 'p-3 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg cursor-pointer transition-colors flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <p class="font-bold text-gray-800 text-sm">${p.codigo || '-'} - ${p.descricao || 'Sem descrição'}</p>
                    <p class="text-xs text-gray-500">Estoque: ${p.estoque || 0}</p>
                </div>
                <button type="button" class="text-blue-600 font-bold text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors">
                    Selecionar
                </button>
            `;
            
            div.onclick = () => {
                const qtdStr = prompt(`Quantidade para adicionar: ${p.descricao || 'Produto'}`, "1");
                if (qtdStr !== null) {
                    const qtd = parseFloat(qtdStr);
                    if (!isNaN(qtd) && qtd > 0) {
                        _currentOrderItems.push({
                            cod: p.codigo,
                            desc: p.descricao,
                            qtd: qtd,
                            peso: parseFloat(p.peso_bruto || p.peso_liquido || 0),
                            preco: parseFloat(p.preco || 0)
                        });
                        _formHasChanges = true;
                        _renderOrderItems();
                        _modalGarantiaProduto.classList.add('hidden');
                    } else {
                        alert('Quantidade inválida.');
                    }
                }
            };
            
            _divProdutoResults.appendChild(div);
        });
    }

    /**
     * Remove um item da lista temporária do pedido
     */
    function _removeOrderItem(index) {
        _currentOrderItems.splice(index, 1);
        _formHasChanges = true;
        _renderOrderItems();
    }

    /**
     * Atualiza a UI da lista de itens
     */
    function _renderOrderItems() {
        _itemsList.innerHTML = '';
        
        if (_currentOrderItems.length === 0) {
            _itemsList.innerHTML = '<tr><td colspan="5" id="garantia-items-empty" class="px-4 py-8 text-sm text-gray-500 italic text-center">Nenhum item adicionado.</td></tr>';
            return;
        }

        _currentOrderItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'cursor-pointer hover:bg-gray-50 transition-colors item-row';
            
            // Busca imagem no _allProducts
            let imgSrc = '';
            let fallbackPeso = 0;
            if (window._allProducts) {
                const prod = window._allProducts.find(p => String(p.codigo || '').trim() === String(item.cod || item.id || '').trim());
                if (prod) {
                    if (prod.url_imagens_externas && prod.url_imagens_externas.length > 0) {
                        imgSrc = prod.url_imagens_externas[0];
                    } else if (prod.imagem) {
                        imgSrc = prod.imagem;
                    }
                    fallbackPeso = parseFloat(prod.pesoBruto) || parseFloat(prod.pesoLiquido) || parseFloat(prod.metricas?.peso_bruto) || parseFloat(prod.metricas?.peso_liquido) || 0;
                }
            }
            
            let itemPeso = parseFloat(item.peso) || fallbackPeso;
            item.peso = itemPeso;
            
            const temPersonalizacao = !!item.descricaoPersonalizada || !!item.observacaoItem;
            let badgePersonalizado = '';
            if (temPersonalizacao) {
                badgePersonalizado = `
                    <div class="mt-2 bg-yellow-50 border border-yellow-100 rounded-lg p-2 text-xs w-full">
                        ${item.descricaoPersonalizada ? `<div class="mb-1"><span class="font-bold text-yellow-800">Desc. Customizada:</span> <span class="text-yellow-900">${item.descricaoPersonalizada}</span></div>` : ''}
                        ${item.observacaoItem ? `<div><span class="font-bold text-yellow-800">Obs:</span> <span class="text-yellow-900">${item.observacaoItem}</span></div>` : ''}
                    </div>
                `;
            }

            const imgHtml = imgSrc 
                ? `<img src="${imgSrc}" class="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0 border border-gray-200" title="Ver imagem">` 
                : `<div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-[10px] border border-gray-200">Sem img</div>`;

            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="flex items-start gap-3">
                        ${imgHtml}
                        <div class="flex flex-col">
                            <span class="font-medium text-gray-800">${item.desc || 'Sem descrição'}</span>
                            <span class="text-xs text-gray-400 mt-0.5">${item.cod || '-'}</span>
                            ${badgePersonalizado}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="font-black text-gray-800">${item.qtd}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2 justify-center" onclick="event.stopPropagation()">
                        <input type="text" class="garantia-item-peso-input w-20 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500" value="${itemPeso.toFixed(3)}">
                        <button type="button" class="garantia-item-sync-peso-btn flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 bg-white rounded shadow-sm border border-gray-200 hidden transition-all" title="Salvar novo peso no cadastro do produto no Bling" data-original-peso="${itemPeso.toFixed(3)}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        </button>
                    </div>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-bold text-emerald-600">${(item.preco || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" class="btn-edit-item-detalhe text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Detalhes Customizados">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" class="btn-remove-item text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Remover">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            `;
            
            
            const pesoInput = tr.querySelector('.garantia-item-peso-input');
            if (pesoInput) _formatWeightInput(pesoInput);
            const syncPesoBtn = tr.querySelector('.garantia-item-sync-peso-btn');
            if (pesoInput && syncPesoBtn) {
                pesoInput.addEventListener('input', () => {
                    const originalPeso = parseFloat(syncPesoBtn.dataset.originalPeso) || 0;
                    const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;
                    
                    item.peso = currentPeso;
                    
                    if (currentPeso !== originalPeso) {
                        syncPesoBtn.classList.remove('hidden');
                    } else {
                        syncPesoBtn.classList.add('hidden');
                    }
                });

                syncPesoBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const currentPeso = parseFloat(String(pesoInput.value).replace(',', '.')) || 0;
                    const originalBtnHtml = syncPesoBtn.innerHTML;
                    
                    syncPesoBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                    syncPesoBtn.disabled = true;

                    try {
                        let productIdToUpdate = null;
                        if (window._allProducts) {
                            const p = window._allProducts.find(x => String(x.codigo) === String(item.cod) || String(x.id) === String(item.id));
                            if (p) productIdToUpdate = p.id;
                        }

                        if (productIdToUpdate) {
                            // IMPORTANTE: Utiliza API_URLS do gerenciarGarantia
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
                            if (typeof PesquisarProduto !== 'undefined' && PesquisarProduto.updateProductWeightDisplay) {
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
                            alert(`Produto ${item.cod || ''} não encontrado no catálogo local.`);
                            syncPesoBtn.innerHTML = originalBtnHtml;
                            syncPesoBtn.disabled = false;
                        }
                    } catch (error) {
                        console.error('Erro ao atualizar peso:', error);
                        alert('Erro ao atualizar o peso no Bling.');
                        syncPesoBtn.innerHTML = originalBtnHtml;
                        syncPesoBtn.disabled = false;
                    }
                });
            }
            
            tr.querySelector('.btn-remove-item').onclick = (e) => { e.stopPropagation(); _removeOrderItem(index); };
            tr.querySelector('.btn-edit-item-detalhe').onclick = (e) => {
                e.stopPropagation();
                _inputItemDetalheIndex.value = index;
                _inputItemDetalheNomeOriginal.innerText = `${item.cod} - ${item.desc}`;
                _inputItemDetalheDescricao.value = item.descricaoPersonalizada || '';
                _inputItemDetalheObservacao.value = item.observacaoItem || '';
                
                const imgModalElement = document.getElementById('item-detalhe-imagem');
                if (imgSrc && imgModalElement) {
                    imgModalElement.src = imgSrc;
                    imgModalElement.classList.remove('hidden');
                } else if (imgModalElement) {
                    imgModalElement.classList.add('hidden');
                }
                
                if (_modalItemDetalhe) _modalItemDetalhe.classList.remove('hidden');
            };
            
            _itemsList.appendChild(tr);
        });
    }

    /**
     * Formata os itens para a string do Google Sheets
     * Padrão atual: (Código, Qtd, Valor|OK) 
     * Como não temos valor, enviaremos 0.00
     */
    function _formatItemsString() {
        return _currentOrderItems.map(item => {
            return `(${item.cod || item.desc}, ${item.qtd.toFixed(2)}, ${(item.preco || 0).toFixed(2)}|OK)`;
        }).join(' ');
    }

    /**
     * Submete o formulário de pedido de garantia
     */
    async function _submitGarantiaPedido(e) {
        e.preventDefault();

        const btnOriginalText = _btnSubmitGarantia.innerHTML;
        _btnSubmitGarantia.disabled = true;
        _btnSubmitGarantia.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...';

        try {
            const payload = {
                idCliente: _inputCliente.value.trim(), 
                nomeContato: _inputCliente.value.trim(),
                cpfCnpj: _inputCpfCnpj.value.trim(),
                numero: _inputNumero.value.trim(),
                idNotaFiscal: _inputIdNota.value.trim(),
                equipamento: document.getElementById('garantia-equipamento').value.trim(),
                itens: _formatItemsString(),
                observacao: _inputObservacao.value.trim(),
                avaliacao: _inputAvaliacao.value.trim(),
                itensDetalhado: _currentOrderItems
                    .filter(item => {
                        const hasCustom = !!item.descricaoPersonalizada || !!item.observacaoItem;
                        const hadCustomBefore = _itensDetalhadoGarantiaData.some(d => String(d.idProduto) === String(item.id || item.cod));
                        return hasCustom || hadCustomBefore;
                    })
                    .map(item => ({
                        idProduto: item.id || item.cod,
                        descricao: item.descricaoPersonalizada || '',
                        observacoes: item.observacaoItem || ''
                    }))
            };

            const isEdit = !!_currentEditPedidoId;
            let url = API_URLS.GARANTIA_PEDIDO;
            
            if (isEdit) {
                url = API_URLS.GARANTIA_PEDIDO_UPDATE || API_URLS.GARANTIA_PEDIDO; // Fallback to same URL if missing
                payload.idPedido = _currentEditPedidoId;
                const situacaoDropdown = document.getElementById('garantia-situacao');
                if (situacaoDropdown) {
                    payload.situacao = situacaoDropdown.value;
                }
            }

            const response = await fetch(url, {
                method: isEdit ? 'POST' : 'POST', // Assuming POST for both, change if needed
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Falha na comunicação com o servidor.');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.message || 'Erro desconhecido');
            }
            
            // NOVO: Se tiver itens detalhados customizados, envia para a aba ItensDetalhadoGarantia
            const itensCustom = payload.itensDetalhado;
            if (itensCustom && itensCustom.length > 0) {
                const idParaSalvar = isEdit ? _currentEditPedidoId : (data.idPedido || payload.numero);
                if (idParaSalvar) {
                    try {
                        await fetch(API_URLS.GARANTIA_ITENS_DETALHE, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                idPedido: idParaSalvar,
                                itensDetalhado: itensCustom
                            })
                        });
                    } catch (errDet) {
                        console.error('Erro ao salvar itens detalhados:', errDet);
                    }
                }
            }

            alert(isEdit ? 'Pedido de Garantia atualizado com sucesso!' : 'Pedido de Garantia criado com sucesso!');
            
            // Linkar ID do Pedido no Sat-G (reaproveitando o backend) apenas se for criação
            if (!isEdit && _currentSatgReqForOrder && (data.id || data.pedidoId || data.idPedido)) {
                try {
                    await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rowIndex: _currentSatgReqForOrder.rowIndex,
                            idPedido: data.id || data.pedidoId || data.idPedido
                        })
                    });
                    _fetchSatGData(); 
                } catch(e) {
                    console.warn("Falha ao vincular o pedido ao Sat-G:", e);
                }
            }
            
            const editedId = _currentEditPedidoId;
            _resetGarantiaForm();
            document.getElementById('modal-garantia-form').classList.add('hidden');
            
            if (isEdit) {
                await _fetchPedidosGarantiaData();
            } else {
                _fetchPedidosGarantiaData();
                _showView('satg');
            }

        } catch (err) {
            console.error('Erro ao salvar pedido:', err);
            alert('Erro ao salvar pedido de garantia: ' + err.message);
        } finally {
            _btnSubmitGarantia.disabled = false;
            _btnSubmitGarantia.innerHTML = btnOriginalText;
        }
    }

    /**
     * Parse items string to array for editing
     * (COD, QTD, VALOR STATUS)
     */
    function _parseItemsString(itemsString) {
        const items = [];
        if (!itemsString || itemsString.trim() === '-' || itemsString.trim() === '') return items;

        const regex = /\(([^)]+)\)/g;
        let match;
        
        while ((match = regex.exec(itemsString)) !== null) {
            const innerStr = match[1];
            const parts = innerStr.split(',');
            
            let codigo = parts[0] ? parts[0].trim() : '';
            let qtd = parts[1] ? parseFloat(parts[1].trim()) : 1;
            let precoEStatus = parts[2] ? parts[2].trim() : '0.00';
            
            let precoStr = precoEStatus;
            let status = 'OK';
            
            if (precoEStatus.includes('|')) {
                const s = precoEStatus.split('|');
                precoStr = s[0].trim();
                if (s[1]) status = s[1].trim();
            } else if (precoEStatus.includes(' ')) {
                const s = precoEStatus.split(' ');
                precoStr = s[0].trim();
                if (s[1]) status = s[1].trim();
            }
            
            let desc = codigo;
            // Tenta pegar a descrição real do cache de produtos
            if (window._allProducts) {
                const prod = window._allProducts.find(p => String(p.codigo || '').trim() === codigo);
                if (prod && prod.descricao) desc = prod.descricao;
            }

            items.push({
                cod: codigo,
                desc: desc,
                qtd: isNaN(qtd) ? 1 : qtd,
                preco: isNaN(parseFloat(precoStr)) ? 0 : parseFloat(precoStr),
                status: status
            });
        }
        return items;
    }

    /**
     * Open form in edit mode
     */
    function _openEditPedidoForm(idPedido) {
        if (!_pedidosGarantiaData) return;
        
        const refStr = String(idPedido);
        const pedido = _pedidosGarantiaData.find(p => 
            String(p.idPedido || '') === refStr || 
            String(p.numero || '') === refStr || 
            String(p.id || '') === refStr
        );

        if (!pedido) {
            alert('Pedido não encontrado para edição.');
            return;
        }

        _resetGarantiaForm();
        _currentEditPedidoId = idPedido;

        // Change Title
        const titleEl = document.querySelector('#garantia-form-header h1');
        if (titleEl) {
            // Garante que o H1 consiga jogar elementos pra direita
            titleEl.className = "text-xl font-bold text-gray-800 m-0 flex-1 flex items-center w-full";
            // Força o pai a ocupar o espaço
            titleEl.parentElement.classList.add('w-full');
            
            let satgTitleHTML = '';
            // Buscar com mais flexibilidade (com ou sem GAR-)
            const cleanRef = refStr.replace('GAR-', '');
            const satgAssociado = _satgData.find(s => {
                const sId = String(s.idPedido || '').replace('GAR-', '');
                return sId === cleanRef && sId !== '';
            });
            if (satgAssociado && satgAssociado.codigo) {
                satgTitleHTML = `<span class="ml-auto text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">${satgAssociado.codigo}</span>`;
            }
            titleEl.innerHTML = `<span>Editar Orçamento: <span class="text-gray-500">${idPedido}</span></span>${satgTitleHTML}`;
        }

        const btnSubmit = document.getElementById('btn-submit-garantia');
        if (btnSubmit) btnSubmit.innerHTML = 'Salvar Alterações';

        // Show Situation Dropdown
        const situacaoContainer = document.getElementById('garantia-situacao-container');
        if (situacaoContainer) situacaoContainer.classList.remove('hidden');

        // Populate fields
        _inputCliente.value = pedido.cliente || pedido.nomeContato || '';
        _inputCpfCnpj.value = pedido.cpfCnpj || pedido.cpf || '';
        _inputNumero.value = pedido.numero || '';
        _inputIdNota.value = pedido.idNotaFiscal || pedido.idNota || '';
        const eqValue = pedido.equipamento || pedido.produto || '';
        const eqSelect = document.getElementById('garantia-equipamento');
        if (eqValue && !Array.from(eqSelect.options).some(opt => opt.value === eqValue)) {
            const newOpt = document.createElement('option');
            newOpt.value = eqValue;
            newOpt.text = eqValue;
            eqSelect.add(newOpt);
        }
        eqSelect.value = eqValue;
        _inputObservacao.value = pedido.observacao || '';
        _inputAvaliacao.value = pedido.avaliacao || pedido.analise || '';

        const situacaoDropdown = document.getElementById('garantia-situacao');
        if (situacaoDropdown && pedido.situacao) {
            const validOptions = Array.from(situacaoDropdown.options).map(o => o.value);
            if (validOptions.includes(pedido.situacao)) {
                situacaoDropdown.value = pedido.situacao;
            }
        }

        // Populate items
        _currentOrderItems = _parseItemsString(pedido.itens);
        
        // NOVO: Preencher as descrições e observações customizadas
        if (_currentOrderItems.length > 0 && _itensDetalhadoGarantiaData.length > 0) {
            _currentOrderItems.forEach(item => {
                const itemRef = String(item.cod || item.id || '').trim();
                const detalhe = _itensDetalhadoGarantiaData.find(d => 
                    (String(d.idPedido) === refStr || String(d.idPedido) === cleanRef) && 
                    String(d.idProduto).trim() === itemRef
                );
                if (detalhe) {
                    item.descricaoPersonalizada = detalhe.descricao;
                    item.observacaoItem = detalhe.observacoes;
                }
            });
        }
        
        _renderOrderItems();

        // Switch View
        // if (_modalPedidoGarantiaDetalhes) _modalPedidoGarantiaDetalhes.classList.add('hidden'); // NÃO fechar detalhes se quiser que fique por trás!
        if (_formContainer) _formContainer.classList.remove('hidden');
        if (_formHeader) _formHeader.classList.remove('hidden');
        document.getElementById('modal-garantia-form').classList.remove('hidden');
        
        setTimeout(() => { _formHasChanges = false; }, 50);
    }


    /**
     * Renderiza a tabela de NF-es de garantia
     */
    function render() {
        if (!_tableContent) return;

        // Pega todos os dados da NF-e globais
        const allNFe = window._allNFeData || [];

        // Filtra apenas NF-es que tenham a natureza "Remessa em Garantia"
        _garantiaData = allNFe.filter(nfe => {
            const nat = String(nfe.natureza_de_operacao || "").toLowerCase().trim();
            return nat === 'remessa em garantia';
        });

        // Ordena por data de emissão (mais recentes primeiro)
        _garantiaData.sort((a, b) => {
            const dateA = _parseDate(a.data_de_emissao);
            const dateB = _parseDate(b.data_de_emissao);
            return dateB - dateA;
        });

        _filteredData = [..._garantiaData];
        
        // Limpa o input ao entrar
        if (_searchInput && !_searchInput.value) {
            if(_clearSearchBtn) _clearSearchBtn.classList.add('hidden');
        }

        _renderTable();
    }

    /**
     * Lida com a digitação no campo de busca da tabela
     */
    function _handleSearch() {
        const query = (_searchInput.value || "").toLowerCase().trim();
        
        if (query) {
            _clearSearchBtn.classList.remove('hidden');
        } else {
            _clearSearchBtn.classList.add('hidden');
        }

        _filteredData = _garantiaData.filter(nfe => {
            const nome = String(nfe.nome_do_cliente || "").toLowerCase();
            const num = String(nfe.numero_da_nota || "").toLowerCase();
            const chave = String(nfe.chave_de_acesso || "").toLowerCase();
            const cnpjCpf = String(nfe.cnpjcpf_cliente || "").toLowerCase();
            
            return nome.includes(query) || 
                   num.includes(query) || 
                   chave.includes(query) || 
                   cnpjCpf.includes(query);
        });

        _renderTable();
    }

    /**
     * Renderiza o corpo da tabela
     */
    function _renderTable() {
        if (!_tableContent) return;
        
        _tableContent.innerHTML = '';

        if (_filteredData.length === 0) {
            _tableContent.parentElement.classList.add('hidden');
            if (_noDataMessage) _noDataMessage.classList.remove('hidden');
            return;
        }

        _tableContent.parentElement.classList.remove('hidden');
        if (_noDataMessage) _noDataMessage.classList.add('hidden');

        _filteredData.forEach(nfe => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-green-50/50 transition-colors cursor-default border-b border-gray-50 last:border-0";
            
            // Formatadores
            const dataEmissao = nfe.data_de_emissao ? nfe.data_de_emissao.split(' ')[0] : '-';
            const numNota = nfe.numero_da_nota || '-';
            const nome = nfe.nome_do_cliente || 'Cliente Não Informado';
            const valor = parseFloat(String(nfe.valor_da_nota || '0').replace(',', '.'));
            const valorFormatado = isNaN(valor) ? '-' : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            // Status Badge
            const situacao = nfe.situacao || 'Emitida';
            let badgeClass = "bg-gray-100 text-gray-800 border-gray-200";
            if (situacao.toLowerCase().includes('emitida') || situacao.toLowerCase().includes('autorizada')) badgeClass = "bg-green-100 text-green-800 border-green-200";
            else if (situacao.toLowerCase().includes('cancelada')) badgeClass = "bg-red-100 text-red-800 border-red-200";
            else if (situacao.toLowerCase().includes('pendente') || situacao.toLowerCase().includes('analise')) badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200";

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                    ${dataEmissao}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                    #${numNota}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 font-bold max-w-[250px] truncate" title="${nome}">${nome}</div>
                    <div class="text-xs text-gray-500">${nfe.cnpjcpf_cliente || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                    ${valorFormatado}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${badgeClass}">
                        ${situacao}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    ${nfe.link_danfe ? `
                    <a href="${nfe.link_danfe}" target="_blank" 
                       class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm"
                       title="Visualizar DANFE">
                       <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                       DANFE
                    </a>
                    ` : `<span class="text-gray-400 text-xs italic">S/ Link</span>`}
                </td>
            `;

            _tableContent.appendChild(tr);
        });
    }

    /**
     * Converte data em string "DD/MM/YYYY" ou "YYYY-MM-DD" para objeto Date para ordenação
     */
    function _parseDate(dateString) {
        if (!dateString) return new Date(0);
        
        let d = String(dateString).trim();
        if (d.includes('/')) {
            const parts = d.split(' ')[0].split('/');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? new Date(0) : dt;
    }

    /**
     * =========================================
     * Lógica Sat-G
     * =========================================
     */
    async function _fetchSatGData(isSilent = false) {
        if (!_satgTableContent) return;
        
        if (!isSilent) {
            _satgTableContent.innerHTML = '<tr><td colspan="5" class="text-center py-8"><div class="flex flex-col items-center"><svg class="animate-spin h-8 w-8 text-purple-500 mb-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="text-sm text-gray-500">Buscando solicitações...</span></div></td></tr>';
        }

        try {
            const response = await fetch(API_URLS.GARANTIA_SATG);
            if (!response.ok) throw new Error('Falha ao carregar SatG');
            
            let data = await response.json();
            data.reverse(); // Inverte o array recém-criado ANTES de salvar na variável global
            _satgData = data;
            
            // Carregar pedidos se a lista estiver vazia ou se for uma atualização de sync (isSilent)
            if (_pedidosGarantiaData.length === 0 || isSilent) {
                try {
                    const pedRes = await fetch(API_URLS.GARANTIA_PEDIDO);
                    if (pedRes.ok) {
                        const pedData = await pedRes.json();
                        let pData = Array.isArray(pedData) ? pedData : (pedData.data || []);
                        pData.reverse(); // Evita dupla inversão em requisições paralelas
                        _pedidosGarantiaData = pData;
                    }
                } catch (e) {
                    console.warn("Erro ao buscar pedidos silenciosamente:", e);
                }
            }
            
            if (_satgBadgeCount) {
                const aguardandoCount = _satgData.filter(d => d.status.toUpperCase() === 'EM ANALISE').length;
                if (aguardandoCount > 0) {
                    _satgBadgeCount.innerText = aguardandoCount;
                    _satgBadgeCount.classList.remove('hidden');
                } else {
                    _satgBadgeCount.classList.add('hidden');
                }
            }

            _applySatgFilters();
        } catch (error) {
            console.error('Erro ao buscar SatG:', error);
            _satgTableContent.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Erro ao carregar dados.</td></tr>';
        }
    }

    function _applySatgFilters() {
        const query = _satgSearchInput ? _satgSearchInput.value.toLowerCase().trim() : '';
        
        // Pega os checkboxes selecionados
        let selectedStatus = [];
        if (_satgFilterCheckboxes) {
            _satgFilterCheckboxes.forEach(cb => {
                if (cb.checked) selectedStatus.push(cb.value.toUpperCase());
            });
        }
        
        if (_satgFilterText) {
            _satgFilterText.innerText = `Filtro (${selectedStatus.length})`;
        }

        _filteredSatgData = _satgData.filter(d => {
            const currentStatus = String(d.status).toUpperCase();
            
            // Verifica se o status atual esta nos filtros marcados
            const statusMatch = selectedStatus.length === 0 || selectedStatus.includes(currentStatus) || 
                                (currentStatus.includes('RECUSADO') && selectedStatus.includes('RECUSADO')) ||
                                (currentStatus.includes('ARQUIVADO') && selectedStatus.includes('RECUSADO')); 
            
            if (!statusMatch) return false;
            
            if (!query) return true;
            
            return String(d.codigo).toLowerCase().includes(query) ||
                   String(d.cliente).toLowerCase().includes(query) ||
                   String(d.cpf).toLowerCase().includes(query);
        });

        _renderSatgTable();
    }

    /**
     * =========================================
     * Lógica Pedidos Garantia
     * =========================================
     */
    async function _fetchPedidosGarantiaData() {
        if (!_pedidosGarantiaTableContent) return;
        
        _pedidosGarantiaTableContent.innerHTML = '<tr><td colspan="4" class="text-center py-8"><div class="flex flex-col items-center"><svg class="animate-spin h-8 w-8 text-blue-500 mb-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="text-sm text-gray-500">Buscando pedidos...</span></div></td></tr>';

        try {
            const [response, detalheResponse] = await Promise.all([
                fetch(API_URLS.GARANTIA_PEDIDO),
                fetch(API_URLS.GARANTIA_ITENS_DETALHE).catch(() => ({ ok: false }))
            ]);
            
            if (!response.ok) throw new Error('Falha ao carregar Pedidos de Garantia');
            
            let data = await response.json();
            
            let pData = Array.isArray(data) ? data : (data.data || []);
            pData.reverse(); 
            _pedidosGarantiaData = pData;
            
            if (detalheResponse && detalheResponse.ok) {
                const detalheData = await detalheResponse.json();
                _itensDetalhadoGarantiaData = detalheData.data || [];
            }
            
            _renderPedidosGarantiaTable();
        } catch (error) {
            console.error('Erro ao buscar Pedidos de Garantia:', error);
            _pedidosGarantiaTableContent.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Erro ao carregar dados.</td></tr>';
        }
    }

    function _renderPedidosGarantiaTable() {
        if (!_pedidosGarantiaTableContent) return;
        _pedidosGarantiaTableContent.innerHTML = '';

        const query = (_pedidosGarantiaSearchInput ? _pedidosGarantiaSearchInput.value : '').toLowerCase().trim();

        const filtered = _pedidosGarantiaData.filter(d => {
            if (!query) return true;
            return String(d.idPedido || d.numero || d.id || '').toLowerCase().includes(query) ||
                   String(d.cliente || d.nome || '').toLowerCase().includes(query) ||
                   String(d.cpf || d.cpfCnpj || '').toLowerCase().includes(query);
        });

        if (filtered.length === 0) {
            _pedidosGarantiaTableContent.parentElement.classList.add('hidden');
            if (_noPedidosGarantiaMessage) _noPedidosGarantiaMessage.classList.remove('hidden');
            return;
        }

        _pedidosGarantiaTableContent.parentElement.classList.remove('hidden');
        if (_noPedidosGarantiaMessage) _noPedidosGarantiaMessage.classList.add('hidden');

        filtered.forEach(req => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50/50 transition-colors border-b border-gray-50 last:border-0";
            
            const numeroDisplay = req.numero || req.idPedido || req.id || '-';
            const dataDisplay = req.data || req.dataCriacao || '-';
            // Use the equipment text, fallback to others just in case of old data
            const itensDisplay = req.equipamento || req.produto || req.itens || req.produtos || '-';
            const clienteDisplay = req.cliente || req.nomeContato || req.contato || req.empresa || '-';
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                    <div class="font-bold text-gray-800">#${numeroDisplay}</div>
                    <div class="text-xs text-gray-500">${dataDisplay ? dataDisplay.split('T')[0].split(' ')[0] : '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 font-bold max-w-[200px] truncate" title="${clienteDisplay}">${clienteDisplay}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-600 max-w-[200px] truncate" title="${itensDisplay}">${itensDisplay}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm" title="Editar">
                        Editar
                    </button>
                </td>
            `;
            
            const btnVer = tr.querySelector('button');
            btnVer.onclick = () => {
                _openEditPedidoForm(req.idPedido || req.numero || req.id);
            };

            _pedidosGarantiaTableContent.appendChild(tr);
        });
    }

    function _renderSatgTable() {
        if (!_satgTableContent) return;
        _satgTableContent.innerHTML = '';

        if (_filteredSatgData.length === 0) {
            _satgTableContent.parentElement.classList.add('hidden');
            if (_satgNoDataMessage) _satgNoDataMessage.classList.remove('hidden');
            return;
        }

        _satgTableContent.parentElement.classList.remove('hidden');
        if (_satgNoDataMessage) _satgNoDataMessage.classList.add('hidden');

        _filteredSatgData.forEach(req => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-purple-50/50 transition-colors border-b border-gray-50 last:border-0";
            
            let badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            const statusUpper = String(req.status || '').toUpperCase();
            if (statusUpper.includes('APROVADO')) badgeClass = 'bg-green-100 text-green-800 border-green-200';
            else if (statusUpper.includes('RECUSADO')) badgeClass = 'bg-red-100 text-red-800 border-red-200';
            
            let pedidoStatusBadge = '<span class="px-2.5 py-1 inline-flex text-[11px] font-bold rounded-full border bg-yellow-100 text-yellow-800 border-yellow-200 uppercase" title="Aguardando vínculo">EM ANALISE</span>';
            if (statusUpper.includes('RECUSADO')) {
                pedidoStatusBadge = '<span class="px-2.5 py-1 inline-flex text-[11px] font-bold rounded-full border bg-red-100 text-red-800 border-red-200 uppercase" title="Garantia Recusada">CANCELADO</span>';
            }
            let pedidoVinculado = null;
            let pBadgeClass = '';
            if (req.idPedido) {
                pedidoVinculado = _pedidosGarantiaData.find(p => String(p.idPedido || p.numero || p.id || '') === String(req.idPedido));
                if (pedidoVinculado && pedidoVinculado.situacao) {
                    pBadgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
                    let pStatus = pedidoVinculado.situacao.toUpperCase();
                    if (pStatus === 'PENDENTE') pStatus = 'EM ANALISE';
                    if (pStatus.includes('EM ANDAMENTO')) pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                    else if (pStatus.includes('EM ANALISE')) pBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    else if (pStatus.includes('AGUARDANDO')) pBadgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
                    else if (pStatus.includes('PRONTO')) pBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                    else if (pStatus.includes('ENVIADO') || pStatus.includes('FINALIZADO')) pBadgeClass = 'bg-green-100 text-green-800 border-green-200';
                    else if (pStatus.includes('CANCELADO')) pBadgeClass = 'bg-red-100 text-red-800 border-red-200';
                    
                    const pStatusList = ['EM ANALISE', 'Em Andamento', 'Aguardando Peça', 'Pronto Para Envio', 'Enviado', 'Finalizado', 'Cancelado'];
                    let dropdownOptions = pStatusList.map(s => {
                        let dotColor = 'bg-gray-400';
                        const su = s.toUpperCase();
                        if (su.includes('EM ANDAMENTO')) dotColor = 'bg-blue-400';
                        else if (su.includes('EM ANALISE')) dotColor = 'bg-yellow-400';
                        else if (su.includes('AGUARDANDO')) dotColor = 'bg-orange-400';
                        else if (su.includes('PRONTO')) dotColor = 'bg-indigo-400';
                        else if (su.includes('ENVIADO') || su.includes('FINALIZADO')) dotColor = 'bg-green-400';
                        else if (su.includes('CANCELADO')) dotColor = 'bg-red-400';
                        return `<button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2" data-value="${s}"><span class="w-2 h-2 rounded-full ${dotColor}"></span>${su}</button>`;
                    }).join('');

                    pedidoStatusBadge = `
                    <div class="relative inline-block text-left" data-dropdown-container>
                        <button type="button" class="pedido-custom-dropdown-btn px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border ${pBadgeClass} min-w-[130px] transition-all hover:shadow-sm">
                            <span class="flex-1 text-center">${pStatus}</span>
                            <svg class="w-3.5 h-3.5 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div class="pedido-custom-dropdown-menu absolute left-1/2 -translate-x-1/2 mt-1.5 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 hidden overflow-hidden py-1">
                            ${dropdownOptions}
                        </div>
                    </div>`;
                } else {
                    pedidoStatusBadge = `<span class="px-2.5 py-1 inline-flex text-[11px] font-bold rounded-full border bg-gray-100 text-gray-800 border-gray-200 uppercase" title="Sincronizando...">PROCESSANDO...</span>`;
                }
            }

            const retornoStatus = (req.retornoItem || 'EM ANALISE').toUpperCase();
            let retornoBadgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
            if (retornoStatus === 'EM ANALISE') retornoBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            else if (retornoStatus === 'SOLICITADO') retornoBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
            else if (retornoStatus === 'FINALIZADO') retornoBadgeClass = 'bg-green-100 text-green-800 border-green-200';
            else if (retornoStatus === 'NÃO RETORNADO' || retornoStatus === 'NAO RETORNADO') retornoBadgeClass = 'bg-red-100 text-red-800 border-red-200';
            else if (retornoStatus === 'CANCELADO') retornoBadgeClass = 'bg-red-100 text-red-800 border-red-200';

            let retornoDropdownHtml = `
            <div class="relative inline-block text-left" data-dropdown-container>
                <button type="button" class="retorno-custom-dropdown-btn px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border ${retornoBadgeClass} min-w-[130px] transition-all hover:shadow-sm">
                    <span class="flex-1 text-center">${retornoStatus}</span>
                    <svg class="w-3.5 h-3.5 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="retorno-custom-dropdown-menu absolute left-1/2 -translate-x-1/2 mt-1.5 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 hidden overflow-hidden py-1">
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-yellow-50 transition-colors flex items-center gap-2" data-value="EM ANALISE"><span class="w-2 h-2 rounded-full bg-yellow-400"></span>EM ANALISE</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2" data-value="SOLICITADO"><span class="w-2 h-2 rounded-full bg-blue-400"></span>SOLICITADO</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-green-50 transition-colors flex items-center gap-2" data-value="FINALIZADO"><span class="w-2 h-2 rounded-full bg-green-500"></span>FINALIZADO</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 transition-colors flex items-center gap-2" data-value="NÃO RETORNADO"><span class="w-2 h-2 rounded-full bg-red-500"></span>NÃO RETORNADO</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 transition-colors flex items-center gap-2" data-value="CANCELADO"><span class="w-2 h-2 rounded-full bg-red-500"></span>CANCELADO</button>
                </div>
            </div>`;

            if (statusUpper.includes('RECUSADO')) {
                retornoDropdownHtml = '<span class="px-2.5 py-1 inline-flex text-[11px] font-bold rounded-full border bg-red-100 text-red-800 border-red-200 uppercase" title="Garantia Recusada">CANCELADO</span>';
            }

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                    <div class="font-bold text-gray-800">${req.codigo || '-'}</div>
                    <div class="text-xs text-gray-500">${req.data ? req.data.split(' ')[0] : '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-normal max-w-[250px]">
                    <div class="text-sm font-semibold text-gray-900 line-clamp-2" title="${req.cliente}">${req.cliente || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="relative inline-block text-left" data-dropdown-container>
                        <button type="button" class="satg-custom-dropdown-btn px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border ${badgeClass} min-w-[130px] transition-all hover:shadow-sm" data-current="${statusUpper}">
                            <span class="flex-1 text-center">${statusUpper}</span>
                            <svg class="w-3.5 h-3.5 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div class="satg-custom-dropdown-menu absolute left-1/2 -translate-x-1/2 mt-1.5 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 hidden overflow-hidden py-1">
                            <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-yellow-50 transition-colors flex items-center gap-2" data-value="EM ANALISE"><span class="w-2 h-2 rounded-full bg-yellow-400"></span>EM ANALISE</button>
                            <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-green-50 transition-colors flex items-center gap-2" data-value="APROVADO"><span class="w-2 h-2 rounded-full bg-green-500"></span>APROVADO</button>
                            <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 transition-colors flex items-center gap-2" data-value="RECUSADO"><span class="w-2 h-2 rounded-full bg-red-500"></span>RECUSADO</button>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${pedidoStatusBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${retornoDropdownHtml}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2 items-center">
                    <button class="btn-avaliar-satg inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 shadow-sm" title="${statusUpper === 'EM ANALISE' ? 'Avaliar Solicitação' : 'Ver Detalhe Sat-G'}">
                        ${statusUpper === 'EM ANALISE' ? 'Avaliar' : 'Detalhe Sat-G'}
                    </button>
                    ${req.idPedido ? 
                        `<button class="btn-ver-pedido inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm" title="Ver Orçamento Vinculado: ${req.idPedido}" data-id="${req.idPedido}">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                            Orçamento
                        </button>` 
                        : ''
                    }
                    <span class="btn-observacao-satg cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors inline-block ml-1" title="Adicionar/Ver Observação">
                        <svg class="h-5 w-5 ${req.observacaoSatg && req.observacaoSatg.length > 5 ? 'text-red-500' : 'text-gray-300'}" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                        </svg>
                    </span>
                </td>
            `;

            // Event Listeners for Custom Dropdowns
            const garBtn = tr.querySelector('.satg-custom-dropdown-btn');
            const garMenu = tr.querySelector('.satg-custom-dropdown-menu');
            if (garBtn && garMenu) {
                garBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden), .retorno-custom-dropdown-menu:not(.hidden)').forEach(m => {
                        if (m !== garMenu) m.classList.add('hidden');
                    });
                    garMenu.classList.toggle('hidden');
                });
                garMenu.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        garMenu.classList.add('hidden');
                        const newStatus = btn.dataset.value;
                        if (newStatus === statusUpper) return;
                        
                        garBtn.classList.add('animate-pulse', 'opacity-50');
                        garBtn.disabled = true;
                        try {
                            const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ rowIndex: req.rowIndex, status: newStatus })
                            });
                            if (!res.ok) throw new Error();
                            _fetchSatGData();
                        } catch (err) {
                            alert("Erro ao atualizar status da Garantia");
                            _fetchSatGData();
                        }
                    });
                });
            }

            const pedBtn = tr.querySelector('.pedido-custom-dropdown-btn');
            const pedMenu = tr.querySelector('.pedido-custom-dropdown-menu');
            if (pedBtn && pedMenu && req.idPedido) {
                pedBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden), .retorno-custom-dropdown-menu:not(.hidden)').forEach(m => {
                        if (m !== pedMenu) m.classList.add('hidden');
                    });
                    pedMenu.classList.toggle('hidden');
                });
                pedMenu.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        pedMenu.classList.add('hidden');
                        const newStatus = btn.dataset.value;
                        const pStatus = pedidoVinculado ? pedidoVinculado.situacao.toUpperCase() : '';
                        if (newStatus.toUpperCase() === pStatus) return;
                        
                        let transportadora = undefined;
                        if (newStatus.toUpperCase() === 'ENVIADO') {
                            const transpPrompt = prompt("Informe o nome da Transportadora:");
                            if (transpPrompt === null) {
                                return; // Cancelou
                            }
                            transportadora = transpPrompt.trim();
                        }
                        
                        pedBtn.classList.add('animate-pulse', 'opacity-50');
                        pedBtn.disabled = true;
                        try {
                            const updateUrl = API_URLS.GARANTIA_PEDIDO_UPDATE || API_URLS.GARANTIA_PEDIDO; 
                            const res = await fetch(updateUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ idPedido: req.idPedido, situacao: newStatus, transportadora })
                            });
                            if (!res.ok) throw new Error();
                            await _fetchPedidosGarantiaData();
                            _fetchSatGData();
                        } catch (err) {
                            alert("Erro ao atualizar status do Pedido");
                            _fetchSatGData();
                        }
                    });
                });
            }
            
            const retBtn = tr.querySelector('.retorno-custom-dropdown-btn');
            const retMenu = tr.querySelector('.retorno-custom-dropdown-menu');
            if (retBtn && retMenu) {
                retBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden), .retorno-custom-dropdown-menu:not(.hidden)').forEach(m => {
                        if (m !== retMenu) m.classList.add('hidden');
                    });
                    retMenu.classList.toggle('hidden');
                });
                retMenu.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        retMenu.classList.add('hidden');
                        const newRetorno = btn.dataset.value;
                        if (newRetorno === retornoStatus) return;
                        
                        retBtn.classList.add('animate-pulse', 'opacity-50');
                        retBtn.disabled = true;
                        try {
                            const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ rowIndex: req.rowIndex, retornoItem: newRetorno })
                            });
                            if (!res.ok) throw new Error();
                            
                            req.retornoItem = newRetorno; // Atualiza o objeto atual pra não precisar esperar o fetch pra abrir modal
                            
                            _fetchSatGData(); // Atualiza a tabela silenciosamente ao fundo
                            
                            // Se marcou como NÃO RETORNADO, abre o modal de observação
                            if (newRetorno === 'NÃO RETORNADO' || newRetorno === 'NAO RETORNADO') {
                                if (typeof _openSatgObservationModal === 'function') {
                                    _openSatgObservationModal(req);
                                    // Opcional: preencher textarea
                                    const tx = document.getElementById('satg-observation-textarea');
                                    if (tx) {
                                        tx.value = "Motivo do Não Retorno: ";
                                        tx.focus();
                                        // coloca cursor no fim
                                        tx.selectionStart = tx.value.length;
                                    }
                                }
                            }
                        } catch (err) {
                            alert('Erro ao atualizar Retorno de Item');
                            _fetchSatGData();
                        }
                    });
                });
            }

            const btnObs = tr.querySelector('.btn-observacao-satg');
            if (btnObs) {
                btnObs.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof _openSatgObservationModal === 'function') _openSatgObservationModal(req);
                };
            }

            const btnAvaliar = tr.querySelector('.btn-avaliar-satg');
            if (btnAvaliar) btnAvaliar.onclick = () => _openSatgModal(req);

            const btnVerPedido = tr.querySelector('.btn-ver-pedido');
            if (btnVerPedido) {
                btnVerPedido.onclick = () => _openEditPedidoForm(req.idPedido);
            }

            _satgTableContent.appendChild(tr);
        });
    }

    function _openSatgModal(req) {
        _currentSatgRowIndex = req.rowIndex;
        
        document.getElementById('satg-modal-codigo').innerText = req.codigo;

        function _openCustomPrompt(title, initialValue, callback, type = null) {
            const modal = document.getElementById('modal-generic-edit');
            const titleEl = document.getElementById('modal-generic-edit-title');
            const labelEl = document.getElementById('modal-generic-edit-label');
            const inputEl = document.getElementById('modal-generic-edit-input');
            const btnCancel = document.getElementById('btn-cancel-generic-edit');
            const btnSave = document.getElementById('btn-save-generic-edit');
            const btnClose = document.getElementById('btn-close-generic-edit');

            if (!modal) return;

            titleEl.innerText = 'Editar Campo';
            labelEl.innerText = title;
            inputEl.value = initialValue || '';
            
            // Remove listeners antigos
            const newBtnSave = btnSave.cloneNode(true);
            btnSave.parentNode.replaceChild(newBtnSave, btnSave);
            const newBtnCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
            const newBtnClose = btnClose.cloneNode(true);
            btnClose.parentNode.replaceChild(newBtnClose, btnClose);
            const newInput = inputEl.cloneNode(true);
            inputEl.parentNode.replaceChild(newInput, inputEl);

            const closeModal = () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            };

            newBtnCancel.onclick = closeModal;
            newBtnClose.onclick = closeModal;

            // Função de máscara
            newInput.addEventListener('input', (e) => {
                let v = e.target.value;
                if (type === 'cpf') {
                    let digits = v.replace(/\D/g, "").substring(0, 14);
                    if (digits.length <= 11) {
                        v = digits.replace(/(\d{3})(\d)/, "$1.$2")
                                  .replace(/(\d{3})(\d)/, "$1.$2")
                                  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                    } else {
                        v = digits.replace(/^(\d{2})(\d)/, "$1.$2")
                                  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
                                  .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
                                  .replace(/(\d{4})(\d)/, "$1-$2");
                    }
                    e.target.value = v;
                } else if (type === 'telefone') {
                    let digits = v.replace(/\D/g, "");
                    if (digits.startsWith("55")) digits = digits.substring(2);
                    digits = digits.substring(0, 11);
                    
                    if (digits.length === 0) {
                        v = "";
                    } else if (digits.length <= 2) {
                        v = `+55 ${digits}`;
                    } else if (digits.length <= 6) {
                        v = `+55 ${digits.substring(0,2)} ${digits.substring(2)}`;
                    } else if (digits.length <= 10) {
                        v = `+55 ${digits.substring(0,2)} ${digits.substring(2,6)}-${digits.substring(6)}`;
                    } else {
                        v = `+55 ${digits.substring(0,2)} ${digits.substring(2,7)}-${digits.substring(7)}`;
                    }
                    e.target.value = v;
                }
            });
            
            // Força a formatação inicial
            newInput.dispatchEvent(new Event('input'));

            newBtnSave.onclick = () => {
                closeModal();
                callback(newInput.value);
            };

            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') newBtnSave.click();
            });

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => newInput.focus(), 100);
        }

        function injectEditPencil(elementId, column, key, currentValue, type = 'text') {
            const el = document.getElementById(elementId);
            if (!el) return;
            
            // Remove o botão se já existir dentro do próprio elemento
            el.querySelectorAll('.btn-edit-satg-field').forEach(b => b.remove());
            
            // Cria o botão para ficar inline ao lado do texto
            const btn = document.createElement('button');
            btn.className = 'btn-edit-satg-field text-blue-600 hover:bg-gray-200 p-1.5 rounded-full transition-colors ml-2 align-middle inline-flex';
            btn.title = 'Editar Campo';
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
            
            btn.onclick = async () => {
                let labelText = key;
                const labelEl = el.parentElement.querySelector('p:first-child, span:first-child');
                if (labelEl && labelEl !== el) {
                    labelText = labelEl.innerText.replace(':', '');
                }
                
                _openCustomPrompt(labelText, currentValue || '', async (newValue) => {
                    if (newValue !== null && newValue.trim() !== (currentValue || '').trim()) {
                        el.innerText = 'Salvando...';
                        try {
                            const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    rowIndex: req.rowIndex,
                                    updates: [ { column: column, value: newValue } ]
                                })
                            }, type);
                            const data = await res.json();
                            if (data.success) {
                                // Update local data temporarily to avoid full reload flicker
                                req[key] = newValue;
                                _openSatgModal(req); // Re-render modal silently
                                _fetchSatGData(true); // reload table silencioso no fundo
                            } else {
                                alert('Erro ao salvar: ' + (data.message || 'Desconhecido'));
                                el.innerText = currentValue || '-';
                            }
                        } catch(e) {
                            console.error(e);
                            alert('Erro ao salvar campo.');
                            el.innerText = currentValue || '-';
                        }
                    }
                }, type);
            };
            
            el.appendChild(btn);
        }

        document.getElementById('satg-modal-cliente').innerText = req.cliente || '-';
        injectEditPencil('satg-modal-cliente', 'C', 'cliente', req.cliente);
        
        document.getElementById('satg-modal-cpf').innerText = req.cpf || '-';
        injectEditPencil('satg-modal-cpf', 'D', 'cpf', req.cpf, 'cpf');
        
        const phoneTxt = req.telefone || '-';
        document.getElementById('satg-modal-telefone').innerHTML = `<span class="align-middle">${phoneTxt}</span>`;
        injectEditPencil('satg-modal-telefone', 'F', 'telefone', req.telefone, 'telefone');

        if (req.telefone && req.telefone.length > 8) {
            let phoneClean = req.telefone.replace(/\D/g, '');
            if (phoneClean) {
                if (!phoneClean.startsWith('55') && phoneClean.length <= 11) {
                    phoneClean = '55' + phoneClean;
                }
                const wppHtml = `<a href="https://wa.me/${phoneClean}" target="_blank" class="text-green-500 hover:text-green-600 align-middle inline-flex ml-2 transition-transform hover:scale-110" title="Chamar no WhatsApp">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                </a>`;
                document.getElementById('satg-modal-telefone').insertAdjacentHTML('beforeend', wppHtml);
            }
        }
        
        document.getElementById('satg-modal-email').innerText = req.email || '-';
        injectEditPencil('satg-modal-email', 'G', 'email', req.email);
        
        document.getElementById('satg-modal-nf').innerText = req.notaFiscal || '-';
        injectEditPencil('satg-modal-nf', 'M', 'notaFiscal', req.notaFiscal);
        
        const revendaSelect = document.getElementById('satg-modal-revenda');
        if (revendaSelect) {
            revendaSelect.value = req.revenda || '';
            revendaSelect.onchange = async () => {
                const newValue = revendaSelect.value;
                try {
                    const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rowIndex: req.rowIndex,
                            updates: [ { column: 'H', value: newValue } ]
                        })
                    });
                    if (!res.ok) throw new Error();
                    req.revenda = newValue;
                    _fetchSatGData(true);
                    if (window._showToast) window._showToast('Revenda atualizada com sucesso', 'success');
                } catch(e) {
                    console.error(e);
                    alert('Erro ao atualizar Revenda');
                    revendaSelect.value = req.revenda || '';
                }
            };
        }
        
        document.getElementById('satg-modal-local-revenda').innerText = req.localRevenda || '-';
        injectEditPencil('satg-modal-local-revenda', 'I', 'localRevenda', req.localRevenda);
        
        document.getElementById('satg-modal-equipamento').innerText = req.equipamento || req.produto || '-';
        injectEditPencil('satg-modal-equipamento', 'J', 'equipamento', req.equipamento || req.produto);
        
        document.getElementById('satg-modal-serie').innerText = req.numeroSerie || '-';
        injectEditPencil('satg-modal-serie', 'K', 'numeroSerie', req.numeroSerie);
        
        document.getElementById('satg-modal-pedido').innerText = req.numeroRequisicao || '-';
        injectEditPencil('satg-modal-pedido', 'L', 'numeroRequisicao', req.numeroRequisicao);
        
        document.getElementById('satg-modal-data-compra').innerText = req.dataCompra || '-';
        injectEditPencil('satg-modal-data-compra', 'N', 'dataCompra', req.dataCompra);
        
        document.getElementById('satg-modal-entrega').innerText = req.dataEntregaTecnica || '-';
        injectEditPencil('satg-modal-entrega', 'O', 'dataEntregaTecnica', req.dataEntregaTecnica);
        
        const tipoSelect = document.getElementById('satg-modal-tipo-equipamento');
        if (tipoSelect) {
            tipoSelect.value = req.tipoEquipamento || '';
            tipoSelect.onchange = async () => {
                const newValue = tipoSelect.value;
                try {
                    const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rowIndex: req.rowIndex,
                            updates: [ { column: 'AF', value: newValue } ]
                        })
                    });
                    if (!res.ok) throw new Error();
                    req.tipoEquipamento = newValue;
                    _fetchSatGData(true);
                } catch(err) {
                    alert('Erro ao salvar tipo de equipamento.');
                    tipoSelect.value = req.tipoEquipamento || '';
                }
            };
        }
        
        document.getElementById('satg-modal-aplicacao').innerText = req.aplicacao || '-';
        injectEditPencil('satg-modal-aplicacao', 'P', 'aplicacao', req.aplicacao);
        
        document.getElementById('satg-modal-chassi').innerText = req.chassiEndereco || '-';
        injectEditPencil('satg-modal-chassi', 'Q', 'chassiEndereco', req.chassiEndereco);
        
        document.getElementById('satg-modal-operacao').innerText = req.emOperacao || '-';
        injectEditPencil('satg-modal-operacao', 'R', 'emOperacao', req.emOperacao);
        
        document.getElementById('satg-modal-parada').innerText = req.dataParada || '-';
        injectEditPencil('satg-modal-parada', 'S', 'dataParada', req.dataParada);
        
        document.getElementById('satg-modal-preventiva').innerText = req.dataUltimaPreventiva || '-';
        injectEditPencil('satg-modal-preventiva', 'T', 'dataUltimaPreventiva', req.dataUltimaPreventiva);
        
        document.getElementById('satg-modal-onde-esta').innerText = req.ondeEstaProblema || '-';
        injectEditPencil('satg-modal-onde-esta', 'AE', 'ondeEstaProblema', req.ondeEstaProblema);
        
        document.getElementById('satg-modal-sintoma').innerText = req.sintoma || '-';
        injectEditPencil('satg-modal-sintoma', 'U', 'sintoma', req.sintoma);
        
        document.getElementById('satg-modal-problema').innerText = req.problema || '-';
        injectEditPencil('satg-modal-problema', 'V', 'problema', req.problema);
        
        document.getElementById('satg-modal-prediagnostico').innerText = req.preDiagnostico || '-';
        injectEditPencil('satg-modal-prediagnostico', 'W', 'preDiagnostico', req.preDiagnostico);
        
        const fotosContainer = document.getElementById('satg-modal-fotos-container');
        fotosContainer.innerHTML = '';
        if (req.fotos && req.fotos !== 'Sem anexo' && req.fotos.trim() !== '') {
            const links = req.fotos.split('\\n');
            links.forEach((link, index) => {
                if (link.trim() !== '') {
                    const a = document.createElement('a');
                    a.href = link.trim();
                    a.target = '_blank';
                    a.className = 'px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 transition-colors font-medium';
                    a.innerHTML = `<svg class="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Anexo ${index + 1}`;
                    fotosContainer.appendChild(a);
                }
            });
        } else {
            fotosContainer.innerHTML = '<span class="text-gray-500 italic">Sem anexo</span>';
        }
        
        document.getElementById('satg-modal-observacao').value = req.observacao || '';
        
        const pedidoLigado = req.idPedido || req.pedidoGerado;
        if (pedidoLigado) {
            _btnAprovarPedidoSatg.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                Ver Pedido
            `;
            _btnAprovarPedidoSatg.className = "px-5 py-2 text-white font-bold bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md flex items-center gap-2";
            _btnAprovarPedidoSatg.onclick = () => {
                _closeSatgModal();
                _openEditPedidoForm(pedidoLigado);
            };
        } else {
            _btnAprovarPedidoSatg.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                Criar Pedido (Garantia)
            `;
            _btnAprovarPedidoSatg.className = "px-5 py-2 text-white font-bold bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-md flex items-center gap-2";
            _btnAprovarPedidoSatg.onclick = _handleAprovarPedidoSatg;
        }
        
        // Atualizar botões de ação do SatG Modal
        const btnAprovar = document.getElementById('btn-aprovar-pedido-satg');
        if (btnAprovar) {
            if (req.idPedido) {
                btnAprovar.classList.add('hidden');
            } else {
                btnAprovar.classList.remove('hidden');
            }
        }
        
        if (_btnVerPedidoSatg) {
            if (req.idPedido) {
                _btnVerPedidoSatg.classList.remove('hidden');
                _btnVerPedidoSatg.onclick = () => _openEditPedidoForm(req.idPedido);
            } else {
                _btnVerPedidoSatg.classList.add('hidden');
            }
        }

        _modalSatg.classList.remove('hidden');
    }

    function _closeSatgModal() {
        _modalSatg.classList.add('hidden');
        _currentSatgRowIndex = null;
    }

    function _getPedidoPrintHtml(idPedido) {
        if (!idPedido) return '';
        const pedido = _pedidosGarantiaData.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido));
        if (!pedido) return '';
        
        let htmlItens = '';
        let totalValor = 0;
        const parsedItens = _parseItemsString(pedido.itens);
        const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

        if (parsedItens && parsedItens.length > 0) {
            parsedItens.forEach(i => {
                const itemRef = String(i.cod || i.id || '').trim();
                const detalhe = _itensDetalhadoGarantiaData.find(d => 
                    (String(d.idPedido) === String(pedido.idPedido) || String(d.idPedido) === String(pedido.numero)) && 
                    String(d.idProduto).trim() === itemRef
                );
                
                // Busca a imagem no cache
                let imgSrc = '';
                if (window._allProducts) {
                    const prod = window._allProducts.find(p => String(p.codigo || '').trim() === itemRef);
                    if (prod) {
                        if (prod.url_imagens_externas && prod.url_imagens_externas.length > 0) {
                            imgSrc = prod.url_imagens_externas[0];
                        } else if (prod.imagem) {
                            imgSrc = prod.imagem;
                        }
                    }
                }
                
                const precoItem = parseFloat(i.preco || 0);
                const qtdItem = parseInt(i.qtd || 1);
                totalValor += (precoItem * qtdItem);

                const descFinal = detalhe && detalhe.descricao ? detalhe.descricao : (i.desc || i.nome || '-');
                const obsFinal = detalhe && detalhe.observacoes ? `<div style="color: #c2410c; margin-top: 4px; font-weight: bold; font-size: 11px;">Obs: ${detalhe.observacoes}</div>` : '';
                
                const imgHtml = imgSrc && !imgSrc.includes('placehold.co') 
                    ? `<img src="${imgSrc}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;">` 
                    : `<div style="width:44px;height:44px;background:#f1f5f9;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;"></div>`;

                htmlItens += `
                    <tr>
                        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">
                            <div style="display:flex;align-items:center;gap:12px;">
                                ${imgHtml}
                                <div>
                                    <div style="font-weight:600;font-size:13px;color:#1e293b;">${descFinal}</div>
                                    ${obsFinal}
                                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Cód: ${i.cod || '-'}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;color:#475569;">${qtdItem}</td>
                        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b;">${fmtBRL(precoItem * qtdItem)}</td>
                    </tr>
                `;
            });
        }
        
        const totalFooter = parsedItens && parsedItens.length > 0 ? `
            <tr style="background:#f0fdf4;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#15803d;">Total</td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#15803d;text-align:right;">${fmtBRL(totalValor)}</td>
            </tr>
        ` : '';

        return `
            <div class="section" style="margin-top: 40px; border-top: 2px dashed #ccc; padding-top: 30px;">
                <div class="section-title">Orçamento Vinculado: ${pedido.numero || '-'}</div>
                
                <div style="margin-top: 15px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: .06em; margin-bottom: 8px;">Itens do Orçamento</div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-family: Arial, sans-serif;">
                        <thead>
                            <tr>
                                <th style="background: #1e40af; color: #fff; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left;">Produto</th>
                                <th style="background: #1e40af; color: #fff; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: center; width: 60px;">Qtd</th>
                                <th style="background: #1e40af; color: #fff; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: right; width: 100px;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlItens || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #888;">Nenhum item encontrado</td></tr>'}
                            ${totalFooter}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function _handlePrintSatG() {
        if (!_currentSatgRowIndex) return;
        const req = _satgData.find(d => d.rowIndex === _currentSatgRowIndex);
        if (!req) return;

        const win = window.open('', '_blank', 'width=850,height=750');
        if (!win) {
            alert('Por favor, permita pop-ups no seu navegador para imprimir.');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Impressão Sat-G ${req.codigo}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 30px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 10px; border-bottom: 2px solid #ddd; }
                    .header h1 { margin: 0; color: #4F46E5; }
                    .header p { margin: 5px 0; color: #666; }
                    .section { margin-bottom: 25px; }
                    .section-title { font-size: 14px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
                    .grid { display: flex; flex-wrap: wrap; gap: 15px; }
                    .field { flex: 1; min-width: 200px; background: #f9f9f9; padding: 10px; border-radius: 5px; }
                    .field-label { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; display: block; font-weight: bold; }
                    .field-value { font-size: 14px; font-weight: bold; }
                    .problema-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin-top: 15px; }
                    .problema-label { font-size: 11px; text-transform: uppercase; color: #dc2626; margin-bottom: 4px; display: block; font-weight: bold; }
                    
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                        .field { border: 1px solid #eee; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Solicitação de Garantia SAT-G</h1>
                    <p>Código: <b>${req.codigo || '-'}</b> &nbsp;|&nbsp; Data: <b>${req.data ? req.data.split(' ')[0] : '-'}</b></p>
                </div>
                
                <div class="section">
                    <div class="section-title">Dados do Cliente</div>
                    <div class="grid">
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Cliente / Empresa</span>
                            <span class="field-value">${req.cliente || '-'}</span>
                        </div>
                        <div class="field">
                            <span class="field-label">CPF / CNPJ</span>
                            <span class="field-value">${req.cpf || '-'}</span>
                        </div>
                    </div>
                    <div class="grid" style="margin-top: 15px;">
                        <div class="field">
                            <span class="field-label">Telefone / WhatsApp</span>
                            <span class="field-value">${req.telefone || '-'}</span>
                        </div>
                        <div class="field">
                            <span class="field-label">E-mail</span>
                            <span class="field-value">${req.email || '-'}</span>
                        </div>
                    </div>
                </div>



                <div class="section">
                    <div class="section-title">Equipamento com Defeito</div>
                    <div class="grid">
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Equipamento (Modelo e Ano)</span>
                            <span class="field-value">${req.equipamento || '-'}</span>
                        </div>
                        <div class="field">
                            <span class="field-label">Nº Série</span>
                            <span class="field-value">${req.numeroSerie || '-'}</span>
                        </div>
                        <div class="field">
                            <span class="field-label">Nota Fiscal</span>
                            <span class="field-value">${req.notaFiscal || '-'}</span>
                        </div>
                    </div>
                    
                    <div class="problema-box">
                        <span class="problema-label">Problema Detalhado</span>
                        <div style="font-size: 14px; white-space: pre-wrap;">${req.problema || '-'}</div>
                    </div>
                </div>
                
                ${_getPedidoPrintHtml(req.idPedido)}
                
                <div style="text-align: center; margin-top: 40px;">
                    <button onclick="window.print()" style="background: #4F46E5; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">Imprimir</button>
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    async function _updateSatgStatus(status = null) {
        if (!_currentSatgRowIndex) return;
        
        const observacao = document.getElementById('satg-modal-observacao').value.trim();
        
        const payload = { rowIndex: _currentSatgRowIndex };
        if (status) payload.status = status;
        if (observacao !== undefined) payload.observacao = observacao;

        const btnToUpdate = status === 'RECUSADO' ? _btnRecusarSatg : _btnSalvarObsSatg;
        const originalText = btnToUpdate.innerText;
        btnToUpdate.innerText = 'Salvando...';
        btnToUpdate.disabled = true;

        try {
            const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Erro ao atualizar SatG');
            
            if (status !== 'APROVADO') {
                alert('Atualizado com sucesso!');
                _closeSatgModal();
                _fetchSatGData(); // Recarrega os dados
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Falha ao atualizar. Tente novamente.');
            throw error; // Re-throw para parar o aprovar se falhar
        } finally {
            btnToUpdate.innerText = originalText;
            btnToUpdate.disabled = false;
        }
    }

    function _handleAprovarPedidoSatg() {
        // Atualiza a planilha primeiro com APROVADO e a observação
        _updateSatgStatus('APROVADO').then(() => {
            // Agora preenche o formulário de "Criar Pedido" com os dados do cliente e redireciona a view
            const req = _satgData.find(d => d.rowIndex === _currentSatgRowIndex);
            if (req) {
                _inputCliente.value = req.cliente || '';
                _inputCpfCnpj.value = req.cpf || '';
                _inputNumero.value = ''; // Começa vazio para gerar um novo ID, se quiser manter usar req.idPedido
                _inputIdNota.value = req.notaFiscal || '';
                
                _inputObservacao.value = req.problema || '';
                _inputAvaliacao.value = document.getElementById('satg-modal-observacao').value.trim();
                
                // NOVO: Adiciona o equipamento no campo próprio e deixa os itens vazios
                const reqEqValue = req.equipamento || req.produto || '';
                const reqEqSelect = document.getElementById('garantia-equipamento');
                if (reqEqValue && !Array.from(reqEqSelect.options).some(opt => opt.value === reqEqValue)) {
                    const newReqOpt = document.createElement('option');
                    newReqOpt.value = reqEqValue;
                    newReqOpt.text = reqEqValue;
                    reqEqSelect.add(newReqOpt);
                }
                reqEqSelect.value = reqEqValue;
                
                // Lista vazia para o usuário preencher com as peças
                _currentOrderItems = [];
                _renderOrderItems();
                // Salva os dados do request para mostrar no botão do form
                _currentSatgReqForOrder = req;
            }
            
            _closeSatgModal();
            _fetchSatGData(); // Tira o aprovado da lista
            _showView('form'); // Mostra a tela de criar pedido
        }).catch(err => {
            // Se falhou ao atualizar, o erro foi logado e o modal continua aberto
            console.error("Falhou ao aprovar Sat-G", err);
        });
    }

    /**
     * Abre o modal de Detalhes do Pedido Garantia
     */
    async function _openPedidoGarantiaModal(idPedido) {
        if (!_modalPedidoGarantiaDetalhes) return;
        
        const refStr = String(idPedido);
        
        let modalTitleId = idPedido;
        const satgAssociadoTitle = _satgData.find(s => String(s.idPedido) === refStr);
        if (satgAssociadoTitle && satgAssociadoTitle.codigo) {
            modalTitleId = satgAssociadoTitle.codigo;
        }
        document.getElementById('modal-pedido-garantia-id').innerText = modalTitleId;

        let pedido = _pedidosGarantiaData.find(p => 
            String(p.idPedido || '') === refStr || 
            String(p.numero || '') === refStr || 
            String(p.id || '') === refStr
        );

        if (!pedido) {
            document.getElementById('modal-pedido-garantia-cliente').innerText = 'Carregando...';
            document.getElementById('modal-pedido-garantia-cpf').innerText = '-';
            document.getElementById('modal-pedido-garantia-data').innerText = '-';
            document.getElementById('modal-pedido-garantia-situacao').innerText = '-';
            document.getElementById('modal-pedido-garantia-equipamento').innerText = '-';
            document.getElementById('modal-pedido-garantia-itens').innerText = '-';
            _modalPedidoGarantiaDetalhes.classList.remove('hidden');

            // Tenta buscar os dados se a aba pedidos ainda não foi carregada
            await _fetchPedidosGarantiaData();
            
            pedido = _pedidosGarantiaData.find(p => 
                String(p.idPedido || '') === refStr || 
                String(p.numero || '') === refStr || 
                String(p.id || '') === refStr
            );
        }
        
        if (pedido) {
            let equipamento = pedido.equipamento || pedido.produto || '';
            // Se o pedido é antigo e não tem equipamento salvo, tenta pegar do Sat-G associado
            if (!equipamento || equipamento === '-') {
                if (satgAssociadoTitle) equipamento = satgAssociadoTitle.equipamento || satgAssociadoTitle.produto || '';
            }

            document.getElementById('modal-pedido-garantia-cliente').innerText = pedido.cliente || '-';
            document.getElementById('modal-pedido-garantia-cpf').innerText = pedido.cpfCnpj || pedido.cpf || '-';
            document.getElementById('modal-pedido-garantia-data').innerText = pedido.data ? pedido.data.split(' ')[0] : '-';
            document.getElementById('modal-pedido-garantia-situacao').innerText = pedido.situacao || '-';
            document.getElementById('modal-pedido-garantia-equipamento').innerText = equipamento || '-';
            document.getElementById('modal-pedido-garantia-itens').innerHTML = _renderItensGarantiaHTML(pedido.itens);
        } else {
            document.getElementById('modal-pedido-garantia-cliente').innerText = 'Não encontrado';
        }

        if (_btnEditarPedidoGarantia) {
            _btnEditarPedidoGarantia.onclick = () => {
                _openEditPedidoForm(idPedido);
            };
        }

        _modalPedidoGarantiaDetalhes.classList.remove('hidden');
    }

    /**
     * Parseia a string de itens e retorna HTML formatado
     */
    function _renderItensGarantiaHTML(itensStr) {
        if (!itensStr || itensStr.trim() === '') {
            return '<span class="text-gray-500 italic">Nenhum item adicionado</span>';
        }
        
        const regex = /\(([^)]+)\)/g;
        let match;
        const items = [];
        while ((match = regex.exec(itensStr)) !== null) {
            items.push(match[1]);
        }

        if (items.length === 0) {
            return `<span class="text-gray-700 whitespace-pre-line">${itensStr.replace(/\|/g, '\n')}</span>`;
        }

        let html = `
        <div class="overflow-x-auto bg-white rounded-xl border border-gray-100 shadow-sm mt-2">
            <table class="min-w-full divide-y divide-gray-100 text-sm text-left">
                <thead class="bg-gray-50/50">
                    <tr>
                        <th class="px-5 py-4 text-xs font-black text-gray-400 uppercase tracking-widest w-full">Produto</th>
                        <th class="px-5 py-4 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap text-right">Valor</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100/80">
        `;
        
        items.forEach((itemStr, index) => {
            const parts = itemStr.split(',');
            let codigo = parts[0] ? parts[0].trim() : '-';
            let precoEStatus = parts[2] ? parts[2].trim() : '-';
            
            // Extrai o preço (tira o status se tiver)
            let precoStr = precoEStatus;
            if (precoEStatus.includes('|')) {
                precoStr = precoEStatus.split('|')[0].trim();
            } else if (precoEStatus.includes(' ')) {
                const splitPS = precoEStatus.split(' ');
                precoStr = splitPS[0].trim();
            }
            
            let precoFormatado = '-';
            if (precoStr && !isNaN(parseFloat(precoStr))) {
                precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(precoStr));
            }
            
            // Busca dados do produto no cache
            let nomeProduto = codigo;
            let imgSrc = "https://placehold.co/48x48/e2e8f0/64748b?text=...";
            if (window._allProducts) {
                const prod = window._allProducts.find(p => String(p.codigo || '').trim() === codigo);
                if (prod) {
                    if (prod.descricao) nomeProduto = prod.descricao;
                    if (prod.url_imagens_externas && prod.url_imagens_externas.length > 0) {
                        imgSrc = prod.url_imagens_externas[0];
                    } else if (prod.imagem) {
                        imgSrc = prod.imagem;
                    }
                }
            }

            html += `
                <tr class="hover:bg-gray-50/80 transition-all duration-200">
                    <td class="px-5 py-4">
                        <div class="flex items-center gap-4">
                            <button type="button" title="Clique para ampliar a imagem" 
                                onclick="document.getElementById('generic-image-modal-img').src='${imgSrc}'; document.getElementById('generic-image-modal').classList.remove('hidden'); document.getElementById('generic-image-modal').classList.add('flex');"
                                class="focus:outline-none rounded-xl focus:ring-2 focus:ring-blue-500 overflow-hidden ring-1 ring-gray-200 shadow-sm transition-transform hover:scale-105 active:scale-95 bg-white">
                                <img src="${imgSrc}" 
                                     alt="${nomeProduto}" class="w-14 h-14 object-cover cursor-zoom-in"
                                     onerror="this.src='https://placehold.co/48x48/e2e8f0/64748b?text=?'">
                            </button>
                            <div class="flex flex-col justify-center">
                                <p class="font-bold text-gray-800 text-sm leading-tight">${nomeProduto}</p>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md tracking-wide">${codigo}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="px-5 py-4 text-right">
                        <span class="font-bold text-gray-700 whitespace-nowrap text-[15px]">${precoFormatado}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        </div>`;
        return html;
    }

    function _openSatgObservationModal(req) {
        if (!_satgObservationModal) return;
        
        _satgObservationModal.dataset.rowIndex = req.rowIndex;
        _satgObservationModalInfo.innerHTML = `Editando observação para SAT-G <b>${req.codigo || 'N/A'}</b> - ${req.cliente || 'N/A'}`;
        
        let history = [];
        try {
            if (req.observacaoSatg && req.observacaoSatg.startsWith('[')) {
                history = JSON.parse(req.observacaoSatg);
            } else if (req.observacaoSatg && req.observacaoSatg.trim() !== '') {
                // Legado: era só uma string
                history = [req.observacaoSatg];
            }
        } catch (e) {
            console.error("Erro ao fazer parse do histórico Sat-G", e);
            if (req.observacaoSatg) {
                history = [req.observacaoSatg];
            }
        }

        _renderSatgObservationHistory(history);
        _satgObservationTextarea.value = '';
        if (_satgObservationCharCount) _satgObservationCharCount.innerText = '0';
        _satgObservationModal.classList.remove('hidden');
        _satgObservationTextarea.focus();
    }

    function _showConfirmation(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmation-modal');
            const titleEl = document.getElementById('confirmation-modal-title');
            const contentEl = document.getElementById('confirmation-modal-content');
            const yesBtn = document.getElementById('confirm-yes-btn');
            const noBtn = document.getElementById('confirm-no-btn');

            if (titleEl) titleEl.textContent = title;
            if (contentEl) contentEl.innerHTML = message;
            if (modal) modal.classList.remove('hidden');

            const onConfirm = () => {
                if (yesBtn) yesBtn.removeEventListener('click', onConfirm);
                if (noBtn) noBtn.removeEventListener('click', onCancel);
                if (modal) modal.classList.add('hidden');
                resolve(true);
            };

            const onCancel = () => {
                if (yesBtn) yesBtn.removeEventListener('click', onConfirm);
                if (noBtn) noBtn.removeEventListener('click', onCancel);
                if (modal) modal.classList.add('hidden');
                resolve(false);
            };

            if (yesBtn) yesBtn.addEventListener('click', onConfirm, { once: true });
            if (noBtn) noBtn.addEventListener('click', onCancel, { once: true });
        });
    }

    function _renderSatgObservationHistory(history) {
        if (!history || history.length === 0) {
            _satgObservationHistory.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma observação registrada.</p>';
            return;
        }

        const chatHtml = history.map((obs, idx) => {
            let timestamp = '';
            let message = '';
            if (typeof obs === 'string') {
                const parts = obs.split(' - ');
                timestamp = parts.length > 1 ? parts[0] : '';
                message = parts.length > 1 ? parts.slice(1).join(' - ') : obs;
            } else {
                message = obs.text || '';
                timestamp = obs.date || '';
                try {
                    if (timestamp && timestamp.includes('T')) {
                        const d = new Date(timestamp);
                        timestamp = d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                    }
                } catch(e) {}
            }

            return `
            <div class="relative group p-3 rounded-lg bg-blue-100 text-gray-800 max-w-md self-start mb-3">
                <button class="delete-obs-satg-btn absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700" 
                    data-obs-index="${idx}" title="Excluir esta observação">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                    </svg>
                </button>
                <p class="text-sm whitespace-pre-wrap pr-4">${message}</p>
                <div class="flex items-center justify-end mt-1">
                    <span class="text-xs text-gray-500 mr-1">${timestamp}</span>
                    <span title="Salvo"><svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></span>
                </div>
            </div>`;
        }).join('');
        _satgObservationHistory.innerHTML = chatHtml;
        _satgObservationHistory.scrollTop = _satgObservationHistory.scrollHeight;

        _satgObservationHistory.querySelectorAll('.delete-obs-satg-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const confirmed = await _showConfirmation('Excluir Observação', 'Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.');
                if (!confirmed) return;
                
                const idx = parseInt(btn.dataset.obsIndex, 10);
                const rowIndex = _satgObservationModal.dataset.rowIndex;
                const req = _satgData.find(d => String(d.rowIndex) === String(rowIndex));
                if (req) {
                    let currHistory = [];
                    try {
                        currHistory = JSON.parse(req.observacaoSatg);
                        if (Array.isArray(currHistory)) {
                            currHistory.splice(idx, 1);
                            const newObservacaoJSON = currHistory.length > 0 ? JSON.stringify(currHistory) : '';
                            
                            try {
                                const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ rowIndex: req.rowIndex, observacaoSatg: newObservacaoJSON })
                                });
                                if (!res.ok) throw new Error();
                                req.observacaoSatg = newObservacaoJSON;
                                _openSatgObservationModal(req); // reload modal
                                _fetchSatGData();
                            } catch (err) {
                                alert("Erro ao excluir observação");
                            }
                        }
                    } catch (err) {}
                }
            });
        });
    }

    async function _saveSatgObservation() {
        const rowIndex = _satgObservationModal.dataset.rowIndex;
        const newText = _satgObservationTextarea.value.trim();
        if (!rowIndex || !newText) return;

        const req = _satgData.find(d => String(d.rowIndex) === String(rowIndex));
        if (!req) return;

        // Tenta ler o historico existente
        let history = [];
        try {
            if (req.observacaoSatg && req.observacaoSatg.startsWith('[')) {
                history = JSON.parse(req.observacaoSatg);
            } else if (req.observacaoSatg && req.observacaoSatg.trim() !== '') {
                history = [req.observacaoSatg]; // fallback for legacy strings
            }
        } catch (e) {}

        const d = new Date();
        const timestampStr = d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        const newMsgStr = `${timestampStr} - ${newText}`;
        history.push(newMsgStr);

        const newObservacaoJSON = JSON.stringify(history);

        const originalBtnText = _saveSatgObservationBtn.innerText;
        _saveSatgObservationBtn.innerText = 'Salvando...';
        _saveSatgObservationBtn.disabled = true;

        try {
            const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: req.rowIndex, observacaoSatg: newObservacaoJSON })
            });
            if (!res.ok) throw new Error();
            
            // Atualizar cache local 
            req.observacaoSatg = newObservacaoJSON;
            
            _satgObservationTextarea.value = '';
            if (_satgObservationCharCount) _satgObservationCharCount.innerText = '0';
            _satgObservationModal.classList.add('hidden');
            
            _fetchSatGData();
        } catch (err) {
            alert('Erro ao salvar observação');
        } finally {
            _saveSatgObservationBtn.innerText = originalBtnText;
            _saveSatgObservationBtn.disabled = false;
        }
    }

    function resetToSelector() {
        _showView('cards');
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
        init,
        render,
        refreshSatG: _fetchSatGData,
        resetToSelector
    };
})();
