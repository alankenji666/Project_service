const express = require('express');

// Constantes da API
const API_DOMAIN = 'https://api.awsli.com.br';
const LOJA_INTEGRADA_API_URL = 'https://api.awsli.com.br/v1';

// Variável de cache para as configurações
let cachedConfig = null;

/**
 * Formata uma data para o padrão ISO estendido: YYYY-MM-DDTHH:mm:ss.SSSSSS
 * Se a string original já tiver alta precisão, tenta preservá-la.
 */
function formatarDataISO(dataString) {
    if (!dataString) return "";
    try {
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return dataString;
        
        const iso = data.toISOString(); // Retorna YYYY-MM-DDTHH:mm:ss.sssZ
        // Removemos o 'Z' final e adicionamos '000' para simular os 6 dígitos de microssegundos
        // caso o objeto Date original só possua milissegundos.
        return iso.replace('Z', '000');
    } catch (e) {
        return dataString;
    }
}

/**
 * Garante que o valor seja um número formatado com ponto decimal para o Google Sheets
 */
function formatarValorMoeda(valor) {
    if (valor === null || valor === undefined || valor === "") return "0.00";
    let cleanValue = String(valor).replace("R$", "").replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleanValue);
    return isNaN(num) ? "0.00" : num.toFixed(2);
}

/**
 * Função auxiliar para encontrar a linha do cabeçalho e os índices das colunas.
 */
async function findHeaderInfo(sheets, spreadsheetId, sheetName, requiredHeaders) {
    const range = `${sheetName}!A1:AZ20`; 
    try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const rows = response.data.values;
        if (rows) {
            for (let i = 0; i < rows.length; i++) {
                const headers = rows[i].map(h => h ? String(h).toLowerCase().replace(/\s/g, '').trim() : '');
                const normalizedRequiredHeaders = requiredHeaders.map(rh => String(rh).toLowerCase().replace(/\s/g, '').trim());

                if (normalizedRequiredHeaders.every(rh => headers.includes(rh))) {
                    return { rowIndex: i + 1, headers: rows[i] };
                }
            }
        }
        return null;
    } catch (e) {
        console.error(`Erro ao buscar headers em ${sheetName}:`, e.message);
        return null;
    }
}

/**
 * Cria o roteador para as rotas da Loja Integrada.
 */
