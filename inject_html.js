const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="border-t border-gray-200 pt-6">\s*<div class="grid grid-cols-1 md:grid-cols-2 gap-6">/s;

const newHTML = `<div class="border-t border-gray-200 pt-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;

const fullReplacement = `<div class="border-t border-gray-200 pt-6 mt-6">
                            <div class="flex items-center gap-3 mb-4">
                                <input type="checkbox" id="garantia-possui-envio" class="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer">
                                <label for="garantia-possui-envio" class="font-semibold text-gray-700 cursor-pointer">Possui Envio?</label>
                            </div>
                            
                            <div id="garantia-envio-container" class="hidden bg-blue-50 p-5 rounded-xl border border-blue-100 mb-6">
                                <h4 class="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4 mb-2">Dados de Envio</h4>
                                <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div class="md:col-span-8">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Transportadora</label>
                                        <select id="garantia-transportadora" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                            <option value="">Selecione...</option>
                                        </select>
                                    </div>
                                    <div class="md:col-span-4">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Volume</label>
                                        <input type="text" id="garantia-volume" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 1 Caixa">
                                    </div>
                                    
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">CEP</label>
                                        <input type="text" id="garantia-cep" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    </div>
                                    <div class="md:col-span-7">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Endereço</label>
                                        <input type="text" id="garantia-endereco" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Número</label>
                                        <input type="text" id="garantia-numero-envio" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    </div>
                                    
                                    <div class="md:col-span-4">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Complemento</label>
                                        <input type="text" id="garantia-complemento" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Bairro</label>
                                        <input type="text" id="garantia-bairro" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    </div>
                                    <div class="md:col-span-3">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Cidade</label>
                                        <input type="text" id="garantia-cidade" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                                        <input type="text" id="garantia-estado" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="UF">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="border-t border-gray-200 pt-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;

html = html.replace(regex, fullReplacement);
fs.writeFileSync('index.html', html);
console.log('HTML fields adicionados');
