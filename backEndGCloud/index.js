/**
 * Importações necessárias:
 * - express: Framework web para criar o servidor e as rotas.
 * - axios: Cliente HTTP para fazer requisições à API do Bling.
 * - cors: Middleware para habilitar o Cross-Origin Resource Sharing (CORS).
 * - googleapis: Biblioteca oficial do Google para interagir com as APIs do Google, incluindo Google Sheets.
 */
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { google } = require('googleapis');

// Inicializa a aplicação Express.
const app = express();

// --- Middlewares ---
// Habilita o CORS para todas as origens. Em um ambiente de produção,
// você pode querer restringir isso para o domínio da sua aplicação.
app.use(cors({ origin: true }));

// Habilita o parsing de corpos de requisição no formato JSON.
app.use(express.json());

// --- Configurações Globais ---
const SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS = '1m5HuPv5RLam7vSQ7n1ml9MHy9WO_dbGN5gF2Bet39Ss';
const SPREADSHEET_ID_REQUISICAO_FABRICA = '1_A9C_XuUyhC0X1C-PMy7_55jx-mH7LkslBz-CjdVuXc';
const SPREADSHEET_ID_NFE = '1W3pziTxiwV7In4_DyD1AJE16sEBJUGgA5mmczylutcg';
const SPREADSHEET_ID_ESTOQUE = '11EqlFOTNfCiCl-sVlTjNzAK7feWcMJH8VFfOAgUXRSo';
const SPREADSHEET_ID_SAIDA_FABRICA = '1ygLHkMzQcpMbXssdlF8iPFUXTXVFDsDud286Z8ihma4';
const SPREADSHEET_ID_SAIDA_GARANTIA = '1JygTrWFYFXioVJMqmnR-KNs6vaUApYoAJZNWIK5R8PQ';
const SPREADSHEET_ID_CONTAS = '1gSjenmmi1mB-LxwlJHMOyjQ0JK--PmWv5lQnqm9R4hI'; // <-- ATUALIZADO
const SPREADSHEET_ID_WHATSAPP = '1RxLAYglksTjXdWSK-5Zns7cl1xwvax0GVSsJWYnLxao'; // NOVO

// Nomes das Abas
const SHEET_NAME_REQUISICAO_GERAL_TERCEIROS = 'Requisição geral lote 1';
const SHEET_NAME_REQUISICAO_FABRICA = 'Requisição fabrica lote 1';
const SHEET_NAME_NOTAS_FISCAIS = 'NotasFiscais';
const SHEET_NAME_ESTOQUE = 'Produtos';
const SHEET_NAME_SAIDA_FABRICA = 'Dados Sistemas - Fabrica 1';
const SHEET_NAME_SAIDA_GARANTIA = 'Dados Sistemas - Garantia 1';
const SHEET_NAME_CONTA_EMPRESA = 'Conta - Empresa';
const SHEET_NAME_CONTA_USUARIO = 'Conta - Usuario';
const SHEET_NAME_WHATSAPP_CONFIG = 'whatsapp - configuracao'; // NOVO
const SHEET_NAME_WHATSAPP_CLIENTES = 'whatsapp - clientes'; // NOVO
const SHEET_NAME_WHATSAPP_HISTORICO = 'whatsapp - historico'; // NOVO
const SHEET_NAME_PRODUTOS_ESTOQUE = 'Produtos Estoque';
const SHEET_NAME_VENDAS_LOJA_INTEGRADA = 'VendasLojaIntegrada'; // <-- ADICIONE ESTA LINHA
const SHEET_NAME_LOJA_INTEGRADA_CONFIG = 'configuracaoLojaIntegrada'; // <-- ADICIONE ESTA LINHA


// URLs
const APPS_SCRIPT_TOKEN_URL = 'https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec';
const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';


// --- Autenticação para Google Sheets API ---
let sheetsClientInstance = null;
let sheetsInitializationPromise = null;

