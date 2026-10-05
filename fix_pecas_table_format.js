const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

const targetStr = `        pecasList.innerHTML = pageData.map(data => \`
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                    <div class="font-bold text-gray-800 text-sm">\${data.descricao}</div>
                    <div class="text-xs font-semibold text-gray-400 mt-0.5">\${data.codigo}</div>
                </td>
                <td class="px-4 py-3 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">\${data.qtd} un</span></td>
                <td class="px-4 py-3 text-right font-bold text-blue-600">\${fmtBRL(data.custo)}</td>
            </tr>
        \`).join('');`;

const replaceStr = `        pecasList.innerHTML = pageData.map(data => \`
            <tr class="hover:bg-orange-50 transition-colors">
                <td class="px-4 py-3">
                    <div class="font-bold text-gray-800 text-sm">\${data.descricao}</div>
                    <div class="text-[10px] text-gray-400 font-mono mt-0.5">\${data.codigo}</div>
                </td>
                <td class="px-4 py-3 text-center text-sm font-bold text-gray-800">\${data.qtd}</td>
                <td class="px-4 py-3 text-right font-bold text-blue-600">\${fmtBRL(data.custo)}</td>
            </tr>
        \`).join('');`;

js = js.replace(targetStr, replaceStr);
fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('Modified row format');
