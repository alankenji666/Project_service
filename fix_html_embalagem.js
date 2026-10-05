const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="md:col-span-3">\s*<label class="block text-xs font-semibold text-gray-700 mb-1">Valor Frete<\/label>\s*<input type="text" id="garantia-valor-frete" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R\$ 0,00">\s*<\/div>/;

const replacement = `<div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Valor Frete</label>
                                        <input type="text" id="garantia-valor-frete" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00">
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Tipo Embalagem</label>
                                        <select id="garantia-tipo-embalagem" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                            <option value="">Selecione...</option>
                                            <option value="Caixa">Caixa</option>
                                            <option value="Palet">Palet</option>
                                            <option value="Nenhuma">Nenhuma</option>
                                        </select>
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Altura (m)</label>
                                        <input type="text" id="garantia-altura" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 0.50">
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Largura (m)</label>
                                        <input type="text" id="garantia-largura" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 1.20">
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Comprimento (m)</label>
                                        <input type="text" id="garantia-comprimento" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 0.30">
                                    </div>`;

html = html.replace(regex, replacement);
fs.writeFileSync('index.html', html);
console.log('HTML atualizado com os novos campos de embalagem!');