async function getInitializedSheetsClient() {
    if (sheetsClientInstance) {
        return sheetsClientInstance;
    }
    if (sheetsInitializationPromise) {
        return await sheetsInitializationPromise;
    }

    sheetsInitializationPromise = new Promise(async (resolve, reject) => {
        try {
            const auth = new google.auth.GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const authClient = await auth.getClient();
            const client = google.sheets({ version: 'v4', auth: authClient });
            console.log('Google Sheets API client inicializado com sucesso.');
            sheetsClientInstance = client;
            resolve(client);
        } catch (err) {
            console.error('Erro ao inicializar Google Sheets API client:', err);
            reject(err);
        } finally {
            sheetsInitializationPromise = null;
        }
    });

    return await sheetsInitializationPromise;
}


// --- CONSTANTES DE MAPEAMENTO DE COLUNAS PARA 'NotasFiscais' ---
const COLUMNS_NFE = {
    CONFERIDO: 0,
    ID_NOTA: 1,
    NUMERO_NOTA: 2,
    SERIE: 3,
    DATA_EMISSAO: 4,
    CHAVE_ACESSO: 5,
    SITUACAO: 6,
    VALOR_NOTA: 7,
    VALOR_FRETE: 8,
    NOME_CLIENTE: 9,
    CNPJ_CPF_CLIENTE: 10,
    NOME_VENDEDOR: 11,
    NUMERO_PEDIDO_LOJA: 12,
    TRANSPORTADORA: 13,
    FRETE_POR_CONTA: 14,
    ORIGEM_LOJA: 15,
    LINK_DANFE: 16,
    OBSERVACAO: 17
};

// Rota para Lançamento de Requisição - TERCEIROS
app.post('/', async (req, res) => {
    console.log('Requisição POST recebida na Cloud Function (para Google Sheets - Requisição Terceiros):', JSON.stringify(req.body, null, 2));

    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota principal (Terceiros):', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const { phoenixCode, items } = req.body;

        if (!phoenixCode || !items || !Array.isArray(items) || items.length === 0) {
            console.error('Payload inválido:', req.body);
            return res.status(400).send({ status: 'error', message: 'Payload inválido. Certifique-se de que "phoenixCode" e "items" estão presentes.' });
        }

        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        const values = items.map(item => [
            phoenixCode,
            item.codigo,
            '',
            item.descricao,
            item.localizacao || '',
            item.quantidade,
            'PENDENTE',
            formattedDate,
            '',
            '',
            '15'
        ]);

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS,
            range: `${SHEET_NAME_REQUISICAO_GERAL_TERCEIROS}!A:A`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values,
            },
        });

        console.log('Dados inseridos com sucesso na planilha de Requisição Terceiros:', response.data);

        const requisitionData = {
            orderCode: phoenixCode,
            dataPedido: formattedDate,
            totalItems: items.length,
            totalAtendido: 0,
            totalPendente: items.length,
            situacao: 'PENDENTE',
            rawItems: items.map(item => ({
                orderCode: phoenixCode,
                codigoService: item.codigo,
                codigoMksEquipamentos: '',
                descricao: item.descricao,
                localizacao: item.localizacao || '',
                quantidadePedido: item.quantidade,
                situacao: 'PENDENTE',
                dataPedido: formattedDate,
                diasCorridosRaw: '',
                observacao: '',
                prazoEntregaRaw: '15',
                requisitionType: 'terceiros'
            })),
            itemHeaders: [
                'requisição', 'codigo service', 'codigo mks-equipamentos', 'descrição',
                'localização', 'quantidade pedido', 'situação', 'data pedido',
                'dias corridos', 'observação', 'prazo entrega'
            ]
        };

        res.status(200).send({
            status: 'success',
            message: 'Dados recebidos e inseridos com sucesso na planilha de Terceiros!',
            data: response.data,
            requisitionData: requisitionData
        });

    } catch (error) {
        console.error('Erro ao processar requisição e inserir na planilha de Requisição Terceiros:', error.message, error.stack);
        res.status(500).send({ status: 'error', message: `Falha ao lançar requisição para Terceiros: ${error.message}` });
    }
});

