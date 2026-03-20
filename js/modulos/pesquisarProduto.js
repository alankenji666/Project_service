export const PesquisarProduto = (function() {
    // --- Variáveis de estado e configuração ---
    let _allProducts = [];
    let _dom = {};
    let _utils = {};
    let _config = {}; // Adicionado: Armazena configurações como API_BASE_URL
    let _activeProductId = null;
    let _onProductSelectCallback = null;

    /**
     * Renderiza os detalhes de um produto específico no painel direito.
     */
    function _renderProductDetails(product) {
        if (!_dom.product_details || !_utils.createDetailItem) return;
    
        _dom.product_details.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <h2 class="text-2xl font-bold text-gray-800 product-detail-name">${product.descricao}</h2>
                <button class="read-only-disable edit-product-name-btn p-2 rounded-full hover:bg-gray-100 text-blue-600" data-product-id="${product.id}" data-product-codigo="${product.codigo}" title="Editar Nome do Produto">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                </button>
            </div>
            <div class="flex items-center space-x-2 mb-6">
                <p class="text-sm text-gray-500 product-detail-code">Código: ${product.codigo}</p>
                <button class="read-only-disable edit-product-code-btn p-1 rounded-full hover:bg-gray-100 text-blue-600" data-product-id="${product.id}" title="Editar Código (SKU)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                ${_utils.createDetailItem('Preço', (product.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}
                
                <!-- CORREÇÃO FINAL COM O NOME CORRETO DO CAMPO -->
                ${_utils.createDetailItem('Preço de Custo', (product.preco_de_custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}
                
                ${_utils.createDetailItem('Unidade', product.unidade || 'N/A')}
                <div class="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Estoque Atual</p>
                        <p class="text-lg text-gray-800 font-bold">${product.estoque || 0}</p>
                    </div>
                    <button class="read-only-disable open-stock-adjustment-modal-btn p-2 rounded-full hover:bg-gray-200" data-product-id="${product.id}" title="Ajustar Estoque">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                </div>
                ${_utils.createDetailItem('Estoque Mínimo', product.estoque_minimo)}
                ${_utils.createDetailItem('Estoque Máximo', product.estoque_maximo)}
                
                <div class="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Localização</p>
                        <p class="text-lg text-gray-800 font-semibold product-detail-location">${product.localizacao || 'N/A'}</p>
                    </div>
                    <button class="read-only-disable edit-product-location-btn p-2 rounded-full hover:bg-gray-200 text-blue-600" data-product-id="${product.id}" data-product-codigo="${product.codigo}" title="Editar Localização">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                </div>

                ${_utils.createDetailItem('Grupo de Tags', product.grupo_de_tags_tags?.join(', ') || 'N/A')}
                ${_utils.createDetailItem('Vendas (90d)', product.vendas_ultimos_90_dias || '0')}
            </div>
            
            <div class="mt-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Imagens do Produto</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    ${(product.url_imagens_externas && product.url_imagens_externas.length > 0) ? 
                        product.url_imagens_externas.map(url => `
                            <a href="${url}" target="_blank" rel="noopener noreferrer">
                                <img src="${url}" alt="Imagem do produto" class="w-full h-48 object-contain bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-2" 
                                     onerror="this.onerror=null;this.src='https://placehold.co/150x150/e2e8f0/64748b?text=?';">
                            </a>
                        `).join('') :
                        '<p class="text-gray-500 col-span-full">Nenhuma imagem disponível.</p>'
                    }
                </div>
            </div>
        `;
        _dom.details_placeholder.classList.add('hidden');
        _dom.product_details.classList.remove('hidden');
    }
    

    /**
     * Limpa o painel de detalhes e mostra o placeholder.
     */
    function _clearDetails() {
        if (!_dom.product_details || !_dom.details_placeholder) return;
        _dom.product_details.classList.add('hidden');
        _dom.details_placeholder.classList.remove('hidden');
    }
    
    /**
     * Manipula o clique em um item da lista de produtos.
     */
    function _handleProductClick(event) {
        const productItem = event.target.closest('.product-item');
        if (!productItem) return;

        const productId = productItem.dataset.productId;
        _activeProductId = productId;

        document.querySelectorAll('.product-item').forEach(item => item.classList.remove('active'));
        productItem.classList.add('active');

        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) {
            _renderProductDetails(product);
            if (typeof _onProductSelectCallback === 'function') {
                _onProductSelectCallback(product);
            }
        }
    }

    /**
     * Retorna o ID do produto que está sendo exibido nos detalhes no momento.
     */
    function getSelectedProductId() {
        return _activeProductId;
    }

    /**
     * Atualiza o nome do produto exibido na tela sem re-renderizar tudo.
     * @param {string|number} productId 
     * @param {string} novoNome 
     */
    function updateProductNameDisplay(productId, novoNome) {
        // 1. Atualiza no painel de detalhes se for o produto ativo
        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const nameElement = _dom.product_details.querySelector('.product-detail-name');
            if (nameElement) {
                nameElement.textContent = novoNome;
                nameElement.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => nameElement.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }

        // 2. Atualiza na lista lateral (sempre, se o item estiver lá)
        if (_dom.product_list_container) {
            const listItem = _dom.product_list_container.querySelector(`.product-item[data-product-id="${productId}"]`);
            if (listItem) {
                const titleElement = listItem.querySelector('h3');
                if (titleElement) {
                    titleElement.textContent = novoNome;
                    titleElement.setAttribute('title', novoNome);
                }
            }
        }
    }

    /**
     * Atualiza a localização do produto exibida na tela sem re-renderizar tudo.
     * @param {string|number} productId 
     * @param {string} novaLocalizacao 
     */
    function updateProductLocationDisplay(productId, novaLocalizacao) {
        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const locationElement = _dom.product_details.querySelector('.product-detail-location');
            if (locationElement) {
                locationElement.textContent = novaLocalizacao || 'N/A';
                locationElement.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => locationElement.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }
    }

    /**
     * Atualiza o código do produto exibido na tela sem re-renderizar tudo.
     * @param {string|number} productId 
     * @param {string} novoCodigo 
     */
    function updateProductCodeDisplay(productId, novoCodigo) {
        // 1. Atualiza no painel de detalhes se for o produto ativo
        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const codeElement = _dom.product_details.querySelector('.product-detail-code');
            if (codeElement) {
                codeElement.textContent = `Código: ${novoCodigo}`;
                codeElement.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => codeElement.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }

        // 2. Atualiza na lista lateral (sempre, se o item estiver lá)
        if (_dom.product_list_container) {
            const listItem = _dom.product_list_container.querySelector(`.product-item[data-product-id="${productId}"]`);
            if (listItem) {
                const codeElement = listItem.querySelector('p');
                if (codeElement) {
                    codeElement.textContent = novoCodigo;
                }
            }
        }
    }

    /**
     * Manipula a edição do nome do produto abrindo o modal configurado no App principal.
     */
    async function _handleEditName(productId, codigo) {
        if (typeof _config.openProductNameEditModal === 'function') {
            _config.openProductNameEditModal(productId);
        } else {
            console.error("[PesquisarProduto] Erro: Função openProductNameEditModal não foi passada no init.");
            alert("Erro interno: O modal de edição não está disponível.");
        }
    }

    /**
     * Manipula a edição da localização do produto abrindo o modal configurado no App principal.
     */
    async function _handleEditLocation(productId, codigo) {
        if (typeof _config.openProductLocationEditModal === 'function') {
            _config.openProductLocationEditModal(productId);
        } else {
            console.error("[PesquisarProduto] Erro: Função openProductLocationEditModal não foi passada no init.");
            alert("Erro interno: O modal de edição de localização não está disponível.");
        }
    }

    /**
     * Manipula a edição do código do produto abrindo o modal configurado no App principal.
     */
    async function _handleEditCode(productId) {
        if (typeof _config.openProductCodeEditModal === 'function') {
            _config.openProductCodeEditModal(productId);
        } else {
            console.error("[PesquisarProduto] Erro: Função openProductCodeEditModal não foi passada no init.");
            alert("Erro interno: O modal de edição de código não está disponível.");
        }
    }

    // --- Funções Públicas ---
    
    /**
     * Renderiza a lista de produtos no painel esquerdo.
     */
    function render(products) {
        _allProducts = products; // Atualiza a lista interna de produtos
        if (!_dom.product_list_container) return;
        if (!products || products.length === 0) {
            _dom.product_list_container.innerHTML = `<div class="p-4 text-center text-gray-500">Nenhum produto encontrado.</div>`;
            _clearDetails();
            return;
        }

        let listHtml = products.map(product => {
            const imageUrl = product.url_imagens_externas && product.url_imagens_externas[0] 
                ? product.url_imagens_externas[0] 
                : 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
            const isActive = String(product.id) === String(_activeProductId) ? 'active' : '';

            return `
                <div class="product-item flex items-center p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${isActive}" data-product-id="${product.id}">
                    <img src="${imageUrl}" 
                         alt="${product.descricao || 'Imagem do produto'}" 
                         class="product-list-item-img" 
                         data-image-url="${imageUrl}"
                         data-product-id="${product.id}"
                         onerror="this.onerror=null;this.src='https://placehold.co/50x50/e2e8f0/64748b?text=?';">
                    <div class="flex-grow overflow-hidden">
                        <h3 class="font-semibold text-gray-800 text-sm truncate" title="${product.descricao || ''}">${product.descricao || 'Sem descrição'}</h3>
                        <p class="text-xs text-gray-500">${product.codigo || 'Sem código'}</p>
                    </div>
                </div>
            `;
        }).join('');
        _dom.product_list_container.innerHTML = listHtml;
    }

    /**
     * Inicializa o módulo.
     */
    function init(config) {
        _config = config;
        _dom = config.domElements;
        _utils = config.utilities;
        _onProductSelectCallback = config.onProductSelect;

        if (_dom.product_list_container) {
            _dom.product_list_container.addEventListener('click', _handleProductClick);
            
            _dom.product_list_container.addEventListener('mouseover', (event) => {
                if (event.target.classList.contains('product-list-item-img')) {
                    _utils.showProductTooltip(event);
                }
            });
            _dom.product_list_container.addEventListener('mouseout', (event) => {
                if (event.target.classList.contains('product-list-item-img')) {
                    _utils.hideProductTooltip();
                }
            });
        }

        if (_dom.product_details_container) {
            _dom.product_details_container.addEventListener('click', (event) => {
                const adjustmentBtn = event.target.closest('.open-stock-adjustment-modal-btn');
                if (adjustmentBtn && typeof config.openStockAdjustmentModal === 'function') {
                    config.openStockAdjustmentModal(adjustmentBtn.dataset.productId);
                }

                const editNameBtn = event.target.closest('.edit-product-name-btn');
                if (editNameBtn) {
                    _handleEditName(editNameBtn.dataset.productId, editNameBtn.dataset.productCodigo);
                }

                const editLocationBtn = event.target.closest('.edit-product-location-btn');
                if (editLocationBtn) {
                    _handleEditLocation(editLocationBtn.dataset.productId, editLocationBtn.dataset.productCodigo);
                }

                const editCodeBtn = event.target.closest('.edit-product-code-btn');
                if (editCodeBtn) {
                    _handleEditCode(editCodeBtn.dataset.productId);
                }
            });
        }
    }

    /**
     * Retorna o código do produto que está sendo exibido nos detalhes no momento.
     */
    function getSelectedProductCodigo() {
        if (!_activeProductId) return null;
        const product = _allProducts.find(p => String(p.id) === String(_activeProductId));
        return product ? product.codigo : null;
    }

    /**
     * Atualiza o valor do estoque exibido na tela de detalhes sem re-renderizar tudo.
     * @param {number} novoEstoque 
     */
    function updateStockDisplay(novoEstoque) {
        if (!_dom.product_details) return;
        
        // Procura o elemento que contém o texto "Estoque Atual" e seu valor
        const estoqueContainer = _dom.product_details.querySelector('div.bg-gray-50 p.text-lg.font-bold');
        if (estoqueContainer) {
            // Adiciona uma animação suave de brilho para indicar a mudança
            estoqueContainer.textContent = novoEstoque;
            estoqueContainer.classList.add('text-green-600', 'scale-110', 'transition-all', 'duration-300');
            setTimeout(() => {
                estoqueContainer.classList.remove('text-green-600', 'scale-110');
            }, 2000);
        }
    }

    // Expõe as funções públicas
    return {
        init,
        render,
        renderDetails: _renderProductDetails,
        getSelectedProductCodigo,
        getSelectedProductId,
        updateStockDisplay,
        updateProductNameDisplay,
        updateProductLocationDisplay,
        updateProductCodeDisplay
    };
})();
