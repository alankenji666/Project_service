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
            const headersNorm = headersRow.map(h => h.toLowerCase().trim().replace(/\s/g, '_').replace(/\//g, '_'));

            const pedidos = rows.slice(1).map(row => {
                const obj = {};
                headersNorm.forEach((h, i) => { 
                    if (h) obj[h] = row[i] || ''; 
                });
                return obj;
            });

            res.status(200).send({ status: 'success', data: pedidos });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

module.exports = createPedidosRouter;
