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

        tbody.innerHTML = '';

        if (_transportadoras.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-4 text-center text-gray-500">Nenhuma transportadora cadastrada</td></tr>';
            return;
        }

        _transportadoras.forEach(t => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium">${t.codigo}</td>
                <td class="px-4 py-3 text-sm">${t.nome}</td>
                <td class="px-4 py-3 text-sm">${t.fantasia || '-'}</td>
                <td class="px-4 py-3 text-sm">${t.telefone || '-'}</td>
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

        if (btnNova) btnNova.addEventListener('click', _openNewForm);
        if (btnSalvar) btnSalvar.addEventListener('click', _salvarTransportadora);
        if (btnCancelar) btnCancelar.addEventListener('click', _cancelarForm);
        if (btnFechar) btnFechar.addEventListener('click', _closeModal);
        if (btnSync) btnSync.addEventListener('click', _syncBling);
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
