import { API_URLS } from '../apiConfig.js';

export const PecasEquipamentoApp = (function () {
    let _modelos = [];     // [{ nome, coluna, pecas[] }]
    let _container;        // #pecas-equipamento-cards
    let _loadingEl;
    let _noMessageEl;
    let _addModeloBtn;
    let _isInitialized = false;
    let _currentView = 'list'; // 'list' ou 'details'
    let _activeModelo = null;

    let _listView;
    let _detailsView;
    let _backToListBtn;
    let _detailNameEl;
    let _detailPecasEl;
    let _searchEquipmentInput;
    let _searchDetailPecaInput;

    // ─────────────────────────────────────────
    // Fetch
    // ─────────────────────────────────────────
    async function _fetchModelos() {
        _showLoading(true);
        try {
            const res = await fetch(API_URLS.PECAS_EQUIPAMENTO, { mode: 'cors' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            _modelos = json.data || [];
            _render();
        } catch (err) {
            console.error('[PecasEquipamento] Erro ao buscar modelos:', err);
            if (_noMessageEl) {
                _noMessageEl.classList.remove('hidden');
                const p = _noMessageEl.querySelector('p');
                if (p) p.textContent = 'Erro ao carregar equipamentos. Verifique a conexão.';
            }
        } finally {
            _showLoading(false);
        }
    }

    // ─────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────
    function _render() {
        if (!_container) return;
        
        // Esconde mensagem vazia por padrão
        if (_noMessageEl) _noMessageEl.classList.add('hidden');

        if (_currentView === 'list') {
            _renderList();
        } else if (_currentView === 'details' && _activeModelo) {
            _renderDetails();
        }
    }

    function _renderList() {
        if (_listView) _listView.classList.remove('hidden');
        if (_detailsView) _detailsView.classList.add('hidden');

        // Mostra barra de busca do topo quando em lista
        if (_searchEquipmentInput && _searchEquipmentInput.parentElement) {
            _searchEquipmentInput.parentElement.classList.remove('hidden');
        }
        if (_container && _container.parentElement) {
            const titleEl = _container.parentElement.querySelector('h3');
            if (titleEl && titleEl.textContent === 'Gerenciar Equipamentos') {
                titleEl.classList.remove('hidden');
            }
        }

        let displayModelos = _modelos;
        
        // Aplica filtro se houver
        const query = _searchEquipmentInput ? _searchEquipmentInput.value.trim().toLowerCase() : '';
        if (query) {
            let localProductsCache = PesquisarProduto.getAllProducts() || [];
            
            displayModelos = _modelos.filter(m => {
                // 1. Busca no nome do modelo
                if (m.nome.toLowerCase().includes(query)) return true;
                
                // 2. Busca nas peças vinculadas (pelo código ou pela descrição do produto)
                return m.pecas.some(pecaCodigo => {
                    const lowPeca = pecaCodigo.toLowerCase();
                    // Verifica se o código bate
                    if (lowPeca.includes(query)) return true;
                    
                    // Verifica se a descrição do produto vinculado bate
                    const product = localProductsCache.find(prod => prod.codigo === pecaCodigo);
                    if (product && product.descricao && product.descricao.toLowerCase().includes(query)) {
                        return true;
                    }
                    return false;
                });
            });
        }

        if (displayModelos.length === 0) {
            _container.innerHTML = '';
            if (_noMessageEl) {
                _noMessageEl.classList.remove('hidden');
                const p = _noMessageEl.querySelector('p');
                if (p) p.textContent = query ? 'Nenhum equipamento encontrado para esta busca.' : 'Nenhum peça/equipamento cadastrado.';
            }
            return;
        }

        _container.innerHTML = displayModelos.map(modelo => _buildListItem(modelo)).join('');
        _bindListEvents();
    }

    function _renderDetails() {
        if (_listView) _listView.classList.add('hidden');
        if (_detailsView) _detailsView.classList.remove('hidden');

        if (_detailNameEl) {
            _detailNameEl.textContent = _activeModelo.nome;
        }
        
        // Esconde barra de busca do topo quando em detalhes
        if (_searchEquipmentInput && _searchEquipmentInput.parentElement) {
            _searchEquipmentInput.parentElement.classList.add('hidden');
        }
        if (_container && _container.parentElement) {
            // Esconde o título "Gerenciar Equipamentos" que está logo antes da lista
            const titleEl = _container.parentElement.querySelector('h3');
            if (titleEl && titleEl.textContent === 'Gerenciar Equipamentos') {
                titleEl.classList.add('hidden');
            }
        }
        
        let localProductsCache = _allProductsCache;
        if (localProductsCache.length === 0 && typeof PesquisarProduto !== 'undefined' && PesquisarProduto.getAllProducts) {
            localProductsCache = PesquisarProduto.getAllProducts();
        }

        if (_detailPecasEl) {
            let html = `
                <div class="flex justify-end mb-4">
                    <button class="add-peca-btn flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-all text-sm font-semibold" data-col="${_activeModelo.coluna}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                        </svg>
                        Adicionar Peça
                    </button>
                </div>
            `;

            const detailQuery = _searchDetailPecaInput ? _searchDetailPecaInput.value.trim().toLowerCase() : '';
            
            const pecasFiltradas = _activeModelo.pecas.filter(peca => {
                if (!detailQuery) return true;
                
                const linkedProduct = localProductsCache.find(p => p.codigo === peca || p.descricao === peca);
                const desc = linkedProduct ? linkedProduct.descricao.toLowerCase() : '';
                const code = peca.toLowerCase();
                
                return desc.includes(detailQuery) || code.includes(detailQuery);
            });

            if (pecasFiltradas.length > 0) {
                html += `
                    <ul class="divide-y divide-gray-100 bg-gray-50 rounded-xl shadow-inner border border-gray-100">
                        ${pecasFiltradas.map(peca => {
                            const linkedProduct = localProductsCache.find(p => p.codigo === peca || p.descricao === peca);
                            const displayName = linkedProduct ? linkedProduct.descricao : peca;
                            const imagePlaceholder = 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
                            const imageUrl = (linkedProduct && linkedProduct.url_imagens_externas && linkedProduct.url_imagens_externas.length > 0) ? linkedProduct.url_imagens_externas[0] : imagePlaceholder;
                            const codigo = linkedProduct ? linkedProduct.codigo : peca;
                            const precoCustoNum = linkedProduct && linkedProduct.preco_de_custo ? parseFloat(linkedProduct.preco_de_custo) : 0;
                            const precoVendaNum = linkedProduct && linkedProduct.preco ? parseFloat(linkedProduct.preco) : 0;
                            
                            const precoCusto = precoCustoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            const precoVenda = precoVendaNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            const estoque = (linkedProduct && linkedProduct.estoque != null) ? linkedProduct.estoque : '0';
                            
                            return `
                            <li class="px-5 py-3 text-gray-700 hover:bg-white transition-colors flex items-center justify-between group first:rounded-t-xl last:rounded-b-xl">
                                <div class="flex flex-1 items-center gap-4 min-w-0 pr-4">
                                     <div class="w-10 h-10 shrink-0 border border-gray-200 rounded-md bg-white z-10 hover:z-50">
                                         <img src="${imageUrl}" 
                                              alt="${displayName}" 
                                              title="${displayName}"
                                              class="w-full h-full object-contain rounded-md transition-all duration-300 hover:scale-[5.0] hover:shadow-2xl hover:border hover:border-gray-300 hover:bg-white relative origin-left cursor-zoom-in"
                                              onerror="this.onerror=null;this.src='${imagePlaceholder}';">
                                     </div>
                                     
                                     <div class="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-4 min-w-0">
                                         <div class="flex flex-col min-w-0 flex-1">
                                            <span class="text-sm font-bold text-gray-800 truncate" title="${displayName}">${displayName}</span>
                                            <span class="text-xs text-gray-500">Cód: ${codigo}</span>
                                         </div>
                                         <div class="flex flex-col items-center min-w-[70px]">
                                            <span class="text-[10px] uppercase text-gray-400 font-bold">Qtd. Estoque</span>
                                            <span class="text-sm font-semibold text-gray-700">${estoque}</span>
                                         </div>
                                         <div class="flex flex-col items-end min-w-[90px]">
                                            <span class="text-[10px] uppercase text-gray-400 font-bold whitespace-nowrap">Custo de Compra</span>
                                            <span class="text-sm font-semibold text-red-500">${precoCusto}</span>
                                         </div>
                                         <div class="flex flex-col items-end min-w-[90px]">
                                            <span class="text-[10px] uppercase text-gray-400 font-bold whitespace-nowrap">Preço de Venda</span>
                                            <span class="text-sm font-semibold text-green-600">${precoVenda}</span>
                                         </div>
                                     </div>
                                </div>
                                <button class="delete-peca-btn shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" 
                                    data-peca="${peca}" data-col="${_activeModelo.coluna}" title="Remover Peça">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            </li>
                            `;
                        }).join('')}
                    </ul>
                `;
            } else {
                html += `
                    <div class="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                        </svg>
                        <p class="text-gray-400">${detailQuery ? 'Nenhuma peça encontrada para esta busca.' : 'Este equipamento ainda não possui peças cadastradas.'}</p>
                    </div>
                `;
            }
            _detailPecasEl.innerHTML = html;
            _bindDetailsEvents();
        }
    }

    function _bindDetailsEvents() {
        if (!_detailPecasEl) return;

        // Botão Adicionar Peça (dentro do HTML injetado)
        const addBtn = _detailPecasEl.querySelector('.add-peca-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const col = parseInt(addBtn.dataset.col);
                _addPeca(col);
            });
        }

        // Botões Remover Peça
        _detailPecasEl.querySelectorAll('.delete-peca-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const col = parseInt(btn.dataset.col);
                const peca = btn.dataset.peca;
                _removePeca(col, peca);
            });
        });
    }

    async function _addPeca(coluna) {
        _openSelectPieceModal(coluna);
    }

    // ─────────────────────────────────────────
    // Piece Search Modal Logic
    // ─────────────────────────────────────────
    let _activeTargetCol = null;
    let _allProductsCache = [];
    let _selectPieceModal;
    let _searchPieceInput;
    let _searchPieceResults;
    let _closeSelectPieceModalBtn;

    function _openSelectPieceModal(coluna) {
        _activeTargetCol = coluna;
        
        // Obtém produtos do PesquisarProduto
        if (typeof PesquisarProduto !== 'undefined' && PesquisarProduto.getAllProducts) {
            _allProductsCache = PesquisarProduto.getAllProducts();
        }

        if (_selectPieceModal) {
            _selectPieceModal.classList.remove('hidden');
            if (_searchPieceInput) {
                _searchPieceInput.value = '';
                _searchPieceInput.focus();
            }
            _renderSearchItems(''); // Mostra todos inicialmente ou vazio
        }
    }

    function _closeSelectPieceModal() {
        if (_selectPieceModal) _selectPieceModal.classList.add('hidden');
        _activeTargetCol = null;
    }

    function _renderSearchItems(filterText) {
        if (!_searchPieceResults) return;

        const query = filterText.trim().toLowerCase();

        const filtered = _allProductsCache.filter(p => {
            const desc = (p.descricao || '').toLowerCase();
            const code = (p.codigo || '').toLowerCase();
            return desc.includes(query) || code.includes(query);
        }).slice(0, 50); // Limita a 50 resultados para performance

        if (filtered.length === 0) {
            _searchPieceResults.innerHTML = `<p class="text-center py-4 text-gray-400">Nenhum produto encontrado.</p>`;
            return;
        }

        _searchPieceResults.innerHTML = filtered.map(p => {
            const imageUrl = (p.url_imagens_externas && p.url_imagens_externas.length > 0) 
                ? p.url_imagens_externas[0] 
                : 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
            
            return `
            <div class="flex items-center justify-between p-3 hover:bg-indigo-50 rounded-xl border border-gray-100 transition-colors cursor-pointer group"
                 data-peca-codigo="${p.codigo}">
                 <div class="flex items-center gap-3 min-w-0">
                     <div class="w-10 h-10 shrink-0 border border-gray-200 rounded-md bg-white">
                         <img src="${imageUrl}" 
                              alt="${p.descricao}" 
                              title="${p.descricao}"
                              class="w-full h-full object-contain rounded-md transition-transform duration-300 hover:scale-[3.0] hover:z-50 relative origin-left cursor-zoom-in"
                              onerror="this.onerror=null;this.src='https://placehold.co/50x50/e2e8f0/64748b?text=?';">
                     </div>
                     <div class="flex flex-col min-w-0">
                        <span class="text-sm font-bold text-gray-800 truncate" title="${p.descricao}">${p.descricao}</span>
                        <span class="text-xs text-gray-500">Cód: ${p.codigo}</span>
                     </div>
                 </div>
                 <button class="select-this-piece-btn px-3 py-1 shrink-0 ml-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all">
                     Selecionar
                 </button>
            </div>
            `;
        }).join('');

        // Bind clique nos resultados
        _searchPieceResults.querySelectorAll('[data-peca-codigo]').forEach(el => {
            el.addEventListener('click', () => {
                const codigoPeca = el.dataset.pecaCodigo;
                _executeAddPeca(_activeTargetCol, codigoPeca);
                _closeSelectPieceModal();
            });
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
                    <button id="custom-alert-ok-pecas" class="px-6 py-2.5 ${isSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-semibold rounded-xl shadow-md transition-colors w-full cursor-pointer">OK</button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('custom-alert-ok-pecas').onclick = () => { overlay.remove(); resolve(); };
        });
    }

    async function _executeAddPeca(coluna, nomePeca) {
        const pecaFormatada = nomePeca.trim();

        if (_activeModelo && _activeModelo.pecas && _activeModelo.pecas.includes(pecaFormatada)) {
            _showCustomAlert('Peça Duplicada', `O item com código <strong>${pecaFormatada}</strong> já está vinculado a este equipamento!`, false);
            return;
        }

        try {
            const res = await fetch(`${API_URLS.PECAS_EQUIPAMENTO}/peca`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coluna, nomePeca: pecaFormatada })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            // Atualiza localmente e re-renderiza
            if (_activeModelo) {
                _activeModelo.pecas.push(nomePeca.trim());
                _render();
            }
        } catch (err) {
            console.error('[PecasEquipamento] Erro ao adicionar peça:', err);
            alert('Erro ao adicionar peça.');
        }
    }


    async function _removePeca(coluna, nomePeca) {
        if (!confirm(`Remover a peça "${nomePeca}" deste equipamento?`)) return;

        try {
            const res = await fetch(`${API_URLS.PECAS_EQUIPAMENTO}/peca`, {
                method: 'DELETE',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coluna, nomePeca })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Atualiza localmente e re-renderiza
            if (_activeModelo) {
                _activeModelo.pecas = _activeModelo.pecas.filter(p => p !== nomePeca);
                _render();
            }
        } catch (err) {
            console.error('[PecasEquipamento] Erro ao remover peça:', err);
            alert('Erro ao remover peça.');
        }
    }

    function _buildListItem(modelo) {
        return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer overflow-hidden flex items-center" 
             data-col="${modelo.coluna}">
            
            <!-- Icone Indicativo -->
            <div class="px-5 py-4 bg-indigo-50 group-hover:bg-indigo-600 transition-colors shrink-0">
                <svg class="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
                </svg>
            </div>

            <!-- Titulo Inteiro -->
            <div class="flex-1 px-5 py-4 min-w-0 info-area" data-col="${modelo.coluna}">
                <h3 class="text-lg font-bold text-gray-900 truncate-none">${modelo.nome}</h3>
                <p class="text-xs text-gray-500 mt-1">${modelo.pecas.length} peças vinculadas</p>
            </div>

            <!-- Ações Rápidas -->
            <div class="px-5 flex items-center gap-2 shrink-0 border-l border-gray-50">
                <button class="rename-modelo-btn p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors" 
                    data-col="${modelo.coluna}" data-nome="${modelo.nome}" title="Renomear">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                </button>
                <button class="delete-modelo-btn p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    data-col="${modelo.coluna}" data-nome="${modelo.nome}" title="Excluir">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
                <div class="text-indigo-300 group-hover:text-indigo-600 transition-colors ml-2 mr-1">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────
    function _bindListEvents() {
        if (!_container) return;

        // Abrir Detalhes (clique na área de info ou no card todo)
        _container.querySelectorAll('.bg-white').forEach(card => {
            card.addEventListener('click', (e) => {
                // Não dispara se clicou nos botões de ação
                if (e.target.closest('button')) return;
                
                const coluna = parseInt(card.dataset.col);
                const modelo = _modelos.find(m => m.coluna === coluna);
                if (modelo) _showDetails(modelo);
            });
        });

        // Renomear
        _container.querySelectorAll('.rename-modelo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const coluna = parseInt(btn.dataset.col);
                const nomeAtual = btn.dataset.nome;
                _promptRenameModelo(coluna, nomeAtual);
            });
        });

        // Excluir
        _container.querySelectorAll('.delete-modelo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const coluna = parseInt(btn.dataset.col);
                const nome = btn.dataset.nome;
                _confirmDeleteModelo(coluna, nome);
            });
        });
    }

    function _showDetails(modelo) {
        _activeModelo = modelo;
        _currentView = 'details';
        if (_addModeloBtn) _addModeloBtn.classList.add('hidden'); // Oculta botão novo modelo
        _render();
    }

    function _backToList() {
        _activeModelo = null;
        _currentView = 'list';
        if (_addModeloBtn) _addModeloBtn.classList.remove('hidden'); // Mostra botão novo modelo
        _render();
    }

    // ─────────────────────────────────────────
    // CRUD Actions
    // ─────────────────────────────────────────
    async function _addModelo() {
        const nome = prompt('Nome do novo modelo/equipamento:');
        if (!nome || !nome.trim()) return;

        try {
            const res = await fetch(`${API_URLS.PECAS_EQUIPAMENTO}/modelo`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nome.trim() })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await _fetchModelos(); // Recarrega
        } catch (err) {
            console.error('[PecasEquipamento] Erro ao adicionar modelo:', err);
            alert('Erro ao criar modelo. Tente novamente.');
        }
    }

    function _promptRenameModelo(coluna, nomeAtual) {
        const novoNome = prompt(`Renomear "${nomeAtual}" para:`, nomeAtual);
        if (!novoNome || !novoNome.trim() || novoNome.trim() === nomeAtual) return;
        _renameModelo(coluna, novoNome.trim());
    }

    async function _renameModelo(coluna, novoNome) {
        try {
            const res = await fetch(`${API_URLS.PECAS_EQUIPAMENTO}/modelo`, {
                method: 'PUT',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coluna, novoNome })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Atualiza localmente sem precisar fazer novo fetch
            const modelo = _modelos.find(m => m.coluna === coluna);
            if (modelo) {
                modelo.nome = novoNome;
                _render();
            }
        } catch (err) {
            console.error('[PecasEquipamento] Erro ao renomear:', err);
            alert('Erro ao renomear. Tente novamente.');
        }
    }

    function _confirmDeleteModelo(coluna, nome) {
        if (!confirm(`Excluir o modelo "${nome}"? Esta ação é irreversível.`)) return;
        _deleteModelo(coluna);
    }

    async function _deleteModelo(coluna) {
        try {
            const res = await fetch(`${API_URLS.PECAS_EQUIPAMENTO}/modelo`, {
                method: 'DELETE',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coluna })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await _fetchModelos(); // Recarrega (índices das colunas mudam)
        } catch (err) {
            console.error('[PecasEquipamento] Erro ao excluir:', err);
            alert('Erro ao excluir modelo. Tente novamente.');
        }
    }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────
    function _showLoading(show) {
        if (_loadingEl) _loadingEl.classList.toggle('hidden', !show);
        if (_container) _container.classList.toggle('hidden', show);
    }

    function _cacheDom() {
        _container     = document.getElementById('pecas-equipamento-cards');
        _loadingEl     = document.getElementById('pecas-equipamento-loading');
        _noMessageEl   = document.getElementById('no-pecas-equipamento-message');
        _addModeloBtn  = document.getElementById('add-modelo-btn');

        _listView      = document.getElementById('equipments-list-view');
        _detailsView   = document.getElementById('equipment-details-view');
        _backToListBtn = document.getElementById('back-to-equipments-list');
        _detailNameEl  = document.getElementById('detail-equipment-name');
        _detailPecasEl = document.getElementById('detail-equipment-pecas');
        _searchEquipmentInput = document.getElementById('search-equipment-input');
        _searchDetailPecaInput = document.getElementById('search-detail-peca-input');

        _selectPieceModal         = document.getElementById('select-piece-modal');
        _searchPieceInput         = document.getElementById('search-piece-input');
        _searchPieceResults       = document.getElementById('search-piece-results');
        _closeSelectPieceModalBtn = document.getElementById('close-select-piece-modal');
    }

    function _bindEvents() {
        if (_addModeloBtn) {
            _addModeloBtn.addEventListener('click', _addModelo);
        }
        if (_backToListBtn) {
            _backToListBtn.addEventListener('click', _backToList);
        }
        if (_closeSelectPieceModalBtn) {
            _closeSelectPieceModalBtn.addEventListener('click', _closeSelectPieceModal);
        }
        if (_searchPieceInput) {
            _searchPieceInput.addEventListener('input', (e) => {
                _renderSearchItems(e.target.value);
            });
        }
        if (_searchEquipmentInput) {
            _searchEquipmentInput.addEventListener('input', () => {
                _render(); // Usa _render para respeitar a view atual
            });
        }
        if (_searchDetailPecaInput) {
            _searchDetailPecaInput.addEventListener('input', () => {
                _render();
            });
        }
    }

    // ─────────────────────────────────────────
    // Public
    // ─────────────────────────────────────────
    return {
        init() {
            _cacheDom();
            if (!_isInitialized) {
                _bindEvents();
                _isInitialized = true;
            }
            _fetchModelos();
        },
        reload: _fetchModelos
    };
})();
