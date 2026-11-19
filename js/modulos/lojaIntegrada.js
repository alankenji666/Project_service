/**
 * lojaIntegrada.js
 *
 * Módulo para gerenciar a integração com a Loja Integrada.
 * Responsável por buscar e processar pedidos e produtos ativos vindos da API.
 */
export const LojaIntegradaApp = (function () {
    // --- VARIÁVEIS PRIVADAS ---
    let _apiUrls;
    let _allOrders = [];
    let _allProducts = [];

    // --- FUNÇÕES PRIVADAS ---

    /**
     * Busca os pedidos da Loja Integrada na API.
     */
    async function _fetchOrders() {
        try {
            console.log('[LojaIntegradaApp] Buscando pedidos...');
            const response = await fetch(`${_apiUrls.LOJA_INTEGRADA_ORDERS}?t=${new Date().getTime()}`, { mode: 'cors' });
            if (!response.ok) {
                throw new Error(`Erro na API de Pedidos Loja Integrada: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.status !== 'success' || !result.data) {
                throw new Error(`A resposta da API não foi bem-sucedida ou não continha dados: ${result.message || 'Formato inválido'}`);
            }
            console.log(`[LojaIntegradaApp] ${result.count} pedidos da Loja Integrada encontrados.`);
            _allOrders = result.data;
            return _allOrders;
        } catch (error) {
            console.error('[LojaIntegradaApp] Falha ao buscar pedidos:', error);
            // Retorna um array vazio em caso de erro para não quebrar a aplicação principal.
            return [];
        }
    }

    /**
     * Busca os produtos ativos da Loja Integrada diretamente na API.
     */
    async function _fetchProducts(forceRefresh = false) {
        try {
            console.log(`[LojaIntegradaApp] Buscando produtos ativos (forceRefresh=${forceRefresh})...`);
            const url = `${_apiUrls.LOJA_INTEGRADA_PRODUCTS}?forceRefresh=${forceRefresh}&t=${new Date().getTime()}`;
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) {
                throw new Error(`Erro na API de Produtos Loja Integrada: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.status !== 'success' || !result.data) {
                throw new Error(`A resposta da API de produtos não foi bem-sucedida: ${result.message || 'Formato inválido'}`);
            }
            console.log(`[LojaIntegradaApp] ${result.count} produtos ativos da Loja Integrada carregados.`);
            _allProducts = result.data;
            window._allLojaIntegradaProducts = _allProducts;
            return _allProducts;
        } catch (error) {
            console.error('[LojaIntegradaApp] Falha ao buscar produtos da Loja Integrada:', error);
            return _allProducts || [];
        }
    }

    // --- FUNÇÕES PÚBLICAS ---
    return {
        /**
         * Inicializa o módulo.
         * @param {object} config - Objeto de configuração.
         * @param {object} config.apiUrls - As URLs da API da aplicação.
         */
        init: function (config) {
            _apiUrls = config.apiUrls;
            console.log('[LojaIntegradaApp] Módulo inicializado.');
        },

        /**
         * Ponto de entrada para buscar e retornar os pedidos.
         * @returns {Promise<Array>} Uma promessa que resolve para a lista de pedidos.
         */
        fetchOrders: async function () {
            return await _fetchOrders();
        },

        /**
         * Retorna os pedidos atualmente em cache.
         * @returns {Array} Array de pedidos.
         */
        getOrders: function() {
            return _allOrders;
        },

        /**
         * Ponto de entrada para buscar e retornar os produtos ativos da Loja Integrada.
         * @param {boolean} forceRefresh - Se true, ignora o cache do servidor.
         * @returns {Promise<Array>} Uma promessa que resolve para a lista de produtos ativos.
         */
        fetchProducts: async function (forceRefresh = false) {
            return await _fetchProducts(forceRefresh);
        },

        /**
         * Retorna os produtos ativos da Loja Integrada atualmente em cache.
         * @returns {Array} Array de produtos ativos.
         */
        getProducts: function() {
            return _allProducts;
        }
    };
})();