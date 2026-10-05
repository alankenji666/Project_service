const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace('if (observacao !== undefined) payload.observacao = observacao;\\n        const elAcaoPecas = document.getElementById(\\x27satg-modal-acao-pecas\\x27);\\n        if (elAcaoPecas) payload.acaoPecas = elAcaoPecas.value.trim();',
`if (observacao !== undefined) payload.observacao = observacao;
        const elAcaoPecas = document.getElementById('satg-modal-acao-pecas');
        if (elAcaoPecas) payload.acaoPecas = elAcaoPecas.value.trim();`);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Fixed syntax');
