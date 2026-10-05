const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetHeader = `<thead class="text-xs text-gray-400 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-3 font-semibold">Produto / Peça</th>
                                        <th class="px-4 py-3 font-semibold text-center">Quantidade Usada</th>
                                        <th class="px-4 py-3 font-semibold text-right">Custo Total</th>
                                    </tr>
                                </thead>`;

const replaceHeader = `<thead class="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                    <tr class="border-b-2 border-gray-100">
                                        <th class="px-4 py-3 font-bold">Produto / Peça</th>
                                        <th class="px-4 py-3 font-bold text-center">Quantidade</th>
                                        <th class="px-4 py-3 font-bold text-right">Custo Total</th>
                                    </tr>
                                </thead>`;

html = html.replace(targetHeader, replaceHeader);
fs.writeFileSync('index.html', html);
console.log('HTML header updated!');
