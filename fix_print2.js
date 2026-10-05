const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /<div class="section-title">Dados do Cliente<\/div>\s*<div class="grid">\s*<div class="field" style="flex: 0\.5;">\s*<span class="field-label">Cód\. Cliente<\/span>\s*<span class="field-value">\$\{req\.codigoCliente \|\| '-'}<\/span>\s*<\/div>\s*<div class="field" style="flex: 2;">/g;

const newBlock = `<div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Dados do Cliente</span>
                        <span style="font-size: 11px; font-weight: normal; color: #4b5563; text-transform: uppercase;">Cód. Cliente: <b style="color: #111827;">\${req.codigoCliente || '-'}</b></span>
                    </div>
                    <div class="grid">
                        <div class="field" style="flex: 2;">`;

js = js.replace(regex, newBlock);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Impressão SAT-G ajustada para ganhar espaço!');
