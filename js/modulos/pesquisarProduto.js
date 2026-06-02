import { PecasEquipamentoApp } from './pecasEquipamento.js';

export const PesquisarProduto = (function() {
    // --- Variáveis de estado e configuração ---
    let _allProducts = [];
    let _dom = {};
    let _utils = {};
    let _config = {};
    let _activeProductId = null;
    let _onProductSelectCallback = null;
    let _currentPage = 1;
    let _pageSize = 50;

    /**
     * Imprime a etiqueta de identificação contendo imagem, QR Code e informações customizadas.
     */
    function _printProductLabel(product, customDesc, customSpecs, customLoc) {
        const printWindow = window.open('', '_blank', 'width=600,height=400');
        if (!printWindow) {
            alert("Por favor, permita pop-ups para imprimir a etiqueta.");
            return;
        }

        const qrContainer = document.getElementById('label-preview-qrcode');
        let qrHtml = '';
        if (qrContainer) {
            qrHtml = qrContainer.innerHTML;
        }

        const imageUrl = product.url_imagens_externas && product.url_imagens_externas[0]
            ? product.url_imagens_externas[0]
            : 'https://placehold.co/150x150/e2e8f0/64748b?text=?';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Imprimir Etiqueta - ${product.codigo}</title>
                <style>
                    @page {
                        size: auto;
                        margin: 0mm;
                    }
                    body {
                        margin: 0;
                        padding: 10px;
                        font-family: Arial, sans-serif;
                        background: white;
                        -webkit-print-color-adjust: exact;
                    }
                    .label-container {
                        width: 380px;
                        height: 120px;
                        border: none;
                        padding: 8px;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        background: white;
                    }
                    .label-top {
                        display: flex;
                        align-items: flex-start;
                        gap: 8px;
                        flex-grow: 1;
                    }
                    .label-img-box {
                        width: 70px;
                        height: 70px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                        background: white;
                        flex-shrink: 0;
                    }
                    .label-img-box img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                    .label-info {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        min-width: 0;
                    }
                    .label-title {
                        font-size: 12px;
                        font-weight: bold;
                        margin: 0 0 2px 0;
                        color: black;
                        display: -webkit-box;
                        -webkit-line-clamp: 3;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        line-height: 1.2;
                        max-height: 3.6em;
                        word-break: break-word;
                    }
                    .label-specs {
                        font-size: 11px;
                        margin: 0;
                        color: #333;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .label-qr-box {
                        width: 70px;
                        height: 70px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    .label-qr-box canvas, .label-qr-box img {
                        width: 100% !important;
                        height: 100% !important;
                    }
                    .label-bottom {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        padding-top: 4px;
                        margin-top: 4px;
                    }
                    .label-location {
                        font-size: 14px;
                        font-weight: bold;
                        color: black;
                    }
                    .label-location span {
                        font-weight: normal;
                    }
                    .label-sku-bottom {
                        font-size: 14px;
                        font-weight: bold;
                        color: black;
                    }
                </style>
            </head>
            <body>
                <div class="label-container">
                    <div class="label-top">
                        <div class="label-img-box">
                            <img src="${imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/150x150/e2e8f0/64748b?text=?';">
                        </div>
                        <div class="label-info">
                            <h2 class="label-title">${customDesc}</h2>
                            <p class="label-specs">${customSpecs}</p>
                        </div>
                        <div class="label-qr-box">
                            ${qrHtml}
                        </div>
                    </div>
                    <div class="label-bottom">
                        <div class="label-location">Localização: <span>${customLoc}</span></div>
                        <div class="label-sku-bottom">${product.codigo}</div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

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
                <div class="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Preço</p>
                        <p class="text-lg text-gray-800 font-bold product-detail-price">${(product.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <button class="read-only-disable edit-product-price-btn p-2 rounded-full hover:bg-gray-200 text-blue-600" data-product-id="${product.id}" title="Editar Preço">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                </div>
                
                <div class="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Preço de Custo</p>
                        <p class="text-lg text-gray-800 font-bold product-detail-cost-price">${(product.preco_de_custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <button class="read-only-disable edit-product-cost-price-btn p-2 rounded-full hover:bg-gray-200 text-blue-600" data-product-id="${product.id}" title="Editar Preço de Custo">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                </div>
                
                ${_utils.createDetailItem('Unidade', product.unidade || 'N/A')}
                <div class="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Estoque Atual</p>
                        <p class="text-lg text-gray-800 font-bold product-detail-stock">${product.estoque || 0}</p>
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

                <div class="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-500">Grupo de Tags</p>
                        <p class="text-lg text-gray-800 font-semibold product-detail-tag-group">${product.grupo_de_tags_tags?.join(', ') || 'N/A'}</p>
                    </div>
                    <button class="read-only-disable edit-product-tag-group-btn p-2 rounded-full hover:bg-gray-200 text-blue-600" data-product-id="${product.id}" title="Editar Grupo de Tags">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                </div>

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

            <!-- Gerador de Etiqueta Identificadora com QR Code -->
            <div class="mt-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    Gerador de Etiqueta Identificadora
                </h3>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <!-- Controles de Customização -->
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Título / Descrição</label>
                            <input type="text" id="label-edit-desc" value="${product.descricao}" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Especificações Extras</label>
                            <input type="text" id="label-edit-specs" value="" placeholder="Ex: 3000kg 380v" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Localização</label>
                            <input type="text" id="label-edit-location" value="${product.localizacao || 'N/A'}" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        <button id="label-print-btn" class="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-md flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            Imprimir Etiqueta
                        </button>
                    </div>
                    
                    <!-- Live Preview -->
                    <div class="flex flex-col items-center">
                        <span class="text-xs font-semibold text-gray-400 mb-2">Pré-visualização da Etiqueta</span>
                        <div id="label-live-preview-box" class="w-full max-w-[380px] bg-white border border-gray-300 p-3 rounded flex flex-col justify-between h-[120px] shadow-sm select-none">
                            <div class="flex items-start gap-2 flex-grow">
                                <div class="w-[64px] h-[64px] flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
                                    <img id="label-preview-img" src="${product.url_imagens_externas && product.url_imagens_externas[0] ? product.url_imagens_externas[0] : 'https://placehold.co/150x150/e2e8f0/64748b?text=?'}" class="max-w-full max-h-full object-contain" onerror="this.onerror=null;this.src='https://placehold.co/150x150/e2e8f0/64748b?text=?';">
                                </div>
                                <div class="flex-grow min-w-0 flex flex-col justify-center">
                                    <h4 id="label-preview-title" class="text-[11px] font-bold text-black leading-tight max-w-[160px] overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-break: break-word;">${product.descricao}</h4>
                                    <p id="label-preview-specs" class="text-[10px] text-gray-700 truncate max-w-[160px]"></p>
                                </div>
                                <div id="label-preview-qrcode" class="w-[64px] h-[64px] flex items-center justify-center flex-shrink-0">
                                    <!-- QR Code Canvas inserido pelo qrcode.js -->
                                </div>
                            </div>
                            <div class="flex justify-between items-end pt-1 mt-1">
                                <div class="text-[11px] font-bold text-black">Localização: <span id="label-preview-loc-text" class="font-normal">${product.localizacao || 'N/A'}</span></div>
                                <div id="label-preview-sku-bottom" class="text-[11px] font-bold text-black">${product.codigo}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        _dom.details_placeholder.classList.add('hidden');
        _dom.product_details.classList.remove('hidden');

        // Instanciação dinâmica do QR Code e Event Listeners com pequeno delay
        setTimeout(() => {
            const qrContainer = document.getElementById('label-preview-qrcode');
            if (qrContainer && window.QRCode) {
                qrContainer.innerHTML = '';
                new window.QRCode(qrContainer, {
                    text: String(product.codigo),
                    width: 64,
                    height: 64,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: window.QRCode.CorrectLevel.H
                });
            }
            
            // Add live preview listeners
            const editDescInput = document.getElementById('label-edit-desc');
            const editSpecsInput = document.getElementById('label-edit-specs');
            const editLocInput = document.getElementById('label-edit-location');

            if (editDescInput) {
                editDescInput.addEventListener('input', (e) => {
                    const titlePreview = document.getElementById('label-preview-title');
                    if (titlePreview) titlePreview.textContent = e.target.value;
                });
            }
            if (editSpecsInput) {
                editSpecsInput.addEventListener('input', (e) => {
                    const specsPreview = document.getElementById('label-preview-specs');
                    if (specsPreview) specsPreview.textContent = e.target.value;
                });
            }
            if (editLocInput) {
                editLocInput.addEventListener('input', (e) => {
                    const locPreview = document.getElementById('label-preview-loc-text');
                    if (locPreview) locPreview.textContent = e.target.value || 'N/A';
                });
            }

            // Hook Print Button
            const printBtn = document.getElementById('label-print-btn');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    const customDesc = document.getElementById('label-edit-desc')?.value || product.descricao;
                    const customSpecs = document.getElementById('label-edit-specs')?.value || '';
                    const customLoc = document.getElementById('label-edit-location')?.value || product.localizacao || 'N/A';
                    _printProductLabel(product, customDesc, customSpecs, customLoc);
                });
            }
        }, 50);
    }
    

    function _clearDetails() {
        if (!_dom.product_details || !_dom.details_placeholder) return;
        _dom.product_details.classList.add('hidden');
        _dom.details_placeholder.classList.remove('hidden');
    }
    
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

    function getSelectedProductId() {
        return _activeProductId;
    }

    function updateProductNameDisplay(productId, novoNome) {
        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) product.descricao = novoNome;

        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const nameElement = _dom.product_details.querySelector('.product-detail-name');
            if (nameElement) {
                nameElement.textContent = novoNome;
                nameElement.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => nameElement.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }

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

    function updateProductLocationDisplay(productId, novaLocalizacao) {
        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) product.localizacao = novaLocalizacao;

        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const locationElement = _dom.product_details.querySelector('.product-detail-location');
            if (locationElement) {
                locationElement.textContent = novaLocalizacao || 'N/A';
                locationElement.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => locationElement.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }
    }

    function updateProductCodeDisplay(productId, novoCodigo) {
        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) product.codigo = novoCodigo;

        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const codeElement = _dom.product_details.querySelector('.product-detail-code');
            if (codeElement) {
                codeElement.textContent = `Código: ${novoCodigo}`;
                codeElement.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => codeElement.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }

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

    async function _handleEditName(productId, codigo) {
        if (typeof _config.openProductNameEditModal === 'function') {
            _config.openProductNameEditModal(productId);
        } else {
            console.error("[PesquisarProduto] Erro: Função openProductNameEditModal não foi passada no init.");
            alert("Erro interno: O modal de edição não está disponível.");
        }
    }

    async function _handleEditLocation(productId, codigo) {
        if (typeof _config.openProductLocationEditModal === 'function') {
            _config.openProductLocationEditModal(productId);
        } else {
            console.error("[PesquisarProduto] Erro: Função openProductLocationEditModal não foi passada no init.");
            alert("Erro interno: O modal de edição de localização não está disponível.");
        }
    }

    async function _handleEditCode(productId) {
        if (typeof _config.openProductCodeEditModal === 'function') {
            _config.openProductCodeEditModal(productId);
        } else {
            console.error("[PesquisarProduto] Erro: Função openProductCodeEditModal não foi passada no init.");
            alert("Erro interno: O modal de edição de código não está disponível.");
        }
    }

    function _renderPaginationControls(totalItems) {
        const totalPages = Math.ceil(totalItems / _pageSize);
        if (totalPages <= 1) return '';

        return `
            <div class="flex items-center justify-between p-2 bg-gray-50 border-y border-gray-200 sticky top-0 z-10">
                <button class="prev-page-btn p-1 rounded hover:bg-gray-200 disabled:opacity-30" ${_currentPage === 1 ? 'disabled' : ''}>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <span class="text-xs font-medium text-gray-600">Pág ${_currentPage} de ${totalPages}</span>
                <button class="next-page-btn p-1 rounded hover:bg-gray-200 disabled:opacity-30" ${_currentPage === totalPages ? 'disabled' : ''}>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>
        `;
    }

    function render(products, resetPagination = false) {
        if (resetPagination) _currentPage = 1;
        _allProducts = products;
        if (!_dom.product_list_container) return;

        if (!products || products.length === 0) {
            _dom.product_list_container.innerHTML = `<div class="p-4 text-center text-gray-500">Nenhum produto encontrado.</div>`;
            _clearDetails();
            return;
        }

        const totalItems = products.length;
        const totalPages = Math.ceil(totalItems / _pageSize);
        
        if (_currentPage > totalPages) _currentPage = totalPages;
        if (_currentPage < 1) _currentPage = 1;

        const startIndex = (_currentPage - 1) * _pageSize;
        const endIndex = startIndex + _pageSize;
        const paginatedProducts = products.slice(startIndex, endIndex);

        const paginationHtml = _renderPaginationControls(totalItems);

        let listHtml = paginatedProducts.map(product => {
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

        const footerPaginationHtml = paginationHtml.replace('sticky top-0 z-10', 'mt-auto border-t');
        _dom.product_list_container.innerHTML = `
            <div class="flex flex-col h-full overflow-y-auto">
                ${paginationHtml}
                <div class="flex-grow overflow-y-auto w-full">
                    ${listHtml}
                </div>
                ${footerPaginationHtml ? footerPaginationHtml : ''}
            </div>
        `;
    }

    function init(config) {
        _config = config;
        _dom = config.domElements;
        _utils = config.utilities;
        _onProductSelectCallback = config.onProductSelect;

        if (_dom.product_list_container) {
            _dom.product_list_container.addEventListener('click', (event) => {
                const prevBtn = event.target.closest('.prev-page-btn');
                if (prevBtn && !prevBtn.disabled) {
                    _currentPage--;
                    render(_allProducts);
                    _dom.product_list_container.scrollTop = 0;
                    return;
                }
                const nextBtn = event.target.closest('.next-page-btn');
                if (nextBtn && !nextBtn.disabled) {
                    _currentPage++;
                    render(_allProducts);
                    _dom.product_list_container.scrollTop = 0;
                    return;
                }

                _handleProductClick(event);
            });
            
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

                const editTagGroupBtn = event.target.closest('.edit-product-tag-group-btn');
                if (editTagGroupBtn && typeof config.openProductTagGroupEditModal === 'function') {
                    config.openProductTagGroupEditModal(editTagGroupBtn.dataset.productId);
                }

                const editCostPriceBtn = event.target.closest('.edit-product-cost-price-btn');
                if (editCostPriceBtn && typeof config.openProductCostPriceEditModal === 'function') {
                    config.openProductCostPriceEditModal(editCostPriceBtn.dataset.productId);
                }

                const editPriceBtn = event.target.closest('.edit-product-price-btn');
                if (editPriceBtn && typeof config.openProductPriceEditModal === 'function') {
                    config.openProductPriceEditModal(editPriceBtn.dataset.productId);
                }
            });
        }
    }



    function getSelectedProductCodigo() {
        if (!_activeProductId) return null;
        const product = _allProducts.find(p => String(p.id) === String(_activeProductId));
        return product ? product.codigo : null;
    }

    function updateStockDisplay(novoEstoque) {
        if (_activeProductId) {
            const product = _allProducts.find(p => String(p.id) === String(_activeProductId));
            if (product) product.estoque = novoEstoque;
        }

        if (!_dom.product_details) return;
        
        const estoqueContainer = _dom.product_details.querySelector('.product-detail-stock');
        if (estoqueContainer) {
            estoqueContainer.textContent = novoEstoque;
            estoqueContainer.classList.add('text-green-600', 'scale-110', 'transition-all', 'duration-300');
            setTimeout(() => {
                estoqueContainer.classList.remove('text-green-600', 'scale-110');
            }, 2000);
        }
    }

    function updateProductCostPriceDisplay(productId, novoPreco) {
        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) product.preco_de_custo = novoPreco;

        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const priceElement = _dom.product_details.querySelector('.product-detail-cost-price');
            if (priceElement) {
                const formattedPrice = novoPreco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                priceElement.textContent = formattedPrice;
                priceElement.classList.add('text-green-600', 'scale-110', 'transition-all', 'duration-300');
                setTimeout(() => priceElement.classList.remove('text-green-600', 'scale-110'), 2000);
            }
        }
    }

    function updateProductPriceDisplay(productId, novoPreco) {
        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) product.preco = novoPreco;

        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const priceElement = _dom.product_details.querySelector('.product-detail-price');
            if (priceElement) {
                const formattedPrice = novoPreco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                priceElement.textContent = formattedPrice;
                priceElement.classList.add('text-green-600', 'scale-110', 'transition-all', 'duration-300');
                setTimeout(() => priceElement.classList.remove('text-green-600', 'scale-110'), 2000);
            }
        }
    }

    function updateProductTagGroupDisplay(productId, novoGrupo) {
        const product = _allProducts.find(p => String(p.id) === String(productId));
        if (product) product.grupo_de_tags_tags = novoGrupo && novoGrupo !== 'N/A' ? [novoGrupo] : [];

        if (String(_activeProductId) === String(productId) && _dom.product_details) {
            const el = _dom.product_details.querySelector('.product-detail-tag-group');
            if (el) {
                el.textContent = novoGrupo || 'N/A';
                el.classList.add('text-green-600', 'scale-105', 'transition-all', 'duration-300');
                setTimeout(() => el.classList.remove('text-green-600', 'scale-105'), 2000);
            }
        }
    }

    function generateCatalog() {
        const virtualModal = document.getElementById('virtual-catalog-modal');
        if (virtualModal) {
            virtualModal.classList.remove('hidden');
            if (typeof PecasEquipamentoApp !== 'undefined') {
                PecasEquipamentoApp.init();
            }
        }
    }

    function setAllProducts(products) {
        if (Array.isArray(products)) {
            _allProducts = products;
            console.log(`[PesquisarProduto] ${products.length} produtos sincronizados.`);
        }
    }

    return {
        init,
        render,
        renderDetails: _renderProductDetails,
        getSelectedProductCodigo,
        getSelectedProductId,
        updateStockDisplay,
        updateProductNameDisplay,
        updateProductLocationDisplay,
        updateProductCodeDisplay,
        updateProductCostPriceDisplay,
        updateProductPriceDisplay,
        updateProductTagGroupDisplay,
        generateCatalog,
        setAllProducts,
        getAllProducts: () => _allProducts
    };
})();
