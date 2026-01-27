// js/modulos/saidaItens.js

export const SaidaItens = (function() {
    // --- Variáveis de Estado e Configuração Privadas ---
    let _allProducts = [];
    let _allSaidasGarantia = [];
    let _allSaidasFabrica = [];
    let _selectedSaidaItems = new Set();
    let _saidaReportQuantities = new Map();

    let _saidaState = {
        currentPage: 1,
        itemsPerPage: 15,
        sortColumn: 'descricao',
        sortDirection: 'asc'
    };
    let _saidaReportState = {
        sortColumn: 'descricao',
        sortDirection: 'asc'
    };

    let _dom = {};
    let _utils = {};
    let _apiUrls = {};

    // --- Funções Privadas ---

    function _renderSaidaSortIcon(column) {
        if (_saidaState.sortColumn !== column) return '';
        return _saidaState.sortDirection === 'asc' ? '▲' : '▼';
    }

    function _toggleSaidaSelection(productId, isChecked) {
        if (isChecked) {
            _selectedSaidaItems.add(productId);
        } else {
            _selectedSaidaItems.delete(productId);
        }
        updateSelectedCountDisplay();
    }

    function _updateSaidaReportQuantity(productId, newQuantity) {
        const parsedQuantity = parseInt(newQuantity, 10);
        if (!isNaN(parsedQuantity) && parsedQuantity >= 0) {
            _saidaReportQuantities.set(productId, parsedQuantity);
        } else {
            _saidaReportQuantities.set(productId, 0);
        }
        _updateSaidaReportActionButtonsState();
    }

    function _updateSaidaReportActionButtonsState() {
        const hasItems = Array.from(_saidaReportQuantities.values()).some(qty => qty > 0);
        if (_dom.launchSaidaGarantiaBtn) _dom.launchSaidaGarantiaBtn.disabled = !hasItems;
        if (_dom.launchSaidaFabricaBtn) _dom.launchSaidaFabricaBtn.disabled = !hasItems;
    }

            async function _handleLaunchSaida(type) {
            const itemsToLaunch = Array.from(_saidaReportQuantities.entries())
                .filter(([productId, qty]) => qty > 0)
                .map(([productId, qty]) => {
                    const product = _allProducts.find(p => p.id === productId);
                    return { product, quantity: qty };
                });

            if (itemsToLaunch.length === 0) {
                _utils.showMessageModal("Nenhum Item", "Por favor, defina a quantidade para ao menos um item.");
                return false; // Adicionado retorno
            }

            const itemsWithInsufficientStock = itemsToLaunch
                .filter(item => item.quantity > item.product.estoque)
                .map(item => item.product.descricao);

            if (itemsWithInsufficientStock.length > 0) {
                const confirmationMessage = `
                 <p class="mb-2">Os seguintes itens têm quantidade de saída maior que o estoque:</p>
                 <ul class="list-disc list-inside text-left mb-4">${itemsWithInsufficientStock.map(name => `<li>${name}</li>`).join('')}</ul>
                 <p>Deseja continuar mesmo assim?</p>`;
                const confirmed = await _utils.showConfirmationModal("Estoque Insuficiente", confirmationMessage);
                if (!confirmed) return false; // Adicionado retorno
            }

            const apiUrl = type === 'garantia' ? _apiUrls.SAIDA_GARANTIA_LAUNCH : _apiUrls.SAIDA_FABRICA_LAUNCH;
            const today = new Date();
            const ddmmaa = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;
            const todayStr = today.toLocaleDateString('pt-BR');
            const saidasTodayCodes = new Set(
                [..._allSaidasFabrica, ..._allSaidasGarantia]
                    .filter(s => {
                        const parsedDate = _utils.parsePtBrDate(s.dataPedido);
                        return parsedDate && parsedDate.toLocaleDateString('pt-BR') === todayStr;
                    })
                    .map(s => s.orderCode)
            );
            const nextSequence = saidasTodayCodes.size + 1;
            const requisitionCode = `${ddmmaa}-${nextSequence}`;

            const confirmationMessage = `
               <p>Confirmar o lançamento de <b>${itemsToLaunch.length}</b> itens para <b>${type.charAt(0).toUpperCase() + type.slice(1)}</b>?</p>
               <p class="mt-2">Será gerada a requisição de saída: <b>${requisitionCode}</b>.</p>
               <div class="mt-4 text-left">
                   <label for="saida-responsavel-input" class="block text-sm font-medium text-gray-700">Responsável:</label>
                   <input type="text" id="saida-responsavel-input" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Nome do responsável">
               </div>
           `;
            const confirmed = await _utils.showConfirmationModal("Confirmar Lançamento de Saída", confirmationMessage);
            if (!confirmed) return false; // Adicionado retorno

            const responsavel = document.getElementById('saida-responsavel-input')?.value.trim() || '';
            if (!responsavel) {
                _utils.showMessageModal("Campo Obrigatório", "Por favor, preencha o nome do responsável.");
                return false; // Adicionado retorno
            }

            const todayForPayload = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            const payloadData = itemsToLaunch.map(item => ({
                requisicao: requisitionCode, codigo_service: item.product.codigo || '', codigo_mks_equipamentos: '',
                descricao: item.product.descricao || '', localizacao: item.product.localizacao || '', quantidade: item.quantity,
                situacao: 'Pendente', data_pedido: todayForPayload, data_envio: '', observacao: [], responsavel: responsavel
            }));

            _utils.toggleLoading(true);
            try {
                const response = await fetch(apiUrl, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payloadData }) });
                if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro na API (Status: ${response.status}): ${errorText}`); }
                await response.json(); // Apenas consome a resposta, já que o processamento será local
    
                // *** INÍCIO DAS ALTERAÇÕES PRINCIPAIS ***

                // 1. Criar o novo objeto de saída localmente
                const newSaida = {
                    orderCode: requisitionCode, dataPedido: payloadData[0].data_pedido, totalItems: payloadData.length, totalAtendido: 0, totalPendente: payloadData.length,
                    rawItems: payloadData.map(item => ({
                        orderCode: item.requisicao, codigoService: item.codigo_service, descricao: item.descricao, localizacao: item.localizacao, quantidadePedido: item.quantidade, situacao: 'pendente', dataPedido: item.data_pedido, dataConclusao: null, observacao: [], responsavel: item.responsavel, requisitionType: type === 'garantia' ? 'saidas-garantia' : 'saidas-fabrica'
                    }))
                };
                
                // 2. Adicionar o novo objeto à lista correta
                if(type === 'garantia') _allSaidasGarantia.push(newSaida); else _allSaidasFabrica.push(newSaida);
    
                // 3. Debitar o estoque dos produtos na lista local
                itemsToLaunch.forEach(item => {
                    if (item.product) {
                        const currentStock = parseFloat(String(item.product.estoque || '0').replace(',', '.')) || 0;
                        const quantityToDebit = parseFloat(String(item.quantity || '0').replace(',', '.')) || 0;
                        item.product.estoque = currentStock - quantityToDebit;
                    }
                });
    
                // 4. Exibir mensagem de sucesso e limpar a seleção
                _utils.showMessageModal("Sucesso!", `Saída para ${type} lançada com a requisição <b>${requisitionCode}</b>.`);
                clearSelection(); 
                _saidaReportQuantities.clear();
                
                // 5. Mudar para a página de diagnóstico, que será automaticamente atualizada.
                _utils.showPage('overview-saidas');
                
                return true; // Retorna sucesso
                
                // *** FIM DAS ALTERAÇÕES PRINCIPAIS ***

            } catch (error) { 
                _utils.showMessageModal("Erro no Lançamento", `Falha ao lançar saída: ${error.message}.`);
                return false; // Retorna falha
            } finally { 
                _utils.toggleLoading(false);
            }
        }
        async function _handleLaunchSaida(type) {
            const itemsToLaunch = Array.from(_saidaReportQuantities.entries())
                .filter(([productId, qty]) => qty > 0)
                .map(([productId, qty]) => {
                    const product = _allProducts.find(p => p.id === productId);
                    return { product, quantity: qty };
                });

            if (itemsToLaunch.length === 0) {
                _utils.showMessageModal("Nenhum Item", "Por favor, defina a quantidade para ao menos um item.");
                return false; // Adicionado retorno
            }

            const itemsWithInsufficientStock = itemsToLaunch
                .filter(item => item.quantity > item.product.estoque)
                .map(item => item.product.descricao);

            if (itemsWithInsufficientStock.length > 0) {
                const confirmationMessage = `
                 <p class="mb-2">Os seguintes itens têm quantidade de saída maior que o estoque:</p>
                 <ul class="list-disc list-inside text-left mb-4">${itemsWithInsufficientStock.map(name => `<li>${name}</li>`).join('')}</ul>
                 <p>Deseja continuar mesmo assim?</p>`;
                const confirmed = await _utils.showConfirmationModal("Estoque Insuficiente", confirmationMessage);
                if (!confirmed) return false; // Adicionado retorno
            }

            const apiUrl = type === 'garantia' ? _apiUrls.SAIDA_GARANTIA_LAUNCH : _apiUrls.SAIDA_FABRICA_LAUNCH;
            const today = new Date();
            const ddmmaa = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;
            const todayStr = today.toLocaleDateString('pt-BR');
            const saidasTodayCodes = new Set(
                [..._allSaidasFabrica, ..._allSaidasGarantia]
                    .filter(s => {
                        const parsedDate = _utils.parsePtBrDate(s.dataPedido);
                        return parsedDate && parsedDate.toLocaleDateString('pt-BR') === todayStr;
                    })
                    .map(s => s.orderCode)
            );
            const nextSequence = saidasTodayCodes.size + 1;
            const requisitionCode = `${ddmmaa}-${nextSequence}`;

            const confirmationMessage = `
               <p>Confirmar o lançamento de <b>${itemsToLaunch.length}</b> itens para <b>${type.charAt(0).toUpperCase() + type.slice(1)}</b>?</p>
               <p class="mt-2">Será gerada a requisição de saída: <b>${requisitionCode}</b>.</p>
               <div class="mt-4 text-left">
                   <label for="saida-responsavel-input" class="block text-sm font-medium text-gray-700">Responsável:</label>
                   <input type="text" id="saida-responsavel-input" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Nome do responsável">
               </div>
           `;
            const confirmed = await _utils.showConfirmationModal("Confirmar Lançamento de Saída", confirmationMessage);
            if (!confirmed) return false; // Adicionado retorno

            const responsavel = document.getElementById('saida-responsavel-input')?.value.trim() || '';
            if (!responsavel) {
                _utils.showMessageModal("Campo Obrigatório", "Por favor, preencha o nome do responsável.");
                return false; // Adicionado retorno
            }

            const todayForPayload = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            const payloadData = itemsToLaunch.map(item => ({
                requisicao: requisitionCode, codigo_service: item.product.codigo || '', codigo_mks_equipamentos: '',
                descricao: item.product.descricao || '', localizacao: item.product.localizacao || '', quantidade: item.quantity,
                situacao: 'Pendente', data_pedido: todayForPayload, data_envio: '', observacao: [], responsavel: responsavel
            }));

            _utils.toggleLoading(true);
            try {
                const response = await fetch(apiUrl, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payloadData }) });
                if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro na API (Status: ${response.status}): ${errorText}`); }
                await response.json(); // Apenas consome a resposta, já que o processamento será local
    
                // *** INÍCIO DAS ALTERAÇÕES PRINCIPAIS ***

                // 1. Criar o novo objeto de saída localmente
                const newSaida = {
                    orderCode: requisitionCode, dataPedido: payloadData[0].data_pedido, totalItems: payloadData.length, totalAtendido: 0, totalPendente: payloadData.length,
                    rawItems: payloadData.map(item => ({
                        orderCode: item.requisicao, codigoService: item.codigo_service, descricao: item.descricao, localizacao: item.localizacao, quantidadePedido: item.quantidade, situacao: 'pendente', dataPedido: item.data_pedido, dataConclusao: null, observacao: [], responsavel: item.responsavel, requisitionType: type === 'garantia' ? 'saidas-garantia' : 'saidas-fabrica'
                    }))
                };
                
                // 2. Adicionar o novo objeto à lista correta
                if(type === 'garantia') _allSaidasGarantia.push(newSaida); else _allSaidasFabrica.push(newSaida);
    
                // 3. Debitar o estoque dos produtos na lista local
                itemsToLaunch.forEach(item => {
                    if (item.product) {
                        const currentStock = parseFloat(String(item.product.estoque || '0').replace(',', '.')) || 0;
                        const quantityToDebit = parseFloat(String(item.quantity || '0').replace(',', '.')) || 0;
                        item.product.estoque = currentStock - quantityToDebit;
                    }
                });
    
                // 4. Exibir mensagem de sucesso e limpar a seleção
                _utils.showMessageModal("Sucesso!", `Saída para ${type} lançada com a requisição <b>${requisitionCode}</b>.`);
                clearSelection(); 
                _saidaReportQuantities.clear();
                
                // 5. Mudar para a página de diagnóstico, que será automaticamente atualizada.
                _utils.showPage('overview-saidas');
                
                return true; // Retorna sucesso
                
                // *** FIM DAS ALTERAÇÕES PRINCIPAIS ***

            } catch (error) { 
                _utils.showMessageModal("Erro no Lançamento", `Falha ao lançar saída: ${error.message}.`);
                return false; // Retorna falha
            } finally { 
                _utils.toggleLoading(false);
            }
        }


    // --- Funções Públicas ---

    function init(config) {
        _allProducts = config.allProducts;
        _allSaidasGarantia = config.allSaidasGarantia;
        _allSaidasFabrica = config.allSaidasFabrica;
        _selectedSaidaItems = config.selectedSaidaItems;
        _saidaReportQuantities = config.saidaReportQuantities;
        _dom = config.dom;
        _utils = config.utils;
        _apiUrls = config.apiUrls;
    }

    function render(productsToRender) {
        if (!_dom.pageGerenciarSaida || !productsToRender) return;

        productsToRender.sort((a, b) => {
            const sortKey = _saidaState.sortColumn;
            const valA = a[sortKey];
            const valB = b[sortKey];
            let comparison = 0;
            if (['estoque'].includes(sortKey)) {
                comparison = (parseFloat(valA) || 0) - (parseFloat(valB) || 0);
            } else {
                comparison = String(valA || '').localeCompare(String(valB || ''), 'pt-BR', { numeric: true });
            }
            return _saidaState.sortDirection === 'asc' ? comparison : -comparison;
        });

        const totalItems = productsToRender.length;
        const totalPages = Math.ceil(totalItems / _saidaState.itemsPerPage);
        _saidaState.currentPage = Math.min(_saidaState.currentPage, totalPages) || 1;
        const startIndex = (_saidaState.currentPage - 1) * _saidaState.itemsPerPage;
        const endIndex = startIndex + _saidaState.itemsPerPage;
        const paginatedProducts = productsToRender.slice(startIndex, endIndex);
        
        let html = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Gerenciar Saída de Produtos</h1>
        </div>
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 read-only-disable"><tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">&nbsp;</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sortable-header" data-sort="descricao">
                        <div class="flex items-center">Produto ${_renderSaidaSortIcon('descricao')}</div>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sortable-header" data-sort="estoque">
                        <div class="flex items-center justify-center">Estoque Atual ${_renderSaidaSortIcon('estoque')}</div>
                    </th>
                </tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">`;

        if (paginatedProducts.length === 0) {
            html += `<tr><td colspan="3" class="text-center py-8 text-gray-500">Nenhum item encontrado.</td></tr>`;
        } else {
            paginatedProducts.forEach(p => {
                const isChecked = _selectedSaidaItems.has(p.id) ? 'checked' : '';
                const imageUrl = p.url_imagens_externas?.[0] || 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
                html += `<tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" class="saida-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-product-id="${p.id}" ${isChecked}>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <img src="${imageUrl}" alt="${p.descricao || 'Imagem do produto'}" class="product-list-item-img" data-image-url="${imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/e2e8f0/64748b?text=?';">
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">${p.descricao}</div>
                                <div class="text-sm text-gray-500">${p.codigo}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-800">${p.estoque ?? 0}</td>
                </tr>`;
            });
        }
        html += `</tbody></table></div>
        <div class="flex items-center justify-between mt-4">
            <button id="prev-saida-page-btn" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
            <span class="text-sm text-gray-700">Página ${_saidaState.currentPage} de ${totalPages || 1}</span>
            <button id="next-saida-page-btn" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Próximo</button>
        </div>`;
        
        _dom.pageGerenciarSaida.innerHTML = html;

        _dom.pageGerenciarSaida.querySelectorAll('.sortable-header').forEach(header => header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (_saidaState.sortColumn === sortKey) _saidaState.sortDirection = _saidaState.sortDirection === 'asc' ? 'desc' : 'asc';
            else { _saidaState.sortColumn = sortKey; _saidaState.sortDirection = 'asc'; }
            _utils.applyGlobalFilters();
        }));
        _dom.pageGerenciarSaida.querySelectorAll('.saida-checkbox').forEach(cb => cb.addEventListener('change', (e) => _toggleSaidaSelection(e.target.dataset.productId, e.target.checked)));

        const prevBtn = _dom.pageGerenciarSaida.querySelector('#prev-saida-page-btn');
        const nextBtn = _dom.pageGerenciarSaida.querySelector('#next-saida-page-btn');
        if (prevBtn) {
            prevBtn.disabled = _saidaState.currentPage === 1;
            prevBtn.addEventListener('click', () => { if (_saidaState.currentPage > 1) { _saidaState.currentPage--; _utils.applyGlobalFilters(); } });
        }
        if (nextBtn) {
            nextBtn.disabled = _saidaState.currentPage === totalPages || totalPages === 0;
            nextBtn.addEventListener('click', () => { if (_saidaState.currentPage < totalPages) { _saidaState.currentPage++; _utils.applyGlobalFilters(); } });
        }
         _dom.pageGerenciarSaida.addEventListener('mouseover', _utils.showProductTooltip);
        _dom.pageGerenciarSaida.addEventListener('mouseout', _utils.hideProductTooltip);
    }

    function generateReport() {
        if (_selectedSaidaItems.size === 0) {
            if (_dom.pageSaidaReport) {
                _dom.pageSaidaReport.innerHTML = `
                <div class="text-center py-20">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
                    <h2 class="mt-2 text-xl font-medium text-gray-700">Nenhum Item para Saída</h2>
                    <p class="mt-2 text-gray-500">
                        Para selecionar itens, <a href="#" id="redirect-to-saida-page" class="text-blue-600 hover:underline font-semibold">Clique Aqui</a>.
                    </p>
                </div>
            `;
                const redirectLink = _dom.pageSaidaReport.querySelector('#redirect-to-saida-page');
                if (redirectLink) {
                    redirectLink.addEventListener('click', (e) => { e.preventDefault(); _utils.showPage('gerenciar-saida'); });
                }
            }
             _utils.showPage('saida-report');
            return;
        }
        const selectedProducts = _allProducts.filter(p => _selectedSaidaItems.has(p.id));

        selectedProducts.sort((a, b) => {
            const sortKey = _saidaReportState.sortColumn;
            const comparison = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'pt-BR', { numeric: true });
            return _saidaReportState.sortDirection === 'asc' ? comparison : -comparison;
        });

        selectedProducts.forEach(p => {
            if (!_saidaReportQuantities.has(p.id)) {
                _saidaReportQuantities.set(p.id, 1);
            }
        });

        _saidaReportQuantities.forEach((value, key) => {
            if (!_selectedSaidaItems.has(key)) _saidaReportQuantities.delete(key);
        });

        let reportContentHtml = `
        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Criar Saída de Estoque</h1>
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-full">Produto</th>
                        <th scope="col" class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                        <th scope="col" class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd. Saída</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
        `;
        selectedProducts.forEach(p => {
            const currentQuantity = _saidaReportQuantities.get(p.id) || 0;
            const imageUrl = p.url_imagens_externas?.[0] || 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
            reportContentHtml += `
            <tr data-product-id="${p.id}">
                <td class="px-4 py-2 whitespace-nowrap text-center text-xs font-medium">
                    <button class="remove-saida-item-btn text-red-600 hover:text-red-800 p-1 rounded-full" title="Remover item" data-product-id="${p.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                </td>
                <td class="px-4 py-2 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="${imageUrl}" alt="${p.descricao || 'Imagem do produto'}" class="product-list-item-img" data-image-url="${imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/e2e8f0/64748b?text=?';">
                        <div class="ml-4">
                            <div class="text-xs font-medium text-gray-900">${p.descricao}</div>
                            <div class="text-xs text-gray-500">${p.codigo}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-center text-xs font-bold text-gray-800">${p.estoque ?? 0}</td>
                <td class="px-4 py-2 whitespace-nowrap text-center text-xs font-medium">
                    <input type="number" value="${currentQuantity}" data-product-id="${p.id}" class="w-20 px-2 py-1 border border-gray-300 rounded-md text-center text-xs saida-report-quantity-input" min="0">
                </td>
            </tr>
        `;
        });
        reportContentHtml += `</tbody></table></div>`;

        if (_dom.pageSaidaReport) _dom.pageSaidaReport.innerHTML = reportContentHtml;
        _utils.showPage('saida-report');

        _updateSaidaReportActionButtonsState();

        _dom.pageSaidaReport.querySelectorAll('.remove-saida-item-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const productIdToRemove = event.currentTarget.dataset.productId;
                _selectedSaidaItems.delete(productIdToRemove);
                _saidaReportQuantities.delete(productIdToRemove);
                generateReport();
                updateSelectedCountDisplay();
            });
        });
        _dom.pageSaidaReport.querySelectorAll('.saida-report-quantity-input').forEach(input => {
            input.addEventListener('input', (event) => {
                _updateSaidaReportQuantity(event.target.dataset.productId, event.target.value);
            });
        });
    }

    function clearSelection() {
        _selectedSaidaItems.clear();
        updateSelectedCountDisplay();
        _utils.applyGlobalFilters();
    }

    function updateSelectedCountDisplay() {
        if (_dom.selectedSaidaItemsCount) {
            _dom.selectedSaidaItemsCount.textContent = `Itens selecionados: ${_selectedSaidaItems.size}`;
        }
        if (_dom.createSaidaBtn) {
            _dom.createSaidaBtn.disabled = _selectedSaidaItems.size === 0;
        }
        if (_dom.clearSaidaSelectionBtn) {
            _dom.clearSaidaSelectionBtn.classList.toggle('hidden', _selectedSaidaItems.size === 0);
        }
    }

    return {
        init: init,
        render: render,
        generateReport: generateReport,
        clearSelection: clearSelection,
        updateSelectedCountDisplay: updateSelectedCountDisplay,
        handleLaunchSaida: _handleLaunchSaida
    };
})();
""