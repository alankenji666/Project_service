const fs = require('fs');
const file = 'js/modulos/pesquisarProduto.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Substituir a renderização inicial
const search1 = '<p class="text-lg text-gray-800 font-semibold product-detail-weight">${product.pesoBruto || product.metricas?.peso_bruto || 0}</p>';
const replace1 = '<p class="text-lg text-gray-800 font-semibold product-detail-weight">${parseFloat(product.pesoBruto || product.metricas?.peso_bruto || 0).toLocaleString(\'pt-BR\', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>';

content = content.replace(search1, replace1);

// 2. Substituir a atualização após edição
const search2 = 'weightElement.textContent = novoPesoBruto || 0;';
const replace2 = 'weightElement.textContent = parseFloat(novoPesoBruto || 0).toLocaleString(\'pt-BR\', { minimumFractionDigits: 3, maximumFractionDigits: 3 });';

content = content.replace(search2, replace2);

fs.writeFileSync(file, content);
console.log('pesquisarProduto.js atualizado com máscara de peso!');
