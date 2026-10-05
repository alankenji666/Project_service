const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The block starts with <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-2">
// and contains id="satg-modal-cliente"
const regexSatgModal = /<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-2">\s*<p class="text-gray-500 text-xs font-semibold uppercase mb-1">Cliente \/ Empresa<\/p>\s*<p class="font-bold text-gray-800" id="satg-modal-cliente">-<\/p>\s*<\/div>/g;

const newSatgModal = `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-1">
                                <p class="text-gray-500 text-xs font-semibold uppercase mb-1">Cód. Cliente</p>
                                <p class="font-bold text-gray-800" id="satg-modal-codcliente">-</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 md:col-span-1">
                                <p class="text-gray-500 text-xs font-semibold uppercase mb-1">Cliente / Empresa</p>
                                <p class="font-bold text-gray-800" id="satg-modal-cliente">-</p>
                            </div>`;

html = html.replace(regexSatgModal, newSatgModal);

// Now for the Orçamento modal form:
const regexForm = /<div class="grid grid-cols-1 md:grid-cols-2 gap-6">\s*<div>\s*<label class="block text-sm font-semibold text-gray-700 mb-2">Nome do Cliente \/ Empresa<\/label>\s*<input type="text" id="garantia-cliente".*?<\/div>\s*<div>\s*<label class="block text-sm font-semibold text-gray-700 mb-2">CPF \/ CNPJ<\/label>\s*<input type="text" id="garantia-cpf-cnpj".*?<\/div>\s*<\/div>/gs;

const newForm = `<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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

html = html.replace(regexForm, newForm);

fs.writeFileSync('index.html', html);
console.log('index.html atualizado!');
