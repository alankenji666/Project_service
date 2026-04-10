/**
 * Módulo: Webhook Bling Pedidos
 * Descrição: Processa notificações de pedidos do Bling e sincroniza com Google Sheets.
 * Versão: 2.0 - Alinhado com o padrão do Apps Script (13 colunas, dados manuais preservados).
 */
const express = require('express');
const axios = require('axios');

function traduzirSituacaoPedido(id) {
    const s = {
        6: "Em aberto",
        9: "Atendido",
        12: "Cancelado",
        15: "Em andamento",
        18: "Venda agenciada",
        21: "Para entregar",
        24: "Em digitação",
        27: "Verificado"
    };
    return s[id] || "ID: " + id;
}

/**
 * Extrai o número do Orçamento/Pedido CRM do campo observaçõesInternas.
 * Segue a mesma lógica do Apps Script (Apps Script v3.7).
 */
function extrairOrcamentoCRM(texto) {
    if (!texto) return "0";
    const regex = /Pedido\s(\d+-\d+|\d+)/i;
    const match = texto.match(regex);
    return match ? match[1] : "0";
}

module.exports = function(getInitializedSheetsClient, SPREADSHEET_ID, SHEET_NAME, BLING_API_BASE_URL, COLUMNS, APPS_SCRIPT_TOKEN_URL) {
    const router = express.Router();
    let webhookQueue = Promise.resolve();

    router.post('/', async (req, res, next) => {
        console.log('--- [WEBHOOK PEDIDO] RECEBIDO ---');
        
        // Enfileira o processamento para evitar limites de taxa (Rate Limit)
        webhookQueue = webhookQueue.then(async () => {
            try {
                const { event, data } = req.body;
                const pedidoId = data ? data.id : null;

                if (!pedidoId) {
                    console.warn('[Bling Webhook] ID do pedido ausente.');
                    if (!res.headersSent) res.status(200).send({ status: 'ignored', message: 'No ID provided' });
                    return;
                }

                const action = event.split('.')[1] || 'unknown'; // created, updated, deleted
                
                // 1. Obter Token
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
                        throw new Error(`Falha ao buscar dados no Bling para o pedido ${pedidoId}: ${e.message}`);
                    }
                }

                const sheets = await getInitializedSheetsClient();
                
                // 3. Ler dados atuais para verificar se o pedido já existe e preservar dados manuais (Colunas A e M)
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:P`
                });
                const currentSheetData = response.data.values || [];
                const existingRows = currentSheetData.slice(1); // Ignora cabeçalho
                
                let rowIndexToUpdate = -1;
                let dadosManuais = { conferido: "", observacao: "" };

                for (let i = 0; i < existingRows.length; i++) {
                    const idNaPlanilha = String(existingRows[i][COLUMNS.ID] || "").trim();
                    if (idNaPlanilha === String(pedidoId).trim()) {
                        rowIndexToUpdate = i + 2; // +1 do cabeçalho, +1 porque Sheets é 1-indexed
                        dadosManuais.conferido = existingRows[i][COLUMNS.CONFERIDO] || "";
                        dadosManuais.observacao = existingRows[i][COLUMNS.OBSERVACAO] || "";
                        break;
                    }
                }

                const rowValues = new Array(18).fill('');  // 18 colunas (A-R)
                
                if (action === 'deleted') {
                    rowValues[COLUMNS.CONFERIDO] = dadosManuais.conferido;
                    rowValues[COLUMNS.ID] = String(pedidoId);
                    rowValues[COLUMNS.SITUACAO] = 'Cancelado (Excluído)';
                    rowValues[COLUMNS.OBSERVACAO] = dadosManuais.observacao;
                    // Mantém orçamento vazio em deletão
                } else if (!p) {
                    throw new Error(`Dados do pedido ${pedidoId} não encontrados após consulta.`);
                } else {
                    // Lógica de Tradução de Loja e Vendedor (Igual ao seu Apps Script)
                    let origemLoja = "";
                    let vendedorFinal = p.vendedor ? (p.vendedor.contato ? p.vendedor.contato.nome : (p.vendedor.nome || "ID: " + p.vendedor.id)) : "";
                    let lojaIdTratado = String(p.loja ? p.loja.id : "0").trim();

                    switch (lojaIdTratado) {
                        case '0': origemLoja = "Bling"; break;
                        case '205408073': origemLoja = "Mercado Livre"; break;
                        case '205371925': origemLoja = "Loja Integrada"; break;
                        default: origemLoja = lojaIdTratado; break;
                    }

                    if (origemLoja === "Loja Integrada") vendedorFinal = "E-Commerce";

                    rowValues[COLUMNS.CONFERIDO] = dadosManuais.conferido;
                    rowValues[COLUMNS.ID] = String(p.id);
                    rowValues[COLUMNS.NUMERO] = p.numero || "";
                    rowValues[COLUMNS.NUMERO_LOJA] = p.numeroLoja || "";
                    rowValues[COLUMNS.DATA] = p.data ? `'${p.data}` : "";
                    rowValues[COLUMNS.DATA_SAIDA] = p.dataSaida ? `'${p.dataSaida}` : "";
                    rowValues[COLUMNS.SITUACAO] = p.situacao ? traduzirSituacaoPedido(p.situacao.id) : "N/A";
                    rowValues[COLUMNS.CONTATO_NOME] = p.contato ? p.contato.nome : "N/A";
                    rowValues[COLUMNS.CPF_CNPJ] = p.contato ? (p.contato.numeroDocumento || "") : "";
                    rowValues[COLUMNS.TOTAL_PRODUTOS] = p.totalProdutos || 0;
                    rowValues[COLUMNS.TOTAL_PEDIDO] = p.total || 0;
                    rowValues[COLUMNS.VENDEDOR] = vendedorFinal;
                    rowValues[COLUMNS.LOJA] = origemLoja;
                    rowValues[COLUMNS.ID_NOTA] = p.notaFiscal ? (p.notaFiscal.id || "") : "";
                    rowValues[COLUMNS.OBSERVACAO] = dadosManuais.observacao;
                    rowValues[COLUMNS.ORCAMENTO] = extrairOrcamentoCRM(p.observacoesInternas); // Col R

                    if (p.itens && Array.isArray(p.itens)) {
                        rowValues[COLUMNS.ITENS] = p.itens.map(i => `(${i.codigo}, ${parseFloat(i.quantidade).toFixed(2)}, ${parseFloat(i.valor).toFixed(2)})`).join(' ');
                    } else {
                        rowValues[COLUMNS.ITENS] = "";
                    }
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

                if (req.notifySync) {
                    await req.notifySync('pedidoBlingReceived', {
                        id: pedidoId,
                        numero: p ? p.numero : 'N/A',
                        total: p ? p.total : 0,
                        evento: action,
                        situacao: rowValues[COLUMNS.SITUACAO]
                    });
                }

                console.log(`[Bling Webhook] Sucesso no processamento do pedido ${pedidoId}`);
                if (!res.headersSent) res.status(200).send({ status: 'success' });

                // Pequeno atraso para respeitar limites
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error('[Bling Webhook] Erro no processamento da fila:', error.message);
                if (!res.headersSent) res.status(500).send({ status: 'error', message: error.message });
                // Resolvemos com erro para manter a fila viva e permitir os próximos
            }
        }).catch((fatalError) => {
            console.error('[Bling Webhook] Erro FATAL na Promise-chain:', fatalError);
            if (!res.headersSent) res.status(500).send({ status: 'fatal_error' });
        });
    });

    return router;
};
