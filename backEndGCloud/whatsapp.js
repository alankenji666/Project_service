const express = require('express');

// Variável para armazenar as configurações em cache e evitar leituras repetidas da planilha
let cachedConfig = null;

const createWhatsAppRouter = (
    getSheetsClient,
    axios,
    spreadsheetId, // ID da planilha principal do WhatsApp
    sheetNameConfig,
    sheetNameClientes,
    sheetNameHistorico
) => {
    const router = express.Router();

    /**
     * Função auxiliar para ler e transformar as configurações da planilha em um objeto.
     * Usa um cache simples para melhorar a performance.
     */
    const getWhatsAppConfig = async (forceRefresh = false) => {
        if (cachedConfig && !forceRefresh) {
            console.log('[WhatsApp Config] Usando configurações do cache.');
            return cachedConfig;
        }

        console.log('[WhatsApp Config] Buscando configurações da planilha...');
        try {
            const sheets = await getSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `'${sheetNameConfig}'!A:B`,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                throw new Error('A planilha de configuração do WhatsApp está vazia.');
            }

            const config = rows.reduce((acc, row) => {
                const key = row[0];
                const value = row[1];
                if (key) {
                    acc[key.trim()] = value ? value.trim() : '';
                }
                return acc;
            }, {});

            cachedConfig = config;
            console.log('[WhatsApp Config] Configurações carregadas e armazenadas em cache.');
            return cachedConfig;

        } catch (error) {
            console.error('ERRO CRÍTICO ao carregar configurações do WhatsApp:', error.message);
            cachedConfig = null; 
            throw error;
        }
    };

    /**
     * Função auxiliar para enviar uma mensagem via API da Meta.
     * Respeita o modo de simulação.
     */
    const sendMessage = async (config, to, message, messageType = 'text') => {
        // --- LÓGICA DE SIMULAÇÃO MELHORADA ---
        // Apenas envia a mensagem real se SIMULATION_MODE for explicitamente 'FALSE'.
        // Qualquer outro valor (TRUE, vazio, etc.) resultará em simulação.
        if (!(config.SIMULATION_MODE && config.SIMULATION_MODE.toUpperCase() === 'FALSE')) {
            console.log('--- MODO DE SIMULAÇÃO ATIVO ---');
            console.log(`[SIMULAÇÃO] Uma mensagem seria enviada para: ${to}`);
            console.log(`[SIMULAÇÃO] Conteúdo: "${message}"`);
            console.log('--- FIM DA SIMULAÇÃO ---');
            return {
                isSimulation: true,
                messaging_product: "whatsapp",
                contacts: [{ input: to, wa_id: to }],
                messages: [{ id: `wamid.simulated_${Date.now()}` }]
            };
        }

        // --- LÓGICA REAL ---
        const apiUrl = `https://graph.facebook.com/${config.API_VERSION}/${config.PHONE_NUMBER_ID}/messages`;
        const payload = {
            messaging_product: "whatsapp",
            to: to,
            type: messageType,
            text: { body: message }
        };

        console.log(`[WhatsApp] Enviando mensagem REAL para ${to}...`);
        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${config.ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Mensagem real enviada para ${to}. Resposta da API:`, response.data);
        return { ...response.data, isSimulation: false };
    };
    
    /**
     * Rota de Webhook. GET para verificação, POST para receber mensagens.
     */
    router.all('/webhook', async (req, res, next) => {
        if (req.method === 'GET') {
            try {
                const config = await getWhatsAppConfig(true); 
                if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.WEBHOOK_VERIFY_TOKEN) {
                    console.log('WEBHOOK_VERIFIED');
                    res.status(200).send(req.query['hub.challenge']);
                } else {
                    console.error('Falha na verificação do Webhook. Tokens não correspondem.');
                    res.sendStatus(403);
                }
            } catch (error) {
                next(error);
            }
            return;
        }

        if (req.method === 'POST') {
            res.sendStatus(200);
            try {
                const messageData = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
                const contactData = req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

                if (messageData && messageData.type === 'text') {
                    const from = messageData.from;
                    const customerName = contactData.profile.name;
                    const msg_body = messageData.text.body;
                    const messageId = messageData.id;
                    const timestamp = new Date(parseInt(messageData.timestamp) * 1000).toISOString();
                    
                    const sheets = await getSheetsClient();
                    
                    const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:F` });
                    const clientesRows = clientesResponse.data.values || [];
                    const headers = (clientesRows[0] || []).map(h => h.toLowerCase());
                    const numeroClienteIndex = headers.indexOf('numerocliente');
                    const codigoAtendimentoIndex = headers.indexOf('codigoatendimento');

                    let codigoAtendimento;
                    const existingCustomerRowIndex = numeroClienteIndex > -1 ? clientesRows.findIndex(row => row[numeroClienteIndex] === from) : -1;

                    if (existingCustomerRowIndex > -1) {
                        codigoAtendimento = clientesRows[existingCustomerRowIndex][codigoAtendimentoIndex];
                    } else {
                        const config = await getWhatsAppConfig();
                        codigoAtendimento = `AT-${Date.now()}`; 

                        await sheets.spreadsheets.values.append({
                            spreadsheetId, range: `'${sheetNameClientes}'!A1`, valueInputOption: 'USER_ENTERED',
                            resource: { values: [[codigoAtendimento, from, customerName, '', 'NOVO', timestamp]] },
                        });

                        let welcomeMessage = config.MSG_WELCOME_AUTOMATED || "Olá! Bem-vindo à MKS Service. Em breve um vendedor retornará seu contato.";
                        const apiResponse = await sendMessage(config, from, welcomeMessage);
                        
                        await sheets.spreadsheets.values.append({
                            spreadsheetId, range: `'${sheetNameHistorico}'!A1`, valueInputOption: 'USER_ENTERED',
                            resource: { values: [[apiResponse.messages[0].id, codigoAtendimento, 'SISTEMA', welcomeMessage, new Date().toISOString()]] },
                        });
                    }

                    await sheets.spreadsheets.values.append({
                        spreadsheetId, range: `'${sheetNameHistorico}'!A1`, valueInputOption: 'USER_ENTERED',
                        resource: { values: [[messageId, codigoAtendimento, 'CLIENTE', msg_body, timestamp]] },
                    });
                }
            } catch (error) {
                console.error('Erro ao processar webhook do WhatsApp:', error.message, error.stack);
                // Webhook POST errors are usually logged but not passed to next(error) if we already sent 200 OK
            }
        }
    });

    // Rota para envio manual de mensagens pelo sistema/vendedores
    router.post('/send-message', async (req, res, next) => {
        const { to, message, codigoVendedor, codigoAtendimento } = req.body;
        
        try {
            if (!to || !message || !codigoVendedor || !codigoAtendimento) {
                const error = new Error('Campos "to", "message", "codigoVendedor" e "codigoAtendimento" são obrigatórios.');
                error.statusCode = 400;
                throw error;
            }

            const config = await getWhatsAppConfig();
            if (config.IS_ACTIVE !== 'TRUE') {
                const error = new Error('A integração com o WhatsApp está desativada.');
                error.statusCode = 403;
                throw error;
            }
            const apiResponse = await sendMessage(config, to, message);
            const sheets = await getSheetsClient();
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `'${sheetNameHistorico}'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[
                        apiResponse.messages[0].id,
                        codigoAtendimento,
                        `VENDEDOR:${codigoVendedor}`,
                        message,
                        new Date().toISOString()
                    ]]
                },
            });
            
            const successMessage = apiResponse.isSimulation 
                ? "MENSAGEM SIMULADA com sucesso e registrada no histórico!"
                : "Mensagem enviada e registrada com sucesso!";

            res.status(200).send({ status: 'success', message: successMessage, apiResponse });

        } catch (error) {
            next(error);
        }
    });
    
    router.post('/simulate-incoming-message', async (req, res, next) => {
        const { from, customerName, message } = req.body;
        
        try {
            if (!from || !customerName || !message) {
                const error = new Error('Campos "from", "customerName" e "message" são obrigatórios para a simulação.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const messageId = `wamid.simulated_incoming_${Date.now()}`;
            const timestamp = new Date().toISOString();
            
            const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:Z` });
            const clientesRows = clientesResponse.data.values || [];
            const headers = (clientesRows[0] || []).map(h => h.toLowerCase());
            const numeroClienteIndex = headers.indexOf('numerocliente');
            const codigoAtendimentoIndex = headers.indexOf('codigoatendimento');

            let codigoAtendimento;
            const existingCustomerRowIndex = numeroClienteIndex > -1 ? clientesRows.findIndex(row => row[numeroClienteIndex] === from) : -1;

            if (existingCustomerRowIndex > -1) {
                codigoAtendimento = clientesRows[existingCustomerRowIndex][codigoAtendimentoIndex];
            } else {
                const config = await getWhatsAppConfig();
                codigoAtendimento = `AT-${Date.now()}`;

                await sheets.spreadsheets.values.append({
                    spreadsheetId, range: `'${sheetNameClientes}'!A1`, valueInputOption: 'USER_ENTERED',
                    resource: { values: [[codigoAtendimento, from, customerName, '', 'NOVO', timestamp]] },
                });

                let welcomeMessage = config.MSG_WELCOME_AUTOMATED || "Olá! Bem-vindo à MKS Service. Em breve um vendedor retornará seu contato.";
                const apiResponse = await sendMessage(config, from, welcomeMessage);
                
                await sheets.spreadsheets.values.append({
                    spreadsheetId, range: `'${sheetNameHistorico}'!A1`, valueInputOption: 'USER_ENTERED',
                    resource: { values: [[apiResponse.messages[0].id, codigoAtendimento, 'SISTEMA', welcomeMessage, new Date().toISOString()]] },
                });
            }

            await sheets.spreadsheets.values.append({
                spreadsheetId, range: `'${sheetNameHistorico}'!A1`, valueInputOption: 'USER_ENTERED',
                resource: { values: [[messageId, codigoAtendimento, 'CLIENTE', message, timestamp]] },
            });

            res.status(200).send({ 
                status: 'success', 
                message: 'Simulação de mensagem recebida concluída com sucesso. O sistema está em modo de simulação.' 
            });

        } catch (error) {
            next(error);
        }
    });

    // --- ROTAS DE POLLING E CONTROLE ---
    router.get('/get-atendimentos', async (req, res, next) => {
        try {
            const sheets = await getSheetsClient();
            const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:Z` });
            const clientesRows = clientesResponse.data.values || [];
            if (clientesRows.length <= 1) {
                return res.status(200).send({ status: 'success', atendimentos: [] });
            }
            
            const clientesHeaders = clientesRows[0].map(h => h.toLowerCase());
            const requiredClientHeaders = ['codigoatendimento', 'numerocliente', 'nomecliente', 'codigovendedor', 'status', 'ultimainteracao'];
            for (const header of requiredClientHeaders) {
                if (!clientesHeaders.includes(header)) {
                    throw new Error(`Erro de config: A coluna "${header}" não foi encontrada na aba "${sheetNameClientes}".`);
                }
            }
            const [codigoAtendimentoIndex, numeroClienteIndex, nomeClienteIndex, vendedorAtribuidoIndex, statusIndex, timestampIndex] = requiredClientHeaders.map(h => clientesHeaders.indexOf(h));

            const historicoResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameHistorico}'!A:Z` });
            const historicoRows = historicoResponse.data.values || [];
            const clientMessagesMap = {};
            
            if (historicoRows.length > 1) {
                const historicoHeaders = historicoRows[0].map(h => h.toLowerCase());
                const requiredHistoryHeaders = ['codigoatendimento', 'remetente', 'mensagem', 'timestamp'];
                for (const header of requiredHistoryHeaders) {
                    if (!historicoHeaders.includes(header)) {
                        throw new Error(`Erro de config: A coluna "${header}" não foi encontrada na aba "${sheetNameHistorico}".`);
                    }
                }
                const [histCodigoIndex, histRemetenteIndex, histMsgIndex, histTimestampIndex] = requiredHistoryHeaders.map(h => historicoHeaders.indexOf(h));

                for (let i = 1; i < historicoRows.length; i++) {
                    const row = historicoRows[i];
                    const codigo = row[histCodigoIndex];
                    const remetente = row[histRemetenteIndex];
                    if ((remetente === 'CLIENTE' || remetente === 'SISTEMA') && codigo) {
                        if (!clientMessagesMap[codigo]) clientMessagesMap[codigo] = [];
                        clientMessagesMap[codigo].push({
                            remetente: remetente,
                            mensagem: row[histMsgIndex],
                            timestamp: row[histTimestampIndex]
                        });
                    }
                }
            }
            
            const activeClients = clientesRows.slice(1)
                .filter(row => row[statusIndex] === 'NOVO' || row[statusIndex] === 'EM_ATENDIMENTO')
                .map(row => {
                    const codigoAtendimento = row[codigoAtendimentoIndex];
                    return {
                        codigoAtendimento,
                        numeroCliente: row[numeroClienteIndex],
                        nomeCliente: row[nomeClienteIndex],
                        vendedorAtribuido: row[vendedorAtribuidoIndex] || '',
                        status: row[statusIndex],
                        ultimaInteracao: row[timestampIndex],
                        mensagensPreview: clientMessagesMap[codigoAtendimento] || []
                    };
                });
            res.status(200).send({ status: 'success', atendimentos: activeClients });
        } catch (error) {
            next(error);
        }
    });

    router.post('/iniciar-atendimento', async (req, res, next) => {
        const { codigoAtendimento, codigoVendedor } = req.body;
        
        try {
            if (!codigoAtendimento || !codigoVendedor) {
                const error = new Error('Campos "codigoAtendimento" e "codigoVendedor" são obrigatórios.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:Z` });
            const clientesRows = clientesResponse.data.values || [];
            
            const headers = clientesRows[0].map(h => h.toLowerCase());
            const codigoAtendimentoIndex = headers.indexOf('codigoatendimento');
            const statusIndex = headers.indexOf('status');
            const vendedorIndex = headers.indexOf('codigovendedor');
            
            const rowIndex = clientesRows.findIndex((row, index) => index > 0 && row[codigoAtendimentoIndex] === codigoAtendimento);

            if (rowIndex === -1) {
                const error = new Error(`Atendimento ${codigoAtendimento} não encontrado.`);
                error.statusCode = 404;
                throw error;
            }

            const sheetRowNumber = rowIndex + 1;
            const rangeVendedor = `'${sheetNameClientes}'!${String.fromCharCode(65 + vendedorIndex)}${sheetRowNumber}`;
            const rangeStatus = `'${sheetNameClientes}'!${String.fromCharCode(65 + statusIndex)}${sheetRowNumber}`;
            
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: [
                        { range: rangeVendedor, values: [[codigoVendedor]] },
                        { range: rangeStatus, values: [['EM_ATENDIMENTO']] }
                    ]
                }
            });

            res.status(200).send({ status: 'success', message: `Atendimento ${codigoAtendimento} iniciado por ${codigoVendedor}. Status atualizado para EM ATENDIMENTO.` });

        } catch (error) {
            next(error);
        }
    });

    router.post('/finalizar-atendimento', async (req, res, next) => {
        const { codigoAtendimento } = req.body;
        
        try {
            if (!codigoAtendimento) {
                const error = new Error('Campo "codigoAtendimento" é obrigatório.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:Z` });
            const clientesRows = clientesResponse.data.values || [];
            
            const headers = clientesRows[0].map(h => h.toLowerCase());
            const codigoAtendimentoIndex = headers.indexOf('codigoatendimento');
            const statusIndex = headers.indexOf('status');
            
            const rowIndex = clientesRows.findIndex((row, index) => index > 0 && row[codigoAtendimentoIndex] === codigoAtendimento);

            if (rowIndex === -1) {
                const error = new Error(`Atendimento ${codigoAtendimento} não encontrado.`);
                error.statusCode = 404;
                throw error;
            }

            const sheetRowNumber = rowIndex + 1;
            const rangeStatus = `'${sheetNameClientes}'!${String.fromCharCode(65 + statusIndex)}${sheetRowNumber}`;
            
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: rangeStatus,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [['FINALIZADO']] }
            });

            res.status(200).send({ status: 'success', message: `Atendimento ${codigoAtendimento} finalizado. Status atualizado para FINALIZADO.` });

        } catch (error) {
            next(error);
        }
    });

    router.get('/get-historico/:codigoAtendimento', async (req, res, next) => {
        const { codigoAtendimento } = req.params;
        
        try {
            if (!codigoAtendimento) {
                const error = new Error('O código do atendimento é obrigatório.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const historicoResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameHistorico}'!A:E` });
            const historicoRows = historicoResponse.data.values || [];

            if (historicoRows.length <= 1) {
                return res.status(200).send({ status: 'success', historico: [] });
            }

            const headers = historicoRows[0].map(h => h.toLowerCase());
            const [idMsgIndex, codAtendIndex, remetenteIndex, msgIndex, timestampIndex] = ['idmensagem', 'codigoatendimento', 'remetente', 'mensagem', 'timestamp'].map(h => headers.indexOf(h));

            const historicoFiltrado = historicoRows.slice(1)
                .filter(row => row[codAtendIndex] === codigoAtendimento)
                .map(row => ({
                    id: row[idMsgIndex],
                    remetente: row[remetenteIndex],
                    mensagem: row[msgIndex],
                    timestamp: row[timestampIndex]
                }));

            res.status(200).send({ status: 'success', historico: historicoFiltrado });

        } catch (error) {
            next(error);
        }
    });

    return router;
};

module.exports = createWhatsAppRouter;

