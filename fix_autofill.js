const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /fetch\(API_URLS\.TRANSPORTADORAS \|\| \(window\.API_BASE_URL \+ '\/transportadoras'\)\)[\s\S]*?\.catch\(err => console\.error\("Erro ao carregar transportadoras", err\)\);/s;

const newFetch = `
        let _listaTransportadoras = [];
        fetch(API_URLS.TRANSPORTADORAS || (window.API_BASE_URL + '/transportadoras'))
            .then(res => res.ok ? res.json() : {transportadoras:[]})
            .then(data => {
                const select = document.getElementById('garantia-transportadora');
                if (select && data.transportadoras) {
                    _listaTransportadoras = data.transportadoras;
                    data.transportadoras.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.nomeFantasia || t.razaoSocial || t.nome;
                        opt.text = t.nomeFantasia || t.razaoSocial || t.nome;
                        select.appendChild(opt);
                    });
                    
                    // Auto-fill upon selection
                    select.addEventListener('change', (e) => {
                        const tName = e.target.value;
                        const tData = _listaTransportadoras.find(x => (x.nomeFantasia || x.razaoSocial || x.nome) === tName);
                        if (tData) {
                            if (document.getElementById('garantia-endereco') && !document.getElementById('garantia-endereco').value) document.getElementById('garantia-endereco').value = tData.endereco || '';
                            if (document.getElementById('garantia-numero-envio') && !document.getElementById('garantia-numero-envio').value) document.getElementById('garantia-numero-envio').value = tData.numero || '';
                            if (document.getElementById('garantia-cep') && !document.getElementById('garantia-cep').value) document.getElementById('garantia-cep').value = tData.cep || '';
                            if (document.getElementById('garantia-bairro') && !document.getElementById('garantia-bairro').value) document.getElementById('garantia-bairro').value = tData.bairro || '';
                            if (document.getElementById('garantia-cidade') && !document.getElementById('garantia-cidade').value) document.getElementById('garantia-cidade').value = tData.cidade || '';
                            if (document.getElementById('garantia-estado') && !document.getElementById('garantia-estado').value) document.getElementById('garantia-estado').value = tData.uf || tData.estado || '';
                        }
                    });
                }
            })
            .catch(err => console.error("Erro ao carregar transportadoras", err));`;

js = js.replace(regex, newFetch);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Fetch de transportadoras ajustado para auto-fill!');
