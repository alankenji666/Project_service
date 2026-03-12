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
    router.all('/webhook', async (req, res) => {
        // (código do webhook permanece o mesmo)
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
                console.error('Erro ao verificar webhook:', error.message);
                res.sendStatus(500);
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
            }
        }
    });

    // Rota para envio manual de mensagens pelo sistema/vendedores
    router.post('/send-message', async (req, res) => {
        const { to, message, codigoVendedor, codigoAtendimento } = req.body;
        if (!to || !message || !codigoVendedor || !codigoAtendimento) {
            return res.status(400).send({ status: 'error', message: 'Campos "to", "message", "codigoVendedor" e "codigoAtendimento" são obrigatórios.' });
        }
        try {
            const config = await getWhatsAppConfig();
            if (config.IS_ACTIVE !== 'TRUE') {
                return res.status(403).send({ status: 'error', message: 'A integração com o WhatsApp está desativada.' });
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
            
            // --- RESPOSTA MELHORADA ---
            const successMessage = apiResponse.isSimulation 
                ? "MENSAGEM SIMULADA com sucesso e registrada no histórico!"
                : "Mensagem enviada e registrada com sucesso!";

            res.status(200).send({ status: 'success', message: successMessage, apiResponse });

        } catch (error) {
            console.error('[WhatsApp] Falha ao enviar mensagem manual:', error.response ? JSON.stringify(error.response.data) : error.message);
            const errorData = error.response ? error.response.data : { message: error.message };
            const statusCode = error.response ? error.response.status : 500;
            res.status(statusCode).send({ status: 'error', message: 'Falha ao enviar a mensagem.', errorDetails: errorData });
        }
    });
    
    router.post('/simulate-incoming-message', async (req, res) => {
        const { from, customerName, message } = req.body;
        if (!from || !customerName || !message) {
            return res.status(400).send({ status: 'error', message: 'Campos "from", "customerName" e "message" são obrigatórios para a simulação.' });
        }
        try {
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

            // --- RESPOSTA MELHORADA ---
            res.status(200).send({ 
                status: 'success', 
                message: 'Simulação de mensagem recebida concluída com sucesso. O sistema está em modo de simulação.' 
            });

        } catch (error) {
            console.error('[SIMULAÇÃO] Erro ao processar simulação:', error.message, error.stack);
            res.status(500).send({ status: 'error', message: `Erro na simulação: ${error.message}` });
        }
    });

    // --- ROTAS DE POLLING E CONTROLE ---
    router.get('/get-atendimentos', async (req, res) => {
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
                    const errorMsg = `Erro de config: A coluna "${header}" não foi encontrada na aba "${sheetNameClientes}".`;
                    return res.status(500).send({ status: 'error', message: errorMsg });
                }
            }
            const [codigoAtendimentoIndex, numeroClienteIndex, nomeClienteIndex, vendedorAtribuidoIndex, statusIndex, timestampIndex] = requiredClientHeaders.map(h => clientesHeaders.indexOf(h));

            const historicoResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameHistorico}'!A:Z` });
            const historicoRows = historicoResponse.data.values || [];
            const clientMessagesMap = {};
            
            if (historicoRows.length > 1) {
                const historicoHeaders = historicoRows[0].map(h => h.toLowerCase());
                // --- MELHORIA APLICADA ---
                const requiredHistoryHeaders = ['codigoatendimento', 'remetente', 'mensagem', 'timestamp'];
                for (const header of requiredHistoryHeaders) {
                    if (!historicoHeaders.includes(header)) {
                        const errorMsg = `Erro de config: A coluna "${header}" não foi encontrada na aba "${sheetNameHistorico}".`;
                        return res.status(500).send({ status: 'error', message: errorMsg });
                    }
                }
                const [histCodigoIndex, histRemetenteIndex, histMsgIndex, histTimestampIndex] = requiredHistoryHeaders.map(h => historicoHeaders.indexOf(h));

                for (let i = 1; i < historicoRows.length; i++) {
                    const row = historicoRows[i];
                    const codigo = row[histCodigoIndex];
                    const remetente = row[histRemetenteIndex];
                    // --- CORREÇÃO APLICADA AQUI ---
                    // Agora inclui mensagens do SISTEMA e do CLIENTE no preview.
                    if ((remetente === 'CLIENTE' || remetente === 'SISTEMA') && codigo) {
                        if (!clientMessagesMap[codigo]) clientMessagesMap[codigo] = [];
                        // --- MELHORIA APLICADA ---
                        // Adiciona um objeto com mais detalhes, em vez de só o texto.
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
            console.error('[Polling] ERRO ao buscar atendimentos:', error.message, error.stack);
            res.status(500).send({ status: 'error', message: 'Falha ao buscar atendimentos.' });
        }
    });

    router.post('/iniciar-atendimento', async (req, res) => {
        const { codigoAtendimento, codigoVendedor } = req.body;
        if (!codigoAtendimento || !codigoVendedor) {
            return res.status(400).send({ status: 'error', message: 'Campos "codigoAtendimento" e "codigoVendedor" são obrigatórios.' });
        }
        try {
            const sheets = await getSheetsClient();
            
            const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:Z` });
            const clientesRows = clientesResponse.data.values || [];
            
            const headers = clientesRows[0].map(h => h.toLowerCase());
            const codigoAtendimentoIndex = headers.indexOf('codigoatendimento');
            const statusIndex = headers.indexOf('status');
            const vendedorIndex = headers.indexOf('codigovendedor');
            
            const rowIndex = clientesRows.findIndex((row, index) => index > 0 && row[codigoAtendimentoIndex] === codigoAtendimento);

            if (rowIndex === -1) {
                return res.status(404).send({ status: 'error', message: `Atendimento ${codigoAtendimento} não encontrado.` });
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
            console.error('[Iniciar Atendimento] ERRO:', error.message);
            res.status(500).send({ status: 'error', message: 'Falha ao iniciar atendimento.' });
        }
    });

    router.post('/finalizar-atendimento', async (req, res) => {
        const { codigoAtendimento } = req.body;
        if (!codigoAtendimento) {
            return res.status(400).send({ status: 'error', message: 'Campo "codigoAtendimento" é obrigatório.' });
        }
        
        try {
            const sheets = await getSheetsClient();
            
            const clientesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetNameClientes}'!A:Z` });
            const clientesRows = clientesResponse.data.values || [];
            
            const headers = clientesRows[0].map(h => h.toLowerCase());
            const codigoAtendimentoIndex = headers.indexOf('codigoatendimento');
            const statusIndex = headers.indexOf('status');
            
            const rowIndex = clientesRows.findIndex((row, index) => index > 0 && row[codigoAtendimentoIndex] === codigoAtendimento);

            if (rowIndex === -1) {
                return res.status(404).send({ status: 'error', message: `Atendimento ${codigoAtendimento} não encontrado.` });
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
            console.error('[Finalizar Atendimento] ERRO:', error.message);
            res.status(500).send({ status: 'error', message: 'Falha ao finalizar atendimento.' });
        }
    });

    router.get('/get-historico/:codigoAtendimento', async (req, res) => {
        const { codigoAtendimento } = req.params;
        if (!codigoAtendimento) {
            return res.status(400).send({ status: 'error', message: 'O código do atendimento é obrigatório.' });
        }
        
        try {
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
            console.error(`[Histórico] ERRO ao buscar histórico para ${codigoAtendimento}:`, error.message);
            res.status(500).send({ status: 'error', message: 'Falha ao buscar histórico do atendimento.' });
        }
    });

    return router;
};

module.exports = createWhatsAppRouter;

