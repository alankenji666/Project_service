/**
 * Módulo: Webhook Bling NF-e
 * Descrição: Processa notificações do Bling e sincroniza com Google Sheets com formatação automática.
 * Versão: 6.8 - Correção de Negrito, Alinhamento e Localização de Linhas.
 */
const express = require('express');
const axios = require('axios');

// --- FUNÇÕES AUXILIARES DE TRADUÇÃO E FORMATAÇÃO ---

function traduzirSituacaoNFe(situacaoId) {
    const situacoes = { 
        1: "Pendente", 2: "Cancelada", 3: "Aguardando", 4: "Rejeitada", 
        5: "Autorizada", 6: "Emitida DANFE", 7: "Registrada", 8: "Aguardando", 
        9: "Denegada", 10: "Consulta", 11: "Bloqueada" 
    };
    return situacoes[situacaoId] || `Status ${situacaoId}`;
}

function traduzirFretePorConta(codigo) {
    const tiposFrete = { 0: "CIF", 1: "FOB", 2: "Terceiros", 9: "Sem Frete" };
    return tiposFrete[codigo] || "N/A";
}

function formatarNumeroNota(numero) {
    if (!numero) return "";
    return String(numero).trim().padStart(6, '0');
}

const cacheVendedores = new Map();

module.exports = function(getInitializedSheetsClient, SPREADSHEET_ID_NFE, SHEET_NAME_NOTAS_FISCAIS, BLING_API_BASE_URL, COLUMNS_NFE, APPS_SCRIPT_TOKEN_URL) {
    const router = express.Router();

    /**
     * Aplica formatação visual (remove negrito, ajusta fonte e alinhamento)
     */
    async function formatarLinhaPadrao(sheets, spreadsheetId, sheetId, rowIndex) {
        try {
            const requests = [{
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: rowIndex - 1,
                        endRowIndex: rowIndex,
                        startColumnIndex: 0,
                        endColumnIndex: 20
                    },
                    cell: {
                        userEnteredFormat: {
                            textFormat: { bold: false, fontSize: 10, fontFamily: 'Roboto' },
                            verticalAlignment: 'MIDDLE'
                        }
                    },
                    fields: 'userEnteredFormat(textFormat,verticalAlignment)'
                }
            }];
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests }
            });
        } catch (e) {
            console.error('[Format] Erro ao formatar linha:', e.message);
        }
    }

    async function buscarNomeVendedor(vendedorId, token) {
        if (!vendedorId) return "";
        const vIdStr = String(vendedorId);
        if (cacheVendedores.has(vIdStr)) return cacheVendedores.get(vIdStr);
        try {
            const res = await axios.get(`${BLING_API_BASE_URL}/vendedores/${vIdStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const nome = res.data.data?.contato?.nome || res.data.data?.nome || `ID: ${vIdStr}`;
            cacheVendedores.set(vIdStr, nome);
            return nome;
        } catch (e) { return `ID: ${vIdStr}`; }
    }

    router.post('/', async (req, res, next) => {
        console.log('--- [WEBHOOK] PROCESSANDO NOTA ---');
        try {
            const { event, data } = req.body;
            const nfeId = data ? data.id : null;
            if (!nfeId) {
                const error = new Error('ID da nota ausente no payload.');
                error.statusCode = 400;
                throw error;
            }

            const tokenRes = await axios.get(APPS_SCRIPT_TOKEN_URL);
            const token = tokenRes.data.access_token;

            const action = event === 'invoice.deleted' ? 'deleted' : (event === 'invoice.created' ? 'created' : 'updated');

            let n;
            if (action !== 'deleted') {
                const blingRes = await axios.get(`${BLING_API_BASE_URL}/nfe/${nfeId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                n = blingRes.data.data;
                if (!n) {
                    const error = new Error("Nota não encontrada no Bling.");
                    error.statusCode = 404;
                    throw error;
                }
            }

            const sheets = await getInitializedSheetsClient();
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID_NFE });
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === SHEET_NAME_NOTAS_FISCAIS.trim());
            const sheetId = sheet.properties.sheetId;

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID_NFE,
                range: `${SHEET_NAME_NOTAS_FISCAIS.trim()}!A:Z`
            });
            const currentSheetData = response.data.values || [];
            const existingRows = currentSheetData.slice(1);
            
            let rowIndexToUpdate = -1;
            let dadosManuais = { conferido: "", observacao: "" };

            for (let i = 0; i < existingRows.length; i++) {
                const idNaPlanilha = String(existingRows[i][COLUMNS_NFE.ID_NOTA] || "").trim();
                if (idNaPlanilha === String(nfeId).trim()) {
                    rowIndexToUpdate = i + 2; 
                    dadosManuais.conferido = existingRows[i][COLUMNS_NFE.CONFERIDO] || "";
                    dadosManuais.observacao = existingRows[i][COLUMNS_NFE.OBSERVACAO] || "";
                    break;
                }
            }

            const rowValues = new Array(18).fill('');
            if (action === 'deleted') {
                rowValues[COLUMNS_NFE.ID_NOTA] = String(nfeId);
                rowValues[COLUMNS_NFE.SITUACAO] = "Cancelada (Excluída)";
                rowValues[COLUMNS_NFE.CONFERIDO] = dadosManuais.conferido;
                rowValues[COLUMNS_NFE.OBSERVACAO] = dadosManuais.observacao;
            } else {
                let vendedorFinal = n.vendedor?.contato?.nome || n.vendedor?.nome || "";
                if (!vendedorFinal && n.vendedor?.id) vendedorFinal = await buscarNomeVendedor(n.vendedor.id, token);

                let origemLoja = "";
                switch (String(n.loja?.id).trim()) {
                    case '205371925': origemLoja = "Loja Integrada"; vendedorFinal = "E-Commerce"; break;
                    case '205408073': origemLoja = "Mercado Livre"; break;
                    case '0': origemLoja = "Bling"; break;
                    default: origemLoja = n.loja?.id || "Bling";
                }

                rowValues[COLUMNS_NFE.CONFERIDO] = dadosManuais.conferido;
                rowValues[COLUMNS_NFE.ID_NOTA] = String(n.id);
                rowValues[COLUMNS_NFE.NUMERO_NOTA] = formatarNumeroNota(n.numero);
                rowValues[COLUMNS_NFE.SERIE] = n.serie || "0";
                rowValues[COLUMNS_NFE.DATA_EMISSAO] = n.dataEmissao ? new Date(n.dataEmissao).toLocaleDateString('pt-BR') : "";
                rowValues[COLUMNS_NFE.CHAVE_ACESSO] = n.chaveAcesso || "";
                rowValues[COLUMNS_NFE.SITUACAO] = traduzirSituacaoNFe(n.situacao);
                rowValues[COLUMNS_NFE.VALOR_NOTA] = n.valorNota || 0;
                rowValues[COLUMNS_NFE.VALOR_FRETE] = n.valorFrete || 0;
                rowValues[COLUMNS_NFE.NOME_CLIENTE] = n.contato?.nome || "";
                rowValues[COLUMNS_NFE.CNPJ_CPF_CLIENTE] = n.contato?.numeroDocumento || "";
                rowValues[COLUMNS_NFE.NOME_VENDEDOR] = vendedorFinal;
                rowValues[COLUMNS_NFE.NUMERO_PEDIDO_LOJA] = n.numeroPedidoLoja || "";
                rowValues[COLUMNS_NFE.TRANSPORTADORA] = n.transporte?.transportador?.nome || "";
                rowValues[COLUMNS_NFE.FRETE_POR_CONTA] = traduzirFretePorConta(n.transporte?.fretePorConta);
                rowValues[COLUMNS_NFE.ORIGEM_LOJA] = origemLoja;
                rowValues[COLUMNS_NFE.LINK_DANFE] = n.linkDanfe || "";
                rowValues[COLUMNS_NFE.OBSERVACAO] = dadosManuais.observacao;
                rowValues[18] = n.itens ? n.itens.map(i => {
                    const cod = i.codigo || 0;
                    const qtd = parseFloat(i.quantidade || 0).toFixed(2);
                    const vlr = parseFloat(i.valor || 0).toFixed(2);
                    return `(${cod}, ${qtd}, ${vlr})`;
                }).join("; ") : "";
            }

            if (rowIndexToUpdate !== -1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID_NFE,
                    range: `${SHEET_NAME_NOTAS_FISCAIS.trim()}!A${rowIndexToUpdate}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [rowValues] }
                });
                await formatarLinhaPadrao(sheets, SPREADSHEET_ID_NFE, sheetId, rowIndexToUpdate);
            } else {
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID_NFE,
                    range: `${SHEET_NAME_NOTAS_FISCAIS.trim()}!A:A`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: [rowValues] }
                });
                const newRow = currentSheetData.length + 1;
                await formatarLinhaPadrao(sheets, SPREADSHEET_ID_NFE, sheetId, newRow);
            }

            // 5. Notificar via Firestore Sync (Tempo Real)
            if (req.notifySync) {
                const numeroNf = n ? n.numero : (data ? data.numero : 'N/A');
                console.log(`[Firestore Sync] Notificando nova NF-e recebida: ${numeroNf}`);
                req.notifySync('nfeReceived', {
                    numero: numeroNf,
                    cliente: n ? n.contato?.nome : 'N/A',
                    valor: n ? n.valorNota : 0
                });
            }

            res.status(200).send({ status: 'success' });
        } catch (error) {
            next(error);
        }
    });

    return router;
};