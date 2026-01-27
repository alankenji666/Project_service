import { API_URLS } from './apiConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- URLs da API ---
    const UPDATE_USER_API_URL = API_URLS.UPDATE_USER;

    window.isReadOnlyMode = () => localStorage.getItem('isReadOnly') === 'true';


    const settingsMenuContainer = document.getElementById('settings-menu-container');
    const settingsButton = document.getElementById('settings-button');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const userNameDisplay = document.getElementById('user-name-display');
    const userDataLink = document.getElementById('user-data-link');

    // NOVO: Elementos do modal de dados do usuário
    const userDataModal = document.getElementById('user-data-modal');
    const userDataModalContent = document.getElementById('user-data-modal-content');
    const closeUserDataModalBtn = document.getElementById('close-user-data-modal-btn');
    const myDataTab = document.getElementById('tab-my-data');
    const manageUsersTab = document.getElementById('tab-manage-users');
    const myDataContent = document.getElementById('tab-content-my-data');
    const manageUsersContent = document.getElementById('tab-content-manage-users');
    const saveMyDataBtn = document.getElementById('save-my-data-btn');
    const manageUsersSelect = document.getElementById('manage-users-select');
    const adminEditFormContainer = document.getElementById('admin-edit-form-container');

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const errorMessage = document.getElementById('login-error-message');
    const loginButton = document.getElementById('login-button');
    const loginButtonText = document.getElementById('login-button-text');
    const loginSpinner = document.getElementById('login-spinner');

    // Armazena o timer do alerta do modal para poder limpá-lo
    let _modalAlertTimeout = null;

    /**
     * NOVO: Controla a visibilidade dos elementos do menu com base nas permissões do usuário.
     * @param {object} permissions - O objeto de usuário com as chaves de permissão.
     */
    function _applyAccessControl(permissions) {
        if (!permissions) return;

        // Mapeamento entre a chave de permissão do backend e o ID do elemento no HTML
        const permissionMap = {
            'acesso (pesquisar produto)': 'nav-pesquisar',
            'acesso (gerenciar entrada)': 'nav-estoque',
            'acesso (gerenciar saida)': 'nav-gerenciar-saida',
            'acesso (dashboards)': 'nav-dashboards',
            'configurações': 'settings-menu-container'
        };

        for (const [permissionKey, elementId] of Object.entries(permissionMap)) {
            const element = document.getElementById(elementId);
            if (element) {
                // A permissão é "1" (string) para acesso permitido.
                const hasAccess = permissions[permissionKey] === '1';
                element.classList.toggle('hidden', !hasAccess);
            }
        }
    }

    function checkAuth() {
        // A verificação de redirecionamento agora está no <head> do indexold.html.
        // Este script só será executado se o token existir.
        const token = localStorage.getItem('authToken');
        if (token) {
            // O botão de logout agora está dentro do dropdown, que é controlado por JS.
            // Apenas o container do menu precisa ser gerenciado aqui.
            if (settingsMenuContainer) settingsMenuContainer.classList.remove('hidden');


            // NOVO: Exibe o nome do usuário
            const userInfoString = localStorage.getItem('userInfo');
            if (userInfoString && userNameDisplay) {
                try {
                    const userInfo = JSON.parse(userInfoString);
                    const firstName = userInfo.nome.split(' ')[0]; // Pega o primeiro nome
                    userNameDisplay.textContent = `Olá, ${firstName}`;

                    // NOVO: Verifica e aplica o modo "Somente Leitura"
                    const isReadOnly = userInfo['somente visualizar dados?'] === '1';
                    localStorage.setItem('isReadOnly', isReadOnly);
                    if (isReadOnly) {
                        document.body.classList.add('read-only');
                        console.log("Modo 'Somente Leitura' ativado.");
                    }

                    // NOVO: Aplica as regras de controle de acesso
                    _applyAccessControl(userInfo);

                    userNameDisplay.classList.remove('hidden');
                } catch (e) {
                    console.error('Erro ao processar informações do usuário:', e);
                }
            }

            // NOVO: Inicia a aplicação principal APÓS a autenticação ser verificada
            // e a UI de usuário ser configurada.
            if (window.startApp && typeof window.startApp === 'function') {
                console.log('[Auth] Autenticação OK. Iniciando a aplicação principal...');
                window.startApp();
            }
        }
        // Se não houver token, o script no <head> já terá redirecionado o usuário.
        else {
            // Apenas por segurança, caso o script do head falhe.
            if (!window.location.pathname.endsWith('login.html')) {
                window.location.replace('login.html');
            }
        }
    }

    function handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo'); // Limpa também os dados do usuário
        localStorage.removeItem('allUsersList'); // Limpa a lista de usuários
        localStorage.removeItem('isReadOnly'); // Limpa o status de somente leitura
        window.location.reload();
    }

    function toggleSettingsDropdown(event) {
        event.stopPropagation();
        if (settingsDropdown) {
            settingsDropdown.classList.toggle('hidden');
        }
    }

    function _showTab(tabId) {
        // Esconde todos os conteúdos
        document.querySelectorAll('.user-modal-tab-content').forEach(content => content.classList.add('hidden'));
        // Desativa todas as abas
        document.querySelectorAll('.user-modal-tab').forEach(tab => {
            tab.classList.remove('border-blue-500', 'text-blue-600');
            tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });

        // Mostra o conteúdo e ativa a aba selecionada
        const activeContent = document.getElementById(`tab-content-${tabId}`);
        const activeTab = document.getElementById(`tab-${tabId}`);
        if (activeContent) activeContent.classList.remove('hidden');
        if (activeTab) {
            activeTab.classList.add('border-blue-500', 'text-blue-600');
            activeTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        }
    }

    /** NOVO: Mostra um alerta dentro do modal de usuário. */
    function _showModalAlert(message, type = 'info', duration = 5000) {
        const alertContainer = document.getElementById('user-modal-alert-container');
        if (!alertContainer) return;

        // Limpa qualquer alerta anterior
        clearTimeout(_modalAlertTimeout);

        const typeClasses = {
            success: 'bg-green-100 border-green-400 text-green-700',
            error: 'bg-red-100 border-red-400 text-red-700',
            info: 'bg-blue-100 border-blue-400 text-blue-700'
        };

        const alertDiv = document.createElement('div');
        alertDiv.className = `border px-4 py-3 rounded-lg relative ${typeClasses[type] || typeClasses.info}`;
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `<span class="block sm:inline">${message}</span>`;

        alertContainer.innerHTML = ''; // Limpa o container
        alertContainer.appendChild(alertDiv);

        // O alerta desaparece após 'duration' ms (a menos que a duração seja 0)
        if (duration > 0) {
            _modalAlertTimeout = setTimeout(() => alertContainer.innerHTML = '', duration);
        }
    }

    /**
     * Verifica se o usuário tem todas as permissões de administrador.
     * @param {object} user - O objeto de usuário.
     * @returns {boolean} - True se o usuário for administrador.
     */
    function isUserAdmin(user) {
        if (!user) return false;
        return (
            user['acesso (pesquisar produto)'] === '1' &&
            user['acesso (gerenciar entrada)'] === '1' &&
            user['acesso (gerenciar saida)'] === '1' &&
            user['acesso (dashboards)'] === '1' &&
            user['acesso (whatsapp)'] === '1' &&
            user['configurações'] === '1' &&
            user['somente visualizar dados?'] === '0'
        );
    }

    function openUserDataModal(event) {
        event.preventDefault();
        const userInfoString = localStorage.getItem('userInfo');
        if (!userInfoString || !userDataModal) return;

        try {
            const userInfo = JSON.parse(userInfoString);
            document.getElementById('user-modal-alert-container').innerHTML = ''; // Limpa alertas antigos
            const myDataDisplay = document.getElementById('my-data-display');

            // Preenche a aba "Meus Dados"
            const createDataRow = (label, value) => `
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt class="text-sm font-medium text-gray-500">${label}</dt>
                    <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">${value || 'N/A'}</dd>
                </div>
            `;
            myDataDisplay.innerHTML = `
                <dl>
                    ${createDataRow('Nome Completo', userInfo.nome)}
                    ${createDataRow('Email', userInfo.email)}
                    ${createDataRow('Telefone', userInfo.telefone)}
                    ${createDataRow('CPF', userInfo.cpf)}
                    ${createDataRow('Código', userInfo.codigo)}
                </dl>
            `;
            // Limpa campos de edição
            document.getElementById('update-user-telefone').value = userInfo.telefone || '';
            document.getElementById('update-user-senha').value = '';
            document.getElementById('update-user-current-password').value = '';
            saveMyDataBtn.disabled = true; // Desabilita o botão inicialmente

            // Adiciona listener para habilitar/desabilitar o botão de salvar
            const myDataFormElements = [
                document.getElementById('update-user-telefone'),
                document.getElementById('update-user-senha')
            ];
            myDataFormElements.forEach(el => {
                el.addEventListener('input', () => {
                    const telefoneChanged = document.getElementById('update-user-telefone').value !== (userInfo.telefone || '');
                    const senhaChanged = document.getElementById('update-user-senha').value !== '';
                    saveMyDataBtn.disabled = !(telefoneChanged || senhaChanged);
                });
            });


            // Lógica para a aba de Admin
            const isAdmin = isUserAdmin(userInfo);
            if (isAdmin) {
                manageUsersTab.classList.remove('hidden');
                _loadAdminUserList();
            } else {
                manageUsersTab.classList.add('hidden');
            }

            _showTab('my-data'); // Mostra a primeira aba por padrão

            userDataModal.classList.remove('hidden');
            settingsDropdown.classList.add('hidden'); // Fecha o dropdown ao abrir o modal

        } catch (e) {
            console.error('Erro ao exibir dados do usuário:', e);
        }
    }

    async function _saveMyData() {
        const userInfoString = localStorage.getItem('userInfo');
        if (!userInfoString) return;
        const userInfo = JSON.parse(userInfoString);

        const newTelefone = document.getElementById('update-user-telefone').value;
        const newSenha = document.getElementById('update-user-senha').value;
        const currentPassword = document.getElementById('update-user-current-password').value;

        if (!currentPassword) {
            _showModalAlert('Por favor, insira sua senha atual para confirmar as alterações.', 'error');
            return;
        }

        const updates = {};
        if (newTelefone !== userInfo.telefone) { // Permite salvar telefone em branco
            updates.telefone = newTelefone;
        }
        if (newSenha) {
            updates.senha = newSenha;
        }

        if (Object.keys(updates).length === 0) {
            _showModalAlert('Nenhuma alteração foi feita.', 'info');
            return;
        }

        const payload = {
            updater_codigo: userInfo.codigo,
            updater_senha: currentPassword,
            target_codigo: userInfo.codigo,
            updates: updates
        };

        await _executeUserUpdate(payload);
    }

    function _loadAdminUserList() {
        try {
            const usersString = localStorage.getItem('allUsersList');
            if (!usersString) {
                throw new Error("A lista de usuários não foi carregada. Faça login novamente como administrador.");
            }

            const users = JSON.parse(usersString);

            if (!Array.isArray(users)) {
                throw new Error("Os dados da lista de usuários estão em um formato inválido.");
            }

            manageUsersSelect.innerHTML = '<option value="">Selecione um usuário</option>';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.codigo;
                option.textContent = `${user.nome} (${user.codigo})`;
                option.dataset.userData = JSON.stringify(user);
                manageUsersSelect.appendChild(option);
            });

        } catch (error) {
            manageUsersSelect.innerHTML = `<option>Erro ao carregar</option>`;
            adminEditFormContainer.innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
            console.error("Erro ao carregar lista de usuários:", error);
        }
    }

    function _renderAdminEditForm(event) {
        const selectedOption = event.target.selectedOptions[0];
        const userDataString = selectedOption.dataset.userData;

        if (!userDataString) {
            adminEditFormContainer.classList.add('hidden');
            return;
        }

        const user = JSON.parse(userDataString);
        const permissionKeys = [
            'acesso (pesquisar produto)', 'acesso (gerenciar entrada)', 
            'acesso (gerenciar saida)', 'acesso (dashboards)', 'acesso (whatsapp)', 
            'configurações', 'somente visualizar dados?'
        ];

        let formHtml = `
            <h3 class="text-lg font-semibold text-gray-700">Editando: ${user.nome}</h3>
            <div>
                <label for="admin-update-nome" class="block text-sm font-medium text-gray-700">Nome</label>
                <input type="text" id="admin-update-nome" value="${user.nome || ''}" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
            </div>
            <h4 class="text-md font-semibold text-gray-600 pt-2">Permissões</h4>
            <div class="grid grid-cols-2 gap-4">
        `;

        permissionKeys.forEach(key => {
            const hasAccess = user[key] === '1';
            formHtml += `
                <label class="flex items-center">
                    <input type="checkbox" class="admin-permission-checkbox h-4 w-4 rounded border-gray-300 text-blue-600" data-permission-key="${key}" ${hasAccess ? 'checked' : ''}>
                    <span class="ml-2 text-sm text-gray-700">${key.replace('acesso ', '').replace('()', '')}</span>
                </label>
            `;
        });

        formHtml += `
            </div>
            <hr>
            <div>
                <label for="admin-confirm-password" class="block text-sm font-medium text-gray-700">Sua Senha de Admin (para confirmar)</label>
                <input type="password" id="admin-confirm-password" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="Senha de administrador">
            </div>
            <div class="text-right">
                <button id="save-admin-changes-btn" data-target-codigo="${user.codigo}" class="read-only-disable inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                    Salvar Alterações do Usuário
                </button>
            </div>
        `;

        adminEditFormContainer.innerHTML = formHtml;
        adminEditFormContainer.classList.remove('hidden');

        const saveAdminBtn = document.getElementById('save-admin-changes-btn');
        saveAdminBtn.disabled = true; // Desabilita o botão inicialmente
        saveAdminBtn.addEventListener('click', _saveAdminChanges);

        // Adiciona listeners para habilitar/desabilitar o botão
        const adminFormElements = adminEditFormContainer.querySelectorAll('input');
        adminFormElements.forEach(el => {
            el.addEventListener('input', () => {
                let hasChanged = false;
                if (document.getElementById('admin-update-nome').value !== user.nome) hasChanged = true;
                document.querySelectorAll('.admin-permission-checkbox').forEach(cb => {
                    const key = cb.dataset.permissionKey;
                    if (cb.checked !== (user[key] === '1')) hasChanged = true;
                });
                saveAdminBtn.disabled = !hasChanged;
            });
        });
    }

    async function _saveAdminChanges(event) {
        event.target.disabled = true; // Desabilita para evitar cliques duplos
        const targetCodigo = event.target.dataset.targetCodigo;
        const adminPassword = document.getElementById('admin-confirm-password').value;
        const adminInfo = JSON.parse(localStorage.getItem('userInfo'));

        if (!adminPassword) {
            _showModalAlert('A senha de administrador é obrigatória para salvar as alterações.', 'error');
            event.target.disabled = false;
            return;
        }

        const updates = {};
        // Nome
        updates.nome = document.getElementById('admin-update-nome').value;
        // Permissões
        document.querySelectorAll('.admin-permission-checkbox').forEach(checkbox => {
            updates[checkbox.dataset.permissionKey] = checkbox.checked ? '1' : '0';
        });

        const payload = {
            updater_codigo: adminInfo.codigo,
            updater_senha: adminPassword,
            target_codigo: targetCodigo,
            updates: updates
        };

        await _executeUserUpdate(payload);
    }

    async function _executeUserUpdate(payload) {
        console.log("Enviando payload de atualização:", payload);
        try {
            const response = await fetch(UPDATE_USER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Erro desconhecido na API.');
            }

            // NOVO: Lógica para atualizar a UI sem recarregar a página.
            const updatedUser = result.data;
            const currentUserInfo = JSON.parse(localStorage.getItem('userInfo'));

            // Atualiza a lista de todos os usuários no localStorage
            const allUsersListString = localStorage.getItem('allUsersList');
            if (allUsersListString) {
                let allUsersList = JSON.parse(allUsersListString);
                const userIndex = allUsersList.findIndex(u => u.codigo === updatedUser.codigo);
                if (userIndex !== -1) {
                    allUsersList[userIndex] = updatedUser;
                    localStorage.setItem('allUsersList', JSON.stringify(allUsersList));
                }
            }

            // Se o usuário atualizado for o usuário logado, atualiza seus dados e a UI.
            if (currentUserInfo.codigo === updatedUser.codigo) {
                localStorage.setItem('userInfo', JSON.stringify(updatedUser));
                _refreshUIWithNewUserData(updatedUser);
            }

            // Fecha o modal e mostra a mensagem de sucesso.
            _showModalAlert(result.message || 'Usuário atualizado com sucesso!', 'success');
            setTimeout(() => { if (userDataModal) userDataModal.classList.add('hidden'); }, 2000);

        } catch (error) {
            _showModalAlert(`Erro ao atualizar: ${error.message}`, 'error');
        }
    }

    /** NOVO: Atualiza a UI com os novos dados do usuário sem recarregar a página. */
    function _refreshUIWithNewUserData(updatedUser) {
        if (userNameDisplay) {
            const firstName = updatedUser.nome.split(' ')[0];
            userNameDisplay.textContent = `Olá, ${firstName}`;
        }
        const isReadOnly = updatedUser['somente visualizar dados?'] === '1';
        localStorage.setItem('isReadOnly', isReadOnly);
        document.body.classList.toggle('read-only', isReadOnly);
        _applyAccessControl(updatedUser);
    }

    // Adiciona os listeners
    const logoutButton = document.getElementById('logout-button'); // Precisa ser pego aqui
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (settingsButton) settingsButton.addEventListener('click', toggleSettingsDropdown);
    if (userDataLink) userDataLink.addEventListener('click', openUserDataModal);
    if (closeUserDataModalBtn) closeUserDataModalBtn.addEventListener('click', () => userDataModal.classList.add('hidden'));
    if (myDataTab) myDataTab.addEventListener('click', () => _showTab('my-data'));
    if (manageUsersTab) manageUsersTab.addEventListener('click', () => _showTab('manage-users'));
    if (saveMyDataBtn) saveMyDataBtn.addEventListener('click', _saveMyData);
    if (manageUsersSelect) manageUsersSelect.addEventListener('change', _renderAdminEditForm);

    // Fecha o dropdown se clicar fora dele
    window.addEventListener('click', (event) => {
        if (settingsDropdown && !settingsDropdown.classList.contains('hidden') && !settingsMenuContainer.contains(event.target)) {
            settingsDropdown.classList.add('hidden');
        }
    });

    // Verifica a autenticação assim que a página carrega
    checkAuth();
});