// conferencia_nfe.js

const express = require('express');

/**
 * Cria e retorna um roteador Express para a funcionalidade de conferência de NF-e.
 * @param {Function} getInitializedSheetsClient Função para obter uma instância inicializada do cliente Google Sheets.
 * @param {string} spreadsheetIdNFe O ID da planilha de Notas Fiscais.
 * @param {string} sheetNameNotasFiscais O nome da aba da planilha de Notas Fiscais.
 * @returns {express.Router} O roteador Express configurado.
 */
module.exports = function(getInitializedSheetsClient, spreadsheetIdNFe, sheetNameNotasFiscais) {
    const router = express.Router();

    /**
     * Rota POST para atualizar o status de conferência de uma Nota Fiscal.
     * Espera um payload JSON com { id_nota: string, conferido: 'Sim' | 'Não' }.
     */
    router.post('/', async (req, res, next) => {
        console.log('Requisição POST recebida na Cloud Function para /nfe/conferencia:', JSON.stringify(req.body, null, 2));

        try {
            const { id_nota, conferido } = req.body; 

            if (!id_nota || !conferido) {
                const error = new Error("Dados incompletos: 'id_nota' e 'conferido' são obrigatórios.");
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getInitializedSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFe,
                range: `${sheetNameNotasFiscais}!A:Z`,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                const error = new Error('Nenhum dado encontrado na planilha de Notas Fiscais.');
                error.statusCode = 404;
                throw error;
            }

            const headers = rows[0];
            const idNotaColIndex = headers.indexOf('ID Nota');
            const conferidoColIndex = headers.indexOf('Conferido');

            if (idNotaColIndex === -1 || conferidoColIndex === -1) {
                throw new Error('Uma ou mais colunas essenciais ("ID Nota", "Conferido") não foram encontradas na planilha.');
            }

            let rowIndexToUpdate = -1;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const currentIdNota = row[idNotaColIndex] ? row[idNotaColIndex].toString().trim() : '';

                if (currentIdNota === id_nota) {
                    rowIndexToUpdate = i;
                    break;
                }
            }

            if (rowIndexToUpdate === -1) {
                const error = new Error(`Nota Fiscal com ID ${id_nota} não encontrada na planilha.`);
                error.statusCode = 404;
                throw error;
            }

            const range = `${sheetNameNotasFiscais}!${String.fromCharCode(65 + conferidoColIndex)}${rowIndexToUpdate + 1}`;
            const updateResponse = await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFe,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [[conferido]],
                },
            });
            console.log(`Status de conferência da NF-e ${id_nota} atualizado para '${conferido}' na linha ${rowIndexToUpdate + 1}.`, updateResponse.data);
            res.status(200).send({ status: 'success', message: 'Status de conferência da NF-e atualizado com sucesso!', data: updateResponse.data });
        } catch (error) {
            next(error);
        }
    });

    // --- NOVO: Rota para adicionar uma observação em formato de chat ---
    /**
     * Rota POST para adicionar uma observação a uma Nota Fiscal.
     * Espera um payload JSON com { id_nota: string, observacao: string }.
     */
    router.post('/observacao', async (req, res, next) => {
        console.log('Requisição POST recebida para /nfe/conferencia/observacao:', JSON.stringify(req.body, null, 2));

        try {
            const { id_nota, observacao } = req.body;

            if (!id_nota || !observacao) {
                const error = new Error("Dados incompletos: 'id_nota' e 'observacao' são obrigatórios.");
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getInitializedSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFe,
                range: `${sheetNameNotasFiscais}!A:Z`,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                const error = new Error('Nenhum dado encontrado na planilha de Notas Fiscais.');
                error.statusCode = 404;
                throw error;
            }

            const headers = rows[0];
            const idNotaColIndex = headers.indexOf('ID Nota');
            const observacaoColIndex = headers.indexOf('Observação'); // Procura a coluna "Observação"

            if (idNotaColIndex === -1 || observacaoColIndex === -1) {
                throw new Error('Colunas "ID Nota" ou "Observação" não encontradas na planilha.');
            }

            let rowIndexToUpdate = -1;
            let observacaoAtual = '';
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[idNotaColIndex] && row[idNotaColIndex].toString().trim() === id_nota) {
                    rowIndexToUpdate = i;
                    observacaoAtual = row[observacaoColIndex] || ''; // Pega o conteúdo atual da célula de observação
                    break;
                }
            }

            if (rowIndexToUpdate === -1) {
                const error = new Error(`Nota Fiscal com ID ${id_nota} não encontrada.`);
                error.statusCode = 404;
                throw error;
            }

            // Formata a nova entrada do "chat"
            const timestamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            const novaEntrada = `${timestamp} - ${observacao}`;

            // Concatena a nova entrada com a observação existente
            // Usamos '\n' para criar uma nova linha dentro da célula da planilha
            const observacaoFinal = observacaoAtual ? `${observacaoAtual}\n${novaEntrada}` : novaEntrada;

            // Define o range da célula a ser atualizada
            const range = `${sheetNameNotasFiscais}!${String.fromCharCode(65 + observacaoColIndex)}${rowIndexToUpdate + 1}`;
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFe,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [[observacaoFinal]],
                },
            });

            console.log(`Observação da NF-e ${id_nota} atualizada na linha ${rowIndexToUpdate + 1}.`);
            res.status(200).send({ status: 'success', message: 'Observação adicionada com sucesso!', data: { newObservation: observacaoFinal } });

        } catch (error) {
            next(error);
        }
    });

    return router;
};