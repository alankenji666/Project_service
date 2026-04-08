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

const createPedidosRouter = (getSheetsClient, spreadsheetIdNFE, sheetNamePedidosBling, axios, APPS_SCRIPT_TOKEN_URL, BLING_API_BASE_URL) => {
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
            const { numero_do_pedido, observacao } = req.body;

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
            const observacaoColIndex = headers.indexOf('observacao') !== -1 ? headers.indexOf('observacao') : headers.indexOf('observação');

            if (observacaoColIndex === -1) {
                throw new Error('Coluna "Observação" não encontrada na planilha de Pedidos Bling.');
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

            res.status(200).send({
                status: 'success',
                message: `Processamento concluído. Sucessos: ${results.sucessos.length}. Erros: ${results.erros.length}.`,
                data: results
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

module.exports = createPedidosRouter;
