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

    let _cachedToken = null;
    let _tokenExpiresAt = 0;

    async function getToken() {
        if (_cachedToken && Date.now() < _tokenExpiresAt) {
            return _cachedToken;
        }
        try {
            const httpClient = axios || axiosModule;
            let response;
            let lastErr;
            // Tenta até 3 vezes caso o Apps Script retorne erro intermitente (ex: 404 ou timeout)
            for (let i = 0; i < 3; i++) {
                try {
                    response = await httpClient.get(APPS_SCRIPT_TOKEN_URL);
                    break;
                } catch (e) {
                    lastErr = e;
                    if (i === 2) throw e;
                    await new Promise(r => setTimeout(r, 1500)); // Aguarda 1.5s antes da próxima tentativa
                }
            }
            const token = response.data.access_token || response.data.accessToken;
            _cachedToken = token;
            _tokenExpiresAt = Date.now() + (1000 * 60 * 30); // Cache por 30 minutos
            return token;
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
                const pHeaders = producaoRows[0].map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ""));
                const hId = pHeaders.indexOf('pedidoid');
                const hIdx = pHeaders.indexOf('itemindex');
                const hSt = pHeaders.indexOf('status');
                const hDesc = pHeaders.indexOf('descricaocomplementar');
                const hQty = pHeaders.indexOf('quantidade');
                const hDate = pHeaders.indexOf('data');
                const hResp = pHeaders.indexOf('responsavel');

                producaoRows.slice(1).forEach(row => {
                    const pid = String(row[hId] || '').trim();
                    const pidx = String(row[hIdx] || '').trim();
                    if (pid && pidx !== '') {
                        producaoMap[`${pid}-${pidx}`] = {
                            status: hSt !== -1 ? (row[hSt] || 'OK') : 'OK',
                            descricao: hDesc !== -1 ? (row[hDesc] || '') : '',
                            quantidade: hQty !== -1 ? (row[hQty] || '') : '',
                            data: hDate !== -1 ? (row[hDate] || '') : '',
                            responsavel: hResp !== -1 ? (row[hResp] || '') : ''
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
            const { pedidoId, itemCodigo, newStatus, itemIndex, newDescription, responsavel, numeroPedido, quantidade } = req.body;
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
                if (pHeaders.indexOf('responsavel') === -1) {
                    pHeaders.push('responsavel');
                    changed = true;
                }
                if (changed) {
                    await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [pHeaders] } });
                }
            } else {
                pHeaders = ['pedidoid', 'sku', 'itemindex', 'status', 'quantidade', 'data', 'descricaocomplementar', 'responsavel'];
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
            const hResp = pHeaders.indexOf('responsavel');

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
            let finalResp = responsavel;
            let finalQty = quantidade;
            let finalDate = dataPedido;

            if (foundIdx !== -1) {
                if (finalStatus === undefined && hSt !== -1) finalStatus = pRows[foundIdx][hSt];
                if (finalDesc === undefined && hDesc !== -1) finalDesc = pRows[foundIdx][hDesc];
                if (finalResp === undefined && hResp !== -1) finalResp = pRows[foundIdx][hResp];
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
            if (hResp !== -1) rowData[hResp] = finalResp || '';

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
            if (typeof notifySync === 'function') notifySync('orderItemStatusUpdated', { pedidoId, itemCodigo, newStatus: finalStatus, newDescription: finalDesc, itemIndex, quantidade: finalQty, dataPedido: finalDate, responsavel: finalResp });
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
            if (!numero_do_pedido || !observacao) throw Object.assign(new Error("numero_do_pedido e observacao são obrigatórios."), { statusCode: 400 });

            const sheets = await getSheetsClient();
            const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNamePedidosBling}!A:Z` });
            const rows = response.data.values || [];
            if (rows.length === 0) throw new Error("Planilha de pedidos vazia.");

            // Normaliza headers removendo acentos (igual ao GET /) para lidar com 'Número' → 'numero'
            const normalizeHeader = h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const headers = rows[0].map(normalizeHeader);

            // Descobre índices das colunas-chave por nome normalizado
            const idColIdx  = headers.indexOf('id pedido') !== -1 ? headers.indexOf('id pedido') : headers.indexOf('id');
            const numColIdx = headers.indexOf('numero');      // 'Número' → 'numero' após normalização
            const obsColIdx = 16; // Coluna Q — Observação (confirmado na linha 70 do GET /)

            console.log(`[/observacao] Buscando pedido: "${numero_do_pedido}" | idCol=${idColIdx} numCol=${numColIdx}`);

            let rIdx = -1;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const idVal  = idColIdx  !== -1 ? String(row[idColIdx]  || '').trim() : '';
                const numVal = numColIdx !== -1 ? String(row[numColIdx] || '').trim() : '';
                if (idVal === String(numero_do_pedido) || numVal === String(numero_do_pedido)) {
                    rIdx = i;
                    break;
                }
            }

            if (rIdx === -1) throw new Error(`Pedido não encontrado. Buscado: "${numero_do_pedido}" (idCol=${idColIdx}, numCol=${numColIdx})`);

            const obsAt  = rows[rIdx][obsColIdx] || '';
            const ts     = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const obsFin = obsAt ? `${obsAt}\\n${ts} - ${observacao}` : `${ts} - ${observacao}`;

            const colLetter = colToA1(obsColIdx + 1); // +1 porque colToA1 é 1-based
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFE,
                range: `${sheetNamePedidosBling}!${colLetter}${rIdx + 1}`,
                valueInputOption: 'RAW',
                resource: { values: [[obsFin]] }
            });

            if (typeof notifySync === 'function') notifySync('orderObservationUpdated', { numeroPedido: String(numero_do_pedido), novaObservacao: obsFin, senderId });
            res.status(200).send({ status: 'success', data: { newObservation: obsFin } });
        } catch (error) { next(error); }
    });

    // PUT /observacao — Sobrescreve TODA a lista de observações (usado ao excluir uma mensagem)
    router.put('/observacao', async (req, res, next) => {
        try {
            const { numero_do_pedido, observacoes_completas, senderId } = req.body;
            if (!numero_do_pedido || !Array.isArray(observacoes_completas)) {
                throw Object.assign(new Error("numero_do_pedido e observacoes_completas (array) são obrigatórios."), { statusCode: 400 });
            }

            const sheets = await getSheetsClient();
            const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNamePedidosBling}!A:Z` });
            const rows = response.data.values || [];
            if (rows.length === 0) throw new Error("Planilha de pedidos vazia.");

            const normalizeHeader = h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const headers = rows[0].map(normalizeHeader);
            const idColIdx  = headers.indexOf('id pedido') !== -1 ? headers.indexOf('id pedido') : headers.indexOf('id');
            const numColIdx = headers.indexOf('numero');
            const obsColIdx = 16;

            let rIdx = -1;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const idVal  = idColIdx  !== -1 ? String(row[idColIdx]  || '').trim() : '';
                const numVal = numColIdx !== -1 ? String(row[numColIdx] || '').trim() : '';
                if (idVal === String(numero_do_pedido) || numVal === String(numero_do_pedido)) { rIdx = i; break; }
            }

            if (rIdx === -1) throw new Error(`Pedido não encontrado. Buscado: "${numero_do_pedido}"`);

            // Junta o array de volta para a string com \\n separador (igual ao formato da planilha)
            const obsFin = observacoes_completas.join('\\n');

            const colLetter = colToA1(obsColIdx + 1);
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFE,
                range: `${sheetNamePedidosBling}!${colLetter}${rIdx + 1}`,
                valueInputOption: 'RAW',
                resource: { values: [[obsFin]] }
            });

            if (typeof notifySync === 'function') notifySync('orderObservationUpdated', { numeroPedido: String(numero_do_pedido), novaObservacao: obsFin, senderId });
            res.status(200).send({ status: 'success', data: { newObservation: obsFin } });
        } catch (error) { next(error); }
    });

    /**
     * NOVO: Rota para obter os detalhes completos de um pedido de venda no Bling.
     */
    router.get('/vendas/:id', async (req, res, next) => {
        try {
            const idPedido = req.params.id;
            if (!idPedido) throw new Error("ID do pedido é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;

            console.log(`[Bling] Buscando detalhes completos do pedido ${idPedido} para o frontend...`);
            const resPedido = await httpClient.get(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            res.status(200).send(resPedido.data);
        } catch (error) {
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            console.error("[Backend Error] buscar-venda:", errMsg);
            res.status(400).send({ 
                status: 'error', 
                message: `Erro ao buscar pedido no Bling: ${errMsg}`,
                details: error.response?.data
            });
        }
    });

    /**
     * NOVO: Rota para atualizar os detalhes de um pedido de venda no Bling.
     */
    router.put('/vendas/:id', async (req, res, next) => {
        try {
            const idPedido = req.params.id;
            if (!idPedido) throw new Error("ID do pedido é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;
            const payloadUpdate = req.body;

            console.log(`[Bling] Atualizando pedido ${idPedido} com payload clonado/modificado...`);
            const resUpdate = await httpClient.put(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}`, payloadUpdate, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            res.status(200).send(resUpdate.data);

            // NOVO: Força a atualização da planilha disparando um webhook simulado localmente para o nosso próprio backend
            // Isso garante que a planilha (e o frontend via Firebase) sejam atualizados imediatamente sem depender do webhook atrasado do Bling
            setTimeout(async () => {
                try {
                    const port = process.env.PORT || 8080;
                    console.log(`[Bling Proxy] Disparando webhook local para sincronizar planilha do pedido ${idPedido}...`);
                    await httpClient.post(`http://localhost:${port}/webhook/pedidos-bling`, {
                        event: 'situacao.alterada', 
                        data: { id: idPedido }
                    });
                } catch (e) {
                    console.error("[Bling Proxy] Erro ao simular webhook local:", e.message);
                }
            }, 1000);
        } catch (error) {
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            console.error("[Backend Error] atualizar-venda:", errMsg);
            res.status(400).send({ 
                status: 'error', 
                message: `Erro ao atualizar pedido no Bling: ${errMsg}`,
                details: error.response?.data
            });
        }
    });

    /**
     * NOVO: Rota para obter os detalhes completos de um contato/cliente no Bling.
     */
    router.get('/contatos/:id', async (req, res, next) => {
        try {
            const idContato = req.params.id;
            if (!idContato) throw new Error("ID do contato é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;

            console.log(`[Bling] Buscando detalhes do contato ${idContato} para o frontend...`);
            const resContato = await httpClient.get(`${BLING_API_BASE_URL}/contatos/${idContato}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            res.status(200).send(resContato.data);
        } catch (error) {
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            console.error("[Backend Error] buscar-contato:", errMsg);
            res.status(400).send({ 
                status: 'error', 
                message: `Erro ao buscar contato no Bling: ${errMsg}`,
                details: error.response?.data
            });
        }
    });

    /**
     * NOVO: Rota para obter a lista de contatos, com suporte a query params (ex: idTipoContato).
     */
    router.get('/contatos', async (req, res, next) => {
        try {
            const accessToken = await getToken();
            const httpClient = axios || axiosModule;
            const queryParams = req.query ? new URLSearchParams(req.query).toString() : '';
            const queryString = queryParams ? `?${queryParams}` : '';

            console.log(`[Bling] Buscando lista de contatos para o frontend... Query: ${queryString}`);
            const resContatos = await httpClient.get(`${BLING_API_BASE_URL}/contatos${queryString}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            res.status(200).send(resContatos.data);
        } catch (error) {
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            console.error("[Backend Error] listar-contatos:", errMsg);
            res.status(400).send({ 
                status: 'error', 
                message: `Erro ao listar contatos no Bling: ${errMsg}`,
                details: error.response?.data
            });
        }
    });

    /**
     * NOVO: Rota para atualizar os detalhes de um contato/cliente no Bling.
     */
    router.put('/contatos/:id', async (req, res, next) => {
        try {
            const idContato = req.params.id;
            if (!idContato) throw new Error("ID do contato é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;
            const payloadUpdate = req.body;

            console.log(`[Bling] Atualizando contato ${idContato} com payload clonado/modificado...`);
            const resUpdate = await httpClient.put(`${BLING_API_BASE_URL}/contatos/${idContato}`, payloadUpdate, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            res.status(200).send(resUpdate.data);
        } catch (error) {
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            console.error("[Backend Error] atualizar-contato:", errMsg);
            res.status(400).send({ 
                status: 'error', 
                message: `Erro ao atualizar contato no Bling: ${errMsg}`,
                details: error.response?.data
            });
        }
    });

    /**
     * NOVO: Rota para gerar uma NF-e a partir de um pedido de venda no Bling.
     * Segue o fluxo da API V3: criar a nota referenciando o pedido e depois enviar.
     * Aceita payload customizado opcional em req.body.
     */
    router.post('/vendas/:id/gerar-nfe', async (req, res, next) => {
        try {
            const idPedido = req.params.id;
            if (!idPedido) throw new Error("ID do pedido é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;

            let idNota;
            try {
                // Chama a API oficial da V3 para gerar NFe A PARTIR do pedido, o que mantém o vínculo perfeitamente
                const resCriacao = await httpClient.post(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}/gerar-nfe`, {}, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                // O schema de resposta diz que retorna { idNotaFiscal: 1234 }
                idNota = resCriacao.data.data.idNotaFiscal || resCriacao.data.data.id;
                console.log(`[Bling] NF-e gerada a partir do pedido com sucesso: ID ${idNota}`);
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
                const errData = err.response?.data;
                console.error(`[Bling Error] Erro na geração da NF-e via Pedido:`, errMsg, JSON.stringify(errData));
                
                return res.status(400).send({ 
                    status: 'error', 
                    message: `Erro ao gerar nota pelo Bling: ${errMsg}`,
                    details: errData
                });
            }

            // 2. Verificar se deve enviar para a SEFAZ ou apenas criar como rascunho
            const somenteGerar = req.body && req.body.somenteGerar === true;

            if (somenteGerar) {
                console.log(`[Bling] Modo RASCUNHO: NF-e ${idNota} criada sem envio à SEFAZ.`);
                return res.status(200).send({
                    status: 'draft_success',
                    message: `Rascunho da NF-e criado no Bling (ID ${idNota}). Nota NÃO enviada à SEFAZ. Confira e envie manualmente pelo Bling.`,
                    data: { idNota }
                });
            }

            // 3. Enviar a Nota Fiscal para a SEFAZ
            try {
                console.log(`[Bling] Enviando NF-e ${idNota} para a SEFAZ...`);
                const resEnvio = await httpClient.post(`${BLING_API_BASE_URL}/nfe/${idNota}/enviar`, {}, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                console.log(`[Bling] NF-e ${idNota} enviada para processamento.`);

                // NOVO: Atualizar situação do pedido para "Atendido" (9) após envio da NFe
                try {
                    console.log(`[Bling] Atualizando situação do pedido ${idPedido} para Atendido (9) após gerar NFe...`);
                    await httpClient.patch(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}/situacoes/9`, {}, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    
                    // Sincroniza a planilha instantaneamente via webhook local
                    const port = process.env.PORT || 8080;
                    httpClient.post(`http://localhost:${port}/webhook/pedidos-bling`, {
                        event: 'situacao.alterada', 
                        data: { id: idPedido }
                    }).catch(e => console.log("[Webhook Local] Erro na sync:", e.message));

                } catch (errSituacao) {
                    console.warn(`[Bling Warning] NFe enviada, mas falha ao alterar situação do pedido para Atendido:`, errSituacao.message);
                }

                return res.status(200).send({ 
                    status: 'success', 
                    message: "NF-e gerada e enviada com sucesso! O pedido foi atualizado para Atendido.",
                    data: { idNota, response: resEnvio.data } 
                });
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
                console.warn(`[Bling Warning] Nota criada (${idNota}) mas falhou ao enviar: ${errMsg}`);

                // Se falhou porque o Bling já auto-emitiu, vamos checar a situação da nota
                try {
                    const resVerifica = await httpClient.get(`${BLING_API_BASE_URL}/nfe/${idNota}`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    const situacao = resVerifica.data?.data?.situacao;
                    // Situação 6 = Autorizada, 3 = Emitida DANFE, 1 = Pendente (na fila do auto-emit)
                    if (situacao === 6 || situacao === 3 || situacao === 1 || errMsg.includes('emitir')) {
                        console.log(`[Bling] A nota ${idNota} já estava autorizada/emitida ou na fila (situação ${situacao}). Retornando sucesso!`);
                        
                        try {
                            await httpClient.patch(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}/situacoes/9`, {}, {
                                headers: { 'Authorization': `Bearer ${accessToken}` }
                            });
                            const port = process.env.PORT || 8080;
                            httpClient.post(`http://localhost:${port}/webhook/pedidos-bling`, {
                                event: 'situacao.alterada', data: { id: idPedido }
                            }).catch(e => console.log("[Webhook Local] Erro na sync:", e.message));
                        } catch (e) {}

                        return res.status(200).send({ 
                            status: 'success', 
                            message: "NF-e gerada e processada automaticamente pelo Bling com sucesso! O pedido foi atualizado para Atendido.",
                            data: { idNota, autoEmitted: true } 
                        });
                    }
                } catch (checkErr) {
                    console.warn(`[Bling Warning] Falha ao verificar situação da nota ${idNota}:`, checkErr.message);
                }

                return res.status(200).send({ 
                    status: 'partial_success', 
                    message: `Atenção: Nota criada com ID ${idNota}, mas o envio falhou: ${errMsg}. Verifique no Bling.`,
                    data: { idNota }
                });
            }

        } catch (error) {
            console.error("[Backend Error] gerar-nfe:", error.message);
            res.status(500).send({ status: 'error', message: error.message });
        }
    });

    // Endpoint para atualizar manualmente a chave de acesso de uma NFe
    router.put('/nfe/:idNota/chave-acesso', async (req, res, next) => {
        try {
            const { idNota } = req.params;
            const { chaveAcesso } = req.body;
            if (!chaveAcesso) {
                return res.status(400).send({ status: 'error', message: 'Chave de acesso é obrigatória.' });
            }

            const sheets = await getSheetsClient();
            
            // Procura a linha da NFe na planilha NotasFiscais
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFE,
                range: `NotasFiscais!A:Z`
            });
            const rows = response.data.values || [];
            let rowIndexToUpdate = -1;
            
            for (let i = 1; i < rows.length; i++) {
                // COLUMNS_NFE.ID_NOTA = 1 (Coluna B)
                if (String(rows[i][1]).trim() === String(idNota).trim()) {
                    rowIndexToUpdate = i + 1; // 1-based para Sheets API
                    break;
                }
            }

            if (rowIndexToUpdate === -1) {
                return res.status(404).send({ status: 'error', message: 'Nota fiscal não encontrada na planilha.' });
            }

            // Atualiza a coluna F (Chave de Acesso, índice 5)
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFE,
                range: `NotasFiscais!F${rowIndexToUpdate}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[chaveAcesso]] }
            });

            // Dispara notificação para o frontend atualizar o modal instantaneamente
            if (notifySync) {
                await notifySync('nfeReceived', {
                    id: idNota,
                    id_nota: idNota,
                    chaveAcesso: chaveAcesso
                });
            }

            res.status(200).send({ status: 'success', message: 'Chave atualizada com sucesso' });
        } catch (error) {
            console.error("[Backend Error] update-chave-acesso:", error.message);
            res.status(500).send({ status: 'error', message: error.message });
        }
    });

    return router;
};

module.exports = createPedidosRouter;
