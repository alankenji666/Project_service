const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Remove the auto-fill listener
const autofillRegex = /\/\/ Auto-fill upon selection[\s\S]*?\}\);/g;
js = js.replace(autofillRegex, "");

// 2. Fix the _openEditPedidoForm population for numero-envio
const oldPopulate = /document\.getElementById\('garantia-numero-envio'\)\.value = pedido\.numeroEndereco \|\| pedido\.numero \|\| '';/;
const newPopulate = `document.getElementById('garantia-numero-envio').value = pedido.numeroEndereco || '';`;
js = js.replace(oldPopulate, newPopulate);

// 3. Fix the payload saving
const oldPayload = /payload\.numero = document\.getElementById\('garantia-numero-envio'\)\.value\.trim\(\);/;
const newPayload = `payload.numeroEndereco = document.getElementById('garantia-numero-envio').value.trim();`;
js = js.replace(oldPayload, newPayload);

const oldPayloadEmpty = /payload\.numero = '';/;
const newPayloadEmpty = `payload.numeroEndereco = '';`;
js = js.replace(oldPayloadEmpty, newPayloadEmpty);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Frontend configurado para usar numeroEndereco e não preencher com os dados da transportadora!');
