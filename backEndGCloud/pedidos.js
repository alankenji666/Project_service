const express = require('express');
const axiosModule = require('axios'); // Usaremos o nome axiosModule para não conflitar com o parâmetro

const createPedidosRouter = (getSheetsClient, spreadsheetIdNFE, sheetNamePedidosBling, axios, APPS_SCRIPT_TOKEN_URL, BLING_API_BASE_URL, notifySync, spreadsheetIdGarantia = '1ygLHkMzQcpMbXssdlF8iPFUXTXVFDsDud286Z8ihma4') => {
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

    function getLinhaProducaoCols(headerRow) {
        const norm = (headerRow || []).map(h =>
            (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[_\s]/g, '')
        );
        return {
            hId: norm.indexOf('pedidoid') !== -1 ? norm.indexOf('pedidoid') : norm.indexOf('idpedido'),
            hIdx: norm.indexOf('itemindex') !== -1 ? norm.indexOf('itemindex') : norm.indexOf('index'),
            hDesc: norm.indexOf('descricaocomplementar') !== -1 ? norm.indexOf('descricaocomplementar') : norm.indexOf('descricao'),
            hSt: norm.indexOf('status'),
            hSku: norm.indexOf('sku') !== -1 ? norm.indexOf('sku') : norm.indexOf('codigo'),
            hQty: norm.indexOf('quantidade'),
            hDate: norm.indexOf('data'),
            hResp: norm.indexOf('responsavel'),
            hOrigem: norm.indexOf('origem'),
            hOrc: norm.indexOf('orcamento'),
            hVendedor: norm.indexOf('vendedor'),
            hCliente: norm.indexOf('cliente') !== -1 ? norm.indexOf('cliente') : norm.indexOf('empresa')
        };
    }

    function parseOrderItemsRaw(raw) {
        const items = [];
        const itemStrings = String(raw || '').split(/(?=\([^,]+,\s*\d+)/).filter(Boolean);
        itemStrings.forEach((s, idx) => {
            let c = s.trim();
            if (c.startsWith('(')) c = c.substring(1);
            if (c.endsWith(')')) {
                if ((c.match(/\(/g) || []).length < (c.match(/\)/g) || []).length) {
                    c = c.substring(0, c.length - 1);
                }
            }
            const p = c.split(',').map(x => x.trim());
            if (p.length >= 3) {
                let v = p[2];
                let st = 'OK';
                if (v.includes('|')) {
                    const sp = v.split('|');
                    v = sp[0];
                    st = sp[1] || 'OK';
                }
                items.push({ index: idx, sku: p[0], qty: p[1], val: v, status: st });
            }
        });
        return items;
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
            if (rows.length === 0) return res.status(200).send({ status: 'success', data: [], preProducao: [] });

            const headersNorm = rows[0].map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[\/\(\)]/g, '_'));

            const producaoMap = {};
            const unlinkedOrcItems = [];
            const garantiaItems = [];

            if (producaoRows && producaoRows.length > 1) {
                const cols = getLinhaProducaoCols(producaoRows[0]);

                producaoRows.slice(1).forEach(row => {
                    const pid = cols.hId !== -1 ? String(row[cols.hId] || '').trim() : '';
                    const pidx = cols.hIdx !== -1 ? String(row[cols.hIdx] || '').trim() : '';
                    const pSku = cols.hSku !== -1 ? String(row[cols.hSku] || '').trim() : '';
                    const pOrc = cols.hOrc !== -1 ? String(row[cols.hOrc] || '').trim() : '';
                    const pOrig = cols.hOrigem !== -1 ? String(row[cols.hOrigem] || '').trim() : '';
                    const pCli = cols.hCliente !== -1 ? String(row[cols.hCliente] || '').trim() : '';
                    const prodObj = {
                        status: cols.hSt !== -1 ? (row[cols.hSt] || 'OK') : 'OK',
                        descricao: cols.hDesc !== -1 ? (row[cols.hDesc] || '') : '',
                        quantidade: cols.hQty !== -1 ? (row[cols.hQty] || '') : '',
                        data: cols.hDate !== -1 ? (row[cols.hDate] || '') : '',
                        responsavel: cols.hResp !== -1 ? (row[cols.hResp] || '') : '',
                        origem: pOrig,
                        orcamento: pOrc,
                        vendedor: cols.hVendedor !== -1 ? (row[cols.hVendedor] || '') : '',
                        cliente: pCli,
                        sku: pSku,
                        pedidoId: pid,
                        itemIndex: pidx
                    };

                    const isGarantia = pOrig.toLowerCase() === 'garantia' || pid.toUpperCase().startsWith('GAR-');
                    if (isGarantia) {
                        garantiaItems.push(prodObj);
                    } else if (pid && pidx !== '') {
                        producaoMap[`${pid}-${pidx}`] = prodObj;
                    } else if (!pid && pOrc && pSku) {
                        unlinkedOrcItems.push({ ...prodObj, _matched: false });
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
                const pOrc = String(obj.orcamento || obj['orcamento'] || '').trim();
                obj.detalhesProducao = {};
                Object.keys(producaoMap).forEach(key => {
                    const [keyPid, keyIdx] = key.split('-');
                    if (keyPid === pid || keyPid === pnum) {
                        obj.detalhesProducao[key] = producaoMap[key];
                        obj.detalhesProducao[`${pid}-${keyIdx}`] = producaoMap[key];
                        obj.detalhesProducao[`${pnum}-${keyIdx}`] = producaoMap[key];
                    }
                });

                // Vínculo fallback por orcamento + sku caso o pedido exista mas o item em LinhaProducao ainda esteja sem pedidoid
                if (pOrc && pOrc !== '0' && obj.itens && unlinkedOrcItems.length > 0) {
                    const parsedOrderItems = parseOrderItemsRaw(obj.itens);
                    parsedOrderItems.forEach(item => {
                        const existingKey = `${pid}-${item.index}`;
                        const existingNumKey = `${pnum}-${item.index}`;
                        if (!obj.detalhesProducao[existingKey] && !obj.detalhesProducao[existingNumKey]) {
                            const matchedPre = unlinkedOrcItems.find(u =>
                                !u._matched &&
                                String(u.orcamento).trim() === pOrc &&
                                String(u.sku).trim() === String(item.sku).trim()
                            );
                            if (matchedPre) {
                                matchedPre._matched = true;
                                obj.detalhesProducao[existingKey] = matchedPre;
                                if (pnum) obj.detalhesProducao[existingNumKey] = matchedPre;
                            }
                        }
                    });
                }

                return obj;
            });

            const preProducao = unlinkedOrcItems.filter(u => !u._matched).map(({ _matched, ...rest }) => rest);
            res.status(200).send({ status: 'success', data: pedidos, preProducao, garantia: garantiaItems });
        } catch (error) { next(error); }
    });

    router.post('/update-item-status', async (req, res, next) => {
        try {
            let {
                pedidoId, itemCodigo, newStatus, itemIndex,
                newDescription, responsavel, numeroPedido, quantidade,
                origem, orcamento, vendedor, dataPedido, isManualPreProd, isDateEdit, cliente
            } = req.body;

            let idParaPlanilha = String(numeroPedido || pedidoId || '').trim();
            let finalOrcamento = String(orcamento || '').trim();
            const skuStr = String(itemCodigo || '').trim();

            if (!idParaPlanilha && (!finalOrcamento || !skuStr)) {
                throw new Error("Identificação do pedido ou orçamento + SKU é obrigatória.");
            }

            const sheets = await getSheetsClient();
            const [pResp, mResp] = await Promise.all([
                sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A:Z` }),
                sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNamePedidosBling}!A:Z` })
            ]);
            let pRows = pResp.data.values || [];
            const mRows = mResp.data.values || [];
            
            let pHeadersRaw = [];
            if (pRows.length > 0) {
                pHeadersRaw = [...pRows[0]];
                const normNoUnderscore = pHeadersRaw.map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[_\s]/g, ''));
                let changed = false;
                if (normNoUnderscore.indexOf('quantidade') === -1) { pHeadersRaw.push('quantidade'); changed = true; }
                if (normNoUnderscore.indexOf('data') === -1) { pHeadersRaw.push('data'); changed = true; }
                if (normNoUnderscore.indexOf('responsavel') === -1) { pHeadersRaw.push('responsavel'); changed = true; }
                if (normNoUnderscore.indexOf('origem') === -1) { pHeadersRaw.push('Origem'); changed = true; }
                if (normNoUnderscore.indexOf('orcamento') === -1) { pHeadersRaw.push('orcamento'); changed = true; }
                if (normNoUnderscore.indexOf('vendedor') === -1) { pHeadersRaw.push('vendedor'); changed = true; }
                if (normNoUnderscore.indexOf('cliente') === -1) { pHeadersRaw.push('cliente'); changed = true; }
                if (changed) {
                    await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [pHeadersRaw] } });
                }
            } else {
                pHeadersRaw = ['pedidoid', 'sku', 'itemindex', 'status', 'descricaocomplementar', 'quantidade', 'data', 'responsavel', 'Origem', 'orcamento', 'vendedor', 'cliente'];
                await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [pHeadersRaw] } });
                pRows = [pHeadersRaw];
            }

            const cols = getLinhaProducaoCols(pHeadersRaw);

            // Busca pedido em PedidosBling (para extrair orcamento ou vincular pré-produção se pedido já existir)
            let mHeaders = [], iCol = -1, idCol = -1, numCol = -1, orcCol = -1, dateCol = -1;
            let mIdx = -1;
            if (mRows.length > 0) {
                mHeaders = mRows[0].map(h => (h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[\/\(\)]/g, '_'));
                iCol = mHeaders.indexOf('itens');
                idCol = mHeaders.indexOf('id_pedido') !== -1 ? mHeaders.indexOf('id_pedido') : mHeaders.indexOf('id');
                numCol = mHeaders.indexOf('numero');
                orcCol = mHeaders.indexOf('orcamento');
                dateCol = mHeaders.indexOf('data');

                if (idParaPlanilha) {
                    for (let i = 1; i < mRows.length; i++) {
                        if ((idCol !== -1 && String(mRows[i][idCol]).trim() === String(pedidoId || '').trim()) ||
                            (numCol !== -1 && String(mRows[i][numCol]).trim() === String(numeroPedido || pedidoId || '').trim())) {
                            mIdx = i;
                            break;
                        }
                    }
                    if (mIdx !== -1 && (!finalOrcamento || finalOrcamento === '0') && orcCol !== -1) {
                        const sheetOrc = String(mRows[mIdx][orcCol] || '').trim();
                        if (sheetOrc && sheetOrc !== '0') finalOrcamento = sheetOrc;
                    }
                } else if (finalOrcamento && finalOrcamento !== '0' && skuStr && orcCol !== -1 && iCol !== -1) {
                    // Busca se já existe um pedido em PedidosBling com este orçamento + SKU
                    for (let i = 1; i < mRows.length; i++) {
                        const rowOrc = String(mRows[i][orcCol] || '').trim();
                        if (rowOrc === finalOrcamento) {
                            const orderItems = parseOrderItemsRaw(mRows[i][iCol] || '');
                            const matchedOrderItem = orderItems.find(it => String(it.sku).trim() === skuStr);
                            if (matchedOrderItem) {
                                mIdx = i;
                                const foundNum = numCol !== -1 ? String(mRows[i][numCol] || '').trim() : '';
                                const foundId = idCol !== -1 ? String(mRows[i][idCol] || '').trim() : '';
                                pedidoId = foundId || foundNum;
                                numeroPedido = foundNum || foundId;
                                idParaPlanilha = numeroPedido || pedidoId;
                                itemIndex = matchedOrderItem.index;
                                if (!dataPedido && dateCol !== -1 && mRows[i][dateCol]) {
                                    dataPedido = String(mRows[i][dateCol]).trim();
                                }
                                break;
                            }
                        }
                    }
                }
            }

            // 1. Procurar linha existente por pedidoid + itemindex
            let foundIdx = -1;
            if (idParaPlanilha && itemIndex !== undefined && itemIndex !== null && String(itemIndex).trim() !== '') {
                for (let i = 1; i < pRows.length; i++) {
                    const rowPid = cols.hId !== -1 ? String(pRows[i][cols.hId] || '').trim() : '';
                    const rowIdx = cols.hIdx !== -1 ? String(pRows[i][cols.hIdx] || '').trim() : '';
                    if ((rowPid === String(pedidoId || '').trim() || rowPid === String(numeroPedido || '').trim() || rowPid === idParaPlanilha) &&
                        rowIdx === String(itemIndex).trim()) {
                        foundIdx = i; break;
                    }
                }
            }

            // 2. Procurar linha existente por orcamento + sku (pre-producao ou verificacao de duplicidade)
            if (foundIdx === -1 && finalOrcamento && finalOrcamento !== '0' && skuStr && cols.hOrc !== -1 && cols.hSku !== -1) {
                for (let i = 1; i < pRows.length; i++) {
                    const rowOrc = String(pRows[i][cols.hOrc] || '').trim();
                    const rowSku = String(pRows[i][cols.hSku] || '').trim();
                    const rowPid = cols.hId !== -1 ? String(pRows[i][cols.hId] || '').trim() : '';
                    if (rowOrc === finalOrcamento && rowSku === skuStr) {
                        if (isManualPreProd) {
                            const existingSt = cols.hSt !== -1 ? (pRows[i][cols.hSt] || 'EM PRODUÇÃO') : 'EM PRODUÇÃO';
                            const existingPidInfo = rowPid ? ` (Pedido #${rowPid})` : '';
                            return res.status(409).send({
                                status: 'duplicate',
                                message: `O item ${skuStr} já está na Linha de Produção para o orçamento ${finalOrcamento}${existingPidInfo} (Status: "${existingSt}").`
                            });
                        }
                        if (!rowPid || (idParaPlanilha && (rowPid === String(pedidoId || '').trim() || rowPid === String(numeroPedido || '').trim() || rowPid === idParaPlanilha))) {
                            foundIdx = i;
                            break;
                        }
                    }
                }
            }

            if (isManualPreProd && foundIdx !== -1) {
                const existingSt = cols.hSt !== -1 ? (pRows[foundIdx][cols.hSt] || 'EM PRODUÇÃO') : 'EM PRODUÇÃO';
                return res.status(409).send({
                    status: 'duplicate',
                    message: `O item ${skuStr} do orçamento ${finalOrcamento} já está na Linha de Produção (Pedido #${idParaPlanilha}, Status: "${existingSt}").`
                });
            }

            const existingRow = foundIdx !== -1 ? pRows[foundIdx] : null;
            const existingRowPid = existingRow && cols.hId !== -1 ? String(existingRow[cols.hId] || '').trim() : '';
            const wasUnlinkedPreProd = Boolean(existingRow && !existingRowPid && idParaPlanilha);

            let finalStatus = newStatus;
            let finalDesc = newDescription;
            let finalResp = responsavel;
            let finalQty = quantidade;
            let finalDate = dataPedido;
            let finalOrigem = origem;
            let finalVendedor = vendedor;

            if (existingRow) {
                const exSt = cols.hSt !== -1 ? (existingRow[cols.hSt] || '') : '';
                const exDesc = cols.hDesc !== -1 ? (existingRow[cols.hDesc] || '') : '';
                const exResp = cols.hResp !== -1 ? (existingRow[cols.hResp] || '') : '';
                const exQty = cols.hQty !== -1 ? (existingRow[cols.hQty] || '') : '';
                const exDate = cols.hDate !== -1 ? (existingRow[cols.hDate] || '') : '';
                const exOrig = cols.hOrigem !== -1 ? (existingRow[cols.hOrigem] || '') : '';
                const exOrc = cols.hOrc !== -1 ? (existingRow[cols.hOrc] || '') : '';
                const exVendedor = cols.hVendedor !== -1 ? (existingRow[cols.hVendedor] || '') : '';

                if (wasUnlinkedPreProd) {
                    if (exSt && exSt.toUpperCase() !== 'OK') finalStatus = exSt;
                    if (exDesc) finalDesc = exDesc;
                    if (exResp) finalResp = exResp;
                    if (exQty) finalQty = exQty;
                    if (exOrig) finalOrigem = exOrig;
                    if (exVendedor) finalVendedor = exVendedor;
                } else {
                    if (finalStatus === undefined) finalStatus = exSt;
                    if (finalDesc === undefined) finalDesc = exDesc;
                    if (finalResp === undefined) finalResp = exResp;
                    if (finalQty === undefined) finalQty = exQty;
                    if (finalOrigem === undefined) finalOrigem = exOrig;
                    if (finalVendedor === undefined) finalVendedor = exVendedor;
                }

                // Preserva a data já registrada (ex: data da pré-produção), a menos que seja uma edição explícita
                if (!isDateEdit && exDate) {
                    finalDate = exDate;
                } else if (finalDate === undefined) {
                    finalDate = exDate;
                }

                if ((!finalOrcamento || finalOrcamento === '0') && exOrc) finalOrcamento = exOrc;
            }

            if (String(finalStatus || '').toUpperCase().trim() === 'OK') {
                finalStatus = 'FINALIZADO';
            }
            if (finalResp !== undefined && finalResp !== null) {
                finalResp = String(finalResp).trim().toUpperCase();
            }

            const rowData = existingRow ? [...existingRow] : new Array(pHeadersRaw.length).fill('');
            while (rowData.length < pHeadersRaw.length) rowData.push('');

            if (cols.hId !== -1) rowData[cols.hId] = idParaPlanilha;
            if (cols.hSku !== -1) rowData[cols.hSku] = skuStr;
            if (cols.hIdx !== -1) rowData[cols.hIdx] = (itemIndex !== undefined && itemIndex !== null) ? itemIndex : '';
            if (cols.hSt !== -1) rowData[cols.hSt] = finalStatus || 'OK';
            if (cols.hQty !== -1) rowData[cols.hQty] = finalQty || '';
            if (cols.hDate !== -1) rowData[cols.hDate] = finalDate || '';
            if (cols.hDesc !== -1) rowData[cols.hDesc] = finalDesc || '';
            if (cols.hResp !== -1) rowData[cols.hResp] = finalResp || '';
            if (cols.hOrigem !== -1) rowData[cols.hOrigem] = finalOrigem || '';
            if (cols.hOrc !== -1) rowData[cols.hOrc] = (finalOrcamento && finalOrcamento !== '0') ? finalOrcamento : '';
            if (cols.hVendedor !== -1) rowData[cols.hVendedor] = finalVendedor || '';
            if (cols.hCliente !== -1) rowData[cols.hCliente] = cliente || (existingRow && cols.hCliente !== -1 ? existingRow[cols.hCliente] : '');

            if (foundIdx !== -1) {
                await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A${foundIdx + 1}`, valueInputOption: 'RAW', resource: { values: [rowData] } });
            } else {
                await sheets.spreadsheets.values.append({ spreadsheetId: spreadsheetIdNFE, range: `${sheetNameLinhaProducao}!A1`, valueInputOption: 'RAW', resource: { values: [rowData] } });
            }

            if (mIdx !== -1 && iCol !== -1 && finalStatus !== undefined && itemIndex !== undefined && itemIndex !== null && String(itemIndex).trim() !== '') {
                const raw = mRows[mIdx][iCol] || '';
                const parsedItems = parseOrderItemsRaw(raw);
                const updatedStr = parsedItems.map(it => {
                    const st = (String(it.index) === String(itemIndex)) ? finalStatus : it.status;
                    return `(${it.sku}, ${it.qty}, ${it.val}|${st})`;
                }).join(' ');
                await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheetIdNFE, range: `${colToA1(iCol + 1)}${mIdx + 1}`, valueInputOption: 'RAW', resource: { values: [[updatedStr]] } });
            }

            // Sincronização com OrcamentosGarantia caso seja pedido de garantia
            if ((idParaPlanilha.startsWith('GAR-') || (finalOrigem && finalOrigem.toLowerCase() === 'garantia')) && itemIndex !== undefined && itemIndex !== null && String(itemIndex).trim() !== '' && finalStatus !== undefined) {
                try {
                    const sheetGarantiaResp = await sheets.spreadsheets.values.get({
                        spreadsheetId: spreadsheetIdGarantia,
                        range: 'OrcamentosGarantia!A:P'
                    });
                    const gRows = sheetGarantiaResp.data.values || [];
                    for (let gi = 1; gi < gRows.length; gi++) {
                        const gId = String(gRows[gi][1] || '').trim();
                        const gNum = String(gRows[gi][2] || '').trim();
                        if (gId === idParaPlanilha || gNum === idParaPlanilha || (pedidoId && (gId === pedidoId || gNum === pedidoId))) {
                            const rawItens = gRows[gi][13] || '';
                            const parsedGarantiaItems = parseOrderItemsRaw(rawItens);
                            if (parsedGarantiaItems.length > 0) {
                                const updatedGStr = parsedGarantiaItems.map((it, idx) => {
                                    const matchIdx = (String(it.index) === String(itemIndex)) || (idx === Number(itemIndex));
                                    let st = matchIdx ? finalStatus : (it.status || 'FINALIZADO');
                                    if (st === 'OK') st = 'FINALIZADO';
                                    return `(${it.sku}, ${it.qty}, ${it.val}|${st})`;
                                }).join(' ');
                                await sheets.spreadsheets.values.update({
                                    spreadsheetId: spreadsheetIdGarantia,
                                    range: `OrcamentosGarantia!N${gi + 1}`,
                                    valueInputOption: 'RAW',
                                    resource: { values: [[updatedGStr]] }
                                });
                            }
                            break;
                        }
                    }
                } catch (gErr) {
                    console.error('[pedidos.js] Erro ao sincronizar item em OrcamentosGarantia:', gErr);
                }
            }

            if (typeof notifySync === 'function') notifySync('orderItemStatusUpdated', {
                pedidoId: pedidoId || '',
                numeroPedido: numeroPedido || idParaPlanilha || '',
                orcamento: (finalOrcamento && finalOrcamento !== '0') ? finalOrcamento : '',
                itemCodigo: skuStr,
                newStatus: finalStatus,
                newDescription: finalDesc,
                itemIndex: (itemIndex !== undefined && itemIndex !== null) ? itemIndex : '',
                quantidade: finalQty,
                dataPedido: finalDate,
                responsavel: finalResp,
                origem: finalOrigem,
                vendedor: finalVendedor,
                cliente: (cols.hCliente !== -1 && rowData[cols.hCliente]) ? rowData[cols.hCliente] : (cliente || '')
            });

            res.status(200).send({
                status: 'success',
                linkedFromOrcamento: wasUnlinkedPreProd,
                linkedToExistingPedido: Boolean(isManualPreProd && idParaPlanilha),
                pedidoId: pedidoId || '',
                numeroPedido: numeroPedido || idParaPlanilha || '',
                itemIndex: (itemIndex !== undefined && itemIndex !== null) ? itemIndex : '',
                itemData: {
                    status: finalStatus,
                    descricao: finalDesc,
                    responsavel: finalResp,
                    quantidade: finalQty,
                    data: finalDate,
                    orcamento: (finalOrcamento && finalOrcamento !== '0') ? finalOrcamento : '',
                    origem: finalOrigem,
                    vendedor: finalVendedor
                }
            });
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
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' } 
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

    /**
     * NOVO: Rota para listar pedidos de venda no Bling com filtros.
     */
    router.get('/vendas', async (req, res, next) => {
        try {
            const accessToken = await getToken();
            const httpClient = axios || axiosModule;
            
            // Repassa as query params
            const queryParams = new URLSearchParams(req.query).toString();
            const url = `${BLING_API_BASE_URL}/pedidos/vendas${queryParams ? '?' + queryParams : ''}`;
            
            console.log(`[Bling] Listando pedidos de venda: ${url}`);
            const resBling = await httpClient.get(url, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
            });
            res.status(200).send(resBling.data);
        } catch (error) {
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            console.error("[Backend Error] listar-vendas:", errMsg);
            res.status(500).json({ error: errMsg });
        }
    });

    router.get('/vendas/:id', async (req, res, next) => {
        try {
            const idPedido = req.params.id;
            if (!idPedido) throw new Error("ID do pedido é obrigatório.");

            const accessToken = await getToken();
            const httpClient = axios || axiosModule;

            console.log(`[Bling] Buscando detalhes completos do pedido ${idPedido} para o frontend...`);
            const resPedido = await httpClient.get(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
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
                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
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
                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
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
                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
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
                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
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
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
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
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
                });
                
                console.log(`[Bling] NF-e ${idNota} enviada para processamento.`);

                // Atualizar situação do pedido após envio da NFe (Atendido P. 37589 se tiver serviços, ou Atendido 9)
                const targetSituacaoId = (req.body && req.body.situacaoId) ? req.body.situacaoId : (req.body && req.body.hasService ? 37589 : 9);
                const situacaoLabel = targetSituacaoId === 37589 ? 'Atendido P.' : 'Atendido';

                try {
                    console.log(`[Bling] Atualizando situação do pedido ${idPedido} para ${situacaoLabel} (${targetSituacaoId}) após gerar NFe...`);
                    await httpClient.patch(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}/situacoes/${targetSituacaoId}`, {}, {
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
                    });
                    
                    // Sincroniza a planilha instantaneamente via webhook local
                    const port = process.env.PORT || 8080;
                    httpClient.post(`http://localhost:${port}/webhook/pedidos-bling`, {
                        event: 'situacao.alterada', 
                        data: { id: idPedido }
                    }).catch(e => console.log("[Webhook Local] Erro na sync:", e.message));

                } catch (errSituacao) {
                    console.warn(`[Bling Warning] NFe enviada, mas falha ao alterar situação do pedido para ${situacaoLabel}:`, errSituacao.message);
                }

                return res.status(200).send({ 
                    status: 'success', 
                    message: `NF-e gerada e enviada com sucesso! O pedido foi atualizado para ${situacaoLabel}.`,
                    data: { idNota, response: resEnvio.data } 
                });
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
                console.warn(`[Bling Warning] Nota criada (${idNota}) mas falhou ao enviar: ${errMsg}`);

                // Se falhou porque o Bling já auto-emitiu, vamos checar a situação da nota
                try {
                    const resVerifica = await httpClient.get(`${BLING_API_BASE_URL}/nfe/${idNota}`, {
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
                    });
                    const situacao = resVerifica.data?.data?.situacao;
                    // Situação 6 = Autorizada, 3 = Emitida DANFE, 1 = Pendente (na fila do auto-emit)
                    if (situacao === 6 || situacao === 3 || situacao === 1 || errMsg.includes('emitir')) {
                        console.log(`[Bling] A nota ${idNota} já estava autorizada/emitida ou na fila (situação ${situacao}). Retornando sucesso!`);
                        
                        const targetSituacaoId = (req.body && req.body.situacaoId) ? req.body.situacaoId : (req.body && req.body.hasService ? 37589 : 9);
                        const situacaoLabel = targetSituacaoId === 37589 ? 'Atendido P.' : 'Atendido';

                        try {
                            await httpClient.patch(`${BLING_API_BASE_URL}/pedidos/vendas/${idPedido}/situacoes/${targetSituacaoId}`, {}, {
                                headers: { 'Authorization': `Bearer ${accessToken}`, 'enable-jwt': '1' }
                            });
                            const port = process.env.PORT || 8080;
                            httpClient.post(`http://localhost:${port}/webhook/pedidos-bling`, {
                                event: 'situacao.alterada', data: { id: idPedido }
                            }).catch(e => console.log("[Webhook Local] Erro na sync:", e.message));
                        } catch (e) {}

                        return res.status(200).send({ 
                            status: 'success', 
                            message: `NF-e gerada e processada automaticamente pelo Bling com sucesso! O pedido foi atualizado para ${situacaoLabel}.`,
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
