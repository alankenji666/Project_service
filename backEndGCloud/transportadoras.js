/**
 * transportadoras.js
 * 
 * Módulo para gerenciar transportadoras.
 * Operações: GET (listar), POST (criar), PATCH (editar), DELETE (excluir)
 */

const express = require('express');

function createTransportadorasRouter(getInitializedSheetsClient, spreadsheetId, sheetName, axiosModule, APPS_SCRIPT_TOKEN_URL, BLING_API_BASE_URL) {
    const router = express.Router();

    // Mapeamento de colunas para índices
    const COLUMNS = {
        CODIGO: 0,
        NOME: 1,
        FANTASIA: 2,
        ENDERECO: 3,
        NUMERO: 4,
        COMPLEMENTO: 5,
        BAIRRO: 6,
        CIDADE: 7,
        ESTADO: 8,
        CEP: 9,
        CNPJ: 10,
        INSCRICAO_ESTADUAL: 11,
        TELEFONE: 12,
        EMAIL: 13,
        WEBSITE: 14,
        CONTATO: 15,
        TIPO: 16,
        ATIVO: 17,
        DATA_INCLUSAO: 18,
        FAZ_COLETA: 19
    };

    const HEADERS = [
        'Codigo', 'Nome', 'Fantasia', 'Endereco', 'Numero', 'Complemento',
        'Bairro', 'Cidade', 'Estado', 'CEP', 'CNPJ', 'Inscricao_Estadual',
        'Telefone', 'Email', 'Website', 'Contato', 'Tipo', 'Ativo',
        'Data_Inclusao', 'Faz_Coleta'
    ];

    /**
     * Verifica e cria headers se não existirem
     */
    async function ensureHeadersExist(sheetsClient) {
        try {
            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A1:T1`
            });

            const existingHeaders = response.data.values?.[0] || [];
            
            // Se não tem headers ou está vazio, cria
            if (existingHeaders.length === 0 || !existingHeaders[0]) {
                console.log(`[Transportadoras] Criando headers na aba "${sheetName}"...`);
                await sheetsClient.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!A1:T1`,
                    valueInputOption: 'RAW',
                    resource: { values: [HEADERS] }
                });
                console.log(`[Transportadoras] ✅ Headers criados com sucesso!`);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[Transportadoras] Erro ao verificar/criar headers:', err.message);
            throw err;
        }
    }

    /**
     * GET /transportadoras
     * Lista todas as transportadoras
     */
    router.get('/', async (req, res) => {
        try {
            const sheetsClient = await getInitializedSheetsClient();
            
            // Garante que os headers existem
            await ensureHeadersExist(sheetsClient);

            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:T`
            });

            const rows = response.data.values || [];
            if (rows.length === 0) {
                return res.json({ transportadoras: [] });
            }

            // Pula o header (primeira linha) e filtra linhas vazias
            const transportadoras = rows.slice(1)
                .filter(row => row && row[COLUMNS.CODIGO]) // Filtra linhas vazias
                .map((row, index) => ({
                codigo: row[COLUMNS.CODIGO] || '',
                nome: row[COLUMNS.NOME] || '',
                fantasia: row[COLUMNS.FANTASIA] || '',
                endereco: row[COLUMNS.ENDERECO] || '',
                numero: row[COLUMNS.NUMERO] || '',
                complemento: row[COLUMNS.COMPLEMENTO] || '',
                bairro: row[COLUMNS.BAIRRO] || '',
                cidade: row[COLUMNS.CIDADE] || '',
                estado: row[COLUMNS.ESTADO] || '',
                cep: row[COLUMNS.CEP] || '',
                cnpj: row[COLUMNS.CNPJ] || '',
                inscricao_estadual: row[COLUMNS.INSCRICAO_ESTADUAL] || '',
                telefone: row[COLUMNS.TELEFONE] || '',
                email: row[COLUMNS.EMAIL] || '',
                website: row[COLUMNS.WEBSITE] || '',
                contato: row[COLUMNS.CONTATO] || '',
                tipo: row[COLUMNS.TIPO] || '',
                ativo: row[COLUMNS.ATIVO] || '',
                data_inclusao: row[COLUMNS.DATA_INCLUSAO] || '',
                faz_coleta: row[COLUMNS.FAZ_COLETA] || '',
                row_index: index + 2 // +2 porque começa em 1 (header) e A1
            }));

            res.json({ transportadoras });
        } catch (err) {
            console.error('Erro ao listar transportadoras:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * GET /transportadoras/:codigo
     * Obtém uma transportadora específica
     */
    router.get('/:codigo', async (req, res) => {
        try {
            const { codigo } = req.params;
            const sheetsClient = await getInitializedSheetsClient();
            
            // Garante que os headers existem
            await ensureHeadersExist(sheetsClient);

            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:T`
            });

            const rows = response.data.values || [];
            const transportadora = rows.slice(1).find(row => row[COLUMNS.CODIGO] === codigo);

            if (!transportadora) {
                return res.status(404).json({ error: 'Transportadora não encontrada' });
            }

            res.json({
                codigo: transportadora[COLUMNS.CODIGO] || '',
                nome: transportadora[COLUMNS.NOME] || '',
                fantasia: transportadora[COLUMNS.FANTASIA] || '',
                endereco: transportadora[COLUMNS.ENDERECO] || '',
                numero: transportadora[COLUMNS.NUMERO] || '',
                complemento: transportadora[COLUMNS.COMPLEMENTO] || '',
                bairro: transportadora[COLUMNS.BAIRRO] || '',
                cidade: transportadora[COLUMNS.CIDADE] || '',
                estado: transportadora[COLUMNS.ESTADO] || '',
                cep: transportadora[COLUMNS.CEP] || '',
                cnpj: transportadora[COLUMNS.CNPJ] || '',
                inscricao_estadual: transportadora[COLUMNS.INSCRICAO_ESTADUAL] || '',
                telefone: transportadora[COLUMNS.TELEFONE] || '',
                email: transportadora[COLUMNS.EMAIL] || '',
                website: transportadora[COLUMNS.WEBSITE] || '',
                contato: transportadora[COLUMNS.CONTATO] || '',
                tipo: transportadora[COLUMNS.TIPO] || '',
                ativo: transportadora[COLUMNS.ATIVO] || '',
                data_inclusao: transportadora[COLUMNS.DATA_INCLUSAO] || '',
                faz_coleta: transportadora[COLUMNS.FAZ_COLETA] || ''
            });
        } catch (err) {
            console.error('Erro ao obter transportadora:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /transportadoras
     * Cria uma nova transportadora
     */
    router.post('/', async (req, res) => {
        try {
            const {
                codigo, nome, fantasia, endereco, numero, complemento, bairro,
                cidade, estado, cep, cnpj, inscricao_estadual, telefone, email,
                website, contato, tipo, ativo, faz_coleta
            } = req.body;

            // Validação básica
            if (!codigo || !nome) {
                return res.status(400).json({ error: 'Código e Nome são obrigatórios' });
            }

            const sheetsClient = await getInitializedSheetsClient();
            
            // Garante que os headers existem (primeira vez que alguém cria)
            await ensureHeadersExist(sheetsClient);

            // Verifica se código já existe
            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:A`
            });
            const codigosExistentes = response.data.values?.slice(1).map(row => row[0]) || [];
            if (codigosExistentes.includes(codigo)) {
                return res.status(409).json({ error: `Já existe uma transportadora com o código "${codigo}"` });
            }

            const newRow = [
                codigo,
                nome,
                fantasia || '',
                endereco || '',
                numero || '',
                complemento || '',
                bairro || '',
                cidade || '',
                estado || '',
                cep || '',
                cnpj || '',
                inscricao_estadual || '',
                telefone || '',
                email || '',
                website || '',
                contato || '',
                tipo || 'Transportadora',
                ativo || 'Sim',
                new Date().toLocaleDateString('pt-BR'),
                faz_coleta || 'Não'
            ];

            await sheetsClient.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:T`,
                valueInputOption: 'RAW',
                resource: { values: [newRow] }
            });

            // Notificar frontend via Firestore
            if (req.notifySync) {
                await req.notifySync('transportadorasUpdated', {
                    action: 'created',
                    codigo,
                    timestamp: new Date()
                });
            }

            res.status(201).json({
                message: 'Transportadora criada com sucesso',
                transportadora: {
                    codigo, nome, fantasia, endereco, numero, complemento, bairro,
                    cidade, estado, cep, cnpj, inscricao_estadual, telefone, email,
                    website, contato, tipo, ativo, faz_coleta,
                    data_inclusao: new Date().toLocaleDateString('pt-BR')
                }
            });
        } catch (err) {
            console.error('Erro ao criar transportadora:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * PATCH /transportadoras/:codigo
     * Atualiza uma transportadora existente
     */
    router.patch('/:codigo', async (req, res) => {
        try {
            const { codigo } = req.params;
            const updates = req.body;

            const sheetsClient = await getInitializedSheetsClient();
            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:T`
            });

            const rows = response.data.values || [];
            const rowIndex = rows.findIndex(row => row[COLUMNS.CODIGO] === codigo);

            if (rowIndex === -1) {
                return res.status(404).json({ error: 'Transportadora não encontrada' });
            }

            // Se está mudando o código, verifica se o novo código já existe
            if (updates.codigo && updates.codigo !== codigo) {
                const codigosExistentes = rows.slice(1).map(row => row[COLUMNS.CODIGO]).filter(c => c && c !== codigo);
                if (codigosExistentes.includes(updates.codigo)) {
                    return res.status(409).json({ error: `Já existe uma transportadora com o código "${updates.codigo}"` });
                }
            }

            // Pega a linha atual
            const currentRow = rows[rowIndex];
            const updatedRow = [
                updates.codigo !== undefined ? updates.codigo : currentRow[COLUMNS.CODIGO] || '',
                updates.nome !== undefined ? updates.nome : currentRow[COLUMNS.NOME] || '',
                updates.fantasia !== undefined ? updates.fantasia : currentRow[COLUMNS.FANTASIA] || '',
                updates.endereco !== undefined ? updates.endereco : currentRow[COLUMNS.ENDERECO] || '',
                updates.numero !== undefined ? updates.numero : currentRow[COLUMNS.NUMERO] || '',
                updates.complemento !== undefined ? updates.complemento : currentRow[COLUMNS.COMPLEMENTO] || '',
                updates.bairro !== undefined ? updates.bairro : currentRow[COLUMNS.BAIRRO] || '',
                updates.cidade !== undefined ? updates.cidade : currentRow[COLUMNS.CIDADE] || '',
                updates.estado !== undefined ? updates.estado : currentRow[COLUMNS.ESTADO] || '',
                updates.cep !== undefined ? updates.cep : currentRow[COLUMNS.CEP] || '',
                updates.cnpj !== undefined ? updates.cnpj : currentRow[COLUMNS.CNPJ] || '',
                updates.inscricao_estadual !== undefined ? updates.inscricao_estadual : currentRow[COLUMNS.INSCRICAO_ESTADUAL] || '',
                updates.telefone !== undefined ? updates.telefone : currentRow[COLUMNS.TELEFONE] || '',
                updates.email !== undefined ? updates.email : currentRow[COLUMNS.EMAIL] || '',
                updates.website !== undefined ? updates.website : currentRow[COLUMNS.WEBSITE] || '',
                updates.contato !== undefined ? updates.contato : currentRow[COLUMNS.CONTATO] || '',
                updates.tipo !== undefined ? updates.tipo : currentRow[COLUMNS.TIPO] || '',
                updates.ativo !== undefined ? updates.ativo : currentRow[COLUMNS.ATIVO] || '',
                currentRow[COLUMNS.DATA_INCLUSAO] || '', // Data de inclusão não muda
                updates.faz_coleta !== undefined ? updates.faz_coleta : currentRow[COLUMNS.FAZ_COLETA] || ''
            ];

            const rangeToUpdate = `${sheetName}!A${rowIndex + 1}:T${rowIndex + 1}`;
            await sheetsClient.spreadsheets.values.update({
                spreadsheetId,
                range: rangeToUpdate,
                valueInputOption: 'RAW',
                resource: { values: [updatedRow] }
            });

            // Notificar frontend via Firestore
            if (req.notifySync) {
                await req.notifySync('transportadorasUpdated', {
                    action: 'updated',
                    codigo,
                    timestamp: new Date()
                });
            }

            res.json({
                message: 'Transportadora atualizada com sucesso',
                transportadora: {
                    codigo: updatedRow[COLUMNS.CODIGO],
                    nome: updatedRow[COLUMNS.NOME],
                    fantasia: updatedRow[COLUMNS.FANTASIA],
                    endereco: updatedRow[COLUMNS.ENDERECO],
                    numero: updatedRow[COLUMNS.NUMERO],
                    complemento: updatedRow[COLUMNS.COMPLEMENTO],
                    bairro: updatedRow[COLUMNS.BAIRRO],
                    cidade: updatedRow[COLUMNS.CIDADE],
                    estado: updatedRow[COLUMNS.ESTADO],
                    cep: updatedRow[COLUMNS.CEP],
                    cnpj: updatedRow[COLUMNS.CNPJ],
                    inscricao_estadual: updatedRow[COLUMNS.INSCRICAO_ESTADUAL],
                    telefone: updatedRow[COLUMNS.TELEFONE],
                    email: updatedRow[COLUMNS.EMAIL],
                    website: updatedRow[COLUMNS.WEBSITE],
                    contato: updatedRow[COLUMNS.CONTATO],
                    tipo: updatedRow[COLUMNS.TIPO],
                    ativo: updatedRow[COLUMNS.ATIVO],
                    data_inclusao: updatedRow[COLUMNS.DATA_INCLUSAO],
                    faz_coleta: updatedRow[COLUMNS.FAZ_COLETA]
                }
            });
        } catch (err) {
            console.error('Erro ao atualizar transportadora:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * DELETE /transportadoras/:codigo
     * Deleta uma transportadora (limpa a linha)
     */
    router.delete('/:codigo', async (req, res) => {
        try {
            const { codigo } = req.params;
            const sheetsClient = await getInitializedSheetsClient();
            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:T`
            });

            const rows = response.data.values || [];
            const rowIndex = rows.findIndex(row => row[COLUMNS.CODIGO] === codigo);

            if (rowIndex === -1) {
                return res.status(404).json({ error: 'Transportadora não encontrada' });
            }

            // Limpa a linha (substitui por array vazio)
            const emptyRow = Array(20).fill('');
            const rangeToDelete = `${sheetName}!A${rowIndex + 1}:T${rowIndex + 1}`;
            await sheetsClient.spreadsheets.values.update({
                spreadsheetId,
                range: rangeToDelete,
                valueInputOption: 'RAW',
                resource: { values: [emptyRow] }
            });

            // Notificar frontend via Firestore
            if (req.notifySync) {
                await req.notifySync('transportadorasUpdated', {
                    action: 'deleted',
                    codigo,
                    timestamp: new Date()
                });
            }

            res.json({ message: 'Transportadora deletada com sucesso', codigo });
        } catch (err) {
            console.error('Erro ao deletar transportadora:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Helper para obter token do Bling
    let _cachedToken = null;
    let _tokenExpiresAt = 0;
    async function getToken() {
        if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;
        for (let i = 0; i < 3; i++) {
            try {
                const response = await axiosModule.get(APPS_SCRIPT_TOKEN_URL);
                const token = response.data.access_token || response.data.accessToken;
                if (token) {
                    _cachedToken = token;
                    _tokenExpiresAt = Date.now() + (1000 * 60 * 30);
                    return token;
                }
            } catch (e) {
                if (i === 2) throw e;
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        throw new Error("Falha ao obter token de acesso do Bling.");
    }

    /**
     * POST /transportadoras/sync
     * Sincroniza as transportadoras do Bling com a planilha
     */
    router.post('/sync', async (req, res) => {
        try {
            console.log('[Transportadoras] Iniciando sincronização com Bling...');
            const sheetsClient = await getInitializedSheetsClient();
            await ensureHeadersExist(sheetsClient);

            // 1. Busca Token e Lista de Transportadoras do Bling
            const token = await getToken();
            const blingUrl = `${BLING_API_BASE_URL || 'https://www.bling.com.br/Api/v3'}/contatos?idTipoContato=14578222406&limite=100`;
            const blingRes = await axiosModule.get(blingUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const contatosBlingList = blingRes.data.data || [];
            
            console.log(`[Transportadoras] Encontrados ${contatosBlingList.length} contatos tipo T no Bling. Buscando detalhes...`);

            // 2. Busca detalhes completos (para pegar endereço e fantasia)
            const contatosCompletos = [];
            for (const c of contatosBlingList) {
                try {
                    const detailRes = await axiosModule.get(`${BLING_API_BASE_URL || 'https://www.bling.com.br/Api/v3'}/contatos/${c.id}`, { 
                        headers: { 'Authorization': `Bearer ${token}` } 
                    });
                    contatosCompletos.push(detailRes.data.data);
                } catch (err) {
                    console.error(`[Transportadoras] Erro ao buscar detalhes de ${c.id}:`, err.message);
                }
                // Rate limit (3 por segundo = ~333ms)
                await new Promise(r => setTimeout(r, 350));
            }

            // 3. Busca transportadoras na Planilha
            const sheetsResponse = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:T`
            });
            const rows = sheetsResponse.data.values || [];
            const headerRow = rows[0] || HEADERS;
            
            const existingInSheets = rows.slice(1).map((r, i) => ({
                row: r,
                rowIndex: i + 2, // 1 for header + 1 for 0-index
                codigo: r[COLUMNS.CODIGO],
                cnpj: r[COLUMNS.CNPJ] ? r[COLUMNS.CNPJ].replace(/\D/g, '') : '',
                nome: (r[COLUMNS.NOME] || '').toLowerCase().trim()
            })).filter(r => r.codigo);

            const updates = []; // Array of updates for batch
            const newRows = []; // Rows to append

            // 4. Compara e Mescla
            for (const b of contatosCompletos) {
                const bCnpj = b.numeroDocumento ? b.numeroDocumento.replace(/\D/g, '') : '';
                const bNome = (b.nome || '').toLowerCase().trim();
                
                // Match por CNPJ (se existir) ou por Nome
                const match = existingInSheets.find(s => 
                    (bCnpj && s.cnpj === bCnpj) || (s.nome === bNome)
                );

                const dataAtual = new Date().toISOString();
                
                // Montar nova linha com dados do Bling
                const end = (b.endereco && b.endereco.geral) ? b.endereco.geral : {};
                const mappedRow = [];
                mappedRow[COLUMNS.CODIGO] = String(b.id || '');
                mappedRow[COLUMNS.NOME] = b.nome || '';
                mappedRow[COLUMNS.FANTASIA] = b.fantasia || '';
                mappedRow[COLUMNS.ENDERECO] = end.endereco || '';
                mappedRow[COLUMNS.NUMERO] = end.numero || '';
                mappedRow[COLUMNS.COMPLEMENTO] = end.complemento || '';
                mappedRow[COLUMNS.BAIRRO] = end.bairro || '';
                mappedRow[COLUMNS.CIDADE] = end.municipio || '';
                mappedRow[COLUMNS.ESTADO] = end.uf || '';
                mappedRow[COLUMNS.CEP] = end.cep || '';
                mappedRow[COLUMNS.CNPJ] = b.numeroDocumento || '';
                mappedRow[COLUMNS.INSCRICAO_ESTADUAL] = b.ie || '';
                mappedRow[COLUMNS.TELEFONE] = b.telefone || b.celular || '';
                mappedRow[COLUMNS.EMAIL] = b.email || '';
                mappedRow[COLUMNS.WEBSITE] = ''; // Bling não tem ou não mapeado
                mappedRow[COLUMNS.CONTATO] = (b.pessoasContato && b.pessoasContato[0] && b.pessoasContato[0].nome) ? b.pessoasContato[0].nome : '';
                mappedRow[COLUMNS.TIPO] = 'Transportadora';
                mappedRow[COLUMNS.ATIVO] = (b.situacao === 'A') ? 'Sim' : 'Não';
                mappedRow[COLUMNS.FAZ_COLETA] = 'Sim'; // default
                
                if (match) {
                    // Atualizar linha existente
                    // Preservar alguns campos se estiverem vazios no Bling
                    for (let i = 0; i < 20; i++) {
                        if (!mappedRow[i]) mappedRow[i] = match.row[i] || '';
                    }
                    mappedRow[COLUMNS.DATA_INCLUSAO] = match.row[COLUMNS.DATA_INCLUSAO] || dataAtual;
                    
                    updates.push({
                        range: `${sheetName}!A${match.rowIndex}:T${match.rowIndex}`,
                        values: [mappedRow]
                    });
                } else {
                    // Inserir nova linha
                    mappedRow[COLUMNS.DATA_INCLUSAO] = dataAtual;
                    for (let i = 0; i < 20; i++) {
                        if (mappedRow[i] === undefined) mappedRow[i] = '';
                    }
                    newRows.push(mappedRow);
                }
            }

            // 5. Aplicar atualizações em lote (Batch Update)
            if (updates.length > 0) {
                console.log(`[Transportadoras] Atualizando ${updates.length} transportadoras existentes...`);
                await sheetsClient.spreadsheets.values.batchUpdate({
                    spreadsheetId,
                    resource: {
                        valueInputOption: 'RAW',
                        data: updates
                    }
                });
            }

            // 6. Aplicar inserções (Append)
            if (newRows.length > 0) {
                console.log(`[Transportadoras] Inserindo ${newRows.length} novas transportadoras...`);
                await sheetsClient.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${sheetName}!A:T`,
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: newRows }
                });
            }

            // Notificar frontend via Firestore
            if (req.notifySync) {
                await req.notifySync('transportadorasUpdated', {
                    action: 'synced',
                    timestamp: new Date()
                });
            }

            res.json({ 
                message: 'Sincronização concluída com sucesso', 
                atualizados: updates.length, 
                novos: newRows.length 
            });

        } catch (err) {
            console.error('[Transportadoras] Erro na sincronização:', err.response ? err.response.data : err.message);
            res.status(500).json({ error: 'Erro ao sincronizar transportadoras' });
        }
    });

    return router;
}

module.exports = createTransportadorasRouter;
