const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="flex items-center gap-3">\s*<div class="relative inline-block text-left" id="modal-satg-print-dropdown-container">/;
const replacement = `<div class="flex items-center gap-3">
                            <button type="button" id="modal-satg-download-btn" class="inline-flex justify-center rounded-md border border-indigo-600 shadow-sm px-4 py-2 bg-indigo-50 text-sm font-medium text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 focus:outline-none transition-colors items-center gap-2" title="Baixar PDF">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Baixar
                            </button>
                            <div class="relative inline-block text-left" id="modal-satg-print-dropdown-container">`;

html = html.replace(regex, replacement);
fs.writeFileSync('index.html', html);
console.log('Botão de download adicionado ao HTML!');