const createLojaIntegradaRouter = (
    getSheetsClient,
    axios,
    spreadsheetIdNFE,
    sheetNameVendas,
    spreadsheetIdConfig,
sheetNameConfig,
    notifySync,
    APPS_SCRIPT_TOKEN_URL,
    BLING_API_BASE_URL,
    spreadsheetIdEstoque,
    sheetNameEstoque
) => {
    const router = express.Router();

    const REQUIRED_HEADERS = [
        "Numero Pedido", "Data Criação", "Cliente", "Situação", 
        "Valor Produtos", "Valor Frete", "Cupom", "Valor Total", 
        "Itens", "Data Sincronização/Webhook"
    ];

    const getLojaIntegradaConfig = async (forceRefresh = false) => {
        if (cachedConfig && !forceRefresh) return cachedConfig;
        try {
            const sheets = await getSheetsClient();
            const range = `'${sheetNameConfig}'!A1:B10`;
            const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdConfig, range });
            const rows = response.data.values || [];
            if (rows.length === 0) throw new Error("Configuração vazia.");

            console.log('[Loja Integrada Config] Linhas na aba:', JSON.stringify(rows.map(r => [r[0], r[1] ? (String(r[1]).slice(0, 4) + '***') : 'vazio'])));

            let chaveApi = null;
            let chaveAplicacao = null;
            let webhookToken = null;

            rows.forEach(r => {
                const colA = String(r[0] || '').toLowerCase().trim();
                const colB = r[1] ? String(r[1]).trim() : '';
                if (!colB) return;

                if (colA.includes('webhook') || colA.includes('senha')) {
                    webhookToken = colB;
                } else if (colA.includes('aplica') || colA.includes('app')) {
                    chaveAplicacao = colB;
                } else if (colA.includes('api')) {
                    chaveApi = colB;
                }
            });

            // Se não encontrou por rótulo em A, tenta extrair por posição
            if (!chaveApi || !chaveAplicacao) {
                const bVals = rows.map(r => r[1] ? String(r[1]).trim() : (r[0] ? String(r[0]).trim() : '')).filter(v => v.length > 5);
                if (!chaveApi && bVals[0]) chaveApi = bVals[0];
                if (!chaveAplicacao && bVals[1]) chaveAplicacao = bVals[1];
                if (!webhookToken && bVals[2]) webhookToken = bVals[2];
            }

            console.log('[Loja Integrada Config] Chave API identificada?', !!chaveApi, '| Chave Aplicação identificada?', !!chaveAplicacao);

            const config = {
                LOJA_INTEGRADA_CHAVE_API: chaveApi,
                LOJA_INTEGRADA_CHAVE_APLICACAO: chaveAplicacao,
                WEBHOOK_TOKEN: webhookToken
            };
            cachedConfig = config;
            return config;
        } catch (error) {
            console.error('Erro ao carregar configurações:', error.message);
            throw error;
        }
    };

    /**
     * Formata o pedido lidando com as variações entre API de Busca e Webhook.
     */
    const formatarPedidoParaObjeto = (pedido) => {
        // 1. Identificar Cliente
        let cliente_info = 'N/A';
        if (pedido.cliente) {
            cliente_info = (typeof pedido.cliente === 'object') ? (pedido.cliente.nome || 'N/A') : `ID: ${pedido.cliente.split('/').pop()}`;
        }

        // 2. Identificar Itens (Formato: 1.000x Nome (SKU: SKU))
        const itensStr = (pedido.itens && Array.isArray(pedido.itens))
            ? pedido.itens.map(item => {
                const sku = item.sku || (item.produto ? item.produto.sku : 'N/A');
                const qtd = parseFloat(item.quantidade || 0).toFixed(3); 
                return `${qtd}x ${item.nome} (SKU: ${sku})`;
            }).join('; ')
            : 'N/A';

        // 3. Identificar Situação (Status)
        let situacao_nome = 'N/A';
        if (pedido.situacao) {
            if (typeof pedido.situacao === 'object') {
                situacao_nome = pedido.situacao.nome || pedido.situacao.codigo || 'N/A';
            } else {
                situacao_nome = pedido.situacao;
            }
        }

        // 4. Identificar Cupom
        let cupom_codigo = 'N/A';
        if (pedido.cupom_desconto) {
            cupom_codigo = pedido.cupom_desconto.codigo || 'N/A';
        }

        return {
            numeropedido: String(pedido.numero || 'N/A'),
            datacriao: formatarDataISO(pedido.data_criacao), // Novo formato solicitado
            cliente: cliente_info,
            situao: situacao_nome,
            valorprodutos: formatarValorMoeda(pedido.valor_subtotal || pedido.subtotal || 0),
            valorfrete: formatarValorMoeda(pedido.valor_envio || pedido.envio || 0),
            cupom: cupom_codigo,
            valortotal: formatarValorMoeda(pedido.valor_total || pedido.total || 0),
            itens: itensStr,
            datasincronizacaowebhook: formatarDataISO(new Date().toISOString()) // Novo formato solicitado
        };
    };

    router.post('/webhook', async (req, res, next) => {
        console.log('--- WEBHOOK RECEBIDO ---');
        try {
            const pedido = req.body;
            const config = await getLojaIntegradaConfig();

            // Validação de Token de Segurança
            const authHeader = req.headers['authorization'];
            if (config.WEBHOOK_TOKEN && authHeader !== `Bearer ${config.WEBHOOK_TOKEN}`) {
                console.warn('Token Webhook Inválido');
                const error = new Error('não autorizado');
                error.statusCode = 401;
                throw error;
            }

            // Ignorar se não houve mudança real de situação
            if (pedido.situacao && pedido.situacao.situacao_alterada === false) {
                console.log(`Pedido ${pedido.numero} ignorado: Sem alteração.`);
                return res.status(200).send({ status: "ignorado" });
            }

            const sheets = await getSheetsClient();
            const headerInfo = await findHeaderInfo(sheets, spreadsheetIdNFE, sheetNameVendas, REQUIRED_HEADERS);
            if (!headerInfo) {
                throw new Error("Cabeçalhos não localizados na planilha de vendas.");
            }

            const pedidoNumeroStr = String(pedido.numero).trim();
            const colIndexPedido = headerInfo.headers.map(h => h.toLowerCase().trim().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')).indexOf("numeropedido");
            const colLetter = String.fromCharCode(65 + colIndexPedido);
            
            // Busca o pedido na planilha
            const searchResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFE,
                range: `'${sheetNameVendas}'!${colLetter}:${colLetter}`
            });

            const rowsNumbers = searchResponse.data.values || [];
            let rowIndexToUpdate = -1;

            for (let i = 0; i < rowsNumbers.length; i++) {
                if (String(rowsNumbers[i][0]).trim() === pedidoNumeroStr) {
                    rowIndexToUpdate = i + 1;
                    break;
                }
            }

            const pedidoObj = formatarPedidoParaObjeto(pedido);
            const rowData = headerInfo.headers.map(h => {
                const key = h.toLowerCase().trim().replace(/\s/g, '').replace(/\//g, '').replace(/[^a-z0-9]/g, '');
                return pedidoObj[key] !== undefined ? pedidoObj[key] : "";
            });

            if (rowIndexToUpdate !== -1) {
                // UPDATE
                console.log(`Atualizando Pedido ${pedidoNumeroStr} na linha ${rowIndexToUpdate}`);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetIdNFE,
                    range: `'${sheetNameVendas}'!A${rowIndexToUpdate}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [rowData] }
                });
            } else {
                // APPEND
                console.log(`Adicionando Novo Pedido ${pedidoNumeroStr}`);
                await sheets.spreadsheets.values.append({
                    spreadsheetId: spreadsheetIdNFE,
                    range: `'${sheetNameVendas}'!A:A`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: [rowData] }
                });
            }

            // --- NOTIFICAÇÃO FIRESTORE SYNC ---
            if (notifySync) {
                console.log(`[Firestore Sync] Notificando atualização de pedido ${pedidoNumeroStr}`);
                await notifySync('orderUpdated', {
                    numeroPedido: pedidoNumeroStr,
                    novaSituacao: pedido.situacao ? (pedido.situacao.nome || pedido.situacao.codigo || 'N/A') : 'N/A',
                    cliente: pedidoObj.cliente,
                    valorTotal: pedidoObj.valortotal
                });
            }

            res.status(200).send({ status: "recebido" });
        } catch (error) {
            next(error);
        }
    });

    // Rota de Sincronização Histórica
    router.get('/sync-historical-orders', async (req, res, next) => {
        try {
            console.log('--- SINCRONIZAÇÃO TOTAL ---');
            const config = await getLojaIntegradaConfig(true); 
            const sheets = await getSheetsClient();
            const headerInfo = await findHeaderInfo(sheets, spreadsheetIdNFE, sheetNameVendas, REQUIRED_HEADERS);
            if (!headerInfo) {
                const error = new Error('Planilha sem cabeçalhos.');
                error.statusCode = 500;
                throw error;
            }
            
            const apiHeaders = { 'Authorization': `chave_api ${config.LOJA_INTEGRADA_CHAVE_API} aplicacao ${config.LOJA_INTEGRADA_CHAVE_APLICACAO}` };
            let allOrders = [];
            let nextPageUrl = `${LOJA_INTEGRADA_API_URL}/pedido/search/?limit=50`; 

            while (nextPageUrl) {
                const response = await axios.get(nextPageUrl, { headers: apiHeaders });
                const objects = response.data.objects || [];
                for (const summary of objects) {
                    await new Promise(resolve => setTimeout(resolve, 650)); 
                    const detailUrl = summary.resource_uri ? `${API_DOMAIN}${summary.resource_uri}` : `${LOJA_INTEGRADA_API_URL}/pedido/${summary.numero}`;
                    const detailRes = await axios.get(detailUrl, { headers: apiHeaders });
                    allOrders.push(detailRes.data);
                }
                nextPageUrl = (response.data.meta && response.data.meta.next) ? `${API_DOMAIN}${response.data.meta.next}` : null;
            }

            const rowsToInsert = allOrders.map(pedido => {
                const obj = formatarPedidoParaObjeto(pedido);
                return headerInfo.headers.map(h => {
                    const key = h.toLowerCase().trim().replace(/\s/g, '').replace(/\//g, '').replace(/[^a-z0-9]/g, '');
                    return obj[key] !== undefined ? obj[key] : "";
                });
            });

            await sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheetIdNFE, range: `'${sheetNameVendas}'!A${headerInfo.rowIndex + 1}:AZ` });
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetIdNFE,
                range: `'${sheetNameVendas}'!A${headerInfo.rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: rowsToInsert },
            });

            res.status(200).send({ status: 'success', message: `Sincronizados ${allOrders.length} pedidos.` });
        } catch (error) {
            next(error);
        }
    });

    // Rota para o App frontend
    router.get('/orders', async (req, res, next) => {
        try {
            const sheets = await getSheetsClient();
            const headerInfo = await findHeaderInfo(sheets, spreadsheetIdNFE, sheetNameVendas, REQUIRED_HEADERS);
            if (!headerInfo) {
                const error = new Error('Planilha inválida.');
                error.statusCode = 500;
                throw error;
            }

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetIdNFE,
                range: `'${sheetNameVendas}'!A${headerInfo.rowIndex + 1}:AZ`, 
            });

            const rows = response.data.values || [];
            // Normaliza para o JSON do frontend
            const headersNorm = headerInfo.headers.map(h => h.toLowerCase().trim().replace(/\s/g, '_').replace(/\//g, '_'));

            const orders = rows.map(row => {
                const obj = {};
                headersNorm.forEach((h, i) => { if (h) obj[h] = row[i] || ''; });
                return obj;
            });

            res.status(200).send({ status: 'success', data: orders });
        } catch (error) {
            next(error);
        }
    });

    // Cache em memória para produtos ativos da Loja Integrada
    let cachedLIProducts = null;
    let cachedLIProductsTimestamp = 0;
    const LI_PRODUCTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutos de cache

    /**
     * Busca os produtos vinculados à Loja Integrada através da API oficial do Bling Multiloja.
     * ID da Loja Integrada no Bling: 205371925 ('ECommerce - Loja Virtural')
     */
    const fetchFromBlingMultiloja = async () => {
        if (!APPS_SCRIPT_TOKEN_URL || !BLING_API_BASE_URL) {
            throw new Error('Configurações do Bling não injetadas no roteador da Loja Integrada.');
        }
        console.log('[Loja Integrada Sync] Buscando produtos vinculados à Loja Integrada via Bling Multiloja (idLoja=205371925)...');
        
        // 1. Obter Token do Bling
        const tokenRes = await axios.get(APPS_SCRIPT_TOKEN_URL);
        const accessToken = tokenRes.data?.access_token;
        if (!accessToken) throw new Error('Não foi possível obter o token do Bling.');

        const blingHeaders = { 'Authorization': `Bearer ${accessToken}` };

        // 2. Mapeamento de id -> codigo da planilha de produtos/estoque
        const idToSku = {};
        try {
            if (spreadsheetIdEstoque && sheetNameEstoque) {
                const sheets = await getSheetsClient();
                const sheetRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetIdEstoque,
                    range: `'${sheetNameEstoque}'!B4:Z`
                });
                const rows = sheetRes.data?.values || [];
                if (rows.length > 1) {
                    const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
                    const idIdx = headers.indexOf('id');
                    const codIdx = headers.indexOf('código') !== -1 ? headers.indexOf('código') : headers.indexOf('codigo');
                    if (idIdx !== -1 && codIdx !== -1) {
                        for (let i = 1; i < rows.length; i++) {
                            const r = rows[i];
                            const pid = String(r[idIdx] || '').trim();
                            const pcod = String(r[codIdx] || '').trim();
                            if (pid && pcod) idToSku[pid] = pcod;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Loja Integrada Sync] Não foi possível mapear SKUs via planilha de estoque:', e.message);
        }

        // 3. Buscar produtos na rota /produtos/lojas?idLoja=205371925
        const allLinked = [];
        let pagina = 1;
        while (true) {
            const url = `${BLING_API_BASE_URL}/produtos/lojas?idLoja=205371925&limite=100&pagina=${pagina}`;
            const response = await axios.get(url, { headers: blingHeaders });
            const list = response.data?.data || [];
            if (list.length === 0) break;

            for (const item of list) {
                const prodIdStr = String(item.produto?.id || '');
                const sku = idToSku[prodIdStr] || (item.codigo && String(item.codigo).trim() !== '0' ? String(item.codigo).trim() : null);
                
                allLinked.push({
                    id: item.id,
                    produtoId: prodIdStr,
                    sku: sku,
                    preco: item.preco,
                    lojaId: item.loja?.id,
                    source: 'bling_multiloja'
                });
            }

            if (list.length < 100) break;
            pagina++;
            await new Promise(r => setTimeout(r, 350));
        }

        console.log(`[Loja Integrada Sync] Total de ${allLinked.length} produtos obtidos via Bling Multiloja.`);
        return allLinked;
    };

    /**
     * Rota para buscar todos os produtos ativos do e-commerce (Loja Integrada).
     * Suporta GET /produtos e GET /products
     * Parâmetro opcional: ?forceRefresh=true para ignorar o cache.
     */
    const handleGetProdutosLI = async (req, res, next) => {
        try {
            const forceRefresh = req.query.forceRefresh === 'true' || req.query.refresh === '1';
            const now = Date.now();

            if (!forceRefresh && cachedLIProducts && (now - cachedLIProductsTimestamp < LI_PRODUCTS_CACHE_TTL)) {
                return res.status(200).json({
                    status: 'success',
                    cached: true,
                    timestamp: cachedLIProductsTimestamp,
                    count: cachedLIProducts.length,
                    data: cachedLIProducts
                });
            }

            let allActiveProducts = [];
            let syncSource = 'loja_integrada_direct';

            // 1. Tenta API direta da Loja Integrada se configurada
            try {
                const config = await getLojaIntegradaConfig(forceRefresh);
                if (config.LOJA_INTEGRADA_CHAVE_API && config.LOJA_INTEGRADA_CHAVE_APLICACAO) {
                    console.log('[Loja Integrada] Tentando consultar API direta da Loja Integrada (/v1/produto?ativo=true)...');
                    const apiHeaders = {
                        'Authorization': `chave_api ${config.LOJA_INTEGRADA_CHAVE_API} aplicacao ${config.LOJA_INTEGRADA_CHAVE_APLICACAO}`
                    };

                    let nextPageUrl = `${LOJA_INTEGRADA_API_URL}/produto?ativo=true&limit=100`;
                    while (nextPageUrl) {
                        const response = await axios.get(nextPageUrl, { headers: apiHeaders });
                        const objects = response.data.objects || [];
                        for (const prod of objects) {
                            if (prod.removido === true || prod.ativo === false) continue;
                            allActiveProducts.push({
                                id: prod.id,
                                sku: prod.sku ? String(prod.sku).trim() : null,
                                nome: prod.nome || prod.apelido || '',
                                ativo: prod.ativo,
                                tipo: prod.tipo,
                                url: prod.url || '',
                                source: 'loja_integrada_direct'
                            });
                        }
                        if (response.data.meta && response.data.meta.next) {
                            const next = response.data.meta.next;
                            nextPageUrl = next.startsWith('http') ? next : `${API_DOMAIN}${next}`;
                            await new Promise(r => setTimeout(r, 350));
                        } else {
                            nextPageUrl = null;
                        }
                    }
                }
            } catch (liErr) {
                console.warn('[Loja Integrada] Falha na API direta da LI (' + (liErr.response?.data?.Message || liErr.message) + '). Usando fallback Bling Multiloja.');
                allActiveProducts = [];
            }

            // 2. Se a API direta da LI não retornou produtos, usa a integração Bling Multiloja
            if (allActiveProducts.length === 0) {
                allActiveProducts = await fetchFromBlingMultiloja();
                syncSource = 'bling_multiloja';
            }

            console.log(`[Loja Integrada] Total de ${allActiveProducts.length} produtos sincronizados (Origem: ${syncSource}).`);
            cachedLIProducts = allActiveProducts;
            cachedLIProductsTimestamp = now;

            res.status(200).json({
                status: 'success',
                cached: false,
                source: syncSource,
                timestamp: now,
                count: allActiveProducts.length,
                data: allActiveProducts
            });
        } catch (error) {
            console.error('[Loja Integrada] Erro ao sincronizar produtos:', error.response?.data || error.message);
            if (cachedLIProducts && cachedLIProducts.length > 0) {
                return res.status(200).json({
                    status: 'success',
                    cached: true,
                    warning: 'API temporariamente indisponível. Exibindo dados do último cache.',
                    timestamp: cachedLIProductsTimestamp,
                    count: cachedLIProducts.length,
                    data: cachedLIProducts
                });
            }
            next(error);
        }
    };

    router.get('/produtos', handleGetProdutosLI);
    router.get('/products', handleGetProdutosLI);

    router.get('/test-auth', async (req, res) => {
        try {
            const config = await getLojaIntegradaConfig(true);
            const results = {};

            const kApi = config.LOJA_INTEGRADA_CHAVE_API;
            const kApp = config.LOJA_INTEGRADA_CHAVE_APLICACAO;
            const kSec = config.WEBHOOK_TOKEN;

            results.key_info = {
                chave_api_len: kApi ? kApi.length : 0,
                chave_api_prefix: kApi ? kApi.substring(0, 4) : null,
                chave_app_len: kApp ? kApp.length : 0,
                chave_app_prefix: kApp ? kApp.substring(0, 4) : null,
                webhook_len: kSec ? kSec.length : 0,
            };

            // Teste 1: Header puro 'chave_api <api> aplicacao <app>' (sem query params)
            try {
                const r1 = await axios.get('https://api.awsli.com.br/v1/produto?ativo=true&limit=1', {
                    headers: { 'Authorization': `chave_api ${kApi} aplicacao ${kApp}` }
                });
                results.test1_header_normal = { status: r1.status, total: r1.data?.meta?.total_count, objects_len: r1.data?.objects?.length };
            } catch (e1) {
                results.test1_header_normal = { status: e1.response?.status, data: e1.response?.data, msg: e1.message };
            }

            // Teste 2: Header invertido 'chave_api <app> aplicacao <api>'
            try {
                const r2 = await axios.get('https://api.awsli.com.br/v1/produto?ativo=true&limit=1', {
                    headers: { 'Authorization': `chave_api ${kApp} aplicacao ${kApi}` }
                });
                results.test2_header_swapped = { status: r2.status, total: r2.data?.meta?.total_count, objects_len: r2.data?.objects?.length };
            } catch (e2) {
                results.test2_header_swapped = { status: e2.response?.status, data: e2.response?.data, msg: e2.message };
            }

            // Teste 3: Query params puro (?chave_api=...&chave_aplicacao=...) sem Authorization header
            try {
                const r3 = await axios.get(`https://api.awsli.com.br/v1/produto?ativo=true&limit=1&chave_api=${encodeURIComponent(kApi)}&chave_aplicacao=${encodeURIComponent(kApp)}`);
                results.test3_query_chave_aplicacao = { status: r3.status, total: r3.data?.meta?.total_count, objects_len: r3.data?.objects?.length };
            } catch (e3) {
                results.test3_query_chave_aplicacao = { status: e3.response?.status, data: e3.response?.data, msg: e3.message };
            }

            // Teste 4: Query params com aplicacao (?chave_api=...&aplicacao=...) sem Authorization header
            try {
                const r4 = await axios.get(`https://api.awsli.com.br/v1/produto?ativo=true&limit=1&chave_api=${encodeURIComponent(kApi)}&aplicacao=${encodeURIComponent(kApp)}`);
                results.test4_query_aplicacao = { status: r4.status, total: r4.data?.meta?.total_count, objects_len: r4.data?.objects?.length };
            } catch (e4) {
                results.test4_query_aplicacao = { status: e4.response?.status, data: e4.response?.data, msg: e4.message };
            }

            // Teste 5: Header Authorization Basic base64(chave_api)
            try {
                const basicAuth = Buffer.from(`${kApi}:`).toString('base64');
                const r5 = await axios.get('https://api.awsli.com.br/v1/produto?ativo=true&limit=1', {
                    headers: { 'Authorization': `Basic ${basicAuth}` }
                });
                results.test5_basic_api = { status: r5.status, total: r5.data?.meta?.total_count, objects_len: r5.data?.objects?.length };
            } catch (e5) {
                results.test5_basic_api = { status: e5.response?.status, data: e5.response?.data, msg: e5.message };
            }

            // Teste 6: Header Authorization: chave_api (token simples sem aplicacao)
            try {
                const r6 = await axios.get('https://api.awsli.com.br/v1/produto?ativo=true&limit=1', {
                    headers: { 'Authorization': `${kApi}` }
                });
                results.test6_token_direct = { status: r6.status, total: r6.data?.meta?.total_count, objects_len: r6.data?.objects?.length };
            } catch (e6) {
                results.test6_token_direct = { status: e6.response?.status, data: e6.response?.data, msg: e6.message };
            }

            // Teste 7: Pedido search (para ver se pedidos funciona com esses headers)
            try {
                const r7 = await axios.get('https://api.awsli.com.br/v1/pedido/search/?limit=1', {
                    headers: { 'Authorization': `chave_api ${kApi} aplicacao ${kApp}` }
                });
                results.test7_pedido_search = { status: r7.status, total: r7.data?.meta?.total_count, objects_len: r7.data?.objects?.length };
            } catch (e7) {
                results.test7_pedido_search = { status: e7.response?.status, data: e7.response?.data, msg: e7.message };
            }

            res.json({ status: 'diagnostic', results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};

module.exports = createLojaIntegradaRouter;