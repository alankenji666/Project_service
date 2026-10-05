const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// _resetGarantiaForm
const resetRegex = /'garantia-complemento', 'garantia-bairro', 'garantia-cidade', 'garantia-estado', 'garantia-valor-frete'\]\.forEach/;
js = js.replace(resetRegex, "'garantia-complemento', 'garantia-bairro', 'garantia-cidade', 'garantia-estado', 'garantia-valor-frete', 'garantia-peso-total'].forEach");

// _openEditPedidoForm
const openEditRegex = /document\.getElementById\('garantia-valor-frete'\)\.value = pedido\.valorFrete \|\| '';/;
const openEditNew = `document.getElementById('garantia-valor-frete').value = pedido.valorFrete || '';
            document.getElementById('garantia-peso-total').value = pedido.pesoTotal || '';`;
js = js.replace(openEditRegex, openEditNew);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS atualizado para Peso Total visível!');
