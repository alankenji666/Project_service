/**
 * entradas.js
 *
 * Roteador Express para registrar entradas de Notas Fiscais (NF-e)
 * na aba "Pedidos Compras" da planilha de estoque.
 *
 * Estrutura das colunas gravadas:
 * A: Data de Registro | B: Chave de Acesso | C: Nº Nota
 * D: Fornecedor | E: Data de Emissão | F: Valor Total
 * G: Observação | H: Registrado Por
 */
const express = require('express');

/**
 * @param {Function} getInitializedSheetsClient - Factory do cliente Google Sheets
 * @param {string} spreadsheetId                - ID da planilha de estoque
 * @param {string} sheetName                    - Nome da aba "Pedidos Compras"
 */
function createEntradasRouter(getInitializedSheetsClient, spreadsheetId, sheetName) {
    const router = express.Router();

    // POST /entradas/nota
    // Registra uma nova entrada de NF na planilha "Pedidos Compras"
    router.post('/nota', async (req, res, next) => {
        console.log('[entradas] POST /nota recebido:', JSON.stringify(req.body, null, 2));

        try {
            const {
                dataRegistro,
                chaveAcesso,
                numeroNota,
                dataEmissao,
                fornecedor,
                valorTotal,
                observacao,
                registradoPor
            } = req.body;

            if (!chaveAcesso || !fornecedor) {
                const err = new Error('Campos obrigatórios: chaveAcesso e fornecedor.');
                err.statusCode = 400;
                throw err;
            }

            const sheets = await getInitializedSheetsClient();

            const novaLinha = [
                dataRegistro  || '',   // A: Data de registro (dd/mm/aaaa)
                chaveAcesso   || '',   // B: Chave de Acesso NF-e (44 dígitos)
                numeroNota    || '',   // C: Número da Nota
                fornecedor    || '',   // D: Fornecedor
                dataEmissao   || '',   // E: Data de Emissão (extraída da chave)
                valorTotal    || 0,    // F: Valor Total
                observacao    || '',   // G: Observação
                registradoPor || ''    // H: Registrado por
            ];

            const response = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:H`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [novaLinha] }
            });

            console.log(`[entradas] Linha inserida com sucesso na aba "${sheetName}":`, response.data.updates);

            res.status(200).json({
                status: 'success',
                message: `Entrada de NF registrada com sucesso na aba "${sheetName}"!`,
                data: response.data.updates
            });

        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = createEntradasRouter;
