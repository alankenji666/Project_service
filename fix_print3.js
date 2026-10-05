const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /<div class="grid">\s*<div class="field" style="flex: 2;">\s*<span class="field-label">Cliente \/ Empresa<\/span>\s*<span class="field-value">\$\{req\.cliente \|\| '-'}<\/span>\s*<\/div>\s*<div class="field">\s*<span class="field-label">CPF \/ CNPJ<\/span>\s*<span class="field-value">\$\{req\.cpf \|\| '-'}<\/span>\s*<\/div>\s*<\/div>\s*<div class="grid" style="margin-top: 15px;">\s*<div class="field">\s*<span class="field-label">Telefone \/ WhatsApp<\/span>\s*<span class="field-value">\$\{req\.telefone \|\| '-'}<\/span>\s*<\/div>\s*<div class="field">\s*<span class="field-label">E-mail<\/span>\s*<span class="field-value">\$\{req\.email \|\| '-'}<\/span>\s*<\/div>\s*<\/div>/g;

const newBlock = `<div class="grid" style="margin-bottom: 15px;">
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Cliente / Empresa</span>
                            <span class="field-value">\${req.cliente || '-'}</span>
                        </div>
                    </div>
                    <div class="grid">
                        <div class="field" style="flex: 1; min-width: 140px;">
                            <span class="field-label">CPF / CNPJ</span>
                            <span class="field-value">\${req.cpf || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1; min-width: 140px;">
                            <span class="field-label">Telefone / WhatsApp</span>
                            <span class="field-value">\${req.telefone || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1.5; min-width: 150px;">
                            <span class="field-label">E-mail</span>
                            <span class="field-value">\${req.email || '-'}</span>
                        </div>
                    </div>`;

js = js.replace(regex, newBlock);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Impressão ajustada com CPF, Tel e Email na mesma linha!');
