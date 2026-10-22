document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('satg-form');
    const successScreen = document.getElementById('success-screen');
    const btnSubmit = document.getElementById('btn-submit');

    // Detecção de Modo Agente Interno
    const urlParams = new URLSearchParams(window.location.search);
    const isInterno = urlParams.get('origem') === 'interno' || 
                      urlParams.get('modo') === 'interno' || 
                      urlParams.get('agente') === 'interno' ||
                      window.self !== window.top; // Se estiver embutido no modal iframe

    const campoCodigoClienteContainer = document.getElementById('campo-codigo-cliente-container');
    const inputCodigoCliente = document.getElementById('codigoCliente');
    const campoEmailContainer = document.getElementById('campo-email-container');

    if (isInterno) {
        if (campoCodigoClienteContainer) campoCodigoClienteContainer.classList.remove('hidden');
        if (inputCodigoCliente) {
            inputCodigoCliente.required = true;
            inputCodigoCliente.setAttribute('required', 'required');
        }
        if (campoEmailContainer) campoEmailContainer.classList.remove('md:col-span-2');
    } else {
        if (campoCodigoClienteContainer) campoCodigoClienteContainer.classList.add('hidden');
        if (inputCodigoCliente) {
            inputCodigoCliente.required = false;
            inputCodigoCliente.removeAttribute('required');
            inputCodigoCliente.value = '';
        }
        if (campoEmailContainer) campoEmailContainer.classList.add('md:col-span-2');
    }

    function maskPhoneInput(rawInput) {
        let raw = String(rawInput || '');
        let isExplicitDDI = raw.trim().startsWith('+55') || raw.trim().startsWith('+ 55') || raw.trim().startsWith('+');
        let digits = raw.replace(/\D/g, '');

        if (isExplicitDDI && digits.startsWith('55')) {
            digits = digits.substring(2);
        } else if (digits.length > 11 && digits.startsWith('55')) {
            digits = digits.substring(2);
        }

        if (digits.length >= 11 && digits.startsWith('0')) {
            digits = digits.substring(1);
        }

        digits = digits.substring(0, 11);

        if (digits.length === 0) return '';
        if (digits.length <= 2) return '(' + digits;
        if (digits.length <= 6) return '(' + digits.substring(0, 2) + ') ' + digits.substring(2);
        if (digits.length <= 10) return '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 6) + '-' + digits.substring(6);
        return '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 7) + '-' + digits.substring(7);
    }

    const telefoneInput = document.getElementById('telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function (e) {
            e.target.value = maskPhoneInput(e.target.value);
        });
    }

    const BACKEND_URL = 'https://bling-proxy-api-255108547424.southamerica-east1.run.app/garantia/satg/public-submit';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isInterno) {
            const codClienteVal = (inputCodigoCliente ? inputCodigoCliente.value : '').trim();
            if (!codClienteVal) {
                alert('O campo "Cód. Cliente" é obrigatório.');
                if (inputCodigoCliente) inputCodigoCliente.focus();
                return;
            }
        }

        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = `<svg class="animate-spin h-5 w-5 mr-3 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Enviando...`;
        btnSubmit.disabled = true;

        try {
            // Montar objeto com os dados
            const payload = {
                codigoCliente: (inputCodigoCliente ? inputCodigoCliente.value.trim() : ''),
                cliente: document.getElementById('cliente').value,
                cpf: document.getElementById('cpf').value,
                nomeContato: document.getElementById('nomeContato').value,
                telefone: maskPhoneInput(document.getElementById('telefone').value),
                email: document.getElementById('email').value,
                revenda: document.getElementById('revenda').value,
                localRevenda: document.getElementById('localRevenda').value,
                equipamento: document.getElementById('equipamento').value,
                numeroSerie: document.getElementById('numeroSerie').value,
                numeroRequisicao: document.getElementById('numeroRequisicao').value,
                notaFiscal: document.getElementById('notaFiscal').value,
                dataCompra: document.getElementById('dataCompra').value,
                dataEntregaTecnica: document.getElementById('dataEntregaTecnica').value,
                aplicacao: document.getElementById('aplicacao').value,
                chassiEndereco: document.getElementById('chassiEndereco').value,
                emOperacao: document.getElementById('emOperacao').value,
                dataParada: document.getElementById('dataParada').value,
                dataUltimaPreventiva: document.getElementById('dataUltimaPreventiva').value,
                ondeEstaProblema: document.getElementById('ondeEstaProblema').value,
                sintoma: document.getElementById('sintoma').value,
                problema: document.getElementById('problema').value,
                preDiagnostico: document.getElementById('preDiagnostico').value,
                fotos: '', // Removido temporariamente
                responsavel: new URLSearchParams(window.location.search).get('responsavel') || ''
            };

            // 3. Enviar para o Backend Node.js
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                alert('Erro ao enviar formulário: ' + data.message);
            } else {
                // Sucesso!
                form.classList.add('hidden');
                successScreen.classList.remove('hidden');
                document.getElementById('success-code').innerText = data.codigo || 'SAT-G: ENVIADO';
            }

        } catch(error) {
            console.error(error);
            alert('Falha na comunicação com o servidor. Verifique sua internet.');
        } finally {
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
        }
    });

    // Mascaras simples (Opcional - você pode adicionar bibliotecas como imask.js depois se quiser ficar perfeito)
    const cpfInput = document.getElementById('cpf');
    cpfInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if(v.length <= 11) {
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        } else {
            v = v.replace(/^(\d{2})(\d)/, "$1.$2");
            v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
            v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
            v = v.replace(/(\d{4})(\d)/, "$1-$2");
        }
        e.target.value = v;
    });
});
