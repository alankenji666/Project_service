document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('satg-form');
    const successScreen = document.getElementById('success-screen');
    const btnSubmit = document.getElementById('btn-submit');

    const telefoneInput = document.getElementById('telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            
            if (value.length === 0) {
                e.target.value = '';
            } else if (value.length <= 2) {
                e.target.value = '(' + value;
            } else if (value.length <= 6) {
                e.target.value = '(' + value.slice(0, 2) + ') ' + value.slice(2);
            } else if (value.length <= 10) {
                e.target.value = '(' + value.slice(0, 2) + ') ' + value.slice(2, 6) + '-' + value.slice(6);
            } else {
                e.target.value = '(' + value.slice(0, 2) + ') ' + value.slice(2, 7) + '-' + value.slice(7, 11);
            }
        });
    }

    const BACKEND_URL = 'https://bling-proxy-api-255108547424.southamerica-east1.run.app/garantia/satg/public-submit';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = `<svg class="animate-spin h-5 w-5 mr-3 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Enviando...`;
        btnSubmit.disabled = true;

        const valEntrega = document.getElementById('dataEntregaTecnica').value;
        const valPreventiva = document.getElementById('dataUltimaPreventiva').value;

        if (valEntrega && valPreventiva) {
            const dtEntrega = new Date(valEntrega);
            const dtPreventiva = new Date(valPreventiva);
            const diffTime = Math.abs(dtPreventiva - dtEntrega);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 365) {
                alert("Data invalida para garantia.");
                btnSubmit.innerHTML = originalBtnText;
                btnSubmit.disabled = false;
                return;
            }
        }

        try {
            // Montar objeto com os dados
            const payload = {
                cliente: document.getElementById('cliente').value,
                cpf: document.getElementById('cpf').value,
                nomeContato: document.getElementById('nomeContato').value,
                telefone: document.getElementById('telefone').value,
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
                fotos: '' // Removido temporariamente
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

    const telInput = document.getElementById('telefone');
    telInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "");
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d)(\d{4})$/, "$1-$2");
        e.target.value = v;
    });
});
