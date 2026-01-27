import { API_URLS } from './apiConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');
    const loginButtonText = document.getElementById('login-button-text');
    const loginSpinner = document.getElementById('login-spinner');
    const rememberMeCheckbox = document.getElementById('remember-me');
    // NOVO: Elementos para visibilidade da senha
    const togglePasswordBtn = document.getElementById('toggle-password-visibility');
    const eyeIcon = document.getElementById('eye-icon');
    const eyeSlashedIcon = document.getElementById('eye-slashed-icon');


    // URL do seu endpoint de login no backend
    const LOGIN_API_URL = API_URLS.LOGIN;
    const GET_ALL_USERS_API_URL = API_URLS.GET_ALL_USERS;

    // Ao carregar a página, verifica se há credenciais salvas
    function loadSavedCredentials() {
        const savedCredentials = localStorage.getItem('savedCredentials');
        if (savedCredentials) {
            try {
                const { email, password } = JSON.parse(savedCredentials);
                emailInput.value = email;
                passwordInput.value = password;
                rememberMeCheckbox.checked = true;
            } catch (e) { console.error("Erro ao carregar credenciais salvas:", e); }
        }
    }

    /**
     * Verifica se o usuário tem todas as permissões de administrador.
     * @param {object} user - O objeto de usuário retornado pela API de login.
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


    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.classList.add('hidden');

        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            errorMessage.textContent = 'Por favor, preencha todos os campos.';
            errorMessage.classList.remove('hidden');
            return;
        }

        // Desabilita o botão e mostra o spinner
        loginButton.disabled = true;
        loginButtonText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');

        try {
            const response = await fetch(LOGIN_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    senha: password // O backend espera "senha", não "password"
                })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                console.log('Login bem-sucedido!', result.message);

                // Lógica para salvar ou remover as credenciais
                if (rememberMeCheckbox.checked) {
                    const credentialsToSave = JSON.stringify({ email: email, password: password });
                    localStorage.setItem('savedCredentials', credentialsToSave);
                } else {
                    localStorage.removeItem('savedCredentials');
                }

                // Salva um token genérico para indicar que o usuário está logado
                localStorage.setItem('authToken', 'true'); 
                // Salva as informações do usuário para uso futuro (ex: exibir nome)
                localStorage.setItem('userInfo', JSON.stringify(result.user));

                // NOVO: Se o usuário for admin, busca e armazena a lista de todos os usuários.
                if (isUserAdmin(result.user)) {
                    console.log('Usuário administrador detectado. Buscando lista de todos os usuários...');
                    try {
                        const allUsersResponse = await fetch(GET_ALL_USERS_API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                admin_codigo: result.user.codigo,
                                admin_senha: password
                            })
                        });
                        if (allUsersResponse.ok) {
                            const allUsersResult = await allUsersResponse.json();
                            if (allUsersResult.status === 'success' && allUsersResult.data) {
                                localStorage.setItem('allUsersList', JSON.stringify(allUsersResult.data));
                                console.log('Lista de usuários armazenada com sucesso.');
                            }
                        }
                    } catch (adminError) { console.error('Falha ao buscar a lista de usuários para o admin:', adminError); }
                }
                
                window.location.href = 'index.html'; // Redireciona para a página principal
            } else {
                // Lança um erro com a mensagem do backend (ex: "Credenciais inválidas.")
                throw new Error(result.message || 'Ocorreu um erro desconhecido.');
            }

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        } finally {
            // Habilita o botão e esconde o spinner
            loginButton.disabled = false;
            loginButtonText.classList.remove('hidden');
            loginSpinner.classList.add('hidden');
        }
    });

    // Executa a função para carregar as credenciais quando a página é carregada
    loadSavedCredentials();

    // NOVO: Adiciona o listener para o botão de mostrar/ocultar senha
    if (togglePasswordBtn && passwordInput && eyeIcon && eyeSlashedIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            eyeIcon.classList.toggle('hidden', isPassword);
            eyeSlashedIcon.classList.toggle('hidden', !isPassword);
        });
    }
});