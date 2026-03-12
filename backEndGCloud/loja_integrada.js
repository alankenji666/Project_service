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
    sheetNameConfig
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
            const range = `'${sheetNameConfig}'!B2:B6`;
            const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetIdConfig, range });
            const rows = response.data.values;
            if (!rows || rows.length === 0) throw new Error("Configuração vazia.");
            const config = {
                LOJA_INTEGRADA_CHAVE_API: rows[0] ? rows[0][0].trim() : null,
                LOJA_INTEGRADA_CHAVE_APLICACAO: (rows.length >= 3 && rows[2]) ? rows[2][0].trim() : null,
                WEBHOOK_TOKEN: (rows.length >= 5 && rows[4]) ? rows[4][0].trim() : null
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

    router.post('/webhook', async (req, res) => {
        console.log('--- WEBHOOK RECEBIDO ---');
        try {
            const pedido = req.body;
            const config = await getLojaIntegradaConfig();

            // Validação de Token de Segurança
            const authHeader = req.headers['authorization'];
            if (config.WEBHOOK_TOKEN && authHeader !== `Bearer ${config.WEBHOOK_TOKEN}`) {
                console.warn('Token Webhook Inválido');
                return res.status(401).send({ status: "não autorizado" });
            }

            // Ignorar se não houve mudança real de situação
            if (pedido.situacao && pedido.situacao.situacao_alterada === false) {
                console.log(`Pedido ${pedido.numero} ignorado: Sem alteração.`);
                return res.status(200).send({ status: "ignorado" });
            }

            const sheets = await getSheetsClient();
            const headerInfo = await findHeaderInfo(sheets, spreadsheetIdNFE, sheetNameVendas, REQUIRED_HEADERS);
            if (!headerInfo) throw new Error("Cabeçalhos não localizados.");

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
                // Normaliza o cabeçalho da mesma forma que as chaves do objeto
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

            res.status(200).send({ status: "recebido" });
        } catch (error) {
            console.error('Erro no Webhook:', error.message);
            res.status(200).send({ status: "erro", message: error.message });
        }
    });

    // Rota de Sincronização Histórica
    router.get('/sync-historical-orders', async (req, res) => {
        try {
            console.log('--- SINCRONIZAÇÃO TOTAL ---');
            const config = await getLojaIntegradaConfig(true); 
            const sheets = await getSheetsClient();
            const headerInfo = await findHeaderInfo(sheets, spreadsheetIdNFE, sheetNameVendas, REQUIRED_HEADERS);
            if (!headerInfo) return res.status(500).send({ message: 'Planilha sem cabeçalhos.' });
            
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
            console.error('Erro Sync:', error.message);
            res.status(500).send({ status: 'error', message: error.message });
        }
    });

    // Rota para o App frontend
    router.get('/orders', async (req, res) => {
        try {
            const sheets = await getSheetsClient();
            const headerInfo = await findHeaderInfo(sheets, spreadsheetIdNFE, sheetNameVendas, REQUIRED_HEADERS);
            if (!headerInfo) return res.status(500).send({ message: 'Planilha inválida.' });

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
            res.status(500).send({ message: error.message });
        }
    });

    return router;
};

module.exports = createLojaIntegradaRouter;