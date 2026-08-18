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
        27: "Verificado",
        37589: "Atendido P."
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

    const processingLocks = new Set();

    router.post('/', async (req, res, next) => {
        console.log('--- [WEBHOOK PEDIDO] RECEBIDO ---');
        // Responde imediatamente para evitar timeout do Bling
        res.status(200).send({ status: 'received' });

        (async () => {
            try {
                const { event, data } = req.body;
                const pedidoId = data ? data.id : null;

                if (!pedidoId) {
                    console.warn('[Bling Webhook] ID do pedido ausente.');
                    return;
                }

                // Bloqueio simples em memória para evitar Race Condition (duplicidade) de webhooks simultâneos
                if (processingLocks.has(pedidoId)) {
                    console.log(`[Bling Webhook] Pedido ${pedidoId} já está sendo processado por outra requisição simultânea. Ignorando esta para evitar duplicidade.`);
                    return;
                }
                processingLocks.add(pedidoId);

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
                
                // 3. Ler dados atuais para verificar se o pedido já existe e preservar dados manuais
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:Z`
                });
                const currentSheetData = response.data.values || [];
                const existingRows = currentSheetData.slice(1); // Ignora cabeçalho
                
                let rowIndexToUpdate = -1;
                let dadosManuais = { conferido: "", observacao: "", observacao_frontend: "", id_nota: "" };

                for (let i = 0; i < existingRows.length; i++) {
                    const idNaPlanilha = String(existingRows[i][COLUMNS.ID] || "").trim();
                    if (idNaPlanilha === String(pedidoId).trim()) {
                        rowIndexToUpdate = i + 2; // +1 do cabeçalho, +1 porque Sheets é 1-indexed
                        dadosManuais.conferido = existingRows[i][COLUMNS.CONFERIDO] || "";
                        dadosManuais.observacao = existingRows[i][COLUMNS.OBSERVACAO] || "";
                        dadosManuais.observacao_frontend = existingRows[i][16] || ""; // Coluna Q
                        dadosManuais.id_nota = existingRows[i][COLUMNS.ID_NOTA] || "";
                        break;
                    }
                }

                const rowValues = new Array(18).fill('');  // 18 colunas (A-R)
                
                if (action === 'deleted') {
                    rowValues[COLUMNS.CONFERIDO] = dadosManuais.conferido;
                    rowValues[COLUMNS.ID] = String(pedidoId);
                    rowValues[COLUMNS.SITUACAO] = 'Cancelado (Excluído)';
                    rowValues[COLUMNS.OBSERVACAO] = dadosManuais.observacao;
                    rowValues[16] = dadosManuais.observacao_frontend; // Restaura Coluna Q
                    rowValues[COLUMNS.ID_NOTA] = dadosManuais.id_nota;
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
                    
                    // Preserva a nota se o bling enviar vazio mas a gente já tem gravado
                    const notaDoBling = p.notaFiscal ? (p.notaFiscal.id || "") : "";
                    rowValues[COLUMNS.ID_NOTA] = notaDoBling ? notaDoBling : dadosManuais.id_nota;
                    
                    rowValues[COLUMNS.OBSERVACAO] = dadosManuais.observacao;
                    rowValues[16] = dadosManuais.observacao_frontend; // Restaura Coluna Q
                    rowValues[COLUMNS.ORCAMENTO] = extrairOrcamentoCRM(p.observacoesInternas); // Col P (15) / R (17) dependendo do script

                    // Processamento de Itens com Preservação de Status Manual
                    if (p.itens && Array.isArray(p.itens)) {
                        // 1. Extrair os status atuais da planilha para preservá-los
                        const rawItensExistentes = rowIndexToUpdate !== -1 ? (existingRows[rowIndexToUpdate - 2][COLUMNS.ITENS] || "") : "";
                        const statusMap = {}; // SKU -> Array de Statuses (para lidar com duplicatas)

                        const regex = /\(([^)]+)\)/g;
                        let match;
                        while ((match = regex.exec(rawItensExistentes)) !== null) {
                            const content = match[1];
                            const parts = content.split(',').map(s => s.trim());
                            if (parts.length >= 3) {
                                const sku = parts[0];
                                let status = 'OK';
                                // Tenta pegar status do 4º campo ou via pipe no 3º
                                if (parts.length >= 4) {
                                    status = parts[3];
                                } else if (parts[2].includes('|')) {
                                    status = parts[2].split('|')[1];
                                }
                                
                                if (!statusMap[sku]) statusMap[sku] = [];
                                statusMap[sku].push(status);
                            }
                        }

                        // 2. Mapear os novos itens do Bling, injetando o status preservado se existir
                        rowValues[COLUMNS.ITENS] = p.itens.map(i => {
                            const sku = String(i.codigo || "").trim();
                            let status = "OK"; // Default

                            if (statusMap[sku] && statusMap[sku].length > 0) {
                                status = statusMap[sku].shift(); // Consome o status na ordem de aparição
                            }

                            return `(${sku}, ${parseFloat(i.quantidade).toFixed(2)}, ${parseFloat(i.valor).toFixed(2)}|${status})`;
                        }).join(' ');
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
                        numero: rowValues[COLUMNS.NUMERO] || 'N/A',
                        total: rowValues[COLUMNS.TOTAL_PEDIDO] || 0,
                        evento: rowIndexToUpdate === -1 ? 'created' : 'updated',
                        situacao: rowValues[COLUMNS.SITUACAO],
                        cliente: rowValues[COLUMNS.CONTATO_NOME] || 'N/A',
                        data: p ? p.data : '',
                        vendedor: rowValues[COLUMNS.VENDEDOR] || '',
                        orcamento: rowValues[COLUMNS.ORCAMENTO] || '',
                        id_nota: rowValues[COLUMNS.ID_NOTA] || ''
                    });
                }

                console.log(`[Bling Webhook] Sucesso no processamento do pedido ${pedidoId}`);
                // if (!res.headersSent) res.status(200).send({ status: 'success' });

                // Pequeno atraso para respeitar limites
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error('[Bling Webhook] Erro detectado:', error.message);
            } finally {
                processingLocks.delete(pedidoId);
            }
        })();
    });

    return router;
};
