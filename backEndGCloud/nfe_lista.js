const express = require('express');

module.exports = function(getInitializedSheetsClient, spreadsheetIdTerceiros, sheetNameNotasFiscais, COLUMNS_NFE) {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            console.log('[NFE Lista] Iniciando busca das NFE...');
            const sheets = await getInitializedSheetsClient();

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdTerceiros,
                range: `${sheetNameNotasFiscais}!A:Z`
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return res.json({ error: false, message: "Nenhum dado encontrado.", data: [] });
            }

            // A primeira linha é o cabeçalho, então começamos a partir do índice 1
            const data = rows.slice(1).map(row => {
                // Função utilitária para pegar o valor de forma segura
                const getVal = (index) => row[index] || '';

                // Converter string vazia para número apropriado se aplicável, ou manter o original
                let idNotaStr = getVal(COLUMNS_NFE.ID_NOTA);
                let idNota = idNotaStr ? Number(idNotaStr) : '';

                let numeroNotaStr = getVal(COLUMNS_NFE.NUMERO_NOTA);
                let numeroNota = numeroNotaStr ? Number(numeroNotaStr) : '';

                let serieStr = getVal(COLUMNS_NFE.SERIE);
                let serie = serieStr ? Number(serieStr) : 0;

                let valorNotaStr = getVal(COLUMNS_NFE.VALOR_NOTA).toString().replace(',', '.');
                let valorNota = valorNotaStr ? parseFloat(valorNotaStr) : 0;

                let valorFreteStr = getVal(COLUMNS_NFE.VALOR_FRETE).toString().replace(',', '.');
                let valorFrete = valorFreteStr ? parseFloat(valorFreteStr) : 0;

                // Para observação, no Apps Script original, parecia retornar array vazio se estivesse vazio ou string se tivesse conteúdo. 
                let observacaoStr = getVal(COLUMNS_NFE.OBSERVACAO);
                let observacao = observacaoStr ? observacaoStr : [];

                return {
                    conferido: getVal(COLUMNS_NFE.CONFERIDO),
                    id_nota: idNota,
                    numero_da_nota: numeroNota,
                    serie: serie,
                    data_de_emissao: getVal(COLUMNS_NFE.DATA_EMISSAO),
                    chave_de_acesso: getVal(COLUMNS_NFE.CHAVE_ACESSO),
                    situacao: getVal(COLUMNS_NFE.SITUACAO),
                    valor_da_nota: valorNota,
                    valor_do_frete: valorFrete,
                    nome_do_cliente: getVal(COLUMNS_NFE.NOME_CLIENTE),
                    cnpjcpf_cliente: getVal(COLUMNS_NFE.CNPJ_CPF_CLIENTE),
                    nome_do_vendedor: getVal(COLUMNS_NFE.NOME_VENDEDOR),
                    numero_pedido_loja: getVal(COLUMNS_NFE.NUMERO_PEDIDO_LOJA),
                    transportadora: getVal(COLUMNS_NFE.TRANSPORTADORA),
                    frete_por_conta: getVal(COLUMNS_NFE.FRETE_POR_CONTA),
                    origem_loja: getVal(COLUMNS_NFE.ORIGEM_LOJA),
                    link_danfe: getVal(COLUMNS_NFE.LINK_DANFE),
                    observacao: observacao,
                    itens: getVal(COLUMNS_NFE.ITENS),
                    natureza_de_operacao: getVal(COLUMNS_NFE.NATUREZA)
                };
            });

            // Filtrar linhas vazias
            const validData = data.filter(item => item.id_nota !== '' && item.numero_da_nota !== '');

            // Retornar no formato esperado pelo frontend
            return res.status(200).json({
                error: false,
                message: "Dados obtidos com sucesso.",
                data: validData
            });

        } catch (error) {
            console.error('[NFE Lista] Erro ao buscar lista de NFE:', error);
            next(error);
        }
    });

    return router;
};