// Rota para Lançamento de Requisição - FÁBRICA
app.post('/launch-fabrica', async (req, res) => {
    console.log('Requisição POST recebida na Cloud Function (para Google Sheets - Requisição Fábrica):', JSON.stringify(req.body, null, 2));

    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota de Fábrica:', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const { phoenixCode, items } = req.body;

        if (!phoenixCode || !items || !Array.isArray(items) || items.length === 0) {
            console.error('Payload inválido:', req.body);
            return res.status(400).send({ status: 'error', message: 'Payload inválido. Certifique-se de que "phoenixCode" e "items" estão presentes.' });
        }

        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        const values = items.map(item => [
            phoenixCode,
            item.codigo,
            '',
            item.descricao,
            item.localizacao || '',
            item.quantidade,
            'PENDENTE',
            formattedDate,
            '',
            '',
            item.prazoEntrega || '15'
        ]);

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID_REQUISICAO_FABRICA,
            range: `${SHEET_NAME_REQUISICAO_FABRICA}!A:A`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values,
            },
        });

        console.log('Dados inseridos com sucesso na planilha de Requisição Fábrica:', response.data);

        const requisitionData = {
            orderCode: phoenixCode,
            dataPedido: formattedDate,
            totalItems: items.length,
            totalAtendido: 0,
            totalPendente: items.length,
            situacao: 'PENDENTE',
            rawItems: items.map(item => ({
                orderCode: phoenixCode,
                codigoService: item.codigo,
                codigoMksEquipamentos: '',
                descricao: item.descricao,
                localizacao: item.localizacao || '',
                quantidadePedido: item.quantidade,
                situacao: 'PENDENTE',
                dataPedido: formattedDate,
                diasCorridosRaw: '',
                observacao: '',
                prazoEntregaRaw: item.prazoEntrega || '15',
                requisitionType: 'fabrica'
            })),
            itemHeaders: [
                'requisição', 'codigo service', 'codigo mks-equipamentos', 'descrição',
                'localização', 'quantidade pedido', 'situação', 'data pedido',
                'dias corridos', 'observação', 'prazo entrega'
            ]
        };

        res.status(200).send({
            status: 'success',
            message: 'Dados recebidos e inseridos com sucesso na planilha de Fábrica!',
            data: response.data,
            requisitionData: requisitionData
        });

    } catch (error) {
        console.error('Erro ao processar requisição e inserir na planilha de Requisição Fábrica:', error.message, error.stack);
        res.status(500).send({ status: 'error', message: `Falha ao lançar requisição para Fábrica: ${error.message}` });
    }
});

