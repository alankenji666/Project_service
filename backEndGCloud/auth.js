const express = require('express');

const createAuthRouter = (getSheetsClient, spreadsheetId, sheetNameEmpresa, sheetNameUsuario) => {
    const router = express.Router();

    /**
     * Rota para validar as credenciais do usuário.
     * Espera um corpo JSON com "email" e "senha".
     */
    router.post('/login', async (req, res, next) => {
        console.log('Recebida requisição de login para:', req.body.email);
        const { email, senha } = req.body;
        
        try {
            if (!email || !senha) {
                const error = new Error('Email e senha são obrigatórios.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const rangeParaBuscar = `'${sheetNameUsuario}'!A:Z`;
            console.log(`[DEBUG] Tentando acessar o range: ${rangeParaBuscar}`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: rangeParaBuscar,
            });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                const error = new Error('Nenhum usuário configurado no sistema.');
                error.statusCode = 500;
                throw error;
            }
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const emailIndex = headers.indexOf('email');
            const senhaIndex = headers.indexOf('senha');
            if (emailIndex === -1 || senhaIndex === -1) {
                throw new Error('Erro de configuração do sistema de autenticação.');
            }
            const userRow = rows.slice(1).find(row => row[emailIndex] && row[emailIndex].toLowerCase() === email.toLowerCase());
            if (!userRow) {
                console.warn(`Tentativa de login falhou: Email "${email}" não encontrado.`);
                const error = new Error('Credenciais inválidas.');
                error.statusCode = 401;
                throw error;
            }
            if (userRow[senhaIndex] !== senha) {
                console.warn(`Tentativa de login falhou: Senha incorreta para o email "${email}".`);
                const error = new Error('Credenciais inválidas.');
                error.statusCode = 401;
                throw error;
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
            next(error);
        }
    });

    /**
     * Rota para obter informações da empresa.
     * Não requer autenticação.
     */
    router.get('/company-info', async (req, res, next) => {
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
                const error = new Error('Nenhuma informação da empresa encontrada.');
                error.statusCode = 404;
                throw error;
            }
            const headers = rows[0].map(h => h.toLowerCase().trim().replace('/', '_'));
            const companyData = {};
            const companyRow = rows[1];
            headers.forEach((header, index) => {
                companyData[header] = companyRow[index];
            });
            res.status(200).send({ status: 'success', data: companyData });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Rota para atualizar os dados de um usuário.
     * Requer as credenciais de quem está fazendo a alteração para segurança.
     */
    router.post('/update-user', async (req, res, next) => {
        console.log('Recebida requisição para /update-user');
        const { updater_codigo, updater_senha, target_codigo, updates } = req.body;
        
        try {
            if (!updater_codigo || !updater_senha || !target_codigo || !updates || Object.keys(updates).length === 0) {
                const error = new Error('Dados insuficientes para a atualização.');
                error.statusCode = 400;
                throw error;
            }
            if (updates.codigo) {
                const error = new Error('O código do usuário não pode ser alterado.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const range = `'${sheetNameUsuario}'!A:Z`;
            const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                const error = new Error('Nenhum usuário configurado no sistema.');
                error.statusCode = 500;
                throw error;
            }
            const headers = rows[0].map(h => h ? String(h).toLowerCase().trim() : '');
            const codigoIndex = headers.indexOf('codigo');
            const senhaIndex = headers.indexOf('senha');
            if (codigoIndex === -1 || senhaIndex === -1) {
                throw new Error('Erro na configuração da planilha de usuários.');
            }
            const updaterRowData = rows.find(row => row[codigoIndex] === String(updater_codigo));
            if (!updaterRowData || updaterRowData[senhaIndex] !== updater_senha) {
                const error = new Error('Credenciais do solicitante inválidas.');
                error.statusCode = 401;
                throw error;
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
                const error = new Error('Você não tem permissão para alterar acessos.');
                error.statusCode = 403;
                throw error;
            }
            if (String(updater_codigo) !== String(target_codigo) && !isUpdaterAdmin) {
                const error = new Error('Você só pode alterar seus próprios dados.');
                error.statusCode = 403;
                throw error;
            }
            const targetRowIndex = rows.findIndex(row => row[codigoIndex] === String(target_codigo));
            if (targetRowIndex === -1) {
                const error = new Error(`Usuário alvo com código "${target_codigo}" não encontrado.`);
                error.statusCode = 404;
                throw error;
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

            const updatedUserData = {};
            const originalUserRow = rows[targetRowIndex];

            headers.forEach((header, index) => {
                if (header !== 'senha') {
                    updatedUserData[header] = originalUserRow[index];
                }
            });

            for (const key in updates) {
                const lowerKey = key.toLowerCase().trim();
                if (updatedUserData.hasOwnProperty(lowerKey)) {
                     updatedUserData[lowerKey] = updates[key];
                }
            }

            console.log(`Usuário com código "${target_codigo}" atualizado com sucesso pelo usuário "${updater_codigo}".`);
            res.status(200).send({ 
                status: 'success', 
                message: 'Usuário atualizado com sucesso!',
                data: updatedUserData 
            });

        } catch (error) {
            next(error);
        }
    });

    /**
     * Rota para obter a lista de todos os usuários.
     * REQUER CREDENCIAIS DE ADMINISTRADOR no corpo da requisição.
     */
    router.post('/get-all-users', async (req, res, next) => {
        console.log('Recebida requisição para /get-all-users');
        const { admin_codigo, admin_senha } = req.body;
        
        try {
            if (!admin_codigo || !admin_senha) {
                const error = new Error('Credenciais de administrador são obrigatórias.');
                error.statusCode = 400;
                throw error;
            }

            const sheets = await getSheetsClient();
            const range = `'${sheetNameUsuario}'!A:Z`;
            const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                const error = new Error('Nenhum usuário configurado no sistema.');
                error.statusCode = 500;
                throw error;
            }
            const headers = rows[0].map(h => h ? String(h).toLowerCase().trim() : '');
            const codigoIndex = headers.indexOf('codigo');
            const senhaIndex = headers.indexOf('senha');
            if (codigoIndex === -1 || senhaIndex === -1) {
                throw new Error('Erro na configuração da planilha de usuários.');
            }
            const adminRowData = rows.find(row => row[codigoIndex] === String(admin_codigo));
            if (!adminRowData || adminRowData[senhaIndex] !== admin_senha) {
                const error = new Error('Credenciais do solicitante inválidas.');
                error.statusCode = 401;
                throw error;
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
                const error = new Error('Acesso negado. Apenas administradores podem visualizar a lista de usuários.');
                error.statusCode = 403;
                throw error;
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
            next(error);
        }
    });

    return router;
};

module.exports = createAuthRouter;

