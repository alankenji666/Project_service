const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /const btnCloseSatgModal = document\.getElementById\('btn-close-satg-modal'\);/;
const replacement = `const btnCloseSatgModal = document.getElementById('btn-close-satg-modal');
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
                iframe.src = "about:blank"; // descarrega
                iframe.classList.add('opacity-0');
                if (iframeLoader) iframeLoader.classList.remove('hidden');
                // Recarrega a tabela para buscar possivel sat-g nova criada
                _fetchSatgData();
            };
        }`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Lógica do Modal Iframe injetada com sucesso!');
