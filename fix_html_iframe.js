const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Add the new button next to the existing button
const headerRegex = /<a href="https:\/\/project-service-3fkn\.vercel\.app" target="_blank" class="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2\.5 rounded-lg transition-colors shadow hover:shadow-md">/;
const headerRepl = `<div class="flex items-center gap-3">
                    <button id="btn-nova-satg-manual" class="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors shadow hover:shadow-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Nova SAT-G (Manual)
                    </button>
                    <a href="https://project-service-3fkn.vercel.app" target="_blank" class="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2.5 rounded-lg transition-colors shadow hover:shadow-md">`;

// Add closing div for the flex container
html = html.replace(headerRegex, headerRepl);
html = html.replace(/Formulário Sat-G\s*<\/a>\s*<\/div>\s*<!-- Filtro e Pesquisa -->/, 'Formulário Sat-G\n                    </a>\n                </div>\n            </div>\n\n            <!-- Filtro e Pesquisa -->');

// 2. Add the Modal HTML at the end of the body
const modalHtml = `
    <!-- Modal Iframe para Nova SAT-G Manual -->
    <div id="satg-iframe-modal" class="fixed inset-0 z-[100] hidden bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden h-[95vh]">
            <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Preencher Nova SAT-G (Agente Interno)
                </h3>
                <button id="close-iframe-modal-btn" class="text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-200 transition-colors" title="Fechar e atualizar lista">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="flex-1 bg-gray-100 relative">
                <div id="satg-iframe-loader" class="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                    <svg class="animate-spin h-10 w-10 text-purple-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p class="text-gray-500 font-medium">Carregando formulário seguro...</p>
                </div>
                <iframe id="satg-form-iframe" src="about:blank" class="w-full h-full border-0 relative z-20 opacity-0 transition-opacity duration-300"></iframe>
            </div>
        </div>
    </div>
</body>`;
html = html.replace(/<\/body>/, modalHtml);

fs.writeFileSync('index.html', html);
console.log('Botão e Modal Iframe adicionados ao HTML!');
