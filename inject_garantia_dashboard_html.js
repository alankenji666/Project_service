const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetCard = `                    <div id="select-ranking-dashboard"`;
const replacementCard = `                    <!-- Card Dashboard Garantia -->
                    <div id="select-garantia-dashboard" class="w-full md:w-[340px] bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-purple-500 group">
                        <div class="flex flex-col items-center text-center">
                            <div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-purple-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-purple-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h2 class="text-2xl font-bold text-gray-800 mb-3">Dashboard de Garantia</h2>
                            <p class="text-gray-600">Acompanhe métricas, custos e volume de solicitações de garantia SAT-G.</p>
                        </div>
                    </div>

                    <div id="select-ranking-dashboard"`;

const targetContainer = `            <!-- Conteúdo do Dashboard de Vendas (Oculto Inicialmente) -->`;
const replacementContainer = `            <!-- Conteúdo do Dashboard de Garantia (Oculto Inicialmente) -->
            <div id="dashboard-garantia-container" class="hidden">
                <div class="flex items-center mb-6">
                    <button id="back-to-selector-from-garantia-btn" class="mr-4 p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600" title="Voltar para seleção">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 class="text-4xl font-bold text-gray-800 mb-1">Dashboard de Garantia</h1>
                        <p class="text-lg text-gray-600">Métricas financeiras e de volume SAT-G.</p>
                    </div>
                </div>

                <div id="garantia-dashboard-content" class="w-full">
                    <!-- Cards de Resumo -->
                    <div id="garantia-summary-cards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <!-- Preenchido via JS -->
                    </div>

                    <!-- Layout em Grid para Tabelas e Gráficos -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        
                        <!-- Painel Equipamentos -->
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
                            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <svg class="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                Top 10 Equipamentos com Problema
                            </h3>
                            <div class="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                <ul id="garantia-equipamentos-list" class="space-y-3">
                                    <!-- Injetado via JS -->
                                </ul>
                            </div>
                        </div>

                        <!-- Painel Clientes -->
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
                            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <svg class="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                Top 10 Clientes com Problema
                            </h3>
                            <div class="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                <ul id="garantia-clientes-list" class="space-y-3">
                                    <!-- Injetado via JS -->
                                </ul>
                            </div>
                        </div>

                    </div>

                    <!-- Tabela de Peças Mais Usadas -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden h-[400px] flex flex-col">
                        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            Peças Mais Usadas
                        </h3>
                        <div class="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                            <table class="w-full text-left text-sm text-gray-600">
                                <thead class="text-xs text-gray-400 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-3 font-semibold">Produto / Peça</th>
                                        <th class="px-4 py-3 font-semibold text-center">Quantidade Usada</th>
                                        <th class="px-4 py-3 font-semibold text-right">Custo Total</th>
                                    </tr>
                                </thead>
                                <tbody id="garantia-pecas-list" class="divide-y divide-gray-100">
                                    <!-- Injetado via JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Conteúdo do Dashboard de Vendas (Oculto Inicialmente) -->`;

html = html.replace(targetCard, replacementCard);
html = html.replace(targetContainer, replacementContainer);

fs.writeFileSync('index.html', html);
console.log('HTML do Dashboard de Garantia injetado!');
