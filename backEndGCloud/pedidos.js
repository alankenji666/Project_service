const express = require('express');

const createPedidosRouter = (getSheetsClient, spreadsheetIdNFE, sheetNamePedidosBling) => {
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

    return router;
};

module.exports = createPedidosRouter;
