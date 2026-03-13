/**
 * Roteador Express para gerenciar atualizações de estoque e, opcionalmente, status de pedidos.
 * Lida com a comunicação com a API do Bling e com o Google Sheets.
 */
const express = require('express');

// --- NOVA FUNÇÃO AUXILIAR ---
/**
 * Aguarda por um determinado número de milissegundos.
 * @param {number} ms - O tempo para aguardar em milissegundos.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tenta obter o token de acesso do Bling com lógica de repetição.
 * @param {object} axios - A instância do Axios.
 * @param {string} url - A URL do Google Apps Script para obter o token.
 * @param {number} retries - O número de tentativas.
 * @returns {Promise<string>} O token de acesso.
 */
async function getTokenWithRetry(axios, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[Token Retry] Tentativa ${i + 1} de ${retries} para obter o token...`);
            const tokenResponse = await axios.get(url);
            const accessToken = tokenResponse.data.access_token;
            if (accessToken) {
                console.log(`[Token Retry] Sucesso! Token obtido na tentativa ${i + 1}.`);
                return accessToken;
            }
        } catch (error) {
            // Verifica se é um erro de rede ou de servidor (como 502, 503)
            if (error.response && error.response.status >= 500) {
                console.warn(`[Token Retry] Tentativa ${i + 1} falhou com status ${error.response.status}. Tentando novamente em 2 segundos...`);
                if (i < retries - 1) { // Se não for a última tentativa, espera
                    await delay(2000);
                }
            } else {
                // Se for outro tipo de erro (ex: 404, 403), falha imediatamente
                throw error;
            }
        }
    }
    // Se todas as tentativas falharem
    throw new Error(`Não foi possível obter o token de acesso do Bling após ${retries} tentativas.`);
}


const createEstoqueRouter = (
    getSheetsClient, 
    axios, 
    APPS_SCRIPT_TOKEN_URL, 
    BLING_API_BASE_URL, 
    SPREADSHEET_ID_ESTOQUE, 
    SHEET_NAME_ESTOQUE,
    SPREADSHEET_ID_REQUISICAO_FABRICA,
    SHEET_NAME_REQUISICAO_FABRICA,
    SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS,
    SHEET_NAME_REQUISICAO_GERAL_TERCEIROS,
    // NOVOS PARÂMETROS PARA AS PLANILHAS DE SAÍDA (ADICIONADOS PELO INDEX.JS)
    SPREADSHEET_ID_SAIDA_FABRICA, 
    SHEET_NAME_SAIDA_FABRICA,
    SPREADSHEET_ID_SAIDA_GARANTIA,
    SHEET_NAME_SAIDA_GARANTIA
) => {
    const router = express.Router();

    // ID do depósito padrão
    const DEPOSITO_PADRAO_ID = 14887835380;
    
    /**
     * NORMALIZAÇÃO ROBUSTA: Remove acentos e deixa em minúsculas para comparação.
     */
    const normalizeString = (text) => {
        if (!text) return '';
        return text
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .toLowerCase()
            .trim();
    };

    /**
     * Função auxiliar para encontrar a linha do cabeçalho e os índices das colunas.
     */
    async function findHeaderInfo(sheets, spreadsheetId, sheetName, requiredHeaders) {
        console.log(`Buscando cabeçalhos [${requiredHeaders.join(', ')}] na planilha "${sheetName}"...`);
        const range = `${sheetName}!A1:Z20`;
        try {
            const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = response.data.values;
            if (rows) {
                // Normaliza os headers requeridos para comparação
                const normalizedRequiredHeaders = requiredHeaders.map(h => normalizeString(h));
                
                for (let i = 0; i < rows.length; i++) {
                    // Normaliza os headers lidos da planilha
                    const headers = rows[i].map(h => h ? normalizeString(h) : '');
                    
                    const hasAllHeaders = normalizedRequiredHeaders.every(rh => headers.includes(rh));
                    if (hasAllHeaders) {
                        console.log(`Cabeçalhos encontrados na linha ${i + 1}.`);
                        // Retorna os headers normalizados para uso posterior (índice 0 = primeira coluna, etc.)
                        return { rowIndex: i + 1, headers: headers }; 
                    }
                }
            }
            console.warn(`Nenhuma linha com os cabeçalhos [${requiredHeaders.join(', ')}] foi encontrada em "${sheetName}".`);
            return null;
        } catch (e) {
            console.error(`Erro CRÍTICO ao ler a planilha "${sheetName}" para encontrar cabeçalhos: ${e.message}`);
            return null;
        }
    }

    /**
     * Rota unificada para movimentação de estoque e atualização de status de pedido.
     */
    router.post('/update-stock', async (req, res, next) => {
        const { 
            produto, operacaoBling, quantidadeMovimento, quantidadeFinal, 
            tipoEntrada, observacoes, orderCode, newStatus, 
            requisitionType, codigoService, dataEntrega, diasCorridos 
        } = req.body;

        try {
            // --- LÓGICA DE VALIDAÇÃO ---
            const isStockUpdate = operacaoBling === 'B' || (typeof quantidadeMovimento !== 'undefined' && Number(quantidadeMovimento) > 0);
            const isStatusUpdate = orderCode && newStatus && requisitionType && codigoService;

            if (isStockUpdate && (!produto || !produto.id || !produto.codigo || !operacaoBling || typeof quantidadeFinal === 'undefined' || !tipoEntrada)) {
                const error = new Error("Payload inválido. Para atualizar o estoque, campos (produto.id, produto.codigo, operacaoBling, quantidadeFinal, tipoEntrada) são obrigatórios.");
                error.statusCode = 400;
                throw error;
            }
            
            if (isStockUpdate && !['E', 'S', 'B'].includes(operacaoBling)) {
                const error = new Error("Valor inválido para 'operacaoBling'. Use 'E', 'S' ou 'B'.");
                error.statusCode = 400;
                throw error;
            }
            
            if (!isStockUpdate && !isStatusUpdate) {
                const error = new Error("Payload inválido. Forneça dados de estoque (operação 'B' ou 'quantidadeMovimento' > 0) OU dados de status (orderCode, newStatus, requisitionType, codigoService).");
                error.statusCode = 400;
                throw error;
            }
            // --- FIM DA VALIDAÇÃO ---

            const sheets = await getSheetsClient();
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);
            let blingResponseData = null;
            
            // --- TAREFA 1: ATUALIZAR ESTOQUE (BLING + PLANILHA DE ESTOQUE) ---
            if (isStockUpdate) {
                console.log('Iniciando Tarefa 1: Atualização de Estoque...');
                
                let tipoMovimento;
                let quantidadeParaBling;

                if (operacaoBling === 'E') {
                    tipoMovimento = 'Entrada';
                    quantidadeParaBling = quantidadeMovimento;
                } else if (operacaoBling === 'S') {
                    tipoMovimento = 'Saída';
                    quantidadeParaBling = quantidadeMovimento;
                } else if (operacaoBling === 'B') {
                    tipoMovimento = 'Balanço';
                    quantidadeParaBling = quantidadeFinal; 
                }

                const observacaoBling = `${tipoMovimento} via App (${tipoEntrada}): ${observacoes || 'Lançamento automático.'}`;

                const blingPayload = {
                    produto: { id: produto.id, codigo: produto.codigo },
                    deposito: { id: DEPOSITO_PADRAO_ID },
                    operacao: operacaoBling,
                    quantidade: quantidadeParaBling, 
                    observacoes: observacaoBling
                };
                
                const blingUrl = `${BLING_API_BASE_URL}/estoques`;
                const blingResponse = await axios.post(blingUrl, blingPayload, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    validateStatus: (status) => status < 500
                });

                if (blingResponse.status >= 400) {
                    console.error("Erro na chamada da API do Bling:", blingResponse.data);
                    const error = new Error(blingResponse.data?.error?.message || 'Falha ao atualizar estoque no Bling.');
                    error.statusCode = blingResponse.status;
                    throw error;
                }
                
                blingResponseData = blingResponse.data; 

                // Note: O cabeçalho 'código' não tem acento, mas 'estoque' é compatível com a normalização
                const estoqueHeaderInfo = await findHeaderInfo(sheets, SPREADSHEET_ID_ESTOQUE, SHEET_NAME_ESTOQUE, ['código', 'estoque']);
                
                if (estoqueHeaderInfo) {
                    const { rowIndex: headerRowIndex, headers } = estoqueHeaderInfo;
                    const codigoCol = headers.indexOf(normalizeString('código'));
                    const estoqueCol = headers.indexOf(normalizeString('estoque'));
                    
                    const allDataRange = `${SHEET_NAME_ESTOQUE}!A${headerRowIndex + 1}:Z`;
                    const allDataResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID_ESTOQUE, range: allDataRange });
                    const estoqueRows = allDataResponse.data.values;

                    let rowIndexToUpdate = -1;
                    const codigoParaBuscar = normalizeString(produto.codigo); 
                    
                    if (estoqueRows) {
                        for (let i = 0; i < estoqueRows.length; i++) {
                            const sheetCode = normalizeString(estoqueRows[i][codigoCol]); 
                            if (sheetCode === codigoParaBuscar) {
                                rowIndexToUpdate = headerRowIndex + 1 + i;
                                break;
                            }
                        }
                    }

                    if (rowIndexToUpdate !== -1) {
                        const updateRange = `${SHEET_NAME_ESTOQUE}!${String.fromCharCode(65 + estoqueCol)}${rowIndexToUpdate}`;
                        await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID_ESTOQUE, range: updateRange, valueInputOption: 'RAW', resource: { values: [[quantidadeFinal]] }});
                        console.log(`[TAREFA 1 - ESTOQUE] SUCESSO: Planilha de estoque atualizada para ${quantidadeFinal}.`);
                    } else {
                        console.warn(`[TAREFA 1 - ESTOQUE] AVISO: Código "${codigoParaBuscar}" não foi encontrado na planilha de estoque.`);
                    }
                } else {
                    console.error(`[TAREFA 1 - ESTOQUE] ERRO CRÍTICO: Cabeçalho não encontrado na planilha de estoque.`);
                }
                console.log('Tarefa 1 concluída.');
            }


            // --- TAREFA 2: ATUALIZAR STATUS DO PEDIDO (OPCIONAL) ---
            if (isStatusUpdate) {
                console.log(`Iniciando Tarefa 2: Atualização de Status para o tipo: ${requisitionType}...`);
                let reqSheetId, reqSheetName;
                let headerCheck = [];
                
                if (requisitionType === 'saidas-garantia') {
                    reqSheetId = SPREADSHEET_ID_SAIDA_GARANTIA;
                    reqSheetName = SHEET_NAME_SAIDA_GARANTIA;
                    headerCheck = ['Requisição', 'Codigo Service', 'Situação']; 
                } else if (requisitionType === 'saidas-fabrica') {
                    reqSheetId = SPREADSHEET_ID_SAIDA_FABRICA;
                    reqSheetName = SHEET_NAME_SAIDA_FABRICA;
                    headerCheck = ['Requisição', 'Codigo Service', 'Situação'];
                } else if (requisitionType === 'fabrica') {
                    reqSheetId = SPREADSHEET_ID_REQUISICAO_FABRICA;
                    reqSheetName = SHEET_NAME_REQUISICAO_FABRICA;
                    headerCheck = ['requisição', 'codigo service', 'situação'];
                } else if (requisitionType === 'terceiros') {
                    reqSheetId = SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS;
                    reqSheetName = SHEET_NAME_REQUISICAO_GERAL_TERCEIROS;
                    headerCheck = ['requisição', 'codigo service', 'situação']; 
                } else {
                     console.warn(`Tipo de requisição "${requisitionType}" não mapeado para planilhas. Pulando atualização de status.`);
                }
                
                if (reqSheetId) {
                    const reqHeaderInfo = await findHeaderInfo(sheets, reqSheetId, reqSheetName, headerCheck);
                    
                    if (reqHeaderInfo) {
                        const { rowIndex: headerRowIndex, headers } = reqHeaderInfo;
                        const orderCodeCol = headers.indexOf(normalizeString('requisição')); 
                        const itemCodeCol = headers.indexOf(normalizeString('codigo service'));
                        const statusCol = headers.indexOf(normalizeString('situação'));
                        const deliveryDateCol = headers.indexOf(normalizeString('data entrega')); 
                        const diasCorridosCol = headers.indexOf(normalizeString('dias corridos')); 
                        
                        if (orderCodeCol === -1 || itemCodeCol === -1 || statusCol === -1) {
                             console.error(`[TAREFA 2 - ERRO] Colunas essenciais não encontradas em ${reqSheetName} após normalização.`);
                        } else {
                            const allDataRange = `${reqSheetName}!A${headerRowIndex + 1}:Z`;
                            const allDataResponse = await sheets.spreadsheets.values.get({ spreadsheetId: reqSheetId, range: allDataRange });
                            const reqRows = allDataResponse.data.values;

                            let rowIndexToUpdate = -1;
                            const orderCodeToFind = normalizeString(orderCode);
                            const itemCodeToFind = normalizeString(codigoService);
                            
                            if (reqRows) {
                                for (let i = 0; i < reqRows.length; i++) {
                                    const row = reqRows[i];
                                    const sheetOrderCode = normalizeString(row[orderCodeCol]);
                                    const sheetItemCode = normalizeString(row[itemCodeCol]);
                                    const currentStatus = normalizeString(row[statusCol]).toUpperCase(); 
                                    
                                    if (sheetOrderCode === orderCodeToFind && sheetItemCode === itemCodeToFind) {
                                        if (currentStatus === 'PENDENTE') {
                                            rowIndexToUpdate = headerRowIndex + 1 + i;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (rowIndexToUpdate !== -1) {
                                const updates = [];
                                const statusRange = `${reqSheetName}!${String.fromCharCode(65 + statusCol)}${rowIndexToUpdate}`;
                                updates.push(sheets.spreadsheets.values.update({ spreadsheetId: reqSheetId, range: statusRange, valueInputOption: 'RAW', resource: { values: [[newStatus]] }}));

                                if (newStatus.toLowerCase() === 'ok' && deliveryDateCol !== -1) {
                                    const dateRange = `${reqSheetName}!${String.fromCharCode(65 + deliveryDateCol)}${rowIndexToUpdate}`;
                                    const finalDate = dataEntrega || new Date().toLocaleDateString('pt-BR');
                                    updates.push(sheets.spreadsheets.values.update({ spreadsheetId: reqSheetId, range: dateRange, valueInputOption: 'RAW', resource: { values: [[finalDate]] }}));
                                }
                                
                                if (diasCorridosCol !== -1 && diasCorridos) {
                                    const diasRange = `${reqSheetName}!${String.fromCharCode(65 + diasCorridosCol)}${rowIndexToUpdate}`;
                                    updates.push(sheets.spreadsheets.values.update({ spreadsheetId: reqSheetId, range: diasRange, valueInputOption: 'RAW', resource: { values: [[diasCorridos]] }}));
                                }
                                
                                await Promise.all(updates);
                            } else {
                                console.warn(`[TAREFA 2 - REQUISIÇÃO] AVISO: Item PENDENTE não encontrado para Req: ${orderCodeToFind} / Cód: ${itemCodeToFind} em "${reqSheetName}".`);
                            }
                        }
                    }
                }
            }
            
            res.status(200).send({
                status: 'success',
                message: 'Operação concluída com sucesso.',
                blingResponse: blingResponseData,
            });

        } catch (error) {
            next(error);
        }
    });

    router.get('/depositos', async (req, res, next) => {
        try {
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);
            const blingUrl = `${BLING_API_BASE_URL}/depositos`;
            const blingResponse = await axios.get(blingUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            
            const depositos = blingResponse.data.data.map(d => ({ id: d.id, descricao: d.descricao }));
            res.status(200).send({ status: 'success', data: depositos });
        } catch (error) {
            next(error);
        }
    });

    router.get('/find-product-id', async (req, res, next) => {
        const { codigo } = req.query;
        if (!codigo) {
            const error = new Error("O parâmetro 'codigo' é obrigatório.");
            error.statusCode = 400;
            return next(error);
        }

        try {
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);
            const blingUrl = `${BLING_API_BASE_URL}/produtos?codigo=${codigo}`;
            const blingResponse = await axios.get(blingUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });

            if (blingResponse.data.data && blingResponse.data.data.length > 0) {
                const produto = blingResponse.data.data[0];
                res.status(200).send({ status: 'success', data: { id: produto.id, codigo: produto.codigo } });
            } else {
                const error = new Error(`Produto com código "${codigo}" não encontrado.`);
                error.statusCode = 404;
                throw error;
            }
        } catch (error) {
            next(error);
        }
    });

    return router;
};

module.exports = createEstoqueRouter;