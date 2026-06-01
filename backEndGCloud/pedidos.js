const express = require('express');
const axiosModule = require('axios'); // Usaremos o nome axiosModule para não conflitar com o parâmetro

const createPedidosRouter = (getSheetsClient, spreadsheetIdNFE, sheetNamePedidosBling, axios, APPS_SCRIPT_TOKEN_URL, BLING_API_BASE_URL, notifySync) => {
    const router = express.Router();
    const sheetNameLinhaProducao = 'LinhaProducao';

    function colToA1(index) {
        let temp, letter = '';
        while (index > 0) {
            temp = (index - 1) % 26;
            letter = String.fromCharCode(65 + temp) + letter;
            index = (index - temp - 1) / 26;
        }
        return letter || 'A';
    }

    async function getToken() {
        try {
            // Usa o axios injetado se disponível, caso contrário usa o módulo
            const httpClient = axios || axiosModule;
            const response = await httpClient.get(APPS_SCRIPT_TOKEN_URL);
            return response.data.access_token || response.data.accessToken;
        } catch (err) {
            console.error("Erro ao obter token do Apps Script:", err.message);
            throw new Error("Falha ao obter token de acesso.");
        }
    }

    router.get('/', async (req, res, next) => {
        try {
            const sheets = await getSheetsClient();
            const response = await sheets.spreadsheets.values.batchGet({
                spreadsheetId: spreadsheetIdNFE,
                ranges: [`${sheetNamePedidosBling}!A:Z`, `${sheetNameLinhaProducao}!A:Z`],
            });
            const rows = response.data.valueRanges[0].values || [];
            const producaoRows = response.data.valueRanges[1].values || [];
            if (rows.length === 0) return res.status(200).send({ status: 'success', data: [] });

            const headersNorm = rows[0].map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[\/\(\)]/g, '_'));

            const producaoMap = {};
            if (producaoRows && producaoRows.length > 1) {
                const pHeaders = producaoRows[0].map(h => (h || '').toLowerCase().trim());
                const hId = pHeaders.indexOf('pedidoid');
                const hIdx = pHeaders.indexOf('itemindex');
                const hSt = pHeaders.indexOf('status');
                const hDesc = pHeaders.indexOf('descricaocomplementar');
                const hQty = pHeaders.indexOf('quantidade');
                const hDate = pHeaders.indexOf('data');

                producaoRows.slice(1).forEach(row => {
                    const pid = String(row[hId] || '').trim();
                    const pidx = String(row[hIdx] || '').trim();
                    if (pid && pidx !== '') {
                        producaoMap[`${pid}-${pidx}`] = {
                            status: hSt !== -1 ? (row[hSt] || 'OK') : 'OK',
                            descricao: hDesc !== -1 ? (row[hDesc] || '') : '',
                            quantidade: hQty !== -1 ? (row[hQty] || '') : '',
                            data: hDate !== -1 ? (row[hDate] || '') : ''
                        };
                    }
                });
            }

            const pedidos = rows.slice(1).map(row => {
                const obj = {};
                headersNorm.forEach((h, i) => { if (h) obj[h] = row[i] || ''; });
                if (row.length > 16) obj['observacao'] = row[16] || '';
                if (obj.id_pedido) obj.id = obj.id_pedido;
                const pid = String(obj.id_pedido || obj.id || '').trim();
                const pnum = String(obj.numero_pedido || obj.numero || '').trim();
                obj.detalhesProducao = {};
                Object.keys(producaoMap).forEach(key => {
                    const [keyPid, keyIdx] = key.split('-');
                    if (keyPid === pid || keyPid === pnum) {
                        obj.detalhesProducao[key] = producaoMap[key];
                        obj.detalhesProducao[`${pid}-${keyIdx}`] = producaoMap[key];
                        obj.detalhesProducao[`${pnum}-${keyIdx}`] = producaoMap[key];
                    }
                });
                return obj;
            });
            res.status(200).send({ status: 'success', data: pedidos });
        } catch (error) { next(error); }
    });

    router.post('/update-item-status', async (req, res, next) => {
        try {
            const { pedidoId, itemCodigo, newStatus, itemIndex, newDescription, numeroPedido, quantidade } = req.body;
            const idParaPlanilha = numeroPedido || pedidoId;
            if (!idParaPlanilha) throw new Error("Identificação do pedido é obrigatória.");

            const sheets = await getSheetsClient();
            const pResp = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A:Z` });
            let pRows = pResp.data.values || [];
            
            let pHeaders = [];
            if (pRows.length > 0) {
                pHeaders = pRows[0].map(h => (h || '').toLowerCase().trim());
                let changed = false;
                if (pHeaders.indexOf('quantidade') === -1) {
                    pHeaders.push('quantidade');
                    changed = true;
                }
                if (pHeaders.indexOf('data') === -1) {
                    pHeaders.push('data');
                    changed = true;
                }
                if (changed) {
                    await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [pHeaders] } });
                }
            } else {
                pHeaders = ['pedidoid', 'sku', 'itemindex', 'status', 'quantidade', 'data', 'descricaocomplementar'];
                await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [pHeaders] } });
                pRows = [pHeaders];
            }

            const hId = pHeaders.indexOf('pedidoid');
            const hIdx = pHeaders.indexOf('itemindex');
            const hDesc = pHeaders.indexOf('descricaocomplementar');
            const hSt = pHeaders.indexOf('status');
            const hSku = pHeaders.indexOf('sku');
            const hQty = pHeaders.indexOf('quantidade');
            const hDate = pHeaders.indexOf('data');

            let foundIdx = -1;
            for (let i = 1; i < pRows.length; i++) {
                const rowPid = String(pRows[i][hId]).trim();
                if ((rowPid === String(pedidoId).trim() || rowPid === String(numeroPedido).trim()) && String(pRows[i][hIdx]).trim() === String(itemIndex).trim()) {
                    foundIdx = i; break;
                }
            }

            const { dataPedido } = req.body;
            let finalStatus = newStatus;
            let finalDesc = newDescription;
            let finalQty = quantidade;
            let finalDate = dataPedido;

            if (foundIdx !== -1) {
                if (finalStatus === undefined && hSt !== -1) finalStatus = pRows[foundIdx][hSt];
                if (finalDesc === undefined && hDesc !== -1) finalDesc = pRows[foundIdx][hDesc];
                if (finalQty === undefined && hQty !== -1) finalQty = pRows[foundIdx][hQty];
                if (finalDate === undefined && hDate !== -1) finalDate = pRows[foundIdx][hDate];
            }

            const rowData = new Array(pHeaders.length).fill('');
            if (hId !== -1) rowData[hId] = idParaPlanilha;
            if (hSku !== -1) rowData[hSku] = itemCodigo;
            if (hIdx !== -1) rowData[hIdx] = itemIndex;
            if (hSt !== -1) rowData[hSt] = finalStatus || 'OK';
            if (hQty !== -1) rowData[hQty] = finalQty || '';
            if (hDate !== -1) rowData[hDate] = finalDate || '';
            if (hDesc !== -1) rowData[hDesc] = finalDesc || '';

            if (foundIdx !== -1) {
                await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A${foundIdx + 1}`, valueInputOption: 'RAW', resource: { values: [rowData] } });
            } else {
                await sheets.spreadsheets.values.append({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [rowData] } });
            }

            if (finalStatus !== undefined) {
                const mResp = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNamePedidosBling}!A:Z` });
                const mRows = mResp.data.values || [];
                if (mRows.length > 0) {
                    const mHeaders = mRows[0].map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_'));
                    const iCol = mHeaders.indexOf('itens');
                    const idCol = mHeaders.indexOf('id_pedido') !== -1 ? mHeaders.indexOf('id_pedido') : mHeaders.indexOf('id');
                    const numCol = mHeaders.indexOf('numero');
                    let mIdx = -1;
                    for (let i = 1; i < mRows.length; i++) {
                        if (String(mRows[i][idCol]).trim() === String(pedidoId).trim() || String(mRows[i][numCol]).trim() === String(numeroPedido || pedidoId).trim()) {
                            mIdx = i; break;
                        }
                    }
                    if (mIdx !== -1 && iCol !== -1) {
                        const raw = mRows[mIdx][iCol] || '';
                        const items = [];
                        const itemStrings = String(raw).split(/(?=\([^,]+,\s*\d+)/).filter(Boolean);
                        itemStrings.forEach((s, i) => {
                            let c = s.trim();
                            if (c.startsWith('(')) c = c.substring(1);
                            if (c.endsWith(')')) { if (((c.match(/\(/g) || []).length < (c.match(/\)/g) || []).length)) c = c.substring(0, c.length - 1); }
                            const p = c.split(',').map(x => x.trim());
                            if (p.length >= 3) {
                                let v = p[2]; let st = 'OK';
                                if (v.includes('|')) { const sp = v.split('|'); v = sp[0]; st = sp[1] || 'OK'; }
                                if (String(i) === String(itemIndex)) st = finalStatus;
                                items.push(`(${p[0]}, ${p[1]}, ${v}|${st})`);
                            }
                        });
                        await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${colToA1(iCol + 1)}${mIdx + 1}`, valueInputOption: 'RAW', resource: { values: [[items.join(' ')]] } });
                    }
                }
            }
            if (typeof notifySync === 'function') notifySync('orderItemStatusUpdated', { pedidoId, itemCodigo, newStatus: finalStatus, newDescription: finalDesc, itemIndex, quantidade: finalQty, dataPedido: finalDate });
            res.status(200).send({ status: 'success' });
        } catch (error) { next(error); }
    });

    router.post('/update-status', async (req, res, next) => {
        try {
            const { ids, idSituacao } = req.body;
            if (!ids || !Array.isArray(ids)) throw new Error("Lista de IDs inválida.");
            
            const accessToken = await getToken();
            const httpClient = axios || axiosModule;
            const results = { sucessos: [], erros: [] };
            
            for (const id of ids) {
                try {
                    console.log(`[Bling] Tentando atualizar pedido ${id} para situação ${idSituacao}`);
                    await httpClient.patch(`${BLING_API_BASE_URL}/pedidos/vendas/${id}/situacoes/${idSituacao}`, {}, { 
                        headers: { 'Authorization': `Bearer ${accessToken}` } 
                    });
                    results.sucessos.push(id);
                } catch (err) {
                    const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
                    console.error(`[Bling Error] Pedido ${id}:`, errMsg);
                    results.erros.push({ id, erro: errMsg });
                }
            }

            // Tradução para sincronia com a planilha
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

            // Se houver algum sucesso, atualiza também diretamente na planilha do Google Sheets
            if (results.sucessos.length > 0) {
                try {
                    const sheets = await getSheetsClient();
                    const mResp = await sheets.spreadsheets.values.get({ 
                        spreadsheetId: spreadsheetIdNFE, 
                        range: `${sheetNamePedidosBling}!A:Z` 
                    });
                    const mRows = mResp.data.values || [];
                    if (mRows.length > 0) {
                        const mHeaders = mRows[0].map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_'));
                        const idCol = mHeaders.indexOf('id_pedido') !== -1 ? mHeaders.indexOf('id_pedido') : (mHeaders.indexOf('id') !== -1 ? mHeaders.indexOf('id') : mHeaders.indexOf('id_pedido_bling'));
                        const numCol = mHeaders.indexOf('numero');
                        const sitCol = mHeaders.indexOf('situacao');

                        if (sitCol !== -1) {
                            const newStatusLabel = traduzirSituacaoPedido(idSituacao);
                            for (const id of results.sucessos) {
                                let mIdx = -1;
                                for (let i = 1; i < mRows.length; i++) {
                                    if (String(mRows[i][idCol]).trim() === String(id).trim() || String(mRows[i][numCol]).trim() === String(id).trim()) {
                                        mIdx = i;
                                        break;
                                    }
                                }
                                if (mIdx !== -1) {
                                    console.log(`[update-status] Sincronizando planilha para pedido ${id} (linha ${mIdx + 1}) -> "${newStatusLabel}"`);
                                    await sheets.spreadsheets.values.update({
                                        spreadsheetId: spreadsheetIdNFE,
                                        range: `${sheetNamePedidosBling}!${colToA1(sitCol + 1)}${mIdx + 1}`,
                                        valueInputOption: 'USER_ENTERED',
                                        resource: { values: [[newStatusLabel]] }
                                    });
                                }
                            }
                        }
                    }
                } catch (sheetErr) {
                    console.error("[update-status] Erro ao sincronizar planilha em update-status:", sheetErr.message);
                }
            }

            res.status(200).send({ status: results.erros.length > 0 ? 'partial_success' : 'success', data: results });
        } catch (error) { 
            console.error("[Backend Error] update-status:", error.message);
            res.status(500).send({ status: 'error', message: error.message });
        }
    });

    router.post('/observacao', async (req, res, next) => {
        try {
            const { numero_do_pedido, observacao, senderId } = req.body;
            const sheets = await getSheetsClient();
            const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNamePedidosBling}!A:Z` });
            const rows = response.data.values || [];
            const headers = rows[0].map(h => (h || '').toLowerCase().trim());
            const obsCol = 16;
            let rIdx = -1;
            for (let i = 1; i < rows.length; i++) {
                const idVal = String(rows[i][headers.indexOf('id pedido')] || rows[i][headers.indexOf('id')] || '').trim();
                const numVal = String(rows[i][headers.indexOf('numero')] || '').trim();
                if (idVal === String(numero_do_pedido) || numVal === String(numero_do_pedido)) { rIdx = i; break; }
            }
            if (rIdx === -1) throw new Error("Pedido não encontrado.");
            const obsAt = rows[rIdx][obsCol] || '';
            const obsFin = obsAt ? `${obsAt}\\n${new Date().toLocaleString('pt-BR')} - ${observacao}` : `${new Date().toLocaleString('pt-BR')} - ${observacao}`;
            await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNamePedidosBling}!${colToA1(obsCol + 1)}${rIdx + 1}`, valueInputOption: 'RAW', resource: { values: [[obsFin]] } });
            if (typeof notifySync === 'function') notifySync('orderObservationUpdated', { numeroPedido: String(numero_do_pedido), novaObservacao: obsFin, senderId });
            res.status(200).send({ status: 'success' });
        } catch (error) { next(error); }
    });

    /**
     * NOVO: Rota para gerar uma NF-e a partir de um pedido de venda no Bling.
     * Segue o fluxo da API V3: criar a nota referenciando o pedido e depois enviar.
     */
    router.post('/vendas/:id/gerar-nfe', async (req, res, next) => {
        try {
            const idPedido = req.params.id;
            if (!idPedido) throw new Error("ID do pedido é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;

            console.log(`[Bling] Iniciando processo de NF-e para pedido ${idPedido}...`);

            // 1. Buscar o pedido original para obter dados básicos (contato, natureza, etc.)
            console.log(`[Bling] Buscando detalhes do pedido ${idPedido}...`);
            let pedidoBling;
            try {
                const resPedido = await httpClient.get(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                pedidoBling = resPedido.data.data;
            } catch (err) {
                console.warn(`[Bling] Não foi possível obter detalhes do pedido ${idPedido}. Tentando criar nota apenas com o ID.`);
            }

            // 2. Criar a Nota Fiscal referenciando o Pedido de Venda
            // Incluímos referências explícitas ao contato e natureza para evitar erros de "Não foi possível salvar"
            const payloadCriacao = {
                tipo: 1, // 1 = Saída
                pedido: { id: parseInt(idPedido) }
            };

            if (pedidoBling) {
                if (pedidoBling.contato && pedidoBling.contato.id) {
                    payloadCriacao.contato = { id: pedidoBling.contato.id };
                }
                if (pedidoBling.naturezaOperacao && pedidoBling.naturezaOperacao.id) {
                    payloadCriacao.naturezaOperacao = { id: pedidoBling.naturezaOperacao.id };
                }
                if (pedidoBling.data) {
                    payloadCriacao.dataOperacao = pedidoBling.data; // Formato YYYY-MM-DD
                }
                // Finalidade 1 = NF-e normal
                payloadCriacao.finalidade = 1;

                // Bling V3 exige que os itens da nota sejam passados
                if (pedidoBling.itens && Array.isArray(pedidoBling.itens)) {
                    payloadCriacao.itens = pedidoBling.itens.map(item => ({
                        codigo: item.codigo || "",
                        descricao: item.descricao || "",
                        quantidade: item.quantidade || 1,
                        valor: item.valor || 0
                    }));
                }

                // Repassar o frete e informações de volume para a nota fiscal
                if (pedidoBling.transporte) {
                    payloadCriacao.transporte = {
                        fretePorConta: pedidoBling.transporte.fretePorConta !== undefined ? pedidoBling.transporte.fretePorConta : 0,
                        frete: pedidoBling.transporte.frete || 0,
                        quantidadeVolumes: pedidoBling.transporte.quantidadeVolumes || 0,
                        pesoBruto: pedidoBling.transporte.pesoBruto || 0,
                        pesoLiquido: pedidoBling.transporte.pesoBruto || 0
                    };
                    if (pedidoBling.transporte.contato && pedidoBling.transporte.contato.id) {
                        payloadCriacao.transporte.contato = { id: pedidoBling.transporte.contato.id };
                    }
                }

                // Repassar parcelas (pagamento)
                if (pedidoBling.parcelas && Array.isArray(pedidoBling.parcelas) && pedidoBling.parcelas.length > 0) {
                    payloadCriacao.parcelas = pedidoBling.parcelas.map(p => {
                        const parcelaObj = {
                            data: p.dataVencimento || payloadCriacao.dataOperacao,
                            valor: p.valor || 0,
                            observacoes: p.observacoes || ""
                        };
                        if (p.formaPagamento && p.formaPagamento.id) {
                            parcelaObj.formaPagamento = { id: p.formaPagamento.id };
                        }
                        return parcelaObj;
                    });
                }

                // Repassar o desconto para a nota fiscal
                if (pedidoBling.desconto && pedidoBling.desconto.valor > 0) {
                    payloadCriacao.desconto = {
                        valor: pedidoBling.desconto.valor,
                        unidade: pedidoBling.desconto.unidade || 'REAL'
                    };
                }
            }

            console.log(`[Bling] Enviando payload para criação de NF-e: ${JSON.stringify(payloadCriacao)}`);

            let idNota;
            try {
                const resCriacao = await httpClient.post(`${BLING_API_BASE_URL}/nfe`, payloadCriacao, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                idNota = resCriacao.data.data.id;
                console.log(`[Bling] NF-e criada com sucesso: ID ${idNota}`);
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
                const errData = err.response?.data;
                console.error(`[Bling Error] Erro na criação da NF-e:`, errMsg, JSON.stringify(errData));
                
                return res.status(400).send({ 
                    status: 'error', 
                    message: `Erro ao criar nota no Bling: ${errMsg}`,
                    details: errData
                });
            }

            // 2. Enviar a Nota Fiscal para a SEFAZ
            try {
                console.log(`[Bling] Enviando NF-e ${idNota} para a SEFAZ...`);
                const resEnvio = await httpClient.post(`${BLING_API_BASE_URL}/nfe/${idNota}/enviar`, {}, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                console.log(`[Bling] NF-e ${idNota} enviada para processamento.`);
                return res.status(200).send({ 
                    status: 'success', 
                    message: "NF-e gerada e enviada com sucesso!",
                    data: { idNota, response: resEnvio.data } 
                });
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
                console.warn(`[Bling Warning] Nota criada (${idNota}) mas falhou ao enviar: ${errMsg}`);
                return res.status(200).send({ 
                    status: 'partial_success', 
                    message: `Nota criada com ID ${idNota}, mas o envio automático falhou: ${errMsg}. Você pode tentar enviar manualmente no Bling.`,
                    data: { idNota } 
                });
            }

        } catch (error) {
            console.error("[Backend Error] gerar-nfe:", error.message);
            res.status(500).send({ status: 'error', message: error.message });
        }
    });

    return router;
};

module.exports = createPedidosRouter;
