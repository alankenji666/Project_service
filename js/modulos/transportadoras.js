/**
 * modulos/transportadoras.js
 * 
 * Módulo para gerenciar Transportadoras
 * Operações: Listar, Criar, Editar, Deletar
 */

import { API_URLS } from '../apiConfig.js';

export const TransportadorasApp = (function() {
    const API_BASE_URL = "https://bling-proxy-api-255108547424.southamerica-east1.run.app";
    let _transportadoras = [];
    let _currentEditingCodigo = null;
    let _isInitialized = false;

    /**
     * Inicializa o modal e carrega dados
     */
    function _init() {
        if (_isInitialized) return;
        _attachEventListeners();
        _isInitialized = true;
    }

    /**
     * Carrega lista de transportadoras do backend
     */
    async function _loadTransportadoras() {
        try {
            console.log(`[Transportadoras] Carregando de ${API_BASE_URL}/transportadoras`);
            const response = await fetch(`${API_BASE_URL}/transportadoras`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const data = await response.json();
            console.log('[Transportadoras] Dados recebidos:', data);
            _transportadoras = data.transportadoras || [];
            console.log(`[Transportadoras] Total carregado: ${_transportadoras.length}`);
            _renderTransportadorasList();
        } catch (err) {
            console.error('Erro ao carregar transportadoras:', err);
            alert('Erro ao carregar transportadoras: ' + err.message);
        }
    }

    /**
     * Renderiza a lista de transportadoras na tabela
     */
    function _renderTransportadorasList() {
        const tbody = document.querySelector('#transportadoras-tbody');
        if (!tbody) return;

        const searchInput = document.querySelector('#transportadoras-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        tbody.innerHTML = '';

        const filteredTransportadoras = _transportadoras.filter(t => {
            if (!searchTerm) return true;
            return (
                (t.nome && t.nome.toLowerCase().includes(searchTerm)) ||
                (t.fantasia && t.fantasia.toLowerCase().includes(searchTerm)) ||
                (t.codigo && t.codigo.toLowerCase().includes(searchTerm)) ||
                (t.telefone && t.telefone.toLowerCase().includes(searchTerm)) ||
                (t.cnpj && t.cnpj.toLowerCase().includes(searchTerm))
            );
        });

        if (filteredTransportadoras.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-4 text-center text-gray-500">Nenhuma transportadora encontrada</td></tr>';
            return;
        }

        filteredTransportadoras.forEach(t => {
                let telefoneHtml = '-';
                if (t.telefone) {
                    const cleanPhone = String(t.telefone).replace(/\D/g, '');
                    if (cleanPhone.length >= 10) {
                        telefoneHtml = `<a href="https://wa.me/55${cleanPhone}" target="_blank" class="text-blue-600 hover:text-blue-800 underline flex items-center gap-1" title="Abrir no WhatsApp"><svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.39 0 0 5.39 0 12.031c0 2.124.553 4.195 1.604 6.01L.062 23.953l6.062-1.593A11.97 11.97 0 0012.031 24c6.641 0 12.031-5.39 12.031-12.031S18.672 0 12.031 0zm0 22.016a9.92 9.92 0 01-5.076-1.39l-.364-.216-3.76.99.998-3.666-.237-.376a9.927 9.927 0 01-1.528-5.328c0-5.496 4.474-9.97 9.967-9.97 5.495 0 9.97 4.474 9.97 9.97s-4.475 9.97-9.97 9.97zm5.483-4.887c-.302-.15-1.782-.879-2.057-.98-.276-.1-.477-.151-.678.15-.201.302-.779.98-1.004 1.181-.225.201-.452.226-.753.076-2.091-1.045-3.661-2.072-5.073-4.522-.193-.338.204-.326.638-.853.15-.181.301-.36.452-.54.161-.192.215-.326.322-.543.107-.216.054-.403-.021-.553-.075-.151-.745-1.796-1.02-2.46-.271-.652-.545-.563-.745-.573-.193-.01-.413-.011-.635-.011-.221 0-.584.083-.889.414-.305.331-1.164 1.137-1.164 2.772 0 1.636 1.194 3.22 1.359 3.44.166.222 2.348 3.582 5.688 5.023 1.946.84 2.748.887 3.513.754.896-.156 2.793-1.14 3.19-2.245.397-1.105.397-2.05.279-2.245-.118-.196-.431-.311-.733-.462z"/></svg>${t.telefone}</a>`;
                    } else {
                        telefoneHtml = t.telefone;
                    }
                }

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium">${t.codigo}</td>
                <td class="px-4 py-3 text-sm">${t.nome}</td>
                <td class="px-4 py-3 text-sm">${t.fantasia || '-'}</td>
                <td class="px-4 py-3 text-sm">${telefoneHtml}</td>
                <td class="px-4 py-3 text-sm">${t.email || '-'}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="px-2 py-1 text-xs rounded-full ${t.ativo === 'Sim' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${t.ativo || 'Não'}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm space-x-2">
                    <button onclick="TransportadorasApp.editarTransportadora('${t.codigo}')" class="text-blue-600 hover:text-blue-800">Editar</button>
                    <button onclick="TransportadorasApp.deletarTransportadora('${t.codigo}')" class="text-red-600 hover:text-red-800">Deletar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Gera um código único para nova transportadora
     */
    function _generateCode() {
        return 'T' + Date.now().toString().slice(-8);
    }

    /**
     * Abre o formulário para criar nova transportadora
     */
    function _openNewForm() {
        _currentEditingCodigo = null;
        _clearForm();
        const codigoInput = document.querySelector('#transportadoras-codigo');
        codigoInput.value = _generateCode();
        codigoInput.disabled = true;
        document.querySelector('#transportadoras-form-title').textContent = 'Nova Transportadora';
        document.querySelector('#transportadoras-form-container').classList.remove('hidden');
    }

    /**
     * Edita uma transportadora existente
     */
    function editarTransportadora(codigo) {
        const t = _transportadoras.find(x => x.codigo === codigo);
        if (!t) return;

        _currentEditingCodigo = codigo;
        document.querySelector('#transportadoras-form-title').textContent = 'Editar Transportadora';
        const codigoInput = document.querySelector('#transportadoras-codigo');
        codigoInput.value = t.codigo || '';
        codigoInput.disabled = false; // Permite editar o código
        
        // Popula formulário
        document.querySelector('#transportadoras-nome').value = t.nome || '';
        document.querySelector('#transportadoras-fantasia').value = t.fantasia || '';
        document.querySelector('#transportadoras-endereco').value = t.endereco || '';
        document.querySelector('#transportadoras-numero').value = t.numero || '';
        document.querySelector('#transportadoras-complemento').value = t.complemento || '';
        document.querySelector('#transportadoras-bairro').value = t.bairro || '';
        document.querySelector('#transportadoras-cidade').value = t.cidade || '';
        document.querySelector('#transportadoras-estado').value = t.estado || '';
        document.querySelector('#transportadoras-cep').value = t.cep || '';
        document.querySelector('#transportadoras-cnpj').value = t.cnpj || '';
        document.querySelector('#transportadoras-inscricao').value = t.inscricao_estadual || '';
        document.querySelector('#transportadoras-telefone').value = t.telefone || '';
        document.querySelector('#transportadoras-email').value = t.email || '';
        document.querySelector('#transportadoras-website').value = t.website || '';
        document.querySelector('#transportadoras-contato').value = t.contato || '';
        document.querySelector('#transportadoras-tipo').value = t.tipo || '';
        document.querySelector('#transportadoras-ativo').value = t.ativo || 'Sim';
        document.querySelector('#transportadoras-faz-coleta').value = t.faz_coleta || 'Não';

        document.querySelector('#transportadoras-form-container').classList.remove('hidden');
    }

    /**
     * Deleta uma transportadora
     */
    async function deletarTransportadora(codigo) {
        if (!confirm(`Deseja deletar a transportadora ${codigo}?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/transportadoras/${codigo}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Erro ao deletar');
            
            alert('Transportadora deletada com sucesso!');
            _loadTransportadoras();
        } catch (err) {
            alert('Erro ao deletar: ' + err.message);
        }
    }

    /**
     * Salva a transportadora (criar ou editar)
     */
    async function _salvarTransportadora() {
        const codigo = document.querySelector('#transportadoras-codigo').value;
        const nome = document.querySelector('#transportadoras-nome').value;

        if (!codigo || !nome) {
            alert('Código e Nome são obrigatórios!');
            return;
        }

        const data = {
            codigo,
            nome,
            fantasia: document.querySelector('#transportadoras-fantasia').value,
            endereco: document.querySelector('#transportadoras-endereco').value,
            numero: document.querySelector('#transportadoras-numero').value,
            complemento: document.querySelector('#transportadoras-complemento').value,
            bairro: document.querySelector('#transportadoras-bairro').value,
            cidade: document.querySelector('#transportadoras-cidade').value,
            estado: document.querySelector('#transportadoras-estado').value,
            cep: document.querySelector('#transportadoras-cep').value,
            cnpj: document.querySelector('#transportadoras-cnpj').value,
            inscricao_estadual: document.querySelector('#transportadoras-inscricao').value,
            telefone: document.querySelector('#transportadoras-telefone').value,
            email: document.querySelector('#transportadoras-email').value,
            website: document.querySelector('#transportadoras-website').value,
            contato: document.querySelector('#transportadoras-contato').value,
            tipo: document.querySelector('#transportadoras-tipo').value,
            ativo: document.querySelector('#transportadoras-ativo').value,
            faz_coleta: document.querySelector('#transportadoras-faz-coleta').value
        };

        try {
            const method = _currentEditingCodigo ? 'PATCH' : 'POST';
            const url = _currentEditingCodigo 
                ? `${API_BASE_URL}/transportadoras/${_currentEditingCodigo}`
                : `${API_BASE_URL}/transportadoras`;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                let errorMsg = errorData.error || 'Erro ao salvar';
                
                // Tratamento específico para código duplicado
                if (response.status === 409) {
                    errorMsg = errorData.error;
                }
                
                alert(errorMsg);
                return;
            }

            alert(_currentEditingCodigo ? 'Transportadora atualizada!' : 'Transportadora criada!');
            _cancelarForm();
            _loadTransportadoras();
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        }
    }

    /**
     * Limpa o formulário
     */
    function _clearForm() {
        document.querySelector('#transportadoras-form').reset();
    }

    /**
     * Cancela a edição
     */
    function _cancelarForm() {
        document.querySelector('#transportadoras-form-container').classList.add('hidden');
        _clearForm();
    }

    /**
     * Fecha o modal
     */
    function _closeModal() {
        const modal = document.querySelector('#transportadoras-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Abre o modal
     */
    function _openModal() {
        if (!_isInitialized) _init();
        const modal = document.querySelector('#transportadoras-modal');
        if (modal) modal.classList.remove('hidden');
        _loadTransportadoras();
    }

    /**
     * Sincroniza com Bling
     */
    async function _syncBling() {
        const btnSync = document.querySelector('#transportadoras-btn-sync');
        if (!btnSync) return;

        const originalHtml = btnSync.innerHTML;
        btnSync.innerHTML = `<svg class="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        btnSync.disabled = true;

        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: "Sincronizando com Bling... Isso pode levar alguns segundos.",
                duration: 3000,
                style: { background: "#3b82f6" }
            }).showToast();
        }

        try {
            const url = API_URLS.TRANSPORTADORAS_SYNC;
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao sincronizar');
            }

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: `Sincronização concluída! ${result.novos} novas, ${result.atualizados} atualizadas.`,
                    duration: 4000,
                    style: { background: "#10b981" }
                }).showToast();
            }

            _loadTransportadoras();

        } catch (error) {
            console.error('Erro na sincronização:', error);
            alert('Falha na sincronização: ' + error.message);
        } finally {
            btnSync.innerHTML = originalHtml;
            btnSync.disabled = false;
        }
    }

    /**
     * Anexa event listeners
     */
    function _attachEventListeners() {
        const btnNova = document.querySelector('#transportadoras-btn-nova');
        const btnSalvar = document.querySelector('#transportadoras-btn-salvar');
        const btnCancelar = document.querySelector('#transportadoras-btn-cancelar');
        const btnFechar = document.querySelector('#transportadoras-btn-fechar');
        const btnSync = document.querySelector('#transportadoras-btn-sync');
        const searchInput = document.querySelector('#transportadoras-search');

        if (btnNova) btnNova.addEventListener('click', _openNewForm);
        if (btnSalvar) btnSalvar.addEventListener('click', _salvarTransportadora);
        if (btnCancelar) btnCancelar.addEventListener('click', _cancelarForm);
        if (btnFechar) btnFechar.addEventListener('click', _closeModal);
        if (btnSync) btnSync.addEventListener('click', _syncBling);
        if (searchInput) {
            searchInput.addEventListener('input', _renderTransportadorasList);
        }
    }

    // API Pública
    return {
        init: _init,
        openModal: _openModal,
        closeModal: _closeModal,
        editarTransportadora: editarTransportadora,
        deletarTransportadora: deletarTransportadora
    };
})();
