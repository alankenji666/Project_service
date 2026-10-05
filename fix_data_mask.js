const fs = require('fs');

let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Adicionar lógica da máscara de data no _openCustomPrompt
const searchMaskLogic = `} else if (type === 'telefone') {`;
const replaceMaskLogic = `} else if (type === 'data') {
                    let digits = v.replace(/\\D/g, "").substring(0, 8);
                    if (digits.length <= 2) {
                        v = digits;
                    } else if (digits.length <= 4) {
                        v = digits.substring(0, 2) + '/' + digits.substring(2);
                    } else {
                        v = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
                    }
                    e.target.value = v;
                } else if (type === 'telefone') {`;

if (js.includes(searchMaskLogic)) {
    js = js.replace(searchMaskLogic, replaceMaskLogic);
}

// 2. Passar 'data' no parâmetro type nas chamadas do injectEditPencil para campos de data
js = js.replace(/injectEditPencil\('satg-modal-data-compra', 'N', 'dataCompra', req\.dataCompra\);/g, "injectEditPencil('satg-modal-data-compra', 'N', 'dataCompra', req.dataCompra, 'data');");
js = js.replace(/injectEditPencil\('satg-modal-entrega', 'O', 'dataEntregaTecnica', req\.dataEntregaTecnica\);/g, "injectEditPencil('satg-modal-entrega', 'O', 'dataEntregaTecnica', req.dataEntregaTecnica, 'data');");
js = js.replace(/injectEditPencil\('satg-modal-parada', 'S', 'dataParada', req\.dataParada\);/g, "injectEditPencil('satg-modal-parada', 'S', 'dataParada', req.dataParada, 'data');");
js = js.replace(/injectEditPencil\('satg-modal-preventiva', 'T', 'ultimaPreventiva', req\.ultimaPreventiva\);/g, "injectEditPencil('satg-modal-preventiva', 'T', 'ultimaPreventiva', req.ultimaPreventiva, 'data');");

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Máscara de data adicionada e aplicada aos campos!');
