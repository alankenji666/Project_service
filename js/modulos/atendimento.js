
// js/modulos/atendimento.js
export const Atendimento = (function() {
    // --- Private Variables ---
    let _allAtendimentos = [];
    let _dom = {};
    let _config = {}; // To receive configs from App.js (like API URLs and helper functions)
    let _updateTimer = null;

    // --- Private Functions ---

    /** Fetches the latest atendimento data from the API. */
    async function _fetchAtendimentos() {
        if (!_config.apiUrls.ATENDIMENTOS_GET) return false;
        try {
            const response = await fetch(`${_config.apiUrls.ATENDIMENTOS_GET}?t=${new Date().getTime()}`, { mode: 'cors' });
            if (!response.ok) {
                console.error(`Atendimento API Error: ${response.statusText}`);
                return false;
            }
            const data = await response.json();
            if (data.status !== 'success' || !data.atendimentos) {
                console.error(`Atendimento Data Error: ${data.message || 'Invalid format'}`);
                return false;
            }

            const newAtendimentosString = JSON.stringify(data.atendimentos);
            const oldAtendimentosString = JSON.stringify(_allAtendimentos);

            if (newAtendimentosString !== oldAtendimentosString) {
                _allAtendimentos = data.atendimentos;
                _renderKanban(); // Re-render only if data has changed
            }
            return true; // Success
        } catch (error) {
            console.error("Failed to fetch atendimentos:", error);
            return false; // Failure
        }
    }

    /** Starts the countdown timer for auto-refresh. */
    function startTimer() {
        stopTimer(); // Ensure no multiple timers are running
        let countdown = 6;
        const indicator = _dom.updateIndicator;
        const countdownSpan = _dom.countdownTimer;
        if (!indicator || !countdownSpan) return;

        indicator.classList.remove('hidden');
        // Ensure the initial text is correct
        indicator.querySelector('span').innerHTML = `Próxima atualização em <span id="atendimento-countdown-timer" class="font-mono">00:05</span>`;


        _updateTimer = setInterval(async () => {
            countdown--;
            if (document.getElementById('atendimento-countdown-timer')) {
                 document.getElementById('atendimento-countdown-timer').textContent = `00:0${countdown}`;
            }

            if (countdown <= 0) {
                if(indicator.querySelector('span')) indicator.querySelector('span').innerHTML = 'Atualizando...';
                await _fetchAtendimentos();
                countdown = 6; // Reset
                 if(indicator.querySelector('span')) indicator.querySelector('span').innerHTML = `Próxima atualização em <span id="atendimento-countdown-timer" class="font-mono">00:05</span>`;
            }
        }, 1000);
    }

    /** Stops the auto-refresh timer. */
    function stopTimer() {
        if (_updateTimer) {
            clearInterval(_updateTimer);
            _updateTimer = null;
        }
        if (_dom.updateIndicator) {
            _dom.updateIndicator.classList.add('hidden');
        }
    }

    /** Creates an atendimento card HTML string. */
    function _createAtendimentoCard(atendimento) {
        const nomeCliente = atendimento.nomeCliente || 'Cliente Desconhecido';
        const numeroCliente = atendimento.numeroCliente;
        let nomeVendedor = 'Não atribuído';

        if (atendimento.vendedorAtribuido) {
            try {
                const allUsers = JSON.parse(localStorage.getItem('allUsersList') || '[]');
                const vendedor = allUsers.find(u => u.codigo === atendimento.vendedorAtribuido);
                if (vendedor) nomeVendedor = vendedor.nome;
            } catch (e) { console.error("Error reading user list for atendimento card:", e); }
        }

        return `
            <div class="kanban-card bg-white p-4 rounded-lg shadow-sm mb-4 relative open-chat-action" data-atendimento-id="${atendimento.codigoAtendimento}">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-gray-800">${nomeCliente}</p>
                        <p class="text-sm text-gray-500">${numeroCliente}</p>
                    </div>
                    <span class="text-xs text-gray-400">${atendimento.status}</span>
                </div>
                <div class="mt-2">
                    <p class="text-xs text-gray-600">Vendedor: <span class="font-medium">${nomeVendedor}</span></p>
                </div>
                <div class="absolute bottom-2 right-2">
                    <button class="atendimento-card-menu-btn p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600" data-atendimento-id="${atendimento.codigoAtendimento}">
                         <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                </div>
            </div>`;
    }

    /** Renders the Kanban board. */
    function _renderKanban() {
        if (!_dom.kanbanContainer) return;

        const atendimentosPorStatus = {
            NOVO: _allAtendimentos.filter(a => a.status === 'NOVO'),
            EM_ATENDIMENTO: _allAtendimentos.filter(a => a.status === 'EM_ATENDIMENTO'),
            FINALIZADO: _allAtendimentos.filter(a => a.status === 'FINALIZADO')
        };
        const statusConfig = {
            NOVO: { title: 'Novos Atendimentos', color: 'bg-blue-500' },
            EM_ATENDIMENTO: { title: 'Em Atendimento', color: 'bg-yellow-500' },
            FINALIZADO: { title: 'Finalizados', color: 'bg-green-500' }
        };

        const createColumn = (statusKey) => {
            const config = statusConfig[statusKey];
            const atendimentos = atendimentosPorStatus[statusKey];
            return `
                <div class="kanban-column flex-shrink-0">
                    <div class="p-4 rounded-t-lg ${config.color} text-white flex justify-between items-center">
                        <h2 class="font-bold text-lg">${config.title}</h2>
                        <span class="font-mono bg-white/20 text-sm rounded-full px-2 py-0.5">${atendimentos.length}</span>
                    </div>
                    <div class="bg-gray-200 p-4 rounded-b-lg h-full overflow-y-auto">
                        ${atendimentos.length > 0 ? atendimentos.map(_createAtendimentoCard).join('') : '<p class="text-center text-gray-500 text-sm pt-4">Nenhum atendimento.</p>'}
                    </div>
                </div>`;
        };

        _dom.kanbanContainer.innerHTML = Object.keys(statusConfig).map(createColumn).join('');
    }
    
    function _closeChatModal() {
        if (_dom.chatModal) _dom.chatModal.classList.add('hidden');
    }
    
    function _openChatModal(atendimentoId) {
        const atendimento = _allAtendimentos.find(a => a.codigoAtendimento === atendimentoId);
        if (!atendimento || !_dom.chatModal) return;

        _dom.chatModalTitle.textContent = `Conversa com ${atendimento.nomeCliente || 'Cliente'}`;
        _dom.chatModalInfo.innerHTML = `Número: <a href="https://wa.me/${atendimento.numeroCliente}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${atendimento.numeroCliente}</a>`;
        _dom.chatModal.dataset.atendimentoId = atendimentoId;

        const isNew = atendimento.status === 'NOVO';
        _dom.startContainer.classList.toggle('hidden', !isNew);
        _dom.continueContainer.classList.toggle('hidden', isNew);

        _dom.continueBtn.onclick = () => {
            window.open(`https://wa.me/${atendimento.numeroCliente}`, '_blank');
            _closeChatModal();
        };

        const mensagens = atendimento.mensagensPreview || [];
        mensagens.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (mensagens.length > 0) {
            _dom.chatHistory.innerHTML = mensagens.map(msg => `
                <div class="${msg.remetente.toUpperCase() === 'CLIENTE' ? 'chat-bubble-user' : 'chat-bubble-agent'} p-3 rounded-lg">
                    <p class="text-sm text-gray-800">${msg.mensagem}</p>
                    <div class="text-right text-xs text-gray-500 mt-1">${new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>`).join('');
        } else {
            _dom.chatHistory.innerHTML = '<p class="text-center text-gray-500 p-4">Nenhuma mensagem de pré-visualização.</p>';
        }

        _dom.chatModal.classList.remove('hidden');
    }

    async function _startAtendimento() {
        const codigoAtendimento = _dom.chatModal.dataset.atendimentoId;
        if (!codigoAtendimento) return;

        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.codigo) {
            _config.showMessageModal("Erro", "Não foi possível identificar o vendedor. Faça login novamente.");
            return;
        }

        try {
            const response = await fetch(_config.apiUrls.ATENDIMENTO_START, {
                method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigoAtendimento, codigoVendedor: userInfo.codigo })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Falha na API');

            const atendimento = _allAtendimentos.find(a => a.codigoAtendimento === codigoAtendimento);
            if (atendimento) {
                window.open(`https://wa.me/${atendimento.numeroCliente}`, '_blank');
            }
            _closeChatModal();
            // Fetch fresh data to update status and assigned seller
            await _fetchAtendimentos();

        } catch (error) {
            _config.showMessageModal("Erro", `Não foi possível iniciar o atendimento: ${error.message}`);
        }
    }


    /** Binds all event listeners for this module. */
    function _bindEvents() {
        if (_dom.page) {
            _dom.page.addEventListener('click', (event) => {
                const openChatAction = event.target.closest('.open-chat-action');
                if (openChatAction) {
                    _openChatModal(openChatAction.dataset.atendimentoId);
                }
            });
        }
        if (_dom.closeChatModalBtn) _dom.closeChatModalBtn.addEventListener('click', _closeChatModal);
        if (_dom.startBtn) _dom.startBtn.addEventListener('click', _startAtendimento);
    }

    /** Caches DOM elements used by this module. */
    function _cacheDom() {
        _dom.page = document.getElementById('page-atendimento');
        _dom.kanbanContainer = document.getElementById('atendimento-kanban-container');
        _dom.updateIndicator = document.getElementById('atendimento-update-indicator');
        _dom.countdownTimer = document.getElementById('atendimento-countdown-timer');
        _dom.chatModal = document.getElementById('atendimento-chat-modal');
        _dom.closeChatModalBtn = document.getElementById('close-atendimento-chat-modal-btn');
        _dom.chatModalTitle = document.getElementById('atendimento-chat-modal-title');
        _dom.chatModalInfo = document.getElementById('atendimento-chat-modal-info');
        _dom.chatHistory = document.getElementById('atendimento-chat-history');
        _dom.startBtn = document.getElementById('atendimento-start-btn');
        _dom.startContainer = document.getElementById('atendimento-start-container');
        _dom.continueBtn = document.getElementById('atendimento-continue-btn');
        _dom.continueContainer = document.getElementById('atendimento-continue-container');
    }

    // --- Public API ---
    return {
        init: function(config) {
            _config = config;
            _cacheDom();
            _bindEvents();
        },
        start: function() {
            // Called when the atendimento page is shown
            _fetchAtendimentos();
            startTimer();
        },
        stop: function() {
            // Called when navigating away from the atendimento page
            stopTimer();
        }
    };
})();
