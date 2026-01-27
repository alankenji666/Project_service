/**
 * lojaIntegrada.js
 *
 * Módulo para gerenciar a integração com os pedidos da Loja Integrada.
 * Responsável por buscar e processar os dados vindos da API.
 */
export const LojaIntegradaApp = (function () {
    // --- VARIÁVEIS PRIVADAS ---
    let _apiUrls;
    let _allOrders = [];

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
         * Ponto de entrada para buscar e retornar os dados.
         * @returns {Promise<Array>} Uma promessa que resolve para a lista de pedidos.
         */
        fetchOrders: async function () {
            return await _fetchOrders();
        }
    };
})();