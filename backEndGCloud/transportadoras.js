const express = require('express');

/**
 * Normaliza uma string de cabeçalho para ser uma chave JSON válida, limpa e padronizada.
 */
const normalizeKey = (text) => {
    if (!text) return '';
    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .toLowerCase()
        .replace(/\(.*\)/g, '') // Remove texto entre parênteses
        .replace(/[^a-z0-9]/g, '_') // Substitui caracteres não alfanuméricos por underscore
        .replace(/_+/g, '_') // Substitui múltiplos underscores por um único
        .replace(/^_+|_+$/g, ''); // Remove underscores do início e do fim
};

/**
 * Converte índice de coluna numérica (0-indexed) para letra A1 (ex: 0 -> A, 1 -> B, 27 -> AB).
 */
const colToA1 = (index) => {
    let temp = index;
    let letter = '';
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
};

/**
 * Cria o roteador Express para gerenciamento das Transportadoras.
 */
const createTransportadorasRouter = (getSheetsClient, spreadsheetId, sheetName, notifySync) => {
    const router = express.Router();
    const DEFAULT_HEADERS = ['id', 'nome', 'cnpj', 'telefone', 'email', 'cidade_uf', 'endereco', 'status', 'observacao'];

    /**
     * Inicializa ou obtém os cabeçalhos da aba.
     * Se a aba estiver vazia, grava os cabeçalhos padrão nela.
     */
    async function getOrInitializeHeaders(sheets) {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A1:Z1`,
        });

        const rows = response.data.values;
        if (rows && rows.length > 0 && rows[0].some(cell => cell.trim() !== '')) {
            return rows[0].map(h => h.trim());
        }

        // Se estiver vazia, grava os cabeçalhos padrão
        console.log(`[Transportadoras] Aba vazia detectada. Inicializando cabeçalhos padrão na aba "${sheetName}"`);
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetName}'!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [DEFAULT_HEADERS.map(h => h.toUpperCase())]
            }
        });
        return DEFAULT_HEADERS;
    }

    /**
     * GET /
     * Retorna a lista de todas as transportadoras cadastradas.
     */
    router.get('/', async (req, res, next) => {
        console.log('--- BUSCANDO TRANSPORTADORAS ---');
        try {
            const sheets = await getSheetsClient();
            const rawHeaders = await getOrInitializeHeaders(sheets);
            const normalizedHeaders = rawHeaders.map(normalizeKey);

            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetName}'!A2:Z`,
                valueRenderOption: 'FORMATTED_VALUE',
            });

            const rows = dataResponse.data.values || [];
            const transportadoras = rows.map((row, index) => {
                const item = { rowIndex: index + 2 }; // +2 (1-based e pula cabeçalho)
                normalizedHeaders.forEach((key, colIndex) => {
                    item[key] = row[colIndex] !== undefined ? row[colIndex] : '';
                });
                return item;
            });

            res.status(200).json(transportadoras);
        } catch (error) {
            console.error('[Transportadoras GET] Erro:', error.message);
            next(error);
        }
    });

    /**
     * POST /
     * Cadastra uma nova transportadora.
     */
    router.post('/', async (req, res, next) => {
        console.log('--- CADASTRANDO NOVA TRANSPORTADORA ---', req.body);
        const { nome, cnpj, telefone, email, cidade_uf, endereco, status, observacao } = req.body;

        if (!nome || String(nome).trim() === '') {
            return res.status(400).json({ error: "O campo 'nome' é obrigatório." });
        }

        try {
            const sheets = await getSheetsClient();
            const rawHeaders = await getOrInitializeHeaders(sheets);
            const normalizedHeaders = rawHeaders.map(normalizeKey);

            // Gera um ID único simples
            const uniqueId = `transp_${Date.now()}`;
            const novaTransp = {
                id: uniqueId,
                nome: nome.trim(),
                cnpj: cnpj ? cnpj.trim() : '',
                telefone: telefone ? telefone.trim() : '',
                email: email ? email.trim() : '',
                cidade_uf: cidade_uf ? cidade_uf.trim() : '',
                endereco: endereco ? endereco.trim() : '',
                status: status ? status.trim() : 'Ativa',
                observacao: observacao ? observacao.trim() : ''
            };

            // Monta a linha conforme a ordem dos cabeçalhos na planilha
            const newRow = normalizedHeaders.map(key => novaTransp[key] !== undefined ? novaTransp[key] : '');

            console.log('[Sheets] Gravando nova transportadora...');
            const appendResponse = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `'${sheetName}'!A:A`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [newRow]
                }
            });

            // Notifica tempo real
            if (notifySync) {
                console.log(`[Firestore Sync] Notificando criação da transportadora: ${novaTransp.nome}`);
                notifySync('transportadoraCreated', novaTransp);
            }

            res.status(201).json({
                message: "Transportadora cadastrada com sucesso!",
                data: novaTransp,
                sheetsResponse: appendResponse.data
            });
        } catch (error) {
            console.error('[Transportadoras POST] Erro:', error.message);
            next(error);
        }
    });

    /**
     * PUT /:id
     * Edita os dados de uma transportadora existente pelo ID.
     */
    router.put('/:id', async (req, res, next) => {
        const idTransportadora = req.params.id;
        console.log(`--- EDITANDO TRANSPORTADORA ID: ${idTransportadora} ---`, req.body);

        try {
            const sheets = await getSheetsClient();
            const rawHeaders = await getOrInitializeHeaders(sheets);
            const normalizedHeaders = rawHeaders.map(normalizeKey);

            const idColIndex = normalizedHeaders.indexOf('id');
            if (idColIndex === -1) {
                return res.status(500).json({ error: "Coluna 'ID' não encontrada na planilha de transportadoras." });
            }

            // Lê as linhas existentes para encontrar o registro correspondente
            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetName}'!A2:Z`,
            });

            const rows = dataResponse.data.values || [];
            let rowIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                if (String(rows[i][idColIndex] || '').trim() === String(idTransportadora).trim()) {
                    rowIndex = i + 2; // +2 porque pula cabeçalho e Sheets é 1-indexed
                    break;
                }
            }

            if (rowIndex === -1) {
                return res.status(404).json({ error: `Transportadora com ID "${idTransportadora}" não encontrada.` });
            }

            // Atualiza apenas os campos enviados no body
            const updatePromises = [];
            const fieldsToUpdate = ['nome', 'cnpj', 'telefone', 'email', 'cidade_uf', 'endereco', 'status', 'observacao'];

            fieldsToUpdate.forEach(field => {
                const val = req.body[field];
                if (val !== undefined) {
                    const colIndex = normalizedHeaders.indexOf(field);
                    if (colIndex !== -1) {
                        const cellAddress = `'${sheetName}'!${colToA1(colIndex)}${rowIndex}`;
                        updatePromises.push(
                            sheets.spreadsheets.values.update({
                                spreadsheetId,
                                range: cellAddress,
                                valueInputOption: 'USER_ENTERED',
                                resource: { values: [[val]] }
                            })
                        );
                    }
                }
            });

            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
            }

            const updatedObj = {
                id: idTransportadora,
                ...req.body
            };

            // Notifica tempo real
            if (notifySync) {
                console.log(`[Firestore Sync] Notificando atualização da transportadora: ${idTransportadora}`);
                notifySync('transportadoraUpdated', updatedObj);
            }

            res.status(200).json({
                message: "Transportadora atualizada com sucesso!",
                data: updatedObj
            });

        } catch (error) {
            console.error('[Transportadoras PUT] Erro:', error.message);
            next(error);
        }
    });

    /**
     * DELETE /:id
     * Exclui fisicamente a linha de uma transportadora existente pelo ID.
     */
    router.delete('/:id', async (req, res, next) => {
        const idTransportadora = req.params.id;
        console.log(`--- EXCLUINDO TRANSPORTADORA ID: ${idTransportadora} ---`);

        try {
            const sheets = await getSheetsClient();
            const rawHeaders = await getOrInitializeHeaders(sheets);
            const normalizedHeaders = rawHeaders.map(normalizeKey);

            const idColIndex = normalizedHeaders.indexOf('id');
            if (idColIndex === -1) {
                return res.status(500).json({ error: "Coluna 'ID' não encontrada na planilha de transportadoras." });
            }

            // Lê as linhas existentes para encontrar o registro correspondente
            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetName}'!A2:Z`,
            });

            const rows = dataResponse.data.values || [];
            let rowIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                if (String(rows[i][idColIndex] || '').trim() === String(idTransportadora).trim()) {
                    rowIndex = i + 2; // +2 porque pula cabeçalho e Sheets é 1-indexed
                    break;
                }
            }

            if (rowIndex === -1) {
                return res.status(404).json({ error: `Transportadora com ID "${idTransportadora}" não encontrada.` });
            }

            // Obtém o sheetId da aba 'Transportadoras' para a exclusão física da linha
            const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
            const sheet = spreadsheetInfo.data.sheets.find(s => s.properties.title === sheetName);
            const sheetId = sheet.properties.sheetId;

            console.log(`[Sheets] Deletando a linha ${rowIndex} fisicamente da aba...`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1, // 0-based index inclusivo para start
                                endIndex: rowIndex        // exclusivo para end
                            }
                        }
                    }]
                }
            });

            // Notifica tempo real
            if (notifySync) {
                console.log(`[Firestore Sync] Notificando exclusão da transportadora: ${idTransportadora}`);
                notifySync('transportadoraDeleted', { id: idTransportadora });
            }

            res.status(200).json({
                message: "Transportadora excluída com sucesso!",
                id: idTransportadora
            });

        } catch (error) {
            console.error('[Transportadoras DELETE] Erro:', error.message);
            next(error);
        }
    });

    return router;
};

module.exports = createTransportadorasRouter;
