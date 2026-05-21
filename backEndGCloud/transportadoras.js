/**
 * transportadoras.js
 * 
 * Módulo para gerenciar transportadoras.
 * Operações: GET (listar), POST (criar), PATCH (editar), DELETE (excluir)
 */

const express = require('express');

function createTransportadorasRouter(getInitializedSheetsClient, spreadsheetId, sheetName) {
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

    /**
     * GET /transportadoras
     * Lista todas as transportadoras
     */
    router.get('/', async (req, res) => {
        try {
            const sheetsClient = await getInitializedSheetsClient();
            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:T`
            });

            const rows = response.data.values || [];
            if (rows.length === 0) {
                return res.json({ transportadoras: [] });
            }

            // Pula o header (primeira linha)
            const transportadoras = rows.slice(1).map((row, index) => ({
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
            const data_inclusao = new Date().toLocaleDateString('pt-BR');

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
                data_inclusao,
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
                    website, contato, tipo, ativo, data_inclusao, faz_coleta
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

    return router;
}

module.exports = createTransportadorasRouter;
