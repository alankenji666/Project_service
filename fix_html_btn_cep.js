const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<label class="block text-xs font-semibold text-gray-700 mb-1">CEP<\/label>\s*<input type="text" id="garantia-cep" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">/g;

const replacement = `<label class="block text-xs font-semibold text-gray-700 mb-1">CEP</label>
                                        <div class="relative">
                                            <input type="text" id="garantia-cep" class="w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                            <button type="button" id="btn-search-cep" class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-blue-500 focus:outline-none transition-colors" title="Buscar CEP">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                            </button>
                                        </div>`;

html = html.replace(regex, replacement);
fs.writeFileSync('index.html', html);
console.log('Botão de busca de CEP injetado no HTML!');
