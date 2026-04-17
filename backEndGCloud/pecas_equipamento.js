/**
 * Módulo: Peças por Equipamento
 * Descrição: CRUD para a aba Pecas_Equipamento da planilha de Produtos.
 * Estrutura da planilha:
 *   - Linha 1: Cabeçalho — cada célula é o nome de um modelo/equipamento
 *   - Linhas 2+: Peças (strings) de cada modelo (cada coluna = um modelo)
 */
const express = require('express');

module.exports = function (getInitializedSheetsClient, SPREADSHEET_ID, SHEET_NAME) {
    const router = express.Router();

    // --- GET / — Retorna todos os modelos e suas peças ---
    router.get('/', async (req, res, next) => {
        try {
            const sheets = await getInitializedSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A1:ZZ`,
            });

            const rows = response.data.values || [];
            if (rows.length === 0) {
                return res.status(200).send({ status: 'success', data: [] });
            }

            const headers = rows[0]; // Linha 1 = nomes dos modelos
            const dataRows = rows.slice(1); // Linhas 2+ = peças

            const modelos = headers.map((nome, colIndex) => {
                const pecas = dataRows
                    .map(row => (row[colIndex] || '').trim())
                    .filter(v => v !== '');
                return { nome: nome || '', coluna: colIndex, pecas };
            }).filter(m => m.nome !== ''); // Ignora colunas sem nome

            res.status(200).send({ status: 'success', data: modelos });
        } catch (error) {
            next(error);
        }
    });

    // --- POST /modelo — Adiciona um novo modelo (nova coluna no final) ---
    router.post('/modelo', async (req, res, next) => {
        try {
            const { nome } = req.body;
            if (!nome || !nome.trim()) {
                const err = new Error("'nome' é obrigatório.");
                err.statusCode = 400;
                throw err;
            }

            const sheets = await getInitializedSheetsClient();

            // Lê a linha 1 para descobrir quantas colunas já existem
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!1:1`,
            });

            const headerRow = (response.data.values || [[]])[0] || [];
            const nextColLetter = _colIndexToLetter(headerRow.length);

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!${nextColLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[nome.trim()]] },
            });

            res.status(200).send({
                status: 'success',
                message: `Modelo "${nome.trim()}" criado na coluna ${nextColLetter}.`,
                data: { nome: nome.trim(), coluna: headerRow.length }
            });
        } catch (error) {
            next(error);
        }
    });

    // --- PUT /modelo — Renomeia um modelo (atualiza cabeçalho da coluna) ---
    router.put('/modelo', async (req, res, next) => {
        try {
            const { coluna, novoNome } = req.body;
            if (coluna === undefined || coluna === null || !novoNome || !novoNome.trim()) {
                const err = new Error("'coluna' (índice) e 'novoNome' são obrigatórios.");
                err.statusCode = 400;
                throw err;
            }

            const colLetter = _colIndexToLetter(parseInt(coluna));
            const sheets = await getInitializedSheetsClient();

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!${colLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[novoNome.trim()]] },
            });

            res.status(200).send({
                status: 'success',
                message: `Modelo renomeado para "${novoNome.trim()}".`
            });
        } catch (error) {
            next(error);
        }
    });

    // --- DELETE /modelo — Remove um modelo (limpa o cabeçalho e as peças da coluna) ---
    // Nota: A API do Sheets não suporta exclusão de coluna diretamente via Values API,
    // então limpamos todo o conteúdo da coluna (nome fica vazio) e reagrupamos no GET.
    // Para excluir a coluna fisicamente, usamos batchUpdate com DeleteDimensionRequest.
    router.delete('/modelo', async (req, res, next) => {
        try {
            const { coluna } = req.body;
            if (coluna === undefined || coluna === null) {
                const err = new Error("'coluna' (índice) é obrigatório.");
                err.statusCode = 400;
                throw err;
            }

            const colIndex = parseInt(coluna);
            const sheets = await getInitializedSheetsClient();

            // Busca o sheetId da aba Pecas_Equipamento
            const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
            const sheet = spreadsheetMeta.data.sheets.find(s => s.properties.title === SHEET_NAME);
            if (!sheet) {
                const err = new Error(`Aba "${SHEET_NAME}" não encontrada.`);
                err.statusCode = 404;
                throw err;
            }
            const sheetId = sheet.properties.sheetId;

            // Delete Column physically via batchUpdate
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: colIndex,
                                endIndex: colIndex + 1
                            }
                        }
                    }]
                }
            });

            res.status(200).send({
                status: 'success',
                message: `Modelo na coluna ${colIndex} excluído com sucesso.`
            });
        } catch (error) {
            next(error);
        }
    });

    // --- POST /peca — Adiciona uma peça a um modelo ---
    router.post('/peca', async (req, res, next) => {
        try {
            const { coluna, nomePeca } = req.body;
            if (coluna === undefined || !nomePeca || !nomePeca.trim()) {
                const err = new Error("'coluna' e 'nomePeca' são obrigatórios.");
                err.statusCode = 400;
                throw err;
            }

            const sheets = await getInitializedSheetsClient();
            const colLetter = _colIndexToLetter(parseInt(coluna));

            // Lê a coluna inteira para achar a primeira célula vazia
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!${colLetter}:${colLetter}`,
            });

            const colValues = response.data.values || [];
            const nextRow = colValues.length + 1;

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!${colLetter}${nextRow}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[nomePeca.trim()]] },
            });

            res.status(200).send({
                status: 'success',
                message: `Peça "${nomePeca.trim()}" adicionada ao modelo.`
            });
        } catch (error) {
            next(error);
        }
    });

    // --- DELETE /peca — Remove uma peça de um modelo ---
    router.delete('/peca', async (req, res, next) => {
        try {
            const { coluna, nomePeca } = req.body;
            if (coluna === undefined || !nomePeca || !nomePeca.trim()) {
                const err = new Error("'coluna' e 'nomePeca' são obrigatórios.");
                err.statusCode = 400;
                throw err;
            }

            const sheets = await getInitializedSheetsClient();
            const colLetter = _colIndexToLetter(parseInt(coluna));

            // Lê a coluna para achar em qual linha a peça está
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!${colLetter}:${colLetter}`,
            });

            const colValues = response.data.values || [];
            const rowIndex = colValues.findIndex(row => row[0]?.trim() === nomePeca.trim());

            if (rowIndex === -1) {
                const err = new Error(`Peça "${nomePeca}" não encontrada no modelo.`);
                err.statusCode = 404;
                throw err;
            }

            // Sheets API v4 não deleta célula individual (Shift up), 
            // então limpamos o conteúdo. O GET do frontend já filtra vazios.
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!${colLetter}${rowIndex + 1}`,
            });

            res.status(200).send({
                status: 'success',
                message: `Peça "${nomePeca.trim()}" removida com sucesso.`
            });
        } catch (error) {
            next(error);
        }
    });

    // --- Helpers ---
    function _colIndexToLetter(index) {
        let letter = '';
        let n = index;
        while (n >= 0) {
            letter = String.fromCharCode((n % 26) + 65) + letter;
            n = Math.floor(n / 26) - 1;
        }
        return letter;
    }

    return router;
};
