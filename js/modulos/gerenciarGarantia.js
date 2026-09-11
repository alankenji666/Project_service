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
    }

    /**
     * Reseta o form para estado inicial
     */
    function _resetGarantiaForm() {
        document.getElementById('garantia-pedido-form').reset();
        _itemsList.innerHTML = '<li id="garantia-items-empty" class="text-sm text-gray-500 italic text-center py-2">Nenhum item adicionado.</li>';
        
        const titleEl = document.querySelector('#garantia-form-header h1');
        if (titleEl) titleEl.innerText = 'Novo Pedido de Garantia';
        
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
        if (_btnShowPedidosGarantia) _btnShowPedidosGarantia.onclick = () => { _showView('pedidosGarantia'); _fetchPedidosGarantiaData(); };
        
        // Back buttons
        const checkCloseForm = () => {
            if (_formHasChanges) {
                if (!confirm('Você tem alterações não salvas. Deseja realmente sair sem salvar?')) {
                    return;
                }
            }
            document.getElementById('modal-garantia-form').classList.add('hidden');
            _fetchPedidosGarantiaData(); 
        };

        if (_btnBackFromForm) _btnBackFromForm.onclick = checkCloseForm;
        if (_btnBackFromFormArrow) _btnBackFromFormArrow.onclick = checkCloseForm;
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
        });

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
            _itemsList.appendChild(_itemsEmpty);
            _itemsEmpty.classList.remove('hidden');
            return;
        }

        _itemsEmpty.classList.add('hidden');

        _currentOrderItems.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center bg-white p-3 border border-gray-200 rounded-xl text-sm shadow-sm hover:border-blue-200 transition-colors';
            li.innerHTML = `
                <div class="grid grid-cols-12 gap-4 items-center w-full pr-4">
                    <div class="col-span-3 md:col-span-2">
                        <span class="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Código</span>
                        <span class="font-bold text-gray-800">${item.cod || '-'}</span>
                    </div>
                    <div class="col-span-9 md:col-span-5">
                        <span class="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Descrição</span>
                        <span class="font-bold text-gray-800 truncate block" title="${item.desc || 'Sem descrição'}">${item.desc || 'Sem descrição'}</span>
                    </div>
                    <div class="col-span-4 md:col-span-1 text-center bg-gray-50 rounded-lg p-1">
                        <span class="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Qtd</span>
                        <span class="font-black text-blue-600">${item.qtd}</span>
                    </div>
                    <div class="col-span-4 md:col-span-2 text-center">
                        <span class="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Peso</span>
                        <span class="font-bold text-gray-600">${(item.peso || 0).toFixed(3)} kg</span>
                    </div>
                    <div class="col-span-4 md:col-span-2 text-right">
                        <span class="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Preço</span>
                        <span class="font-bold text-emerald-600">${(item.preco || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                    </div>
                </div>
                <button type="button" class="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0" title="Remover">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            `;
            li.querySelector('button').onclick = () => _removeOrderItem(index);
            _itemsList.appendChild(li);
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
                avaliacao: _inputAvaliacao.value.trim()
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
                // Se for edição, aguarda atualizar os dados para refletir no modal de detalhes que está por trás
                await _fetchPedidosGarantiaData();
                if (editedId) {
                    _openPedidoGarantiaModal(editedId);
                }
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
        if (titleEl) titleEl.innerText = `Editar Pedido: ${idPedido}`;

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
        document.getElementById('garantia-equipamento').value = pedido.equipamento || pedido.produto || '';
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
            else if (situacao.toLowerCase().includes('pendente')) badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200";

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
            const response = await fetch(API_URLS.GARANTIA_PEDIDO);
            if (!response.ok) throw new Error('Falha ao carregar Pedidos de Garantia');
            
            let data = await response.json();
            
            let pData = Array.isArray(data) ? data : (data.data || []);
            pData.reverse(); 
            _pedidosGarantiaData = pData;
            
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
                    <button class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm" title="Ver no Bling">
                        Ver
                    </button>
                </td>
            `;
            
            const btnVer = tr.querySelector('button');
            btnVer.onclick = () => {
                const navGerenciarPedidos = document.getElementById('nav-gerenciar-pedidos');
                if (navGerenciarPedidos) navGerenciarPedidos.click();
                setTimeout(() => {
                    const searchInput = document.getElementById('pedidos-search');
                    if (searchInput) {
                        searchInput.value = numeroDisplay;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 300);
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
            
            let pedidoStatusBadge = '<span class="text-gray-400 text-sm font-medium italic">-</span>';
            let pedidoVinculado = null;
            let pBadgeClass = '';
            if (req.idPedido) {
                pedidoVinculado = _pedidosGarantiaData.find(p => String(p.idPedido || p.numero || p.id || '') === String(req.idPedido));
                if (pedidoVinculado && pedidoVinculado.situacao) {
                    pBadgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
                    const pStatus = pedidoVinculado.situacao.toUpperCase();
                    if (pStatus.includes('EM ANDAMENTO')) pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                    else if (pStatus.includes('PENDENTE')) pBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    else if (pStatus.includes('AGUARDANDO')) pBadgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
                    else if (pStatus.includes('PRONTO')) pBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                    else if (pStatus.includes('ENVIADO') || pStatus.includes('FINALIZADO')) pBadgeClass = 'bg-green-100 text-green-800 border-green-200';
                    else if (pStatus.includes('CANCELADO')) pBadgeClass = 'bg-red-100 text-red-800 border-red-200';
                    
                    const pStatusList = ['Pendente', 'Em Andamento', 'Aguardando Peça', 'Pronto Para Envio', 'Enviado', 'Finalizado', 'Cancelado'];
                    let dropdownOptions = pStatusList.map(s => {
                        let dotColor = 'bg-gray-400';
                        const su = s.toUpperCase();
                        if (su.includes('EM ANDAMENTO')) dotColor = 'bg-blue-400';
                        else if (su.includes('PENDENTE')) dotColor = 'bg-yellow-400';
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

            const retornoStatus = (req.retornoItem || 'PENDENTE').toUpperCase();
            let retornoBadgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
            if (retornoStatus === 'PENDENTE') retornoBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            else if (retornoStatus === 'SOLICITADO') retornoBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
            else if (retornoStatus === 'FINALIZADO') retornoBadgeClass = 'bg-green-100 text-green-800 border-green-200';
            else if (retornoStatus === 'NÃO RETORNADO' || retornoStatus === 'NAO RETORNADO') retornoBadgeClass = 'bg-red-100 text-red-800 border-red-200';

            const retornoDropdownHtml = `
            <div class="relative inline-block text-left" data-dropdown-container>
                <button type="button" class="retorno-custom-dropdown-btn px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border ${retornoBadgeClass} min-w-[130px] transition-all hover:shadow-sm">
                    <span class="flex-1 text-center">${retornoStatus}</span>
                    <svg class="w-3.5 h-3.5 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="retorno-custom-dropdown-menu absolute left-1/2 -translate-x-1/2 mt-1.5 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 hidden overflow-hidden py-1">
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-yellow-50 transition-colors flex items-center gap-2" data-value="PENDENTE"><span class="w-2 h-2 rounded-full bg-yellow-400"></span>PENDENTE</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2" data-value="SOLICITADO"><span class="w-2 h-2 rounded-full bg-blue-400"></span>SOLICITADO</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-green-50 transition-colors flex items-center gap-2" data-value="FINALIZADO"><span class="w-2 h-2 rounded-full bg-green-500"></span>FINALIZADO</button>
                    <button class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 transition-colors flex items-center gap-2" data-value="NÃO RETORNADO"><span class="w-2 h-2 rounded-full bg-red-500"></span>NÃO RETORNADO</button>
                </div>
            </div>`;

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                    <div class="font-bold text-gray-800">${req.codigo || '-'}</div>
                    <div class="text-xs text-gray-500">${req.data ? req.data.split(' ')[0] : '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-gray-900">${req.cliente || '-'}</div>
                    <div class="text-sm text-gray-600 max-w-[200px] truncate" title="${req.equipamento || req.produto}">${req.equipamento || req.produto || '-'}</div>
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
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                    ${req.idPedido ? 
                        `<button class="btn-ver-pedido inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm" title="Ver Pedido Vinculado: ${req.idPedido}" data-id="${req.idPedido}">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                            Pedido
                        </button>` 
                        : ''
                    }
                    <div class="btn-observacao-satg cursor-pointer w-6 h-6 rounded-full ${req.observacaoSatg && req.observacaoSatg.length > 5 ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700' : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700'} flex items-center justify-center transition-colors mx-1" title="Histórico de Observações Sat-G">
                        <span class="font-bold text-xs font-serif italic">i</span>
                    </div>
                    <button class="btn-avaliar-satg inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 shadow-sm" title="${statusUpper === 'EM ANALISE' ? 'Avaliar Solicitação' : 'Ver Detalhes'}">
                        ${statusUpper === 'EM ANALISE' ? 'Avaliar' : 'Detalhes'}
                    </button>
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
                        
                        pedBtn.classList.add('animate-pulse', 'opacity-50');
                        pedBtn.disabled = true;
                        try {
                            const updateUrl = API_URLS.GARANTIA_PEDIDO_UPDATE || API_URLS.GARANTIA_PEDIDO; 
                            const res = await fetch(updateUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ idPedido: req.idPedido, situacao: newStatus })
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
                            _fetchSatGData();
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
                btnVerPedido.onclick = () => _openPedidoGarantiaModal(req.idPedido);
            }

            _satgTableContent.appendChild(tr);
        });
    }

    function _openSatgModal(req) {
        _currentSatgRowIndex = req.rowIndex;
        
        document.getElementById('satg-modal-codigo').innerText = req.codigo;
        document.getElementById('satg-modal-cliente').innerText = req.cliente || '-';
        document.getElementById('satg-modal-cpf').innerText = req.cpf || '-';
        document.getElementById('satg-modal-telefone').innerText = req.telefone || '-';
        document.getElementById('satg-modal-email').innerText = req.email || '-';
        document.getElementById('satg-modal-nf').innerText = req.notaFiscal || '-';
        
        document.getElementById('satg-modal-revenda').innerText = req.revenda || '-';
        document.getElementById('satg-modal-local-revenda').innerText = req.localRevenda || '-';
        
        document.getElementById('satg-modal-equipamento').innerText = req.equipamento || req.produto || '-';
        document.getElementById('satg-modal-serie').innerText = req.numeroSerie || '-';
        document.getElementById('satg-modal-pedido').innerText = req.numeroRequisicao || '-';
        document.getElementById('satg-modal-data-compra').innerText = req.dataCompra || '-';
        document.getElementById('satg-modal-entrega').innerText = req.dataEntregaTecnica || '-';
        
        document.getElementById('satg-modal-aplicacao').innerText = req.aplicacao || '-';
        document.getElementById('satg-modal-chassi').innerText = req.chassiEndereco || '-';
        document.getElementById('satg-modal-operacao').innerText = req.emOperacao || '-';
        document.getElementById('satg-modal-parada').innerText = req.dataParada || '-';
        document.getElementById('satg-modal-preventiva').innerText = req.dataUltimaPreventiva || '-';
        
        document.getElementById('satg-modal-sintoma').innerText = req.sintoma || '-';
        document.getElementById('satg-modal-problema').innerText = req.problema || '-';
        document.getElementById('satg-modal-prediagnostico').innerText = req.preDiagnostico || '-';
        
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
                const navGerenciarPedidos = document.getElementById('nav-gerenciar-pedidos');
                if (navGerenciarPedidos) navGerenciarPedidos.click();
                
                setTimeout(() => {
                    const searchInput = document.getElementById('pedidos-search');
                    if (searchInput) {
                        searchInput.value = pedidoLigado;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 300);
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
                _btnVerPedidoSatg.onclick = () => _openPedidoGarantiaModal(req.idPedido);
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
                document.getElementById('garantia-equipamento').value = req.equipamento || req.produto || '';
                
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
                                    <div class="flex gap-1.5 opacity-60">
                                        <svg class="w-4 h-4 text-blue-500 cursor-pointer hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    </div>
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
                history = [{
                    user: 'Sistema',
                    date: req.data || new Date().toISOString(),
                    text: req.observacaoSatg
                }];
            }
        } catch (e) {
            console.error("Erro ao fazer parse do histórico Sat-G", e);
            if (req.observacaoSatg) {
                history = [{ user: 'Sistema', date: new Date().toISOString(), text: req.observacaoSatg }];
            }
        }

        _renderSatgObservationHistory(history);
        _satgObservationTextarea.value = '';
        if (_satgObservationCharCount) _satgObservationCharCount.innerText = '0';
        _satgObservationModal.classList.remove('hidden');
        _satgObservationTextarea.focus();
    }

    function _renderSatgObservationHistory(history) {
        if (!history || history.length === 0) {
            _satgObservationHistory.innerHTML = '<p class="text-gray-500 text-center italic py-4">Nenhuma observação registrada.</p>';
            return;
        }

        const currentUsername = localStorage.getItem('nome') || 'Usuário Local';
        let html = '';

        history.forEach(obs => {
            const isMe = obs.user === currentUsername;
            const alignClass = isMe ? 'justify-end' : 'justify-start';
            const bgClass = isMe ? 'bg-blue-100 text-blue-900 border-blue-200' : 'bg-white text-gray-800 border-gray-200';
            const radiusClass = isMe ? 'rounded-l-2xl rounded-tr-2xl rounded-br-sm' : 'rounded-r-2xl rounded-tl-2xl rounded-bl-sm';
            
            let dateStr = obs.date;
            try {
                if (obs.date && obs.date.includes('T')) {
                    const d = new Date(obs.date);
                    dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                }
            } catch (e) {}

            html += `
                <div class="flex ${alignClass} mb-3 group">
                    <div class="max-w-[85%]">
                        <div class="flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}">
                            <span class="text-xs font-bold text-gray-700">${obs.user || 'Sistema'}</span>
                            <span class="text-[10px] text-gray-400 font-medium">${dateStr}</span>
                        </div>
                        <div class="${bgClass} ${radiusClass} border shadow-sm px-4 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed">${obs.text}</div>
                    </div>
                </div>
            `;
        });

        _satgObservationHistory.innerHTML = html;
        setTimeout(() => {
            _satgObservationHistory.scrollTop = _satgObservationHistory.scrollHeight;
        }, 10);
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
                history = [{
                    user: 'Sistema',
                    date: req.data || new Date().toISOString(),
                    text: req.observacaoSatg
                }];
            }
        } catch (e) {}

        const currentUsername = localStorage.getItem('nome') || 'Usuário Local';
        history.push({
            user: currentUsername,
            date: new Date().toISOString(),
            text: newText
        });

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

    return {
        init,
        render,
        refreshSatG: _fetchSatGData,
        resetToSelector
    };
})();
