const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

const targetInfoStr = "if (info) info.innerText = `Mostrando ${totalItems === 0 ? 0 : startIndex + 1} a ${endIndex} de ${totalItems} itens`;";
const replaceInfoStr = "if (info) info.innerHTML = `Mostrando <span class=\"font-bold\">\${totalItems === 0 ? 0 : startIndex + 1}</span> a <span class=\"font-bold\">\${endIndex}</span> de <span class=\"font-bold\">\${totalItems}</span> itens`;";

js = js.replace(targetInfoStr, replaceInfoStr);

// We should also replace the hover color back to gray-50 to match the first screen's row highlight (which the user pointed out is not orange). 
// The user said "E outra quantidade não precisa estar assim , pode ser normal , e ao passar o mouse também sobre a linha ele pode ser a mesma cor."
// The first image has "Todos os Itens - Geral".
const targetRow = `<tr class="hover:bg-orange-50 transition-colors">
                <td class="px-4 py-3">`;
const replaceRow = `<tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">`;

js = js.replace(targetRow, replaceRow);

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('JS string info updated!');
