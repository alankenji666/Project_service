/**
 * Módulo: Webhook Bling Pedidos
 * Descrição: Processa notificações de pedidos do Bling e sincroniza com Google Sheets.
 * Seguindo o padrão do webhook de NF-e.
 */
const express = require('express');
const axios = require('axios');

module.exports = function(getInitializedSheetsClient, SPREADSHEET_ID, SHEET_NAME, BLING_API_BASE_URL, COLUMNS, APPS_SCRIPT_TOKEN_URL) {
    const router = express.Router();

    router.post('/', async (req, res, next) => {
        console.log('--- [WEBHOOK PEDIDO] RECEBIDO ---');
        
        try {
            const { event, data } = req.body;
            const pedidoId = data ? data.id : null;

            if (!pedidoId) {
                console.warn('[Bling Webhook] ID do pedido ausente.');
                return res.status(200).send({ status: 'ignored', message: 'No ID provided' });
            }

            const action = event.split('.')[1] || 'unknown'; // created, updated, deleted
            
            // 1. Obter Token (Igual ao NFe)
            const tokenRes = await axios.get(APPS_SCRIPT_TOKEN_URL);
            const token = tokenRes.data.access_token;

            let p;
            if (action !== 'deleted') {
                // 2. Buscar dados completos do pedido no Bling
                try {
                    const blingRes = await axios.get(`${BLING_API_BASE_URL}/pedidos/vendas/${pedidoId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    p = blingRes.data.data;
                } catch (e) {
                    console.error(`[Bling Webhook] Erro ao buscar pedido ${pedidoId}:`, e.message);
                }
            }

            const sheets = await getInitializedSheetsClient();
            
            // Ler dados atuais para verificar se o pedido já existe
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A:Z`
            });
            const currentSheetData = response.data.values || [];
            const existingRows = currentSheetData.slice(1);
            
            let rowIndexToUpdate = -1;
            for (let i = 0; i < existingRows.length; i++) {
                const idNaPlanilha = String(existingRows[i][COLUMNS.ID] || "").trim();
                if (idNaPlanilha === String(pedidoId).trim()) {
                    rowIndexToUpdate = i + 2; 
                    break;
                }
            }

            const rowValues = new Array(12).fill('');
            
            if (action === 'deleted' || !p) {
                rowValues[COLUMNS.ID] = String(pedidoId);
                rowValues[COLUMNS.EVENTO] = action === 'deleted' ? 'Excluído' : action;
                rowValues[COLUMNS.DATA_EVENTO] = new Date().toLocaleString('pt-BR');
            } else {
                rowValues[COLUMNS.ID] = String(p.id);
                rowValues[COLUMNS.NUMERO] = p.numero || "";
                rowValues[COLUMNS.NUMERO_LOJA] = p.numeroLoja || "";
                rowValues[COLUMNS.DATA] = p.data || "";
                rowValues[COLUMNS.TOTAL] = p.total || 0;
                rowValues[COLUMNS.SITUACAO_VALOR] = p.situacao?.descricao || p.situacao?.valor || "";
                rowValues[COLUMNS.SITUACAO_ID] = p.situacao?.id || "";
                rowValues[COLUMNS.CONTATO_ID] = p.contato?.id || "";
                rowValues[COLUMNS.VENDEDOR_ID] = p.vendedor?.id || "";
                rowValues[COLUMNS.LOJA_ID] = p.loja?.id || "";
                rowValues[COLUMNS.EVENTO] = action;
                rowValues[COLUMNS.DATA_EVENTO] = new Date().toLocaleString('pt-BR');
            }

            if (rowIndexToUpdate !== -1) {
                console.log(`[Bling Webhook] Atualizando pedido ${pedidoId} na linha ${rowIndexToUpdate}`);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A${rowIndexToUpdate}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [rowValues] }
                });
            } else {
                console.log(`[Bling Webhook] Inserindo novo pedido ${pedidoId}`);
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:A`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: [rowValues] }
                });
            }

            // Notificar via Firestore Sync
            if (req.notifySync) {
                req.notifySync('pedidoBlingReceived', {
                    id: pedidoId,
                    numero: p ? p.numero : 'N/A',
                    total: p ? p.total : 0,
                    evento: action
                });
            }

            res.status(200).send({ status: 'success' });
        } catch (error) {
            console.error('[Bling Webhook] Erro ao processar:', error.message);
            next(error);
        }
    });

    return router;
};
