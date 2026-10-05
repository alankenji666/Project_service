const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. _resetGarantiaForm
const resetRegex = /'garantia-complemento', 'garantia-bairro', 'garantia-cidade', 'garantia-estado', 'garantia-valor-frete', 'garantia-peso-total'\]\.forEach/;
js = js.replace(resetRegex, "'garantia-complemento', 'garantia-bairro', 'garantia-cidade', 'garantia-estado', 'garantia-valor-frete', 'garantia-peso-total', 'garantia-tipo-embalagem', 'garantia-altura', 'garantia-largura', 'garantia-comprimento'].forEach");

// 2. _submitGarantiaPedido - Validation
const validRegex = /const requiredFields = \[([\s\S]*?)\];/;
const validRepl = `let requiredFields = [$1, { id: 'garantia-tipo-embalagem', name: 'Tipo Embalagem' }];
            const tipoEmbEl = document.getElementById('garantia-tipo-embalagem');
            if (tipoEmbEl && tipoEmbEl.value && tipoEmbEl.value !== 'Nenhuma') {
                requiredFields.push({ id: 'garantia-altura', name: 'Altura (m)' });
                requiredFields.push({ id: 'garantia-largura', name: 'Largura (m)' });
                requiredFields.push({ id: 'garantia-comprimento', name: 'Comprimento (m)' });
            }`;
js = js.replace(validRegex, validRepl);

// 3. payload embalagem
const payloadRegex = /payload\.estado = document\.getElementById\('garantia-estado'\)\.value\.trim\(\);/;
const payloadRepl = `payload.estado = document.getElementById('garantia-estado').value.trim();
                
                const tEmb = document.getElementById('garantia-tipo-embalagem').value.trim();
                const alt = document.getElementById('garantia-altura').value.trim();
                const larg = document.getElementById('garantia-largura').value.trim();
                const comp = document.getElementById('garantia-comprimento').value.trim();
                payload.embalagem = (tEmb && tEmb !== 'Nenhuma') ? \`\${tEmb}/\${alt}/\${larg}/\${comp}\` : tEmb;`;
js = js.replace(payloadRegex, payloadRepl);

// 4. payload clear embalagem
const clearRegex = /payload\.estado = '';/;
const clearRepl = `payload.estado = '';
                payload.embalagem = '';`;
js = js.replace(clearRegex, clearRepl);

// 5. _openEditPedidoForm parsing
const openRegex = /document\.getElementById\('garantia-estado'\)\.value = pedido\.estado \|\| '';/;
const openRepl = `document.getElementById('garantia-estado').value = pedido.estado || '';
            
            if (pedido.embalagem) {
                const parts = pedido.embalagem.split('/');
                document.getElementById('garantia-tipo-embalagem').value = parts[0] || '';
                if (parts.length > 1) {
                    document.getElementById('garantia-altura').value = parts[1] || '';
                    document.getElementById('garantia-largura').value = parts[2] || '';
                    document.getElementById('garantia-comprimento').value = parts[3] || '';
                } else {
                    document.getElementById('garantia-altura').value = '';
                    document.getElementById('garantia-largura').value = '';
                    document.getElementById('garantia-comprimento').value = '';
                }
            } else {
                document.getElementById('garantia-tipo-embalagem').value = '';
                document.getElementById('garantia-altura').value = '';
                document.getElementById('garantia-largura').value = '';
                document.getElementById('garantia-comprimento').value = '';
            }`;
js = js.replace(openRegex, openRepl);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS atualizado para suportar Embalagem e Dimensões!');
