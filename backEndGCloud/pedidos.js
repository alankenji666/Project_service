const express = require('express');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getTokenWithRetry(axios, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const tokenResponse = await axios.get(url);
            const accessToken = tokenResponse.data.access_token;
            if (accessToken) return accessToken;
        } catch (error) {
            if (error.response && error.response.status >= 500 && i < retries - 1) {
                await delay(2000);
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Não foi possível obter o token do Bling após ${retries} tentativas.`);
}

const createPedidosRouter = (getSheetsClient, spreadsheetIdNFE, sheetNamePedidosBling, axios, APPS_SCRIPT_TOKEN_URL, BLING_API_BASE_URL, notifySync) => {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            const sheets = await getSheetsClient();
            
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFE,
                range: `${sheetNamePedidosBling}!A:Z`, 
            });

            const rows = response.data.values || [];
            if (rows.length === 0) {
                return res.status(200).send({ status: 'success', data: [] });
            }

            const headersRow = rows[0];
            const headersNorm = headersRow.map(h => 
                h.toLowerCase().trim()
                 .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove acentos
                 .replace(/\s+/g, '_')
                 .replace(/[\/\(\)]/g, '_')
            );

            const pedidos = rows.slice(1).map(row => {
                const obj = {};
                headersNorm.forEach((h, i) => { 
                    if (h) {
                        const val = row[i] || '';
                        obj[h] = val;
                    }
                });

                // Forçar a observação a vir da Coluna Q (índice 16)
                // Caso existam múltiplas colunas de observação, garantimos a correta aqui.
                if (row.length > 16) {
                    obj['observacao'] = row[16] || '';
                }

                // Compatibilidade com o frontend (mapia id_pedido para id)
                if (obj.id_pedido) obj.id = obj.id_pedido;
                return obj;
            });

            res.status(200).send({ status: 'success', data: pedidos });
        } catch (error) {
            next(error);
        }
    });

    router.post('/observacao', async (req, res, next) => {
        try {
            const { numero_do_pedido, observacao, senderId } = req.body;

            if (!numero_do_pedido || !observacao) {
                const error = new Error("Dados incompletos: 'numero_do_pedido' e 'observacao' são obrigatórios.");
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFE,
                range: `${sheetNamePedidosBling}!A:Z`,
            });

            const rows = response.data.values || [];
            if (rows.length === 0) {
                const error = new Error('Nenhum dado encontrado na planilha de Pedidos Bling.');
                error.statusCode = 404;
                throw error;
            }

            const headers = rows[0].map(h => (h || '').toLowerCase().trim());
            
            const idColIndex = headers.indexOf('id pedido') !== -1 ? headers.indexOf('id pedido') : headers.indexOf('id');
            const numColIndex = headers.indexOf('numero') !== -1 ? headers.indexOf('numero') : headers.indexOf('número');
            const numLojaColIndex = headers.indexOf('numero loja') !== -1 ? headers.indexOf('numero loja') : headers.indexOf('número loja');
            
            // A planilha tem DUAS colunas chamadas "Observação".
            // A que o sistema desktop usa é a Coluna Q (índice fixo 16).
            // Não podemos usar headers.indexOf() pois retorna a primeira (errada).
            const observacaoColIndex = 16; // Coluna Q — Observação usada pelo sistema principal

            if (rows[0].length <= observacaoColIndex) {
                throw new Error('Coluna Q (Observação) não encontrada na planilha de Pedidos Bling.');
            }

            let rowIndexToUpdate = -1;
            let observacaoAtual = '';

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const idVal = idColIndex !== -1 ? (row[idColIndex] || '').toString().trim() : '';
                const numVal = numColIndex !== -1 ? (row[numColIndex] || '').toString().trim() : '';
                const numLojaVal = numLojaColIndex !== -1 ? (row[numLojaColIndex] || '').toString().trim() : '';

                if (idVal === String(numero_do_pedido) || numVal === String(numero_do_pedido) || numLojaVal === String(numero_do_pedido)) {
                    rowIndexToUpdate = i;
                    observacaoAtual = row[observacaoColIndex] || '';
                    break;
                }
            }

            if (rowIndexToUpdate === -1) {
                const error = new Error(`Pedido com ID/Número ${numero_do_pedido} não encontrado na planilha de Pedidos Bling.`);
                error.statusCode = 404;
                throw error;
            }

            const timestamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            const novaEntrada = `${timestamp} - ${observacao}`;
            const observacaoFinal = observacaoAtual ? `${observacaoAtual}\\n${novaEntrada}` : novaEntrada;

            const range = `${sheetNamePedidosBling}!${String.fromCharCode(65 + observacaoColIndex)}${rowIndexToUpdate + 1}`;
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFE,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [[observacaoFinal]],
                },
            });

            console.log(`Observação do Pedido ${numero_do_pedido} atualizada na linha ${rowIndexToUpdate + 1}.`);

            // Notificar todos os clientes via Firestore Sync
            if (typeof notifySync === 'function') {
                notifySync('orderObservationUpdated', {
                    numeroPedido: String(numero_do_pedido),
                    novaObservacao: observacaoFinal,
                    senderId: senderId || null
                });
            }

            res.status(200).send({ status: 'success', message: 'Observação adicionada com sucesso!', data: { newObservation: observacaoFinal } });

        } catch (error) {
            next(error);
        }
    });

    router.post('/update-status', async (req, res, next) => {
        try {
            const { ids, idSituacao } = req.body;
            if (!ids || !Array.isArray(ids) || ids.length === 0 || !idSituacao) {
                const error = new Error("Dados incompletos: 'ids' (array) e 'idSituacao' são obrigatórios.");
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);
            
            const results = { sucessos: [], erros: [] };

            // Puxar a planilha de uma vez para atualizar os sucessos depois
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFE,
                range: `${sheetNamePedidosBling}!A:Z`,
            });
            const rows = response.data.values || [];
            const headers = rows.length > 0 ? rows[0].map(h => (h || '').toLowerCase().trim()) : [];
            const idColIndex = headers.indexOf('id pedido') !== -1 ? headers.indexOf('id pedido') : headers.indexOf('id');
            const numColIndex = headers.indexOf('numero') !== -1 ? headers.indexOf('numero') : headers.indexOf('número');
            const numLojaColIndex = headers.indexOf('numero loja') !== -1 ? headers.indexOf('numero loja') : headers.indexOf('número loja');
            const situacaoColIndex = headers.indexOf('situação') !== -1 ? headers.indexOf('situação') : headers.indexOf('situacao');

            for (const id of ids) {
                try {
                    // Update no Bling
                    const blingUrl = `${BLING_API_BASE_URL}/pedidos/vendas/${id}/situacoes/${idSituacao}`;
                    const blingResponse = await axios.patch(blingUrl, {}, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    
                    // Update sucesso na Sheet se tiver sucesso no Bling
                    let atualizouPlanilha = false;
                    if (rows.length > 0 && situacaoColIndex !== -1) {
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i];
                            const idVal = idColIndex !== -1 ? (row[idColIndex] || '').toString().trim() : '';
                            const numVal = numColIndex !== -1 ? (row[numColIndex] || '').toString().trim() : '';
                            const numLojaVal = numLojaColIndex !== -1 ? (row[numLojaColIndex] || '').toString().trim() : '';
                            
                            if (idVal === String(id) || numVal === String(id) || numLojaVal === String(id)) {
                                const range = `${sheetNamePedidosBling}!${String.fromCharCode(65 + situacaoColIndex)}${i + 1}`;
                                const statusName = String(idSituacao) === "9" ? "Atendido" : `ID ${idSituacao}`;
                                await sheets.spreadsheets.values.update({
                                    spreadsheetId: spreadsheetIdNFE,
                                    range: range,
                                    valueInputOption: 'RAW',
                                    resource: { values: [[statusName]] },
                                });
                                atualizouPlanilha = true;
                                break;
                            }
                        }
                    }

                    results.sucessos.push({ id, atualizouPlanilha });
                } catch (err) {
                    console.error(`Erro ao atualizar pedido ${id}:`, err.response?.data || err.message);
                    results.erros.push({ id, erro: err.response?.data?.error?.message || err.message });
                }
            }

            res.status(200).send({ status: 'success', data: results });
        } catch (error) {
            next(error);
        }
    });

    // Rota para Editar a Descrição de um Item de Requisição (Dentro de /pedidos)
    router.post('/update-item-description', async (req, res, next) => {
        try {
            const { orderCode, codigoService, requisitionType, novaDescricao } = req.body;
            if (!orderCode || !codigoService || !requisitionType || !novaDescricao) {
                const error = new Error("Dados incompletos.");
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            
            // Mapeamento de Planilhas (Usando as mesmas variáveis globais que o index.js passa se necessário, 
            // mas aqui vamos usar o padrão de IDs fixos para garantir)
            const spreadsheets = {
                'fabrica': '1_A9C_XuUyhC0X1C-PMy7_55jx-mH7LkslBz-CjdVuXc',
                'terceiros': '1m5HuPv5RLam7vSQ7n1ml9MHy9WO_dbGN5gF2Bet39Ss',
                'saidas-fabrica': '1ygLHkMzQcpMbXssdlF8iPFUXTXVFDsDud286Z8ihma4',
                'saidas-garantia': '1JygTrWFYFXioVJMqmnR-KNs6vaUApYoAJZNWIK5R8PQ'
            };
            const sheetNames = {
                'fabrica': 'Requisição fabrica lote 1',
                'terceiros': 'Requisição geral lote 1',
                'saidas-fabrica': 'Dados Sistemas - Fabrica 1',
                'saidas-garantia': 'Dados Sistemas - Garantia 1'
            };

            const spreadsheetId = spreadsheets[requisitionType];
            const sheetName = sheetNames[requisitionType];

            if (!spreadsheetId) throw new Error(`Tipo de requisição desconhecido: ${requisitionType}`);

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:Z`
            });

            const rows = response.data.values || [];
            const headers = rows[0]?.map(h => h?.toLowerCase().trim()) || [];
            const requisicaoColIndex = headers.indexOf('requisição');
            const codigoServiceColIndex = headers.indexOf('codigo service');
            const descricaoColIndex = headers.indexOf('descrição');

            let rowIndexToUpdate = -1;
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][requisicaoColIndex]).trim() === orderCode && String(rows[i][codigoServiceColIndex]).trim() === codigoService) {
                    rowIndexToUpdate = i + 1;
                    break;
                }
            }

            if (rowIndexToUpdate === -1) throw new Error('Item não encontrado na planilha.');

            const range = `${sheetName}!${String.fromCharCode(65 + descricaoColIndex)}${rowIndexToUpdate}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'RAW',
                resource: { values: [[novaDescricao]] }
            });

            res.status(200).send({ status: 'success', message: 'Descrição atualizada!' });
        } catch (error) {
            next(error);
        }
    });

    router.post('/vendas/:id/gerar-nfe', async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!id) throw new Error("ID do pedido é obrigatório.");

            const accessToken = await getTokenWithRetry(axios, APPS_SCRIPT_TOKEN_URL);
            
            console.log(`[Bling API] Gerando NF-e para o pedido ${id}...`);
            const blingUrl = `${BLING_API_BASE_URL}/pedidos/vendas/${id}/gerar-nfe`;
            
            const blingResponse = await axios.post(blingUrl, {}, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            console.log(`[Bling API] NF-e gerada com sucesso para o pedido ${id}. ID da Nota: ${blingResponse.data.idNotaFiscal}`);
            
            // Notificar via Firestore Sync que o pedido foi atualizado (para atualizar o id_nota na planilha/UI)
            if (typeof notifySync === 'function') {
                notifySync('pedidoBlingReceived', {
                    id: id,
                    id_nota: blingResponse.data.idNotaFiscal,
                    situacao: 'Atendido' // O Bling geralmente muda para atendido ao gerar nota
                });
            }

            res.status(201).send({
                status: 'success',
                message: 'Nota Fiscal gerada com sucesso!',
                data: blingResponse.data
            });
        } catch (err) {
            console.error(`[Bling API] Erro ao gerar NF-e para pedido ${req.params.id}:`, err.response?.data || err.message);
            
            // Extrair mensagem de erro amigável do Bling
            let errorMsg = 'Erro ao gerar nota fiscal.';
            if (err.response?.data?.error?.description) {
                errorMsg = err.response.data.error.description;
            } else if (err.response?.data?.error?.message) {
                errorMsg = err.response.data.error.message;
            } else {
                errorMsg = err.message;
            }

            const error = new Error(errorMsg);
            error.statusCode = err.response?.status || 500;
            next(error);
        }
    });

    return router;
};

module.exports = createPedidosRouter;
