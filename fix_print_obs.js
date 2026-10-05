const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /<div class="problema-box">\s*<span class="problema-label">Problema Detalhado<\/span>\s*<div style="font-size: 14px; white-space: pre-wrap;">\$\{req\.problema \|\| '-'\}<\/div>\s*<\/div>/g;

const newBlock = `<div class="problema-box">
                        <span class="problema-label">Problema Detalhado</span>
                        <div style="font-size: 14px; white-space: pre-wrap;">\${req.problema || '-'}</div>
                    </div>
                    
                    <div class="problema-box" style="background: #f8fafc; border-color: #cbd5e1; margin-top: 15px;">
                        <span class="problema-label" style="color: #475569;">Avaliação Interna (Constatação do Problema) *</span>
                        <div style="font-size: 14px; white-space: pre-wrap;">\${req.observacao || '-'}</div>
                    </div>`;

js = js.replace(regex, newBlock);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Avaliação interna adicionada na impressão!');
