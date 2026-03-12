const express = require('express');

/**
 * Função auxiliar para encontrar a linha do cabeçalho e os índices das colunas.
 * @param {object} sheets - Instância do cliente do Google Sheets.
 * @param {string} spreadsheetId - ID da planilha.
 * @param {string} sheetName - Nome da aba.
 * @param {string[]} requiredHeaders - Array com os nomes dos cabeçalhos necessários.
 * @returns {Promise<object|null>} Objeto com rowIndex e headers, ou null se não encontrado.
 */
async function findHeaderInfo(sheets, spreadsheetId, sheetName, requiredHeaders) {
    console.log(`[GARANTIA-DIAGNÓSTICO] Buscando cabeçalhos [${requiredHeaders.join(', ')}] na planilha "${sheetName}"...`);
    const range = `${sheetName}!A1:Z20`; // Busca nas primeiros 20 linhas
    try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const rows = response.data.values;
        if (rows) {
            for (let i = 0; i < rows.length; i++) {
                const headers = rows[i].map(h => h ? String(h).toLowerCase().trim() : '');
                const hasAllHeaders = requiredHeaders.every(rh => headers.includes(rh));
                if (hasAllHeaders) {
                    console.log(`[GARANTIA-DIAGNÓSTICO] Cabeçalhos encontrados na linha ${i + 1}. Headers: [${headers.join(', ')}]`);
                    return { rowIndex: i + 1, headers };
                }
            }
        }
        console.warn(`[GARANTIA-DIAGNÓSTICO] AVISO: Nenhuma linha com os cabeçalhos [${requiredHeaders.join(', ')}] foi encontrada em "${sheetName}".`);
        return null;
    } catch (e) {
        console.error(`[GARANTIA-DIAGNÓSTICO] ERRO CRÍTICO ao ler a planilha "${sheetName}" para encontrar cabeçalhos: ${e.message}`);
        return null;
    }
}


