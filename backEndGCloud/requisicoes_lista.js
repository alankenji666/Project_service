const express = require('express');

module.exports = function(getInitializedSheetsClient, spreadsheetId, sheetName) {
    const router = express.Router();

    // Utilitário para normalizar o nome da coluna para usar como chave do JSON
    function normalizeHeader(header) {
        if (!header) return '';
        return header
            .toString()
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/ /g, '_') // Troca espaço por _
            .replace(/-/g, '_'); // Troca - por _
    }

    router.get('/', async (req, res, next) => {
        try {
            console.log(`[Requisições] Iniciando busca na planilha ${spreadsheetId}, aba: ${sheetName}...`);
            const sheets = await getInitializedSheetsClient();

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A:Z`
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return res.json({ error: false, message: "Nenhum dado encontrado.", data: [] });
            }

            // A primeira linha é o cabeçalho
            const headers = rows[0].map(normalizeHeader);

            // Mapear as linhas para objetos JSON
            const data = rows.slice(1).map(row => {
                const rowObj = {};
                headers.forEach((header, index) => {
                    if (header) {
                        rowObj[header] = row[index] || '';
                    }
                });

                // Tratamentos específicos:
                
                // Observação: O painel (main.js) espera um array, mesmo que vazio
                let obsStr = rowObj['observacao'];
                // O Apps Script podia retornar um array ou string dependendo da lógica. 
                // Se mandarmos array de string ou string, vamos mandar array se houver algo, e [] se vazio
                if (!obsStr) {
                    rowObj['observacao'] = [];
                } else if (typeof obsStr === 'string' && obsStr.startsWith('[') && obsStr.endsWith(']')) {
                    try {
                        rowObj['observacao'] = JSON.parse(obsStr);
                    } catch (e) {
                        rowObj['observacao'] = [obsStr];
                    }
                } else {
                    rowObj['observacao'] = [obsStr];
                }

                // Conversões numéricas básicas se necessário
                if (rowObj['quantidade_pedido']) {
                    rowObj['quantidade_pedido'] = Number(rowObj['quantidade_pedido']) || rowObj['quantidade_pedido'];
                }
                if (rowObj['dias_corridos']) {
                    rowObj['dias_corridos'] = Number(rowObj['dias_corridos']) || rowObj['dias_corridos'];
                }

                return rowObj;
            });

            // Filtrar linhas vazias baseando-se na requisição
            const validData = data.filter(item => item.requisicao && item.requisicao !== '');

            // Retornar no formato esperado pelo frontend
            return res.status(200).json({
                error: false,
                message: "Dados obtidos com sucesso.",
                data: validData
            });

        } catch (error) {
            console.error(`[Requisições] Erro ao buscar dados de ${sheetName}:`, error);
            next(error);
        }
    });

    return router;
};
