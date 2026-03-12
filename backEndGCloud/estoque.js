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
    router.post('/update-stock', async (req, res) => {
        const { 
            produto, operacaoBling, quantidadeMovimento, quantidadeFinal, 
            tipoEntrada, observacoes, orderCode, newStatus, 
            requisitionType, codigoService, dataEntrega, diasCorridos 
        } = req.body;

        // --- LÓGICA DE VALIDAÇÃO ---
        const isStockUpdate = operacaoBling === 'B' || (typeof quantidadeMovimento !== 'undefined' && Number(quantidadeMovimento) > 0);
        const isStatusUpdate = orderCode && newStatus && requisitionType && codigoService;

        if (isStockUpdate && (!produto || !produto.id || !produto.codigo || !operacaoBling || typeof quantidadeFinal === 'undefined' || !tipoEntrada)) {
             return res.status(400).send({ status: 'error', message: "Payload inválido. Para atualizar o estoque, campos (produto.id, produto.codigo, operacaoBling, quantidadeFinal, tipoEntrada) são obrigatórios."});
        }
        
        if (isStockUpdate && !['E', 'S', 'B'].includes(operacaoBling)) {
            return res.status(400).send({ status: 'error', message: "Valor inválido para 'operacaoBling'. Use 'E', 'S' ou 'B'."});
        }
        
        if (!isStockUpdate && !isStatusUpdate) {
            return res.status(400).send({ 
                status: 'error', 
                message: "Payload inválido. Forneça dados de estoque (operação 'B' ou 'quantidadeMovimento' > 0) OU dados de status (orderCode, newStatus, requisitionType, codigoService)."
            });
        }
        // --- FIM DA VALIDAÇÃO ---

        let sheets;
        let blingResponseData = null;
        try {
            sheets = await getSheetsClient();
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);
            
            
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
                    throw { response: blingResponse };
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
            } else {
                console.log('Pulando Tarefa 1: Atualização de Estoque.');
            }


            // --- TAREFA 2: ATUALIZAR STATUS DO PEDIDO (OPCIONAL) ---
            if (isStatusUpdate) {
                console.log(`Iniciando Tarefa 2: Atualização de Status para o tipo: ${requisitionType}...`);
                let reqSheetId, reqSheetName;
                
                // Define os nomes dos cabeçalhos requeridos.
                // Usamos as strings com acento para compatibilidade máxima com a planilha,
                // mas a função findHeaderInfo os normalizará para a comparação.
                let headerCheck = [];
                
                // Mapeamento das planilhas de destino
                if (requisitionType === 'saidas-garantia') {
                    reqSheetId = SPREADSHEET_ID_SAIDA_GARANTIA;
                    reqSheetName = SHEET_NAME_SAIDA_GARANTIA;
                    // O cabeçalho na planilha de Garantia (imagem) usa acento/cedilha.
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
                     console.warn(`Tipo de requisição "${requisitionType}" inválido. Pulando Tarefa 2.`);
                     return res.status(200).send({ 
                         status: 'success_with_warning', 
                         message: 'Operação de estoque concluída, mas o tipo de requisição para atualização de status não foi reconhecido.', 
                         blingResponse: blingResponseData 
                     });
                }
                
                const reqHeaderInfo = await findHeaderInfo(sheets, reqSheetId, reqSheetName, headerCheck);
                
                if (reqHeaderInfo) {
                    const { rowIndex: headerRowIndex, headers } = reqHeaderInfo;
                    
                    // Os headers (índices) são obtidos procurando pelo nome normalizado.
                    const orderCodeCol = headers.indexOf(normalizeString('requisição')); 
                    const itemCodeCol = headers.indexOf(normalizeString('codigo service'));
                    const statusCol = headers.indexOf(normalizeString('situação'));
                    const deliveryDateCol = headers.indexOf(normalizeString('data entrega')); 
                    const diasCorridosCol = headers.indexOf(normalizeString('dias corridos')); 
                    
                    if (orderCodeCol === -1 || itemCodeCol === -1 || statusCol === -1) {
                         // Se cair aqui, a normalização dos headers da planilha não bateu com o esperado.
                         console.error(`[TAREFA 2 - ERRO] Colunas essenciais não encontradas em ${reqSheetName} após normalização.`);
                    } else {
                        const allDataRange = `${reqSheetName}!A${headerRowIndex + 1}:Z`;
                        const allDataResponse = await sheets.spreadsheets.values.get({ spreadsheetId: reqSheetId, range: allDataRange });
                        const reqRows = allDataResponse.data.values;

                        let rowIndexToUpdate = -1;
                        // Normaliza os dados do payload para a busca
                        const orderCodeToFind = normalizeString(orderCode);
                        const itemCodeToFind = normalizeString(codigoService);
                        
                        console.log(`[TAREFA 2 - REQUISIÇÃO] Buscando por Req (Norm): "${orderCodeToFind}" e Código (Norm): "${itemCodeToFind}"`);
                        
                        if (reqRows) {
                            for (let i = 0; i < reqRows.length; i++) {
                                const row = reqRows[i];
                                
                                // NORMALIZAÇÃO ROBUSTA para comparação da linha
                                // Usamos o índice da coluna diretamente na linha de dados (row)
                                const sheetOrderCode = normalizeString(row[orderCodeCol]);
                                const sheetItemCode = normalizeString(row[itemCodeCol]);
                                
                                // NORMALIZAÇÃO ROBUSTA para o Status
                                const currentStatus = normalizeString(row[statusCol]).toUpperCase(); 
                                
                                // Checagem: Encontra a linha que corresponde e que está PENDENTE
                                if (sheetOrderCode === orderCodeToFind && sheetItemCode === itemCodeToFind) {
                                    if (currentStatus === 'PENDENTE') {
                                        rowIndexToUpdate = headerRowIndex + 1 + i;
                                        console.log(`[TAREFA 2 - REQUISIÇÃO] Item PENDENTE encontrado na linha ${rowIndexToUpdate}.`);
                                        break;
                                    } else {
                                        console.warn(`[TAREFA 2 - DEBUG] Linha ${headerRowIndex + 1 + i}: Match Req/Code, Status ATUAL é "${currentStatus}". Esperado "PENDENTE". NÃO ATUALIZADO.`);
                                    }
                                }
                            }
                        }

                        if (rowIndexToUpdate !== -1) {
                            const updates = [];
                            
                            // 1. Atualiza Status
                            const statusRange = `${reqSheetName}!${String.fromCharCode(65 + statusCol)}${rowIndexToUpdate}`;
                            updates.push(sheets.spreadsheets.values.update({ spreadsheetId: reqSheetId, range: statusRange, valueInputOption: 'RAW', resource: { values: [[newStatus]] }}));
                            console.log(`[TAREFA 2 - REQUISIÇÃO] Status atualizado para "${newStatus}" no range ${statusRange}.`);

                            // 2. Atualiza Data Entrega (se OK e coluna existir)
                            if (newStatus.toLowerCase() === 'ok' && deliveryDateCol !== -1) {
                                const dateRange = `${reqSheetName}!${String.fromCharCode(65 + deliveryDateCol)}${rowIndexToUpdate}`;
                                const finalDate = dataEntrega || new Date().toLocaleDateString('pt-BR');
                                updates.push(sheets.spreadsheets.values.update({ spreadsheetId: reqSheetId, range: dateRange, valueInputOption: 'RAW', resource: { values: [[finalDate]] }}));
                                console.log(`[TAREFA 2 - REQUISIÇÃO] Data de entrega preenchida com "${finalDate}".`);
                            }
                            
                            // 3. Atualiza Dias Corridos (se coluna existir)
                            if (diasCorridosCol !== -1 && diasCorridos) {
                                const diasRange = `${reqSheetName}!${String.fromCharCode(65 + diasCorridosCol)}${rowIndexToUpdate}`;
                                updates.push(sheets.spreadsheets.values.update({ spreadsheetId: reqSheetId, range: diasRange, valueInputOption: 'RAW', resource: { values: [[diasCorridos]] }}));
                                console.log(`[TAREFA 2 - REQUISIÇÃO] Dias Corridos preenchidos: ${diasCorridos}.`);
                            }
                            
                            await Promise.all(updates);
                            console.log(`[TAREFA 2 - REQUISIÇÃO] SUCESSO: Status do item atualizado.`);
                        } else {
                            console.warn(`[TAREFA 2 - REQUISIÇÃO] AVISO: Item PENDENTE não encontrado para Req: ${orderCodeToFind} / Cód: ${itemCodeToFind} em "${reqSheetName}".`);
                        }
                    }
                } else {
                    console.error(`[TAREFA 2 - REQUISIÇÃO] ERRO: Cabeçalho não encontrado na planilha de requisição "${reqSheetName}".`);
                }
            } else {
                console.log('Pulando Tarefa 2: Atualização de Status (dados do pedido não fornecidos).');
            }
            
            res.status(200).send({
                status: 'success',
                message: 'Operação concluída com sucesso.',
                blingResponse: blingResponseData,
            });

        } catch (error) {
            console.error('[estoque.js] Erro na rota unificada:', error.message, error.stack);
            const errorMessage = error.response ? (error.response.data?.error?.message || JSON.stringify(error.response.data)) : `Erro interno: ${error.message}`;
            const statusCode = error.response ? error.response.status : 500;
            res.status(statusCode).send({ status: 'error', message: errorMessage });
        }
    });

    // As outras rotas (/depositos, /find-product-id) continuam as mesmas
    router.get('/depositos', async (req, res) => {
        try {
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);

            const blingUrl = `${BLING_API_BASE_URL}/depositos`;
            const blingResponse = await axios.get(blingUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            
            const depositos = blingResponse.data.data.map(d => ({ id: d.id, descricao: d.descricao }));
            res.status(200).send({ status: 'success', data: depositos });
        } catch (error) {
            console.error('[estoque.js] Erro ao obter lista de depósitos:', error.message);
            const statusCode = error.response ? error.response.status : 500;
            const errorMessage = error.response ? JSON.stringify(error.response.data) : `Erro interno: ${error.message}`;
            res.status(statusCode).send({ status: 'error', message: errorMessage });
        }
    });

    router.get('/find-product-id', async (req, res) => {
        const { codigo } = req.query;
        if (!codigo) return res.status(400).send({ status: 'error', message: "O parâmetro 'codigo' é obrigatório." });

        try {
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);

            const blingUrl = `${BLING_API_BASE_URL}/produtos?codigo=${codigo}`;
            const blingResponse = await axios.get(blingUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });

            if (blingResponse.data.data && blingResponse.data.data.length > 0) {
                const produto = blingResponse.data.data[0];
                res.status(200).send({ status: 'success', data: { id: produto.id, codigo: produto.codigo } });
            } else {
                res.status(404).send({ status: 'error', message: `Produto com código "${codigo}" não encontrado.` });
            }
        } catch (error) {
            console.error('[estoque.js] Erro ao buscar ID do produto:', error.message);
            const statusCode = error.response ? error.response.status : 500;
            const errorMessage = error.response ? JSON.stringify(error.response.data) : `Erro interno: ${error.message}`;
            res.status(statusCode).send({ status: 'error', message: errorMessage });
        }
    });

    return router;
};

module.exports = createEstoqueRouter;