const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Definir e buscar variáveis e eventos no INIT
const bindEventsRegex = /if \(_btnBackFromForm\) _btnBackFromForm\.onclick = checkCloseForm;/;
const bindEventsCode = `
        // Checkbox "Possui Envio?"
        const checkboxEnvio = document.getElementById('garantia-possui-envio');
        const containerEnvio = document.getElementById('garantia-envio-container');
        if (checkboxEnvio && containerEnvio) {
            checkboxEnvio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    containerEnvio.classList.remove('hidden');
                } else {
                    containerEnvio.classList.add('hidden');
                }
            });
        }
        
        // Fetch Transportadoras na inicialização
        fetch(API_URLS.TRANSPORTADORAS || (window.API_BASE_URL + '/garantia/transportadoras'))
            .then(res => res.ok ? res.json() : {transportadoras:[]})
            .then(data => {
                const select = document.getElementById('garantia-transportadora');
                if (select && data.transportadoras) {
                    data.transportadoras.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.nomeFantasia || t.razaoSocial || t.nome;
                        opt.text = t.nomeFantasia || t.razaoSocial || t.nome;
                        select.appendChild(opt);
                    });
                }
            })
            .catch(err => console.error("Erro ao carregar transportadoras", err));

        if (_btnBackFromForm) _btnBackFromForm.onclick = checkCloseForm;`;
js = js.replace(bindEventsRegex, bindEventsCode);

// 2. Preencher no _openEditPedidoForm
const openEditRegex = /const titleEl = document\.querySelector\('#garantia-form-header h1'\);/;
const openEditCode = `
        // Preencher Envio
        const chkEnvio = document.getElementById('garantia-possui-envio');
        const contEnvio = document.getElementById('garantia-envio-container');
        if (chkEnvio) {
            const hasEnvio = pedido.transportadora || pedido.volume || pedido.cep || pedido.cidade || pedido.bairro;
            chkEnvio.checked = !!hasEnvio;
            if (hasEnvio && contEnvio) contEnvio.classList.remove('hidden');
            else if (contEnvio) contEnvio.classList.add('hidden');
            
            document.getElementById('garantia-transportadora').value = pedido.transportadora || '';
            document.getElementById('garantia-volume').value = pedido.volume || '';
            document.getElementById('garantia-cep').value = pedido.cep || '';
            document.getElementById('garantia-endereco').value = pedido.endereco || '';
            document.getElementById('garantia-numero-envio').value = pedido.numeroEndereco || pedido.numero || '';
            document.getElementById('garantia-complemento').value = pedido.complemento || '';
            document.getElementById('garantia-bairro').value = pedido.bairro || '';
            document.getElementById('garantia-cidade').value = pedido.cidade || '';
            document.getElementById('garantia-estado').value = pedido.estado || '';
        }

        const titleEl = document.querySelector('#garantia-form-header h1');`;
js = js.replace(openEditRegex, openEditCode);

// 3. Reset form
const resetRegex = /_itemsEmpty = document\.getElementById\('garantia-items-empty'\);/;
const resetCode = `_itemsEmpty = document.getElementById('garantia-items-empty');
        
        const chk = document.getElementById('garantia-possui-envio');
        if (chk) chk.checked = false;
        const cont = document.getElementById('garantia-envio-container');
        if (cont) cont.classList.add('hidden');
        ['garantia-transportadora', 'garantia-volume', 'garantia-cep', 'garantia-endereco', 'garantia-numero-envio', 'garantia-complemento', 'garantia-bairro', 'garantia-cidade', 'garantia-estado'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });`;
js = js.replace(resetRegex, resetCode);

// 4. Payload submit
const payloadRegex = /observacoes: item\.observacaoItem \|\| ''\s*\}\)\)/;
const payloadCode = `observacoes: item.observacaoItem || ''
                    }))
            };

            // Cálculo do pesoTotal baseado nos itens atuais
            let totalPesoCalc = 0;
            _currentOrderItems.forEach(i => {
                let pPeso = 0;
                if (window._allProducts) {
                    const pr = window._allProducts.find(p => String(p.codigo || '').trim() === String(i.id || i.cod).trim());
                    if (pr) pPeso = parseFloat(pr.pesoBruto || pr.peso || 0);
                }
                totalPesoCalc += (parseFloat(i.peso || i.pesoBruto || pPeso || 0) * parseInt(i.qtd || 1));
            });
            payload.pesoTotal = totalPesoCalc;

            const chkE = document.getElementById('garantia-possui-envio');
            if (chkE && chkE.checked) {
                payload.transportadora = document.getElementById('garantia-transportadora').value.trim();
                payload.volume = document.getElementById('garantia-volume').value.trim();
                payload.cep = document.getElementById('garantia-cep').value.trim();
                payload.endereco = document.getElementById('garantia-endereco').value.trim();
                payload.numero = document.getElementById('garantia-numero-envio').value.trim();
                payload.complemento = document.getElementById('garantia-complemento').value.trim();
                payload.bairro = document.getElementById('garantia-bairro').value.trim();
                payload.cidade = document.getElementById('garantia-cidade').value.trim();
                payload.estado = document.getElementById('garantia-estado').value.trim();
            } else {
                payload.transportadora = '';
                payload.volume = '';
                payload.cep = '';
                payload.endereco = '';
                payload.numero = '';
                payload.complemento = '';
                payload.bairro = '';
                payload.cidade = '';
                payload.estado = '';
            }`;
js = js.replace(payloadRegex, payloadCode);

// Fallback das URLs de API
const fallbackUrlRegex = /const API_URLS = \{/;
const fallbackUrlCode = `const API_URLS = {
        TRANSPORTADORAS: window.API_BASE_URL + '/transportadoras',`;
js = js.replace(fallbackUrlRegex, fallbackUrlCode);


fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS do frontend configurado para os campos de envio!');
