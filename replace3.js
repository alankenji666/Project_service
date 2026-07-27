const fs = require('fs');
const file = 'js/modulos/gerenciarPedidos.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\r\n/g, '\n');

const target1 = `    const saudacao = \`Bom dia \${primeiroNomeVendedor}\`;`;
const rep1 = `    const hour = new Date().getHours();
    let saudacaoStr = 'Bom dia';
    if (hour >= 12 && hour < 18) saudacaoStr = 'Boa tarde';
    else if (hour >= 18) saudacaoStr = 'Boa noite';
    const saudacao = \`\${saudacaoStr} \${primeiroNomeVendedor}\`;`;

const target2 = `            event.dataTransfer.effectAllowed = 'copy';
        };
    }

    const confirmBtn = document.getElementById('email-danfe-confirm-btn');`;

const rep2 = `            event.dataTransfer.effectAllowed = 'copy';
        };
    }

    const downloadBtn = document.getElementById('email-danfe-download-btn');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            let absoluteUrl = baixarPdfUrl;
            if (absoluteUrl && !absoluteUrl.startsWith('http')) {
                absoluteUrl = API_URLS.WEBHOOK_LAUNCH + (absoluteUrl.startsWith('/') ? absoluteUrl : '/' + absoluteUrl);
            }
            window.open(absoluteUrl, '_blank');
        };
    }

    if (!window.copyToClipboard) {
        window.copyToClipboard = function(elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                el.select();
                document.execCommand('copy');
                if (typeof Toastify !== 'undefined') {
                    Toastify({ text: '✅ Texto copiado!', duration: 2000, gravity: 'bottom', position: 'center', style: { background: '#4f46e5', borderRadius: '8px' } }).showToast();
                }
            }
        };
    }

    const confirmBtn = document.getElementById('email-danfe-confirm-btn');`;

let success = false;
if (content.includes(target1)) {
    content = content.replace(target1, rep1);
    success = true;
}
if (content.includes(target2)) {
    content = content.replace(target2, rep2);
    success = true;
}

if(success) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS');
} else {
    console.log('TARGETS NOT FOUND');
}
