const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetHtml = `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-2">
                                <p class="text-gray-500 text-xs font-semibold uppercase mb-1">Cliente / Empresa</p>
                                <p class="font-bold text-gray-800" id="satg-modal-cliente">-</p>
                            </div>`;

const newHtml = `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-1">
                                <p class="text-gray-500 text-xs font-semibold uppercase mb-1">Cód. Cliente</p>
                                <p class="font-bold text-gray-800 flex items-center" id="satg-modal-codcliente">-</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-1">
                                <p class="text-gray-500 text-xs font-semibold uppercase mb-1">Cliente / Empresa</p>
                                <p class="font-bold text-gray-800" id="satg-modal-cliente">-</p>
                            </div>`;

html = html.replace(targetHtml, newHtml);

// Also need to add codcliente to the order form (where we create the new Orçamento)
const formTargetHtml = `<div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Nome do Cliente / Empresa</label>
                                <input type="text" id="garantia-cliente" required class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Ex: João da Silva">
                            </div>`;

const formNewHtml = `<div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Cód. Cliente</label>
                                <input type="text" id="garantia-codcliente" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Ex: 123456">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Nome do Cliente / Empresa</label>
                                <input type="text" id="garantia-cliente" required class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Ex: João da Silva">
                            </div>`;

// Wait, the order form grid is grid-cols-1 md:grid-cols-2. If I add another field, I should probably make it grid-cols-1 md:grid-cols-3 or adjust colspan.
// Let's replace the grid div entirely.
const fullGridTarget = `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Nome do Cliente / Empresa</label>
                                <input type="text" id="garantia-cliente" required class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Ex: João da Silva">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">CPF / CNPJ</label>
                                <input type="text" id="garantia-cpf-cnpj" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Opcional">
                            </div>
                        </div>`;

const fullGridNew = `<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Cód. Cliente</label>
                                <input type="text" id="garantia-codcliente" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Ex: 12345">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Nome do Cliente / Empresa</label>
                                <input type="text" id="garantia-cliente" required class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Ex: João da Silva">
                            </div>
                            <div class="md:col-span-3">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">CPF / CNPJ</label>
                                <input type="text" id="garantia-cpf-cnpj" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Opcional">
                            </div>
                        </div>`;

html = html.replace(fullGridTarget, fullGridNew);
fs.writeFileSync('index.html', html);
console.log('index.html atualizado');
