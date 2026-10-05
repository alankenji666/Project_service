const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="md:col-span-6">\s*<label class="block text-xs font-semibold text-gray-700 mb-1">Transportadora<\/label>\s*<select id="garantia-transportadora"[\s\S]*?<\/select>\s*<\/div>\s*<div class="md:col-span-3">\s*<label class="block text-xs font-semibold text-gray-700 mb-1">Volume<\/label>\s*<input type="text" id="garantia-volume"[\s\S]*?<\/div>\s*<div class="md:col-span-3">\s*<label class="block text-xs font-semibold text-gray-700 mb-1">Valor Frete<\/label>\s*<input type="text" id="garantia-valor-frete"[\s\S]*?<\/div>/;

const replacement = `<div class="md:col-span-5">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Transportadora</label>
                                        <select id="garantia-transportadora" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                            <option value="">Selecione...</option>
                                        </select>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Volume</label>
                                        <input type="text" id="garantia-volume" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 2">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Peso Total (kg)</label>
                                        <input type="text" id="garantia-peso-total" class="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed focus:outline-none" readonly title="Calculado automaticamente baseado nos produtos" placeholder="Auto">
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Valor Frete</label>
                                        <input type="text" id="garantia-valor-frete" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00">
                                    </div>`;

html = html.replace(regex, replacement);
fs.writeFileSync('index.html', html);
console.log('HTML atualizado com Peso Total!');
