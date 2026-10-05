const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /<div class="grid">\s*<div class="field" style="flex: 2;">\s*<span class="field-label">Cliente \/ Empresa<\/span>\s*<span class="field-value">\$\{req\.cliente \|\| '-'\}.*?<\/div>/s;

const newHTML = `<div class="grid">
                        <div class="field" style="flex: 0.5;">
                            <span class="field-label">Cód. Cliente</span>
                            <span class="field-value">\${req.codigoCliente || '-'}</span>
                        </div>
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Cliente / Empresa</span>
                            <span class="field-value">\${req.cliente || '-'}</span>
                        </div>`;

js = js.replace(regex, newHTML);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Impressão SAT-G atualizada!');
