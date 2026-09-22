const express = require('express');

/**
 * Cria o roteador para lidar com os Pedidos de Garantia
 * @param {Function} getInitializedSheetsClient - Factory do cliente Google Sheets
 * @param {string} spreadsheetId - ID da planilha principal (Dados Sistemas - Fabrica 1)
 */
function createGarantiaRouter(getInitializedSheetsClient, spreadsheetId) {
    const router = express.Router();

    // POST /garantia/pedido
    // Registra um novo pedido na aba "PedidosGarantia"
    router.post('/pedido', async (req, res, next) => {
        console.log('[garantia] POST /pedido recebido:', JSON.stringify(req.body, null, 2));

        try {
            const {
                idCliente, // Pode ser CPF/CNPJ ou ID Interno
                numero,
                data,
                situacao,
                nomeContato,
                cpfCnpj,
                totalProdutos,
                totalPedido,
                vendedor,
                loja,
                idNotaFiscal,
                equipamento, // Novo: Equipamento em Garantia
                itens, // String formatada ex: (564010017, 3.00, 60.28|OK)
                observacao,
                avaliacao
            } = req.body;

            const sheets = await getInitializedSheetsClient();
            const sheetName = 'OrcamentosGarantia';

            // Estrutura das Colunas da planilha de pedidos:
            // 0: Conferido (Deixa Vazio)
            // 1: ID Pedido (numero gerado ou enviado)
            // 2: Número (numero gerado ou enviado)
            // 3: Número Loja (Deixa Vazio)
            // 4: Data
            // 5: Data Saída (Copia a Data inicial)
            // 6: Situação (Padrão: EM ABERTO)
            // 7: Contato Nome
            // 8: CPF/CNPJ
            // 9: Total Produtos
            // 10: Total Pedido
            // 11: Vendedor
            // 12: Loja
            // 13: ID Nota Fiscal
            // 14: Observação
            // 15: Itens
            // 16: Observação (2) / Avaliação Interna
            // 17: Orçamento
            // 18: Equipamento (Novo)

            const idGerado = numero || 'GAR-' + Math.floor(Date.now() / 1000).toString();

            const novaLinha = [
                '', // Conferido
                idGerado, // ID Pedido
                idGerado, // Número
                '', // Número Loja
                data || new Date().toISOString().split('T')[0], // Data
                data || new Date().toISOString().split('T')[0], // Data Saída
                situacao || 'EM ABERTO', // Situação
                nomeContato || '', // Contato Nome
                cpfCnpj || '', // CPF/CNPJ
                totalProdutos || '0,00', // Total Produtos
                totalPedido || '0,00', // Total Pedido
                vendedor || 'Sistema', // Vendedor
                loja || 'Fábrica', // Loja
                idNotaFiscal || '', // ID Nota Fiscal
                observacao || '', // Observação
                itens || '', // Itens
                avaliacao || '', // Observação (2) - Usado para Avaliação Interna
                '', // Orçamento
                equipamento || '' // Equipamento
            ];

            // Verifica se a planilha está vazia para adicionar o cabeçalho
            try {
                const headerCheck = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${sheetName}!A1`
                });
                
                if (!headerCheck.data.values || headerCheck.data.values.length === 0 || !headerCheck.data.values[0][0]) {
                    const cabecalhos = [
                        'Conferido', 'ID Pedido', 'Número', 'Número Loja', 'Data', 'Data Saída', 'Situação', 'Contato Nome', 'CPF/CNPJ', 'Total Produtos', 'Total Pedido', 'Vendedor', 'Loja', 'ID Nota Fiscal', 'Observação', 'Itens', 'Observação 2', 'Orçamento', 'Equipamento'
                    ];
                    
                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `${sheetName}!A1:S1`,
                        valueInputOption: 'USER_ENTERED',
                        resource: {
                            values: [cabecalhos]
                        }
                    });
                    console.log(`[garantia] Cabeçalho criado na aba ${sheetName}`);
                }
            } catch (err) {
                console.error(`[garantia] Erro ao verificar/criar cabeçalho:`, err);
            }

            const response = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:S`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [novaLinha]
                }
            });

            console.log(`[garantia] Pedido registrado com sucesso em ${sheetName}. Linhas afetadas: ${response.data.updates.updatedRows}`);

            res.status(201).json({
                error: false,
                message: 'Pedido de Garantia criado com sucesso!',
                updatedRange: response.data.updates.updatedRange,
                idPedido: idGerado
            });

        } catch (error) {
            console.error('[garantia] Erro ao registrar pedido:', error);
            next(error);
        }
    });

    // GET /garantia/pedido
    // Retorna todos os pedidos da aba "PedidosGarantia"
    router.get('/pedido', async (req, res, next) => {
        try {
            const sheets = await getInitializedSheetsClient();
            const sheetName = 'OrcamentosGarantia';
            
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A2:T` // Busca até a coluna T (Transportadora)
            });

            const rows = response.data.values || [];
            
            const data = rows.map((row, index) => {
                return {
                    rowIndex: index + 2,
                    idPedido: row[1] || '',
                    numero: row[2] || '',
                    data: row[4] || '',
                    situacao: row[6] || '',
                    cliente: row[7] || '',
                    cpfCnpj: row[8] || '',
                    observacao: row[14] || '',
                    itens: row[15] || '',
                    avaliacao: row[16] || '',
                    equipamento: row[18] || '',
                    transportadora: row[19] || ''
                };
            });

            res.json(data);
        } catch (error) {
            console.error('[garantia] Erro ao buscar pedidos:', error);
            next(error);
        }
    });

    // POST /garantia/pedido/update
    // Atualiza um pedido existente na aba "PedidosGarantia"
    router.post('/pedido/update', async (req, res, next) => {
        console.log('[garantia] POST /pedido/update recebido:', JSON.stringify(req.body, null, 2));

        try {
            const {
                idPedido, // Obrigatório para saber qual linha atualizar
                numero,
                situacao,
                nomeContato,
                cpfCnpj,
                idNotaFiscal,
                equipamento,
                itens,
                observacao,
                avaliacao,
                transportadora
            } = req.body;

            if (!idPedido) {
                return res.status(400).json({ error: true, message: 'idPedido é obrigatório.' });
            }

            const sheets = await getInitializedSheetsClient();
            const sheetName = 'OrcamentosGarantia';
            
            // 1. Buscar a linha correta baseada no idPedido
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!B:B` // Coluna B tem o ID Pedido
            });

            const rows = response.data.values || [];
            let rowIndex = -1;
            
            // Procura a linha (lembrando que Google Sheets começa em 1, array em 0)
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === String(idPedido)) {
                    rowIndex = i + 1; // +1 porque array começa em 0
                    break;
                }
            }

            if (rowIndex === -1) {
                return res.status(404).json({ error: true, message: 'Pedido não encontrado.' });
            }

            // 2. Montar as atualizações que precisamos fazer
            // Usaremos a API de batchUpdate ou múltiplos updates para não sobrescrever colunas vazias acidentalmente,
            // mas como sabemos a estrutura e queremos alterar campos específicos, vamos atualizar célula a célula ou ranges específicos.
            
            // Colunas:
            // C(3): Número
            // G(7): Situação
            // H(8): Contato Nome
            // I(9): CPF/CNPJ
            // N(14): ID Nota Fiscal
            // O(15): Observação
            // P(16): Itens
            // Q(17): Observação 2 / Avaliação
            // S(19): Equipamento

            const updates = [];
            const addUpdate = (colLetter, value) => {
                if (value !== undefined) {
                    updates.push({
                        range: `${sheetName}!${colLetter}${rowIndex}`,
                        values: [[value]]
                    });
                }
            };

            addUpdate('C', numero);
            addUpdate('G', situacao);
            addUpdate('H', nomeContato);
            addUpdate('I', cpfCnpj);
            addUpdate('N', idNotaFiscal);
            addUpdate('O', observacao);
            addUpdate('P', itens);
            addUpdate('Q', avaliacao);
            addUpdate('S', equipamento);
            addUpdate('T', transportadora);

            if (updates.length > 0) {
                const data = updates.map(u => ({
                    range: u.range,
                    values: u.values
                }));

                await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId,
                    resource: {
                        valueInputOption: 'USER_ENTERED',
                        data: data
                    }
                });
            }

            console.log(`[garantia] Pedido ${idPedido} atualizado com sucesso na linha ${rowIndex}.`);
            
            // Notifica o frontend
            if (req.notifySync) {
                await req.notifySync('garantiaUpdated', { idPedido, rowIndex, tipo: 'pedido' });
            }

            res.json({
                error: false,
                message: 'Pedido atualizado com sucesso!'
            });

        } catch (error) {
            console.error('[garantia] Erro ao atualizar pedido:', error);
            next(error);
        }
    });

    // GET /garantia/satg
    // Lista todas as solicitações da aba SatG
    router.get('/satg', async (req, res, next) => {
        try {
            const sheets = await getInitializedSheetsClient();
            const sheetName = 'SatG';
            
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A2:AF` // Até AF (coluna 32)
            });

            const rows = response.data.values || [];
            
            const data = rows.map((row, index) => {
                return {
                    rowIndex: index + 2, // Linha exata na planilha
                    codigo: row[0] || '',
                    data: row[1] || '',
                    cliente: row[2] || '',      // Razão Social
                    cpf: row[3] || '',
                    nomeContato: row[4] || '',
                    telefone: row[5] || '',
                    email: row[6] || '',
                    revenda: row[7] || '',
                    localRevenda: row[8] || '',
                    equipamento: row[9] || '',  // Modelo/Ano
                    numeroSerie: row[10] || '',
                    numeroRequisicao: row[11] || '', // Nº Pedido do Cliente
                    notaFiscal: row[12] || '',
                    dataCompra: row[13] || '',
                    dataEntregaTecnica: row[14] || '',
                    aplicacao: row[15] || '',
                    chassiEndereco: row[16] || '',
                    emOperacao: row[17] || '',
                    dataParada: row[18] || '',
                    dataUltimaPreventiva: row[19] || '',
                    sintoma: row[20] || '',
                    problema: row[21] || '',    // Descrição Defeito
                    preDiagnostico: row[22] || '',
                    fotos: row[23] || '',       // Links das fotos
                    status: row[24] || 'EM ANALISE', // Y
                    acaoPecas: row[25] || '',                  // Z
                    observacao: row[26] || '',                 // AA (Avaliação Interna)
                    idPedido: row[27] || '',                   // AB (Pedido Vinculado)
                    retornoItem: row[28] || 'EM ANALISE',        // AC (Retorno Item)
                    observacaoSatg: row[29] || '',             // AD (Observação SatG)
                    ondeEstaProblema: row[30] || '',           // AE (Onde Está o Problema)
                    tipoEquipamento: row[31] || ''             // AF (Tipo Equipamento)
                };
            });

            res.json(data);
        } catch (error) {
            console.error('[garantia] Erro ao buscar dados da SatG:', error);
            next(error);
        }
    });

    // POST /garantia/satg/public-submit
    // Recebe o preenchimento do formulário público e insere na aba SatG
    router.post('/satg/public-submit', async (req, res, next) => {
        try {
            const formData = req.body;
            const sheets = await getInitializedSheetsClient();
            const sheetName = 'SatG';

            // Buscar a última linha para gerar o novo Código (Ex: SAT-G: 0045-02)
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:A` // Pega apenas a coluna A (Códigos)
            });

            const rows = response.data.values || [];
            let lastCodeNumber = 0;
            let lastCodeSuffix = -1;

            if (rows.length > 1) {
                // Pular cabeçalho, pegar o último código preenchido
                for (let i = rows.length - 1; i >= 1; i--) {
                    const codeMatch = String(rows[i][0] || '').match(/SAT-G:\s*(\d+)-(\d+)/i);
                    if (codeMatch) {
                        lastCodeNumber = parseInt(codeMatch[1], 10);
                        lastCodeSuffix = parseInt(codeMatch[2], 10);
                        break;
                    }
                }
            }

            // Gera o novo código (incrementando o sufixo ou o número principal)
            // Se preferir, podemos sempre incrementar o número principal para novos formulários
            const nextCodeNumber = lastCodeNumber + 1;
            const novoCodigo = `SAT-G: ${String(nextCodeNumber).padStart(4, '0')}-00`;

            const dataAtual = new Date().toLocaleDateString('pt-BR');

            // Preparar a nova linha de acordo com a ordem das colunas mapeadas
            // Colunas:
            // A: codigo, B: data, C: cliente, D: cpf, E: nomeContato, F: telefone, G: email,
            // H: revenda, I: localRevenda, J: equipamento, K: numeroSerie, L: numeroRequisicao,
            // M: notaFiscal, N: dataCompra, O: dataEntregaTecnica, P: aplicacao, Q: chassiEndereco,
            // R: emOperacao, S: dataParada, T: dataUltimaPreventiva, U: sintoma, V: problema,
            // W: preDiagnostico, X: fotos, Y: status, Z: acaoPecas, AA: observacao, AB: idPedido

            const safeString = (val) => {
                if (!val) return '';
                const str = String(val);
                if (str.startsWith('+') || str.startsWith('=')) return "'" + str;
                return str;
            };

            const newRow = [
                novoCodigo,                                 // A: Código
                dataAtual,                                  // B: Data
                safeString(formData.cliente),               // C: Razão Social
                safeString(formData.cpf),                   // D: CPF/CNPJ
                safeString(formData.nomeContato),           // E: Nome
                safeString(formData.telefone),              // F: Telefone
                safeString(formData.email),                 // G: Email
                safeString(formData.revenda),               // H: Revenda?
                safeString(formData.localRevenda),          // I: Local da Revenda
                safeString(formData.equipamento),           // J: Modelo/Ano
                safeString(formData.numeroSerie),           // K: Num Série
                safeString(formData.numeroRequisicao),      // L: Nº Requisição
                safeString(formData.notaFiscal),            // M: Nota Fiscal
                safeString(formData.dataCompra),            // N: Data Compra
                safeString(formData.dataEntregaTecnica),    // O: Data Entrega Técnica
                safeString(formData.aplicacao),             // P: Aplicação
                safeString(formData.chassiEndereco),        // Q: Chassi / Endereço
                safeString(formData.emOperacao),            // R: Em Operação?
                safeString(formData.dataParada),            // S: Data da Parada
                safeString(formData.dataUltimaPreventiva),  // T: Data Última Preventiva
                safeString(formData.sintoma),               // U: Sintoma Apresentado
                safeString(formData.problema),              // V: Problema
                safeString(formData.preDiagnostico),        // W: Pré-Diagnóstico
                '',                                         // X: Fotos
                'EM ANALISE',                               // Y: Status Garantia
                '',                                         // Z: Ação Peças
                '',                                         // AA: Observação Interna
                '',                                         // AB: ID Pedido Vinculado
                'EM ANALISE',                               // AC: Retorno Item
                '',                                         // AD: Observação Sat-G
                safeString(formData.ondeEstaProblema),      // AE: Onde Está o Problema
                safeString(formData.tipoEquipamento)        // AF: Tipo Equipamento
            ];

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:AF`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [newRow]
                }
            });

            // Disparar sincronização para avisar a tela de Triagem
            if (req.notifySync) {
                await req.notifySync('garantiaUpdated', { tipo: 'novo_satg', codigo: novoCodigo });
            }

            res.json({ error: false, message: 'Solicitação de garantia enviada com sucesso!', codigo: novoCodigo });
        } catch (error) {
            console.error('[garantia] Erro ao enviar SatG público:', error);
            res.status(500).json({ error: true, message: 'Erro interno ao processar formulário.' });
        }
    });

    // POST /garantia/satg/update
    // Atualiza o Status e Observação de um pedido na SatG
    router.post('/satg/update', async (req, res, next) => {
        try {
            const { rowIndex, status, observacao, idPedido, retornoItem, observacaoSatg } = req.body;
            
            if (!rowIndex) {
                return res.status(400).json({ error: true, message: 'rowIndex é obrigatório.' });
            }

            const sheets = await getInitializedSheetsClient();
            const sheetName = 'SatG';
            
            // Status fica na Coluna Y (25), Observação na Coluna AA (27), ID Pedido na Coluna AB (28)
            // Retorno Item na AC (29), ObservaÇÃO SATG na AD (30)

            if (req.body.updates && Array.isArray(req.body.updates)) {
                for (let update of req.body.updates) {
                    if (update.column && update.value !== undefined) {
                        let safeValue = update.value;
                        if (typeof safeValue === 'string' && (safeValue.startsWith('+') || safeValue.startsWith('='))) {
                            safeValue = "'" + safeValue;
                        }

                        await sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `${sheetName}!${update.column}${rowIndex}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [[safeValue]]
                            }
                        });
                    }
                }
            }
            if (status) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!Y${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[status]] }
                });
            }

            if (observacao !== undefined) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!AA${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[observacao]] }
                });
            }
            
            if (idPedido !== undefined) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!AB${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[idPedido]] }
                });
            }

            if (retornoItem !== undefined) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!AC${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[retornoItem]] }
                });
            }

            if (observacaoSatg !== undefined) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!AD${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[observacaoSatg]] }
                });
            }

            // Notifica o frontend que a garantia foi atualizada para sincronizar em outros navegadores
            if (req.notifySync) {
                await req.notifySync('garantiaUpdated', { rowIndex, idPedido, tipo: 'satg' });
            }

            res.json({ error: false, message: 'Solicitação atualizada com sucesso.' });
        } catch (error) {
            console.error('[garantia] Erro ao atualizar SatG:', error);
            next(error);
        }
    });

    // GET /garantia/pedido/itens-detalhe
    // Retorna todos os itens detalhados customizados
    router.get('/pedido/itens-detalhe', async (req, res, next) => {
        try {
            const sheets = await getInitializedSheetsClient();
            const sheetName = 'ItensDetalhadoGarantia';
            
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A2:E`
            });
            
            const rows = response.data.values || [];
            const data = rows.map(r => ({
                idPedido: r[0] || '',
                idProduto: r[1] || '',
                descricao: r[2] || '',
                observacoes: r[3] || '',
                data: r[4] || ''
            }));
            
            res.json({ error: false, data });
        } catch (error) {
            console.error('[garantia] Erro ao buscar itens detalhados:', error);
            res.status(500).json({ error: true, message: 'Erro ao buscar itens detalhados.' });
        }
    });

    // POST /garantia/pedido/itens-detalhe
    // Adiciona ou atualiza itens detalhados customizados (Descrição/Observação)
    router.post('/pedido/itens-detalhe', async (req, res, next) => {
        console.log('[garantia] POST /pedido/itens-detalhe recebido:', JSON.stringify(req.body, null, 2));
        try {
            const { idPedido, itensDetalhado } = req.body;
            if (!idPedido || !itensDetalhado || !Array.isArray(itensDetalhado)) {
                return res.status(400).json({ error: true, message: 'idPedido e array itensDetalhado são obrigatórios.' });
            }
            
            const sheets = await getInitializedSheetsClient();
            const sheetName = 'ItensDetalhadoGarantia';
            
            // Buscar existentes para saber se fazemos update ou append
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:B`
            });
            const existingRows = response.data.values || [];
            
            const dataAtualStr = new Date().toISOString().split('T')[0];
            
            for (const item of itensDetalhado) {
                // Procurar linha correspondente
                let rowIndexToUpdate = -1;
                for (let i = 1; i < existingRows.length; i++) {
                    if (String(existingRows[i][0]).trim() === String(idPedido).trim() && 
                        String(existingRows[i][1]).trim() === String(item.idProduto).trim()) {
                        rowIndexToUpdate = i + 1; // +1 porque i=0 é a linha 1 do sheets, e a array começa do 0
                        break;
                    }
                }
                
                const rowData = [
                    String(idPedido),
                    String(item.idProduto),
                    item.descricao || '',
                    item.observacoes || '',
                    dataAtualStr
                ];
                
                const isEmpty = !(item.descricao || '').trim() && !(item.observacoes || '').trim();

                if (rowIndexToUpdate !== -1) {
                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `${sheetName}!A${rowIndexToUpdate}:E${rowIndexToUpdate}`,
                        valueInputOption: 'USER_ENTERED',
                        resource: { values: [rowData] }
                    });
                } else if (!isEmpty) {
                    await sheets.spreadsheets.values.append({
                        spreadsheetId,
                        range: `${sheetName}!A:E`,
                        valueInputOption: 'USER_ENTERED',
                        insertDataOption: 'INSERT_ROWS',
                        resource: { values: [rowData] }
                    });
                }
            }
            
            res.status(200).json({ error: false, message: 'Itens detalhados salvos com sucesso!' });
        } catch (error) {
            console.error('[garantia] Erro ao salvar itens detalhados:', error);
            res.status(500).json({ error: true, message: 'Erro ao salvar itens detalhados.' });
        }
    });

    return router;
}

module.exports = createGarantiaRouter;
