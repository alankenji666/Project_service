const fs = require('fs');
let lines = fs.readFileSync('index.html', 'utf8').split('\n');

const paginationHtml = `                    <div class="px-4 py-3 bg-white">
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
                    </div>`.split('\n');

const tableHeaderHtml = `                            <thead class="bg-gray-50 border-b-2 border-gray-100">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">CÓDIGO / DATA</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">CLIENTE</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">GARANTIA</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">ORÇAMENTO</th>
                                    <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">RETORNO ITEM</th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">AÇÕES</th>
                                </tr>
                            </thead>`.split('\n');

const fn = lines.findIndex(l => l.includes('<div class="flex-1 w-full overflow-x-auto min-h-[450px]">'));
if (fn > -1) {
    // Inject pagination right before <div class="flex-1... min-h-[450px]">
    lines.splice(fn, 0, ...paginationHtml);
    
    // The thead starts at fn + paginationHtml.length + 2
    const theadIndex = lines.findIndex((l, i) => i > fn && l.includes('<thead class="bg-gray-50">'));
    if (theadIndex > -1) {
        // Remove old 9 lines of thead (from <thead...> to </thead>)
        lines.splice(theadIndex, 9, ...tableHeaderHtml);
        fs.writeFileSync('index.html', lines.join('\n'));
        console.log('HTML pagination injected using splice successfully!');
    } else {
        console.log('Could not find thead');
    }
} else {
    console.log('Could not find anchor point');
}
