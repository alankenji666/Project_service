/**
 * modulos/updateChecker.js
 *
 * Módulo para monitoramento e aplicação de novas versões e deploys.
 * Detecta alterações via /version.json e ETag de /index.html.
 * Alerta o usuário através do ícone no cabeçalho e permite atualizar com 1 clique,
 * limpando o cache e garantindo que ninguém precise dar Ctrl+Shift+R.
 */

export const UpdateChecker = (function () {
    let _isInitialized = false;
    let _currentDeployId = null;
    let _currentEtag = null;
    let _currentVersion = '1.0.5';
    let _hasUpdate = false;
    let _updateData = null;
    let _isChecking = false;
    let _checkInterval = null;
    let _lastCheckTime = null;

    // Elementos DOM
    let _btn = null;
    let _dropdown = null;
    let _badge = null;
    let _versionTag = null;
    let _statusBox = null;
    let _statusText = null;
    let _statusTime = null;
    let _actionBox = null;
    let _applyBtn = null;
    let _applySpinner = null;
    let _manualCheckBtn = null;

    function _init() {
        if (_isInitialized) return;

        // Limpa parâmetro de cache-buster da URL caso tenha acabado de recarregar
        _cleanUrlParam();

        // Mapeia elementos DOM
        _btn = document.getElementById('update-button');
        _dropdown = document.getElementById('update-dropdown');
        _badge = document.getElementById('update-badge');
        _versionTag = document.getElementById('current-version-tag');
        _statusBox = document.getElementById('update-status-box');
        _statusText = document.getElementById('update-status-text');
        _statusTime = document.getElementById('last-update-check');
        _actionBox = document.getElementById('update-action-box');
        _applyBtn = document.getElementById('apply-update-btn');
        _applySpinner = document.getElementById('apply-update-spinner');
        _manualCheckBtn = document.getElementById('manual-check-update-btn');

        _attachEventListeners();

        // Checagem inicial para registrar o baseline
        _runInitialBaseline();

        // Polling periódico (a cada 2.5 minutos = 150000ms)
        _checkInterval = setInterval(() => {
            checkForUpdates(false);
        }, 150000);

        // Checa também quando o usuário volta para a aba do sistema
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                if (!_lastCheckTime || (now - _lastCheckTime > 45000)) {
                    checkForUpdates(false);
                }
            }
        });

        _isInitialized = true;
    }

    function _cleanUrlParam() {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('_v')) {
                url.searchParams.delete('_v');
                const newQuery = url.searchParams.toString();
                const newUrl = url.pathname + (newQuery ? '?' + newQuery : '') + url.hash;
                window.history.replaceState({}, document.title, newUrl);
            }
        } catch (e) {
            console.warn('[UpdateChecker] Erro ao limpar url param:', e);
        }
    }

    function _attachEventListeners() {
        if (_btn && _dropdown) {
            _btn.addEventListener('click', (e) => {
                e.stopPropagation();
                _toggleDropdown();
            });

            // Fecha ao clicar fora
            document.addEventListener('click', (e) => {
                if (_dropdown && !_dropdown.classList.contains('hidden')) {
                    if (!_btn.contains(e.target) && !_dropdown.contains(e.target)) {
                        _dropdown.classList.add('hidden');
                    }
                }
            });
        }

        if (_applyBtn) {
            _applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                _applyUpdate();
            });
        }

        if (_manualCheckBtn) {
            _manualCheckBtn.addEventListener('click', (e) => {
                e.preventDefault();
                checkForUpdates(true);
            });
        }
    }

    function _toggleDropdown() {
        if (!_dropdown) return;
        const willOpen = _dropdown.classList.contains('hidden');

        // Fecha outros dropdowns
        const notifDropdown = document.getElementById('notification-dropdown');
        if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
            notifDropdown.classList.add('hidden');
        }
        const settingsDropdown = document.getElementById('settings-dropdown');
        if (settingsDropdown && !settingsDropdown.classList.contains('hidden')) {
            settingsDropdown.classList.add('hidden');
        }

        if (willOpen) {
            _dropdown.classList.remove('hidden');
        } else {
            _dropdown.classList.add('hidden');
        }
    }

    async function _runInitialBaseline() {
        try {
            // Verifica se o usuário acabou de atualizar
            if (localStorage.getItem('just_updated') === 'true') {
                localStorage.removeItem('just_updated');
                _notify('Sistema atualizado com sucesso para a versão mais recente!', 'success');
            }

            // Coleta os valores de baseline atuais do servidor
            const [versionRes, headRes] = await Promise.allSettled([
                fetch('/version.json?_t=' + Date.now(), { cache: 'no-store' }),
                fetch('/index.html?_t=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
            ]);

            if (versionRes.status === 'fulfilled' && versionRes.value.ok) {
                const data = await versionRes.value.json();
                if (data.version) _currentVersion = data.version;
                if (data.deployId) _currentDeployId = String(data.deployId);
            }

            if (headRes.status === 'fulfilled' && headRes.value.ok) {
                const etag = headRes.value.headers.get('etag');
                if (etag) _currentEtag = etag;
            }

            if (_versionTag) {
                _versionTag.textContent = `v${_currentVersion}`;
            }

            _updateLastCheckedDisplay();
            console.log('[UpdateChecker] Baseline inicial carregado:', {
                version: _currentVersion,
                deployId: _currentDeployId,
                etag: _currentEtag
            });
        } catch (err) {
            console.warn('[UpdateChecker] Aviso ao coletar baseline:', err);
        }
    }

    async function checkForUpdates(isManual = false) {
        if (_isChecking) return;
        _isChecking = true;

        if (isManual && _statusText) {
            _statusText.innerHTML = '<span class="text-blue-600 animate-pulse font-medium">Verificando atualizações no servidor...</span>';
        }

        try {
            const [versionRes, headRes] = await Promise.allSettled([
                fetch('/version.json?_t=' + Date.now(), { cache: 'no-store' }),
                fetch('/index.html?_t=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
            ]);

            let remoteData = null;
            let remoteEtag = null;

            if (versionRes.status === 'fulfilled' && versionRes.value.ok) {
                remoteData = await versionRes.value.json();
            }

            if (headRes.status === 'fulfilled' && headRes.value.ok) {
                remoteEtag = headRes.value.headers.get('etag');
            }

            _lastCheckTime = Date.now();
            _updateLastCheckedDisplay();

            // Determina se há uma nova versão
            let updateFound = false;

            if (remoteData && _currentDeployId && remoteData.deployId && String(remoteData.deployId) !== String(_currentDeployId)) {
                updateFound = true;
            } else if (remoteData && _currentVersion && remoteData.version && remoteData.version !== _currentVersion) {
                updateFound = true;
            } else if (remoteEtag && _currentEtag && remoteEtag !== _currentEtag) {
                updateFound = true;
            }

            if (updateFound) {
                _hasUpdate = true;
                _updateData = remoteData || { version: 'Nova versão' };
                _renderUpdateAvailable(_updateData);
                if (isManual) {
                    _notify('Nova versão disponível! Clique em "Atualizar agora".', 'info');
                }
            } else {
                _hasUpdate = false;
                _renderUpToDate();
                if (isManual) {
                    _notify('Você já está utilizando a versão mais recente do sistema.', 'success');
                }
            }
        } catch (err) {
            console.error('[UpdateChecker] Erro ao verificar atualizações:', err);
            if (isManual && _statusText) {
                _statusText.textContent = 'Não foi possível verificar no momento. Tente novamente.';
            }
        } finally {
            _isChecking = false;
        }
    }

    function _renderUpdateAvailable(data) {
        // Exibe badge com pulsing
        if (_badge) {
            _badge.classList.remove('hidden');
        }

        // Destaca o botão
        if (_btn) {
            _btn.classList.add('text-emerald-600', 'bg-emerald-50');
            _btn.title = 'Nova versão disponível! Clique para atualizar';
        }

        // Atualiza caixa de status
        if (_statusBox) {
            _statusBox.className = 'p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900';
        }

        const vText = data?.version ? ` (v${data.version})` : '';
        const notes = data?.notes ? `<div class="mt-1 text-xs text-emerald-800 font-normal">${data.notes}</div>` : '';

        if (_statusText) {
            _statusText.innerHTML = `
                <div class="flex items-center space-x-1.5 font-bold text-xs text-emerald-800">
                    <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    <span>Nova versão disponível!${vText}</span>
                </div>
                ${notes}
            `;
        }

        // Mostra o botão de atualizar
        if (_actionBox) {
            _actionBox.classList.remove('hidden');
        }
    }

    function _renderUpToDate() {
        if (_badge) {
            _badge.classList.add('hidden');
        }

        if (_btn) {
            _btn.classList.remove('text-emerald-600', 'bg-emerald-50');
            _btn.title = 'Atualizações do Sistema';
        }

        if (_statusBox) {
            _statusBox.className = 'p-3 rounded-lg bg-gray-50 border border-gray-100 text-gray-700';
        }

        if (_statusText) {
            _statusText.innerHTML = '<span class="text-xs text-gray-600">Sistema atualizado na versão mais recente.</span>';
        }

        if (_actionBox) {
            _actionBox.classList.add('hidden');
        }
    }

    function _updateLastCheckedDisplay() {
        if (!_statusTime) return;
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        _statusTime.textContent = `${hours}:${minutes}`;
    }

    async function _applyUpdate() {
        if (_applyBtn) {
            _applyBtn.disabled = true;
            _applyBtn.classList.add('opacity-75', 'cursor-not-allowed');
        }
        if (_applySpinner) {
            _applySpinner.classList.remove('hidden');
        }

        // Grava flag de atualização concluída
        try {
            localStorage.setItem('just_updated', 'true');
        } catch (e) {}

        // Limpa cache da API CacheStorage (se suportado pelo navegador)
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('[UpdateChecker] Caches deletados com sucesso.');
            } catch (err) {
                console.warn('[UpdateChecker] Erro ao limpar caches:', err);
            }
        }

        // Força recarregamento imediato limpando o cache via timestamp query param
        const url = new URL(window.location.href);
        url.searchParams.set('_v', Date.now());
        window.location.replace(url.toString());
    }

    function _notify(msg, type = 'info') {
        if (typeof window.showToastNotification === 'function') {
            window.showToastNotification(msg, type);
            return;
        }
        console.log(`[UpdateChecker ${type}]: ${msg}`);
    }

    return {
        init: _init,
        checkForUpdates: checkForUpdates,
        applyUpdate: _applyUpdate
    };
})();
