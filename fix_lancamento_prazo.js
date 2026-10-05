const fs = require('fs');

let js = fs.readFileSync('js/main.js', 'utf8');

const regexFabrica = /const confirmationMessage = `Confirmar lançamento de <b>\$\{itemsToLaunch\.length\}<\/b> itens\?<br><br>Requisição <b>\$\{type\.toUpperCase\(\)\}<\/b> com o código <b>\$\{requisitionCode\}<\/b>\.`;\s*const confirmed = await _showConfirmationModal\("Confirmar Lançamento", confirmationMessage\);\s*if \(!confirmed\) return;\s*\/\/ Se confirmado, executa o lançamento\.\s*_executeLaunch\(type, requisitionCode, itemsToLaunch\);/g;

const replacementFabrica = `const confirmationMessage = \`Confirmar lançamento de <b>\${itemsToLaunch.length}</b> itens?<br><br>Requisição <b>\${type.toUpperCase()}</b> com o código <b>\${requisitionCode}</b>.<br><br>
                    <div class="text-left mt-4 border-t pt-4">
                        <label class="text-sm font-semibold text-gray-700 block mb-1">Prazo de Entrega (dias):</label>
                        <input type="number" id="prazo-entrega-input" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value="15" min="0">
                    </div>\`;
                    const confirmed = await _showConfirmationModal("Confirmar Lançamento", confirmationMessage);
                    if (!confirmed) return;

                    const prazoInput = document.getElementById('prazo-entrega-input');
                    const prazoEntregaVal = prazoInput ? prazoInput.value : '15';
                    itemsToLaunch.forEach(item => item.prazoEntrega = prazoEntregaVal);

                    // Se confirmado, executa o lançamento.
                    _executeLaunch(type, requisitionCode, itemsToLaunch);`;

js = js.replace(regexFabrica, replacementFabrica);

const regexTerceiros = /const confirmationMessage = `Confirmar lançamento de <b>\$\{itemsToLaunch\.length\}<\/b> itens\?<br><br>Requisição <b>TERCEIROS<\/b> com o código <b>\$\{requisitionCode\}<\/b>\.`;\s*const confirmed = await _showConfirmationModal\("Confirmar Lançamento", confirmationMessage\);\s*if \(!confirmed\) return;\s*\/\/ Se confirmado, executa o lançamento\.\s*_executeLaunch\('terceiros', requisitionCode, itemsToLaunch\);/g;

const replacementTerceiros = `const confirmationMessage = \`Confirmar lançamento de <b>\${itemsToLaunch.length}</b> itens?<br><br>Requisição <b>TERCEIROS</b> com o código <b>\${requisitionCode}</b>.<br><br>
                    <div class="text-left mt-4 border-t pt-4">
                        <label class="text-sm font-semibold text-gray-700 block mb-1">Prazo de Entrega (dias):</label>
                        <input type="number" id="prazo-entrega-input" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value="15" min="0">
                    </div>\`;
                const confirmed = await _showConfirmationModal("Confirmar Lançamento", confirmationMessage);
                if (!confirmed) return;

                const prazoInput = document.getElementById('prazo-entrega-input');
                const prazoEntregaVal = prazoInput ? prazoInput.value : '15';
                itemsToLaunch.forEach(item => item.prazoEntrega = prazoEntregaVal);

                // Se confirmado, executa o lançamento.
                _executeLaunch('terceiros', requisitionCode, itemsToLaunch);`;

js = js.replace(regexTerceiros, replacementTerceiros);

fs.writeFileSync('js/main.js', js);
console.log('Script aplicado em main.js para input de prazo de entrega!');
