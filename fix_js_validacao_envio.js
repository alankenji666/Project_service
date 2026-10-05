const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /const btnOriginalText = _btnSubmitGarantia\.innerHTML;/;

const replacement = `// VALIDAÇÃO DE ENVIO
        const chkE = document.getElementById('garantia-possui-envio');
        if (chkE && chkE.checked) {
            const requiredFields = [
                { id: 'garantia-transportadora', name: 'Transportadora' },
                { id: 'garantia-volume', name: 'Volume' },
                { id: 'garantia-valor-frete', name: 'Valor Frete' },
                { id: 'garantia-cep', name: 'CEP' },
                { id: 'garantia-endereco', name: 'Endereço' },
                { id: 'garantia-numero-envio', name: 'Número' },
                { id: 'garantia-bairro', name: 'Bairro' },
                { id: 'garantia-cidade', name: 'Cidade' },
                { id: 'garantia-estado', name: 'Estado (UF)' }
            ];

            const missing = requiredFields.filter(f => {
                const el = document.getElementById(f.id);
                return !el || !el.value.trim();
            });
            
            if (missing.length > 0) {
                const missingNames = missing.map(f => f.name).join(', ');
                alert(\`Por favor, preencha os seguintes campos de envio obrigatórios:\\n\\n\${missingNames}\`);
                
                // Dar foco no primeiro campo vazio
                const firstEl = document.getElementById(missing[0].id);
                if (firstEl) firstEl.focus();
                return;
            }
        }

        const btnOriginalText = _btnSubmitGarantia.innerHTML;`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Validação de envio inserida no formulário!');
