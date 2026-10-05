const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const target = `        const freteInput = document.getElementById('garantia-valor-frete');
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
        }`;

const replacement = `        const freteInput = document.getElementById('garantia-valor-frete');
        if (freteInput) {
            freteInput.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\\D/g, '');
                if (v === '') {
                    e.target.value = '';
                    _updateUITotalValues();
                    return;
                }
                v = (parseInt(v, 10) / 100).toFixed(2);
                e.target.value = 'R$ ' + v.replace('.', ',').replace(/(\\d)(?=(\\d{3})+(?!\\d))/g, '$1.');
                _updateUITotalValues();
            });
        }`;

js = js.replace(target, replacement);
fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Evento de input corrigido!');