// Rota para Atualizar Status do Item do Pedido
app.post('/update-order-status', async (req, res) => {
    console.log('Requisição POST recebida na Cloud Function para /update-order-status:', JSON.stringify(req.body, null, 2));

    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota de atualização de status:', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const { orderCode, codigoService, newStatus, requisitionType, diasCorridos } = req.body;

        if (!orderCode || !codigoService || !newStatus || !requisitionType) {
            console.error('Dados incompletos para atualização de status:', req.body);
            return res.status(400).send({ status: 'error', message: "Dados incompletos: 'orderCode', 'codigoService', 'newStatus' e 'requisitionType' são obrigatórios." });
        }

        let spreadsheetId;
        let sheetName;
        if (requisitionType === 'terceiros') {
            spreadsheetId = SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS;
            sheetName = SHEET_NAME_REQUISICAO_GERAL_TERCEIROS;
        } else if (requisitionType === 'fabrica') {
            spreadsheetId = SPREADSHEET_ID_REQUISICAO_FABRICA;
            sheetName = SHEET_NAME_REQUISICAO_FABRICA;
        } else {
            console.error('Tipo de requisição inválido para atualização de status:', requisitionType);
            return res.status(400).send({ status: 'error', message: `Tipo de requisição inválido: ${requisitionType}.` });
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.warn(`Planilha de Requisição (${requisitionType}) vazia ou sem dados.`);
            return res.status(404).send({ status: 'error', message: `Nenhum dado encontrado na planilha de Requisição (${requisitionType}).` });
        }

        const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
        const orderCodeColIndex = headers.indexOf('requisição');
        const codigoServiceColIndex = headers.indexOf('codigo service');
        const situacaoColIndex = headers.indexOf('situação');
        const diasCorridosColIndex = headers.indexOf('dias corridos');
        const dataEntregaColIndex = headers.indexOf('data entrega');

        if (orderCodeColIndex === -1 || codigoServiceColIndex === -1 || situacaoColIndex === -1 || dataEntregaColIndex === -1) {
            console.error(`Colunas essenciais não encontradas na planilha de Requisição (${requisitionType}):`, headers);
            return res.status(500).send({ status: 'error', message: `Uma ou mais colunas essenciais (Requisição, Codigo Service, Situação ou Data Entrega) não foram encontradas na planilha de Requisição (${requisitionType}).` });
        }

        let rowIndexToUpdate = -1;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const currentRowOrderCode = row[orderCodeColIndex] ? row[orderCodeColIndex].toString().trim() : '';
            const currentRowCodigoService = row[codigoServiceColIndex] ? row[codigoServiceColIndex].toString().trim() : '';

            if (currentRowOrderCode === orderCode && currentRowCodigoService === codigoService) {
                rowIndexToUpdate = i;
                break;
            }
        }

        if (rowIndexToUpdate === -1) {
            console.warn(`Item não encontrado para Requisição: ${orderCode}, Código Service: ${codigoService} na planilha de Requisição (${requisitionType}).`);
            return res.status(404).send({ status: 'error', message: `Item de pedido não encontrado na planilha para Requisição: ${orderCode}, Código Service: ${codigoService}.` });
        }

        const updates = [];
        const situacaoRange = `${sheetName}!${String.fromCharCode(65 + situacaoColIndex)}${rowIndexToUpdate + 1}`;
        updates.push({
            range: situacaoRange,
            values: [[newStatus]]
        });

        if (typeof diasCorridos !== 'undefined' && diasCorridosColIndex !== -1) {
            const diasCorridosRange = `${sheetName}!${String.fromCharCode(65 + diasCorridosColIndex)}${rowIndexToUpdate + 1}`;
            updates.push({
                range: diasCorridosRange,
                values: [[diasCorridos]]
            });
        }

        if (newStatus.toLowerCase() === 'ok' && dataEntregaColIndex !== -1) {
            const today = new Date();
            const day = String(today.getDate()).padStart(2, '0');
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const year = today.getFullYear();
            const formattedDate = `${day}/${month}/${year}`;

            const dataEntregaRange = `${sheetName}!${String.fromCharCode(65 + dataEntregaColIndex)}${rowIndexToUpdate + 1}`;
            updates.push({
                range: dataEntregaRange,
                values: [[formattedDate]]
            });
            console.log(`Status "OK" detectado. Preenchendo "Data Entrega" com: ${formattedDate}`);
        }

        const updatePromises = updates.map(update =>
            sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: update.range,
                valueInputOption: 'RAW',
                resource: { values: update.values },
            })
        );
        const updateResponses = await Promise.all(updatePromises);

        console.log(`Status do item ${codigoService} da requisição ${orderCode} atualizado para '${newStatus}' na linha ${rowIndexToUpdate + 1} da planilha de Requisição (${requisitionType}).`, updateResponses.map(r => r.data));
        res.status(200).send({ status: 'success', message: 'Status do item (e dias corridos/data de entrega, se aplicável) atualizado com sucesso!', data: updateResponses.map(r => r.data) });

    } catch (error) {
        console.error(`Erro ao atualizar status do item na planilha de Requisição (${requisitionType}):`, error.message, error.stack);
        res.status(500).send({ status: 'error', message: `Falha ao atualizar status do pedido: ${error.message}` });
    }
});