const createSaidaGarantiaRouter = (
    getInitializedSheetsClient,
    SPREADSHEET_ID_SAIDA,
    SHEET_NAME_SAIDA,
    axios,
    APPS_SCRIPT_TOKEN_URL,
    BLING_API_BASE_URL,
    SPREADSHEET_ID_ESTOQUE,
    SHEET_NAME_ESTOQUE
) => {
    const router = express.Router();
    const DEPOSITO_PADRAO_ID = 14887835380; // ID do depósito padrão do Bling

    router.post('/', async (req, res, next) => {
        console.log('Requisição POST recebida em /saida-garantia:', JSON.stringify(req.body, null, 2));

        try {
            const { data } = req.body;
            if (!data || !Array.isArray(data) || data.length === 0) {
                const error = new Error('Payload inválido. O corpo deve conter um array "data".');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getInitializedSheetsClient();

            // ETAPA 1: Registrar a saída na planilha de saídas de GARANTIA.
            console.log('[GARANTIA - ETAPA 1] Iniciando registro na planilha de saídas de garantia...');
            const saidaValues = data.map(item => [
                item.requisicao || '',
                item.codigo_service || '',
                item.codigo_mks_equipamentos || '',
                item.descricao || '',
                item.localizacao || '',
                item.quantidade || '',
                item.situacao || '',
                item.data_pedido || '',
                item.data_envio || '',
                Array.isArray(item.observacao) ? item.observacao.join('\n') : (item.observacao || ''),
                item.responsavel || ''
            ]);

            const appendResponse = await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID_SAIDA,
                range: `${SHEET_NAME_SAIDA}!A:A`,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: saidaValues },
            });
            console.log('[GARANTIA - ETAPA 1] SUCESSO: Dados de saída inseridos na planilha de registro de garantia.');

            // ETAPA 2: Processar a baixa de estoque para cada item (lógica idêntica à de fábrica).
            console.log('\n[GARANTIA - ETAPA 2] Iniciando processo de baixa de estoque...');
            const tokenResponse = await axios.get(APPS_SCRIPT_TOKEN_URL);
            const accessToken = tokenResponse.data.access_token;
            if (!accessToken) {
                throw new Error('Token de acesso do Bling para Garantia não foi obtido.');
            }
            console.log('[GARANTIA - ETAPA 2] Token de acesso do Bling (Garantia) obtido com sucesso.');

            const estoqueHeaderInfo = await findHeaderInfo(sheets, SPREADSHEET_ID_ESTOQUE, SHEET_NAME_ESTOQUE, ['código', 'estoque']);
            if (!estoqueHeaderInfo) {
                console.error(`[GARANTIA - ETAPA 2] ERRO CRÍTICO: Cabeçalho não encontrado na planilha de estoque. A baixa de estoque não será realizada.`);
                return res.status(200).send({
                    status: 'success_with_warning',
                    message: 'Saída de garantia registrada com sucesso, mas a baixa de estoque falhou (cabeçalho da planilha de estoque não encontrado).',
                    data: appendResponse.data,
                });
            }

            const { rowIndex: headerRowIndex, headers } = estoqueHeaderInfo;
            const codigoCol = headers.indexOf('código');
            const estoqueCol = headers.indexOf('estoque');

            const allEstoqueData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID_ESTOQUE, range: `${SHEET_NAME_ESTOQUE}!A${headerRowIndex + 1}:Z` });
            const estoqueRows = allEstoqueData.data.values || [];
            console.log(`[GARANTIA - ETAPA 2] Planilha de estoque lida. Total de ${estoqueRows.length} produtos encontrados.`);

            let stockUpdateResults = [];

            for (const item of data) {
                const codigoService = String(item.codigo_service || '').trim();
                const quantidadeSaida = Number(item.quantidade);

                console.log(`\n--- [GARANTIA] Processando item: Cód: ${codigoService} | Qtd: ${quantidadeSaida} ---`);

                if (!codigoService || isNaN(quantidadeSaida) || quantidadeSaida <= 0) {
                    console.error(`[GARANTIA - ERRO] Item com dados inválidos (código: "${codigoService}", quantidade: "${item.quantidade}"). Pulando...`);
                    stockUpdateResults.push({ codigo: codigoService, status: 'error', message: 'Dados do item inválidos (código ou quantidade).' });
                    continue;
                }

                try {
                    // 2.1 - Atualizar Bling
                    console.log(`[GARANTIA - Bling - ${codigoService}] Buscando ID do produto...`);
                    const blingProductUrl = `${BLING_API_BASE_URL}/produtos?codigo=${codigoService}`;
                    const productResponse = await axios.get(blingProductUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                    
                    if (!productResponse.data.data || productResponse.data.data.length === 0) {
                        throw new Error(`Produto não encontrado no Bling.`);
                    }
                    const produtoId = productResponse.data.data[0].id;
                    console.log(`[GARANTIA - Bling - ${codigoService}] Produto encontrado. ID: ${produtoId}. Lançando estoque...`);

                    const blingPayload = {
                        produto: { id: produtoId },
                        deposito: { id: DEPOSITO_PADRAO_ID },
                        operacao: 'S', // Saída
                        quantidade: quantidadeSaida,
                        observacoes: `Saída por Garantia via App - Requisição: ${item.requisicao}`
                    };

                    await axios.post(`${BLING_API_BASE_URL}/estoques`, blingPayload, { headers: { 'Authorization': `Bearer ${accessToken}` }});
                    console.log(`[GARANTIA - Bling - ${codigoService}] SUCESSO: Estoque atualizado no Bling.`);

                    // 2.2 - Atualizar Planilha de Estoque
                    console.log(`[GARANTIA - Planilha - ${codigoService}] Procurando produto para atualizar estoque...`);
                    let rowIndexToUpdate = -1;
                    for (let i = 0; i < estoqueRows.length; i++) {
                        const sheetCode = String(estoqueRows[i][codigoCol] || '').trim();
                        if (sheetCode === codigoService) {
                            rowIndexToUpdate = headerRowIndex + 1 + i;
                            break;
                        }
                    }

                    if (rowIndexToUpdate !== -1) {
                        const estoqueAtual = Number(estoqueRows[rowIndexToUpdate - (headerRowIndex + 1)][estoqueCol]) || 0;
                        const estoqueFinal = estoqueAtual - quantidadeSaida;
                        const updateRange = `${SHEET_NAME_ESTOQUE}!${String.fromCharCode(65 + estoqueCol)}${rowIndexToUpdate}`;
                        
                        console.log(`[GARANTIA - Planilha - ${codigoService}] Produto encontrado na linha ${rowIndexToUpdate}. Estoque atual: ${estoqueAtual}. Novo estoque: ${estoqueFinal}. Atualizando range: ${updateRange}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId: SPREADSHEET_ID_ESTOQUE,
                            range: updateRange,
                            valueInputOption: 'RAW',
                            resource: { values: [[estoqueFinal]] }
                        });
                        console.log(`[GARANTIA - Planilha - ${codigoService}] SUCESSO: Planilha de estoque atualizada.`);
                        stockUpdateResults.push({ codigo: codigoService, status: 'success', newStock: estoqueFinal });
                    } else {
                        throw new Error(`Produto não encontrado na planilha de estoque.`);
                    }
                } catch (error) {
                    console.error(`[GARANTIA - ERRO GERAL - ${codigoService}] Falha ao dar baixa no estoque:`, error.message);
                    stockUpdateResults.push({ codigo: codigoService, status: 'error', message: error.message });
                }
            }

            console.log('\n--- [GARANTIA] Processo de baixa de estoque finalizado. ---');
            res.status(200).send({
                status: 'success',
                message: 'Saída de garantia registrada e baixas de estoque processadas.',
                data: appendResponse.data,
                stockUpdateResults: stockUpdateResults
            });

        } catch (error) {
            next(error);
        }
    });

    return router;
};

module.exports = createSaidaGarantiaRouter;
