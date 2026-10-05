const fs = require('fs');
const file = 'js/modulos/gerenciarGarantia.js';
let content = fs.readFileSync(file, 'utf8');

const target = `<td class="px-4 py-3 text-center">
                    <span class="text-gray-500 font-medium">\${parseFloat(item.peso || 0).toFixed(3)} kg</span>
                </td>`;

const replacement = `<td class="px-4 py-3 text-center group relative">
                    <span class="text-gray-500 font-medium cursor-pointer border-b border-dashed border-gray-400 hover:text-blue-600 transition-colors" title="Editar Peso no Bling" data-edit-weight-id="\${item.id}" data-edit-weight-code="\${item.cod}">\${parseFloat(item.peso || 0).toFixed(3)} kg</span>
                </td>`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log('Success: Replaced in gerenciarGarantia.js');
} else {
    console.log('Error: target not found.');
}
