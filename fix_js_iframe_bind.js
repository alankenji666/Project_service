const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const bindRegex = /if \(_btnShowForm\) _btnShowForm\.onclick = \(\) => \{/;
const replacement = `
        const btnNovaSatgManual = document.getElementById('btn-nova-satg-manual');
        const iframeModal = document.getElementById('satg-iframe-modal');
        const closeIframeBtn = document.getElementById('close-iframe-modal-btn');
        const iframe = document.getElementById('satg-form-iframe');
        const iframeLoader = document.getElementById('satg-iframe-loader');

        if (btnNovaSatgManual) {
            btnNovaSatgManual.onclick = () => {
                iframeModal.classList.remove('hidden');
                iframe.src = "https://project-service-3fkn.vercel.app";
                iframe.onload = () => {
                    iframe.classList.remove('opacity-0');
                    if (iframeLoader) iframeLoader.classList.add('hidden');
                };
            };
        }

        if (closeIframeBtn) {
            closeIframeBtn.onclick = () => {
                iframeModal.classList.add('hidden');
                iframe.src = "about:blank"; 
                iframe.classList.add('opacity-0');
                if (iframeLoader) iframeLoader.classList.remove('hidden');
                _fetchSatGData();
            };
        }

        if (_btnShowForm) _btnShowForm.onclick = () => {`;

js = js.replace(bindRegex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Lógica do Modal Iframe injetada no bindEvents!');