// Rota para Adicionar Observação a um Item de Requisição (Geral/Terceiros)
app.post('/add-requisition-observation', async (req, res) => {
    console.log('Requisição POST recebida para /add-requisition-observation:', JSON.stringify(req.body, null, 2));

    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota de observação de requisição:', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const { id_requisicao, codigo_service, observacao } = req.body;

        if (!id_requisicao || !codigo_service || !observacao) {
            console.error('Dados incompletos para adicionar observação:', req.body);
            return res.status(400).send({ status: 'error', message: "Dados incompletos: 'id_requisicao', 'codigo_service' e 'observacao' são obrigatórios." });
        }

        const spreadsheetId = SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS;
        const sheetName = SHEET_NAME_REQUISICAO_GERAL_TERCEIROS;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.warn(`Planilha de Requisição ("${sheetName}") vazia ou sem dados.`);
            return res.status(404).send({ status: 'error', message: `Nenhum dado encontrado na planilha de Requisição.` });
        }

        const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
        const requisicaoColIndex = headers.indexOf('requisição');
        const codigoServiceColIndex = headers.indexOf('codigo service');
        const observacaoColIndex = headers.indexOf('observação');

        if (requisicaoColIndex === -1 || codigoServiceColIndex === -1 || observacaoColIndex === -1) {
            console.error(`Colunas essenciais não encontradas na planilha "${sheetName}":`, headers);
            return res.status(500).send({ status: 'error', message: `Uma ou mais colunas essenciais (Requisição, Codigo Service, Observação) não foram encontradas na planilha.` });
        }

        let rowIndexToUpdate = -1;
        let observacaoAtual = '';
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const currentRowRequisicao = row[requisicaoColIndex] ? row[requisicaoColIndex].toString().trim() : '';
            const currentRowCodigo = row[codigoServiceColIndex] ? row[codigoServiceColIndex].toString().trim() : '';

            if (currentRowRequisicao === id_requisicao && currentRowCodigo === codigo_service) {
                rowIndexToUpdate = i;
                observacaoAtual = row[observacaoColIndex] || '';
                break;
            }
        }

        if (rowIndexToUpdate === -1) {
            console.warn(`Item não encontrado para Requisição: ${id_requisicao}, Código Service: ${codigo_service}.`);
            return res.status(404).send({ status: 'error', message: `Item não encontrado para a requisição ${id_requisicao} e código ${codigo_service}.` });
        }

        const timestamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const novaEntrada = `${timestamp} - ${observacao}`;
        const observacaoFinal = observacaoAtual ? `${observacaoAtual}\n${novaEntrada}` : novaEntrada;

        const range = `${sheetName}!${String.fromCharCode(65 + observacaoColIndex)}${rowIndexToUpdate + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [[observacaoFinal]],
            },
        });

        console.log(`Observação do item ${codigo_service} da requisição ${id_requisicao} atualizada na linha ${rowIndexToUpdate + 1}.`);
        res.status(200).send({
            status: 'success',
            message: 'Observação adicionada com sucesso!',
            data: { newObservation: observacaoFinal }
        });

    } catch (error) {
        console.error('Erro ao adicionar observação na requisição:', error.message, error.stack);
        res.status(500).send({ status: 'error', message: `Falha ao adicionar observação: ${error.message}` });
    }
});

// Rota para Adicionar Observação a um Item de Requisição da FÁBRICA
app.post('/add-fabrica-observation', async (req, res) => {
    console.log('Requisição POST recebida para /add-fabrica-observation:', JSON.stringify(req.body, null, 2));

    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota de observação de fábrica:', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const { id_requisicao, codigo_service, observacao } = req.body;

        if (!id_requisicao || !codigo_service || !observacao) {
            console.error('Dados incompletos para adicionar observação de fábrica:', req.body);
            return res.status(400).send({ status: 'error', message: "Dados incompletos: 'id_requisicao', 'codigo_service' e 'observacao' são obrigatórios." });
        }

        const spreadsheetId = SPREADSHEET_ID_REQUISICAO_FABRICA;
        const sheetName = SHEET_NAME_REQUISICAO_FABRICA;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.warn(`Planilha de Requisição Fábrica ("${sheetName}") vazia ou sem dados.`);
            return res.status(404).send({ status: 'error', message: `Nenhum dado encontrado na planilha de Requisição Fábrica.` });
        }

        const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
        const requisicaoColIndex = headers.indexOf('requisição');
        const codigoServiceColIndex = headers.indexOf('codigo service');
        const observacaoColIndex = headers.indexOf('observação');

        if (requisicaoColIndex === -1 || codigoServiceColIndex === -1 || observacaoColIndex === -1) {
            console.error(`Colunas essenciais não encontradas na planilha "${sheetName}":`, headers);
            return res.status(500).send({ status: 'error', message: `Uma ou mais colunas essenciais (Requisição, Codigo Service, Observação) não foram encontradas na planilha de Fábrica.` });
        }

        let rowIndexToUpdate = -1;
        let observacaoAtual = '';
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const currentRowRequisicao = row[requisicaoColIndex] ? row[requisicaoColIndex].toString().trim() : '';
            const currentRowCodigo = row[codigoServiceColIndex] ? row[codigoServiceColIndex].toString().trim() : '';

            if (currentRowRequisicao === id_requisicao && currentRowCodigo === codigo_service) {
                rowIndexToUpdate = i;
                observacaoAtual = row[observacaoColIndex] || '';
                break;
            }
        }

        if (rowIndexToUpdate === -1) {
            console.warn(`Item de fábrica não encontrado para Requisição: ${id_requisicao}, Código Service: ${codigo_service}.`);
            return res.status(404).send({ status: 'error', message: `Item de fábrica não encontrado para a requisição ${id_requisicao} e código ${codigo_service}.` });
        }

        const timestamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const novaEntrada = `${timestamp} - ${observacao}`;
        const observacaoFinal = observacaoAtual ? `${observacaoAtual}\n${novaEntrada}` : novaEntrada;

        const range = `${sheetName}!${String.fromCharCode(65 + observacaoColIndex)}${rowIndexToUpdate + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [[observacaoFinal]],
            },
        });

        console.log(`Observação do item de fábrica ${codigo_service} da requisição ${id_requisicao} atualizada na linha ${rowIndexToUpdate + 1}.`);
        res.status(200).send({
            status: 'success',
            message: 'Observação adicionada com sucesso ao item de fábrica!',
            data: { newObservation: observacaoFinal }
        });

    } catch (error) {
        console.error('Erro ao adicionar observação na requisição de fábrica:', error.message, error.stack);
        res.status(500).send({ status: 'error', message: `Falha ao adicionar observação de fábrica: ${error.message}` });
    }
});

