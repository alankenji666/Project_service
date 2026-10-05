const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetHeader = `<div class="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-4 items-center">
                        
                        <!-- Search -->
                        <div class="relative flex-1 w-full">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input type="text" id="garantia-satg-search-input" class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm transition-all shadow-sm" placeholder="Buscar por código, cliente ou CPF...">
                        </div>

                        <!-- Filtro Dropdown -->
                        <div class="relative w-full sm:w-auto">
                            <button id="btn-satg-filter" type="button" class="inline-flex w-full justify-between items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors sm:w-[140px]">
                                <span id="satg-filter-text">Filtro (1)</span>
                                <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            
                            <div id="satg-filter-dropdown" class="hidden origin-top-right absolute right-0 mt-2 w-64 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-50">
                                <div class="py-2 p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input type="checkbox" class="satg-filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" value="EM ANALISE" checked>
                                        <span class="ml-3 text-sm text-gray-700 font-medium">Em Análise</span>
                                    </label>
                                    <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input type="checkbox" class="satg-filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" value="APROVADO" checked>
                                        <span class="ml-3 text-sm text-gray-700 font-medium">Aprovados</span>
                                    </label>
                                    <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input type="checkbox" class="satg-filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" value="RECUSADO">
                                        <span class="ml-3 text-sm text-gray-700 font-medium">Recusados / Arquivados</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 w-full overflow-x-auto min-h-[450px]">
                        <table class="min-w-full divide-y divide-gray-200" id="satg-table">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Código / Data</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Cliente</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Garantia</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Orçamento</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Retorno Item</th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>`;

const replaceHeader = `<div class="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-4 items-center">
                        <!-- Search -->
                        <div class="relative flex-1 w-full">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input type="text" id="garantia-satg-search-input" class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm transition-all shadow-sm" placeholder="Buscar por código, cliente ou CPF...">
                        </div>

                        <!-- Filtro Dropdown -->
                        <div class="relative w-full sm:w-auto">
                            <button id="btn-satg-filter" type="button" class="inline-flex w-full justify-between items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors sm:w-[140px]">
                                <span id="satg-filter-text">Filtro (1)</span>
                                <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            
                            <div id="satg-filter-dropdown" class="hidden origin-top-right absolute right-0 mt-2 w-64 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-50">
                                <div class="py-2 p-2 space-y-1">
                                    <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input type="checkbox" class="satg-filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" value="EM ANALISE" checked>
                                        <span class="ml-3 text-sm text-gray-700 font-medium">Em Análise</span>
                                    </label>
                                    <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input type="checkbox" class="satg-filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" value="APROVADO" checked>
                                        <span class="ml-3 text-sm text-gray-700 font-medium">Aprovados</span>
                                    </label>
                                    <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input type="checkbox" class="satg-filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" value="RECUSADO">
                                        <span class="ml-3 text-sm text-gray-700 font-medium">Recusados / Arquivados</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="px-4 py-3 bg-white">
                        <div class="flex items-center justify-between bg-gray-50 px-4 py-3 sm:px-6 rounded-lg border border-gray-200" id="satg-pagination-wrapper">
                            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                <div>
                                    <p class="text-sm text-gray-700" id="satg-pagination-info">
                                        Mostrando <span class="font-bold">0</span> a <span class="font-bold">0</span> de <span class="font-bold">0</span> itens
                                    </p>
                                </div>
                                <div>
                                    <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                        <button id="satg-prev-btn" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <span class="sr-only">Anterior</span>
                                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
                                        </button>
                                        <span id="satg-page-text" class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">Página 1 de 1</span>
                                        <button id="satg-next-btn" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <span class="sr-only">Próximo</span>
                                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 w-full overflow-x-auto min-h-[450px]">
                        <table class="min-w-full divide-y divide-gray-200" id="satg-table">
                            <thead class="bg-gray-50 border-b-2 border-gray-100">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">CÓDIGO / DATA</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">CLIENTE</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">GARANTIA</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">ORÇAMENTO</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">RETORNO ITEM</th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">AÇÕES</th>
                                </tr>
                            </thead>`;

html = html.replace(targetHeader, replaceHeader);
fs.writeFileSync('index.html', html);
console.log('HTML pagination added to Triagem SAT-G');
