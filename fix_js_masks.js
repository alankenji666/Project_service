const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Add _setupMasks call in init()
const initRegex = /render\(\); \/\/ Pré-carrega a tabela\s*\}/;
const initRepl = `render(); // Pré-carrega a tabela
        _setupMasks();
    }`;
js = js.replace(initRegex, initRepl);

// 2. Add _setupMasks function and formatMoneyBR definition
const setupMasks = `
    function formatMoneyBR(value) {
        if (!value) return '';
        let v = String(value).replace(/\\D/g, '');
        if (!v) return '';
        v = (parseInt(v, 10) / 100).toFixed(2);
        return 'R$ ' + v.replace('.', ',').replace(/(\\d)(?=(\\d{3})+(?!\\d))/g, '$1.');
    }

    function _setupMasks() {
        const cepInput = document.getElementById('garantia-cep');
        if (cepInput) {
            cepInput.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\\D/g, '');
                if (v.length > 8) v = v.slice(0, 8);
                if (v.length > 5) v = v.replace(/^(\\d{5})(\\d)/, '$1-$2');
                e.target.value = v;
            });
        }
    
        const freteInput = document.getElementById('garantia-valor-frete');
        if (freteInput) {
            freteInput.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\\D/g, '');
                if (v === '') {
                    e.target.value = '';
                    return;
                }
                v = (parseInt(v, 10) / 100).toFixed(2);
                e.target.value = 'R$ ' + v.replace('.', ',').replace(/(\\d)(?=(\\d{3})+(?!\\d))/g, '$1.');
            });
        }
    }

    /**
     * Busca os elementos no DOM
`;
const cacheDomRegex = /\/\*\*\s*\*\s*Busca os elementos no DOM/;
js = js.replace(cacheDomRegex, setupMasks);

// 3. Format field on openEditPedidoForm
const editRegex = /document\.getElementById\('garantia-valor-frete'\)\.value = pedido\.valorFrete \|\| '';/;
const editRepl = `document.getElementById('garantia-valor-frete').value = formatMoneyBR(pedido.valorFrete) || '';`;
js = js.replace(editRegex, editRepl);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Script ajustado com as mascaras para CEP e Valor Frete!');
