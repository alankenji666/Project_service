const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /e\.target\.value = 'R\$ ' \+ v\.replace\('\.', ','\)\.replace\(\/\(\\d\)\(\?\=\(\\d\{3\}\)\+\(\?\!\\d\)\)\/g, '\$1\.'\);\s*\}\);\s*\}/;

const replacement = `e.target.value = 'R$ ' + v.replace('.', ',').replace(/(\\d)(?=(\\d{3})+(?!\\d))/g, '$1.');
            });
        }

        const btnCep = document.getElementById('btn-search-cep');
        if (btnCep && cepInput) {
            btnCep.addEventListener('click', async () => {
                const cep = cepInput.value.replace(/\\D/g, '');
                if (cep.length !== 8) {
                    alert('Por favor, digite um CEP válido com 8 dígitos.');
                    return;
                }
                
                const originalHtml = btnCep.innerHTML;
                btnCep.innerHTML = \`<svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\`;
                btnCep.disabled = true;

                try {
                    const response = await fetch(\`https://viacep.com.br/ws/\${cep}/json/\`);
                    const data = await response.json();
                    
                    if (data.erro) {
                        alert('CEP não encontrado.');
                    } else {
                        document.getElementById('garantia-endereco').value = data.logradouro || '';
                        document.getElementById('garantia-bairro').value = data.bairro || '';
                        document.getElementById('garantia-cidade').value = data.localidade || '';
                        
                        const estadoEl = document.getElementById('garantia-estado');
                        if (estadoEl) {
                            estadoEl.value = data.uf || '';
                        }
                        // Opcionalmente dar focus no número
                        const numEl = document.getElementById('garantia-numero-envio');
                        if (numEl) numEl.focus();
                    }
                } catch (error) {
                    console.error('Erro ao buscar CEP:', error);
                    alert('Erro ao buscar o CEP. Verifique sua conexão.');
                } finally {
                    btnCep.innerHTML = originalHtml;
                    btnCep.disabled = false;
                }
            });
        }`;

js = js.replace(regex, replacement);
fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('ViaCEP implementado!');
