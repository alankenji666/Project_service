const express = require('express');

const createSaidasEstoqueReadRouter = (getInitializedSheetsClient, SPREADSHEET_ID, SHEET_NAME) => {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            console.log(`[SAIDAS-ESTOQUE] Buscando dados da planilha ${SPREADSHEET_ID}, aba: ${SHEET_NAME}`);
            const sheets = await getInitializedSheetsClient();
            
            // Lê da linha 2 até a linha 5000 (ignorando o cabeçalho)
            // A coluna Tipo é I (índice 8). Coluna J (índice 9) é Data Envio.
            // Para garantir que pegamos as observações, vamos ler até Z.
            const range = `'${SHEET_NAME}'!A2:Z5000`;
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: range,
            });

            const rows = response.data.values || [];
            console.log(`[SAIDAS-ESTOQUE] Foram lidas ${rows.length} linhas.`);

            const data = rows.map(row => {
                // A coluna Tipo (I) é o índice 8 na matriz (0-indexed)
                // A coluna Responsável (M) seria o índice 12 (0-indexed) assumindo as colunas do screenshot:
                // A=Requisição, B=Codigo Service, C=Codigo MKS, D=Descrição, E=Localização, F=Quantidade, G=Situação, H=Data Pedido, I=Tipo, J=Data Envio, K=Observação, L=Responsável
                // Pelo screenshot do Google Sheets:
                // A=Requisição, B=Codigo Service, C=Codigo MKS, D=Descrição, E=Localização, F=Quantidade, G=Situação, H=Data Pedido, I=Tipo, J=Data Envio, K=Observação, L=Responsável
                
                // Parse observacao: o Google Sheets pode retornar uma string para uma coluna, nós vamos converter para array se não for
                let observacao = row[10] || '';
                let obsArray = [];
                if (observacao) {
                    obsArray = [observacao]; // A lógica anterior do Apps Script tratava isso como array de strings
                }

                return {
                    requisicao: row[0] || '',
                    codigo_service: row[1] || '',
                    codigo_mks_equipamentos: row[2] || '',
                    descricao: row[3] || '',
                    localizacao: row[4] || '',
                    quantidade: row[5] || '',
                    situacao: row[6] || '',
                    data_pedido: row[7] || '',
                    tipo: row[8] || '', 
                    data_envio: row[9] || '',
                    observacao: obsArray,
                    responsavel: row[11] || ''
                };
            }).filter(item => item.requisicao !== ''); // Filtra linhas vazias

            res.status(200).send({
                status: 'success',
                data: data
            });
        } catch (error) {
            console.error('[SAIDAS-ESTOQUE] Erro ao buscar saídas:', error.message);
            res.status(500).send({
                status: 'error',
                message: 'Erro interno ao buscar dados de saídas de estoque.'
            });
        }
    });

    return router;
};

module.exports = createSaidasEstoqueReadRouter;
