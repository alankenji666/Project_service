const express = require('express');

const createAuthRouter = (getSheetsClient, spreadsheetId, sheetNameEmpresa, sheetNameUsuario) => {
    const router = express.Router();

    /**
     * Rota para validar as credenciais do usuário.
     * Espera um corpo JSON com "email" e "senha".
     */
    router.post('/login', async (req, res) => {
        console.log('Recebida requisição de login para:', req.body.email);
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).send({ status: 'error', message: 'Email e senha são obrigatórios.' });
        }
        try {
            const sheets = await getSheetsClient();
            const rangeParaBuscar = `'${sheetNameUsuario}'!A:Z`;
            console.log(`[DEBUG] Tentando acessar o range: ${rangeParaBuscar}`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: rangeParaBuscar,
            });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                console.error('A planilha de usuários está vazia ou contém apenas o cabeçalho.');
                return res.status(500).send({ status: 'error', message: 'Nenhum usuário configurado no sistema.' });
            }
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const emailIndex = headers.indexOf('email');
            const senhaIndex = headers.indexOf('senha');
            if (emailIndex === -1 || senhaIndex === -1) {
                console.error('As colunas "email" e/ou "senha" não foram encontradas na planilha de usuários.');
                return res.status(500).send({ status: 'error', message: 'Erro de configuração do sistema de autenticação.' });
            }
            const userRow = rows.slice(1).find(row => row[emailIndex] && row[emailIndex].toLowerCase() === email.toLowerCase());
            if (!userRow) {
                console.warn(`Tentativa de login falhou: Email "${email}" não encontrado.`);
                return res.status(401).send({ status: 'error', message: 'Credenciais inválidas.' });
            }
            if (userRow[senhaIndex] !== senha) {
                console.warn(`Tentativa de login falhou: Senha incorreta para o email "${email}".`);
                return res.status(401).send({ status: 'error', message: 'Credenciais inválidas.' });
            }
            const userData = {};
            headers.forEach((header, index) => {
                if (header !== 'senha') {
                    userData[header] = userRow[index];
                }
            });
            console.log(`Login bem-sucedido para o usuário: ${email}`);
            res.status(200).send({ status: 'success', message: 'Login realizado com sucesso!', user: userData });
        } catch (error) {
            console.error('Erro crítico durante o processo de login:', error.message, error.stack);
            res.status(500).send({ status: 'error', message: `Ocorreu um erro interno no servidor: ${error.message}` });
        }
    });

    /**
     * Rota para obter informações da empresa.
     * Não requer autenticação.
     */
    router.get('/company-info', async (req, res) => {
        console.log('Recebida requisição para obter informações da empresa.');
        try {
            const sheets = await getSheetsClient();
            const rangeParaBuscar = `'${sheetNameEmpresa}'!A:C`;
            console.log(`[DEBUG] Tentando acessar o range: ${rangeParaBuscar}`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: rangeParaBuscar,
            });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                return res.status(404).send({ status: 'error', message: 'Nenhuma informação da empresa encontrada.' });
            }
            const headers = rows[0].map(h => h.toLowerCase().trim().replace('/', '_'));
            const companyData = {};
            const companyRow = rows[1];
            headers.forEach((header, index) => {
                companyData[header] = companyRow[index];
            });
            res.status(200).send({ status: 'success', data: companyData });
        } catch (error) {
            console.error('Erro ao buscar informações da empresa:', error.message, error.stack);
            res.status(500).send({ status: 'error', message: `Ocorreu um erro interno: ${error.message}` });
        }
    });

    /**
     * Rota para atualizar os dados de um usuário.
     * Requer as credenciais de quem está fazendo a alteração para segurança.
     */
    router.post('/update-user', async (req, res) => {
        console.log('Recebida requisição para /update-user');
        const { updater_codigo, updater_senha, target_codigo, updates } = req.body;
        if (!updater_codigo || !updater_senha || !target_codigo || !updates || Object.keys(updates).length === 0) {
            return res.status(400).send({ status: 'error', message: 'Dados insuficientes para a atualização.' });
        }
        if (updates.codigo) {
            return res.status(400).send({ status: 'error', message: 'O código do usuário não pode ser alterado.' });
        }
        try {
            const sheets = await getSheetsClient();
            const range = `'${sheetNameUsuario}'!A:Z`;
            const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                return res.status(500).send({ status: 'error', message: 'Nenhum usuário configurado no sistema.' });
            }
            const headers = rows[0].map(h => h ? String(h).toLowerCase().trim() : '');
            const codigoIndex = headers.indexOf('codigo');
            const senhaIndex = headers.indexOf('senha');
            if (codigoIndex === -1 || senhaIndex === -1) {
                return res.status(500).send({ status: 'error', message: 'Erro na configuração da planilha de usuários.' });
            }
            const updaterRowData = rows.find(row => row[codigoIndex] === String(updater_codigo));
            if (!updaterRowData || updaterRowData[senhaIndex] !== updater_senha) {
                return res.status(401).send({ status: 'error', message: 'Credenciais do solicitante inválidas.' });
            }
            const isAdmin = (userRow) => {
                const requiredPermissions = {
                    'acesso (pesquisar produto)': '1', 'acesso (gerenciar entrada)': '1',
                    'acesso (gerenciar saida)': '1', 'acesso (dashboards)': '1',
                    'acesso (whatsapp)': '1', 'configurações': '1', 'somente visualizar dados?': '0'
                };
                for (const perm in requiredPermissions) {
                    const permIndex = headers.indexOf(perm);
                    if (permIndex === -1 || userRow[permIndex] !== requiredPermissions[perm]) return false;
                }
                return true;
            };
            const isUpdaterAdmin = isAdmin(updaterRowData);
            const permissionKeys = ['acesso (', 'configurações', 'somente visualizar dados?'];
            const isUpdatingPermissions = Object.keys(updates).some(key => permissionKeys.some(pkey => key.includes(pkey)));
            if (isUpdatingPermissions && !isUpdaterAdmin) {
                return res.status(403).send({ status: 'error', message: 'Você não tem permissão para alterar acessos.' });
            }
            if (String(updater_codigo) !== String(target_codigo) && !isUpdaterAdmin) {
                return res.status(403).send({ status: 'error', message: 'Você só pode alterar seus próprios dados.' });
            }
            const targetRowIndex = rows.findIndex(row => row[codigoIndex] === String(target_codigo));
            if (targetRowIndex === -1) {
                return res.status(404).send({ status: 'error', message: `Usuário alvo com código "${target_codigo}" não encontrado.` });
            }
            const sheetRowNumber = targetRowIndex + 1;
            const updatePromises = [];
            for (const fieldToUpdate in updates) {
                const colIndex = headers.indexOf(fieldToUpdate.toLowerCase().trim());
                if (colIndex !== -1) {
                    const colLetter = String.fromCharCode(65 + colIndex);
                    const updateRange = `'${sheetNameUsuario}'!${colLetter}${sheetRowNumber}`;
                    const value = updates[fieldToUpdate];
                    console.log(`Atualizando range ${updateRange} com o valor "${value}"`);
                    updatePromises.push(
                        sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateRange, valueInputOption: 'RAW',
                            resource: { values: [[value]] },
                        })
                    );
                } else {
                    console.warn(`Campo "${fieldToUpdate}" ignorado pois não existe na planilha.`);
                }
            }
            await Promise.all(updatePromises);

            // --- ALTERAÇÃO AQUI ---
            // Constrói o objeto do usuário com os dados atualizados para retornar ao front-end
            const updatedUserData = {};
            const originalUserRow = rows[targetRowIndex]; // Dados antes da atualização

            // Começa com os dados originais
            headers.forEach((header, index) => {
                if (header !== 'senha') { // Nunca retorna a senha
                    updatedUserData[header] = originalUserRow[index];
                }
            });

            // Aplica as alterações que foram enviadas na requisição
            for (const key in updates) {
                const lowerKey = key.toLowerCase().trim();
                if (updatedUserData.hasOwnProperty(lowerKey)) {
                     updatedUserData[lowerKey] = updates[key];
                }
            }

            console.log(`Usuário com código "${target_codigo}" atualizado com sucesso pelo usuário "${updater_codigo}".`);
            // Retorna a mensagem de sucesso e os dados atualizados
            res.status(200).send({ 
                status: 'success', 
                message: 'Usuário atualizado com sucesso!',
                data: updatedUserData 
            });

        } catch (error) {
            console.error('Erro crítico durante a atualização do usuário:', error.message, error.stack);
            res.status(500).send({ status: 'error', message: `Ocorreu um erro interno: ${error.message}` });
        }
    });

    /**
     * Rota para obter a lista de todos os usuários.
     * REQUER CREDENCIAIS DE ADMINISTRADOR no corpo da requisição.
     */
    router.post('/get-all-users', async (req, res) => {
        console.log('Recebida requisição para /get-all-users');
        const { admin_codigo, admin_senha } = req.body;
        if (!admin_codigo || !admin_senha) {
            return res.status(400).send({ status: 'error', message: 'Credenciais de administrador são obrigatórias.' });
        }
        try {
            const sheets = await getSheetsClient();
            const range = `'${sheetNameUsuario}'!A:Z`;
            const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                return res.status(500).send({ status: 'error', message: 'Nenhum usuário configurado no sistema.' });
            }
            const headers = rows[0].map(h => h ? String(h).toLowerCase().trim() : '');
            const codigoIndex = headers.indexOf('codigo');
            const senhaIndex = headers.indexOf('senha');
            if (codigoIndex === -1 || senhaIndex === -1) {
                return res.status(500).send({ status: 'error', message: 'Erro na configuração da planilha de usuários.' });
            }
            const adminRowData = rows.find(row => row[codigoIndex] === String(admin_codigo));
            if (!adminRowData || adminRowData[senhaIndex] !== admin_senha) {
                return res.status(401).send({ status: 'error', message: 'Credenciais do solicitante inválidas.' });
            }
            const isAdmin = (userRow) => {
                const requiredPermissions = {
                    'acesso (pesquisar produto)': '1', 'acesso (gerenciar entrada)': '1',
                    'acesso (gerenciar saida)': '1', 'acesso (dashboards)': '1',
                    'acesso (whatsapp)': '1', 'configurações': '1', 'somente visualizar dados?': '0'
                };
                for (const perm in requiredPermissions) {
                    const permIndex = headers.indexOf(perm);
                    if (permIndex === -1 || userRow[permIndex] !== requiredPermissions[perm]) return false;
                }
                return true;
            };
            if (!isAdmin(adminRowData)) {
                return res.status(403).send({ status: 'error', message: 'Acesso negado. Apenas administradores podem visualizar a lista de usuários.' });
            }
            const allUsers = rows.slice(1).map(userRow => {
                const userObject = {};
                headers.forEach((header, index) => {
                    if (header !== 'senha') {
                        userObject[header] = userRow[index];
                    }
                });
                return userObject;
            });
            res.status(200).send({ status: 'success', data: allUsers });
        } catch (error) {
            console.error('Erro crítico ao buscar todos os usuários:', error.message, error.stack);
            res.status(500).send({ status: 'error', message: `Ocorreu um erro interno: ${error.message}` });
        }
    });

    return router;
};

module.exports = createAuthRouter;

