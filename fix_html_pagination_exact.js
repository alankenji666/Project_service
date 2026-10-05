const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldPagination = `<div class="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-lg mb-3 border border-gray-100">
                            <span class="text-xs text-gray-500 font-medium" id="garantia-pecas-pagination-info">Mostrando 0 a 0 de 0 itens</span>
                            <div class="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm">
                                <button type="button" id="garantia-pecas-prev-btn" class="px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                                </button>
                                <span class="px-3 py-1 text-[11px] font-bold text-gray-700 border-x border-gray-200 bg-gray-50" id="garantia-pecas-page-text">Página 1 de 1</span>
                                <button type="button" id="garantia-pecas-next-btn" class="px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                            </div>
                        </div>`;

const newPagination = `<div class="mb-4 flex items-center justify-between bg-gray-50 px-4 py-3 sm:px-6 rounded-lg border border-gray-200" id="garantia-pagination-wrapper">
                            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                <div>
                                    <p class="text-sm text-gray-700" id="garantia-pecas-pagination-info">
                                        Mostrando <span class="font-bold">0</span> a <span class="font-bold">0</span> de <span class="font-bold">0</span> itens
                                    </p>
                                </div>
                                <div>
                                    <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                        <button id="garantia-pecas-prev-btn" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <span class="sr-only">Anterior</span>
                                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
                                        </button>
                                        <span id="garantia-pecas-page-text" class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">Página 1 de 1</span>
                                        <button id="garantia-pecas-next-btn" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <span class="sr-only">Próximo</span>
                                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>`;

html = html.replace(oldPagination, newPagination);

const oldHeader = `<thead class="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                    <tr class="border-b-2 border-gray-100">
                                        <th class="px-4 py-3 font-bold">Produto / Peça</th>
                                        <th class="px-4 py-3 font-bold text-center">Quantidade</th>
                                        <th class="px-4 py-3 font-bold text-right">Custo Total</th>
                                    </tr>
                                </thead>`;

const newHeader = `<thead class="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                    <tr class="border-b-2 border-gray-100">
                                        <th class="px-4 py-3 font-semibold text-left">PRODUTO / PEÇA</th>
                                        <th class="px-4 py-3 font-semibold text-center">QUANTIDADE USADA</th>
                                        <th class="px-4 py-3 font-semibold text-right">CUSTO TOTAL</th>
                                    </tr>
                                </thead>`;

html = html.replace(oldHeader, newHeader);

fs.writeFileSync('index.html', html);
console.log('HTML Pagination and headers updated perfectly!');
