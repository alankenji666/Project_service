const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = `                        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            Peças Mais Usadas
                        </h3>
                        <div class="overflow-y-auto flex-1 pr-2 custom-scrollbar">`;

const replacement = `                        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            Peças Mais Usadas
                        </h3>

                        <div class="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-lg mb-3 border border-gray-100">
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
                        </div>

                        <div class="overflow-y-auto flex-1 pr-2 custom-scrollbar">`;

html = html.replace(target, replacement);

const targetHeight = `<div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden h-[400px] flex flex-col">`;
const replaceHeight = `<div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden min-h-[500px] flex flex-col">`;
html = html.replace(targetHeight, replaceHeight);

fs.writeFileSync('index.html', html);
console.log('HTML pagination injected!');