// Rota para Adicionar Observação a um Item de GARANTIA
app.post('/add-garantia-observation', async (req, res) => {
    console.log('Requisição POST recebida para /add-garantia-observation:', JSON.stringify(req.body, null, 2));

    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota de observação de garantia:', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const { id_requisicao, codigo_service, observacao } = req.body;

        if (!id_requisicao || !codigo_service || !observacao) {
            console.error('Dados incompletos para adicionar observação de garantia:', req.body);
            return res.status(400).send({ status: 'error', message: "Dados incompletos: 'id_requisicao', 'codigo_service' e 'observacao' são obrigatórios." });
        }
        
        const spreadsheetId = SPREADSHEET_ID_SAIDA_GARANTIA;
        const sheetName = SHEET_NAME_SAIDA_GARANTIA;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.warn(`Planilha de Saída de Garantia ("${sheetName}") vazia ou sem dados.`);
            return res.status(404).send({ status: 'error', message: `Nenhum dado encontrado na planilha de Saída de Garantia.` });
        }

        const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
        const requisicaoColIndex = headers.indexOf('requisição');
        const codigoServiceColIndex = headers.indexOf('codigo service');
        const observacaoColIndex = headers.indexOf('observação');

        if (requisicaoColIndex === -1 || codigoServiceColIndex === -1 || observacaoColIndex === -1) {
            console.error(`Colunas essenciais não encontradas na planilha de Garantia "${sheetName}":`, headers);
            return res.status(500).send({ status: 'error', message: `Uma ou mais colunas essenciais (Requisição, Codigo Service, Observação) não foram encontradas na planilha de Garantia.` });
        }

        let rowIndexToUpdate = -1;
        let observacaoAtual = '';
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const currentRowRequisicao = row[requisicaoColIndex] ? row[requisicaoColIndex].toString().trim() : '';
            const currentRowCodigo = row[codigoServiceColIndex] ? row[codigoServiceColIndex].toString().trim() : '';

            if (currentRowRequisicao === id_requisicao && currentRowCodigo === codigo_service) {
                rowIndexToUpdate = i;
                observacaoAtual = row[observacaoColIndex] || '';
                break;
            }
        }

        if (rowIndexToUpdate === -1) {
            console.warn(`Item de garantia não encontrado para Requisição: ${id_requisicao}, Código Service: ${codigo_service}.`);
            return res.status(404).send({ status: 'error', message: `Item de garantia não encontrado para a requisição ${id_requisicao} e código ${codigo_service}.` });
        }

        const timestamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const novaEntrada = `${timestamp} - ${observacao}`;
        const observacaoFinal = observacaoAtual ? `${observacaoAtual}\n${novaEntrada}` : novaEntrada;

        const range = `${sheetName}!${String.fromCharCode(65 + observacaoColIndex)}${rowIndexToUpdate + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [[observacaoFinal]],
            },
        });

        console.log(`Observação do item de garantia ${codigo_service} da requisição ${id_requisicao} atualizada na linha ${rowIndexToUpdate + 1}.`);
        res.status(200).send({
            status: 'success',
            message: 'Observação adicionada com sucesso ao item de garantia!',
            data: { newObservation: observacaoFinal }
        });

    } catch (error) {
        console.error('Erro ao adicionar observação na requisição de garantia:', error.message, error.stack);
        res.status(500).send({ status: 'error', message: `Falha ao adicionar observação de garantia: ${error.message}` });
    }
});

// Rota de Teste CORS
const APPS_SCRIPT_TARGET_URL_TEST = 'https://script.google.com/macros/s/AKfycbwYWSPrgMdA5IGVYnH5EVJ3FLnU1THcI6SQa8opOHkjN_CZO-G2S2JJDuTqZQDd0Y2s/exec';
app.get('/test-apps-script-cors', async (req, res) => {
    console.log('Recebida requisição para /test-apps-script-cors');
    let sheets;
    try {
        sheets = await getInitializedSheetsClient();
    } catch (error) {
        console.error('Erro ao obter cliente do Google Sheets na rota de teste CORS:', error);
        return res.status(500).send({ status: 'error', message: 'Serviço de planilha não disponível. Erro de inicialização.' });
    }

    try {
        const response = await axios.options(APPS_SCRIPT_TARGET_URL_TEST);

        console.log('--- Resposta da requisição OPTIONS do Apps Script ---');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('----------------------------------------------------');

        res.status(200).json({
            status: 'success',
            message: 'Teste OPTIONS para Apps Script concluído. Verifique os logs da Cloud Function para detalhes.',
            appsScriptResponseStatus: response.status,
            appsScriptResponseHeaders: response.headers
        });

    } catch (error) {
        console.error('Erro ao testar OPTIONS para Apps Script:', error.message);
        if (error.response) {
            console.error('Dados do erro (Apps Script OPTIONS):', error.response.data);
            console.error('Status do erro (Apps Script OPTIONS):', error.response.status);
            res.status(error.response.status).send({
                status: 'error',
                message: `Falha no teste OPTIONS: ${error.message}`,
                appsScriptErrorStatus: error.response.status,
                appsScriptErrorData: error.response.data
            });
        } else if (error.request) {
            console.error('Requisição do erro (sem resposta para OPTIONS):', error.request);
            res.status(502).send({ error: 'Bad Gateway: Nenhuma resposta do Apps Script para OPTIONS.' });
        } else {
            res.status(500).send({ error: 'Erro interno: Falha ao configurar requisição OPTIONS.' });
        }
    }
});


// --- Roteadores Modulares ---

// Roteador do webhook de NF-e do Bling
const createBlingNfeWebhookRouter = require('./webhook_nfe_bling');
const blingNfeWebhookRouter = createBlingNfeWebhookRouter(
    getInitializedSheetsClient,
    SPREADSHEET_ID_NFE,
    SHEET_NAME_NOTAS_FISCAIS,
    BLING_API_BASE_URL,
    COLUMNS_NFE,
    APPS_SCRIPT_TOKEN_URL
);
app.use('/bling/nfe', blingNfeWebhookRouter);

// Roteador para a conferência de NF-e
const createNfeConferenciaRouter = require('./conferencia_nfe');
const nfeConferenciaRouter = createNfeConferenciaRouter(
    getInitializedSheetsClient,
    SPREADSHEET_ID_NFE,
    SHEET_NAME_NOTAS_FISCAIS,
    COLUMNS_NFE
);
app.use('/nfe/conferencia', nfeConferenciaRouter);

// Roteador de Estoque
const createEstoqueRouter = require('./estoque');
const estoqueRouter = createEstoqueRouter(
    getInitializedSheetsClient,
    axios,
    APPS_SCRIPT_TOKEN_URL,
    BLING_API_BASE_URL,
    SPREADSHEET_ID_ESTOQUE,
    SHEET_NAME_ESTOQUE,
    SPREADSHEET_ID_REQUISICAO_FABRICA,
    SHEET_NAME_REQUISICAO_FABRICA,
    SPREADSHEET_ID_REQUISICAO_GERAL_TERCEIROS,
    SHEET_NAME_REQUISICAO_GERAL_TERCEIROS,
    // --- NOVOS PARÂMETROS ADICIONADOS AQUI ---
    SPREADSHEET_ID_SAIDA_FABRICA, 
    SHEET_NAME_SAIDA_FABRICA,
    SPREADSHEET_ID_SAIDA_GARANTIA,
    SHEET_NAME_SAIDA_GARANTIA
);
app.use('/estoque', estoqueRouter);

// Roteador para Saída da Fábrica
const createSaidaFabricaRouter = require('./saida_fabrica');
const saidaFabricaRouter = createSaidaFabricaRouter(
    getInitializedSheetsClient,
    SPREADSHEET_ID_SAIDA_FABRICA,
    SHEET_NAME_SAIDA_FABRICA,
    axios,
    APPS_SCRIPT_TOKEN_URL,
    BLING_API_BASE_URL,
    SPREADSHEET_ID_ESTOQUE,
    SHEET_NAME_ESTOQUE,
    SPREADSHEET_ID_REQUISICAO_FABRICA,
    SHEET_NAME_REQUISICAO_FABRICA
);
app.use('/saida-fabrica', saidaFabricaRouter);

// Roteador para Saída de Garantia
const createSaidaGarantiaRouter = require('./saida_garantia');
const saidaGarantiaRouter = createSaidaGarantiaRouter(
    getInitializedSheetsClient,
    SPREADSHEET_ID_SAIDA_GARANTIA,
    SHEET_NAME_SAIDA_GARANTIA,
    axios,
    APPS_SCRIPT_TOKEN_URL, // Usando a URL de token unificada
    BLING_API_BASE_URL,
    SPREADSHEET_ID_ESTOQUE,
    SHEET_NAME_ESTOQUE
);
app.use('/saida-garantia', saidaGarantiaRouter);

const createAuthRouter = require('./auth');
app.use('/auth', createAuthRouter(getInitializedSheetsClient, SPREADSHEET_ID_CONTAS, SHEET_NAME_CONTA_EMPRESA, SHEET_NAME_CONTA_USUARIO));


// Roteador do WhatsApp (ATUALIZADO)
const createWhatsAppRouter = require('./whatsapp.js');
const whatsAppRouter = createWhatsAppRouter(
    getInitializedSheetsClient,
    axios,
    SPREADSHEET_ID_WHATSAPP, // ID da planilha principal do WhatsApp
    SHEET_NAME_WHATSAPP_CONFIG,
    SHEET_NAME_WHATSAPP_CLIENTES,
    SHEET_NAME_WHATSAPP_HISTORICO
);
app.use('/whatsapp', whatsAppRouter);


// --- ROTEADOR DE PRODUTOS (NOVO) ---
const createProdutosRouter = require('./produtos.js'); 
const produtosRouter = createProdutosRouter( 
    getInitializedSheetsClient,
    SPREADSHEET_ID_ESTOQUE,       // '11EqlFOTNfCiCl-sVlTjNzAK7feWcMJH8VFfOAgUXRSo'
    SHEET_NAME_ESTOQUE,           // 'Produtos'
    SHEET_NAME_PRODUTOS_ESTOQUE   // 'Produtos Estoque'
);
app.use('/produtos', produtosRouter);

const createLojaIntegradaRouter = require('./loja_integrada.js');
const lojaIntegradaRouter = createLojaIntegradaRouter(
    getInitializedSheetsClient,
    axios,
    SPREADSHEET_ID_NFE, // Planilha onde a aba 'VendasLojaIntegrada' está
    SHEET_NAME_VENDAS_LOJA_INTEGRADA,
    SPREADSHEET_ID_NFE, // <-- ATUALIZADO: Planilha onde as chaves de API estão
    SHEET_NAME_LOJA_INTEGRADA_CONFIG // <-- ATUALIZADO: Aba de configuração
);
app.use('/loja-integrada', lojaIntegradaRouter);


// --- EXPORTAÇÃO DA APLICAÇÃO EXPRESS ---
exports.app = app;